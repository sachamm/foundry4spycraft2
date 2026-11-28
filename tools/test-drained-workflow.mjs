import test from "node:test";
import assert from "node:assert/strict";
import {
  applyDrained,
  reviewDrainedBuild,
  rollDrainedRecovery,
  settleDrainedRecoveryCheck,
  reviewDrainedRecovery,
  drainedView
} from "../module/apps/drained.mjs";
import { drainedState } from "../module/rules/drained.mjs";
import { applyUndo } from "../module/apps/undo.mjs";
let serial = 0;
function fixture() {
  const notes = [],
    messages = [];
  globalThis.game = {
    ready: false,
    user: { id: "gc", isGM: true },
    time: { worldTime: 10 },
    combats: [],
    messages,
    settings: { get: () => ({}) }
  };
  globalThis.foundry = {
    utils: { randomID: () => `id${++serial}`, escapeHTML: String },
    applications: { api: { DialogV2: { input: async () => null } } }
  };
  globalThis.ui = { notifications: { warn: () => {}, info: () => {} } };
  globalThis.ChatMessage = { create: async data => (notes.push(data), data), getSpeaker: () => ({}) };
  const actor = {
    uuid: "Actor.drained",
    name: "Drained agent",
    type: "agent",
    isOwner: true,
    flags: {},
    items: [],
    effects: [],
    system: {
      progression: [1, 2, 3].map(n => ({ classId: "test", careerEntryId: `level${n}`, skills: {} })),
      usagePeriods: { mission: "mission1" },
      wealthAllocation: { lifestyle: 0, possessions: 0, spendingCash: 0 },
      actionDice: { value: 2 },
      vitality: { value: 20 },
      wounds: { value: 10 }
    },
    toObject() {
      return structuredClone({ system: this.system, flags: this.flags });
    },
    async update(patch) {
      for (const [path, value] of Object.entries(patch)) {
        const keys = path.split(".");
        let at = this;
        for (const key of keys.slice(0, -1)) at = at[key] ??= {};
        const key = keys.at(-1);
        if (key.startsWith("-=")) delete at[key.slice(2)];
        else at[key.replace(/^==/, "")] = structuredClone(value);
      }
      const state = drainedState(this.system, this.items, this.flags.spycraft2?.drained);
      this.system.drainedState = state.levels ? state : undefined;
      this.system.level = state.effectiveLevel;
      await this.updateHook?.(patch);
      return this;
    }
  };
  globalThis.fromUuid = async uuid => (uuid === actor.uuid ? actor : messages.find(m => m.uuid === uuid));
  globalThis.fromUuidSync = uuid => (uuid === actor.uuid ? actor : messages.find(m => m.uuid === uuid));
  const input = {
    id: "stress-event",
    source: "Actual stress save",
    levels: 1,
    confirmed: true,
    retained: [],
    wealth: { lifestyle: 0, possessions: 0, spendingCash: 0 },
    note: "GC verified acquisition history and effects"
  };
  const post = (options, succeeded = true) => {
    const message = {
      id: `message${++serial}`,
      uuid: `ChatMessage.message${serial}`,
      flags: {
        spycraft2: {
          actorUuid: actor.uuid,
          checkKind: "skill",
          skillKey: "resolve",
          ability: "wis",
          checkId: "drained-recovery",
          checkMethod: "roll",
          resolved: true,
          successConfirmed: succeeded,
          effectiveTotal: succeeded ? 30 : 3,
          drainedRecovery: options.drainedRecovery
        }
      }
    };
    messages.push(message);
    return message;
  };
  return { actor, input, notes, messages, post };
}

test("actual Drained writes survive lost update responses without deleting the original build or unrelated uses", async () => {
  const { actor, input, notes } = fixture(),
    original = structuredClone(actor.system.progression);
  actor.updateHook = async patch => {
    if (Object.keys(patch).some(k => k.includes("drained"))) {
      actor.flags.spycraft2.unrelatedAbility = "spent";
      actor.system.actionDice.value = 1;
      actor.updateHook = null;
      throw Error("Lost update response");
    }
  };
  await applyDrained(actor, input);
  assert.equal(actor.system.level, 2);
  assert.deepEqual(actor.system.progression, original);
  assert.equal(actor.flags.spycraft2.drained.applications["stress-event"].applied, 1);
  await applyDrained(actor, input);
  assert.equal(actor.flags.spycraft2.drained.levels, 1);
  assert.ok(notes.some(n => n.flags.spycraft2.undo));
  assert.equal(actor.flags.spycraft2.unrelatedAbility, "spent");
  const note = {
    ...notes.at(-1),
    id: "undo-application",
    uuid: "ChatMessage.undo-application",
    isOwner: true,
    update: async () => {}
  };
  await applyUndo(note);
  assert.equal(actor.system.level, 3);
  assert.equal(actor.system.actionDice.value, 1);
  assert.equal(actor.flags.spycraft2.unrelatedAbility, "spent");
});

test("a lost roll response retains the posted original, settlement restores one level, and Undo cannot permit new dice", async () => {
  const { actor, input, notes, post } = fixture();
  await applyDrained(actor, input);
  let rolls = 0;
  actor.rollSkill = async (key, ability, options) => {
    assert.equal(key, "resolve");
    assert.equal(ability, "wis");
    rolls++;
    post(options);
    throw Error("Original posted; response lost");
  };
  await assert.rejects(rollDrainedRecovery(actor, { confirmed: true }), /response lost/);
  assert.equal(actor.flags.spycraft2.drained.recoveries.mission1.state, "posted");
  const original = await rollDrainedRecovery(actor, { confirmed: true });
  assert.equal(rolls, 1);
  assert.ok(original.uuid);
  await settleDrainedRecoveryCheck(actor);
  assert.equal(actor.flags.spycraft2.drained.levels, 0);
  assert.equal(actor.system.level, 3);
  await settleDrainedRecoveryCheck(actor);
  assert.equal(rolls, 1);
  const note = {
    ...notes.at(-1),
    id: "undo",
    uuid: "ChatMessage.undo",
    isOwner: true,
    async update(patch) {
      for (const [key, value] of Object.entries(patch)) {
        const keys = key.split(".");
        let at = this;
        for (const part of keys.slice(0, -1)) at = at[part] ??= {};
        at[keys.at(-1)] = value;
      }
    }
  };
  await applyUndo(note);
  assert.equal(actor.flags.spycraft2.drained.levels, 1);
  assert.equal(actor.flags.spycraft2.drained.recoveries.mission1.state, "posted");
  assert.equal(await rollDrainedRecovery(actor, { confirmed: true }), original);
  assert.equal(rolls, 1);
});

test("a definite cancellation of the context dialog releases an unused claim while an uncertain null does not", async () => {
  const { actor, input } = fixture();
  await applyDrained(actor, input);
  actor.rollSkill = async (key, ability, context) => {
    await context.onDrainedRecoveryContextCancelled();
    return null;
  };
  assert.equal(await rollDrainedRecovery(actor, { confirmed: true }), null);
  assert.deepEqual(actor.flags.spycraft2.drained.recoveries, {});
  actor.rollSkill = async () => null;
  await rollDrainedRecovery(actor, { confirmed: true });
  assert.equal(actor.flags.spycraft2.drained.recoveries.mission1.state, "needsReview");
});

test("uncertain recovery dice block replay and a GC review consumes the original outcome without replacement RNG", async () => {
  const { actor, input } = fixture();
  await applyDrained(actor, input);
  let rolls = 0;
  actor.rollSkill = async () => {
    rolls++;
    throw Error("Unknown original delivery");
  };
  await assert.rejects(rollDrainedRecovery(actor, { confirmed: true }), /Unknown/);
  await assert.rejects(rollDrainedRecovery(actor, { confirmed: true }), /original attempt/);
  await assert.rejects(
    reviewDrainedRecovery(actor, { mode: "success", note: "Incomplete verification" }),
    /verify the original/
  );
  await reviewDrainedRecovery(actor, {
    mode: "failure",
    actualOutcomeConfirmed: true,
    note: "Verified original failed check"
  });
  assert.equal(actor.flags.spycraft2.drained.recoveries.mission1.state, "completed");
  assert.equal(actor.flags.spycraft2.drained.levels, 1);
  assert.equal(rolls, 1);
  await assert.rejects(rollDrainedRecovery(actor, { confirmed: true }), /original attempt/);
});

test("releasing an unused recovery needs both attestations, and earlier mission attempts remain reviewable", async () => {
  const { actor, input } = fixture();
  await applyDrained(actor, input);
  actor.rollSkill = async () => null;
  await rollDrainedRecovery(actor, { confirmed: true });
  actor.system.usagePeriods.mission = "mission2";
  assert.equal(drainedView(actor).pending[0].mission, "mission1");
  await assert.rejects(rollDrainedRecovery(actor, { confirmed: true }), /previous mission/);
  await assert.rejects(
    reviewDrainedRecovery(actor, { mission: "mission1", mode: "unused", noDiceConfirmed: true, note: "Cancelled" }),
    /both/
  );
  await reviewDrainedRecovery(actor, {
    mission: "mission1",
    mode: "unused",
    noDiceConfirmed: true,
    noEffectsConfirmed: true,
    note: "Verified cancelled before all dice and effects"
  });
  assert.equal(actor.flags.spycraft2.drained.recoveries.mission1, undefined);
  assert.equal(actor.flags.spycraft2.drained.recoveryReviews.length, 1);
  assert.equal(drainedView(actor).canRoll, true);
});

test("stale GC build forms cannot overwrite later advancement choices", async () => {
  const { actor, input } = fixture();
  await applyDrained(actor, input);
  foundry.applications.api.DialogV2.input = async () => {
    actor.system.progression[0].skills.athletics = 1;
    return { confirmed: true, note: "Stale form", lifestyle: 0, possessions: 0, spendingCash: 0 };
  };
  await assert.rejects(reviewDrainedBuild(actor), /history changed/);
  assert.equal(actor.system.progression[0].skills.athletics, 1);
});

test("a refused resource lease creates no recovery claim or replacement dice", async () => {
  const { actor, input } = fixture();
  await applyDrained(actor, input);
  let rolls = 0;
  actor.rollSkill = async () => {
    rolls++;
    return null;
  };
  game.spycraft2 = { resourceLocks: { run: async () => false } };
  game.ready = true;
  assert.equal(await rollDrainedRecovery(actor, { confirmed: true }), false);
  assert.deepEqual(actor.flags.spycraft2.drained.recoveries, {});
  assert.equal(rolls, 0);
});

test("a known posted recovery cannot be released as unused or changed to a contradictory reviewed outcome", async () => {
  const { actor, input, post } = fixture();
  await applyDrained(actor, input);
  actor.rollSkill = async (key, ability, options) => post(options, false);
  await rollDrainedRecovery(actor, { confirmed: true });
  await assert.rejects(
    reviewDrainedRecovery(actor, {
      mode: "unused",
      noDiceConfirmed: true,
      noEffectsConfirmed: true,
      note: "Contradictory unused claim"
    }),
    /original recovery roll exists/
  );
  await assert.rejects(
    reviewDrainedRecovery(actor, {
      mode: "success",
      actualOutcomeConfirmed: true,
      note: "Contradictory successful claim"
    }),
    /disagrees/
  );
  assert.equal(actor.flags.spycraft2.drained.levels, 1);
});
