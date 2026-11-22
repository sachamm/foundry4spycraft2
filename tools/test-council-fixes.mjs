// Fixes from the second live UI/UX council review (2026-11-22).
import test from "node:test";
import assert from "node:assert/strict";
import { recordedAttackDistance } from "../module/rules/cqb.mjs";

test("a damage roll reuses the distance its attack card recorded", () => {
  assert.equal(recordedAttackDistance({ attackContext: { distanceFeet: 25 } }), 25);
  assert.equal(recordedAttackDistance({ attackContext: { distanceFeet: null }, cqbRange: { distanceFeet: 20 } }), 20);
  assert.equal(recordedAttackDistance({ attackContext: { distanceFeet: "40" } }), 40);
  assert.equal(recordedAttackDistance({ attackContext: { distanceFeet: 0 } }), 0, "adjacent is a distance too");
  assert.equal(recordedAttackDistance({ attackContext: { distanceFeet: -5 } }), null);
  assert.equal(recordedAttackDistance({ attackContext: {} }), null);
  assert.equal(recordedAttackDistance(null), null);
});

test("flat-footed ends as a combatant's turn begins, except in a surprise round its side lost", async () => {
  const hooks = {};
  globalThis.Hooks = { on: (name, fn) => (hooks[name] ??= []).push(fn), once() {} };
  globalThis.foundry = { utils: { escapeHTML: String, randomID: () => "id" } };
  globalThis.ui = { notifications: { warn() {}, info() {} }, combat: null };
  const gm = { id: "gm", isGM: true };
  const settings = { fluidInitiative: false, startFlatFooted: true };
  globalThis.game = {
    user: gm,
    users: Object.assign([gm], { activeGM: gm }),
    settings: { get: (_scope, key) => settings[key] },
    i18n: { localize: String }
  };
  const { installFluidInitiativeHooks, flatFootedEndsOnTurn } = await import("../module/apps/gc/combat.mjs");
  assert.equal(flatFootedEndsOnTurn({ round: 1 }, { playerSide: true }), true);
  const surprise = { round: 1, surprise: { winners: ["opponents"], round: 1 } };
  assert.equal(flatFootedEndsOnTurn(surprise, { playerSide: true }), false);
  assert.equal(flatFootedEndsOnTurn(surprise, { playerSide: false }), true);
  assert.equal(flatFootedEndsOnTurn({ ...surprise, round: 2 }, { playerSide: true }), true);

  installFluidInitiativeHooks();
  globalThis.CONFIG = { statusEffects: [{ id: "flat-footed", name: "Flat-footed", img: "" }] };
  let n = 0;
  const actor = name => ({
    name,
    hasPlayerOwner: true,
    effects: [],
    get statuses() {
      return new Set(this.effects.flatMap(e => [...e.statuses]));
    },
    async createEmbeddedDocuments(_type, rows) {
      const made = rows.map(row => ({
        ...row,
        id: `e${++n}`,
        statuses: new Set(row.statuses),
        changes: [],
        toObject() {
          return { _id: this.id, changes: [] };
        }
      }));
      this.effects.push(...made);
      return made;
    },
    async deleteEmbeddedDocuments(_type, ids) {
      this.effects = this.effects.filter(e => !ids.includes(e.id));
    }
  });
  const a = { id: "a", actor: actor("A") },
    b = { id: "b", actor: actor("B") };
  const fight = {
    started: true,
    round: 1,
    turn: 0,
    flags: {},
    combatants: [a, b],
    turns: [a, b],
    get combatant() {
      return this.turns[this.turn];
    }
  };
  await Promise.all(hooks.combatStart.map(fn => fn(fight)));
  assert.ok(a.actor.statuses.has("flat-footed") && b.actor.statuses.has("flat-footed"));
  for (const fn of hooks.updateCombat) await fn(fight, { round: 1, turn: 0 }, { direction: 1 });
  assert.ok(!a.actor.statuses.has("flat-footed"), "A acts first and is no longer flat-footed");
  assert.ok(b.actor.statuses.has("flat-footed"), "B has not acted yet");
  fight.turn = 1;
  for (const fn of hooks.updateCombat) await fn(fight, { turn: 1 }, { direction: 1 });
  assert.ok(!b.actor.statuses.has("flat-footed"));
});
