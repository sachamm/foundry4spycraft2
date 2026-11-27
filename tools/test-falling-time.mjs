import test from "node:test";
import assert from "node:assert/strict";
import { fallingRounds, fallingTimeRecord, fallingTimeStatus } from "../module/rules/falling-time.mjs";

const make = (feet = 160, combat = { id: "fight", round: 2, count: 37 }) =>
  fallingTimeRecord({ id: "fall", actorUuid: "Actor.a", feet, worldTime: 10, combat });
const status = (record, round, count) =>
  fallingTimeStatus(record, { actorUuid: "Actor.a", worldTime: 999, combat: { id: "fight", round, count } });

test("physical fall boundaries include partial final 400-foot intervals", () => {
  for (const [feet, rounds] of [
    [0, 0],
    [150, 0],
    [150.1, 1],
    [151, 1],
    [600, 1],
    [600.1, 2],
    [1000, 2],
    [1001, 3],
    [1400, 3]
  ])
    assert.equal(fallingRounds(feet), rounds, String(feet));
  for (const feet of [-1, NaN, Infinity, "160", Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => fallingRounds(feet));
});

test("out-of-turn falls finish at their captured Count, independent of the falling character's own turn", () => {
  const r = make();
  assert.equal(status(r, 2, 37).due, false);
  assert.equal(status(r, 2, 1).due, false);
  assert.equal(status(r, 3, 38).due, false);
  assert.equal(status(r, 3, 37).due, true);
  assert.equal(status(r, 3, 36).due, true);
  assert.equal(status(make(1001), 4, 37).due, false);
  assert.equal(status(make(1001), 5, 38).due, false);
  assert.equal(status(make(1001), 5, 37).due, true);
  assert.equal(status(make(150), 2, 37).due, true);
});

test("noncombat falls follow game seconds; rewound or missing combat clocks require review", () => {
  const r = make(601, null);
  assert.equal(fallingTimeStatus(r, { actorUuid: "Actor.a", worldTime: 21.99 }).due, false);
  assert.equal(fallingTimeStatus(r, { actorUuid: "Actor.a", worldTime: 22 }).due, true);
  assert.throws(() => fallingTimeStatus(r, { actorUuid: "Actor.a", worldTime: 9 }));
  assert.throws(() => fallingTimeStatus(make(), { actorUuid: "Actor.a", worldTime: 999 }));
  assert.throws(() => status(make(), 1, 37));
  assert.throws(() => fallingTimeStatus(make(), { actorUuid: "Actor.other" }));
  assert.throws(() =>
    fallingTimeRecord({
      id: "a",
      actorUuid: "Actor.a",
      feet: 160,
      worldTime: 0,
      combat: { id: "f", round: 1, count: null }
    })
  );
});

test("reviewed timing and caught falls are explicit; copied or malformed records cannot supply a clock", () => {
  assert.equal(
    fallingTimeStatus(
      { ...make(), review: { due: true, note: "Original combat ended after impact", reviewedBy: "gc" } },
      { actorUuid: "Actor.a" }
    ).due,
    true
  );
  assert.equal(fallingTimeStatus({ ...make(), state: "caught" }, { actorUuid: "Actor.a" }).due, false);
  assert.throws(() => status({ ...make(), rounds: 0 }, 3, 37));
  assert.throws(() => status({ ...make(), state: "unknown" }, 3, 37));
});
