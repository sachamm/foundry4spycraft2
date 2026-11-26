import test from "node:test";
import assert from "node:assert/strict";
import { campaignCQBRange } from "../module/rules/campaign-combat.mjs";
import { weaponRangeEffects, rangedAttackContext } from "../module/rules/firearms.mjs";
import { blastIncrementFeet } from "../module/rules/combat-actions.mjs";
import { blastDamageAt } from "../module/rules/damage-application.mjs";
test("campaign range multipliers combine additively with feat multipliers, after flat bonuses and before load penalties", () => {
  const base = { activeFeatNames: [], campaignEffects: { rangeIncrementMultiplier: 2 } };
  const w = { proficiency: "rifle", range: 50, maxRangeIncrements: 10 };
  assert.equal(weaponRangeEffects(base, w, { firearm: true }).increment, 100);
  const s = { ...base, activeFeatNames: ["Marksmanship Supremacy"] };
  assert.equal(weaponRangeEffects(s, w, { firearm: true }).increment, 150);
  const hurled = { proficiency: "hurled", range: 20 };
  assert.equal(weaponRangeEffects(s, hurled, { loadPenalty: -5 }).increment, 75);
  assert.equal(rangedAttackContext(base, w, { distanceFeet: 150, rangeIncrement: 100 }).incrementsUsed, 2);
});
test("campaign CQB constants retain a more specific Marksmanship Supremacy extension", () => {
  assert.equal(campaignCQBRange(), 30);
  assert.equal(campaignCQBRange([], { cqbRange: 60 }), 60);
  assert.equal(campaignCQBRange([], { cqbRange: 20 }), 20);
  assert.equal(campaignCQBRange(["Marksmanship Supremacy"], { cqbRange: 20 }), 60);
});
test("Blockbuster uses tripled blast increments consistently at ring boundaries", () => {
  const increment = blastIncrementFeet("BLS (5 ft.)", { blastIncrementMultiplier: 3 });
  assert.equal(increment, 15);
  for (const [feet, expected] of [
    [0, 32],
    [14.99, 32],
    [15, 16],
    [30, 8],
    [45, 4]
  ])
    assert.equal(blastDamageAt(32, feet, increment).damage, expected);
  assert.equal(blastIncrementFeet("BLS (10 ft.)"), 10);
  assert.throws(() => blastIncrementFeet("BLS (5 ft.)", { blastIncrementMultiplier: 0 }), /multiplier/);
});
