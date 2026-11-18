import test from "node:test";
import assert from "node:assert/strict";
import { jinxSource, jinxUseSpec, jinxCostPlan, jinxUseProof } from "../module/rules/jinx.mjs";
import { criticalPlan } from "../module/rules/criticals.mjs";
import { resourceUsePlan } from "../module/rules/limited-uses.mjs";
import { actionDieBenefitQuote } from "../module/rules/benefit-payments.mjs";
const state = (count = 2) => ({
    activeFeatNames: ["Jinx"],
    activeFeatSelections: Array.from({ length: count }, () => ({ tree: "chance" })),
    usagePeriods: { session: "s" },
    resourceUses: {},
    actionDice: { value: 20, die: 4 }
  }),
  check = { checkKind: "skill", skillKey: "mechanics", checkId: "repair", errorConfirmed: true, boostSpent: 0 },
  failure = {
    kind: "failure",
    baseCost: 1,
    effect: "GC-confirmed error effect",
    effectConfirmed: true,
    samePayer: false,
    opponent: true,
    lineOfSight: true,
    available: 100
  },
  owners = { jinx: true, payerUuid: "Actor.payer", actingActorUuid: "Actor.acting" };
test("each active Chance selection supplies one session use; unrelated selections and absent/invalid sources cannot qualify", () => {
  for (let n = 1; n <= 30; n++) {
    const s = state(n);
    s.activeFeatSelections.push({ tree: "style" });
    assert.equal(jinxSource(s).limit, n);
    assert.equal(jinxUseSpec(s).limit, n);
    assert.equal(jinxUseSpec(s).period, "session");
  }
  assert.equal(jinxSource(state(0)), null);
  const s = state();
  s.activeFeatNames = [];
  assert.equal(jinxUseSpec(s), null);
});
test("the paying opponent discount follows all acting-character critical cost modifiers and never changes the acting character", () => {
  for (let baseCost = 1; baseCost <= 4; baseCost++)
    for (const core of [[], ["wheelman"]])
      for (const practice of [0, 1, 2])
        for (const weaponQualities of ["", "DEP", "UNR"])
          for (const cleanAndPolished of [false, true]) {
            const target = { coreClassIds: core },
              c = { ...check, weaponQualities, cleanAndPolished, criticalFailureCostIncrease: practice },
              before = criticalPlan(target, c, { ...failure, baseCost }),
              snapshot = structuredClone(before);
            if (before.cost === 0) {
              assert.throws(() => jinxCostPlan(state(), before, owners), /positive cost/);
              continue;
            }
            const after = jinxCostPlan(state(), before, owners);
            assert.equal(after.cost, before.cost - 1);
            assert.equal(after.jinx.costBefore, before.cost);
            assert.equal(after.jinx.costAfter, after.cost);
            assert.deepEqual(before, snapshot);
            assert.equal(after.sources.at(-1), "Jinx –1 (minimum0)");
          }
});
test("Jinx never changes own successes, an already free or blocked activation, self payment, or a GC-pool payment", () => {
  const base = criticalPlan({}, check, failure);
  for (const patch of [{ kind: "success" }, { blocked: true }, { cost: 0 }, { cost: -1 }, { cost: 1.5 }])
    assert.throws(() => jinxCostPlan(state(), { ...base, ...patch }, owners));
  for (const patch of [
    { payerUuid: "GC" },
    { payerUuid: owners.actingActorUuid },
    { actingActorUuid: "" },
    { jinx: "true" }
  ])
    assert.throws(() => jinxCostPlan(state(), base, { ...owners, ...patch }));
  assert.deepEqual(jinxCostPlan({}, base), base);
  assert.throws(() => jinxCostPlan({ ...state(), activeFeatNames: [] }, base, owners));
});
test("the existing atomic resource planner supplies exact use proofs, does not refresh after reacquisition and requires the same source/session/reservation", () => {
  const s = state(),
    plan = jinxCostPlan(s, criticalPlan({}, check, failure), owners),
    spec = jinxUseSpec(s),
    use = resourceUsePlan(spec, s.resourceUses, s.usagePeriods, 0);
  assert.equal(use.blocked, false);
  s.resourceUses.jinx = use.record;
  const proof = jinxUseProof(s, plan.jinx);
  assert.equal(proof.used, 1);
  proof.used = 99;
  assert.equal(s.resourceUses.jinx.used, 1);
  jinxUseProof(s, plan.jinx, use.record);
  for (const patch of [
    { activeFeatNames: [] },
    { activeFeatSelections: [{ tree: "chance" }] },
    { usagePeriods: { session: "next" } },
    { resourceUses: { jinx: { epoch: "s", used: 0 } } },
    { resourceUses: { jinx: { epoch: "s", used: 3 } } }
  ])
    assert.throws(() => jinxUseProof({ ...s, ...patch }, plan.jinx));
  assert.throws(() => jinxUseProof(s, plan.jinx, { epoch: "s", used: 2 }));
  s.resourceUses.jinx.used = 2;
  assert.equal(resourceUsePlan(spec, s.resourceUses, s.usagePeriods, 0).blocked, true);
  s.activeFeatNames = [];
  s.activeFeatNames = ["Jinx"];
  assert.equal(resourceUsePlan(jinxUseSpec(s), s.resourceUses, s.usagePeriods, 0).blocked, true);
});
test("a waived one-die activation still pays the payer’s existing Shaken II/III surcharge after Jinx and never rolls that fee", () => {
  for (const grade of [0, 1, 2, 3, 4]) {
    const s = state();
    s.conditionContext = { shakenGrade: grade };
    const p = jinxCostPlan(s, criticalPlan({}, check, failure), owners);
    assert.equal(p.cost, 0);
    const actor = { uuid: "Actor.payer", system: s, actionDiceFundingSystem: s, usagePeriods: s.usagePeriods };
    if (grade === 4) {
      assert.throws(() => actionDieBenefitQuote(actor, { baseCost: p.cost }));
      continue;
    }
    const quote = actionDieBenefitQuote(actor, { baseCost: p.cost });
    assert.equal(quote.cost, grade >= 2 ? grade - 1 : 0);
    assert.equal(quote.baseCost, 0);
  }
});
