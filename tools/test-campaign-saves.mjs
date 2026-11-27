import test from "node:test";
import assert from "node:assert/strict";
import { savingThrowDamagePlan } from "../module/rules/defense.mjs";
import { ignoresSuccessfulHalfSave } from "../module/rules/campaign-combat.mjs";

const check = key => ({
  checkKind: "save",
  checkId: key,
  campaignSaveContext: { version: 1, ignoreSuccessfulHalfSave: true }
});
const options = { confirmed: true, damage: 21, normalSuccessDamage: 10, succeeded: true, successHalves: true };

test("Blockbuster works for all saving throws only on confirmed successful saves for half", () => {
  for (const key of ["ref", "fort", "will"]) {
    assert.equal(savingThrowDamagePlan(check(key), options).total, 0);
    assert.equal(savingThrowDamagePlan(check(key), { ...options, succeeded: false }).total, 21);
    assert.equal(savingThrowDamagePlan(check(key), { ...options, successHalves: false }).total, 10);
    assert.equal(savingThrowDamagePlan({ ...check(key), campaignSaveContext: null }, options).total, 10);
    assert.equal(savingThrowDamagePlan(check(key), { ...options, normalSuccessDamage: 11 }).total, 0);
  }
  assert.equal(ignoresSuccessfulHalfSave({ type: "npc" }, { ignoreSuccessfulHalfSave: true }), false);
  assert.equal(
    ignoresSuccessfulHalfSave(
      { type: "agent", system: { companionOf: { ownerUuid: "Actor.owner" } } },
      { ignoreSuccessfulHalfSave: true }
    ),
    false
  );
});

test("recorded policy refuses malformed contexts, changed outcomes and incorrectly declared half damage", () => {
  for (const extra of [
    { superseded: true },
    { checkKind: "skill" },
    { checkId: "other" },
    { successConfirmed: false },
    { campaignSaveContext: { version: 2, ignoreSuccessfulHalfSave: true } }
  ])
    assert.throws(() => savingThrowDamagePlan({ ...check("fort"), ...extra }, options));
  for (const extra of [
    { confirmed: false },
    { normalSuccessDamage: 1 },
    { damage: -1 },
    { damage: 2.5 },
    { normalSuccessDamage: 30 }
  ])
    assert.throws(() => savingThrowDamagePlan(check("fort"), { ...options, ...extra }));
});

test("Blockbuster coexists with Evasion and leaves failed-save Evasion II intact", () => {
  const c = { ...check("ref"), evasionContext: { version: 1, grade: 2, flatFooted: false, reflexReducesDamage: true } };
  assert.equal(savingThrowDamagePlan(c, options).blockbuster, true);
  assert.equal(savingThrowDamagePlan(c, { ...options, succeeded: false }).total, 10);
  c.evasionContext.flatFooted = true;
  assert.equal(savingThrowDamagePlan(c, options).total, 0);
  assert.equal(savingThrowDamagePlan(c, { ...options, succeeded: false }).total, 21);
});
