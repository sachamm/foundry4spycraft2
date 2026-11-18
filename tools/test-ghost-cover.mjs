import test from "node:test";
import assert from "node:assert/strict";
import { ghostCoverPlan as plan, validateGhostCoverProof as validate } from "../module/rules/ghost-cover.mjs";
const sys = (activeFeatNames = ["Ghost Mastery"]) => ({ activeFeatNames }),
  input = (patch = {}) => ({
    declared: true,
    actorUuid: "Actor.ghost",
    actorName: "Ghost",
    opponentActorUuid: "Actor.opponent",
    opponentName: "Opponent",
    hiddenFromOpponent: true,
    sceneryCover: 3,
    visibleMaterialPercent: 0,
    disturbingMovementFeet: 0,
    confirmed: true,
    ...patch
  });
test("Mastery needs three-quarter scenery cover; Supremacy needs half, only against an opponent from whom currently hidden", () => {
  for (const names of [
    ["Ghost Mastery"],
    ["Ghost Supremacy"],
    ["Ghost Basics", "Ghost Mastery", "Ghost Supremacy"],
    ["Ghost Mastery", "Ghost Mastery"]
  ])
    for (let sceneryCover = 0; sceneryCover <= 4; sceneryCover++)
      for (const hiddenFromOpponent of [false, true]) {
        const p = plan(sys(names), input({ sceneryCover, hiddenFromOpponent })),
          required = names.includes("Ghost Supremacy") ? 2 : 3;
        assert.equal(p.requiredSceneryCover, required);
        assert.equal(p.invisible, hiddenFromOpponent && sceneryCover >= required);
        assert.equal(p.sources.length, new Set(names.filter(n => n !== "Ghost Basics")).size);
      }
});
test("personal cover and attack cover reductions do not replace the actual scenery prerequisite or modify its confirmed grade", () => {
  for (const personalCover of [0, 1, 2, 3, 4]) {
    assert.equal(plan(sys(), input({ sceneryCover: 2, personalCover })).invisible, false);
    assert.equal(
      plan(sys(), input({ sceneryCover: 3, personalCover, precisionReduction: 2, supremacyReduction: 1 })).invisible,
      true
    );
  }
  assert.deepEqual(plan(sys(["Ghost Supremacy"]), input()).sources, ["Ghost Supremacy"]);
});
test("invisibility is lost at exactly 25 percent visible material or strictly more than five feet disturbing movement", () => {
  for (const visibleMaterialPercent of [0, 24, 24.999, 25, 25.001, 100])
    for (const disturbingMovementFeet of [0, 4.999, 5, 5.001, 30]) {
      const p = plan(sys(), input({ visibleMaterialPercent, disturbingMovementFeet }));
      assert.equal(p.lostToMaterial, visibleMaterialPercent >= 25);
      assert.equal(p.lostToDisturbance, disturbingMovementFeet > 5);
      assert.equal(p.invisible, visibleMaterialPercent < 25 && disturbingMovementFeet <= 5);
    }
});
test("strict declarations require distinct actual actor identities, supported grades, booleans and finite measurements", () => {
  for (const patch of [
    { declared: "true" },
    { confirmed: "true" },
    { confirmed: false },
    { actorUuid: "Item.ghost" },
    { opponentActorUuid: "Actor.ghost" },
    { actorName: "" },
    { opponentName: "x".repeat(201) },
    { hiddenFromOpponent: "true" },
    ...[-1, 5, 1.5, "3", null, NaN, Infinity].map(sceneryCover => ({ sceneryCover })),
    ...[-1, 101, "25", null, NaN, Infinity].map(visibleMaterialPercent => ({ visibleMaterialPercent })),
    ...[-1, "5", null, NaN, Infinity].map(disturbingMovementFeet => ({ disturbingMovementFeet }))
  ])
    assert.throws(() => plan(sys(), input(patch)), JSON.stringify(patch));
  for (const system of [null, [], {}, sys([]), sys(["Ghost Basics"]), sys("Ghost Mastery"), sys([null]), sys([""])])
    assert.throws(() => plan(system, input()));
});
test("disabled declaration ignores retained inputs without reading the private or malformed source", () => {
  const system = {
    get activeFeatNames() {
      throw Error("Private source accessed");
    }
  };
  assert.equal(
    plan(system, input({ declared: false, confirmed: "true", sceneryCover: -1, opponentActorUuid: "Item.invalid" })),
    null
  );
  assert.equal(plan(system), null);
  validate(system, null);
});
test("proof is immutable, independent of object-key order and binds each source and circumstance without reading unrelated statistics", () => {
  const system = sys(),
    options = input(),
    before = structuredClone({ system, options });
  Object.defineProperty(system, "abilities", {
    get() {
      throw Error("Unrelated source read");
    }
  });
  const p = plan(system, options);
  validate(system, p);
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
  validate(system, reverse(p));
  assert.deepEqual({ system, options }, before);
  for (const k of Object.keys(p)) {
    const n = structuredClone(p);
    n[k] = "changed";
    assert.throws(() => validate(system, n, options), k);
  }
  for (const [k, v] of Object.entries({
    actorUuid: "Actor.other",
    actorName: "Renamed",
    opponentActorUuid: "Actor.other",
    opponentName: "Renamed",
    sceneryCover: 4,
    hiddenFromOpponent: false,
    visibleMaterialPercent: 1,
    disturbingMovementFeet: 1
  })) {
    const n = structuredClone(p);
    n.context[k] = v;
    assert.throws(() => validate(system, n, options), k);
  }
  assert.throws(() => validate(sys([]), p));
  assert.throws(() => validate(sys(["Ghost Supremacy"]), p));
  p.context.sceneryCover = 0;
  assert.equal(options.sceneryCover, 3);
});
