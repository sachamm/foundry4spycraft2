import test from "node:test";
import assert from "node:assert/strict";

const notices = [];
globalThis.ui = { notifications: { info: text => notices.push(text) } };
globalThis.game = { user: { id: "u1", isGM: false }, settings: { get: () => true } };
const { announceTurn, isMyTurn } = await import("../module/apps/turn-cue.mjs");

const combat = owner => ({
  started: true,
  combatant: { name: "Vector", defeated: false, actor: { testUserPermission: user => user.id === owner } }
});

test("a player hears when the combat reaches a character they control", () => {
  assert.equal(announceTurn(combat("u1"), { turn: 2 }), true);
  assert.deepEqual(notices, ["Your turn: Vector."]);
  assert.equal(announceTurn(combat("u2"), { turn: 3 }), false, "someone else's character");
  assert.equal(announceTurn(combat("u1"), { active: true }), false, "not a turn change");
  game.user.isGM = true;
  assert.equal(isMyTurn(combat("u1")), false, "the GC is not told about every turn");
  game.user.isGM = false;
  game.settings.get = () => false;
  assert.equal(announceTurn(combat("u1"), { round: 2 }), false, "turned off");
});
