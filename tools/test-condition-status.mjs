import test from "node:test";
import assert from "node:assert/strict";
import { setConditionStatus } from "../module/rules/condition-status.mjs";
globalThis.CONFIG = {
  SPYCRAFT: {},
  statusEffects: [
    { id: "sickened", name: "Sickened", img: "icons/svg/downgrade.svg" },
    { id: "bound", name: "Bound" }
  ]
};
globalThis.game = { user: { isGM: true }, i18n: { localize: s => s } };
globalThis.Actor = class {};
globalThis.ui = { notifications: { warn: () => null } };
globalThis.foundry = {
  utils: { randomID: () => String(++sequence) },
  applications: { api: { DialogV2: { input: async () => null } } }
};
let sequence = 0;
function makeActor(data = []) {
  const a = {
    uuid: "Actor.condition",
    type: "agent",
    isOwner: true,
    effects: [],
    foreign: [],
    calls: [],
    fail: null,
    hook: null,
    system: { conditionContext: {} }
  };
  const effect = d => ({
    ...structuredClone(d),
    id: d._id,
    statuses: new Set(d.statuses),
    active: !d.disabled,
    changes: d.changes ?? [],
    toObject() {
      return { ...structuredClone(d), statuses: [...this.statuses] };
    }
  });
  a.refresh = () => {
    a.statuses = new Set([...a.effects, ...a.foreign].filter(e => e.active).flatMap(e => [...e.statuses]));
    a.system.conditionContext = { sickened: a.statuses.has("sickened"), bound: a.statuses.has("bound") };
  };
  a.effects = data.map(effect);
  Object.defineProperty(a, "appliedEffects", { get: () => [...a.effects, ...a.foreign].filter(e => e.active) });
  a.createEmbeddedDocuments = async (type, rows) => {
    a.calls.push(["create", type, structuredClone(rows)]);
    if (a.fail === "createBefore") throw Error("create failed");
    const made = rows.map(d => effect({ ...d, _id: d._id ?? "new" + ++sequence }));
    a.effects.push(...made);
    a.refresh();
    await a.hook?.("create");
    if (a.fail === "createAfter") throw Error("create committed then failed");
    return made;
  };
  a.updateEmbeddedDocuments = async (type, rows) => {
    a.calls.push(["update", type, structuredClone(rows)]);
    if (a.fail === "updateBefore" || (a.fail === "rollbackUpdate" && rows.some(r => r.statuses.includes("sickened"))))
      throw Error("update failed");
    for (const row of rows) {
      const e = a.effects.find(e => e.id === row._id);
      if (!e) throw Error("missing effect");
      e.statuses = new Set(row.statuses);
    }
    a.refresh();
    await a.hook?.("update");
    if (a.fail === "updateAfter") {
      a.fail = null;
      throw Error("update committed then failed");
    }
    return rows;
  };
  a.deleteEmbeddedDocuments = async (type, ids) => {
    a.calls.push(["delete", type, [...ids]]);
    if (["deleteBefore", "rollbackUpdate"].includes(a.fail)) throw Error("delete failed");
    a.effects = a.effects.filter(e => !ids.includes(e.id));
    a.refresh();
    await a.hook?.("delete");
    if (a.fail === "deleteAfter") {
      a.fail = null;
      throw Error("delete committed then failed");
    }
    return ids;
  };
  a.refresh();
  return a;
}
const combined = {
    _id: "combined",
    name: "Independent sources",
    statuses: ["sickened", "bound"],
    flags: { other: { preserve: 7 } },
    duration: { rounds: 5, startRound: 2 },
    changes: []
  },
  single = {
    _id: "single",
    name: "Sickened",
    statuses: ["sickened"],
    flags: { other: { preserve: "source" } },
    duration: { seconds: 600 }
  };
test("clearing one condition from a combined effect preserves every other status, duration and unrelated field", async () => {
  const a = makeActor([combined]),
    p = await setConditionStatus(a, "sickened", false);
  assert.equal(p.active, false);
  assert.equal(a.statuses.has("bound"), true);
  assert.equal(a.statuses.has("sickened"), false);
  assert.deepEqual(a.effects[0].toObject(), { ...combined, statuses: ["bound"] });
  assert.equal(
    a.calls.some(c => c[0] === "delete"),
    false
  );
});
test("a single condition carrying independent stat changes loses only its status; empty ordinary status-only effects can be removed", async () => {
  const data = { ...single, _id: "with-bonus", changes: [{ key: "system.misc.defense", mode: 2, value: "1" }] },
    a = makeActor([data, single]);
  await setConditionStatus(a, "sickened", false);
  assert.equal(a.effects.length, 1);
  assert.deepEqual(a.effects[0].toObject(), { ...data, statuses: [] });
  assert.deepEqual(a.effects[0].changes, data.changes);
});
test("foreign item sources block clearing before mutation, existing conditions are idempotent, and unrelated/disabled effects are untouched", async () => {
  const a = makeActor([single]);
  a.foreign = [{ id: "item-source", active: true, statuses: new Set(["sickened"]) }];
  a.refresh();
  await assert.rejects(setConditionStatus(a, "sickened", false), /item or another source/);
  assert.equal(a.calls.length, 0);
  assert.deepEqual(await setConditionStatus(a, "sickened", true), { active: true, changed: false });
  const b = makeActor([{ ...single, disabled: true }]);
  await setConditionStatus(b, "sickened", true);
  assert.equal(b.effects[0].active, false);
  assert.equal(b.effects.length, 2);
  await setConditionStatus(b, "sickened", false);
  assert.equal(b.effects.length, 1);
  assert.equal(b.effects[0].active, false);
});
test("a failed compound update or later single-effect deletion restores precise original status and source data", async () => {
  for (const failure of ["updateAfter", "deleteBefore", "deleteAfter"]) {
    const a = makeActor([combined, single]),
      before = a.effects.map(e => e.toObject());
    a.fail = failure;
    await assert.rejects(setConditionStatus(a, "sickened", false));
    assert.deepEqual(
      a.effects.map(e => e.toObject()).sort((a, b) => a._id.localeCompare(b._id)),
      before.sort((a, b) => a._id.localeCompare(b._id))
    );
    assert.equal(a.statuses.has("sickened"), true);
  }
});
test("rollback failures and newer external status changes remain visible for review instead of erasing unrelated changes", async () => {
  const a = makeActor([combined, single]);
  a.fail = "rollbackUpdate";
  await assert.rejects(setConditionStatus(a, "sickened", false), /fully restored/);
  assert.equal(
    a.effects.some(e => e.id === "single"),
    true
  );
  const b = makeActor([combined, single]);
  b.hook = async kind => {
    if (kind === "update") {
      b.effects[0].statuses.add("unconscious");
      b.refresh();
      b.fail = "deleteBefore";
    }
  };
  await assert.rejects(setConditionStatus(b, "sickened", false), /fully restored/);
  assert.equal(b.effects[0].statuses.has("unconscious"), true);
});
test("failed condition creation cleans up only its own tagged effect, including failure after the write committed", async () => {
  const a = makeActor();
  a.fail = "createAfter";
  a.hook = async kind => {
    if (kind !== "create") return;
    a.effects.push({ _id: "external", id: "external", active: true, statuses: new Set(["bound"]), changes: [] });
    a.refresh();
  };
  await assert.rejects(setConditionStatus(a, "sickened", true), /create committed/);
  assert.equal(a.statuses.has("sickened"), false);
  assert.equal(a.statuses.has("bound"), true);
  assert.equal(a.effects.length, 1);
  await assert.rejects(setConditionStatus(a, "sickened", "true"), /state/);
});
const { SpycraftActor } = await import("../module/documents/actor.mjs");
test("the actual reviewed-condition API serializes duplicate apply/clear requests, requires confirmation and retains read-only ownership boundaries", async () => {
  const a = makeActor();
  Object.setPrototypeOf(a, SpycraftActor.prototype);
  assert.equal(await a.setReviewedCondition("sickened", { active: true }), null);
  await Promise.all([
    a.setSickened({ active: true, confirmed: true }),
    a.setSickened({ active: true, confirmed: true })
  ]);
  assert.equal(a.effects.length, 1);
  assert.equal(a.statuses.has("sickened"), true);
  await a.setReviewedCondition("sickened", { active: false, confirmed: true });
  assert.equal(a.effects.length, 0);
  a.isOwner = false;
  assert.equal(await a.setSickened({ active: true, confirmed: true }), null);
  assert.equal(a.effects.length, 0);
});

test("sensory aliases clear together from compound sources while preserving independent statuses, metadata and changes", async () => {
  const a = makeActor([
    {
      _id: "vision",
      name: "Sensory source",
      statuses: ["blind", "blinded", "bound"],
      duration: { rounds: 4 },
      changes: [{ key: "system.misc.defense", value: "2" }],
      flags: { other: { keep: true } }
    },
    { _id: "extra", name: "Other blindness", statuses: ["blinded"] }
  ]);
  const before = a.effects[0].toObject();
  await setConditionStatus(a, "blind", true, { aliases: ["blinded"] });
  assert.equal(a.effects.length, 2);
  await setConditionStatus(a, "blind", false, { aliases: ["blinded"] });
  assert.equal(a.effects.length, 1);
  assert.deepEqual([...a.effects[0].statuses], ["bound"]);
  assert.deepEqual(a.effects[0].toObject(), { ...before, statuses: ["bound"] });
});
test("reviewed sensory controls clear aliases, preserve continuing foreign sources, and create the canonical configured status", async () => {
  CONFIG.statusEffects.push({ id: "blind", name: "Blinded" }, { id: "deaf", name: "Deafened" });
  const a = makeActor([{ _id: "old", name: "Old deafness", statuses: ["deafened"] }]);
  Object.setPrototypeOf(a, SpycraftActor.prototype);
  await a.setReviewedCondition("deafened", { active: false, confirmed: true });
  assert.equal(a.effects.length, 0);
  await a.setReviewedCondition("blinded", { active: true, confirmed: true });
  assert.equal(a.statuses.has("blind"), true);
  await a.setReviewedCondition("blinded", { active: false, confirmed: true });
  assert.equal(a.effects.length, 0);
  a.foreign = [{ id: "foreign", active: true, statuses: new Set(["blinded"]) }];
  a.refresh();
  await assert.rejects(a.setReviewedCondition("blinded", { active: false, confirmed: true }), /supplied by an item/);
  assert.equal(a.foreign.length, 1);
});

import { sleepingSourceSnapshot, sleepWakePlan } from "../module/rules/sleeping.mjs";
const sleepData = {
  _id: "sleep-source",
  name: "Sleep",
  statuses: ["sleep", "asleep", "sickened", "unconscious"],
  duration: { rounds: 4, startRound: 2 },
  changes: [{ key: "system.misc.defense", value: "1" }],
  flags: { other: { keep: 1 } }
};
const sleeper = () => {
  const a = makeActor([sleepData]);
  Object.setPrototypeOf(a, SpycraftActor.prototype);
  return a;
};
test("wake snapshots freeze only actual sleep sources, ignore unrelated metadata/statuses and reject unknown or new causes", () => {
  const a = sleeper(),
    event = sleepingSourceSnapshot(a);
  assert.equal(event.state, "sleeping");
  a.effects[0].statuses.add("bound");
  assert.deepEqual(sleepingSourceSnapshot(a), event);
  for (const changed of [
    { ...sleepData, _id: "new" },
    { ...sleepData, duration: { rounds: 4, startRound: 3 } },
    { ...sleepData, origin: "Item.new" },
    { ...sleepData, flags: { spycraft2: { conditionOperation: "new" } } }
  ]) {
    const b = makeActor([changed]);
    assert.equal(sleepWakePlan(sleepingSourceSnapshot(b), event, { cause: "damage", confirmed: true }).blocked, true);
  }
  const unknown = { system: { conditionContext: { sleeping: true } }, effects: [], statuses: new Set() };
  assert.equal(sleepingSourceSnapshot(unknown).state, "unknown");
  assert.equal(
    sleepWakePlan(sleepingSourceSnapshot(a), sleepingSourceSnapshot(unknown), { cause: "newTouch", confirmed: true })
      .blocked,
    true
  );
});
test("new-touch and damage waking clear only Sleep aliases and preserve unconsciousness, sickness, changes and metadata", async () => {
  for (const cause of ["newTouch", "damage"]) {
    const a = sleeper(),
      before = a.effects[0].toObject();
    const p = await a.wakeFromSleep({ cause, confirmed: true });
    assert.equal(p.changed, true);
    assert.equal(a.statuses.has("sleep"), false);
    assert.equal(a.statuses.has("asleep"), false);
    assert.equal(a.statuses.has("unconscious"), true);
    assert.equal(a.statuses.has("sickened"), true);
    assert.deepEqual(a.effects[0].toObject(), { ...before, statuses: ["sickened", "unconscious"] });
    assert.equal((await a.wakeFromSleep({ cause, confirmed: true })).changed, false);
  }
  const a = sleeper();
  assert.equal(await a.wakeFromSleep({ cause: "damage" }), null);
  assert.equal(await a.wakeFromSleep({ cause: "ongoingTouch", confirmed: true }), null);
  a.isOwner = false;
  assert.equal(await a.wakeFromSleep({ cause: "damage", confirmed: true }), null);
});
test("an open wake dialog cannot clear a replacement sleep and continuing item sleep prevents any partial clearing", async () => {
  const a = sleeper(),
    original = foundry.applications.api.DialogV2.input;
  try {
    foundry.applications.api.DialogV2.input = async () => {
      a.effects[0].id = "new-source";
      return { cause: "newTouch", confirmed: true };
    };
    await assert.rejects(a.wakeFromSleep(), /sources changed/);
    assert.equal(a.statuses.has("sleep"), true);
  } finally {
    foundry.applications.api.DialogV2.input = original;
  }
  const b = sleeper();
  b.foreign = [{ id: "itemSleep", active: true, statuses: new Set(["sleep"]) }];
  b.refresh();
  await assert.rejects(b.wakeFromSleep({ cause: "damage", confirmed: true }), /supplied by an item/);
  assert.equal(b.calls.length, 0);
  assert.equal(b.statuses.has("sleep"), true);
});
function awarenessMessage(a, event) {
  const m = {
    id: "awareness",
    uuid: "ChatMessage.awareness",
    blind: true,
    flags: {
      spycraft2: {
        actorUuid: a.uuid,
        checkKind: "skill",
        skillKey: "notice",
        checkId: "awareness",
        checkMethod: "roll",
        rawTotal: 12,
        effectiveTotal: 12,
        naturalDie: 12,
        threat: 20,
        error: 1,
        cap: 30,
        sleepSnapshot: event
      }
    }
  };
  m.update = async patch => {
    if (m.fail === "before") throw Error("message failed");
    if (patch["flags.spycraft2"]) m.flags.spycraft2 = structuredClone(patch["flags.spycraft2"]);
    if (patch["flags.spycraft2.sleepWake"])
      m.flags.spycraft2.sleepWake = structuredClone(patch["flags.spycraft2.sleepWake"]);
    if (m.fail === "after") {
      m.fail = null;
      throw Error("committed message error");
    }
  };
  a.syncRollErrorEffect = async () => null;
  return m;
}
test("only confirmed successful Awareness wakes: failure, another check and an old awake roll cannot clear Sleep", async () => {
  for (const variant of ["failure", "other", "awake", "success"]) {
    const a = sleeper(),
      event = variant === "awake" ? { state: "awake", signature: null } : sleepingSourceSnapshot(a),
      m = awarenessMessage(a, event);
    if (variant === "other") m.flags.spycraft2.checkId = "other";
    await a.confirmCheckOutcome(m, { succeeded: variant !== "failure" });
    assert.equal(a.statuses.has("sleep"), variant !== "success", variant);
    if (variant === "success") assert.equal(m.flags.spycraft2.sleepWake.state, "awake");
  }
});
test("failed or committed outcome writes retain Sleep until an explicit retry, and failed condition removal retains the confirmed outcome for retry", async () => {
  for (const fail of ["before", "after"]) {
    const a = sleeper(),
      m = awarenessMessage(a, sleepingSourceSnapshot(a));
    m.fail = fail;
    await assert.rejects(a.confirmCheckOutcome(m, { succeeded: true }), /message/);
    assert.equal(a.statuses.has("sleep"), true);
    m.fail = null;
    await a.confirmCheckOutcome(m, { succeeded: true });
    assert.equal(a.statuses.has("sleep"), false);
  }
  const a = sleeper(),
    m = awarenessMessage(a, sleepingSourceSnapshot(a));
  a.fail = "updateBefore";
  await a.confirmCheckOutcome(m, { succeeded: true });
  assert.equal(m.flags.spycraft2.successConfirmed, true);
  assert.equal(a.statuses.has("sleep"), true);
  a.fail = null;
  await a.confirmCheckOutcome(m, { succeeded: true });
  assert.equal(a.statuses.has("sleep"), false);
});
test("an earlier successful Awareness cannot clear newly applied Sleep, and waking never refunds or consumes a resource", async () => {
  const a = sleeper(),
    m = awarenessMessage(a, sleepingSourceSnapshot(a));
  a.system.actionDice = { value: 3 };
  a.system.vitality = { value: 7 };
  await a.confirmCheckOutcome(m, { succeeded: true });
  a.effects[0].statuses.add("sleep");
  a.effects[0].id = "newSleep";
  a.refresh();
  await a.confirmCheckOutcome(m, { succeeded: true });
  assert.equal(a.statuses.has("sleep"), true);
  assert.equal(a.system.actionDice.value, 3);
  assert.equal(a.system.vitality.value, 7);
});
