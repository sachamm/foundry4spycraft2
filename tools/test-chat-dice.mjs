import test from "node:test";
import assert from "node:assert/strict";
import { CHAT_DICE, chatDiceFormula, clampModifier, modifierLabel } from "../module/apps/chat-dice.mjs";

test("the bar offers the six standard dice", () => {
  assert.deepEqual(CHAT_DICE, [4, 6, 8, 10, 12, 20]);
});

test("one die and a modifier give a /r formula with an ASCII sign", () => {
  assert.equal(chatDiceFormula(new Map([[20, 1]]), 3), "/r 1d20+3");
  assert.equal(chatDiceFormula(new Map([[6, 1]]), -2), "/r 1d6-2");
  assert.equal(chatDiceFormula(new Map([[8, 1]]), 0), "/r 1d8");
});

test("dice keep the order they were first clicked, and repeats raise the count", () => {
  const dice = new Map([
    [6, 2],
    [4, 1]
  ]);
  assert.equal(chatDiceFormula(dice, 1), "/r 2d6+1d4+1");
});

test("no dice means no formula, whatever the modifier", () => {
  assert.equal(chatDiceFormula(new Map(), 4), "");
  assert.equal(chatDiceFormula(new Map([[10, 0]]), 4), "");
});

test("the stepper shows a sign on every value and a true minus, and stays within ±99", () => {
  assert.equal(modifierLabel(0), "+0");
  assert.equal(modifierLabel(2), "+2");
  assert.equal(modifierLabel(-3), "−3");
  assert.equal(clampModifier(120), 99);
  assert.equal(clampModifier(-120), -99);
  assert.equal(clampModifier(Number.NaN), 0);
});
