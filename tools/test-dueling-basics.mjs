import test from "node:test";
import assert from "node:assert/strict";
import {
  duelingBasicsPlan,
  duelingBasicsState,
  duelingAllDodge,
  duelingChosenDodge,
  duelingReachPlan
} from "../module/rules/dueling-basics.mjs";

const combat = { id: "c1", started: true, combatantId: "me", round: 2, turn: 0, ownTurnIndex: 0 };
const later = { ...combat, turn: 1 },
  over = { ...combat, round: 3, turn: 0 };
const owner = (record, context = combat) => ({
  activeFeatNames: ["Dueling Basics"],
  duelingBasics: record,
  duelingCombatContext: context
});

test("the declaration lasts 1 full round from the character's own Count", () => {
  const all = duelingBasicsPlan(owner(null), combat, { confirmed: true });
  assert.deepEqual([all.startRound, all.dueRound, all.opponentUuid], [2, 3, ""]);
  assert.ok(duelingBasicsState(owner(all, later)).active);
  assert.equal(duelingBasicsState(owner(all, over)).active, false);
  assert.throws(() => duelingBasicsPlan(owner(null), later, { confirmed: true }), /own Initiative Count/);
  assert.throws(() => duelingBasicsPlan({ activeFeatNames: [] }, combat, { confirmed: true }), /not been earned/);
});

test("+1 dodge against all without a chosen opponent; +2 against the chosen one only", () => {
  const all = duelingBasicsPlan(owner(null), combat, { confirmed: true }),
    chosen = duelingBasicsPlan(owner(null), combat, { confirmed: true, opponentUuid: "Actor.x", opponentName: "X" });
  assert.equal(duelingAllDodge(owner(all)), 1);
  assert.equal(duelingAllDodge(owner(chosen)), 0);
  assert.equal(duelingChosenDodge(owner(chosen), true), 2);
  assert.equal(duelingChosenDodge(owner(chosen), false), 0);
  assert.equal(duelingChosenDodge(owner(all), true), 0);
});

test("the extra Reach applies to melee attacks once per round", () => {
  const sys = { activeFeatNames: ["Dueling Basics"] };
  assert.equal(duelingReachPlan(sys, {}, {}), null);
  assert.match(duelingReachPlan(sys, {}, { duelingReach: true }).note, /5 ft\. beyond your Reach/);
  assert.ok(duelingReachPlan(sys, {}, { duelingReach: true, ranged: true }).blocked);
  assert.ok(duelingReachPlan(sys, {}, { duelingReach: true, usedThisRound: true }).blocked);
  assert.ok(duelingReachPlan({ activeFeatNames: [] }, {}, { duelingReach: true }).blocked);
});
