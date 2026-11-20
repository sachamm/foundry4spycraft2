import test from "node:test";
import assert from "node:assert/strict";
import { roundReminders } from "../module/rules/round-reminders.mjs";

const who = (name, extra = {}) => ({ actorUuid: `Actor.${name}`, name, special: true, wounds: 5, ...extra });

test("a dying special character is reminded when the round ends, not on every turn", () => {
  const combatants = [who("a", { wounds: -3 }), who("b", { wounds: 0 }), who("c", { wounds: -12 })];
  assert.deepEqual(roundReminders({ combatants, roundEnded: true }), [
    { kind: "dying", actorUuid: "Actor.a", name: "a" }
  ]);
  assert.deepEqual(roundReminders({ combatants, roundEnded: false, turnActorUuid: "Actor.a" }), []);
  assert.deepEqual(roundReminders({ combatants: [who("n", { wounds: -3, special: false })], roundEnded: true }), []);
  assert.deepEqual(roundReminders({ combatants: [who("d", { wounds: -3, defeated: true })], roundEnded: true }), []);
});

test("a burning character is reminded when its own turn begins", () => {
  const combatants = [who("a", { burning: true }), who("b", { burning: true })];
  assert.deepEqual(roundReminders({ combatants, turnActorUuid: "Actor.b" }), [
    { kind: "burning", actorUuid: "Actor.b", name: "b" }
  ]);
  assert.deepEqual(roundReminders({ combatants, turnActorUuid: null }), []);
});

test("at a new round the burning reminder waits for fluid initiative and goes to the new leader once", async () => {
  const hooks = {};
  globalThis.Hooks = { on: (name, fn) => (hooks[name] ??= []).push(fn), once() {} };
  globalThis.foundry = { utils: { escapeHTML: String, randomID: () => "id", deepClone: x => structuredClone(x) } };
  globalThis.ui = { notifications: { warn() {}, info() {} }, combat: null };
  const gm = { id: "gm", isGM: true };
  const settings = { fluidInitiative: true, roundReminders: true };
  globalThis.game = {
    user: gm,
    users: Object.assign([gm], { activeGM: gm }),
    settings: { get: (_scope, key) => settings[key] },
    i18n: { localize: String }
  };
  const actor = (name, burning) => ({
    uuid: `Actor.${name}`,
    name,
    type: "agent",
    system: { wounds: { value: 5 }, hazards: burning ? { fire: { damage: 6, ap: 0 } } : {} },
    testUserPermission: () => true
  });
  const old = { id: "c1", name: "old", initiative: 10, actor: actor("old", true), flags: {} },
    leader = { id: "c2", name: "leader", initiative: 5, actor: actor("leader", true), flags: {} };
  const posts = [];
  globalThis.ChatMessage = {
    create: async data => posts.push(data),
    getSpeaker: ({ actor }) => ({ alias: actor.name })
  };
  globalThis.fromUuid = async uuid => [old.actor, leader.actor].find(a => a.uuid === uuid);
  const combat = {
    id: "fight",
    started: true,
    round: 2,
    turn: 0,
    previous: { round: 1 },
    combatants: [old, leader],
    get combatant() {
      return this.turns[this.turn];
    },
    turns: [old, leader]
  };
  const { installFluidInitiativeHooks } = await import("../module/apps/gc/combat.mjs");
  const { installRoundReminders } = await import("../module/apps/round-reminders.mjs");
  installFluidInitiativeHooks();
  installRoundReminders();
  // The fluid pass is slow: by the time it finishes, the new leader is first in the order.
  let release;
  const gate = new Promise(resolve => (release = resolve));
  const fluid = hooks.updateCombat[0];
  hooks.updateCombat[0] = async (...args) => {
    const running = fluid(...args);
    await gate;
    return running;
  };
  const runs = hooks.updateCombat.map(fn => fn(combat, { round: 2 }, { direction: 1 }));
  combat.turns = [leader, old];
  release();
  await Promise.all(runs);
  const burning = posts.filter(p => p.flags.spycraft2.roundReminder.kind === "burning");
  assert.deepEqual(
    burning.map(p => p.flags.spycraft2.roundReminder.actorUuid),
    ["Actor.leader"]
  );
});
