import test from "node:test";
import assert from "node:assert/strict";
import { flankingAttackEffects, withoutFlanking } from "../module/rules/class-checks.mjs";
import { checkFlavor } from "../module/rules/outcomes.mjs";

const melee = { proficiency: "edged", qualities: "" };
const attack = (system = { activeFeatNames: [] }) => {
  const flanking = flankingAttackEffects(system, melee, { targetFlanked: true });
  return {
    checkKind: "attack",
    naturalDie: 18,
    rawTotal: 20,
    rolledTotal: 20,
    effectiveTotal: 20,
    threat: 19,
    error: 1,
    cap: null,
    boostTotal: 3,
    triumphAt: 75,
    successConfirmed: null,
    baseFlavor: `Attack: Knife<br><small>${flanking.notes.join(" ")}</small>`,
    breakdown: [
      { label: "Base attack bonus", value: 1 },
      { label: "Flanking", value: flanking.attackBonus }
    ],
    attackContext: { targetFlanked: true, flanking, baseThreat: 19 }
  };
};

test("taking flanking off an open attack lowers the result and drops its rows and notes", () => {
  const next = withoutFlanking(attack());
  assert.equal(next.rawTotal, 18);
  // Action dice already spent still count.
  assert.equal(next.effectiveTotal, 21);
  assert.deepEqual(
    next.breakdown.map(row => row.label),
    ["Base attack bonus"]
  );
  assert.equal(next.attackContext.targetFlanked, false);
  assert.deepEqual(next.attackContext.flanking.removed, { attackBonus: 2, threatIncrease: 0 });
  assert.doesNotMatch(next.baseFlavor, /Flanking/);
  assert.match(checkFlavor(next), /Flanking taken off: −2 attack/);
  assert.throws(() => withoutFlanking(next), /no flanking bonus/);
});

test("Wolfpack Supremacy's threat increase goes with the flanking", () => {
  const next = withoutFlanking(attack({ activeFeatNames: ["Wolfpack Basics", "Wolfpack Supremacy"] }));
  assert.equal(next.rawTotal, 16);
  assert.equal(next.threat, 20);
  assert.equal(next.attackContext.baseThreat, 20);
});

test("flanking cannot be taken off once the attack is resolved", () => {
  assert.throws(() => withoutFlanking({ ...attack(), successConfirmed: true }), /before the attack is resolved/);
  assert.throws(() => withoutFlanking({ ...attack(), attackResolution: { hit: true } }), /before the attack/);
  assert.throws(() => withoutFlanking({ checkKind: "skill" }), /no flanking bonus/);
});
