import test from "node:test";
import assert from "node:assert/strict";
import { applyNpcDrained, reviewNpcDrainedHistory, npcDrainedView } from "../module/apps/npc-drained.mjs";
import { npcDrainedProjection } from "../module/rules/npc-drained.mjs";
import { defaultNpcProfile, NPC_STATS } from "../module/rules/npcs.mjs";
import { applyUndo } from "../module/apps/undo.mjs";
import { rollDrainedRecovery, settleDrainedRecoveryCheck, reviewDrainedRecovery } from "../module/apps/drained.mjs";
import { SPYCRAFT } from "../module/config.mjs";
let serial = 0;
function fixture(npcType = "standard") {
  const notes = [],
    actor = {
      id: "npc",
      uuid: "Actor.npc-drained",
      name: "NPC Drained",
      type: "npc",
      isOwner: true,
      items: [],
      effects: [],
      _source: {
        system: {
          npcType,
          threatLevel: 10,
          npcProfile: {
            ...defaultNpcProfile(),
            enabled: true,
            grades: Object.fromEntries(Object.keys(NPC_STATS).map(k => [k, 5])),
            skills: [{ key: "resolve", grade: 6 }],
            qualities: [
              { id: "fleet", units: 1 },
              { id: "damageResistance", units: 4, details: "AC" }
            ]
          }
        },
        flags: {}
      },
      toObject() {
        return structuredClone(this._source);
      },
      prepare() {
        this.flags = this._source.flags;
        this.system = structuredClone(this._source.system);
        this.system.undrainedThreatLevel = this.system.effectiveThreatLevel = 10;
        this.system.undrainedNpcProfile = structuredClone(this.system.npcProfile);
        try {
          const prepared = npcDrainedProjection(this.system, this.items, this.flags.spycraft2?.drained);
          this.system.npcProfile = prepared.profile;
          this.system.effectiveThreatLevel = prepared.state.effectiveLevel;
          this.system.drainedState = prepared.state.levels ? prepared.state : undefined;
        } catch (error) {
          this.system.drainedState = { needsReview: true, problem: error.message };
        }
      },
      async update(patch) {
        for (const [path, value] of Object.entries(patch)) {
          const keys = path.split(".");
          let at = this._source;
          for (const key of keys.slice(0, -1)) at = at[key] ??= {};
          const key = keys.at(-1);
          if (key.startsWith("-=")) delete at[key.slice(2)];
          else at[key.replace(/^==/, "")] = structuredClone(value);
        }
        this.prepare();
        await this.updateHook?.(patch);
        return this;
      }
    };
  actor.prepare();
  globalThis.game = {
    ready: false,
    user: { id: "gc", isGM: true },
    time: { worldTime: 10 },
    combats: [],
    settings: { get: () => ({ threatLevel: 10 }) },
    messages: []
  };
  globalThis.foundry = {
    utils: { randomID: () => `id${++serial}`, escapeHTML: String },
    applications: { api: { DialogV2: { input: async () => null } } }
  };
  globalThis.ui = { notifications: { warn: () => {}, info: () => {} } };
  globalThis.ChatMessage = { create: async data => (notes.push(data), data), getSpeaker: () => ({}) };
  globalThis.fromUuid = async uuid => (uuid === actor.uuid ? actor : null);
  globalThis.fromUuidSync = uuid => (uuid === actor.uuid ? actor : null);
  const input = {
    id: "original",
    source: "Original resolved stress save",
    levels: 1,
    confirmed: true,
    forfeit: { kind: "quality", index: 0 }
  };
  return { actor, input, notes };
}

test("actual NPC recovery uses NPC skill/cap rules, forwards the reserved identity and restores one original loss", async () => {
  const { actor, input } = fixture();
  await applyNpcDrained(actor, input);
  globalThis.CONFIG = { SPYCRAFT };
  actor._source.system.abilities = { wis: { mod: 2 } };
  actor._source.system.npcBuild = { skills: [{ key: "resolve", bonus: 7 }] };
  actor.prepare();
  const messages = game.messages;
  let rolls = 0;
  actor.rollCheck = async (formula, data, options) => {
    rolls++;
    assert.equal(formula, "20 + @total");
    assert.equal(data.total, 12);
    assert.equal(options.checkId, "drained-recovery");
    assert.equal(options.checkMethod, "take20");
    assert.equal(options.actionDiceAllowed, false);
    assert.equal(options.difficultyClass, 20);
    const message = {
      uuid: "ChatMessage.original",
      flags: {
        spycraft2: {
          ...options,
          actorUuid: actor.uuid,
          resolved: true,
          successConfirmed: true,
          effectiveTotal: 32
        }
      }
    };
    messages.push(message);
    return message;
  };
  foundry.applications.api.DialogV2.input = async () => ({ method: "take20", safeToTake: true, modifier: 3 });
  const message = await rollDrainedRecovery(actor, { confirmed: true });
  assert.equal(actor.flags.spycraft2.drained.recoveries.initial.mode, "Active");
  assert.equal(await rollDrainedRecovery(actor, { confirmed: true }), message);
  assert.equal(rolls, 1);
  await settleDrainedRecoveryCheck(actor);
  assert.equal(actor.flags.spycraft2.drained.levels, 0);
  assert.deepEqual(actor.flags.spycraft2.drained.stack, []);
  assert.equal(actor.system.npcProfile.grades.health, 5);
  assert.equal(actor.system.npcProfile.qualities.length, 2);
  assert.equal(actor.flags.spycraft2.drained.recoveries.initial.messageUuid, message.uuid);
  assert.equal(await settleDrainedRecoveryCheck(actor), actor.flags.spycraft2.drained);
});

test("NPC context cancellation releases only an unused claim; owners without GC authority cannot roll", async () => {
  const { actor, input } = fixture();
  await applyNpcDrained(actor, input);
  assert.equal(await rollDrainedRecovery(actor, { confirmed: true }), null);
  assert.deepEqual(actor.flags.spycraft2.drained.recoveries, {});
  game.user.isGM = false;
  assert.equal(await rollDrainedRecovery(actor, { confirmed: true }), null);
  assert.equal(npcDrainedView(actor).canRoll, false);
  await assert.rejects(reviewDrainedRecovery(actor), /owning GC/);
});

test("the real NPC application preserves original grades/qualities and Undo preserves unrelated benefits", async () => {
  const { actor, input, notes } = fixture();
  await applyNpcDrained(actor, input);
  assert.equal(actor.system.npcProfile.grades.attack, 4);
  assert.equal(actor.toObject().system.npcProfile.grades.attack, 5);
  assert.equal(actor.system.npcProfile.qualities.length, 1);
  assert.equal(actor.toObject().system.npcProfile.qualities.length, 2);
  actor.flags.spycraft2.unrelatedUse = "spent";
  const note = { ...notes.at(-1), id: "undo", uuid: "ChatMessage.undo", isOwner: true, update: async () => {} };
  await applyUndo(note);
  assert.equal(actor.system.npcProfile.grades.attack, 5);
  assert.equal(actor.system.npcProfile.qualities.length, 2);
  assert.equal(actor.flags.spycraft2.unrelatedUse, "spent");
});

test("lost update responses and duplicate source events cannot apply a second NPC loss", async () => {
  const { actor, input } = fixture();
  actor.updateHook = async () => {
    actor.updateHook = null;
    throw Error("Committed; response lost");
  };
  await applyNpcDrained(actor, input);
  await applyNpcDrained(actor, input);
  assert.equal(actor.flags.spycraft2.drained.levels, 1);
  assert.equal(actor.flags.spycraft2.drained.applications.original.applied, 1);
  assert.equal(actor.system.npcProfile.grades.health, 4);
});

test("special NPC losses change only their effective career level and keep shared Threat Level and grades", async () => {
  const { actor, input } = fixture("special");
  await applyNpcDrained(actor, { ...input, levels: 3 });
  assert.equal(actor.system.effectiveThreatLevel, 7);
  assert.equal(actor.system.threatLevel, 10);
  assert.equal(game.settings.get("spycraft2", "mission").threatLevel, 10);
  assert.equal(actor.system.npcProfile.grades.health, 5);
  assert.equal(actor.system.npcProfile.qualities.length, 2);
});

test("a stale actual GC form cannot apply a loss after the NPC's build changes", async () => {
  const { actor } = fixture();
  foundry.applications.api.DialogV2.input = async () => {
    await actor.update({ "system.npcProfile.grades.attack": 6 });
    return { source: "Stale form", forfeitChoice: "quality:0", confirmed: true };
  };
  await assert.rejects(applyNpcDrained(actor), /history changed/);
  assert.equal(actor.flags.spycraft2?.drained, undefined);
  assert.equal(actor.system.npcProfile.grades.attack, 6);
});

test("GC corrections preserve original recovery claims and a malformed history remains repairable", async () => {
  const { actor, input } = fixture();
  await applyNpcDrained(actor, input);
  await actor.update({
    "flags.spycraft2.drained.recoveries": { mission: { attempt: "original-dice", state: "needsReview" } }
  });
  await reviewNpcDrainedHistory(actor, {
    retained: [],
    confirmed: true,
    reference: "Original result reviewed at table",
    note: "Verified actual restoration and retained original dice"
  });
  assert.equal(actor.system.drainedState, undefined);
  assert.equal(actor.flags.spycraft2.drained.recoveries.mission.attempt, "original-dice");
  assert.equal(actor.flags.spycraft2.drained.recoveries.mission.state, "completed");
  await actor.update({
    "flags.spycraft2.==drained": {
      kind: "npc",
      version: 8,
      levels: "unknown",
      stack: "unknown",
      reviews: "legacy",
      recoveries: { old: null }
    }
  });
  assert.equal(npcDrainedView(actor).needsReview, true);
  await reviewNpcDrainedHistory(actor, {
    retained: [],
    unknownHistoryResolved: true,
    confirmed: true,
    reference: "GC verified original history",
    note: "All unknown effects and dice resolved separately"
  });
  assert.equal(actor.flags.spycraft2.drained.levels, 0);
  assert.equal(actor.system.drainedState, undefined);
});

test("manual statistics and unavailable qualities require actual GC declarations before recording a loss", async () => {
  const { actor, input } = fixture();
  await actor.update({ "system.npcProfile.enabled": false });
  await assert.rejects(applyNpcDrained(actor, input), /manual NPC/);
  await assert.rejects(applyNpcDrained(actor, { ...input, manualStatsHandled: true }), /already forfeited/);
  await applyNpcDrained(actor, {
    ...input,
    manualStatsHandled: true,
    manualQualityHandled: true,
    forfeit: { kind: "manual" },
    note: "GC removed the independently tracked quality and adjusted actual statistics"
  });
  assert.equal(actor.flags.spycraft2.drained.levels, 1);
  assert.equal(npcDrainedView(actor).manualStats, true);
});
