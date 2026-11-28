import test from "node:test";
import assert from "node:assert/strict";
import { lateEntry, lateTurnRedirect } from "../module/apps/gc/late-initiative.mjs";

const order = ["late", "a", "b", "c"];

test("a late roller on a passed Count takes the next turn, then the order resumes", () => {
  let late = lateEntry(null, { round: 1, id: "late" });
  // a acts (index 1); Next turn would go to b (2): the late roller goes first.
  let step = lateTurnRedirect({ round: 1, turn: 1, nextTurn: 2, nextRound: 1, order, late });
  assert.equal(order[step.turn], "late");
  late = step.late;
  // The late roller ends its turn: back to b, who would have been next.
  step = lateTurnRedirect({ round: 1, turn: 0, nextTurn: 1, nextRound: 1, order, late });
  assert.equal(order[step.turn], "b");
  late = step.late;
  // b to c goes as normal.
  assert.equal(lateTurnRedirect({ round: 1, turn: 2, nextTurn: 3, nextRound: 1, order, late }), null);
});

test("the owed turn lapses at the round's end and is not recorded twice", () => {
  const late = lateEntry(lateEntry(null, { round: 2, id: "late" }), { round: 2, id: "late" });
  assert.deepEqual(late.ids, ["late"]);
  assert.deepEqual(lateTurnRedirect({ round: 2, turn: 3, nextTurn: 0, nextRound: 3, order, late }), {
    turn: 0,
    late: null
  });
  assert.equal(lateTurnRedirect({ round: 1, turn: 1, nextTurn: 2, nextRound: 1, order, late }), null, "another round");
});

test("a late roll is read from the update's options, so the lead GC sees one a player made", async () => {
  const { rolledLate } = await import("../module/apps/gc/late-initiative.mjs");
  const combatant = { id: "c1", parent: { started: true } };
  assert.equal(rolledLate(combatant, { spycraft2LateRolls: ["c1"] }), true);
  assert.equal(rolledLate(combatant, {}), false);
  assert.equal(rolledLate({ ...combatant, parent: { started: false } }, { spycraft2LateRolls: ["c1"] }), false);
});
