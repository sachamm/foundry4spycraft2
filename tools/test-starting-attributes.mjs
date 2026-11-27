import test from "node:test";
import assert from "node:assert/strict";
import { computeAgent } from "../module/rules/engine.mjs";
import { startingAttributeRecord, startingAttributeReview } from "../module/rules/starting-attributes.mjs";
import { ActorProgression } from "../module/documents/actor/progression.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";

const effects = { creationPointBuy: 32, startingAttributeCap: 18 };
const classes = [
  {
    id: "test",
    type: "class",
    name: "Test",
    system: { identifier: "test", table: [], classSkills: [], vitalityDie: 8, skillPoints: 4, proficiencies: 4 }
  }
];
const source = (level = 1) => ({
  pointBuyBudget: 36,
  xp: 1000,
  abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
  progression: Array.from({ length: level }, () => ({ classId: "test", vitality: 4, skills: {} })),
  abilityIncreases: { l4: "str" }
});
const origin = bonus => ({
  id: "origin",
  name: "Test Talent",
  type: "origin",
  system: { originType: "talent", bonuses: [{ target: "abilities.str", value: String(bonus) }] }
});
const scores = strength =>
  Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, k === "str" ? strength : 12]));
const review = { confirmed: true, cap: 18, note: "GC checked the original character record" };

test("Small Screen uses 32 points without overwriting the saved budget and checks Origin-adjusted creation scores", () => {
  const s = source(0);
  s.abilities.str.base = 16;
  computeAgent(s, [origin(4)], cfg, { campaignEffects: effects });
  assert.equal(s.pointBuy.budget, 32);
  assert.equal(s.pointBuyBudget, 36);
  assert.deepEqual(s.startingAttributeReview.violations, [{ ability: "str", score: 20, cap: 18 }]);
  assert.ok(s.todo.some(t => t.always && t.error && /starts at 20/.test(t.text)));
  computeAgent(s, [origin(4)], cfg, { campaignEffects: {} });
  assert.equal(s.pointBuy.budget, 36);
  assert.equal(s.startingAttributeReview, undefined);
  s.companionOf = { ownerUuid: "Actor.owner" };
  computeAgent(s, [origin(4)], cfg, { campaignEffects: effects });
  assert.equal(s.pointBuy.budget, 36);
  assert.equal(s.startingAttributeReview.violations.length, 1, "The starting cap applies to every character");
});

test("recorded starting scores remain distinct from later gains, while altered creation choices require a fresh review", () => {
  const items = [...classes, origin(2)];
  const s = computeAgent(source(5), items, cfg, { campaignEffects: effects });
  assert.equal(s.startingAttributeReview.needsReview, true);
  const record = startingAttributeRecord(s, items, { ...review, scores: scores(14) });
  s.abilities.str.misc = 5;
  computeAgent(s, items, cfg, { campaignEffects: effects, creationAttributes: record });
  assert.ok(s.abilities.str.value > 18);
  assert.equal(s.startingAttributeReview.needsReview, false);
  assert.deepEqual(s.startingAttributeReview.violations, []);
  s.abilities.str.base = 14;
  computeAgent(s, items, cfg, { campaignEffects: effects, creationAttributes: record });
  assert.equal(s.startingAttributeReview.needsReview, true);
});

test("a new-character review cannot hide excessive actual scores; historical level-one reconstruction is explicit", () => {
  const items = [...classes, origin(4)];
  const s = source();
  s.abilities.str.base = 16;
  computeAgent(s, items, cfg, { campaignEffects: effects });
  assert.throws(
    () => startingAttributeRecord(s, items, { ...review, scores: scores(18) }),
    /correct the actual starting attributes/
  );
  const record = startingAttributeRecord(s, items, { ...review, scores: scores(18), alreadyInPlay: true });
  assert.equal(record.historical, true);
  assert.equal(startingAttributeReview(s, items, record, 18).violations.length, 0);
  for (const patch of [{ scores: scores(19) }, { scores: { str: 12 } }, { confirmed: false }, { note: "" }])
    assert.throws(() =>
      startingAttributeRecord(s, items, { ...review, scores: scores(18), alreadyInPlay: true, ...patch })
    );
});

test("the GC review writes only its audit record and recognizes committed updates with lost responses", async () => {
  globalThis.game = {
    user: { id: "gc", isGM: true },
    settings: { get: (_id, key) => (key === "campaign" ? { qualities: ["small-screen"] } : {}) }
  };
  const items = [...classes, origin(2)];
  const C = ActorProgression(class {});
  const a = Object.assign(new C(), {
    uuid: "Actor.starting",
    type: "agent",
    isOwner: true,
    items,
    flags: {},
    system: computeAgent(source(), items, cfg, { campaignEffects: effects }),
    async update(patch) {
      this.flags.spycraft2 = { creationAttributes: structuredClone(patch["flags.spycraft2.creationAttributes"]) };
      throw Error("response lost");
    }
  });
  const before = structuredClone(a.system);
  const saved = await a.reviewStartingAttributes({ ...review, scores: scores(14) });
  assert.equal(saved.scores.str, 14);
  assert.deepEqual(a.system, before);
  assert.equal(a.flags.spycraft2.creationAttributes.signature, saved.signature);
  game.user.isGM = false;
  await assert.rejects(a.reviewStartingAttributes({ ...review, scores: scores(14) }), /GC reviews/);
  delete globalThis.game;
});
