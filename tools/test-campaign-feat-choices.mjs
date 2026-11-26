import test from "node:test";
import assert from "node:assert/strict";
import { campaignFeatSlots, campaignFeatReplacementAllowed } from "../module/rules/campaign-creation.mjs";
import { featAcquisition } from "../module/rules/feat-acquisition.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
test("campaign substitutions retain the original number of choices and cannot replace Advanced Skill with Basic Skill through Elite Ops", () => {
  const given = { any: 1, advancedSkill: 1, basicSkill: 0, chance: 0, covert: 1 };
  const spent = { basicSkill: 1, covert: 1 };
  const effects = { bonusFeatTrees: ["Basic Skill", "Covert"] };
  const result = campaignFeatSlots(given, spent, effects);
  assert.equal(result.slots.basicSkill, 1);
  assert.equal(result.slots.covert, 1);
  assert.equal(result.slots.advancedSkill, 0);
  assert.equal(result.slots.any, 1);
  assert.equal(given.advancedSkill, 1);
  assert.equal(campaignFeatReplacementAllowed("advancedSkill", "basicSkill", effects), false);
});
test("small allocation combinations agree with exhaustive legal assignments, including rerouting a native choice", () => {
  const keys = ["advancedSkill", "basicSkill", "chance", "covert"];
  const effects = { bonusFeatTrees: ["Basic Skill", "Covert"] };
  function best(sources, remaining, index = 0) {
    if (index === sources.length) return 0;
    let total = best(sources, remaining, index + 1);
    for (const target of keys)
      if (
        remaining[target] > 0 &&
        (sources[index] === target || campaignFeatReplacementAllowed(sources[index], target, effects))
      ) {
        remaining[target]--;
        total = Math.max(total, 1 + best(sources, remaining, index + 1));
        remaining[target]++;
      }
    return total;
  }
  for (let mask = 0; mask < 16; mask++)
    for (let demand = 0; demand < 81; demand++) {
      const slots = Object.fromEntries(keys.map((k, i) => [k, (mask >> i) & 1]));
      const spent = Object.fromEntries(keys.map((k, i) => [k, Math.floor(demand / 3 ** i) % 3]));
      const result = campaignFeatSlots(slots, spent, effects);
      const sources = keys.filter(k => slots[k]);
      const covered = keys.reduce((n, k) => n + Math.min(result.slots[k], spent[k]), 0);
      assert.equal(covered, best(sources, { ...spent }), JSON.stringify({ slots, spent }));
      assert.equal(
        keys.reduce((n, k) => n + result.slots[k], 0),
        sources.length
      );
    }
});
test("class source acquisition accepts only campaign-permitted alternatives and never claims the source twice", () => {
  const source = { id: "study", tree: "advancedSkill", career: 1, levelAllowance: 2 };
  const feat = {
    id: "chance",
    type: "feat",
    system: { acquisitionSource: "study", tree: "chance", acquiredAtLevel: 1 }
  };
  assert.equal(featAcquisition(feat, [source], [feat]).ok, false);
  const options = { campaignEffects: { bonusFeatTrees: ["Chance"] } };
  assert.equal(featAcquisition(feat, [source], [feat], options).effectiveLevel, 3);
  assert.equal(
    featAcquisition({ ...feat, id: "second" }, [source], [feat, { ...feat, id: "second" }], options).ok,
    false
  );
  assert.equal(
    featAcquisition(
      { ...feat, system: { ...feat.system, acquiredAtLevel: 0 } },
      [{ ...source, career: 4 }],
      [feat],
      options
    ).ok,
    false
  );
});
test("engine budgets use a replacement rather than consuming an unrestricted choice or charging a granted feat", () => {
  const system = {
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 10 }])),
    progression: [{ classId: "test", vitality: 1, skills: {} }],
    misc: {}
  };
  const items = [
    {
      id: "test",
      type: "class",
      name: "Test",
      system: { identifier: "test", table: [], classSkills: [], vitalityDie: 8, skillPoints: 4 }
    },
    {
      id: "origin",
      type: "origin",
      name: "Test grants",
      system: { bonuses: [{ target: "featSlots.meleeCombat", value: "1" }] }
    },
    { id: "a", type: "feat", name: "Choice A", system: { tree: "chance" } },
    { id: "b", type: "feat", name: "Choice B", system: { tree: "chance" } },
    { id: "c", type: "feat", name: "Fixed grant", system: { tree: "chance", granted: true } }
  ];
  computeAgent(system, items, cfg, { campaignEffects: { bonusFeatTrees: ["Chance"] } });
  assert.equal(system.feats.any.remaining, 0);
  assert.equal(system.feats.trees.chance.slots, 1);
  assert.equal(system.feats.trees.chance.spent, 2);
  assert.equal(system.feats.campaignReplacements[0].count, 1);
});
