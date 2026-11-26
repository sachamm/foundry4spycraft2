import test from "node:test";
import assert from "node:assert/strict";
import { campaignEffects, activeQualities, currentInjuryEffects } from "../module/rules/gc/campaign.mjs";
import { lethalHitPlan, lethalHitLines } from "../module/rules/damage-application.mjs";
const facts = { vitality: 100, wounds: 12, woundsMax: 12 };
test("Bulletproof and Gritty use their exact injury and massive-damage boundaries after DR", () => {
  for (const [id, min, massive] of [
    ["bulletproof", 36, 61],
    ["gritty", 16, 26]
  ]) {
    const effects = campaignEffects(activeQualities([id])).effects;
    assert.equal(lethalHitPlan(facts, { damage: min - 1 }, effects).massive, null);
    const atMin = lethalHitPlan(facts, { damage: min }, effects);
    assert.equal(atMin.massive.dc, Math.floor(min / 2));
    assert.equal(atMin.massive.toMinusNine, false);
    assert.match(lethalHitLines("Agent", atMin).join(" "), new RegExp(`hit of ${min} or more`));
    assert.equal(lethalHitPlan(facts, { damage: massive - 1 }, effects).massive.toMinusNine, false);
    const atMassive = lethalHitPlan(facts, { damage: massive + 3, dr: 3 }, effects);
    assert.equal(atMassive.massive.toMinusNine, true);
    assert.match(lethalHitLines("Agent", atMassive).join(" "), new RegExp(`hit of ${massive} or more`));
    assert.equal(lethalHitPlan(facts, { damage: massive, dr: 1 }, effects).massive.toMinusNine, false);
  }
});
test("conflicting injury policies are refused instead of silently choosing the first selected quality", () => {
  const before = globalThis.game;
  globalThis.game = {
    settings: { get: (_id, key) => (key === "campaign" ? { qualities: ["bulletproof", "gritty"] } : {}) }
  };
  try {
    assert.throws(() => currentInjuryEffects(), /conflicting campaign/);
  } finally {
    globalThis.game = before;
  }
});
