import test from "node:test";
import assert from "node:assert/strict";
import { npcDefensePlan, npcDefenseResult } from "../module/rules/gc/npc-defense.mjs";
import { activeDefenseBoost } from "../module/rules/health.mjs";
import { boostNpcDefense, recoverNpcDefense } from "../module/apps/gc/npc-defense.mjs";
import { applyUndo } from "../module/apps/undo.mjs";

let settings, values, rng, serial, applyFailure, saveFailure, warnings, afterRoll;
function patch(doc, update) {
  for (const [path, value] of Object.entries(update)) {
    const keys = path.split(".");
    let at = doc;
    for (const key of keys.slice(0, -1)) at = at[key] ??= {};
    if (keys.at(-1).startsWith("-=")) delete at[keys.at(-1).slice(2)];
    else if (keys.at(-1).startsWith("==")) at[keys.at(-1).slice(2)] = structuredClone(value);
    else at[keys.at(-1)] = structuredClone(value);
  }
}
function setup() {
  settings = {
    usagePeriods: { session: "s1", scene: "scene1" },
    gcActionDice: { session: "s1", value: 5 },
    sceneState: { scene: "scene1", dramatic: false }
  };
  values = [3];
  rng = 0;
  serial = 0;
  applyFailure = "";
  saveFailure = false;
  warnings = [];
  afterRoll = null;
  const actor = {
    uuid: "Actor.npc",
    id: "npc",
    name: "NPC",
    type: "npc",
    isOwner: true,
    effects: [],
    flags: {},
    system: {
      npcType: "standard",
      npcProfile: { enabled: false },
      abilities: {},
      wounds: { value: 0 },
      defenseBoost: null
    },
    toObject() {
      return structuredClone({ system: this.system, flags: this.flags });
    },
    async update(change) {
      if (applyFailure === "before" && Object.hasOwn(change, "system.defenseBoost")) throw Error("Effect write failed");
      patch(this, change);
      if (applyFailure === "after" && Object.hasOwn(change, "system.defenseBoost")) throw Error("Effect response lost");
    }
  };
  const combat = { id: "combat", started: true, round: 2, combatants: [{ actor }] },
    combats = [combat];
  combats.get = id => combats.find(c => c.id === id);
  globalThis.game = {
    ready: false,
    user: { id: "gc", isGM: true },
    messages: [],
    actors: [actor],
    combats,
    settings: {
      get: (_s, key) => settings[key],
      set: async (_s, key, value) => (settings[key] = structuredClone(value))
    }
  };
  globalThis.foundry = {
    utils: { randomID: () => `id${++serial}`, escapeHTML: String },
    applications: {
      api: {
        DialogV2: { input: async () => null, confirm: async () => true }
      }
    }
  };
  globalThis.ui = { notifications: { warn: text => warnings.push(text) } };
  globalThis.fromUuid = async uuid => (uuid === actor.uuid ? actor : game.messages.find(m => m.uuid === uuid));
  globalThis.ChatMessage = {
    getSpeaker: () => ({}),
    getWhisperRecipients: () => [{ id: "gc" }],
    create: async data => {
      const m = {
        ...structuredClone(data),
        id: `m${++serial}`,
        uuid: `ChatMessage.m${serial}`,
        async update(change) {
          if (saveFailure && change["flags.spycraft2.gcDefenseDelivery"]?.rolls?.length >= Number(saveFailure))
            throw Error("Natural-result save failed");
          // Roll objects remain outside the plain source flags.
          const copy = { ...change };
          delete copy.rolls;
          patch(this, copy);
        }
      };
      game.messages.push(m);
      return m;
    }
  };
  globalThis.Roll = class {
    async evaluate() {
      rng++;
      this.total = values.shift();
      afterRoll?.();
      return this;
    }
  };
  return {
    actor,
    combat,
    delivery: () => game.messages.find(m => m.flags?.spycraft2?.gcDefenseDelivery),
    undo: () => game.messages.find(m => m.flags?.spycraft2?.undo)
  };
}

test("NPC Defense follows start-of-round, participation and one-boost limits, with exact combat expiry", () => {
  const { actor, combat } = setup(),
    opts = { die: 4, balance: 5, combatant: true, atStartOfRound: true };
  assert.deepEqual(npcDefensePlan(actor.system, combat, opts), { die: 4, combatId: "combat", startRound: 2 });
  for (const bad of [{ combatant: false }, { atStartOfRound: false }, { die: 3 }, { balance: 0 }])
    assert.throws(() => npcDefensePlan(actor.system, combat, { ...opts, ...bad }));
  const boost = npcDefenseResult(
    { version: 1, id: "x", combatId: "combat", startRound: 2, die: 4, explodeLow: true },
    [1, 4, 2]
  );
  assert.equal(boost.rounds, 7);
  assert.equal(boost.expiresAtRound, 9);
  assert.throws(() => npcDefensePlan({ ...actor.system, defenseBoost: boost }, combat, opts), /already active/);
  for (const [round, active] of [
    [1, false],
    [2, true],
    [8, true],
    [9, false]
  ])
    assert.equal(!!activeDefenseBoost({ defenseBoost: boost, combatContext: { ...combat, round } }), active);
  assert.equal(activeDefenseBoost({ defenseBoost: boost, combatContext: { ...combat, id: "other" } }), null);
  for (const rolls of [[], [4], [1, 2, 3], [0], [5]])
    assert.throws(() =>
      npcDefenseResult({ version: 1, id: "x", combatId: "combat", startRound: 2, die: 4, explodeLow: true }, rolls)
    );
});

test("one GC payment records the actual exploding die and applies one timed Defense state with Undo", async () => {
  const { actor, delivery, undo } = setup();
  values = [4, 2];
  await boostNpcDefense(actor, { atStartOfRound: true });
  assert.equal(rng, 2);
  assert.equal(settings.gcActionDice.value, 4);
  assert.equal(settings.gcActionDice.settlementReview.needsReview, false);
  assert.equal(actor.system.defenseBoost.rounds, 6);
  assert.equal(delivery().flags.spycraft2.gcDefenseDelivery.state, "complete");
  assert.deepEqual(delivery().flags.spycraft2.gcDefenseDelivery.rolls, [4, 2]);
  assert.equal(undo().flags.spycraft2.undo.gcDice, 1);
  assert.equal(undo().flags.spycraft2.undo.gcDiceSession, "s1");
  await assert.rejects(boostNpcDefense(actor, { atStartOfRound: true }), /already active/);
  assert.equal(rng, 2);
  await applyUndo(undo());
  assert.equal(actor.system.defenseBoost, null);
  assert.equal(settings.gcActionDice.value, 5);
});

test("dramatic NPC duration dice use the NPC role and explode on both one and maximum", async () => {
  const { actor, delivery } = setup();
  actor.system.manualRole = "minion";
  settings.sceneState.dramatic = true;
  values = [1, 6, 2];
  await boostNpcDefense(actor, { atStartOfRound: true });
  assert.equal(delivery().flags.spycraft2.gcDefenseDelivery.die, 6);
  assert.equal(delivery().flags.spycraft2.gcDefenseDelivery.explodeLow, true);
  assert.equal(actor.system.defenseBoost.rounds, 9);
  assert.equal(rng, 3);
  assert.equal(settings.gcActionDice.value, 4);
});

test("a failed effect write holds the actual roll and GC payment; recovery neither rolls nor pays again", async () => {
  const { actor, delivery } = setup();
  applyFailure = "before";
  await assert.rejects(boostNpcDefense(actor, { atStartOfRound: true }), /Effect write failed/);
  assert.equal(rng, 1);
  assert.equal(settings.gcActionDice.value, 4);
  assert.equal(settings.gcActionDice.settlementReview.needsReview, true);
  assert.equal(delivery().flags.spycraft2.gcDefenseDelivery.state, "rolled");
  await assert.rejects(boostNpcDefense(actor, { atStartOfRound: true }), /Recover/);
  applyFailure = "";
  await recoverNpcDefense(actor, delivery(), { confirmed: true, results: "3", note: "Actual die and pool checked" });
  assert.equal(actor.system.defenseBoost.rounds, 3);
  assert.equal(rng, 1);
  assert.equal(settings.gcActionDice.value, 4);
  assert.equal(settings.gcActionDice.settlementReview.needsReview, false);
});

test("an explicit replacement pays once for a new duration and Undo restores the old paid boost", async () => {
  const { actor, combat } = setup();
  values = [3, 2];
  await boostNpcDefense(actor, { atStartOfRound: true });
  const original = structuredClone(actor.system.defenseBoost);
  combat.round = 3;
  await boostNpcDefense(actor, { atStartOfRound: true, replaceExisting: true });
  assert.equal(actor.system.defenseBoost.startRound, 3);
  assert.equal(actor.system.defenseBoost.rounds, 2);
  assert.equal(settings.gcActionDice.value, 3);
  assert.equal(rng, 2);
  const undo = [...game.messages].reverse().find(m => m.flags?.spycraft2?.undo);
  await applyUndo(undo);
  assert.deepEqual(actor.system.defenseBoost, original);
  assert.equal(settings.gcActionDice.value, 4);
});

test("NPC Defense spending requires both GC authority and actual ownership before any payment or roll", async () => {
  const { actor } = setup();
  game.user.isGM = false;
  await assert.rejects(boostNpcDefense(actor, { atStartOfRound: true }), /owning GC/);
  game.user.isGM = true;
  actor.isOwner = false;
  await assert.rejects(boostNpcDefense(actor, { atStartOfRound: true }), /owning GC/);
  assert.equal(settings.gcActionDice.value, 5);
  assert.equal(rng, 0);
  assert.equal(game.messages.length, 0);
});

test("a session change before RNG cancels the reservation and refunds only the newly reserved payment", async () => {
  const { actor, delivery } = setup(),
    create = ChatMessage.create;
  ChatMessage.create = async data => {
    const message = await create(data);
    if (data.flags?.spycraft2?.gcDefenseDelivery) {
      settings.usagePeriods.session = "s2";
      settings.gcActionDice = { session: "s2", value: 5 };
    }
    return message;
  };
  await assert.rejects(boostNpcDefense(actor, { atStartOfRound: true }), /session changed/);
  assert.equal(rng, 0);
  assert.equal(settings.gcActionDice.value, 5);
  assert.equal(settings.gcActionDice.settlementReview.outcome, "refunded");
  assert.equal(delivery().flags.spycraft2.gcDefenseDelivery.state, "cancelled");
  assert.equal(actor.system.defenseBoost, null);
});

test("unknown result persistence blocks reroll; a reviewed actual natural recovers the original delivery", async () => {
  const { actor, delivery } = setup();
  saveFailure = true;
  await assert.rejects(boostNpcDefense(actor, { atStartOfRound: true }), /Natural-result save failed/);
  assert.equal(settings.gcActionDice.settlementReview.needsReview, true);
  assert.equal(delivery().flags.spycraft2.gcDefenseDelivery.state, "rolling");
  assert.deepEqual(delivery().flags.spycraft2.gcDefenseDelivery.rolls, []);
  saveFailure = false;
  await recoverNpcDefense(actor, delivery(), { confirmed: true, results: "3", note: "Observed natural confirmed" });
  assert.equal(actor.system.defenseBoost.rounds, 3);
  assert.equal(rng, 1);
  assert.equal(settings.gcActionDice.value, 4);
});

test("lost effect response is recognized and a completed delivery cannot replay after Undo", async () => {
  const { actor, delivery, undo } = setup();
  applyFailure = "after";
  await boostNpcDefense(actor, { atStartOfRound: true });
  assert.equal(settings.gcActionDice.value, 4);
  applyFailure = "";
  await applyUndo(undo());
  await recoverNpcDefense(actor, delivery(), { confirmed: true, results: "3", note: "Already completed source" });
  assert.equal(actor.system.defenseBoost, null);
  assert.equal(rng, 1);
  assert.equal(game.messages.filter(m => m.flags?.spycraft2?.undo).length, 1);
});

test("Undo restores the NPC but never credits an earlier session's die into a new pool", async () => {
  const { actor, undo } = setup();
  await boostNpcDefense(actor, { atStartOfRound: true });
  settings.usagePeriods.session = "s2";
  settings.gcActionDice = { session: "s2", value: 9 };
  await applyUndo(undo());
  assert.equal(actor.system.defenseBoost, null);
  assert.equal(settings.gcActionDice.value, 9);
  assert.ok(warnings.some(w => w.includes("another session")));
});

test("recovery preserves saved explosion prefixes and does not extend a boost into a later round", async () => {
  let current = setup();
  values = [4, 2];
  saveFailure = 2;
  await assert.rejects(boostNpcDefense(current.actor, { atStartOfRound: true }), /Natural-result save failed/);
  assert.deepEqual(current.delivery().flags.spycraft2.gcDefenseDelivery.rolls, [4]);
  saveFailure = false;
  await assert.rejects(
    recoverNpcDefense(current.actor, current.delivery(), { confirmed: true, results: "1, 2", note: "Changed prefix" }),
    /preserve/
  );
  await recoverNpcDefense(current.actor, current.delivery(), {
    confirmed: true,
    results: "4, 2",
    note: "Actual explosion checked"
  });
  assert.equal(rng, 2);
  assert.equal(current.actor.system.defenseBoost.rounds, 6);
  current = setup();
  afterRoll = () => {
    current.combat.round = 3;
  };
  await assert.rejects(boostNpcDefense(current.actor, { atStartOfRound: true }), /combat round/);
  await recoverNpcDefense(current.actor, current.delivery(), {
    confirmed: true,
    results: "3",
    note: "Original round confirmed"
  });
  assert.equal(current.actor.system.defenseBoost.startRound, 2);
  assert.equal(current.actor.system.defenseBoost.expiresAtRound, 5);
  assert.equal(rng, 1);
});

test("an unrolled reservation can release only its own held payment without creating an effect", async () => {
  const { actor } = setup(),
    record = {
      version: 1,
      id: "reserved",
      actorUuid: actor.uuid,
      session: "s1",
      state: "reserved",
      die: 4,
      combatId: "combat",
      startRound: 2,
      explodeLow: false,
      beforeRecord: null,
      rolls: []
    },
    message = await ChatMessage.create({ flags: { spycraft2: { gcDefenseDelivery: record } } });
  settings.gcActionDice = {
    session: "s1",
    value: 4,
    settlementReview: {
      id: "payment",
      needsReview: true,
      session: "s1",
      count: 1,
      before: 5,
      messageUuid: "ChatMessage.other"
    }
  };
  await assert.rejects(recoverNpcDefense(actor, message, { confirmed: true, note: "Unrolled" }), /other held/);
  settings.gcActionDice.settlementReview.messageUuid = message.uuid;
  await recoverNpcDefense(actor, message, { confirmed: true, note: "Confirmed no RNG started" });
  assert.equal(settings.gcActionDice.value, 5);
  assert.equal(message.flags.spycraft2.gcDefenseDelivery.state, "cancelled");
  assert.equal(actor.system.defenseBoost, null);
  assert.equal(rng, 0);
});
