import test from "node:test";
import assert from "node:assert/strict";
import { subplotPlan } from "../module/rules/subplots.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
const titles = cfg.tables.crossroads;
const standard = count =>
  Array.from({ length: count }, (_, i) => ({ name: `Completed story ${i}`, kind: "standard", complete: true }));
test("Routine holds active Crossroads and unknown legacy types, keeps standard stories and retains completed history", () => {
  const system = {
    level: 20,
    campaignEffects: { forbidCrossroads: true },
    subplots: [
      { name: "Ordinary story", kind: "standard" },
      { name: "Custom title", kind: "seasoned" },
      { name: "Unclassified legacy story" },
      { name: "Finished Crossroads", kind: "seasoned", complete: true }
    ]
  };
  const before = structuredClone(system),
    p = subplotPlan(system, titles);
  assert.deepEqual(p.active, [0]);
  assert.equal(p.errors.length, 2);
  assert.match(p.errors[0].text, /Routine prevents/);
  assert.match(p.errors[1].text, /GC must classify/);
  assert.deepEqual(system, before);
  delete system.campaignEffects.forbidCrossroads;
  assert.ok(subplotPlan(system, titles).active.includes(2));
});
test("Crossroads prerequisites use actual minimum level, explicitly completed standard stories and lower GC-confirmed titles", () => {
  for (const [index, [kind, title]] of Object.entries(Object.entries(titles))) {
    const previous = Object.keys(titles)[Number(index) - 1] ?? "";
    const system = {
      level: title.level,
      crossroadsTitle: previous,
      subplots: [...standard(title.completed), { name: "New Crossroads", kind }]
    };
    assert.deepEqual(subplotPlan(system, titles).errors, []);
    assert.equal(subplotPlan({ ...system, level: title.level - 1 }, titles).errors.length, 1);
    assert.match(
      subplotPlan({ ...system, subplots: [...standard(title.completed - 1), { name: "New Crossroads", kind }] }, titles)
        .errors[0].text,
      /completed standard/
    );
    if (Number(index) > 0)
      assert.match(subplotPlan({ ...system, crossroadsTitle: "" }, titles).errors[0].text, /lower Crossroads/);
  }
});
test("completed unclassified rows and completed Crossroads do not silently become standard prerequisites", () => {
  const p = subplotPlan(
    {
      level: 2,
      subplots: [
        { name: "Old unclassified", complete: true },
        { name: "Old Crossroads", kind: "seasoned", complete: true },
        { name: "New attempt", kind: "seasoned" }
      ]
    },
    titles
  );
  assert.equal(p.completedStandard, 0);
  assert.match(p.errors[0].text, /GC must confirm 2/);
});
test("held titles and duplicate active attempts cannot be undertaken again", () => {
  const system = {
    level: 2,
    subplots: [...standard(2), { name: "First", kind: "seasoned" }, { name: "Second", kind: "seasoned" }]
  };
  assert.match(subplotPlan(system, titles).errors[0].text, /already has an active attempt/);
  const held = subplotPlan({ ...system, crossroadsTitle: "seasoned" }, titles);
  assert.equal(held.active.length, 0);
  assert.match(held.errors[0].text, /already held/);
});
test("free-text titles do not classify Crossroads and saved invalid types require correction", () => {
  assert.deepEqual(subplotPlan({ subplots: [{ name: "Crossroads", kind: "standard" }] }, titles).errors, []);
  assert.match(
    subplotPlan({ subplots: [{ name: "Story", kind: "made-up" }] }, titles).errors[0].text,
    /saved Subplot type/
  );
});
test("Routine validation reaches Gear-free PC setup and leaves an existing Crossroads title's benefits intact", () => {
  const source = {
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
    progression: Array.from({ length: 7 }, () => ({ classId: "test", vitality: 4, skills: {} })),
    crossroadsTitle: "seasoned",
    subplots: [{ name: "Later attempt", kind: "weathered" }],
    misc: {}
  };
  const cl = {
    id: "test",
    name: "Test",
    type: "class",
    system: { identifier: "test", table: [], classSkills: [], vitalityDie: 8, skillPoints: 4, proficiencies: 4 }
  };
  const normal = computeAgent(structuredClone(source), [cl], cfg),
    routine = computeAgent(structuredClone(source), [cl], cfg, { campaignEffects: { forbidCrossroads: true } });
  assert.equal(routine.actionDice.max, normal.actionDice.max);
  assert.equal(routine.crossroads.label, "Seasoned");
  assert.equal(routine.subplotPicks.used, 1);
  assert.equal(routine.subplotPicks.inPlay, 0);
  assert.ok(routine.todo.some(t => t.tab === "training" && t.error && t.text.includes("Routine prevents")));
  assert.equal(source.subplots[0].kind, "weathered");
});

test("invalid saved Crossroads titles remain explicit setup corrections and supply no title benefits", () => {
  const source = {
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
    progression: [{ classId: "test", vitality: 4, skills: {} }],
    misc: {}
  };
  const cl = {
    id: "test",
    name: "Test",
    type: "class",
    system: { identifier: "test", table: [], classSkills: [], vitalityDie: 8, skillPoints: 4, proficiencies: 4 }
  };
  for (const crossroadsTitle of ["made-up", "constructor", "__proto__", "seasoned"]) {
    const p = computeAgent({ ...structuredClone(source), crossroadsTitle }, [cl], cfg);
    assert.equal(p.crossroads.actionDice, 0);
    assert.ok(
      p.todo.some(
        t =>
          t.tab === "training" &&
          t.error &&
          (t.text.includes("Crossroads title") || t.text.includes("minimum Career Level"))
      )
    );
  }
});
