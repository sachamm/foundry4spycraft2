import test from "node:test";
import assert from "node:assert/strict";
import { actionBudget, pipSources, resetActions, setActionsUsed, spendAction } from "../module/rules/action-budget.mjs";

test("a turn holds two half actions or one full action", () => {
  const at = { round: 2 };
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

test("the budget lasts the round and starts over on the next", () => {
  const spent = { round: 2, used: 2 };
  assert.equal(actionBudget(spent, { round: 2 }).used, 2);
  assert.equal(actionBudget(spent, { round: 3 }).used, 0);
});

test("each spent half action remembers what marked it", () => {
  let state = actionBudget(undefined, { round: 2 });
  state = spendAction(state, "half", { label: "Reload" }).state;
  assert.deepEqual(pipSources(state), ["Reload"]);
  // Raised by hand: the earlier mark keeps its source and the new one names the click.
  state = setActionsUsed(state, 2, "a click on the pip");
  assert.deepEqual(pipSources(state), ["Reload", "a click on the pip"]);
  assert.deepEqual(pipSources(setActionsUsed(state, 1)), ["Reload"]);
  assert.deepEqual(
    pipSources(spendAction(actionBudget(undefined, { round: 2 }), "full", { label: "Total Defense" }).state),
    ["Total Defense", "Total Defense"]
  );
  // A record from before sources were kept still reads, with no source to show.
  assert.deepEqual(pipSources({ round: 2, used: 2 }), ["", ""]);
  assert.deepEqual(resetActions(state).sources, []);
});
