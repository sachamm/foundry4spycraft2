import test from "node:test";
import assert from "node:assert/strict";
import {
  companionLossKey,
  companionLossPlan,
  companionLossStatus,
  reviewCompanionLossPlan
} from "../module/rules/companion-losses.mjs";
import { companionSlots } from "../module/rules/companions.mjs";
import {
  recordCompanionDeath,
  reviewCompanionLoss,
  reviewCompanionCreation,
  linkedCompanions,
  createCompanion
} from "../module/apps/companions.mjs";
import { applyUndo } from "../module/apps/undo.mjs";

let serial = 0,
  currentMission,
  actors,
  messages,
  postFails,
  input,
  confirm;
const patch = (target, changes) => {
  for (const [path, value] of Object.entries(changes)) {
    const parts = path.split("."),
      key = parts.pop();
    let at = target;
    for (const part of parts) at = at[part] ??= {};
    if (key.startsWith("-=")) delete at[key.slice(2)];
    else at[key.startsWith("==") ? key.slice(2) : key] = structuredClone(value);
  }
};
const document = (id, system) => ({
  id,
  uuid: `Actor.${id}`,
  name: id,
  type: "agent",
  isOwner: true,
  items: [],
  effects: [],
  flags: {},
  system,
  toObject() {
    return { system: structuredClone(this.system), flags: structuredClone(this.flags) };
  },
  async update(changes) {
    if (this.failBefore?.(changes)) throw Error("Injected failure before delivery");
    patch(this, changes);
    if (this.failAfter?.(changes)) throw Error("Injected response loss after delivery");
    return this;
  }
});
function setup({ freelance = false, feat = "Personal Lieutenant" } = {}) {
  currentMission = "mission1";
  messages = [];
  postFails = false;
  confirm = () => true;
  input = () => null;
  const owner = document("owner", {
    level: 7,
    affiliationType: freelance ? "freelance" : "faction",
    reputation: 30,
    netWorth: 1000000,
    activeFeatNames: [feat],
    activeFeatSelections: [{ name: feat }]
  });
  owner.items = [{ type: "feat", name: feat, system: { acquiredAtLevel: 7 } }];
  const companion = document("companion", { companionOf: { ownerUuid: owner.uuid, feat } });
  actors = [owner, companion];
  globalThis.game = {
    user: { id: "gc", isGM: true },
    time: { worldTime: 10 },
    settings: { get: (scope, key) => (key === "usagePeriods" ? { mission: currentMission } : null) },
    actors,
    messages
  };
  globalThis.fromUuidSync = uuid => actors.find(a => a.uuid === uuid) ?? messages.find(m => m.uuid === uuid) ?? null;
  globalThis.fromUuid = async uuid => fromUuidSync(uuid);
  globalThis.ui = { notifications: { warn() {}, info() {} } };
  globalThis.foundry = {
    utils: { randomID: () => `event${++serial}`, escapeHTML: s => String(s) },
    applications: { api: { DialogV2: { confirm: async () => confirm(), input: async () => input() } } }
  };
  globalThis.ChatMessage = {
    getSpeaker: () => ({}),
    getWhisperRecipients: () => [],
    create: async data => {
      if (postFails) throw Error("Injected post failure");
      const message = {
        ...structuredClone(data),
        uuid: `ChatMessage.message${++serial}`,
        isOwner: true,
        async update(changes) {
          patch(this, changes);
          return this;
        }
      };
      messages.push(message);
      return message;
    }
  };
  globalThis.Actor = {
    create: async data => {
      const actor = document(`created${++serial}`, data.system);
      actor.flags = structuredClone(data.flags ?? {});
      actors.push(actor);
      return actor;
    }
  };
  return { owner, companion, key: companionLossKey(companion.uuid) };
}

test("duplicate and concurrent companion death clicks charge once, retain the link and reserve the mission slot", async () => {
  const { owner, companion, key } = setup();
  await Promise.all([recordCompanionDeath(owner, companion.uuid), recordCompanionDeath(owner, companion.uuid)]);
  assert.equal(owner.system.reputation, 23);
  assert.equal(owner.flags.spycraft2.companionLosses[key].state, "charged");
  assert.equal(companion.system.companionOf.ownerUuid, owner.uuid);
  assert.equal(messages.length, 1);
  assert.equal(companionSlots(owner.system, linkedCompanions(owner)).personalLieutenant, 0);
  currentMission = "mission2";
  assert.equal(companionSlots(owner.system, linkedCompanions(owner)).personalLieutenant, 1);
  await recordCompanionDeath(owner, companion.uuid);
  assert.equal(owner.system.reputation, 23);
});

test("freelance companion loss uses current owner level and actual Net Worth, without touching Reputation", async () => {
  const { owner, companion } = setup({ freelance: true, feat: "Animal Partner" });
  await recordCompanionDeath(owner, companion.uuid);
  assert.equal(owner.system.netWorth, 650000);
  assert.equal(owner.system.reputation, 30);
});

test("the actual Undo action restores only the original balance and loss, retaining later unrelated edits", async () => {
  const { owner, companion } = setup();
  const note = await recordCompanionDeath(owner, companion.uuid);
  owner.system.notes = "Unrelated later edit";
  await applyUndo(note);
  assert.equal(owner.system.reputation, 30);
  assert.equal(owner.system.notes, "Unrelated later edit");
  assert.equal(linkedCompanions(owner)[0].lost, false);
  assert.equal(note.flags.spycraft2.undo.done, true);
  await applyUndo(note);
  assert.equal(owner.system.reputation, 30);
});

test("an uncertain debit stays blocked across missions, including after the companion actor is deleted", async () => {
  const { owner, companion, key } = setup();
  owner.failBefore = change => Object.hasOwn(change, "system.reputation");
  await assert.rejects(recordCompanionDeath(owner, companion.uuid), /before delivery/);
  assert.equal(owner.system.reputation, 30);
  assert.equal(owner.flags.spycraft2.companionLosses[key].state, "pending");
  owner.failBefore = null;
  await recordCompanionDeath(owner, companion.uuid);
  currentMission = "mission2";
  actors.splice(actors.indexOf(companion), 1);
  const rows = linkedCompanions(owner);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].missing, true);
  assert.equal(rows[0].needsReview, true);
  assert.equal(companionSlots(owner.system, rows).personalLieutenant, 0);
  assert.equal(owner.system.reputation, 30);
});

test("a lost charge response retains its actual debit and cannot be charged again", async () => {
  const { owner, companion } = setup();
  owner.failAfter = change => Object.hasOwn(change, "system.reputation");
  await recordCompanionDeath(owner, companion.uuid);
  owner.failAfter = null;
  assert.equal(owner.system.reputation, 23);
  await recordCompanionDeath(owner, companion.uuid);
  assert.equal(owner.system.reputation, 23);
  assert.equal(messages.length, 1);
});

test("a failed loss intent or Undo post never causes an automatic second debit", async () => {
  let { owner, companion } = setup();
  owner.failAfter = change => !Object.hasOwn(change, "system.reputation");
  await assert.rejects(recordCompanionDeath(owner, companion.uuid), /response loss/);
  owner.failAfter = null;
  await recordCompanionDeath(owner, companion.uuid);
  assert.equal(owner.system.reputation, 30);
  ({ owner, companion } = setup());
  postFails = true;
  await recordCompanionDeath(owner, companion.uuid);
  postFails = false;
  await recordCompanionDeath(owner, companion.uuid);
  assert.equal(owner.system.reputation, 23);
  assert.equal(messages.length, 0);
});

test("the GC resolves a pending charge with an explicit actual balance and can Undo that correction", async () => {
  const { owner, companion, key } = setup();
  owner.failBefore = change => Object.hasOwn(change, "system.reputation");
  await assert.rejects(recordCompanionDeath(owner, companion.uuid));
  owner.failBefore = null;
  input = () => ({
    outcome: "charged",
    balance: "23",
    note: "Verified debit had not happened; applied the original loss now"
  });
  const note = await reviewCompanionLoss(owner, companion.uuid);
  assert.equal(owner.system.reputation, 23);
  assert.equal(owner.flags.spycraft2.companionLosses[key].state, "charged");
  await applyUndo(note);
  assert.equal(owner.system.reputation, 30);
  assert.equal(owner.flags.spycraft2.companionLosses[key].state, "pending");
});

test("a stale GC loss review cannot overwrite a newer balance or record", async () => {
  const { owner, companion } = setup();
  await recordCompanionDeath(owner, companion.uuid);
  input = () => {
    owner.system.reputation = 25;
    return { outcome: "cancelled", balance: "30", note: "Old review" };
  };
  await assert.rejects(reviewCompanionLoss(owner, companion.uuid), /balance changed/);
  assert.equal(owner.system.reputation, 25);
});

test("cancelled confirmations and incorrect owners do not spend or unlink anything", async () => {
  const { owner, companion } = setup();
  confirm = () => false;
  assert.equal(await recordCompanionDeath(owner, companion.uuid), null);
  assert.equal(owner.system.reputation, 30);
  companion.system.companionOf.ownerUuid = "Actor.someoneElse";
  confirm = () => true;
  assert.equal(await recordCompanionDeath(owner, companion.uuid), false);
  assert.equal(owner.system.reputation, 30);
});

test("concurrent replacement creation produces one new lieutenant while retaining the lost actor", async () => {
  const { owner, companion } = setup();
  await recordCompanionDeath(owner, companion.uuid);
  assert.equal(await createCompanion(owner, "Personal Lieutenant"), false);
  currentMission = "mission2";
  await Promise.all([createCompanion(owner, "Personal Lieutenant"), createCompanion(owner, "Personal Lieutenant")]);
  assert.equal(actors.length, 3);
  assert.equal(companionSlots(owner.system, linkedCompanions(owner)).personalLieutenant, 0);
  assert.equal(companion.system.companionOf.ownerUuid, owner.uuid);
  currentMission = "mission1";
  assert.equal(
    linkedCompanions(owner).find(row => row.uuid === companion.uuid).replacementAvailable,
    true,
    "an already replaced loss cannot occupy another slot after mission correction"
  );
});

test("loss plans reject invalid owner links, balances and GC corrections rather than guessing", () => {
  const { owner, companion } = setup();
  const options = {
    id: "loss",
    ownerUuid: owner.uuid,
    companionUuid: companion.uuid,
    companionName: companion.name,
    mission: "mission1",
    at: 1
  };
  assert.throws(
    () => companionLossPlan(owner.system, { ownerUuid: "wrong", feat: "Personal Lieutenant" }, options),
    /actual owner/
  );
  assert.throws(
    () => companionLossPlan({ ...owner.system, reputation: NaN }, companion.system.companionOf, options),
    /actual balance/
  );
  const record = companionLossPlan(owner.system, companion.system.companionOf, options);
  assert.equal(companionLossStatus(record, "mission2").replacementAvailable, false);
  assert.throws(
    () => reviewCompanionLossPlan(record, { outcome: "charged", balance: 23, note: "", reviewer: "gc", at: 1 }),
    /actual present balance/
  );
  assert.equal(companionLossStatus({ ...record, state: "charged" }, "mission2").replacementAvailable, true);
});

test("a created companion with a lost creation response blocks retries until the GC binds its actual actor", async () => {
  const { owner, companion } = setup();
  await recordCompanionDeath(owner, companion.uuid);
  currentMission = "mission2";
  const original = Actor.create;
  Actor.create = async data => {
    await original(data);
    throw Error("Lost creation response");
  };
  assert.equal(await createCompanion(owner, "Personal Lieutenant"), false);
  assert.equal(owner.flags.spycraft2.companionCreation.state, "creating");
  assert.equal(actors.length, 3);
  assert.equal(await createCompanion(owner, "Personal Lieutenant"), false);
  input = () => ({ notCreated: true, note: "Wrong assumption" });
  await assert.rejects(reviewCompanionCreation(owner), /actual companion/);
  input = () => ({ actorUuid: actors[2].uuid, note: "Found the character from the original creation attempt" });
  await reviewCompanionCreation(owner);
  assert.equal(owner.flags.spycraft2.companionCreation.state, "created");
  assert.equal(companionSlots(owner.system, linkedCompanions(owner)).personalLieutenant, 0);
  await applyUndo(messages.at(-1));
  assert.equal(owner.flags.spycraft2.companionCreation.state, "creating");
  assert.equal(linkedCompanions(owner).find(row => row.uuid === companion.uuid).needsReview, true);
  await reviewCompanionCreation(owner);
  assert.equal(owner.flags.spycraft2.companionCreation.state, "created");
  assert.equal(await createCompanion(owner, "Personal Lieutenant"), false);
  assert.equal(actors.length, 3);
});

test("a creation that produced no actor needs explicit GC review before its replacement slot reopens", async () => {
  const { owner, companion } = setup();
  await recordCompanionDeath(owner, companion.uuid);
  currentMission = "mission2";
  Actor.create = async () => {
    throw Error("No creation permission");
  };
  await createCompanion(owner, "Personal Lieutenant");
  assert.equal(companionSlots(owner.system, linkedCompanions(owner)).personalLieutenant, 0);
  input = () => ({ notCreated: true, note: "Verified the world contains no character from this attempt" });
  await reviewCompanionCreation(owner);
  assert.equal(owner.flags.spycraft2.companionCreation.state, "cancelled");
  assert.equal(companionSlots(owner.system, linkedCompanions(owner)).personalLieutenant, 1);
});

test("Undo of an old loss warns before restoring a companion that already has a replacement", async () => {
  const { owner, companion } = setup();
  const note = await recordCompanionDeath(owner, companion.uuid);
  currentMission = "mission2";
  await createCompanion(owner, "Personal Lieutenant");
  confirm = () => false;
  assert.equal(await applyUndo(note), null);
  assert.equal(owner.system.reputation, 23);
  assert.equal(linkedCompanions(owner).find(row => row.uuid === companion.uuid).lost, true);
});
