import test from "node:test";
import assert from "node:assert/strict";
import { fallDistancePlan as plan, validateFallDistanceProof as validate } from "../module/rules/fall-distance.mjs";
const sys = (activeFeatNames = []) => ({ activeFeatNames }),
  input = (patch = {}) => ({
    fallDeclared: true,
    fallDistanceFeet: 30,
    fallSoftSurface: false,
    fallConfirmed: true,
    ...patch
  }),
  p = (s = sys(), patch = {}) => plan(s, input(patch));
test("Equilibrium Basics reduces falling damage distance by twenty feet, clamped at zero, independently of actual fall length", () => {
  for (const distance of [0, 0.1, 5, 19.999, 20, 20.001, 30, 200, 1000, Number.MAX_SAFE_INTEGER]) {
    const r = p(sys(["Equilibrium Basics"]), { fallDistanceFeet: distance });
    assert.equal(r.actualDistanceFeet, distance);
    assert.equal(r.damageDistanceFeet, Math.max(0, distance - 20));
    assert.equal(r.reductionFeet, 20);
    assert.deepEqual(r.reductions, [{ source: "Equilibrium Basics", feet: 20 }]);
  }
  assert.equal(p(sys(["Equilibrium Basics"])).damageDistanceFeet, 10);
});
test("soft or yielding landing removes ten damage-distance feet, stacking additively with Basics once", () => {
  for (const names of [
    [],
    ["Equilibrium Basics"],
    ["Equilibrium Basics", "Equilibrium Basics"],
    ["Equilibrium Mastery"],
    ["Equilibrium Supremacy"],
    ["Equilibrium Basics", "Equilibrium Mastery", "Equilibrium Supremacy"]
  ])
    for (const fallSoftSurface of [false, true])
      for (const distance of [0, 10, 20, 25, 30, 35, 100]) {
        const r = p(sys(names), { fallDistanceFeet: distance, fallSoftSurface }),
          reduction = (names.includes("Equilibrium Basics") ? 20 : 0) + (fallSoftSurface ? 10 : 0);
        assert.equal(r.reductionFeet, reduction);
        assert.equal(r.damageDistanceFeet, Math.max(0, distance - reduction));
        assert.equal(r.reductions.length, (names.includes("Equilibrium Basics") ? 1 : 0) + (fallSoftSurface ? 1 : 0));
      }
});
test("higher feats and unrelated defenses do not invent a distance reduction or alter the actual physical fall", () => {
  const s = sys(["Equilibrium Mastery", "Equilibrium Supremacy", "Spider Mastery", "Mountain Training"]);
  for (const key of ["abilities", "survivalStats", "actionDice"])
    Object.defineProperty(s, key, {
      get() {
        throw Error("Unrelated " + key + " read");
      }
    });
  assert.equal(p(s).damageDistanceFeet, 30);
  assert.deepEqual(p(s).reductions, []);
  assert.equal(p(s).actualDistanceFeet, 30);
});
test("strict actual finite distance, boolean surface and GC confirmation reject ambiguous declarations", () => {
  for (const patch of [
    { fallDeclared: "true" },
    { fallConfirmed: false },
    { fallConfirmed: "true" },
    { fallSoftSurface: "true" },
    ...[-1, NaN, Infinity, "30", null, Number.MAX_SAFE_INTEGER + 1].map(fallDistanceFeet => ({ fallDistanceFeet }))
  ])
    assert.throws(() => p(sys(), patch), JSON.stringify(patch));
  for (const s of [null, {}, [], sys("Equilibrium Basics"), sys([null]), sys([""])]) assert.throws(() => p(s));
});
test("disabled declarations ignore stale fields and never read hidden or malformed source data", () => {
  const s = {
    get activeFeatNames() {
      throw Error("Private feat read");
    }
  };
  assert.equal(plan(s), null);
  assert.equal(
    p(s, { fallDeclared: false, fallDistanceFeet: "old", fallSoftSurface: "true", fallConfirmed: "true" }),
    null
  );
  validate(s, null);
});
test("proof preserves the source and calculation, supports native key order, and never mutates actors or caller input", () => {
  const s = sys(["Equilibrium Basics"]),
    i = input({ fallSoftSurface: true, fallDistanceFeet: 50 }),
    before = structuredClone({ s, i }),
    r = plan(s, i);
  validate(s, r);
  const reverse = v =>
    Array.isArray(v)
      ? v.map(reverse)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .reverse()
              .map(([k, x]) => [k, reverse(x)])
          )
        : v;
  validate(s, reverse(r));
  for (const k of Object.keys(r)) {
    const n = structuredClone(r);
    n[k] = "changed";
    assert.throws(() => validate(s, n), k);
  }
  for (const [k, v] of Object.entries({
    fallDeclared: false,
    fallDistanceFeet: 60,
    fallSoftSurface: false,
    fallConfirmed: false
  })) {
    const n = structuredClone(r);
    n.context[k] = v;
    assert.throws(() => validate(s, n), k);
  }
  assert.throws(() => validate(sys(), r));
  const normal = p(sys());
  assert.throws(() => validate(s, normal));
  assert.deepEqual({ s, i }, before);
  r.reductions[0].feet = 999;
  assert.deepEqual(s.activeFeatNames, ["Equilibrium Basics"]);
});

test("Spider Mastery: each falling damage die is 1 lower", async () => {
  const { fallDistancePlan } = await import("../module/rules/fall-distance.mjs");
  const input = { fallDeclared: true, fallDistanceFeet: 30, fallSoftSurface: false, fallConfirmed: true };
  const plan = fallDistancePlan({ activeFeatNames: ["Spider Mastery"] }, input);
  assert.equal(plan.perDieReduction, 1);
  assert.match(plan.notes.join(" "), /Spider Mastery/);
  assert.equal(fallDistancePlan({ activeFeatNames: [] }, input).perDieReduction, undefined);
});
