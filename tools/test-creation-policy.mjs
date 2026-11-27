import test from "node:test";
import assert from "node:assert/strict";
import {
  characterCampaignPolicy,
  creationEffectsForQualities,
  creationPolicyRecord,
  creationPolicyValid
} from "../module/rules/creation-policy.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { ActorProgression } from "../module/documents/actor/progression.mjs";
import { SPYCRAFT } from "../module/config.mjs";

const review = { confirmed: true, note: "Original campaign record checked" };
const qualities = ["big-budget", "small-screen"];
const creation = creationEffectsForQualities(qualities);
const source = () => ({
  pointBuyBudget: 36,
  abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
  progression: [{ classId: "test", vitality: 4, skills: {} }]
});

test("birth rules survive season changes while live advancement and combat effects still change", () => {
  const original = creationPolicyRecord(creation, review);
  const s = computeAgent(source(), [], SPYCRAFT, {
    creationPolicy: original,
    campaignEffects: { featInterval: 2, rangeIncrementMultiplier: 2 }
  });
  assert.equal(s.pointBuy.budget, 32);
  assert.equal(s.campaignEffects.startingWealth, 4);
  assert.equal(s.startingAttributeReview.cap, 18);
  assert.equal(s.campaignEffects.featInterval, 2);
  assert.equal(s.campaignEffects.rangeIncrementMultiplier, 2);
  assert.deepEqual(s.creationPolicyStatus, { recorded: true, needsReview: false });
  const ordinary = creationPolicyRecord({}, review);
  computeAgent(s, [], SPYCRAFT, { creationPolicy: ordinary, campaignEffects: creation });
  assert.equal(s.pointBuy.budget, 36);
  assert.equal(s.campaignEffects.startingWealth, undefined);
  assert.equal(s.startingAttributeReview, undefined);
});

test("reviewed birth roles preserve only their own allowances; unknown or corrupt history remains visible", () => {
  const special = creationPolicyRecord(creation, { ...review, role: "special" });
  assert.deepEqual(special.effects, { startingAttributeCap: 18, startingWealth: 4 });
  assert.deepEqual(creationPolicyRecord(creation, { ...review, role: "standard" }).effects, {
    startingAttributeCap: 18
  });
  assert.equal(characterCampaignPolicy({ threatLevel: 5 }, creation).needsReview, true);
  const s = computeAgent(source(), [], SPYCRAFT, { campaignEffects: creation });
  assert.equal(s.creationPolicyStatus.needsReview, true);
  assert.ok(s.todo.some(t => t.always && t.error && /creation-only campaign/.test(t.text)));
  for (const patch of [
    { effects: { startingWealth: 400 } },
    { qualityIds: ["unknown"] },
    { qualityIds: undefined },
    { role: "standard" },
    { confirmed: false },
    { note: {} }
  ]) {
    const bad = { ...creationPolicyRecord(creation, review), ...patch };
    assert.equal(creationPolicyValid(bad), false);
    assert.equal(characterCampaignPolicy({ level: 1 }, {}, bad).needsReview, true);
  }
  assert.throws(() => creationPolicyRecord({}, { ...review, note: {} }));
});

test("GC creation-rule review changes only its record, recognizes a committed write with a lost response, and rejects players", async () => {
  globalThis.game = { user: { id: "gc", isGM: true } };
  const C = ActorProgression(class {});
  const a = Object.assign(new C(), {
    uuid: "Actor.birth",
    type: "agent",
    isOwner: true,
    flags: {},
    system: source(),
    async update(patch) {
      assert.deepEqual(Object.keys(patch), ["flags.spycraft2.creationPolicy"]);
      this.flags.spycraft2 = { creationPolicy: structuredClone(patch["flags.spycraft2.creationPolicy"]) };
      throw Error("response lost");
    }
  });
  const before = structuredClone(a.system);
  const record = await a.reviewCreationPolicy({ ...review, qualityIds: qualities });
  assert.equal(creationPolicyValid(record), true);
  assert.deepEqual(a.system, before);
  game.user.isGM = false;
  await assert.rejects(a.reviewCreationPolicy({ ...review, qualityIds: [] }), /GC reviews/);
  delete globalThis.game;
});
