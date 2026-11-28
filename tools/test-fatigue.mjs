import test from "node:test";
import assert from "node:assert/strict";

import { fatigueApplicationPlan, fatigueApplicationHistory, fatigueStateSignature } from "../module/rules/fatigue.mjs";
import { mentalLeapRecord } from "../module/rules/mental-leap.mjs";

const state = conditions => ({
    worldTime: 0,
    conditionContext: conditions ?? {},
    fatigueApplications: [],
    mentalLeapFatigueEvents: []
  }),
  declare = { id: "application", kind: "fatigued", source: "GC-confirmed fatigue source", confirmed: true },
  plan = (s, extra = {}) => fatigueApplicationPlan(s, { ...declare, ...extra });
test("all incoming fatigue/exhaustion combinations use the actual current stage, replacing fatigue with exhaustion and escalating exhausted characters to unconsciousness", () => {
  for (const kind of ["fatigued", "exhausted"])
    for (const before of ["none", "fatigued", "exhausted"]) {
      const s = state(before === "none" ? {} : { [before]: true }),
        copy = structuredClone(s),
        p = plan(s, { kind });
      assert.equal(p.record.before, before);
      assert.equal(
        p.record.after,
        before === "exhausted"
          ? "unconscious"
          : kind === "exhausted" || before === "fatigued"
            ? "exhausted"
            : "fatigued"
      );
      assert.equal(p.clearFatigued, before === "fatigued");
      assert.equal(!!p.event, before === "exhausted");
      if (p.event) assert.equal(p.event.at, 0);
      assert.deepEqual(s, copy);
    }
  const s = { ...state(), classLevels: { schemer: 1 }, actionDice: { max: 3 } },
    r = mentalLeapRecord(s, { id: "mental", ability: "int" });
  s.mentalLeaps = [r];
  s.worldTime = 60;
  assert.equal(plan(s).record.after, "unconscious");
  assert.equal(plan(s).applyStatus, null);
});
test("stable application identifiers are idempotent, conflicting reuse and stale confirmations are rejected, and history cannot invent a transition or missing event", () => {
  const s = state(),
    p = plan(s),
    expected = fatigueStateSignature(s);
  s.fatigueApplications = [p.record];
  s.conditionContext.fatigued = true;
  assert.equal(plan(s, { expectedState: expected }).duplicate, true);
  assert.throws(() => plan(s, { source: "Different source" }), /different incoming/);
  assert.throws(() => plan(s, { id: "new", expectedState: expected }), /state changed/);
  for (const r of [
    { ...p.record, after: "unconscious" },
    { ...p.record, at: 1 },
    { ...p.record, needsReview: true },
    { ...p.record, source: "" }
  ])
    assert.ok(fatigueApplicationHistory({ ...s, fatigueApplications: [r] }).warnings.length);
  assert.ok(fatigueApplicationHistory({ ...s, fatigueApplications: [p.record, p.record] }).warnings.length);
  const e = plan(state({ exhausted: true }));
  assert.ok(fatigueApplicationHistory({ ...state(), fatigueApplications: [e.record] }).warnings.length);
  assert.deepEqual(
    fatigueApplicationHistory({ ...state(), fatigueApplications: [e.record], mentalLeapFatigueEvents: [e.event] })
      .warnings,
    []
  );
});
test("incomplete declarations, clocks, sources and incoming kinds never produce an application", () => {
  for (const extra of [
    { confirmed: "true" },
    { confirmed: false },
    { source: "" },
    { source: 3 },
    { kind: "unconscious" },
    { kind: "Fatigued" },
    { id: "" }
  ])
    assert.throws(() => plan(state(), extra));
  for (const worldTime of [NaN, Infinity, Number.MAX_VALUE]) assert.throws(() => plan({ ...state(), worldTime }));
});
import { makeFatigueActor as actor } from "./fixtures/fatigue-actor.mjs";
const apply = (a, id, extra = {}) => a.applyFatigue({ ...declare, id, ...extra }),
  fatigueSource = {
    _id: "fatigue-source",
    name: "Original fatigue",
    statuses: ["fatigued"],
    duration: { seconds: 800 },
    flags: { independent: { keep: "metadata" } }
  };

test("owned NPCs use the shared idempotent fatigue stages and ordinary recovery workflow", async () => {
  game.time.worldTime = 0;
  const a = actor();
  a.type = "npc";
  const first = await apply(a, "npc-first");
  assert.equal(first.after, "fatigued");
  assert.equal((await apply(a, "npc-first")).id, first.id);
  assert.equal(a.system.fatigueApplications.length, 1);
  assert.equal((await apply(a, "npc-second")).after, "exhausted");
  const begin = await a.beginFatigueRest({ confirmed: true, ordinaryRuleConfirmed: true });
  assert.ok(begin);
  game.time.worldTime = 3600;
  a.derive();
  assert.ok(await a.completeFatigueRest({ fullRecoveryConfirmed: true }));
  assert.equal(a.statuses.has("exhausted"), false);
  assert.equal(a.system.fatigueApplications.length, 2);
});
test("the actual workflow applies all three stages with exact attribute/Speed/save scopes, stable receipts and unchanged health/dice", async () => {
  const a = actor();
  assert.equal(await a.applyFatigue(), null);
  await apply(a, "first");
  assert.equal(a.system.mentalLeapState.fatigued, true);
  assert.equal(a.system.abilities.str.value, 10);
  assert.equal(a.system.abilities.dex.value, 11);
  assert.equal(a.system.speed, 30);
  assert.equal(a.system.canRun, false);
  assert.equal(a.system.mentalLeapState.fatigueSaveBonus, 6);
  assert.equal(a.system.mentalLeapState.exhaustionSaveBonus, 0);
  await apply(a, "second");
  assert.equal(a.statuses.has("fatigued"), false);
  assert.equal(a.statuses.has("exhausted"), true);
  assert.equal(a.system.abilities.str.value, 6);
  assert.equal(a.system.abilities.dex.value, 7);
  assert.equal(a.system.speed, 15);
  assert.equal(a.system.mentalLeapState.exhaustionSaveBonus, 6);
  await apply(a, "third");
  assert.equal(a.system.mentalLeapState.unconscious, true);
  assert.equal(a.system.speed, 0);
  assert.equal(a.system.mentalLeapState.recoveryAvailable, true);
  assert.equal(a.system.fatigueApplications.length, 3);
  assert.equal(a.system.mentalLeapFatigueEvents.length, 1);
  await apply(a, "third");
  assert.equal(a.system.mentalLeapFatigueEvents.length, 1);
  assert.equal(a.system.fatigueApplications.length, 3);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.vitality.value, 4);
  assert.equal(a.system.wounds.value, 4);
});
test("two confirmations from the same old state cannot accidentally escalate twice, while a newly reviewed application can proceed", async () => {
  const a = actor(),
    expectedState = fatigueStateSignature(a.system),
    results = await Promise.allSettled([apply(a, "one", { expectedState }), apply(a, "two", { expectedState })]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(a.system.fatigueApplications.length, 1);
  assert.equal(a.system.mentalLeapState.fatigued, true);
  await apply(a, "two");
  assert.equal(a.system.mentalLeapState.exhausted, true);
});
test("failed history writes restore original effect IDs, duration/metadata, physical status, history and events even after a committed write", async () => {
  for (const failure of ["historyBefore", "historyAfter"]) {
    const a = actor([fatigueSource]);
    a.fail = failure;
    await assert.rejects(apply(a, "failed"), /history/);
    assert.equal(a.system.fatigueApplications.length, 0);
    assert.equal(a.statuses.has("exhausted"), false);
    assert.equal(a.statuses.has("fatigued"), true);
    assert.deepEqual(a.effects.get("fatigue-source").toObject(), fatigueSource);
    assert.equal(a.system.mentalLeapFatigueEvents.length, 0);
  }
});
test("compound fatigue sources preserve their other statuses and changes; continuing item sources cannot be removed by escalation", async () => {
  const combined = {
      ...fatigueSource,
      statuses: ["fatigued", "sickened"],
      changes: [{ key: "system.misc.defense", value: 1 }]
    },
    a = actor([combined]);
  await apply(a, "compound");
  assert.deepEqual([...a.effects.get("fatigue-source").statuses], ["sickened"]);
  assert.deepEqual(a.effects.get("fatigue-source").changes, combined.changes);
  const b = actor();
  b.foreign = [{ id: "item", active: true, statuses: new Set(["fatigued"]) }];
  b.derive();
  await assert.rejects(apply(b, "foreign"), /item or another source/);
  assert.equal(b.effects.length, 0);
  assert.equal(b.system.fatigueApplications.length, 0);
  assert.equal(b.system.mentalLeapState.fatigued, true);
});
test("incomplete effect restoration leaves a durable review entry and blocks another incoming application", async () => {
  const a = actor([fatigueSource]);
  a.fail = "restore";
  await assert.rejects(apply(a, "needs-review"), /incomplete restoration/);
  assert.equal(a.system.fatigueApplications[0].needsReview, true);
  a.fail = null;
  await assert.rejects(apply(a, "later"), /review/);
  assert.equal(a.system.fatigueApplications.length, 1);
});
