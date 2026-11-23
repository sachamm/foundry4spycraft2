import test from "node:test";
import assert from "node:assert/strict";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import {
  reviewDamageLedgerPlan,
  damageLedgerEventPlan,
  damageLedgerSnapshot
} from "../module/rules/accumulated-damage.mjs";
import {
  pendingDamageSave,
  damageSaveContext,
  damageSaveMessageMatches,
  currentDamageSaveMessage,
  validateDamageSaveRoll
} from "../module/rules/damage-saves.mjs";
import { rollPendingDamageSave } from "../module/apps/damage-saves.mjs";
import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
let serial = 0,
  rolls = 0,
  responses = [],
  duringRoll = null,
  postFailure = "",
  updateFailure = "";
globalThis.Actor = class {};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.ChatMessage = { getSpeaker: () => ({}) };
globalThis.ui = { notifications: { warn: () => null } };
globalThis.Roll = class {
  constructor(formula, data) {
    this.formula = formula;
    this.data = data;
    this.dice = [{ total: 7 }];
    this.total = 7 + data.total;
    rolls++;
  }
  async evaluate() {
    duringRoll?.();
    return this;
  }
  async toMessage(data) {
    if (postFailure === "before") throw Error("Post failed");
    const id = "message" + ++serial,
      m = { ...data, id, uuid: "ChatMessage." + id, rolls: [this] };
    m.update = async patch => {
      for (const [path, value] of Object.entries(patch)) {
        const keys = path.split(".");
        let o = m;
        for (const key of keys.slice(0, -1)) o = o[key] ??= {};
        o[keys.at(-1)] = structuredClone(value);
      }
      return m;
    };
    game.messages.push(m);
    if (postFailure === "after") throw Error("Post response lost");
    return m;
  }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");
function actor(kind = "stress") {
  serial = 0;
  rolls = 0;
  responses = [];
  duringRoll = null;
  postFailure = "";
  updateFailure = "";
  globalThis.game = {
    ready: false,
    user: { isGM: true, id: "gc" },
    time: { worldTime: 12 },
    settings: { get: () => ({}) },
    i18n: { localize: s => s },
    spycraft2: {},
    messages: []
  };
  globalThis.foundry = {
    utils: { escapeHTML: String, randomID: () => `receipt${++serial}` },
    applications: { api: { DialogV2: { input: async () => responses.shift() ?? null } } }
  };
  const a = new SpycraftActor();
  Object.assign(a, {
    type: "agent",
    uuid: "Actor.save",
    isOwner: true,
    statuses: new Set(),
    flags: { spycraft2: { damageEvents: {} } },
    system: {
      stressThreshold: 12,
      subdualThreshold: 14,
      classLevels: { soldier: 1 },
      activeFeatNames: [],
      conditionContext: {},
      abilities: { wis: { value: 12, mod: 1 }, con: { value: 14, mod: 2 } },
      saves: { will: { total: 2 }, fort: { total: 3 } },
      actionDice: { value: 2 }
    }
  });
  const empty = { ledger: null, events: {} },
    base = reviewDamageLedgerPlan(
      empty,
      empty,
      { stress: 0, subdual: 0, note: "Actual totals", confirmed: true },
      "review",
      "gc",
      0
    );
  a.system.accumulatedDamage = base.ledger;
  const snap = damageLedgerSnapshot(a),
    p = damageLedgerEventPlan(
      a.system,
      snap,
      snap,
      { source: "hit-one", kind, newDamage: kind === "stress" ? 13 : 15, confirmed: true },
      "event1",
      0
    );
  a.system.accumulatedDamage = p.ledger;
  a.flags.spycraft2.damageEvents.event1 = p.record;
  a.update = async patch => {
    if (updateFailure === "before") throw Error("Bind failed");
    for (const [path, value] of Object.entries(patch)) {
      const keys = path.split(".");
      let o = a;
      for (const k of keys.slice(0, -1)) o = o[k] ??= {};
      o[keys.at(-1)] = structuredClone(value);
    }
    if (updateFailure === "after") throw Error("Bind response lost");
    return a;
  };
  return a;
}
test("the actual Actor save retains the frozen event DC, uses its normal modifier and binds exactly one original result", async () => {
  const a = actor(),
    before = structuredClone(a.system.accumulatedDamage),
    m = await rollPendingDamageSave(a, { confirmed: true });
  assert.equal(rolls, 1);
  assert.equal(m.flags.spycraft2.checkKind, "save");
  assert.equal(m.flags.spycraft2.checkId, "will");
  assert.equal(m.flags.spycraft2.rawTotal, 9);
  assert.equal(m.flags.spycraft2.damageSave.dc, 12);
  assert.match(m.flavor, /Damage event DC 12/);
  assert.equal(a.flags.spycraft2.damageEvents.event1.saveMessageId, m.id);
  assert.deepEqual(a.system.accumulatedDamage, before);
  assert.equal(a.system.actionDice.value, 2);
  assert.equal(m.flags.spycraft2.successConfirmed, null);
  const again = await rollPendingDamageSave(a, { confirmed: true });
  assert.equal(again.id, m.id);
  assert.equal(rolls, 1);
  let content = "";
  foundry.applications.api.DialogV2.input = async o => {
    content = o.content;
    return null;
  };
  assert.equal((await rollPendingDamageSave(a)).id, m.id);
  assert.match(content, /Current recorded result 9/);
  assert.equal(rolls, 1);
});
test("Fortitude keeps its actual conditional-save dialog and benefits while preserving controller metadata through that dialog", async () => {
  const a = actor("subdual");
  a.system.activeFeatNames = ["Swamp Training"];
  responses = [{ poison: true }];
  const m = await rollPendingDamageSave(a, { confirmed: true });
  assert.equal(m.flags.spycraft2.checkId, "fort");
  assert.equal(m.flags.spycraft2.rawTotal, 12);
  assert.equal(m.flags.spycraft2.terrainSave.adjustment, 2);
  assert.equal(m.flags.spycraft2.damageSave.eventId, "event1");
});
test("cancelling confirmation or the actual save context rolls nothing and leaves the event unbound", async () => {
  let a = actor();
  assert.equal(await rollPendingDamageSave(a), null);
  assert.equal(rolls, 0);
  assert.equal(a.flags.spycraft2.damageEvents.event1.saveMessageId, undefined);
  a = actor("subdual");
  a.system.activeFeatNames = ["Swamp Training"];
  assert.equal(await rollPendingDamageSave(a, { confirmed: true }), null);
  assert.equal(rolls, 0);
});
test("a changed event, save source, ownership or clock during RNG rejects before posting a stale result", async () => {
  for (const change of [
    a => a.system.saves.will.total++,
    a => (a.system.conditionContext.shakenGrade = 3),
    a => (a.isOwner = false),
    a => game.time.worldTime++,
    a => a.system.accumulatedDamage.stress++
  ]) {
    const a = actor();
    duringRoll = () => change(a);
    await assert.rejects(rollPendingDamageSave(a, { confirmed: true }), /changed/);
    assert.equal(game.messages.length, 0);
    assert.equal(a.flags.spycraft2.damageEvents.event1.saveMessageId, undefined);
  }
});
test("a failed post can retry, but a post response lost after commit or an interrupted binding reuses the original result without new RNG", async () => {
  let a = actor();
  postFailure = "before";
  await assert.rejects(rollPendingDamageSave(a, { confirmed: true }), /Post failed/);
  assert.equal(game.messages.length, 0);
  postFailure = "";
  await rollPendingDamageSave(a, { confirmed: true });
  assert.equal(rolls, 2);
  a = actor();
  postFailure = "after";
  const posted = await rollPendingDamageSave(a, { confirmed: true });
  assert.equal(rolls, 1);
  assert.equal(a.flags.spycraft2.damageEvents.event1.saveMessageId, posted.id);
  a = actor();
  updateFailure = "before";
  await assert.rejects(rollPendingDamageSave(a, { confirmed: true }), /Bind failed/);
  assert.equal(game.messages.length, 1);
  updateFailure = "";
  const recovered = await rollPendingDamageSave(a, { confirmed: true });
  assert.equal(recovered.id, game.messages[0].id);
  assert.equal(rolls, 1);
  a = actor();
  updateFailure = "after";
  const bound = await rollPendingDamageSave(a, { confirmed: true });
  assert.equal(bound.id, game.messages[0].id);
  assert.equal(rolls, 1);
});
test("pending order, malformed keys/DCs and stale metadata cannot produce an unrelated check", () => {
  const a = actor(),
    r = pendingDamageSave(a);
  assert.throws(() => pendingDamageSave(a, "second"), /recorded order/);
  const context = damageSaveContext(r, "receipt", 12);
  for (const patch of [{ key: "fort" }, { dc: 16 }, { contextConfirmed: false }])
    assert.throws(() => validateDamageSaveRoll(a, { ...context, ...patch }, "save", "will"), /does not match/);
  assert.throws(() => validateDamageSaveRoll(a, context, "attack", "will"), /does not match/);
  assert.throws(() => damageSaveContext(r, "a.b", 12));
  a.flags.spycraft2.damageEvents.event1.save.key = "ref";
  assert.throws(() => pendingDamageSave(a), /receipt/);
});
test("a bound save follows only genuine replacement links and preserves evidence through class rerolls", async () => {
  const a = actor(),
    m = await rollPendingDamageSave(a, { confirmed: true }),
    r = pendingDamageSave(a),
    replacement = {
      id: "replacement",
      uuid: "ChatMessage.replacement",
      flags: { spycraft2: { ...structuredClone(m.flags.spycraft2), rerollOf: m.uuid, superseded: null } }
    };
  m.flags.spycraft2.superseded = replacement.uuid;
  game.messages.push(replacement);
  assert.equal(currentDamageSaveMessage(a, r, game.messages).id, "replacement");
  assert.equal((await rollPendingDamageSave(a, { confirmed: true })).id, "replacement");
  assert.equal(rolls, 1);
  replacement.flags.spycraft2.rerollOf = "another";
  assert.throws(() => currentDamageSaveMessage(a, r, game.messages), /replacement/);
});
test("changed damage-save evidence cannot pass legacy evidence matching, and deleted/broken bound results are never rolled again", async () => {
  const a = actor(),
    m = await rollPendingDamageSave(a, { confirmed: true }),
    c = m.flags.spycraft2,
    e = rollEvidence(c),
    altered = structuredClone(c);
  altered.damageSave.dc++;
  assert.equal(rollEvidenceMatches(e, altered), false);
  const legacy = structuredClone(c);
  delete legacy.damageSave;
  assert.equal(rollEvidenceMatches(rollEvidence(legacy), c), false);
  assert.equal(rollEvidenceMatches(e, legacy), false);
  assert.equal(damageSaveMessageMatches(m, a, pendingDamageSave(a)), true);
  game.messages = [];
  await assert.rejects(rollPendingDamageSave(a, { confirmed: true }), /unavailable/);
  assert.equal(rolls, 1);
});
test("multiple unbound original results require GC review instead of choosing or rerolling, and unowned/noncharacter actors cannot roll", async () => {
  let a = actor(),
    m = await rollPendingDamageSave(a, { confirmed: true });
  delete a.flags.spycraft2.damageEvents.event1.saveMessageId;
  delete a.flags.spycraft2.damageEvents.event1.saveReceiptId;
  game.messages.push({ ...m, id: "duplicate", uuid: "ChatMessage.duplicate" });
  await assert.rejects(rollPendingDamageSave(a, { confirmed: true }), /Multiple original/);
  assert.equal(rolls, 1);
  a = actor();
  a.isOwner = false;
  assert.equal(await rollPendingDamageSave(a, { confirmed: true }), null);
  a.isOwner = true;
  a.type = "npc";
  assert.equal(await rollPendingDamageSave(a, { confirmed: true }), null);
});

test("concurrent requests bind one save, and a source change during the ordinary save context rejects before RNG", async () => {
  let a = actor();
  const [one, two] = await Promise.all([
    rollPendingDamageSave(a, { confirmed: true }),
    rollPendingDamageSave(a, { confirmed: true })
  ]);
  assert.equal(one.id, two.id);
  assert.equal(rolls, 1);
  a = actor("subdual");
  a.system.activeFeatNames = ["Swamp Training"];
  foundry.applications.api.DialogV2.input = async () => {
    a.system.saves.fort.total++;
    return { poison: true };
  };
  await assert.rejects(rollPendingDamageSave(a, { confirmed: true }), /context changed/);
  assert.equal(rolls, 0);
  assert.equal(game.messages.length, 0);
});
test("a pending save must still match its exact original damage calculation, not merely contain a plausible DC", () => {
  for (const change of [
    r => (r.save.dc = 13),
    r => (r.save.threshold = 100),
    r => r.total++,
    r => (r.save.tier = 3),
    r => (r.newDamage = 0)
  ]) {
    const a = actor();
    change(a.flags.spycraft2.damageEvents.event1);
    assert.throws(() => pendingDamageSave(a));
  }
});

test("finishing a damage save requires its correct confirmed result even without threat/error candidates", async () => {
  const a = actor(),
    m = await rollPendingDamageSave(a, { confirmed: true });
  assert.equal(await a.confirmCheckOutcome(m, { succeeded: true }), null);
  assert.equal(m.flags.spycraft2.successConfirmed, null);
  assert.equal(m.flags.spycraft2.resolved, undefined);
  responses = [{ outcome: "failure" }];
  await a.finishCheck(m);
  assert.equal(m.flags.spycraft2.successConfirmed, false);
  assert.equal(m.flags.spycraft2.resolved, true);
});
