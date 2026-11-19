import test from "node:test";
import assert from "node:assert/strict";
import {
  ROUND_SECONDS,
  conditionDuration,
  effectDuration,
  createTimer,
  dueTimers,
  durationLabel,
  elapsedClock,
  expiredConditionAction,
  extendTimer,
  markNotified,
  removeTimer,
  timerStatus,
  unitSeconds,
  validTimers
} from "../module/rules/timers.mjs";
import { setConditionStatus } from "../module/rules/condition-status.mjs";
import { worldCompendiumDocuments } from "../module/migrations/index.mjs";

test("a round is 6 seconds and longer units convert to seconds", () => {
  assert.equal(ROUND_SECONDS, 6);
  assert.equal(unitSeconds(3, "round"), 18);
  assert.equal(unitSeconds(2, "minute"), 120);
  assert.equal(unitSeconds(1.5, "hour"), 5400);
  assert.equal(unitSeconds(1, "day"), 86400);
  assert.equal(unitSeconds(1, "week"), 604800);
  assert.throws(() => unitSeconds(0, "round"), /above 0/);
  assert.throws(() => unitSeconds(-2, "hour"), /above 0/);
  assert.throws(() => unitSeconds(1, "fortnight"), /rounds, minutes/);
  assert.throws(() => unitSeconds(Number.NaN, "round"), /above 0/);
});

test("a timer defaults to one round and records when it starts and ends", () => {
  const timer = createTimer({ id: "a" }, 600);
  assert.deepEqual(timer, {
    id: "a",
    label: "Timer",
    unit: "round",
    start: 600,
    end: 606,
    shared: false,
    notified: false
  });
  const long = createTimer({ id: "b", label: "  Guard rotation ", count: 2, unit: "hour", shared: true }, 100);
  assert.equal(long.label, "Guard rotation");
  assert.equal(long.end, 7300);
  assert.equal(long.shared, true);
  assert.throws(() => createTimer({ count: 1 }, 0), /id/);
  assert.throws(() => createTimer({ id: "c" }, -1), /clock/);
  assert.throws(() => createTimer({ id: "c", count: 0 }, 0), /above 0/);
});

test("a timer is due once, when the clock reaches its end", () => {
  const list = [createTimer({ id: "a", count: 3 }, 0), createTimer({ id: "b", count: 10 }, 0)];
  assert.deepEqual(dueTimers(list, 17), []);
  assert.deepEqual(
    dueTimers(list, 18).map(t => t.id),
    ["a"]
  );
  const told = markNotified(list, ["a"]);
  assert.deepEqual(dueTimers(told, 30), []);
  assert.deepEqual(
    dueTimers(told, 60).map(t => t.id),
    ["b"]
  );
  assert.deepEqual(dueTimers(list, Number.NaN), []);
});

test("a jump of the clock announces every timer it passed", () => {
  const list = [createTimer({ id: "a", count: 1 }, 0), createTimer({ id: "b", count: 1, unit: "hour" }, 0)];
  assert.deepEqual(
    dueTimers(list, 86400).map(t => t.id),
    ["a", "b"]
  );
});

test("malformed stored timers are ignored rather than breaking the list", () => {
  const good = createTimer({ id: "a" }, 0);
  assert.deepEqual(
    validTimers([good, null, 4, { id: "" }, { id: "x", start: 5, end: 1 }, { id: "y", start: "0", end: 6 }]),
    [good]
  );
  assert.deepEqual(validTimers(undefined), []);
  assert.deepEqual(validTimers({ a: good }), []);
});

test("removing and extending a timer", () => {
  const list = [createTimer({ id: "a", count: 2 }, 0), createTimer({ id: "b", count: 2 }, 0)];
  assert.deepEqual(
    removeTimer(list, "a").map(t => t.id),
    ["b"]
  );
  const told = markNotified(list, ["a"]);
  const longer = extendTimer(told, "a", 3, "round");
  assert.equal(longer[0].end, 30);
  assert.equal(longer[0].notified, false, "a timer given more time announces itself again");
  assert.equal(longer[1].end, 12);
  assert.equal(extendTimer(list, "a", -10, "round")[0].end, 0, "never before its start");
});

test("time left reads in rounds for a round timer and in larger units otherwise", () => {
  const rounds = createTimer({ id: "a", count: 3 }, 0);
  assert.equal(timerStatus(rounds, 0).label, "3 rounds left");
  assert.equal(timerStatus(rounds, 6).label, "2 rounds left");
  assert.equal(timerStatus(rounds, 13).label, "1 round left");
  assert.deepEqual(timerStatus(rounds, 18), { seconds: 0, expired: true, label: "Done", fraction: 1 });
  const hours = createTimer({ id: "b", count: 2, unit: "hour" }, 0);
  assert.equal(timerStatus(hours, 300).label, "1 h 55 min left");
  assert.equal(timerStatus(hours, 3600).fraction, 0.5);
});

test("durations are written largest unit first", () => {
  assert.equal(durationLabel(0), "0 s");
  assert.equal(durationLabel(18), "18 s");
  assert.equal(durationLabel(3725), "1 h 2 min");
  assert.equal(durationLabel(3725, { maxTerms: 3 }), "1 h 2 min 5 s");
  assert.equal(durationLabel(694800), "1 wk 1 d");
});

test("without a date the clock counts days from the first", () => {
  assert.deepEqual(elapsedClock(0), { day: 1, hour: 0, minute: 0, second: 0, clock: "00:00:00" });
  assert.equal(elapsedClock(86400 + 3600 * 14 + 60 * 5 + 6).clock, "14:05:06");
  assert.equal(elapsedClock(86400 * 2).day, 3);
  assert.equal(elapsedClock(-5).day, 1);
});

test("a length of time becomes an effect duration in Foundry's own units", () => {
  assert.deepEqual(effectDuration(3, "round"), { value: 3, units: "rounds" });
  assert.deepEqual(effectDuration(10, "minute"), { value: 10, units: "minutes" });
  assert.deepEqual(effectDuration(2, "hour"), { value: 2, units: "hours" });
  assert.deepEqual(effectDuration(1, "day"), { value: 1, units: "days" });
  assert.deepEqual(effectDuration(2, "week"), { value: 14, units: "days" });
  assert.deepEqual(effectDuration(1.5, "hour"), { value: 5400, units: "seconds" }, "not whole in its own unit");
  assert.throws(() => effectDuration(0, "round"), /above 0/);
  assert.throws(() => effectDuration(1, "moment"), /rounds, minutes/);
});

test("a knockout's length becomes an effect duration, or nothing when it is not known", () => {
  assert.deepEqual(conditionDuration({ count: 3, unit: "round" }), { value: 3, units: "rounds" });
  assert.deepEqual(conditionDuration({ count: 2, unit: "hour" }), { value: 2, units: "hours" });
  assert.equal(conditionDuration(null), null);
  assert.equal(conditionDuration({ count: 2, unit: "moment" }), null);
});

test("an expired condition is removed, unless wounds keep the character down", () => {
  assert.equal(expiredConditionAction({ statuses: ["stunned"], wounds: 0, special: true }), "remove");
  assert.equal(expiredConditionAction({ statuses: ["unconscious"], wounds: 4, special: true }), "remove");
  assert.equal(expiredConditionAction({ statuses: ["unconscious"], wounds: 0, special: true }), "keep");
  assert.equal(expiredConditionAction({ statuses: ["unconscious"], wounds: -3, special: true }), "keep");
  // A standard character has no wound total to hold him down.
  assert.equal(expiredConditionAction({ statuses: ["unconscious"], wounds: 0, special: false }), "remove");
  assert.equal(expiredConditionAction(), "remove");
});

test("a condition set with a time limit carries it as the effect's own duration", async () => {
  const created = [];
  const actor = {
    statuses: new Set(),
    effects: [],
    async createEmbeddedDocuments(_type, [data]) {
      created.push(data);
      this.statuses.add(data.statuses[0]);
      return [{ id: "e1" }];
    }
  };
  globalThis.CONFIG = { statusEffects: [{ id: "unconscious", name: "Unconscious", img: "x.svg" }] };
  try {
    await setConditionStatus(actor, "unconscious", true, {
      label: "Unconscious",
      duration: { value: 3, units: "rounds" },
      operationId: "op"
    });
    assert.deepEqual(created[0].duration, { value: 3, units: "rounds", expiry: null });
    assert.deepEqual(created[0].flags.spycraft2, { conditionOperation: "op", timed: true });
    actor.statuses.clear();
    await setConditionStatus(actor, "unconscious", true, { label: "Unconscious", operationId: "op2" });
    assert.equal(created[1].duration, undefined);
    assert.deepEqual(created[1].flags.spycraft2, { conditionOperation: "op2" });
  } finally {
    delete globalThis.CONFIG;
  }
});

test("world compendiums of actors and items are migrated; locked ones and system packs are left", async () => {
  const pack = (documentName, packageType, locked, docs, label) => ({
    documentName,
    locked,
    metadata: { packageType, label },
    getDocuments: async () => docs
  });
  const found = await worldCompendiumDocuments([
    pack("Actor", "world", false, ["a1", "a2"], "My NPCs"),
    pack("Item", "world", false, ["i1"], "My gear"),
    pack("Item", "world", true, ["i2"], "Archive"),
    pack("Item", "system", false, ["i3"], "Feats"),
    pack("Scene", "world", false, ["s1"], "Maps"),
    {
      documentName: "Item",
      locked: false,
      metadata: { packageType: "world", label: "Broken" },
      getDocuments: async () => Promise.reject(new Error("x"))
    }
  ]);
  assert.deepEqual(found.actors, ["a1", "a2"]);
  assert.deepEqual(found.items, ["i1"]);
  assert.deepEqual(found.skipped, ["Archive", "Broken"]);
  assert.deepEqual(await worldCompendiumDocuments(undefined), { actors: [], items: [], skipped: [] });
});
