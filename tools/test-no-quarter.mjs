import test from "node:test";
import assert from "node:assert/strict";
import { noQuarterPlan, noQuarterCeiling } from "../module/rules/no-quarter.mjs";
import { sneakAttackDamagePlan } from "../module/rules/sneak-attack.mjs";

const scout = (feats = ["No Quarter"]) => ({ activeFeatNames: feats, classLevels: { scout: 8 } });
const blade = { proficiency: "edged", damage: "1d6" };

test("No Quarter gives up earned sneak dice for an equal threat range increase", () => {
  assert.equal(noQuarterCeiling(scout(), blade), 2);
  const plan = noQuarterPlan(scout(), blade, { dice: 2 });
  assert.equal(plan.dice, 2);
  assert.ok(noQuarterPlan(scout(), blade, { dice: 3 }).blocked);
  assert.ok(noQuarterPlan(scout([]), blade, { dice: 1 }).blocked);
  assert.equal(noQuarterPlan(scout(), blade, { dice: 0 }), null);
});

test("the hit's damage rolls that many fewer sneak attack dice", () => {
  const base = {
    includeSneakAttack: true,
    successfulStandardAttack: true,
    targetCharacter: true,
    targetVulnerable: true,
    targetVitalsConfirmed: true
  };
  assert.equal(sneakAttackDamagePlan(scout(), blade, base).dice, 2);
  assert.equal(sneakAttackDamagePlan(scout(), blade, { ...base, noQuarterDice: 1 }).dice, 1);
  assert.equal(sneakAttackDamagePlan(scout(), blade, { ...base, noQuarterDice: 2 }).active, false);
});
