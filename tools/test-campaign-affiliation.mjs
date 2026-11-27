import test from "node:test";
import assert from "node:assert/strict";
import { campaignAffiliationProblem, campaignStandingCurrency } from "../module/rules/campaign-affiliation.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { reserveInitialization, gearAcquisitionPlan } from "../module/rules/gear-acquisition.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";

test("campaign affiliation validates Faction, Freelance and Hybrid without rewriting saved choices", () => {
  for (const gearRules of ["faction", "freelance", "hybrid"]) {
    for (const affiliationType of ["faction", "freelance", "", "other"]) {
      const valid =
        ["faction", "freelance"].includes(affiliationType) && (gearRules === "hybrid" || gearRules === affiliationType);
      const effects = { gearRules };
      assert.equal(!campaignAffiliationProblem({ affiliationType }, effects), valid);
      if (valid)
        assert.equal(
          campaignStandingCurrency({ affiliationType }, effects),
          affiliationType === "freelance" ? "netWorth" : "reputation"
        );
      else assert.throws(() => campaignStandingCurrency({ affiliationType }, effects));
      const s = computeAgent(
        {
          affiliationType,
          abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
          progression: []
        },
        [],
        cfg,
        {
          campaignEffects: effects
        }
      );
      assert.equal(s.affiliationType, affiliationType);
      assert.equal(
        s.todo.some(t => /affiliation/.test(t.text)),
        !valid
      );
    }
  }
});

test("gear initialization and field acquisition refuse a conflicting campaign affiliation", () => {
  const system = { affiliationType: "freelance", campaignEffects: { gearRules: "faction" } };
  assert.throws(() => reserveInitialization(system, []), /requires Faction/);
  assert.throws(() => gearAcquisitionPlan(system), /requires Faction/);
  assert.equal(campaignStandingCurrency(system, {}, "netWorth"), "netWorth");
  assert.throws(() => campaignStandingCurrency(system, {}, "other"), /Choose/);
});

test("PC affiliation restrictions and standing awards do not treat agent-built companions as player characters", () => {
  const companion = { companionOf: { ownerUuid: "Actor.owner" }, affiliationType: "faction" };
  assert.equal(campaignAffiliationProblem(companion, { gearRules: "freelance" }), null);
  assert.throws(() => campaignStandingCurrency(companion, { gearRules: "freelance" }), /do not apply to a companion/);
});
