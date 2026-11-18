import test from "node:test";
import assert from "node:assert/strict";
import {
  BALANCE_SURFACES,
  balanceSurfacePlan as plan,
  validateBalanceSurfaceProof as validate
} from "../module/rules/balance.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const check = cfg.skills.acrobatics.checks.find(c => c.id === "balance"),
  sys = (names = []) => ({ activeFeatNames: names, speed: 30 }),
  input = (patch = {}) => ({
    balanceCircumstances: true,
    balanceSurface: "flat",
    balanceDistanceFeet: 0,
    balanceBuckled: false,
    balanceSlippery: false,
    balanceConfirmed: true,
    ...patch
  }),
  p = (s = sys(), patch = {}) => plan(s, "acrobatics", check, input(patch)),
  scope = { checkKind: "skill", skillKey: "acrobatics", checkId: "balance" };
test("all nine Balance rows reproduce printed DC/error pairs with cumulative buckled/slippery and alternative pace rows", () => {
  const expected = {
    flat: [5, 0],
    uneven10to20: [15, 0],
    uneven21to35: [20, 1],
    uneven36to45: [25, 1],
    uneven46to60: [30, 2],
    narrow7to12: [15, 0],
    narrow3to6: [20, 1],
    narrow1to3: [25, 1],
    narrowUnder1: [30, 2]
  };
  assert.deepEqual(Object.keys(BALANCE_SURFACES), Object.keys(expected));
  for (const [surface, [dc, error]] of Object.entries(expected))
    for (const balanceBuckled of [false, true])
      for (const balanceSlippery of [false, true])
        for (const [distance, paceDC, paceError] of [
          [0, 0, 0],
          [15, 0, 0],
          [15.001, 5, 0],
          [30, 5, 0],
          [30.001, 10, 1],
          [60, 10, 1]
        ]) {
          const r = p(sys(), {
            balanceSurface: surface,
            balanceDistanceFeet: distance,
            balanceBuckled,
            balanceSlippery
          });
          assert.equal(r.blockedReason, "");
          assert.equal(r.dc, dc + (balanceBuckled ? 5 : 0) + (balanceSlippery ? 10 : 0) + paceDC);
          assert.equal(r.errorIncrease, error + (balanceSlippery ? 1 : 0) + paceError);
        }
});
test("Basics reduces full/faster movement to one check without granting other feat benefits or extra distance", () => {
  for (const names of [[], ["Equilibrium Basics"], ["Equilibrium Mastery"], ["Equilibrium Supremacy"]])
    for (const distance of [0, 15, 15.001, 30, 60]) {
      const r = p(sys(names), { balanceDistanceFeet: distance }),
        normal = distance > 15 ? 2 : 1;
      assert.equal(r.evidence.normalChecks, normal);
      assert.equal(r.evidence.requiredChecks, names.includes("Equilibrium Basics") ? 1 : normal);
      assert.equal(r.errorReduction, 0);
      assert.equal(r.check.tags, check.tags);
    }
  assert.ok(p(sys(["Equilibrium Basics"]), { balanceDistanceFeet: 60.001 }).blockedReason);
});
test("Mastery removes exactly the Vision tag and reduces DC/error only on narrow or uneven surfaces, retaining armor, flat-footed and Hearing", () => {
  for (const surface of Object.keys(BALANCE_SURFACES)) {
    const r = p(sys(["Equilibrium Mastery"]), { balanceSurface: surface }),
      base = p(sys(), { balanceSurface: surface }),
      eligible = surface !== "flat";
    assert.equal(r.dc, base.dc - (eligible ? 5 : 0));
    assert.equal(r.errorReduction, eligible ? 1 : 0);
    assert.equal(r.errorIncrease, base.errorIncrease);
    assert.equal(r.check.tags.includes("Vision"), !eligible);
    for (const tag of ["Armor Check Penalty", "Flat-Footed", "Hearing"]) assert.ok(r.check.tags.includes(tag));
  }
  assert.ok(check.tags.includes("Vision"));
});
test("odd Speed keeps the distinct printed rounded-down movement-count and rounded-up table-DC thresholds", () => {
  const s = { ...sys(), speed: 31 };
  for (const [distance, count, dc] of [
    [15, 1, 5],
    [15.5, 2, 5],
    [16, 2, 5],
    [16.001, 2, 10],
    [31, 2, 10],
    [31.001, 2, 15]
  ]) {
    const r = p(s, { balanceDistanceFeet: distance });
    assert.equal(r.evidence.normalChecks, count);
    assert.equal(r.dc, dc);
    assert.equal(r.evidence.normalHalfSpeed, 15);
    assert.equal(r.evidence.tableHalfSpeed, 16);
  }
});
test("strict scope, table rows, current Speed, finite movement and boolean GC declarations are required", () => {
  for (const [key, skill] of Object.entries(cfg.skills))
    for (const c of skill.checks)
      assert.equal(
        !!plan(sys(), key, c, input()).evidence,
        key === "acrobatics" && c.id === "balance",
        key + "/" + c.id
      );
  for (const patch of [
    { balanceCircumstances: "true" },
    { balanceConfirmed: false },
    { balanceConfirmed: "true" },
    { balanceSurface: "climb61plus" },
    { balanceSurface: "__proto__" },
    { balanceBuckled: 1 },
    { balanceSlippery: "false" },
    ...[-1, NaN, Infinity, "30", null].map(balanceDistanceFeet => ({ balanceDistanceFeet }))
  ])
    assert.ok(p(sys(), patch).blockedReason);
  for (const speed of [0, -1, NaN, Infinity, "30", null])
    assert.ok(p({ ...sys(), speed }, { balanceDistanceFeet: 1 }).blockedReason);
  for (const s of [null, {}, [], { activeFeatNames: "Equilibrium Basics" }, { activeFeatNames: [null] }])
    assert.ok(p(s).blockedReason);
});
test("disabled declarations and stationary checks avoid unused source/Speed reads; proof binds each current source and circumstance", () => {
  const s = {
    get activeFeatNames() {
      throw Error("Private read");
    }
  };
  assert.equal(
    plan(s, "other", null, input({ balanceCircumstances: false, balanceDistanceFeet: "old" })).evidence,
    null
  );
  const stationary = sys();
  Object.defineProperty(stationary, "speed", {
    get() {
      throw Error("Unused Speed");
    }
  });
  assert.equal(p(stationary).blockedReason, "");
  const source = sys(["Equilibrium Basics", "Equilibrium Mastery"]),
    i = input({ balanceSurface: "narrowUnder1", balanceDistanceFeet: 60, balanceSlippery: true }),
    before = structuredClone({ source, i }),
    r = plan(source, "acrobatics", check, i);
  validate(source, r.evidence, scope);
  validate(source, Object.fromEntries(Object.entries(r.evidence).reverse()), scope);
  for (const k of Object.keys(r.evidence)) {
    const n = structuredClone(r.evidence);
    n[k] = "changed";
    assert.throws(() => validate(source, n, scope), k);
  }
  assert.throws(() => validate({ ...source, speed: 15 }, r.evidence, scope));
  assert.throws(() => validate(sys(["Equilibrium Basics"]), r.evidence, scope));
  assert.throws(() => validate(sys(["Equilibrium Mastery"]), r.evidence, scope));
  assert.deepEqual({ source, i }, before);
});
