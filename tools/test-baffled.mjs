import test from "node:test";
import assert from "node:assert/strict";

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
  utils: { escapeHTML: s => s, randomID: () => String(++sequence) },
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

import { applyBaffled, reviewBaffledApplication } from "../module/apps/baffled-application.mjs";
import { getBaffledReview } from "../module/rules/baffled.mjs";
CONFIG.statusEffects.push({ id: "baffled", name: "Baffled" }, { id: "incompetent", name: "Incompetent" });
game.time = { worldTime: 0 };
function actor(data = []) {
  const a = makeActor(data);
  a.flags = { spycraft2: {} };
  a.system.baffledApplicationReview = {};
  game.spycraft2 = {};
  a.update = async patch => {
    await a.beforeReceipt?.();
    if (a.receiptFail === "before") throw Error("receipt failed");
    for (const [path, value] of Object.entries(patch)) {
      let obj = a;
      const keys = path.split(".");
      for (const key of keys.slice(0, -1)) obj = obj[key] ??= {};
      obj[keys.at(-1)] = structuredClone(value);
    }
    await a.receiptHook?.();
    if (a.receiptFail === "after") {
      a.receiptFail = null;
      throw Error("committed receipt error");
    }
  };
  return a;
}
const event = (id = "first") => ({ id, source: "Opponent ability " + id, confirmed: true });
const combined = {
  _id: "combined",
  name: "Combined source",
  statuses: ["baffled", "bound"],
  changes: [{ key: "system.misc.defense", value: "1" }],
  duration: { rounds: 4, startRound: 2 },
  flags: { other: { keep: 9 } }
};
test("first incoming effect applies Baffled; second replaces it with Incompetent; a later Baffled can coexist", async () => {
  const a = actor();
  await applyBaffled(a, event());
  assert.deepEqual([...a.statuses], ["baffled"]);
  await applyBaffled(a, event("second"));
  assert.deepEqual([...a.statuses], ["incompetent"]);
  await applyBaffled(a, event("third"));
  assert.deepEqual([...a.statuses].sort(), ["baffled", "incompetent"]);
  await applyBaffled(a, event("fourth"));
  assert.deepEqual([...a.statuses], ["incompetent"]);
  assert.equal(Object.keys(a.flags.spycraft2.baffledApplications).length, 4);
});
test("escalation preserves unrelated statuses, changes, duration, metadata and foreign sources", async () => {
  const a = actor([combined]);
  await applyBaffled(a, event());
  assert.deepEqual(a.effects.find(e => e.id === "combined").toObject(), { ...combined, statuses: ["bound"] });
  assert.equal(a.statuses.has("incompetent"), true);
  const b = actor([combined]);
  b.foreign = [{ id: "foreign", active: true, statuses: new Set(["baffled"]) }];
  b.refresh();
  await assert.rejects(applyBaffled(b, event()), /item or another source/);
  assert.equal(b.calls.length, 0);
  assert.equal(b.statuses.has("baffled"), true);
});
test("references deduplicate completed events and reject source reuse; concurrent new requests cannot escalate a stale state", async () => {
  const a = actor();
  const result = await applyBaffled(a, event());
  assert.deepEqual(await applyBaffled(a, event()), result);
  assert.equal(a.effects.length, 1);
  await assert.rejects(applyBaffled(a, { ...event(), source: "other" }), /another source/);
  const b = actor(),
    results = await Promise.allSettled([applyBaffled(b, event()), applyBaffled(b, event("second"))]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(b.statuses.has("baffled"), true);
  assert.equal(b.statuses.has("incompetent"), false);
});
test("unconfirmed/invalid events never mutate; a stale dialog cannot affect replacement sources", async () => {
  const a = actor();
  assert.equal(await applyBaffled(a, { ...event(), confirmed: false }), null);
  for (const id of ["", "a.b", "constructor", "__proto__"])
    await assert.rejects(applyBaffled(a, event(id)), /reference/);
  assert.equal(a.calls.length, 0);
  const b = actor([combined]),
    original = foundry.applications.api.DialogV2.input;
  try {
    foundry.applications.api.DialogV2.input = async () => {
      b.effects[0].origin = "Item.new";
      return event();
    };
    await assert.rejects(applyBaffled(b), /sources changed/);
    assert.equal(b.calls.length, 0);
  } finally {
    foundry.applications.api.DialogV2.input = original;
  }
});
test("a rejected event receipt restores both simple and compound original effects; a committed receipt never rolls back", async () => {
  for (const data of [[], [combined], [{ _id: "simple", name: "Baffled", statuses: ["baffled"] }]]) {
    const a = actor(data),
      before = a.effects.map(e => e.toObject());
    a.receiptFail = "before";
    await assert.rejects(applyBaffled(a, event()), /receipt failed/);
    assert.deepEqual(
      a.effects.map(e => e.toObject()),
      before
    );
    assert.equal(getBaffledReview(a).needsReview, undefined);
    a.receiptFail = null;
    await applyBaffled(a, event());
    assert.ok(a.flags.spycraft2.baffledApplications.first);
  }
  const a = actor([combined]);
  a.receiptFail = "after";
  assert.equal((await applyBaffled(a, event())).state, "applied");
  assert.equal(a.statuses.has("incompetent"), true);
  assert.equal(a.statuses.has("baffled"), false);
});
test("failed source mutations restore their original data without applying an escalation", async () => {
  for (const failure of ["createBefore", "createAfter", "updateBefore", "updateAfter", "deleteBefore", "deleteAfter"]) {
    const a = actor(
      failure.startsWith("delete") ? [{ _id: "simple", name: "Baffled", statuses: ["baffled"] }] : [combined]
    );
    a.fail = failure;
    const before = a.effects.map(e => e.toObject());
    await assert.rejects(applyBaffled(a, event()));
    assert.deepEqual(
      a.effects.map(e => e.toObject()),
      before,
      failure
    );
    assert.equal(a.statuses.has("incompetent"), false, failure);
  }
});
test("committed rollback deletion errors are reconciled; independent edits on original sources survive rollback", async () => {
  const a = actor([combined]);
  a.receiptFail = "before";
  a.hook = async kind => {
    if (kind === "create") {
      a.effects.find(e => e.id === "combined").name = "Independent name";
      a.fail = "deleteAfter";
    }
  };
  await assert.rejects(applyBaffled(a, event()), /receipt failed/);
  assert.equal(a.effects[0].name, "Independent name");
  assert.equal(a.statuses.has("baffled"), true);
  assert.equal(a.statuses.has("incompetent"), false);
  assert.equal(getBaffledReview(a).needsReview, undefined);
});
test("uncertain rollback holds the event for GC review, preserves changed effects, and blocks replay", async () => {
  const a = actor([combined]);
  a.receiptFail = "before";
  a.beforeReceipt = async () => {
    a.effects.find(e => e.statuses.has("incompetent"))?.statuses.add("blind");
    a.refresh();
  };
  await assert.rejects(applyBaffled(a, event()), /GC review/);
  assert.equal(getBaffledReview(a).needsReview, true);
  assert.equal(
    a.effects.some(e => e.statuses.has("blind")),
    true
  );
  await assert.rejects(applyBaffled(a, event("second")), /review/);
  assert.equal(a.flags.spycraft2.baffledApplications, undefined);
  a.receiptFail = null;
  a.beforeReceipt = null;
  const r = await reviewBaffledApplication(a, {
    disposition: "keep",
    resolution: "Reviewed actual sources",
    confirmed: true
  });
  assert.equal(r.state, "reviewed");
  assert.equal(getBaffledReview(a).needsReview, false);
  assert.equal((await applyBaffled(a, event())).state, "reviewed");
  assert.equal(a.effects.length, 2);
});
test("review cancellation records the event without altering effects, survives committed errors and suppresses stale local fallback", async () => {
  const a = actor(),
    record = {
      id: "first",
      source: event().source,
      before: { baffled: false, incompetent: false },
      after: { baffled: true, incompetent: false },
      state: "applied"
    };
  game.spycraft2 = {
    pendingBaffledReviews: { [a.uuid]: { id: "first", source: record.source, record, needsReview: true } }
  };
  a.receiptFail = "after";
  const r = await reviewBaffledApplication(a, {
    disposition: "cancel",
    resolution: "No application remains",
    confirmed: true
  });
  assert.equal(r.state, "cancelled");
  assert.equal(a.effects.length, 0);
  assert.equal((await applyBaffled(a, event())).state, "cancelled");
  game.spycraft2.pendingBaffledReviews[a.uuid] = { id: "first", needsReview: true };
  assert.equal(getBaffledReview(a).needsReview, false);
});
test("review rechecks GC role, source identity and held event after the dialog", async () => {
  for (const change of ["role", "source", "review"]) {
    const a = actor([combined]),
      record = { id: "first", source: event().source };
    a.flags.spycraft2.baffledApplicationReview = { id: "first", source: record.source, record, needsReview: true };
    const original = foundry.applications.api.DialogV2.input;
    try {
      game.user.isGM = true;
      foundry.applications.api.DialogV2.input = async () => {
        if (change === "role") game.user.isGM = false;
        if (change === "source") a.effects[0].origin = "new";
        if (change === "review") a.flags.spycraft2.baffledApplicationReview.id = "replacement";
        return { disposition: "keep", resolution: "Reviewed", confirmed: true };
      };
      await assert.rejects(reviewBaffledApplication(a), /changed/);
      assert.equal(a.flags.spycraft2.baffledApplications, undefined);
    } finally {
      game.user.isGM = true;
      foundry.applications.api.DialogV2.input = original;
    }
  }
});

import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { resolveKnowledgeCheck } from "../module/rules/knowledge.mjs";
const { SpycraftActor } = await import("../module/documents/actor.mjs");
test("an unresolved event blocks actual skill/Knowledge resolution and Baffled resistance saves, while unrelated saves remain available", async () => {
  const system = computeAgent(
    {
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
      progression: [],
      baffledApplicationReview: { needsReview: true }
    },
    [],
    cfg
  );
  system.baffledApplicationReview = { needsReview: true };
  const check = cfg.skills.athletics.checks[0];
  assert.match(
    resolveSkillCheck(system, "athletics", check, { ability: check.attributes[0] }).blockedReason,
    /interrupted Baffled/
  );
  assert.match(resolveKnowledgeCheck(system, { skill: "search" }).blockedReason, /interrupted Baffled/);
  const a = actor();
  Object.setPrototypeOf(a, SpycraftActor.prototype);
  a.flags.spycraft2.baffledApplicationReview = { id: "hold", needsReview: true };
  a.system = system;
  a.rollCheck = async () => ({ rolled: true });
  CONFIG.SPYCRAFT = cfg;
  assert.equal(await a.rollSave("will", { resistingBaffled: true }), null);
  assert.equal((await a.rollSave("will", {})).rolled, true);
});
