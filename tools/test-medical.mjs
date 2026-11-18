import test from "node:test";
import assert from "node:assert/strict";
import { medicalSkillPlan } from "../module/rules/medical.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { resolveKnowledgeCheck } from "../module/rules/knowledge.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const state = (bandage = false) => ({
  activeFeatNames: bandage ? ["Bandage"] : [],
  knowledge: 8,
  skillTotals: Object.fromEntries(
    Object.values(cfg.skills).map(skill => [
      skill.key,
      {
        name: skill.name,
        ranks: 5,
        cap: 30,
        threat: 20,
        totals: skill.abilities.map(ability => ({ ability, total: 7 }))
      }
    ])
  )
});
test("all five Medicine uses have exact combat error increases, with Bandage halving only the stated increase", () => {
  for (const bandage of [false, true])
    for (const check of cfg.skills.medicine.checks)
      for (const inCombat of [false, true])
        for (const combatInSight of [false, true]) {
          const p = medicalSkillPlan(state(bandage), "medicine", check, { inCombat, combatInSight }),
            expected =
              ["first-aid", "stabilize"].includes(check.id) && inCombat
                ? bandage
                  ? 1
                  : 2
                : check.id === "surgery" && combatInSight
                  ? bandage
                    ? 3
                    : 6
                  : 0;
          assert.equal(p.errorIncrease, expected, check.id);
        }
});
test("Surgery uses its specific line-of-sight trigger, and neither a combat declaration nor Bandage creates modifiers for unrelated skills", () => {
  const surgery = cfg.skills.medicine.checks.find(c => c.id === "surgery");
  assert.equal(medicalSkillPlan(state(), "medicine", surgery, { inCombat: true }).errorIncrease, 0);
  assert.equal(medicalSkillPlan(state(), "medicine", surgery, { combatInSight: true }).errorIncrease, 6);
  for (const [key, skill] of Object.entries(cfg.skills).filter(([k]) => k !== "medicine"))
    for (const check of skill.checks) {
      const p = medicalSkillPlan(state(true), key, check, {
        inCombat: true,
        combatInSight: true,
        complexTaskNearby: true,
        dramaticConflictNearby: true
      });
      assert.equal(p.applicable, false);
      assert.equal(p.errorIncrease, 0);
      assert.equal(p.blockedReason, "");
    }
});
test("Therapy is barred by combat or nearby Complex Tasks/Dramatic Conflicts, with strict context declarations", () => {
  const check = cfg.skills.medicine.checks.find(c => c.id === "therapy");
  for (const key of [
    "inCombat",
    "complexTaskNearby",
    "dramaticConflictNearby",
    "inComplexTask",
    "inDramaticConflict"
  ]) {
    assert.ok(medicalSkillPlan(state(true), "medicine", check, { [key]: true }).blockedReason);
    assert.equal(medicalSkillPlan(state(true), "medicine", check, { [key]: "true" }).blockedReason, "");
  }
  assert.equal(medicalSkillPlan(state(), "medicine", check).blockedReason, "");
});
test("combat increases precede ordinary mastery/error reductions, preserve untrained increases and never affect Knowledge", () => {
  const s = state(true);
  s.skillTotals.medicine.errorReduction = 2;
  s.skillTotals.medicine.errorFloor = 1;
  const first = cfg.skills.medicine.checks.find(c => c.id === "first-aid"),
    surgery = cfg.skills.medicine.checks.find(c => c.id === "surgery");
  assert.equal(resolveSkillCheck(s, "medicine", first, { gearStatus: "available", inCombat: true }).error, 1);
  assert.equal(resolveSkillCheck(s, "medicine", surgery, { gearStatus: "available", combatInSight: true }).error, 5);
  s.skillTotals.medicine.ranks = 0;
  assert.equal(resolveSkillCheck(s, "medicine", first, { gearStatus: "available", inCombat: true }).error, 2);
  assert.equal(resolveKnowledgeCheck(s, { skill: "medicine", inCombat: true, combatInSight: true }).error, 1);
});
globalThis.Actor = class {
  constructor() {
    this.system = state(true);
    this.items = [];
    this.type = "agent";
    this.uuid = "Actor.medical";
    this.isOwner = true;
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = { user: { isGM: true }, settings: { get: () => false }, i18n: { localize: s => s } };
globalThis.foundry = { utils: { escapeHTML: s => String(s) } };
globalThis.ui = { notifications: { warn: () => null } };
const { SpycraftActor } = await import("../module/documents/actor.mjs");
test("actual entry uses current combat participation even if the input tries to clear it, records Bandage and blocks Therapy before rolling", async () => {
  class CombatActor extends SpycraftActor {
    get participatingCombat() {
      return this.fighting ? { id: "c", round: 1 } : null;
    }
  }
  const a = new CombatActor();
  a.fighting = true;
  let rolls = 0;
  a.rollCheck = async (formula, data, options) => {
    rolls++;
    return { data, options };
  };
  const first = await a.rollSkill("medicine", "wis", { check: "first-aid", inCombat: false, gearStatus: "available" });
  assert.equal(first.options.error, 2);
  assert.equal(first.options.medical.inCombat, true);
  assert.equal(first.options.medical.bandage, true);
  const stabilize = await a.rollSkill("medicine", "wis", { check: "stabilize", gearStatus: "available" });
  assert.equal(stabilize.options.error, 3);
  const surgery = await a.rollSkill("medicine", "int", {
    check: "surgery",
    gearStatus: "available",
    combatInSight: true
  });
  assert.equal(surgery.options.error, 7);
  const before = rolls;
  assert.equal(await a.rollSkill("medicine", "wis", { check: "therapy" }), null);
  assert.equal(rolls, before);
  a.fighting = false;
  assert.equal(await a.rollSkill("medicine", "wis", { check: "therapy", complexTaskNearby: true }), null);
});
