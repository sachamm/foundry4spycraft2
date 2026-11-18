import test from "node:test";
import assert from "node:assert/strict";
import { detectionObserverPlan } from "../module/rules/detection-observer.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const targets = [
    { key: "notice", check: "awareness" },
    { key: "search", check: "perception" }
  ],
  input = (patch = {}) => ({
    actorUuid: "Actor.target",
    actorName: "Target",
    severity: "minor",
    confirmed: true,
    method: "roll",
    ...patch
  }),
  plan = (system = {}, patch = {}) => detectionObserverPlan(system, "notice", { id: "awareness" }, input(patch));
test("each observer-distraction grade has its exact separate penalty/error values on both named detection checks", () => {
  for (const [key, { penalty, errorIncrease }] of Object.entries({
    minor: { penalty: -2, errorIncrease: 0 },
    moderate: { penalty: -4, errorIncrease: 1 },
    major: { penalty: -8, errorIncrease: 3 }
  }))
    for (const scope of targets) {
      const p = detectionObserverPlan({}, scope.key, { id: scope.check }, input({ severity: key }));
      assert.equal(p.blockedReason, "");
      assert.equal(p.penalty, penalty);
      assert.equal(p.errorIncrease, errorIncrease);
      assert.equal(p.evidence.basePenalty, penalty);
      assert.equal(p.evidence.additionalPenalty, 0);
      assert.equal(p.evidence.targetActorUuid, "Actor.target");
      assert.equal(p.evidence.skillKey, scope.key);
    }
});
test("Ghost Mastery adds exactly minus four without changing the normal distraction error increase or reading unrelated target stats", () => {
  for (const severity of ["minor", "moderate", "major"])
    for (const names of [
      ["Ghost Mastery"],
      ["Ghost Basics", "Ghost Mastery", "Ghost Supremacy"],
      ["Ghost Mastery", "Ghost Mastery"]
    ]) {
      const target = { activeFeatNames: names };
      Object.defineProperty(target, "abilities", {
        get() {
          throw Error("Unrelated target stats read");
        }
      });
      const base = plan({}, { severity }),
        p = plan(target, { severity });
      assert.equal(p.penalty, base.penalty - 4);
      assert.equal(p.errorIncrease, base.errorIncrease);
      assert.deepEqual(p.evidence.sources, ["Ghost Mastery"]);
      assert.equal(p.evidence.additionalPenalty, -4);
    }
  for (const activeFeatNames of [undefined, [], ["Ghost Basics"], ["Ghost Supremacy"], ["Silver Tongue"], ["Zeroed"]])
    assert.equal(plan({ activeFeatNames }).evidence.additionalPenalty, 0);
});
test("the distraction component is confined to Awareness and Perception across every named use", () => {
  for (const [key, skill] of Object.entries(cfg.skills))
    for (const check of skill.checks) {
      const p = detectionObserverPlan({ activeFeatNames: ["Ghost Mastery"] }, key, check, input()),
        eligible = (key === "notice" && check.id === "awareness") || (key === "search" && check.id === "perception");
      assert.equal(!!p.evidence, eligible, key + "/" + check.id);
      assert.equal(!!p.blockedReason, !eligible);
      assert.equal(p.penalty, eligible ? -6 : 0);
    }
});
test("actual named target, supported grade, rolled method and strict GC confirmation are mandatory", () => {
  for (const patch of [
    { actorUuid: "" },
    { actorUuid: "Item.target" },
    { actorUuid: {} },
    { actorName: "" },
    { actorName: "x".repeat(201) },
    { severity: "unknown" },
    { severity: null },
    { severity: true },
    { confirmed: false },
    { confirmed: "true" },
    { method: "take10" },
    { method: "take20" },
    { method: "other" }
  ])
    assert.ok(plan({}, patch).blockedReason, JSON.stringify(patch));
  for (const system of [
    null,
    [],
    { activeFeatNames: "Ghost Mastery" },
    { activeFeatNames: [null] },
    { activeFeatNames: [""] }
  ])
    assert.ok(plan(system).blockedReason);
  assert.equal(plan({}, { actorName: "  Actual target  " }).evidence.targetName, "Actual target");
});
test("disabling the distraction grade ignores retained target fields and never reads a hidden target source", () => {
  const target = {};
  Object.defineProperty(target, "activeFeatNames", {
    get() {
      throw Error("Unused target source read");
    }
  });
  const p = detectionObserverPlan(
    target,
    "other",
    { id: "other" },
    input({ severity: "", confirmed: "true", actorUuid: "Item.not-selected", method: "take20" })
  );
  assert.equal(p.evidence, null);
  assert.equal(p.penalty, 0);
  assert.equal(p.errorIncrease, 0);
  assert.equal(p.blockedReason, "");
});
test("the pure plan does not mutate source or inputs and records enough facts to reject a changed target/source/grade later", () => {
  const target = { activeFeatNames: ["Ghost Mastery"] },
    options = input({ severity: "major" }),
    before = structuredClone({ target, options }),
    p = detectionObserverPlan(target, "search", { id: "perception" }, options);
  assert.deepEqual({ target, options }, before);
  assert.deepEqual(p.evidence, {
    version: 1,
    skillKey: "search",
    checkId: "perception",
    method: "roll",
    targetActorUuid: "Actor.target",
    targetName: "Target",
    severity: "major",
    confirmed: true,
    basePenalty: -8,
    additionalPenalty: -4,
    penalty: -12,
    errorIncrease: 3,
    sources: ["Ghost Mastery"]
  });
  target.activeFeatNames = [];
  assert.notDeepEqual(detectionObserverPlan(target, "search", { id: "perception" }, options).evidence, p.evidence);
  assert.notDeepEqual(
    detectionObserverPlan(target, "search", { id: "perception" }, { ...options, severity: "minor" }).evidence,
    p.evidence
  );
});
