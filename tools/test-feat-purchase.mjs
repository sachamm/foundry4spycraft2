import test from "node:test";
import assert from "node:assert/strict";
import { featPurchasePlan, purchasedFeatSources } from "../module/rules/feat-purchase.mjs";
import { featAcquisition } from "../module/rules/feat-acquisition.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { ActorProgression } from "../module/documents/actor/progression.mjs";

const options = {
  effects: { featPurchase: true },
  mission: "operation.1",
  missionActive: false,
  missionCompleteConfirmed: true
};
const system = (level = 3) => ({ level, xp: cfg.tables.levels[level].xp + 1000 * level });

test("Feat Purchase costs 1000 XP per career level, once per completed mission, without dropping a level", () => {
  for (let level = 1; level <= 20; level++) {
    const s = system(level),
      p = featPurchasePlan(s, {}, cfg, options);
    assert.equal(p.record.cost, 1000 * level);
    assert.equal(p.record.afterXP, cfg.tables.levels[level].xp);
    assert.throws(() => featPurchasePlan({ ...s, xp: s.xp - 1 }, {}, cfg, options), /must leave/);
    const records = { [p.key]: p.record };
    assert.equal(purchasedFeatSources(records, level, cfg).sources.length, 1);
    assert.throws(() => featPurchasePlan(s, records, cfg, options), /already been purchased/);
  }
  for (const extra of [
    { effects: {} },
    { mission: "initial" },
    { missionActive: true },
    { missionCompleteConfirmed: false }
  ])
    assert.throws(() => featPurchasePlan(system(), {}, cfg, { ...options, ...extra }));
});

test("growth policy changes the retained XP minimum; corrupt receipts grant nothing and block later purchases", () => {
  for (const xpToLevelFraction of [0.5, 2]) {
    const level = 4,
      minimum = Math.floor(cfg.tables.levels[level].xp * xpToLevelFraction);
    const p = featPurchasePlan({ level, xp: minimum + 4000 }, {}, cfg, {
      ...options,
      effects: { featPurchase: true, xpToLevelFraction }
    });
    assert.equal(p.record.afterXP, minimum);
    for (const patch of [{ cost: 0 }, { afterXP: minimum - 1 }, { level: 2 }, { xpFraction: NaN }]) {
      const records = { [p.key]: { ...p.record, ...patch } };
      assert.equal(purchasedFeatSources(records, level, cfg).sources.length, 0);
      assert.throws(
        () => featPurchasePlan(system(), records, cfg, { ...options, mission: "another" }),
        /Review existing/
      );
    }
  }
});

test("paid choices survive campaign changes and retain purchase-level acquisition timing and source uniqueness", () => {
  const p = featPurchasePlan(system(), {}, cfg, options),
    records = { [p.key]: p.record };
  const agent = () => ({
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
    progression: Array.from({ length: 3 }, () => ({ classId: "test", vitality: 4, skills: {} }))
  });
  const items = [
    {
      id: "class",
      type: "class",
      name: "Test",
      system: { identifier: "test", table: [], classSkills: [], vitalityDie: 8, skillPoints: 4, proficiencies: 4 }
    }
  ];
  const normal = computeAgent(agent(), items, cfg);
  const paid = computeAgent(agent(), items, cfg, { featPurchases: records, campaignEffects: {} });
  assert.equal(paid.feats.any.slots, normal.feats.any.slots + 1);
  const sources = paid.featAcquisitionSources;
  const feat = {
    id: "feat",
    type: "feat",
    system: { tree: "basicCombat", acquisitionSource: sources[0].id, acquiredAtLevel: 3 }
  };
  assert.equal(featAcquisition(feat, sources, [feat]).ok, true);
  assert.equal(featAcquisition({ ...feat, system: { ...feat.system, acquiredAtLevel: 2 } }, sources, []).ok, false);
  assert.equal(featAcquisition({ ...feat, id: "duplicate" }, sources, [feat]).ok, false);
});

test("document purchases serialize, reject failed writes, and recognize a committed write whose response was lost", async () => {
  globalThis.CONFIG = { SPYCRAFT: cfg };
  globalThis.game = {
    ready: false,
    settings: { get: (_id, key) => (key === "campaign" ? { qualities: ["feat-purchase"] } : {}) }
  };
  const C = ActorProgression(class {});
  const actor = failure =>
    Object.assign(new C(), {
      uuid: `Actor.purchase-${failure}`,
      type: "agent",
      isOwner: true,
      system: system(),
      flags: {},
      usagePeriods: { mission: options.mission },
      updates: 0,
      async update(patch) {
        this.updates++;
        if (failure === "before") throw Error("write rejected");
        for (const [path, value] of Object.entries(patch)) {
          const keys = path.split(".");
          let target = this;
          for (const k of keys.slice(0, -1)) target = target[k] ??= {};
          target[keys.at(-1)] = structuredClone(value);
        }
        if (failure === "after") throw Error("response lost");
      }
    });
  const a = actor("normal");
  const result = await Promise.allSettled([
    a.purchaseFeatChoice({ missionCompleteConfirmed: true }),
    a.purchaseFeatChoice({ missionCompleteConfirmed: true })
  ]);
  assert.equal(result.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(a.updates, 1);
  assert.equal(a.system.xp, cfg.tables.levels[3].xp);
  assert.equal(Object.keys(a.flags.spycraft2.featPurchases).length, 1);
  const failed = actor("before");
  await assert.rejects(failed.purchaseFeatChoice({ missionCompleteConfirmed: true }), /write rejected/);
  assert.equal(failed.system.xp, system().xp);
  assert.deepEqual(failed.flags, {});
  const committed = actor("after");
  const receipt = await committed.purchaseFeatChoice({ missionCompleteConfirmed: true });
  assert.equal(receipt.cost, 3000);
  assert.equal(committed.system.xp, cfg.tables.levels[3].xp);
  await assert.rejects(committed.purchaseFeatChoice({ missionCompleteConfirmed: true }), /already been purchased/);
  assert.equal(committed.updates, 1);
  delete globalThis.game;
  delete globalThis.CONFIG;
});
