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
