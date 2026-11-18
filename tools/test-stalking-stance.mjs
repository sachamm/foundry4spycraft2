import test from "node:test";
import assert from "node:assert/strict";
import { actor, controls } from "./fixtures/side-stance.mjs";
import {
  stalkingStancePlan as plan,
  validateStalkingStanceProof as validate
} from "../module/rules/stalking-stance.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { SPYCRAFT } from "../module/config.mjs";
import { combatStanceState } from "../module/rules/combat-stance.mjs";
import { declareCombatStance } from "../module/apps/combat-stance.mjs";
import { reviewStanceMovement } from "../module/apps/stance-movement.mjs";
import { stanceMovementRoutePlan as route } from "../module/rules/stance-movement.mjs";
import { rollEvidence } from "../module/rules/outcomes.mjs";
const make = () => {
  const a = actor();
  a.system.activeFeatNames = ["Garrote Basics"];
  a.system.combatStance = { version: 1, key: "stalking", id: "stalk1" };
  return a;
};
const input = { check: "hide", synergySkill: "none", gearStatus: "available" };
test("Stalking adds exactly3 to each named Sneak check in started combat, while preserving the substituted skill bonus", () => {
  const a = make();
  for (const check of SPYCRAFT.skills.sneak.checks) {
    const p = resolveSkillCheck(a.system, "sneak", check, { stalkingCombat: a.clock, synergySkill: "none" }),
      normal = resolveSkillCheck({ ...a.system, combatStance: null }, "sneak", check, {
        stalkingCombat: a.clock,
        synergySkill: "none"
      });
    assert.equal(p.total - normal.total, 3, check.id);
    assert.equal(p.skillBonus, normal.skillBonus);
    assert.equal(p.stalkingStance.bonus, 3);
  }
  assert.equal(plan(a.system, "notice", { id: "search" }, { combat: a.clock }).evidence, null);
});
test("no combat, unstarted/malformed clocks, other stances, lost feat and forced posture give no bonus", () => {
  const a = make();
  for (const combat of [
    null,
    { ...a.clock, started: false },
    { ...a.clock, combatantId: "" },
    { ...a.clock, round: 0 }
  ])
    assert.equal(plan(a.system, "sneak", { id: "hide" }, { combat }).evidence.bonus, 0);
  for (const patch of [
    { combatStance: null },
    { activeFeatNames: [] },
    { conditionContext: { prone: true } },
    { combatStance: { version: 1, key: "side", id: "side" } }
  ])
    assert.equal(plan({ ...a.system, ...patch }, "sneak", { id: "hide" }, { combat: a.clock }).evidence.bonus, 0);
});
test("actual actor ignores a forged combat checkbox/context and records3 only with actual participating clock", async () => {
  const a = make(),
    m = await a.rollSkill("sneak", null, input);
  assert.equal(m.flags.spycraft2.stalkingStance.bonus, 3);
  a.mentalLeapCombatContext = () => null;
  const out = await a.rollSkill("sneak", null, { ...input, inCombat: true, stalkingCombat: a.clock });
  assert.equal(out.flags.spycraft2.stalkingStance.bonus, 0);
  assert.equal(m.flags.spycraft2.rawTotal - out.flags.spycraft2.rawTotal, 3);
});
test("mid-RNG stance/feat/round changes reject without posting and zero proof prevents late benefit injection", async () => {
  for (const change of [
    a => (a.system.combatStance = null),
    a => (a.system.activeFeatNames = []),
    a => a.clock.round++
  ]) {
    const a = make(),
      n = game.messages.length;
    controls.draw = async () => change(a);
    await assert.rejects(a.rollSkill("sneak", null, input), /changed/);
    assert.equal(game.messages.length, n);
  }
  const a = make();
  a.system.combatStance = null;
  controls.draw = async () => {
    a.system.combatStance = { version: 1, key: "stalking", id: "late" };
  };
  await assert.rejects(a.rollSkill("sneak", null, input), /changed/);
  assert.equal(game.messages.length, 0);
});
test("actual original Sneak replacement keeps its historical bonus after exit and round advance; tampered or foreign proof fails", async () => {
  const a = make(),
    m = await a.rollSkill("sneak", null, input),
    c = m.flags.spycraft2;
  a.system.combatStance = null;
  a.clock.round++;
  const r = await a.rollCheck(c.formula, c.rollData, { ...c, rerollOf: m.uuid });
  assert.deepEqual(r.flags.spycraft2.stalkingStance, c.stalkingStance);
  for (const mutate of [p => (p.bonus = 4), p => p.combat.round++]) {
    const proof = structuredClone(c.stalkingStance);
    mutate(proof);
    assert.throws(() =>
      validate(a, proof, { checkKind: "skill", skillKey: "sneak", checkId: "hide", rerollOf: m.uuid })
    );
  }
  const before = rollEvidence(c);
  assert.notEqual(rollEvidence({ ...c, stalkingStance: { ...c.stalkingStance, bonus: 0 } }), before);
  a.system.activeFeatNames = [];
  await assert.rejects(a.rollCheck(c.formula, c.rollData, { ...c, rerollOf: m.uuid }), /qualified/);
});
test("Stalking entry shares the reviewed20ft round cap without changing Speed, and reentry cannot reset it", async () => {
  const a = make(),
    speed = a.system.speed;
  a.system.combatStance = null;
  await declareCombatStance(a, {
    stance: "stalking",
    halfActionConfirmed: true,
    legalConfirmed: true,
    roundMovementFeet: 15,
    roundMovementConfirmed: true
  });
  assert.equal(combatStanceState(a.system).key, "stalking");
  assert.equal(route(a.system, { combat: a.clock, distanceFeet: 5 }).totalFeet, 20);
  assert.throws(() => route(a.system, { combat: a.clock, distanceFeet: 6 }), /Stalking/);
  await reviewStanceMovement(a, { roundMovementFeet: 20, roundMovementConfirmed: true });
  await declareCombatStance(a, { stance: "normal", legalConfirmed: true });
  await assert.rejects(
    declareCombatStance(a, {
      stance: "stalking",
      halfActionConfirmed: true,
      legalConfirmed: true,
      roundMovementFeet: 0,
      roundMovementConfirmed: true
    }),
    /backwards/
  );
  assert.equal(a.system.speed, speed);
});
