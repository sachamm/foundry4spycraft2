import test from "node:test";
import assert from "node:assert/strict";

// The relay talks to Foundry globals; give it the few it needs before it loads.
const updates = [];
const players = new Map();
const message = {
  id: "m1",
  isAuthor: false,
  flags: {
    spycraft2: { actorUuid: "Actor.a1", damageApplied: [{ targetUuid: "x", name: "X", damage: 1, kind: "lethal" }] }
  },
  async update(change) {
    updates.push(change);
  }
};
const actor = { testUserPermission: (user, level) => level === "OWNER" && user.id === "owner" };
const confirms = [];
let confirmAnswer = true;
let nextId = 0;
globalThis.foundry = {
  utils: { escapeHTML: text => String(text).replaceAll("<", "&lt;"), randomID: () => `id${++nextId}` },
  applications: {
    api: {
      DialogV2: {
        confirm: async options => {
          confirms.push(options);
          return confirmAnswer;
        }
      }
    }
  }
};
// "Actor.t1" is a character the user "other" owns: the target of someone else's attack.
const targetActor = { testUserPermission: (user, level) => level === "OWNER" && user.id === "other" };
globalThis.fromUuid = async uuid => (uuid === "Actor.a1" ? actor : uuid === "Actor.t1" ? targetActor : null);
const warnings = [];
globalThis.ui = { notifications: { warn: text => warnings.push(text), info() {} } };
const settings = { relayAutoApprove: false };
globalThis.game = {
  user: { id: "owner", isGM: false, name: "Player" },
  users: { get: id => players.get(id), activeGM: null },
  messages: { get: id => (id === "m1" ? message : undefined) },
  settings: { get: (_scope, key) => settings[key] }
};
players.set("owner", { id: "owner", name: "Player", isGM: false });
players.set("other", { id: "other", name: "Other", isGM: false });

const { askGC, handleRelay, markCard, registerRelay, RELAY_QUERY } = await import("../module/apps/gc-relay.mjs");

test("the GC's client marks a card for the character's own player and nobody else", async () => {
  updates.length = 0;
  assert.deepEqual(
    await handleRelay({
      action: "markCard",
      userId: "owner",
      data: { messageId: "m1", key: "pendingSave.rolled", value: true }
    }),
    { value: true }
  );
  assert.deepEqual(updates, [{ "flags.spycraft2.pendingSave.rolled": true }]);
  const refused = await handleRelay({
    action: "markCard",
    userId: "other",
    data: { messageId: "m1", key: "pendingSave.rolled", value: true }
  });
  assert.match(refused.error, /own player/);
  assert.equal(updates.length, 1);
});

test("only listed flags with the expected values can be set", async () => {
  updates.length = 0;
  for (const data of [
    { messageId: "m1", key: "resolved", value: true },
    { messageId: "m1", key: "pendingSave.rolled", value: false },
    { messageId: "m1", key: "firstAid", value: true },
    { messageId: "nope", key: "pendingSave.rolled", value: true }
  ])
    assert.match((await handleRelay({ action: "markCard", userId: "owner", data })).error, /cannot be marked/);
  assert.equal(updates.length, 0);
});

test("an applied-damage entry is added to the ones already there", async () => {
  updates.length = 0;
  const entry = { targetUuid: "y", name: "Y", damage: 7, kind: "subdual" };
  await handleRelay({
    action: "markCard",
    userId: "owner",
    data: { messageId: "m1", key: "damageAppliedEntry", value: entry }
  });
  assert.deepEqual(updates[0]["flags.spycraft2.damageApplied"], [message.flags.spycraft2.damageApplied[0], entry]);
});

test("the player whose character took the damage may record it on the attacker's card, and only that", async () => {
  updates.length = 0;
  const entry = { targetUuid: "Actor.t1", name: "T", damage: 6, kind: "lethal" };
  const data = { messageId: "m1", key: "damageAppliedEntry", value: entry };
  assert.deepEqual(await handleRelay({ action: "markCard", userId: "other", data }), { value: true });
  assert.deepEqual(updates[0]["flags.spycraft2.damageApplied"].at(-1), entry);
  // Damage to a character that user does not own, and any other mark, are still refused.
  const elsewhere = { ...data, value: { ...entry, targetUuid: "y" } };
  assert.match((await handleRelay({ action: "markCard", userId: "other", data: elsewhere })).error, /own player/);
  const otherMark = { messageId: "m1", key: "pendingSave.rolled", value: true };
  assert.match((await handleRelay({ action: "markCard", userId: "other", data: otherMark })).error, /own player/);
  assert.equal(updates.length, 1);
});

test("an unknown request or user is answered with an error, never thrown", async () => {
  assert.ok((await handleRelay({ action: "nothing", userId: "owner" })).error);
  assert.ok((await handleRelay({ action: "markCard", userId: "ghost", data: {} })).error);
  assert.ok((await handleRelay()).error);
});

test("a described request waits for Allow on a card in the GC's chat unless the world setting skips the question", async () => {
  const { renderRelayAsk } = await import("../module/apps/gc-relay.mjs");
  const ran = [],
    cards = [];
  globalThis.ChatMessage = {
    create: async data => {
      const card = {
        ...data,
        async update(change) {
          Object.assign(this, { content: change.content });
          this.flags.spycraft2.relayAnswered = true;
        }
      };
      cards.push(card);
      return card;
    }
  };
  // Just enough DOM to lay out and click the card's buttons.
  const node = () => ({
    children: [],
    listeners: {},
    append(...n) {
      this.children.push(...n);
    },
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    }
  });
  globalThis.document = { createElement: node };
  const answer = async (allowed, run) => {
    const pending = run();
    while (!cards.length || cards.at(-1).flags.spycraft2.relayAnswered) await new Promise(r => setTimeout(r, 0));
    game.user.isGM = true;
    const html = node();
    renderRelayAsk(cards.at(-1), html);
    game.user.isGM = false;
    const [allow, decline] = html.children[0].children;
    await (allowed ? allow : decline).listeners.click();
    return pending;
  };
  registerRelay("testAction", { describe: () => "Allow?", run: data => (ran.push(data), "done") });
  const declined = await answer(false, () => handleRelay({ action: "testAction", userId: "owner", data: { n: 1 } }));
  assert.match(declined.error, /declined/);
  assert.equal(ran.length, 0);
  assert.match(cards[0].content, /Declined/);
  const allowed = await answer(true, () => handleRelay({ action: "testAction", userId: "owner", data: { n: 2 } }));
  assert.deepEqual(allowed, { value: "done" });
  assert.equal(cards.length, 2);
  assert.equal(confirms.length, 0, "no blocking dialog");
  settings.relayAutoApprove = true;
  await handleRelay({ action: "testAction", userId: "owner", data: { n: 3 } });
  assert.equal(cards.length, 2, "no question when requests are applied without asking");
  settings.relayAutoApprove = false;
  assert.deepEqual(ran, [{ n: 2 }, { n: 3 }]);
});

test("a player's request goes to the active GC and its refusal comes back as an error", async () => {
  await assert.rejects(askGC("testAction", {}), /No GC is connected/);
  const sent = [];
  game.users.activeGM = {
    query: async (name, payload) => {
      sent.push([name, payload]);
      return payload.data.fail ? { error: "The GC declined the request." } : { value: 5 };
    }
  };
  assert.equal(await askGC("testAction", { a: 1 }), 5);
  assert.deepEqual(sent[0], [RELAY_QUERY, { action: "testAction", data: { a: 1 }, userId: "owner" }]);
  await assert.rejects(askGC("testAction", { fail: true }), /declined/);
  game.users.activeGM = { query: async () => Promise.reject(new Error("User is not active")) };
  await assert.rejects(askGC("testAction", {}), /did not reach the GC/);
  await assert.rejects(askGC("unregistered", {}), /does not know/);
  game.users.activeGM = null;
});

test("marking a card someone else posted goes through the GC, and a failure warns once", async () => {
  updates.length = 0;
  warnings.length = 0;
  const asked = [];
  game.users.activeGM = { query: async (_name, payload) => (asked.push(payload), handleRelay(payload)) };
  assert.equal(await markCard(message, "hazardSave.resolved"), true);
  assert.equal(asked[0].action, "markCard");
  assert.deepEqual(updates, [{ "flags.spycraft2.hazardSave.resolved": true }]);
  game.users.activeGM = null;
  assert.equal(await markCard(message, "hazardSave.resolved"), false);
  assert.equal(warnings.length, 1);
  assert.equal(await markCard(message, "hazardSave.resolved", true, { quiet: true }), false);
  assert.equal(warnings.length, 1);
  // The author updates his own card directly.
  updates.length = 0;
  assert.equal(await markCard({ ...message, isAuthor: true }, "pendingSave.rolled"), true);
  assert.equal(updates.length, 1);
});
