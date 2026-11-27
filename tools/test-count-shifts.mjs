import test from "node:test";
import assert from "node:assert/strict";
import {
  countContextFor,
  recordCountShift,
  undoCountShift,
  reviewCountShift
} from "../module/documents/actor/count-shifts.mjs";
import { applyEndOfRound, recordFluidEvent } from "../module/apps/gc/combat.mjs";
import { reviewCountDialog } from "../module/apps/dueling.mjs";

let actor,
  combat,
  combatant,
  message,
  serial = 0,
  loseCombatantResponse = false,
  loseMessageResponse = false,
  failCondition = false;
function set(object, path, value) {
  const keys = path.split(".");
  for (const key of keys.slice(0, -1)) object = object[key] ??= {};
  object[keys.at(-1)] = structuredClone(value);
}
function setup(count = 20) {
  loseCombatantResponse = loseMessageResponse = failCondition = false;
  globalThis.game = { user: { id: "gc", isGM: true }, settings: { get: () => false }, combats: [] };
  globalThis.foundry = { utils: { randomID: () => `id${++serial}`, escapeHTML: String } };
  globalThis.CONFIG = { statusEffects: ["reeling", "flat-footed"].map(id => ({ id, name: id })) };
  globalThis.ChatMessage = { create: async data => data, getWhisperRecipients: () => [] };
  actor = {
    uuid: "Actor.pc",
    name: "Count test",
    isOwner: true,
    flags: {},
    effects: [],
    statuses: new Set(),
    async update(patch) {
      for (const [k, v] of Object.entries(patch)) set(this, k, v);
    },
    async createEmbeddedDocuments(_kind, rows) {
      if (failCondition) {
        failCondition = false;
        throw Error("condition write failed");
      }
      const effects = rows.map(row => ({ ...row, id: `effect${++serial}`, statuses: new Set(row.statuses) }));
      this.effects.push(...effects);
      for (const e of effects) for (const id of e.statuses) this.statuses.add(id);
      return effects;
    }
  };
  combat = { id: "combat", uuid: "Combat.combat", started: true, round: 1, combatants: [] };
  combatant = {
    id: "pc",
    uuid: "Combat.combat.Combatant.pc",
    name: "Count test",
    actor,
    parent: combat,
    isOwner: true,
    initiative: count,
    flags: {},
    async update(patch) {
      for (const [k, v] of Object.entries(patch)) set(this, k, v);
      if (loseCombatantResponse) {
        loseCombatantResponse = false;
        throw Error("lost combatant response");
      }
    }
  };
  combat.combatants.push(combatant);
  game.combats.push(combat);
  message = {
    id: "attack",
    uuid: "ChatMessage.attack",
    flags: { spycraft2: { actorUuid: actor.uuid, countContext: countContextFor(actor) } },
    async update(patch) {
      for (const [k, v] of Object.entries(patch)) set(this, k, v);
      if (loseMessageResponse) {
        loseMessageResponse = false;
        throw Error("lost source response");
      }
    }
  };
}
const record = (amount = 1, flag = "duelingSupremacy", source = message) =>
  recordCountShift(source, actor, amount, flag, "Count benefit");
const fluid = () => combatant.flags.spycraft2.fluid;

test("feat and class modifiers wait for round end and share the net ±10 cap", async () => {
  setup(49);
  await record(20);
  await record(-3, "kickCount");
  assert.equal(combatant.initiative, 49);
  assert.equal(fluid().modifiers.length, 2);
  await applyEndOfRound(combat, 1);
  assert.equal(combatant.initiative, 59);
  assert.equal(combatant.flags.spycraft2.mustPress, true);
  assert.equal(
    Object.values(combatant.flags.spycraft2.countEvents).every(r => r.state === "settled"),
    true
  );
  await applyEndOfRound(combat, 1);
  assert.equal(combatant.initiative, 59);
});

test("an initially high Count still requires Press next round without any queued modifier", async () => {
  setup(50);
  await applyEndOfRound(combat, 1);
  assert.equal(combatant.flags.spycraft2.mustPress, true);
  combat.round = 2;
  await recordFluidEvent(combatant, "press");
  assert.equal(combatant.initiative, 30);
  assert.equal(combatant.flags.spycraft2.mustPress, false);
});

test("concurrent clicks and a replacement source with the same trigger record one event", async () => {
  setup();
  const duplicate = {
    ...message,
    id: "replacement",
    uuid: "ChatMessage.replacement",
    flags: structuredClone(message.flags)
  };
  await Promise.all([record(), record(1, "duelingSupremacy", duplicate)]);
  assert.equal(fluid().modifiers.length, 1);
  assert.equal(Object.keys(actor.flags.spycraft2.countShifts).length, 1);
  assert.equal(combatant.initiative, 20);
});

test("lost positive combatant write is recovered from its atomic receipt", async () => {
  setup();
  loseCombatantResponse = true;
  await assert.rejects(record(), /lost combatant response/);
  assert.equal(fluid().modifiers.length, 1);
  await record();
  assert.equal(fluid().modifiers.length, 1);
  await applyEndOfRound(combat, 1);
  assert.equal(combatant.initiative, 21);
});

test("lost source response and deleted source marker cannot repeat the modifier", async () => {
  setup();
  loseMessageResponse = true;
  await assert.rejects(record(), /lost source response/);
  delete message.flags.spycraft2.duelingSupremacy;
  await record();
  assert.equal(fluid().modifiers.length, 1);
});

test("pending withdrawal keeps the trigger consumed across retries", async () => {
  setup();
  const { key } = await record();
  await undoCountShift(actor, key);
  assert.equal(fluid().modifiers.length, 0);
  await record();
  assert.equal(fluid().modifiers.length, 0);
  await undoCountShift(actor, key);
  assert.equal(fluid().modifiers.length, 0);
  await applyEndOfRound(combat, 1);
  assert.equal(combatant.initiative, 20);
});

test("earlier-round and changed-amount triggers require review instead of free new modifiers", async () => {
  setup();
  const { key } = await record();
  await assert.rejects(record(2), /original Count modifier changed/);
  await applyEndOfRound(combat, 1);
  combat.round = 2;
  await record();
  assert.equal(fluid().modifiers.length, 0);
  await assert.rejects(undoCountShift(actor, key), /no longer pending/);
  const different = {
    ...message,
    id: "new",
    uuid: "ChatMessage.new",
    flags: {
      spycraft2: {
        actorUuid: actor.uuid,
        countContext: { ...message.flags.spycraft2.countContext, triggerId: "different" }
      }
    }
  };
  await assert.rejects(record(1, "duelingSupremacy", different), /earlier round|round already settled/);
});

test("unknown source identity and ambiguous combatants do not gain a guessed Count", async () => {
  setup();
  delete message.flags.spycraft2.countContext.triggerId;
  await assert.rejects(record(), /older Count trigger/);
  combat.combatants.push({ ...combatant, id: "other", uuid: "Combat.combat.Combatant.other" });
  assert.equal(countContextFor(actor), null);
});

test("GC correction is absolute, journaled and retried without another adjustment", async () => {
  setup();
  const { key } = await record();
  await assert.rejects(reviewCountShift(actor, key, { correct: true, currentCount: 31 }), /actual Count history/);
  loseCombatantResponse = true;
  const input = { note: "Reviewed the trigger and later turn order", correct: true, currentCount: 31 };
  await assert.rejects(reviewCountShift(actor, key, input), /lost combatant response/);
  assert.equal(combatant.initiative, 31);
  await reviewCountShift(actor, key, input);
  assert.equal(combatant.initiative, 31);
  assert.equal(fluid().modifiers.length, 0);
  await record();
  assert.equal(fluid().modifiers.length, 0);
  await assert.rejects(reviewCountShift(actor, key, { ...input, currentCount: 32 }), /review is complete/);
});

test("unknown interrupted delivery can be consumed without changing the current Count", async () => {
  setup();
  const { key } = await record();
  combat.round = 2;
  await reviewCountShift(actor, key, { note: "Kept current Count after reviewing actual history" });
  assert.equal(combatant.initiative, 20);
  assert.equal(fluid().modifiers.length, 0);
  game.user.isGM = false;
  await assert.rejects(undoCountShift(actor, key), /GC reviews/);
});

test("the GC dialog finishes a saved interrupted correction without preparing new Count changes", async () => {
  setup();
  const { key } = await record();
  loseCombatantResponse = true;
  await assert.rejects(
    reviewCountShift(actor, key, { note: "Original reviewed decision", correct: true, currentCount: 31 }),
    /lost combatant response/
  );
  game.actors = [actor];
  foundry.applications = { api: { DialogV2: { input: async () => ({ event: "0", decision: "finish" }) } } };
  await reviewCountDialog(message);
  assert.equal(combatant.initiative, 31);
  assert.equal(actor.flags.spycraft2.countShifts[key].state, "reviewed");
});

test("a copied actor journal cannot correct or withdraw the original character's Count", async () => {
  setup();
  const { key } = await record();
  const copy = { ...actor, uuid: "Actor.copy", flags: structuredClone(actor.flags) };
  await assert.rejects(
    reviewCountShift(copy, key, { note: "Copied history", correct: true, currentCount: 40 }),
    /unavailable for this character/
  );
  await assert.rejects(undoCountShift(copy, key), /unavailable for this character/);
  assert.equal(combatant.initiative, 20);
});

test("end-of-round condition failure retains the settled Count and retries only missing effects", async () => {
  setup(4);
  await record(-20);
  failCondition = true;
  await assert.rejects(applyEndOfRound(combat, 1), /condition write failed/);
  assert.equal(combatant.initiative, 14);
  assert.equal(combatant.flags.spycraft2.fluidSettlement.state, "effectsPending");
  await applyEndOfRound(combat, 1);
  assert.equal(combatant.initiative, 14);
  assert.equal(actor.statuses.has("reeling"), true);
  assert.equal(actor.statuses.has("flat-footed"), true);
  assert.equal(combatant.flags.spycraft2.fluidSettlement.state, "complete");
  await applyEndOfRound(combat, 1);
  assert.equal(actor.effects.length, 2);
});
