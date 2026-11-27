import test from "node:test";
import assert from "node:assert/strict";
import { modularCreationPlan } from "../module/rules/modular-creation.mjs";
import { creationPolicyRecord } from "../module/rules/creation-policy.mjs";
import { ActorProgression } from "../module/documents/actor/progression.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";

const trade = (bought = 0, surrendered = {}) => ({
  version: 1,
  bought,
  surrendered,
  confirmed: true,
  note: "Creation sheet checked"
});
const policy = creationPolicyRecord({ modularCreation: 1 }, { confirmed: true, note: "Original season checked" });
const cls = {
  id: "test",
  type: "class",
  name: "Test",
  system: {
    identifier: "test",
    table: [],
    vitalityDie: 8,
    classSkills: [],
    bonuses: [
      { target: "featSlots.basicCombat", value: "1", level: 1 },
      { target: "featSlots.basicCombat", value: "2", level: 4 }
    ]
  }
};
const source = (level = 1) => ({
  pointBuyBudget: 36,
  abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
  progression: Array.from({ length: level }, () => ({ classId: "test", vitality: 4, skills: {} }))
});
const prepare = (record, level = 1, items = [cls], effects = {}) =>
  computeAgent(source(level), items, cfg, { creationPolicy: policy, campaignEffects: effects, modularTrade: record });

test("Modular buying and surrendering affect both budgets, persist across seasons, and retain later progression", () => {
  const bought = prepare(trade(3), 8);
  const ordinary = computeAgent(source(8), [cls], cfg);
  assert.equal(bought.pointBuy.budget, 30);
  assert.equal(bought.feats.any.slots, ordinary.feats.any.slots + 3);
  assert.equal(bought.featAcquisitionSources.filter(s => s.kind === "modular").length, 3);
  assert.ok(
    bought.featAcquisitionSources
      .filter(s => s.kind === "modular")
      .every(s => s.career === 1 && s.tree === "any" && s.levelAllowance === 0)
  );
  const sold = prepare(trade(0, { any: 1, basicCombat: 1 }), 8);
  assert.equal(sold.pointBuy.budget, 40);
  assert.equal(sold.feats.any.slots, ordinary.feats.any.slots - 1);
  assert.equal(sold.feats.trees.basicCombat.slots, ordinary.feats.trees.basicCombat.slots - 1);
  assert.equal(sold.modularCreation.available.basicCombat, 1, "Later class choices cannot be sold at creation");
  assert.equal(sold.modularCreation.available.any, 1, "Later career feats cannot be sold at creation");
});

test("invalid trades grant no feat slots or attribute credit and remain visible for repair", () => {
  const ordinary = prepare(null, 8);
  for (const record of [
    trade(-1),
    trade(1.5),
    trade(19),
    trade(1, { any: 1 }),
    trade(0, { any: 2 }),
    trade(0, { basicCombat: 2 }),
    trade(0, { unrecognized: 1 }),
    { ...trade(1), confirmed: false }
  ]) {
    const s = prepare(record, 8);
    assert.equal(s.modularCreation.valid, false);
    assert.equal(s.pointBuy.budget, ordinary.pointBuy.budget);
    assert.equal(s.feats.any.slots, ordinary.feats.any.slots);
    assert.equal(s.feats.trees.basicCombat.slots, ordinary.feats.trees.basicCombat.slots);
    assert.ok(s.todo.some(t => t.always && t.error && /Modular/.test(t.text)));
  }
  assert.equal(modularCreationPlan(trade(1), { any: 1 }, 36, false).valid, false);
});

test("Small Screen sets the base budget before Modular purchases, and companions cannot use PC creation trades", () => {
  const both = creationPolicyRecord(
    { modularCreation: 1, creationPointBuy: 32, startingAttributeCap: 18 },
    { confirmed: true, note: "Original season checked" }
  );
  const s = computeAgent(source(), [cls], cfg, { creationPolicy: both, modularTrade: trade(2) });
  assert.equal(s.pointBuy.budget, 28);
  assert.equal(s.pointBuyBudget, 36);
  const companion = source();
  companion.companionOf = { ownerUuid: "Actor.owner" };
  computeAgent(companion, [cls], cfg, { campaignEffects: { modularCreation: 1 }, modularTrade: trade(2) });
  assert.equal(companion.modularCreation.valid, false);
  assert.equal(companion.pointBuy.budget, 36);
});

test("surrendered choices expose an existing overspend instead of silently removing owned or granted feats", () => {
  const feats = [0, 1, 2].map(index => ({
    id: `feat${index}`,
    name: `Feat ${index}`,
    type: "feat",
    system: { tree: "basicCombat", bonuses: [], prerequisites: {} }
  }));
  const s = prepare(trade(0, { any: 1, basicCombat: 1 }), 1, [cls, ...feats]);
  assert.ok(s.warnings.some(w => /more feat\(s\) taken/.test(w)));
  assert.equal(feats.length, 3);
  assert.equal(s.modularCreation.available.basicCombat, 1);
});

test("the actual creation workflow saves only the trade, guards player timing and handles committed-response loss", async () => {
  globalThis.CONFIG = { SPYCRAFT: cfg };
  globalThis.game = { user: { id: "owner", isGM: false }, settings: { get: () => ({}) } };
  const C = ActorProgression(class {});
  const a = Object.assign(new C(), {
    type: "agent",
    uuid: "Actor.modular",
    isOwner: true,
    items: [cls],
    flags: { spycraft2: { creationPolicy: policy } },
    system: prepare(null),
    usagePeriods: { mission: "initial" },
    async update(patch) {
      assert.deepEqual(Object.keys(patch), ["flags.spycraft2.modularTrade"]);
      this.flags.spycraft2.modularTrade = structuredClone(patch["flags.spycraft2.modularTrade"]);
      throw Error("response lost");
    }
  });
  const before = structuredClone(a.system);
  const saved = await a.configureModularCreation(trade(2));
  assert.equal(saved.bought, 2);
  assert.deepEqual(a.system, before);
  a.usagePeriods.mission = "second";
  await assert.rejects(a.configureModularCreation(trade()), /Only the GC/);
  game.user.isGM = true;
  assert.equal((await a.configureModularCreation(trade())).bought, 0);
  a.system.companionOf = { ownerUuid: "Actor.owner" };
  assert.equal(await a.configureModularCreation(trade()), null);
  delete globalThis.game;
  delete globalThis.CONFIG;
});
