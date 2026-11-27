import test from "node:test";
import assert from "node:assert/strict";
import { reviewLieutenantHistory } from "../module/apps/companions.mjs";
import { checkRecord } from "../module/rules/record-check.mjs";
import { RECORD_SHAPES } from "../module/data/record-shapes.mjs";

let answer;
globalThis.game = { user: { isGM: true, id: "gc" }, time: { worldTime: 25 } };
globalThis.foundry = { applications: { api: { DialogV2: { input: async () => answer() } } } };
const owner = {
  uuid: "Actor.owner",
  type: "agent",
  isOwner: true,
  system: { level: 9, activeFeatNames: ["Personal Lieutenant"] }
};
globalThis.fromUuidSync = uuid => (uuid === owner.uuid ? owner : null);
const lieutenant = () => ({
  uuid: "Actor.lieutenant",
  isOwner: true,
  system: {
    companionOf: { feat: "Personal Lieutenant", ownerUuid: owner.uuid },
    progression: [{ classId: "soldier", vitality: 12 }]
  },
  async update(patch) {
    this.system.companionOf = structuredClone(patch["system.==companionOf"]);
  }
});

test("the actual GC history form records acquisition evidence while preserving the lieutenant build", async () => {
  const actor = lieutenant(),
    progression = structuredClone(actor.system.progression);
  answer = () => ({ ownerUuid: owner.uuid, ownerLevelAtAcquisition: "7", note: "Verified the original selection" });
  const next = await reviewLieutenantHistory(actor);
  assert.equal(next.ownerLevelAtAcquisition, 7);
  assert.equal(next.historyReview.reviewer, "gc");
  assert.deepEqual(actor.system.progression, progression);
  assert.deepEqual(checkRecord(RECORD_SHAPES.companionOf, next), []);
});

test("a stale GC history form cannot overwrite a changed companion link", async () => {
  const actor = lieutenant();
  answer = () => {
    actor.system.companionOf.ownerLevelAtAcquisition = 8;
    return { ownerUuid: owner.uuid, ownerLevelAtAcquisition: "7", note: "Old form" };
  };
  await assert.rejects(reviewLieutenantHistory(actor), /companion link changed/);
  assert.equal(actor.system.companionOf.ownerLevelAtAcquisition, 8);
});

test("invalid original levels and cancelled reviews leave the build and original history intact", async () => {
  const actor = lieutenant(),
    before = structuredClone(actor.system);
  for (const acquired of ["0", "10", "2.5", "invalid"]) {
    answer = () => ({ ownerUuid: owner.uuid, ownerLevelAtAcquisition: acquired, note: "Checked" });
    await assert.rejects(reviewLieutenantHistory(actor), /original Career Level/);
    assert.deepEqual(actor.system, before);
  }
  answer = () => null;
  assert.equal(await reviewLieutenantHistory(actor), null);
  assert.deepEqual(actor.system, before);
  game.user.isGM = false;
  assert.equal(await reviewLieutenantHistory(actor), null);
  game.user.isGM = true;
});
