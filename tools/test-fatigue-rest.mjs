import test from "node:test";
import assert from "node:assert/strict";
import { fatigueRestRecord, fatigueRestCompletionPlan, fatigueRestStatus } from "../module/rules/fatigue.mjs";
import { mentalLeapRecord } from "../module/rules/mental-leap.mjs";
import { makeFatigueActor } from "./fixtures/fatigue-actor.mjs";
const source = (condition = "fatigued") => ({
    _id: "fatigue-source",
    name: "Ordinary " + condition,
    statuses: [condition],
    duration: { seconds: null },
    flags: { independent: { keep: "source metadata" } }
  }),
  actor = (condition = "fatigued") => {
    game.time.worldTime = 0;
    return makeFatigueActor([source(condition)]);
  },
  begin = (a, extra = {}) => a.beginFatigueRest({ confirmed: true, ordinaryRuleConfirmed: true, ...extra }),
  finish = (a, extra = {}) => a.completeFatigueRest({ fullRecoveryConfirmed: true, ...extra }),
  advance = (a, seconds) => {
    game.time.worldTime = seconds;
    a.derive();
  };
test("ordinary fatigue requires eight hours inactive rest and exhaustion one hour asleep, unaffected by damage-recovery feats or qualities", () => {
  for (const condition of ["fatigued", "exhausted"]) {
    const s = {
        worldTime: 0,
        conditionContext: { [condition]: true },
        activeFeatNames: ["Quick Healer"],
        originEffects: [{ qualityKey: "fastHealing" }]
      },
      p = fatigueRestRecord(s, { condition, ids: ["source"], confirmed: true, ordinaryRuleConfirmed: true });
    assert.equal(p.record.requiredHours, condition === "fatigued" ? 8 : 1);
    assert.equal(p.record.mode, condition === "fatigued" ? "inactiveRest" : "sleep");
    for (const seconds of [0, p.record.requiredHours * 3600 - 1])
      assert.throws(
        () =>
          fatigueRestCompletionPlan(
            { ...s, worldTime: seconds, fatigueRest: p.record },
            { ids: ["source"], fullRecoveryConfirmed: true }
          ),
        /clock/
      );
    const done = fatigueRestCompletionPlan(
      { ...s, worldTime: p.record.requiredHours * 3600, fatigueRest: p.record },
      { ids: ["source"], fullRecoveryConfirmed: true }
    );
    assert.equal(done.record.completedAt, p.record.requiredHours * 3600);
  }
});
test("repeated starts preserve the same episode unless explicitly restarted, and confirmations cannot cure a newly sourced condition", () => {
  const s = { worldTime: 0, conditionContext: { fatigued: true } },
    p = fatigueRestRecord(s, { condition: "fatigued", ids: ["b", "a"], confirmed: true, ordinaryRuleConfirmed: true });
  assert.deepEqual(p.record.sourceIds, ["a", "b"]);
  const later = { ...s, worldTime: 100, fatigueRest: p.record };
  assert.equal(
    fatigueRestRecord(later, { condition: "fatigued", ids: ["b", "a"], confirmed: true, ordinaryRuleConfirmed: true })
      .record.startedAt,
    0
  );
  assert.equal(
    fatigueRestRecord(later, {
      condition: "fatigued",
      ids: ["a", "b"],
      confirmed: true,
      ordinaryRuleConfirmed: true,
      restart: true
    }).record.startedAt,
    100
  );
  assert.throws(
    () => fatigueRestCompletionPlan({ ...later, worldTime: 28800 }, { ids: ["new"], fullRecoveryConfirmed: true }),
    /sources changed/
  );
});
test("only explicit ordinary recovery and actual-rest attestations qualify; malformed/future records, source changes and invalid clocks stay pending for review", () => {
  const s = { worldTime: 0, conditionContext: { fatigued: true } };
  for (const extra of [
    { confirmed: false },
    { ordinaryRuleConfirmed: false },
    { restart: "true" },
    { condition: "constructor" },
    { ids: [] },
    { ids: ["x", "x"] }
  ])
    assert.throws(() =>
      fatigueRestRecord(s, {
        condition: "fatigued",
        ids: ["x"],
        confirmed: true,
        ordinaryRuleConfirmed: true,
        ...extra
      })
    );
  const p = fatigueRestRecord(s, {
    condition: "fatigued",
    ids: ["x"],
    confirmed: true,
    ordinaryRuleConfirmed: true
  }).record;
  assert.throws(() => fatigueRestCompletionPlan({ ...s, worldTime: 28800, fatigueRest: p }, { ids: ["x"] }), /GC/);
  for (const r of [
    { ...p, requiredHours: 4 },
    { ...p, startedAt: 1 },
    { ...p, sourceIds: [] },
    { ...p, completedAt: 3600, fullRecoveryConfirmed: true },
    { ...p, needsReview: true }
  ])
    assert.equal(fatigueRestStatus({ ...s, fatigueRest: r }).needsReview, true);
  assert.throws(
    () =>
      fatigueRestRecord(
        { ...s, worldTime: Number.MAX_SAFE_INTEGER },
        { condition: "fatigued", ids: ["x"], confirmed: true, ordinaryRuleConfirmed: true }
      ),
    /clock/
  );
});
test("actual eight-hour rest clears only Fatigued, restores stats, preserves health/dice and never refills a session or erases application history", async () => {
  const a = actor();
  assert.equal(await a.beginFatigueRest(), null);
  await begin(a);
  const before = a.system.fatigueRest;
  advance(a, 3600);
  await begin(a);
  assert.equal(a.system.fatigueRest.startedAt, before.startedAt);
  advance(a, 28799);
  await assert.rejects(finish(a), /clock/);
  assert.equal(a.system.mentalLeapState.fatigued, true);
  advance(a, 28800);
  await finish(a);
  assert.equal(a.statuses.has("fatigued"), false);
  assert.equal(a.system.abilities.str.value, 12);
  assert.equal(a.system.abilities.dex.value, 13);
  assert.equal(a.system.canRun, true);
  assert.equal(a.system.fatigueRest.completedAt, 28800);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.vitality.value, 4);
  assert.equal(a.system.wounds.value, 4);
  assert.deepEqual(a.system.fatigueApplications, []);
});
test("one-hour exhaustion sleep does not cure independent unconsciousness, class-timed exhaustion, new fatigue, or an item-owned source", async () => {
  let a = actor("exhausted");
  await a.applyFatigue({ id: "unconscious", kind: "fatigued", source: "Another fatigue", confirmed: true });
  await begin(a);
  advance(a, 3600);
  await finish(a);
  assert.equal(a.statuses.has("exhausted"), false);
  assert.equal(a.system.mentalLeapState.unconscious, true);
  assert.equal(a.system.abilities.str.value, 12);
  assert.equal(a.system.speed, 0);
  assert.equal(a.system.mentalLeapFatigueEvents.length, 1);
  await a.applyFatigue({ id: "new-fatigue", kind: "fatigued", source: "New cause", confirmed: true });
  await finish(a);
  assert.equal(a.statuses.has("fatigued"), true);
  a = actor();
  await begin(a);
  await a.applyFatigue({ id: "replacement", kind: "fatigued", source: "Escalation", confirmed: true });
  advance(a, 28800);
  await finish(a);
  assert.equal(a.statuses.has("exhausted"), true);
  a = actor();
  a.foreign = [{ id: "item", active: true, statuses: new Set(["fatigued"]) }];
  a.derive();
  await assert.rejects(begin(a), /item or another source/);
  assert.equal(a.system.fatigueRest, undefined);
  game.time.worldTime = 0;
  const timed = makeFatigueActor();
  timed.raw.mentalLeaps = [
    mentalLeapRecord(
      { worldTime: 0, classLevels: { schemer: 1 }, actionDice: { max: 3 } },
      { id: "timed", ability: "int" }
    )
  ];
  advance(timed, 60);
  assert.equal(timed.system.mentalLeapState.exhausted, true);
  assert.equal(await begin(timed), false);
  assert.equal(timed.system.fatigueRest, undefined);
});
test("source expiry can complete as a no-op, while stale rest snapshots and concurrent final confirmations cannot clear a later episode", async () => {
  const a = actor();
  await begin(a);
  const old = JSON.stringify(a.system.fatigueRest);
  await a.deleteEmbeddedDocuments("ActiveEffect", ["fatigue-source"]);
  advance(a, 28800);
  await Promise.all([finish(a), finish(a)])
    .then(results => assert.equal(results.length, 2))
    .catch(error => assert.match(error.message, /rest record changed/));
  assert.equal(a.system.fatigueRest.completedAt, 28800);
  await a.applyFatigue({ id: "later", kind: "fatigued", source: "Later cause", confirmed: true });
  await finish(a);
  assert.equal(a.statuses.has("fatigued"), true);
  await begin(a);
  await assert.rejects(finish(a, { expectedRest: old }), /rest record changed/);
  assert.equal(a.statuses.has("fatigued"), true);
});
test("failed rest settlement restores the original source metadata and pending timer even after its write committed", async () => {
  for (const fail of ["restBefore", "restAfter"]) {
    const a = actor();
    await begin(a);
    const record = structuredClone(a.system.fatigueRest),
      effect = a.effects[0].toObject();
    advance(a, 28800);
    a.fail = fail;
    await assert.rejects(finish(a), /rest history/);
    assert.equal(a.statuses.has("fatigued"), true);
    assert.deepEqual(a.effects[0].toObject(), effect);
    assert.deepEqual(a.system.fatigueRest, record);
  }
});
test("an incomplete source restoration marks recovery for review and prevents a fresh rest from hiding the failure", async () => {
  const a = actor();
  await begin(a);
  advance(a, 28800);
  a.fail = "restRestore";
  await assert.rejects(finish(a), /incomplete restoration/);
  assert.equal(a.system.fatigueRest.needsReview, true);
  a.fail = null;
  await a.createEmbeddedDocuments("ActiveEffect", [source()]);
  await assert.rejects(begin(a), /review/);
});

test("starting a new period resets prior completion flags even when Foundry recursively merges ObjectField updates", async () => {
  const a = actor();
  await begin(a);
  advance(a, 28800);
  await finish(a);
  assert.equal(a.system.fatigueRest.fullRecoveryConfirmed, true);
  await a.applyFatigue({ id: "new-period", kind: "fatigued", source: "New ordinary fatigue", confirmed: true });
  await begin(a);
  assert.equal(a.system.fatigueRest.completedAt, null);
  assert.equal(a.system.fatigueRest.fullRecoveryConfirmed, false);
  assert.equal(a.system.fatigueRest.needsReview, false);
  assert.equal(a.system.fatigueRest.startedAt, 28800);
  await assert.rejects(a.completeFatigueRest({ fullRecoveryConfirmed: false }), /GC/);
  assert.equal(a.statuses.has("fatigued"), true);
});
