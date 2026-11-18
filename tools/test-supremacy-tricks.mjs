import test from "node:test";
import assert from "node:assert/strict";
import {
  UNARMED_TRICKS,
  unarmedTrickPlan,
  unarmedTrickNote,
  unarmedTrickDamageNote,
  coiledStanceBonus
} from "../module/rules/unarmed-tricks.mjs";
import { skillTrickPlan, unarmedDamageFormula } from "../module/rules/skill-tricks.mjs";
import { handOfGodEligible, handOfGodSpec } from "../module/rules/hand-of-god.mjs";
import { grappleTrickLines } from "../module/rules/grapple-tricks.mjs";
import { COMBAT_STANCES } from "../module/rules/combat-stance.mjs";

const fists = { proficiency: "unarmed", damage: "1d4", qualities: "" };
const owner = feats => ({ activeFeatNames: feats, conditionContext: {} });

test("Boxing and Kicking Supremacy tricks", () => {
  const box = owner(["Boxing Supremacy"]);
  assert.equal(unarmedTrickPlan(box, fists, { trick: "drivingPunch" }).threatIncrease, 2);
  assert.ok(UNARMED_TRICKS.drivingPunch.missFlatFooted);
  assert.match(unarmedTrickNote({ key: "turningPunch" }), /dodge bonus .* counts twice/);
  assert.match(unarmedTrickDamageNote("turningPunch", 5), /triple damage, 15 in all/);
  const kick = owner(["Kicking Supremacy"]);
  assert.equal(
    unarmedTrickPlan(kick, fists, { trick: "thrustKick", kick: true, attackAction: "other" }).blocked,
    false
  );
  assert.ok(unarmedTrickPlan(kick, fists, { trick: "thrustKick" }).blocked, "only on a Kick");
  assert.equal(unarmedTrickPlan(kick, fists, { trick: "hurricaneKick", kick: true }).damageBonus, -2);
});

test("Coiled Stance: +2 unarmed against a lower Reflex save bonus", () => {
  assert.deepEqual(COMBAT_STANCES.coiled, { name: "Coiled Stance", feat: "Brawling Basics", page: 185 });
  const s = { ...owner(["Brawling Basics"]), combatStance: { version: 1, id: "x", key: "coiled" } };
  assert.equal(coiledStanceBonus(s, fists, { lowerReflex: true }), 2);
  assert.equal(coiledStanceBonus(s, fists, { lowerReflex: false }), 0);
  assert.equal(coiledStanceBonus(s, { proficiency: "edged" }, { lowerReflex: true }), 0);
});

test("Trip, Bull Rush and Feint tricks state their effects with the unarmed damage", () => {
  const sys = {
    ...owner(["Wrestling Supremacy", "Rolling Supremacy", "Dirty Fighting Moves", "Brawling Moves", "Wrestling Moves"]),
    unarmed: { die: 4, extraDice: 0, damageBonus: 2 }
  };
  assert.equal(unarmedDamageFormula(sys), "1d4+2");
  assert.match(
    skillTrickPlan(sys, "acrobatics", { id: "trip" }, { skillTrick: "doubleHurl" }).notes[0],
    /1d4\+2 × 2.*flash and of bang/
  );
  assert.match(skillTrickPlan(sys, "acrobatics", { id: "trip" }, { skillTrick: "hipToss" }).notes[0], /fatigued/);
  assert.equal(skillTrickPlan(sys, "athletics", { id: "bull-rush" }, { skillTrick: "torpedo" }).sizeBonus, 2);
  assert.match(
    skillTrickPlan(sys, "sleightOfHand", { id: "feint" }, { skillTrick: "mudInYourEye" }).blockedReason,
    /Confirm/
  );
  assert.equal(
    skillTrickPlan(sys, "sleightOfHand", { id: "feint" }, { skillTrick: "mudInYourEye", skillTrickOnceConfirmed: true })
      .sizeBonus,
    4
  );
  assert.match(
    skillTrickPlan(sys, "athletics", { id: "bull-rush" }, { skillTrick: "doubleHurl" }).blockedReason,
    /different check/
  );
  assert.match(
    skillTrickPlan(owner([]), "acrobatics", { id: "trip" }, { skillTrick: "bodySlam" }).blockedReason,
    /needs its feat/
  );
});

test("Spirit and Rolling Supremacy defend; Back Breaker joins the grapple tricks", () => {
  const spirit = { ...owner(["Spirit Supremacy"]), totalDefenseState: { active: true } };
  const miss = { checkKind: "attack", resolved: true, successConfirmed: false };
  assert.ok(handOfGodEligible(spirit, miss));
  assert.equal(handOfGodEligible({ ...spirit, totalDefenseState: { active: false } }, miss), false);
  assert.equal(handOfGodEligible(spirit, { ...miss, successConfirmed: true }), false);
  assert.equal(handOfGodSpec(spirit).period, "round");
  assert.match(grappleTrickLines(owner(["Wrestling Supremacy"]))[0], /Back Breaker/);
});

test("Intense Stance: a round without attacks, then +2 melee attack and damage", async () => {
  const { intenseStanceState, intenseStancePlan, intenseDamage } = await import("../module/rules/intense-stance.mjs");
  const ctx = (round, turn) => ({ id: "c", started: true, round, turn, combatantId: "own", ownTurnIndex: 1 });
  const stance = { ...owner(["Whip Basics"]), combatStance: { version: 1, id: "s", key: "intense" } };
  const record = intenseStancePlan(stance, ctx(2, 1), { confirmed: true });
  assert.throws(
    () => intenseStancePlan(owner(["Whip Basics"]), ctx(2, 1), { confirmed: true }),
    /Enter Intense Stance/
  );
  const at = (round, turn) => intenseStanceState({ intenseStance: record, intenseCombatContext: ctx(round, turn) });
  assert.equal(at(2, 1).holding, true);
  assert.equal(at(3, 0).holding, true);
  assert.equal(at(3, 1).bonus, 2);
  assert.equal(at(4, 0).bonus, 2);
  assert.deepEqual([at(4, 1).bonus, at(4, 1).holding], [0, false]);
  const sys = { intenseStance: record, intenseCombatContext: ctx(3, 2) };
  assert.equal(intenseDamage(sys, { proficiency: "exoticBlunt", range: 0 }), 2);
  assert.equal(intenseDamage(sys, { proficiency: "rifle", range: 100 }), 0);
});

test("Sweep: a lost Trip leaves no flat-footed unless it was a critical failure, which grants no counter-Trip", async () => {
  const { tripOutcomePlan } = await import("../module/rules/trip-outcomes.mjs");
  const plan = tripOutcomePlan.toString();
  assert.match(plan, /sweep && a\.criticalFailure !== true \? null : "flat-footed"/);
  assert.match(plan, /a\.criticalFailure === true && !sweep/);
});
