import test from "node:test";
import assert from "node:assert/strict";
import { hideMovementPlan, validateHideMovementProof } from "../module/rules/hide-movement.mjs";
const check = { id: "hide" },
  state = (feats = [], speed = 30) => ({
    speed,
    activeFeatNames: feats,
    conditionContext: {},
    postureMovement: { standardMove: true },
    abilities: { dex: { value: 12 } },
    wounds: { value: 4 }
  }),
  input = (distance = 0, patch = {}) => ({
    hideMovement: true,
    hideDistanceFeet: distance,
    hideRouteConfirmed: true,
    hideActionConfirmed: true,
    ...patch
  }),
  plan = (s, d = 0, patch = {}) => hideMovementPlan(s, "sneak", check, input(d, patch));
test("ordinary Hide permits up to current Speed, Ghost Basics permits double, and the half-Speed threshold is rounded down exactly", () => {
  for (const speed of [0, 1, 5, 15, 25, 30, 31, 40])
    for (const basic of [false, true]) {
      const s = state(basic ? ["Ghost Basics"] : [], speed),
        maximum = speed * (basic ? 2 : 1),
        half = Math.floor(speed / 2);
      for (const d of [...new Set([0, half, half + 0.1, speed, maximum, maximum + 0.1])]) {
        const p = plan(s, d);
        assert.equal(!!p.blockedReason, d > maximum, `${speed}/${basic}/${d}`);
        if (d <= maximum) {
          assert.equal(p.evidence.maximumFeet, maximum);
          assert.equal(p.evidence.halfSpeedMaximumFeet, half);
          assert.equal(p.evidence.pace, d <= half ? "half" : d <= speed ? "full" : "faster");
        }
      }
    }
  assert.equal(plan(state(["Combat Mobility"]), 60).evidence, null);
  assert.match(plan(state(["Combat Mobility"]), 60).blockedReason, /30 ft/);
});
test("Ghost full-Speed waiver retains separate +1 error, faster movement retains +3 and uses the highest applicable check-penalty waiver", () => {
  for (const [feats, fastPenalty] of [
    [["Ghost Basics"], -8],
    [["Ghost Basics", "Ghost Mastery"], -4],
    [["Ghost Basics", "Ghost Mastery", "Ghost Supremacy"], 0]
  ]) {
    const s = state(feats);
    assert.deepEqual([plan(s, 15).penalty, plan(s, 15).errorIncrease], [0, 0]);
    assert.deepEqual([plan(s, 30).penalty, plan(s, 30).errorIncrease], [0, 1]);
    assert.deepEqual([plan(s, 60).penalty, plan(s, 60).errorIncrease], [fastPenalty, 3]);
  }
  assert.deepEqual([plan(state(), 30).penalty, plan(state(), 30).errorIncrease], [-4, 1]);
  const exceptional = state(["Ghost Supremacy"]);
  assert.equal(plan(exceptional, 30).penalty, -4);
  assert.ok(plan(exceptional, 31).blockedReason);
});
test("counted Hide movement is its own included allowance, without requiring or granting Run or Combat Mobility distance", () => {
  const s = state(["Ghost Basics"]);
  s.canRun = false;
  s.armor = { adjustments: [{ slot: "body", type: "F" }] };
  const p = plan(s, 60);
  assert.equal(p.blockedReason, "");
  assert.equal(p.errorIncrease, 3);
  assert.equal(p.evidence.maximumFeet, 60);
  assert.equal(p.evidence.distanceFeet, 60);
  s.speed = 15;
  assert.equal(plan(s, 30).evidence.maximumFeet, 30);
  assert.ok(plan(s, 31).blockedReason);
});
test("declarations require actual numbers, exact scope, explicit ground/action/route confirmations and strict threat booleans", () => {
  for (const distance of [undefined, NaN, Infinity, -1, "30", null]) {
    const patch = distance === undefined ? { hideDistanceFeet: undefined } : {};
    const p = hideMovementPlan(state(), "sneak", check, { ...input(distance), ...patch });
    if (distance === undefined) assert.equal(p.blockedReason, "");
    else assert.ok(p.blockedReason, String(distance));
  }
  for (const patch of [
    { hideMovement: "true" },
    { hideMovementMode: "climb" },
    { hideRouteConfirmed: "true" },
    { hideActionConfirmed: false },
    { hideAdjacentThreat: 1 },
    { hidePassesThreat: "false" },
    { method: "take10" },
    { method: "take20" }
  ])
    assert.ok(plan(state(["Ghost Basics"]), 30, patch).blockedReason);
  assert.ok(hideMovementPlan(state(), "blend", check, input(0)).blockedReason);
  assert.ok(hideMovementPlan(state(), "sneak", { id: "stash-item" }, input(0)).blockedReason);
  assert.equal(hideMovementPlan({}, "unknown", {}, {}).evidence, null);
});
test("current immobility, wounds, restraints, unresolved Speed and threatening adjacency block movement while stationary Hide gains no movement prohibition", () => {
  for (const patch of [
    { postureMovement: { standardMove: false } },
    { incapacitatedForMovement: true },
    { encumbrance: { immobile: true } },
    { wounds: { value: -1 } },
    { conditionContext: { paralyzed: true } },
    { conditionContext: { held: true } },
    { conditionContext: { unconscious: true } }
  ]) {
    const s = { ...state(), ...patch };
    assert.ok(plan(s, 5).blockedReason);
    assert.equal(plan(s, 0).blockedReason, "");
  }
  for (const patch of [{ speed: null }, { speed: NaN }, { speed: -1 }, { conditionSpeedReview: true }])
    assert.ok(plan({ ...state(), ...patch }, 0).blockedReason);
  for (const field of ["hideAdjacentThreat", "hidePassesThreat"]) {
    assert.ok(plan(state(), 5, { [field]: true }).blockedReason);
    assert.equal(plan(state(), 0, { [field]: true }).blockedReason, "");
  }
});
test("proof binds current Speed, sources, route and method without mutating any caller state or trusting recorded allowance/modifier values", () => {
  const s = state(["Ghost Basics", "Ghost Mastery"]),
    before = structuredClone(s),
    p = plan(s, 60),
    context = { checkKind: "skill", skillKey: "sneak", checkId: "hide", checkMethod: "roll" };
  validateHideMovementProof(s, p.evidence, context);
  assert.deepEqual(s, before);
  for (const patch of [
    { checkKind: "knowledge" },
    { skillKey: "blend" },
    { checkId: "other" },
    { checkMethod: "take10" }
  ])
    assert.throws(() => validateHideMovementProof(s, p.evidence, { ...context, ...patch }));
  for (const field of [
    "version",
    "speed",
    "maximumFeet",
    "halfSpeedMaximumFeet",
    "pace",
    "sources",
    "penalty",
    "errorIncrease",
    "mode",
    "routeConfirmed",
    "actionConfirmed",
    "distanceFeet"
  ]) {
    const proof = structuredClone(p.evidence);
    proof[field] = "changed";
    assert.throws(() => validateHideMovementProof(s, proof, context), undefined, field);
  }
  s.speed = 15;
  assert.throws(() => validateHideMovementProof(s, p.evidence, context), /exceeds|changed/);
  s.speed = 30;
  s.activeFeatNames = ["Ghost Basics"];
  assert.throws(() => validateHideMovementProof(s, p.evidence, context), /changed/);
  validateHideMovementProof(s, null, context);
});
test("native-style saved object-key reordering does not change the actual movement proof", () => {
  const s = state(["Ghost Basics"]),
    proof = plan(s, 30).evidence,
    reversed = Object.fromEntries(Object.entries(proof).reverse());
  validateHideMovementProof(s, reversed, {
    checkKind: "skill",
    skillKey: "sneak",
    checkId: "hide",
    checkMethod: "roll"
  });
});
