import test from "node:test";
import assert from "node:assert/strict";

globalThis.game = { user: { targets: [] }, settings: { get: () => false } };
const { rememberChoices, rememberedChoices, choiceKey, skipDialog, quickAttackOptions, forgetChoices } =
  await import("../module/apps/remembered-choices.mjs");

test("a dialog's choices are kept without the ones that belong to a single roll", () => {
  const actor = { uuid: "Actor.a" };
  const key = choiceKey("attack", actor, "w1");
  rememberChoices(key, {
    attackAction: "burst",
    calledShotLocation: "head",
    targetActorUuid: "Actor.t",
    targetPinnedAdjacent: true,
    distanceFeet: 30,
    aimed: true,
    braced: true,
    feintContextConfirmed: true,
    modifier: "2",
    empty: ""
  });
  assert.deepEqual(rememberedChoices(key), { attackAction: "burst", calledShotLocation: "head" });
  forgetChoices(key);
  assert.equal(rememberedChoices(key), null);
});

test("Shift-click rolls straight away, and the player's setting swaps the two", () => {
  assert.equal(skipDialog({ shiftKey: true }), true);
  assert.equal(skipDialog({ shiftKey: false }), false);
  game.settings.get = () => true;
  assert.equal(skipDialog({ shiftKey: true }), false);
  assert.equal(skipDialog({}), true);
  game.settings.get = () => false;
});

test("a fast attack starts from the remembered choices and the one targeted token", () => {
  const actor = { uuid: "Actor.a" };
  rememberChoices(choiceKey("attack", actor, "w1"), { attackAction: "burst" });
  game.user.targets = [{ actor: { uuid: "Actor.t" } }];
  assert.deepEqual(quickAttackOptions(actor, { id: "w1" }), {
    quickEntered: { attackAction: "burst", targetActorUuid: "Actor.t" }
  });
  assert.deepEqual(quickAttackOptions(actor, { id: "w2" }), {
    quickEntered: { attackAction: "standard", targetActorUuid: "Actor.t" }
  });
  game.user.targets = [];
});
