import test from "node:test";
import assert from "node:assert/strict";
import { actionBudget, resetActions, spendAction } from "../module/rules/action-budget.mjs";

test("a turn holds two half actions or one full action", () => {
  const at = { round: 2, turn: 1 };
  let state = actionBudget(undefined, at);
  assert.equal(state.used, 0);
  const first = spendAction(state, "half");
  assert.deepEqual([first.ok, first.left], [true, 1]);
  assert.equal(spendAction(first.state, "full").ok, false);
  const second = spendAction(first.state, "half");
  assert.deepEqual([second.ok, second.left], [true, 0]);
  assert.equal(spendAction(second.state, "half").ok, false);
  assert.deepEqual(spendAction(state, "full").left, 0);
  assert.equal(resetActions(second.state).used, 0);
  assert.throws(() => spendAction(state, "free"));
  // One more half action, as a Press buys.
  assert.deepEqual(spendAction(second.state, "half", { extra: 1 }).left, 0);
  assert.equal(spendAction({ ...state, used: 3 }, "half", { extra: 1 }).ok, false);
});

test("the budget starts over on another turn or round", () => {
  const spent = { round: 2, turn: 1, used: 2 };
  assert.equal(actionBudget(spent, { round: 2, turn: 1 }).used, 2);
  assert.equal(actionBudget(spent, { round: 2, turn: 2 }).used, 0);
  assert.equal(actionBudget(spent, { round: 3, turn: 1 }).used, 0);
});
