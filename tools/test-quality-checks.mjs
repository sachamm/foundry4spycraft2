import test from "node:test";
import assert from "node:assert/strict";
import { qualitySkillChecks } from "../module/rules/quality-checks.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { resolveKnowledgeCheck } from "../module/rules/knowledge.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { readFile } from "node:fs/promises";
const effects = (key, n) => Array.from({ length: n }, () => ({ qualityKey: key })),
  state = (n = 2) => ({
    originEffects: [...effects("fearless", n), ...effects("strongMinded", n)],
    skillTotals: Object.fromEntries(
      Object.entries(cfg.skills).map(([key, s]) => [
        key,
        { ranks: 5, cap: 30, threat: 20, totals: s.abilities.map(ability => ({ ability, total: 8 })) }
      ])
    )
  });
test("Fearless and Strong-Minded cover exactly Morale and every actual Resist named use, across all skills, with no leakage from labels", () => {
  for (const [key, skill] of Object.entries(cfg.skills))
    for (const check of skill.checks) {
      const p = qualitySkillChecks(state(), key, check);
      assert.equal(p.fearless, key === "resolve" && check.id === "morale" ? 8 : 0, key + "/" + check.id);
      assert.equal(
        p.strongMinded,
        (key === "resolve" && ["resist-impress", "resist-intimidate"].includes(check.id)) ||
          (key === "senseMotive" && check.id === "resist-manipulate")
          ? 8
          : 0,
        key + "/" + check.id
      );
    }
  assert.equal(
    qualitySkillChecks({ originEffects: [{ name: "Fearless I" }, { details: "Strong-Minded" }] }, "resolve", {
      id: "morale"
    }).bonuses.length,
    0
  );
});
test("repeated grades add four each up to the printed twenty-point maximum and only apply as check modifiers, including passive checks", () => {
  for (let n = 0; n <= 7; n++) {
    const s = state(n);
    for (const [key, id] of [
      ["resolve", "morale"],
      ["resolve", "resist-impress"],
      ["resolve", "resist-intimidate"],
      ["senseMotive", "resist-manipulate"]
    ]) {
      const c = cfg.skills[key].checks.find(c => c.id === id),
        r = resolveSkillCheck(s, key, c, { synergySkill: "none" });
      assert.equal(r.total, 8 + Math.min(5, n) * 4);
      assert.equal(r.skillBonus, 8);
      assert.equal(r.cap, 30);
      assert.equal(r.actionDiceAllowed, false);
      assert.equal(r.rollMode, "blindroll");
      assert.equal(r.error, c.error);
      assert.match(r.notes, n ? /named check/ : /Passive/);
    }
  }
  const s = state();
  s.skillTotals.resolve.bonusEntries = [{ source: "Other feat", value: 2, type: "insight" }];
  s.skillTotals.resolve.totals = s.skillTotals.resolve.totals.map(t => ({ ...t, total: t.total + 2 }));
  assert.equal(
    resolveSkillCheck(
      s,
      "resolve",
      cfg.skills.resolve.checks.find(c => c.id === "morale"),
      { synergySkill: "none" }
    ).total,
    18
  );
});
const defs = JSON.parse(await readFile(new URL("../src/data/classes.json", import.meta.url), "utf8")),
  origins = JSON.parse(await readFile(new URL("../src/data/origins.json", import.meta.url), "utf8")),
  scout = defs.find(c => c.key === "scout"),
  subject = origins.specialties.find(o => o.name === "Test Subject"),
  source = () => ({
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
    progression: [{ classId: "scout", vitality: 5, skills: {} }]
  }),
  items = qualities => [
    { id: "scout", name: "Scout", type: "class", system: { ...scout, identifier: "scout", vitalityDie: 10 } },
    {
      id: "subject",
      name: "Test Subject",
      type: "origin",
      system: {
        ...subject,
        originChoices: { up: "con", down: "int", npcQuality0: qualities[0], npcQuality1: qualities[1] }
      }
    }
  ];
test("actual Test Subject selections derive mixed and repeated grades and recalculate upon replacement without adding general Will or Knowledge bonuses", () => {
  const unselected = computeAgent(source(), items([]), cfg);
  for (const qualities of [
    ["fearless", "fearless"],
    ["strongMinded", "strongMinded"],
    ["fearless", "strongMinded"],
    []
  ]) {
    const s = computeAgent(source(), items(qualities), cfg);
    for (const [key, id, q] of [
      ["resolve", "morale", "fearless"],
      ["resolve", "resist-impress", "strongMinded"],
      ["senseMotive", "resist-manipulate", "strongMinded"]
    ]) {
      const c = cfg.skills[key].checks.find(c => c.id === id),
        before = resolveSkillCheck(unselected, key, c, { synergySkill: "none" }),
        after = resolveSkillCheck(s, key, c, { synergySkill: "none" });
      assert.equal(after.total - before.total, 4 * qualities.filter(k => k === q).length);
    }
    assert.equal(s.saves.will.total, unselected.saves.will.total);
    assert.equal(
      resolveKnowledgeCheck(s, cfg, { skill: "resolve" }).total,
      resolveKnowledgeCheck(unselected, cfg, { skill: "resolve" }).total
    );
  }
});
globalThis.Actor = class {};
globalThis.foundry = { utils: { escapeHTML: s => String(s) } };
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = { settings: { get: () => [] } };
globalThis.ui = { notifications: { warn: () => null } };
const { SpycraftActor } = await import("../module/documents/actor.mjs");
test("the actual skill entry freezes exact selected-quality check benefits and does not apply them to unrelated skill uses", async () => {
  const a = new SpycraftActor();
  a.type = "agent";
  a.items = [];
  a.system = state();
  a.rollCheck = async (formula, data, options) => ({ data, options });
  const morale = await a.rollSkill("resolve", "wis", { check: "morale", synergySkill: "none" });
  assert.equal(morale.data.total, 16);
  assert.equal(morale.options.qualityChecks.fearless, 8);
  const resist = await a.rollSkill("senseMotive", "wis", { check: "resist-manipulate", synergySkill: "none" });
  assert.equal(resist.options.qualityChecks.strongMinded, 8);
  const other = await a.rollSkill("resolve", "con", {
    check: cfg.skills.resolve.checks.find(c => c.id !== "morale" && !c.id.startsWith("resist")).id,
    synergySkill: "none"
  });
  assert.equal(other.options.qualityChecks.bonuses.length, 0);
});

test("Seductive adds exactly four for an actual disposition shift or seduction conflict, once even when both apply; the Disposition tag alone is insufficient", () => {
  for (const [key, skill] of Object.entries(cfg.skills))
    for (const check of skill.checks) {
      const s = state(0);
      s.originEffects = effects("seductive", 2);
      for (const shiftingDisposition of [false, true])
        for (const seductionConflict of [false, true]) {
          const input = { shiftingDisposition, seductionConflict, gearStatus: "available", synergySkill: "none" },
            p = qualitySkillChecks(s, key, check, input);
          assert.equal(p.seductive, shiftingDisposition || seductionConflict ? 4 : 0);
          const before = resolveSkillCheck(state(0), key, check, input),
            after = resolveSkillCheck(s, key, check, input);
          assert.equal(after.total - before.total, p.seductive, key + "/" + check.id);
        }
    }
  const check = cfg.skills.resolve.checks.find(c => c.id === "morale"),
    s = state(0);
  s.originEffects = effects("seductive", 1);
  assert.equal(
    qualitySkillChecks(s, "resolve", check, { shiftingDisposition: "true", seductionConflict: 1 }).seductive,
    0
  );
  assert.equal(qualitySkillChecks(state(0), "resolve", check, { shiftingDisposition: true }).seductive, 0);
});
test("Seductive remains a check adjustment, stacks with different selected quality benefits, records exact context and cannot hide its Dramatic Conflict from standalone abilities or Therapy", async () => {
  const s = state(2);
  s.originEffects.push(...effects("seductive", 1));
  const a = new SpycraftActor();
  a.type = "agent";
  a.items = [];
  a.system = s;
  a.rollCheck = async (formula, data, options) => ({ data, options });
  const r = await a.rollSkill("resolve", "wis", {
    check: "resist-impress",
    seductionConflict: true,
    synergySkill: "none"
  });
  assert.equal(r.data.total, 20);
  assert.equal(r.options.qualityChecks.seductive, 4);
  assert.equal(r.options.qualityChecks.seductionConflict, true);
  assert.equal(r.options.inDramaticConflict, true);
  s.classLevels = { scientist: 14 };
  const check = cfg.skills.science.checks[0];
  assert.match(
    resolveSkillCheck(s, "science", check, {
      seductionConflict: true,
      tenSecondSolution: true,
      standaloneCheckConfirmed: true,
      synergySkill: "none",
      gearStatus: "available"
    }).blockedReason,
    /outside Complex Tasks and Dramatic Conflicts/
  );
  assert.equal(
    resolveSkillCheck(
      s,
      "medicine",
      cfg.skills.medicine.checks.find(c => c.id === "therapy"),
      { seductionConflict: true, gearStatus: "available" }
    ).blocked,
    true
  );
});

import { CAMOUFLAGE_TERRAINS, camouflageTerrain } from "../module/rules/quality-checks.mjs";
import { resolveOriginChoices } from "../module/rules/origins.mjs";
test("Camouflaged supports exactly eight explicit terrains, preserves incomplete legacy details and rejects duplicate same-terrain selections", () => {
  assert.equal(Object.keys(CAMOUFLAGE_TERRAINS).length, 8);
  for (const terrain of Object.keys(CAMOUFLAGE_TERRAINS))
    assert.equal(camouflageTerrain(" " + terrain.toUpperCase() + " "), terrain);
  for (const value of ["urban", "night", "forest or swamp", "constructor", "", null, 1])
    assert.equal(camouflageTerrain(value), null);
  const subject = items(["camouflaged", "camouflaged"])[1];
  subject.system.originChoices.npcDetails0 = " Forest ";
  subject.system.originChoices.npcDetails1 = "swamp";
  let p = resolveOriginChoices(subject, source(), [], cfg);
  assert.deepEqual(
    p.notes.map(e => e.terrain),
    ["forest", "swamp"]
  );
  assert.equal(p.pending.length, 0);
  subject.system.originChoices.npcDetails1 = "forest";
  p = resolveOriginChoices(subject, source(), [], cfg);
  assert.equal(p.notes.length, 1);
  assert.match(p.warnings[0], /different terrain/);
  subject.system.originChoices.npcDetails1 = "forest or swamp";
  p = resolveOriginChoices(subject, source(), [], cfg);
  assert.ok(p.pending.some(s => s.includes("terrain")));
  assert.equal(p.notes[1].details, "forest or swamp");
  assert.equal(p.notes[1].terrain, null);
});
test("every skill use receives camouflage only for Blend/Stealth or Sneak/Hide in the chosen terrain, with four points once per terrain", () => {
  for (const selected of Object.keys(CAMOUFLAGE_TERRAINS)) {
    const s = state(0);
    s.originEffects = [
      { qualityKey: "camouflaged", terrain: selected },
      { qualityKey: "camouflaged", terrain: selected }
    ];
    for (const terrain of [...Object.keys(CAMOUFLAGE_TERRAINS), "urban", ""])
      for (const [key, skill] of Object.entries(cfg.skills))
        for (const check of skill.checks) {
          const p = qualitySkillChecks(s, key, check, { terrain });
          assert.equal(
            p.camouflaged,
            terrain === selected &&
              ((key === "blend" && check.id === "stealth") || (key === "sneak" && check.id === "hide"))
              ? 4
              : 0,
            key + "/" + check.id + "/" + terrain
          );
        }
  }
  const s = state(0);
  s.originEffects = [{ qualityKey: "camouflaged", terrain: "forest" }];
  for (const [key, id] of [
    ["blend", "stealth"],
    ["sneak", "hide"]
  ]) {
    const c = cfg.skills[key].checks.find(c => c.id === id);
    assert.equal(resolveSkillCheck(s, key, c, { terrain: "forest", synergySkill: "none" }).total, 12);
    assert.equal(resolveSkillCheck(s, key, c, { terrain: "swamp", synergySkill: "none" }).total, 8);
  }
});
test("engine changes to selected camouflage terrain recalculate skill-context benefits and actual roll entry freezes the selected terrain", async () => {
  const item = items(["camouflaged", "camouflaged"]);
  item[1].system.originChoices.npcDetails0 = "Forest";
  item[1].system.originChoices.npcDetails1 = "swamp";
  const s = computeAgent(source(), item, cfg),
    c = cfg.skills.sneak.checks.find(c => c.id === "hide");
  const before = resolveSkillCheck(s, "sneak", c, { terrain: "forest", synergySkill: "none" });
  item[1].system.originChoices.npcDetails0 = "desert";
  const changed = computeAgent(source(), item, cfg);
  assert.equal(
    resolveSkillCheck(changed, "sneak", c, { terrain: "forest", synergySkill: "none" }).total,
    before.total - 4
  );
  assert.equal(
    resolveSkillCheck(changed, "sneak", c, { terrain: "swamp", synergySkill: "none" }).qualityChecks.camouflaged,
    4
  );
  const a = new SpycraftActor();
  a.type = "agent";
  a.items = [];
  a.system = changed;
  a.rollCheck = async (formula, data, options) => ({ data, options });
  const r = await a.rollSkill("sneak", "dex", { check: "hide", terrain: "desert", synergySkill: "none" });
  assert.equal(r.options.qualityChecks.camouflaged, 4);
  assert.equal(r.options.qualityChecks.terrain, "desert");
});
