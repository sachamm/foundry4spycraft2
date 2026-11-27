import test from "node:test";
import assert from "node:assert/strict";
import { campaignStressDamage, campaignStressPolicy } from "../module/rules/campaign-combat.mjs";
import { campaignEffects, activeQualities } from "../module/rules/gc/campaign.mjs";
import { nonLethalHitPlan } from "../module/rules/damage-application.mjs";
import { stressDefensePlan } from "../module/rules/stress-defense.mjs";
const effects = ids => campaignEffects(activeQualities(ids)).effects;
const policy = ids => campaignStressPolicy(effects(ids));
test("Mellow, Tense and source multipliers combine additively, round once, retain zero and apply Mellow's minimum before resistance", () => {
  assert.deepEqual(effects(["mellow", "tense"]), {
    stressDamageMultipliers: [0.5, 2],
    stressDamageMinimum: 1,
    forbidTake10: true
  });
  for (let raw = 0; raw <= 30; raw++) {
    assert.equal(
      campaignStressDamage(raw, policy(["mellow"])).adjustedDamage,
      raw ? Math.max(1, Math.floor(raw / 2)) : 0
    );
    assert.equal(campaignStressDamage(raw, policy(["tense"])).adjustedDamage, raw * 2);
    assert.equal(
      campaignStressDamage(raw, policy(["mellow", "tense"])).adjustedDamage,
      raw ? Math.max(1, Math.floor(raw * 1.5)) : 0
    );
    assert.equal(campaignStressDamage(raw, policy(["tense"]), [0.5]).adjustedDamage, Math.floor(raw * 1.5));
    assert.equal(campaignStressDamage(raw, policy(["mellow"]), [0.5]).adjustedDamage, raw ? 1 : 0);
    assert.equal(campaignStressDamage(raw).adjustedDamage, raw);
  }
});
test("Firefighter Training and campaign modifiers combine before prepared resistance, with explicit final-campaign mode", () => {
  const s = {
    activeFeatNames: ["Firefighter Training"],
    campaignEffects: effects(["tense"]),
    survivalStats: { resistances: { stress: 2 }, resistanceSources: [] },
    armor: {}
  };
  assert.equal(stressDefensePlan(s, 7, { fromFire: true }).netDamage, 8);
  assert.equal(stressDefensePlan(s, 7).netDamage, 12);
  assert.equal(stressDefensePlan(s, 7, { campaignAdjusted: true }).netDamage, 5);
  s.campaignEffects = effects(["mellow"]);
  assert.equal(stressDefensePlan(s, 7, { fromFire: true }).netDamage, 0);
  s.survivalStats.resistances.stress = 0;
  assert.equal(stressDefensePlan(s, 7, { fromFire: true }).netDamage, 1);
});
test("special NPC stress totals use the same campaign multipliers, preserve subdual, and accept already-adjusted falling stress once", () => {
  for (const ids of [["mellow"], ["tense"], ["mellow", "tense"]]) {
    const s = {
      campaignEffects: effects(ids),
      stressThreshold: 100,
      subdualThreshold: 100,
      survivalStats: { resistances: {}, resistanceSources: [] }
    };
    const adjusted = campaignStressDamage(7, policy(ids)).adjustedDamage;
    const p = nonLethalHitPlan(s, { stress: 3 }, { kind: "stress", damage: 7, dr: 100 });
    assert.equal(p.net, adjusted);
    assert.equal(p.total, 3 + adjusted);
    assert.equal(
      nonLethalHitPlan(s, {}, { kind: "stress", damage: adjusted, campaignStressAdjusted: true }).net,
      adjusted
    );
    assert.equal(nonLethalHitPlan(s, {}, { kind: "subdual", damage: 7 }).net, 7);
  }
});
test("invalid campaign factors and unsupported stress totals require review", () => {
  for (const n of [0, -1, Infinity, NaN, "2", null])
    assert.throws(() => campaignStressPolicy({ stressDamageMultipliers: [n] }));
  for (const n of [-1, Infinity, NaN, "2", 0.5]) assert.throws(() => campaignStressDamage(n));
  assert.throws(() => campaignStressDamage(Number.MAX_SAFE_INTEGER, policy(["tense"])));
});
