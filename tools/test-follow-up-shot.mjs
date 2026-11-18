import test from "node:test";
import assert from "node:assert/strict";
import { dartingDeclarationPlan, dartingFinalAttackPlan, followUpWeaponEligible } from "../module/rules/darting.mjs";
import { dartingStyleState } from "../module/rules/darting-state.mjs";

const combat = { id: "c1", started: true, combatantId: "me", round: 3, turn: 0, ownTurnIndex: 0 };
const sys = feats => ({ activeFeatNames: feats, conditionContext: {}, wounds: { value: 4 } });
const declare = (feats, extraAttacks, kind = "followUp") =>
  dartingDeclarationPlan(sys(feats), combat, { extraAttacks, kind, atStartOfInitiative: true, confirmed: true });

test("Follow-Up Shot declares one final attack at −2; Hail of Fire two at −4", () => {
  const one = declare(["Follow-Up Shot"], 1);
  assert.deepEqual([one.extraAttacks, one.penalty, one.kind], [1, 2, "followUp"]);
  assert.deepEqual([declare(["Follow-Up Shot", "Hail of Fire"], 2).penalty], [4]);
  assert.throws(() => declare(["Follow-Up Shot"], 2), /Hail of Fire/);
  assert.throws(() => declare(["Darting Weapon"], 1), /Follow-Up Shot has not been earned/);
  assert.equal(declare(["Darting Weapon"], 1, "darting").kind, undefined, "Darting records keep their old shape");
});

test("the declared state carries its kind and the full-round penalty", () => {
  const record = { ...declare(["Follow-Up Shot"], 1), id: "d1" };
  const state = dartingStyleState({ dartingStyle: record, dartingCombatContext: combat });
  assert.deepEqual([state.active, state.kind, state.penalty], [true, "followUp", 2]);
  assert.equal(
    dartingStyleState({ dartingStyle: { ...record, kind: "other" }, dartingCombatContext: combat }).needsReview,
    true
  );
});

test("Follow-Up Shot's final attacks need a firearm or heavy weapon", () => {
  assert.ok(followUpWeaponEligible({ proficiency: "rifle" }));
  assert.ok(followUpWeaponEligible({ proficiency: "tactical" }));
  assert.equal(followUpWeaponEligible({ proficiency: "edged" }), false);
  const record = { ...declare(["Follow-Up Shot"], 1), id: "d1" };
  const system = { ...sys(["Follow-Up Shot"]), dartingStyle: record, abilities: { str: { mod: 0 } }, size: "Medium" };
  const weapon = (id, proficiency) => ({
    id,
    type: "weapon",
    system: { proficiency, equipped: true, carried: true, quantity: 1, sizeHands: "S/1h" }
  });
  const items = [weapon("gun", "handgun"), weapon("knife", "edged")];
  assert.equal(dartingFinalAttackPlan(system, combat, items, { weaponId: "gun", confirmed: true }).weaponId, "gun");
  assert.throws(
    () => dartingFinalAttackPlan(system, combat, items, { weaponId: "knife", confirmed: true }),
    /firearm or heavy weapon/
  );
});
