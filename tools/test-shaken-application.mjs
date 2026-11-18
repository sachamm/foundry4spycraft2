import test from "node:test";
import assert from "node:assert/strict";
import { applyShaken, reviewShakenApplication } from "../module/apps/shaken-application.mjs";
import {
  shakenStateFromActor,
  shakenRules,
  getShakenApplicationReview,
  shakenApplicationSnapshot,
  shakenApplicationPlan,
  shakenSourceEntries
} from "../module/rules/shaken.mjs";
let serial = 0;
const merge = (a, b) =>
  Object.fromEntries(
    Object.entries({ ...a, ...b }).map(([k, v]) => [
      k,
      b && Object.hasOwn(b, k)
        ? v && typeof v === "object" && !Array.isArray(v)
          ? merge(a?.[k], v)
          : structuredClone(v)
        : structuredClone(v)
    ])
  );
function actor() {
  globalThis.game = {
    ready: false,
    user: { isGM: true, id: "gc" },
    time: { worldTime: 0 },
    settings: { get: () => ({}) },
    spycraft2: {}
  };
  globalThis.foundry = {
    utils: { randomID: () => `id${++serial}`, escapeHTML: String },
    applications: { api: { DialogV2: { input: async () => null } } }
  };
  const a = {
    uuid: "Actor.shaken",
    type: "agent",
    isOwner: true,
    system: {},
    flags: {},
    effects: [],
    foreign: [],
    fail: null,
    receiptFail: null,
    createHook: null,
    receiptHook: null
  };
  const effect = d => {
    const data = { changes: [], disabled: false, ...structuredClone(d), _id: d._id ?? `effect${++serial}` };
    return {
      id: data._id,
      uuid: a.uuid + ".ActiveEffect." + data._id,
      name: data.name,
      flags: data.flags ?? {},
      statuses: new Set(data.statuses),
      changes: data.changes,
      active: !data.disabled,
      toObject() {
        return {
          ...structuredClone(data),
          name: this.name,
          statuses: [...this.statuses],
          flags: structuredClone(this.flags),
          changes: structuredClone(this.changes),
          disabled: !this.active
        };
      }
    };
  };
  Object.defineProperty(a, "appliedEffects", { get: () => [...a.effects, ...a.foreign].filter(e => e.active) });
  Object.defineProperty(a, "statuses", { get: () => new Set(a.appliedEffects.flatMap(e => [...e.statuses])) });
  a.add = d => {
    const e = effect(d);
    a.effects.push(e);
    return e;
  };
  a.createEmbeddedDocuments = async (type, rows) => {
    if (a.fail === "createBefore") throw Error("creation rejected");
    const made = rows.map(a.add);
    await a.createHook?.(made);
    if (a.fail === "createAfter") throw Error("creation committed then failed");
    return made;
  };
  a.deleteEmbeddedDocuments = async (type, ids) => {
    if (a.fail === "deleteBefore") throw Error("deletion rejected");
    a.effects = a.effects.filter(e => !ids.includes(e.id));
    if (a.fail === "deleteAfter") throw Error("deletion committed then failed");
  };
  a.update = async patch => {
    await a.receiptHook?.(patch);
    if (a.receiptFail === "before") throw Error("receipt rejected");
    for (const [path, value] of Object.entries(patch)) {
      const keys = path.split(".");
      let o = a;
      for (const key of keys.slice(0, -1)) o = o[key] ??= {};
      o[keys.at(-1)] =
        value && typeof value === "object" && !Array.isArray(value)
          ? merge(o[keys.at(-1)], value)
          : structuredClone(value);
    }
    if (a.receiptFail === "after") {
      a.receiptFail = null;
      throw Error("receipt committed then failed");
    }
  };
  return a;
}
const event = (id = "event", grade = 2) => ({ id, grade, source: "Opponent ability " + id, confirmed: true });
const state = a => shakenStateFromActor(a);
const resolve = {
  disposition: "keep",
  confirmed: true,
  resolution: "Verified the actual source and retained its application"
};
test("separate incoming grades add without rewriting or expiring existing sources, including totals above IV", async () => {
  const a = actor();
  for (const [id, grade, total] of [
    ["a", 1, 1],
    ["b", 2, 3],
    ["c", 4, 7]
  ]) {
    const r = await applyShaken(a, event(id, grade));
    assert.equal(r.afterGrade, total);
    assert.equal(state(a).totalGrade, total);
    assert.equal(state(a).grade, Math.min(4, total));
    assert.equal(state(a).needsReview, false);
  }
  assert.equal(a.effects.length, 3);
  assert.deepEqual(
    a.effects.map(e => e.flags.spycraft2.shakenGrade),
    [1, 2, 4]
  );
  assert.ok(a.effects.every(e => !e.toObject().duration));
});
test("duplicate event references cannot add another grade or resurrect an ended source", async () => {
  const a = actor(),
    r = await applyShaken(a, event());
  assert.deepEqual(await applyShaken(a, event()), r);
  assert.equal(a.effects.length, 1);
  a.effects = [];
  assert.deepEqual(await applyShaken(a, event()), r);
  assert.equal(a.effects.length, 0);
  assert.equal(state(a).grade, 0);
  await assert.rejects(applyShaken(a, event("event", 3)), /another event/);
});
test("unconfirmed, malformed, unsafe and missing-source applications never create a condition", async () => {
  for (const patch of [
    { confirmed: false },
    { id: "__proto__" },
    { id: "bad.id" },
    { grade: 0 },
    { grade: 5 },
    { grade: 1.5 },
    { grade: "2" },
    { source: "" },
    { source: "x".repeat(501) }
  ]) {
    const a = actor();
    if (patch.confirmed === false) assert.equal(await applyShaken(a, { ...event(), ...patch }), null);
    else await assert.rejects(applyShaken(a, { ...event(), ...patch }));
    assert.equal(a.effects.length, 0);
  }
  const a = actor(),
    before = shakenApplicationSnapshot(a);
  assert.throws(
    () =>
      shakenApplicationPlan(
        { state: { needsReview: false, totalGrade: Number.MAX_SAFE_INTEGER } },
        { state: { needsReview: false, totalGrade: Number.MAX_SAFE_INTEGER } },
        event(),
        {},
        0
      ),
    /unsafe/
  );
  assert.throws(() => shakenApplicationPlan(before, {}, event()), /changed/);
});
test("rejected creation is harmless and a committed receipt error retains exactly one source", async () => {
  let a = actor();
  a.fail = "createBefore";
  await assert.rejects(applyShaken(a, event()), /creation rejected/);
  assert.equal(a.effects.length, 0);
  assert.equal(getShakenApplicationReview(a).needsReview, undefined);
  a = actor();
  a.receiptFail = "after";
  await applyShaken(a, event());
  assert.equal(state(a).grade, 2);
  assert.equal(a.effects.length, 1);
  assert.equal(getShakenApplicationReview(a).needsReview, undefined);
});
test("rejected receipts remove only the new exact source and prove a committed deletion error", async () => {
  for (const fail of [null, "deleteAfter"]) {
    const a = actor(),
      old = a.add({
        name: "Existing",
        statuses: ["shaken-1", "blind"],
        flags: { spycraft2: { shakenGrade: 1 }, other: { keep: true } },
        changes: [{ key: "system.foo", value: 2 }]
      });
    const before = old.toObject();
    a.receiptFail = "before";
    a.fail = fail;
    await assert.rejects(applyShaken(a, event()), /receipt rejected/);
    assert.equal(a.effects.length, 1);
    assert.deepEqual(a.effects[0].toObject(), before);
    assert.equal(state(a).grade, 1);
    assert.equal(state(a).needsReview, false);
  }
});
test("an unproved committed creation exposes a durable pending source receipt after local review state is lost", async () => {
  const a = actor();
  a.fail = "createAfter";
  await assert.rejects(applyShaken(a, event()), /GC review/);
  assert.equal(a.effects.length, 1);
  delete a.flags.spycraft2;
  game.spycraft2 = {};
  assert.equal(getShakenApplicationReview(a).needsReview, true);
  assert.equal(state(a).needsReview, true);
  assert.equal(shakenRules({ shakenState: state(a) }).needsReview, true);
  a.fail = null;
  await reviewShakenApplication(a, resolve);
  assert.equal(state(a).grade, 2);
  assert.equal(state(a).needsReview, false);
  assert.equal((await applyShaken(a, event())).state, "reviewed");
  assert.equal(a.effects.length, 1);
});
test("failed source deletion retains the actual condition and blocks reapplication until reviewed", async () => {
  const a = actor();
  a.receiptFail = "before";
  a.fail = "deleteBefore";
  await assert.rejects(applyShaken(a, event()), /GC review/);
  assert.equal(getShakenApplicationReview(a).needsReview, true);
  await assert.rejects(applyShaken(a, event("another")), /interrupted/);
  a.fail = null;
  a.receiptFail = null;
  await reviewShakenApplication(a, resolve);
  assert.equal(state(a).grade, 2);
  assert.equal(state(a).needsReview, false);
});
test("independent data attached to the new source is preserved for review rather than deleted during rollback", async () => {
  const a = actor();
  a.createHook = async ([e]) => {
    e.statuses.add("blind");
    e.flags.other = { keep: true };
    e.changes.push({ key: "system.foo", value: 3 });
  };
  await assert.rejects(applyShaken(a, event()), /GC review/);
  assert.equal(a.effects.length, 1);
  assert.equal(a.effects[0].statuses.has("blind"), true);
  assert.equal(a.effects[0].flags.other.keep, true);
  a.createHook = null;
  await reviewShakenApplication(a, resolve);
  assert.equal(state(a).grade, 2);
  assert.equal(a.effects[0].changes.length, 1);
});
test("GC cancellation requires ending the event’s active Shaken component while retaining independent source data", async () => {
  const a = actor();
  a.fail = "createAfter";
  await assert.rejects(applyShaken(a, event()));
  a.fail = null;
  await assert.rejects(reviewShakenApplication(a, { ...resolve, disposition: "cancel" }), /End this event/);
  a.effects[0].statuses = new Set(["blind"]);
  await reviewShakenApplication(a, { ...resolve, disposition: "cancel" });
  assert.equal(state(a).grade, 0);
  assert.equal(state(a).needsReview, false);
  assert.equal(a.effects[0].statuses.has("blind"), true);
  assert.equal((await applyShaken(a, event())).state, "cancelled");
});
test("review freezes role, source data and the held event, and requires an explicit bounded explanation", async () => {
  for (const change of ["role", "source", "review"]) {
    const a = actor();
    a.fail = "createAfter";
    await assert.rejects(applyShaken(a, event()));
    a.fail = null;
    foundry.applications.api.DialogV2.input = async () => {
      if (change === "role") game.user.isGM = false;
      if (change === "source") a.effects[0].name = "Changed while open";
      if (change === "review") a.flags.spycraft2.shakenApplicationReview.id = "other";
      return resolve;
    };
    await assert.rejects(reviewShakenApplication(a), /changed/);
  }
  const a = actor();
  a.fail = "createAfter";
  await assert.rejects(applyShaken(a, event()));
  a.fail = null;
  for (const patch of [
    { confirmed: false },
    { disposition: "other" },
    { resolution: "" },
    { resolution: "x".repeat(501) }
  ])
    await assert.rejects(reviewShakenApplication(a, { ...resolve, ...patch }), /Confirm/);
});
test("foreign item sources and disabled effects retain their data when a new direct source is applied", async () => {
  const a = actor(),
    foreign = {
      id: "foreign",
      uuid: "Item.effect",
      name: "Item source",
      active: true,
      statuses: new Set(["shaken-2"]),
      flags: { spycraft2: { shakenGrade: 2 } },
      toObject: () => ({ name: "Item source", statuses: ["shaken-2"] })
    };
  a.foreign = [foreign];
  const disabled = a.add({
    name: "Disabled",
    disabled: true,
    statuses: ["shaken-4"],
    flags: { spycraft2: { shakenGrade: 4 } }
  });
  const before = disabled.toObject();
  await applyShaken(a, event("new", 1));
  assert.equal(state(a).totalGrade, 3);
  assert.deepEqual(disabled.toObject(), before);
  assert.equal(foreign.statuses.has("shaken-2"), true);
});
test("known Construct NPC immunity prevents new Shaken sources; ordinary NPCs share the additive workflow", async () => {
  const a = actor();
  a.type = "npc";
  a.system.npcProfile = { enabled: true, qualities: [{ id: "construct" }] };
  await assert.rejects(applyShaken(a, event()), /Constructs/);
  assert.equal(a.effects.length, 0);
  a.system.npcProfile.qualities = [];
  await applyShaken(a, event());
  assert.equal(state(a).grade, 2);
});
test("application receipts identify their exact source; duplicated event tags cannot silently add another grade", async () => {
  const a = actor();
  await applyShaken(a, event());
  const copy = a.effects[0].toObject();
  delete copy._id;
  a.add(copy);
  assert.equal(state(a).needsReview, true);
  await assert.rejects(reviewShakenApplication(a, resolve), /duplicated/);
  assert.equal(a.effects.length, 2);
  assert.equal(a.flags.spycraft2.shakenApplications.event.state, "applied");
});
test("a committed GC receipt is proved under nested merging while retaining independent history metadata", async () => {
  const a = actor();
  await applyShaken(a, event());
  a.flags.spycraft2.shakenApplications.event.effectId = "unproved";
  a.flags.spycraft2.shakenApplications.event.independentNote = "Retain this note";
  assert.equal(state(a).needsReview, true);
  a.receiptFail = "after";
  const r = await reviewShakenApplication(a, resolve);
  assert.equal(r.state, "reviewed");
  assert.equal(state(a).needsReview, false);
  assert.equal(a.flags.spycraft2.shakenApplications.event.effectId, a.effects[0].id);
  assert.equal(a.flags.spycraft2.shakenApplications.event.independentNote, "Retain this note");
});
test("ended owned sources remain listed for corrections while transferred sources retain their own editing permission", async () => {
  const a = actor();
  await applyShaken(a, event());
  a.effects[0].active = false;
  a.effects[0].isOwner = true;
  const foreign = {
    id: "item",
    uuid: "Item.source",
    name: "Transferred source",
    active: true,
    isOwner: false,
    statuses: new Set(["shaken-1"])
  };
  a.foreign = [foreign];
  const entries = shakenSourceEntries(a);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].active, false);
  assert.equal(entries[0].editable, true);
  assert.equal(entries[1].active, true);
  assert.equal(entries[1].editable, false);
  assert.equal(state(a).grade, 1);
});
test("direct application records explicit own-action provenance without treating legacy unknown causes as incoming effects", async () => {
  for (const selfInflicted of [false, true, undefined]) {
    const a = actor(),
      r = await applyShaken(a, { ...event(), ...(selfInflicted !== undefined ? { selfInflicted } : {}) });
    assert.equal(state(a).sources[0].selfInflicted, selfInflicted ?? null);
    assert.equal(r.selfInflicted, selfInflicted ?? null);
    assert.equal(a.effects[0].flags.spycraft2.shakenSelfInflicted, selfInflicted);
  }
  const a = actor();
  await assert.rejects(applyShaken(a, { ...event(), selfInflicted: "false" }), /own action/);
  assert.equal(a.effects.length, 0);
});
