// These fixtures supply required gear unless a case explicitly overrides gearStatus; absence/kit boundaries are tested in test-skill-gear.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { proficiencyTotals } from "../module/rules/training.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { readFileSync } from "node:fs";
const origins = JSON.parse(readFileSync(new URL("../src/data/origins.json", import.meta.url)));
const origin = name => {
  const o = [...origins.talents, ...origins.specialties].find(i => i.name === name);
  return { id: name, name, type: "origin", system: { ...o, grants: [] } };
};
function compute(level = 1, items = [], patch = {}) {
  const sys = {
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 10, misc: 0 }])),
    progression: Array.from({ length: level }, () => ({ classId: "test", skills: {}, vitality: 1 })),
    skills: {},
    focuses: { cultures: [], drive: [], profession: [], science: [], fortes: [] },
    misc: {},
    ...patch
  };
  const cls = {
    id: "test",
    name: "Test",
    type: "class",
    system: { identifier: "test", skillPoints: 4, vitalityDie: 6, proficiencies: 4, table: [], classSkills: [] }
  };
  return computeAgent(sys, [cls, ...items], cfg);
}

test("RAW pp.28,298: all 16 proficiency/forte options use fixed grants without spending discretionary picks", () => {
  assert.equal(Object.keys(cfg.proficiencies).length, 16);
  for (const key of Object.keys(cfg.proficiencies)) {
    const result = proficiencyTotals(
      { proficiencies: { [key]: { proficient: true, forte: true } } },
      cfg,
      target => (target === `prof.${key}` ? 1 : 0),
      4
    );
    assert.equal(result.totals[key].proficient, true);
    assert.equal(result.totals[key].forte, true);
    assert.equal(result.picks.used, 1);
    const invalid = proficiencyTotals({ proficiencies: { [key]: { forte: true } } }, cfg, () => 0, 4);
    assert.equal(invalid.totals[key].forte, false);
    assert.equal(invalid.warnings.length, 1);
  }
  for (const name of ["Burly", "Criminal", "Doctor", "Hunter", "Serviceman", "Warrior", "Special Ops"])
    assert.ok(
      Object.values(compute(1, [origin(name)]).proficiencyTotals).some(p => p.granted),
      name
    );
});

test("RAW p.98: flexible focus picks can be spent in any focus skill; current INT does not change the starting pool", () => {
  const sys = compute(1, [], {
    startingIntelligenceModifier: 2,
    focuses: {
      cultures: ["Central America", "Western Europe", "Oceania (including Australia)"],
      drive: [],
      science: [],
      profession: [],
      fortes: []
    }
  });
  assert.equal(sys.focusPicks.generic.used, 2);
  assert.equal(sys.focusPicks.generic.remaining, 0);
  assert.equal(sys.focusPicks.cultures.remaining, 0);
  assert.ok(!sys.warnings.some(w => w.includes("flexible picks")));
  assert.equal(compute(0).focusPicks.generic.available, 0);
  assert.equal(compute(0).focusPicks.drive.available, 0);
});

test("RAW pp.21–26: named focus grants and required fortes are preserved", () => {
  const checks = [
    ["Financier", "science", "Economy"],
    ["Tradesman", "science", "Fabrication"],
    ["Outdoorsman", "drive", "Mounts and Animal-Drawn Vehicles"],
    ["Hot Rodder", "drive", "Standard Ground Vehicles"]
  ];
  for (const [name, key, value] of checks) assert.ok(compute(1, [origin(name)]).focusTotals[key].includes(value), name);
  for (const name of ["Authority", "Hot Rodder", "Pilot", "Sailor", "Thrill-Seeker"])
    assert.ok(
      compute(1, [origin(name)]).todo.some(t => t.text.includes("granted forte")),
      name
    );
  assert.equal(cfg.focuses.cultures.length, 11);
  assert.equal(cfg.focuses.drive.length, 12);
  assert.equal(cfg.focuses.science.length, 9);
});

test("RAW p.98: missing focus halves ranks, keeps the full-rank cap and adds the untrained error increase; one applicable forte adds +1", () => {
  const skill = { focus: true, ranks: 7, totals: [{ ability: "int", total: 10 }], threat: 20, cap: 40 };
  const sys = {
    skillTotals: { science: skill },
    focusTotals: { science: ["Engineering"] },
    skillFortes: [{ skill: "science", focus: "Engineering", forte: "Bridges" }]
  };
  const check = cfg.skills.science.checks.find(c => c.id === "engineering");
  const owned = resolveSkillCheck(sys, "science", check, {
    gearStatus: "available",
    focus: "Engineering",
    forte: true
  });
  assert.equal(owned.total, 11);
  assert.equal(owned.error, 1);
  const other = resolveSkillCheck(sys, "science", check, { gearStatus: "available", focus: "Genetics" });
  assert.equal(other.total, 6);
  assert.equal(other.error, 3);
  assert.equal(other.cap, 40);
});

test("RAW pp.18–26,53: all Interest progression boundaries and growing contact grants", () => {
  for (let level = 0; level <= 20; level++) {
    const ordinary = 2 + [2, 6, 10, 14, 18].filter(n => n <= level).length;
    const spec = 1 + [2, 6, 10, 14, 18].filter(n => n <= level).length;
    assert.equal(compute(level).interestPicks.available, ordinary);
    assert.equal(compute(level, [origin("Gonzo"), origin("Student")]).interestPicks.available, ordinary + 2 * spec);
    if (level)
      for (const name of ["Shrewd", "Journalist"])
        assert.equal(compute(level, [origin(name)]).contactPicks.available, 1 + 2 * (1 + Math.floor(level / 6)));
  }
  const reduced = compute(1, [], { relinquishedInterests: 1 });
  assert.equal(reduced.interestPicks.available, 1);
});

test("RAW pp.53–54: completed Subplots do not consume the limit; Crossroads bonuses replace earlier grades", () => {
  const sys = compute(1, [], {
    subplots: [
      { name: "Debt", complete: true },
      { name: "Mystery", complete: false }
    ]
  });
  assert.equal(sys.subplotPicks.used, 1);
  for (const [title, level, dice, xp] of [
    ["seasoned", 2, 1, 0],
    ["weathered", 7, 1, 5],
    ["hardened", 13, 2, 5],
    ["crafty", 19, 2, 10]
  ]) {
    const actual = compute(level, [], { crossroadsTitle: title }),
      base = compute(level);
    assert.equal(actual.actionDice.max - base.actionDice.max, dice, title);
    assert.equal(actual.crossroads.xpPercent, xp, title);
  }
  assert.deepEqual(
    cfg.tables.contacts.map(c => c.rank),
    [1, 2, 3, 4]
  );
});

test("RAW p.191: Trouble Magnet grants one extra Subplot per selection, twice maximum, while its minimum remains one at every career level", () => {
  const definition = JSON.parse(readFileSync(new URL("../src/data/feats.json", import.meta.url))).find(
      f => f.name === "Trouble Magnet"
    ),
    feat = (id, career = 1) => ({
      id,
      name: "Trouble Magnet",
      type: "feat",
      system: { ...structuredClone(definition), tree: "chance", acquiredAtLevel: career, granted: true }
    });
  for (let level = 1; level <= 20; level++)
    for (const copies of [1, 2, 3]) {
      const base = compute(level),
        items = Array.from({ length: copies }, (_, i) => feat("trouble" + i)),
        s = compute(level, items);
      assert.equal(s.subplotPicks.available, base.subplotPicks.available + Math.min(2, copies));
      assert.equal(s.subplotPicks.minimum, 1);
      assert.equal(s.subplotPicks.needsSubplot, true);
      assert.ok(s.todo.some(t => t.tab === "training" && /Trouble Magnet/.test(t.text)));
      assert.ok(s.warnings.some(w => /at least one unfinished Subplot/.test(w)));
      if (copies === 3) assert.equal(s.featStatus.trouble2.ok, false);
    }
  for (const subplots of [
    [],
    [{ name: "", notes: "", complete: false }],
    [{ name: "   ", notes: "  ", complete: false }],
    [{ name: "Completed obligation", complete: true }]
  ])
    assert.equal(compute(1, [feat("trouble")], { subplots }).subplotPicks.needsSubplot, true);
  for (const subplots of [
    [{ name: "Family obligation", complete: false }],
    [{ name: "", notes: "A named faction pursues the agent", complete: false }],
    [
      { name: "Debt", complete: false },
      { name: "Mystery", complete: true }
    ]
  ]) {
    const s = compute(1, [feat("trouble")], { subplots });
    assert.equal(s.subplotPicks.inPlay, 1);
    assert.equal(s.subplotPicks.needsSubplot, false);
    assert.equal(
      s.todo.some(t => /Trouble Magnet/.test(t.text)),
      false
    );
    assert.equal(
      s.warnings.some(w => /at least one unfinished Subplot/.test(w)),
      false
    );
  }
  const ordinary = compute(1);
  assert.equal(ordinary.subplotPicks.minimum, 0);
  assert.equal(ordinary.subplotPicks.needsSubplot, false);
});

test("RAW p.193: Sprint needs Dash, adds ten Speed before a single halving condition and never stacks with a duplicate copy", () => {
  const defs = JSON.parse(readFileSync(new URL("../src/data/feats.json", import.meta.url))),
    feat = (name, id, career) => ({
      id,
      name,
      type: "feat",
      system: { ...structuredClone(defs.find(f => f.name === name)), tree: "chase", acquiredAtLevel: career }
    }),
    dash = feat("Dash", "dash", 1),
    sprint = feat("Sprint", "sprint", 3),
    patch = {
      progression: [
        { classId: "test", vitality: 6, skills: { athletics: 8 } },
        { classId: "test", vitality: 3, skills: {} },
        { classId: "test", vitality: 3, skills: {} }
      ]
    };
  const base = compute(3, [dash], structuredClone(patch)),
    s = compute(3, [dash, sprint], structuredClone(patch));
  assert.equal(base.featStatus.dash.ok, true);
  assert.equal(s.featStatus.sprint.ok, true);
  assert.equal(s.speed, base.speed + 10);
  assert.equal(s.speed, 40);
  const half = compute(3, [dash, sprint], { ...structuredClone(patch), conditionContext: { entangled: true } });
  assert.equal(half.speed, 20);
  assert.equal(half.canRun, false);
  const missing = compute(3, [sprint], structuredClone(patch));
  assert.equal(missing.featStatus.sprint.ok, false);
  assert.equal(missing.speed, 30);
  const duplicate = compute(3, [dash, sprint, feat("Sprint", "duplicate", 3)], structuredClone(patch));
  assert.equal(duplicate.speed, 40);
  assert.equal(duplicate.featStatus.duplicate.ok, false);
});
