import test from "node:test";
import assert from "node:assert/strict";
import {
  usesSceneDisposition,
  sceneDispositionState as state,
  sceneDispositionChange as change,
  endSceneDispositionSource as end
} from "../module/rules/scene-disposition.mjs";

const context = { scene: "scene1", worldTime: 100, actingActorUuid: "Actor.acting" };
const source = (id, direction = 1, extra = {}) => ({
  ...context,
  id,
  direction,
  sourceKey: `Check.${id}`,
  source: "Successful influence",
  confirmed: true,
  reviewerId: "gc",
  ...extra
});

test("only PCs and actual villain roles use temporary disposition effects", () => {
  assert.equal(usesSceneDisposition("agent", {}), true);
  assert.equal(usesSceneDisposition("agent", { companionOf: { ownerUuid: "Actor.owner" } }), false);
  assert.equal(usesSceneDisposition("npc", { npcType: "special" }), false);
  for (const system of [
    { npcType: "villain" },
    { manualRole: "minion" },
    { npcProfile: { enabled: true, qualities: [{ id: "mastermind" }] } }
  ])
    assert.equal(usesSceneDisposition("npc", system), true);
  assert.equal(
    usesSceneDisposition("npc", { manualRole: "minion", npcProfile: { enabled: true, qualities: [] } }),
    false
  );
});

test("successive sources cap at two degrees and opposite sources cancel one degree at a time", () => {
  let record;
  for (const [id, direction, degree, modifier, error, threat, time] of [
    ["a", 1, 1, 2, 0, 0, 0.5],
    ["b", 1, 2, 4, 0, 1, 0.25],
    ["c", 1, 2, 4, 0, 1, 0.25],
    ["d", -1, 1, 2, 0, 0, 0.5],
    ["e", -1, 0, 0, 0, 0, 1],
    ["f", -1, -1, -2, 0, 0, 2],
    ["g", -1, -2, -4, 1, 0, 4],
    ["h", -1, -2, -4, 1, 0, 4]
  ]) {
    const before = structuredClone(record);
    record = change(record, source(id, direction));
    const p = state(record, context);
    assert.deepEqual(
      [p.degree, p.modifier, p.error, p.threat, p.timeMultiplier],
      [degree, modifier, error, threat, time]
    );
    assert.deepEqual(record.entries.slice(0, -1), before?.entries ?? []);
  }
  assert.equal(record.entries[2].applied, 0);
  assert.equal(record.entries[7].applied, 0);
  assert.equal(state(record, { ...context, actingActorUuid: "Actor.other" }).degree, 0);
});

test("scene boundaries, exact expiry and explicit early ends remove only their actual source effects", () => {
  const first = change(null, source("first", 1, { durationSeconds: 5 })),
    record = change(first, source("second", 1));
  assert.equal(state(record, { ...context, worldTime: 104.99 }).degree, 2);
  assert.equal(state(record, { ...context, worldTime: 105 }).degree, 1);
  assert.equal(state(record, { ...context, scene: "scene2" }).degree, 0);
  const ended = end(record, { ...context, id: "second", confirmed: true });
  assert.equal(state(ended, context).degree, 1);
  assert.equal(state(ended, { ...context, worldTime: 105 }).degree, 0);
  assert.equal(record.entries[1].ended, undefined);
  assert.throws(() => end(ended, { ...context, id: "second", confirmed: true }), /active/);
  assert.throws(() => end(record, { ...context, id: "second", confirmed: false }), /Confirm/);
});

test("expired cancellation never creates hidden extra degrees and replaying an ended source is rejected", () => {
  let record;
  for (const [id, direction, durationSeconds] of [
    ["a", 1],
    ["b", 1],
    ["c", -1, 5],
    ["d", 1]
  ])
    record = change(record, source(id, direction, { durationSeconds: durationSeconds ?? null }));
  const later = { ...context, worldTime: 106 };
  assert.equal(state(record, later).degree, 2);
  record = change(record, source("e", -1, { worldTime: 106 }));
  assert.equal(state(record, later).degree, 1);
  const ended = end(record, { ...later, id: "a", confirmed: true });
  assert.throws(() => change(ended, source("new", 1, { sourceKey: "Check.a", worldTime: 106 })), /already recorded/);
});

test("invalid histories, unsupported directions and unknown expiry stop before creating an effect", () => {
  for (const extra of [
    { confirmed: false },
    { direction: 2 },
    { sourceKey: "" },
    { source: " " },
    { reviewerId: "" },
    { durationSeconds: 0 },
    { durationSeconds: -1 },
    { durationSeconds: NaN },
    { scene: "" },
    { worldTime: NaN }
  ])
    assert.throws(() => change(null, source("a", 1, extra)));
  const record = change(null, source("a"));
  for (const mutate of [
    r => (r.version = 99),
    r => r.entries.push(r.entries[0]),
    r => (r.entries[0].applied = 2),
    r => (r.entries[0].expiresAt = 99),
    r => (r.entries[0].direction = -1),
    r => (r.entries[0].ended = "yes")
  ]) {
    const broken = structuredClone(record);
    mutate(broken);
    assert.throws(() => state(broken, context), /review/);
  }
});
