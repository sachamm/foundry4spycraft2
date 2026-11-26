import test from "node:test";
import assert from "node:assert/strict";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { campaignInterestCount, campaignProficiencyCount } from "../module/rules/campaign-creation.mjs";
import { currentCampaignRules } from "../module/rules/gc/campaign.mjs";
const items = [
  {
    id: "test",
    name: "Test",
    type: "class",
    system: { identifier: "test", table: [], classSkills: [], vitalityDie: 8, skillPoints: 4, proficiencies: 4 }
  }
];
const agent = level => ({
  abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
  progression: Array.from({ length: level }, () => ({ classId: "test", vitality: 4, skills: {} })),
  abilityIncreases: { l3: "int", l4: "str", l5: "wis", l6: "dex" },
  misc: {}
});
test("campaign attribute cadence changes earned scores and historical Intelligence without moving saved normal choices", () => {
  const s = agent(6);
  computeAgent(s, items, cfg, { campaignEffects: { attributeInterval: 3 } });
  assert.deepEqual(s.abilityIncreaseLevels, [3, 6, 9, 12, 15, 18]);
  assert.equal(s.abilities.str.increase, 0);
  assert.equal(s.abilities.int.increase, 1);
  assert.equal(s.abilities.dex.increase, 1);
  assert.equal(s.abilityIncreases.l4, "str");
  computeAgent(s, items, cfg, { campaignEffects: { attributeInterval: 5 } });
  assert.deepEqual(s.abilityIncreaseLevels, [5, 10, 15, 20]);
  assert.equal(s.abilities.wis.increase, 1);
  computeAgent(s, items, cfg, { campaignEffects: {} });
  assert.deepEqual(s.abilityIncreaseLevels, [4, 8, 12, 16, 20]);
  assert.equal(s.abilities.str.increase, 1);
});
test("all twenty levels receive campaign feat and proficiency cadence without altering class grants", () => {
  for (let level = 0; level <= 20; level++) {
    const fast = computeAgent(agent(level), items, cfg, {
      campaignEffects: { featInterval: 2, proficiencyInterval: 1 }
    });
    const slow = computeAgent(agent(level), items, cfg, {
      campaignEffects: { featInterval: 4, proficiencyInterval: 4 }
    });
    assert.equal(fast.feats.any.slots, level ? 1 + Math.floor(level / 2) : 0);
    assert.equal(slow.feats.any.slots, level ? 1 + Math.floor(level / 4) : 0);
    assert.equal(campaignProficiencyCount(level, 0, { proficiencyInterval: 1 }), Math.max(0, level - 1));
    assert.equal(
      campaignProficiencyCount(level, 0, { proficiencyInterval: 4 }),
      Math.floor(Math.max(0, level - 1) / 4)
    );
    assert.equal(
      fast.proficiencyPicks.available - slow.proficiencyPicks.available,
      Math.max(0, level - 1) - Math.floor(Math.max(0, level - 1) / 4)
    );
  }
});
test("Interest cadence preserves the user-confirmed first award and XP qualities adjust current and next thresholds", () => {
  for (const interval of [3, 5])
    for (let level = 0; level <= 20; level++) {
      const expected = 2 + (level < 2 ? 0 : 1 + Math.floor((level - 2) / interval));
      assert.equal(campaignInterestCount(level, 0, { interestInterval: interval }), expected);
      const s = computeAgent(agent(level), items, cfg, {
        campaignEffects: { interestInterval: interval, xpToLevelFraction: 0.5 }
      });
      assert.equal(s.interestPicks.available, expected);
      assert.equal(s.xpNext, level === 20 ? null : Math.floor(cfg.tables.levels[level + 1].xp / 2));
    }
});
test("the world provider applies only active mission qualities and reports conflicting cadences without choosing an array order", () => {
  const before = globalThis.game;
  try {
    const season = { qualities: ["fast-attributes", "fast-growth"] };
    const mission = { active: false, qualities: ["slow-attributes"] };
    globalThis.game = { settings: { get: (_id, key) => (key === "campaign" ? season : mission) } };
    assert.equal(currentCampaignRules().effects.attributeInterval, 3);
    mission.active = true;
    const result = currentCampaignRules();
    assert.equal(result.effects.attributeInterval, undefined);
    assert.equal(result.effects.xpToLevelFraction, 0.5);
    assert.ok(result.conflicts.some(c => c.key === "attributeInterval"));
  } finally {
    globalThis.game = before;
  }
});

test("Fragile replaces only later dice, retains Constitution and level minimums, and suppresses missing-roll tasks", () => {
  for (const [die, fixed] of [
    [8, 2],
    [10, 3],
    [12, 4]
  ])
    for (const con of [2, 12, 18]) {
      const s = agent(3);
      s.abilities.con.base = con;
      s.progression[1].vitality = 0;
      s.progression[2].vitality = die;
      const cls = structuredClone(items[0]);
      cls.system.vitalityDie = die;
      computeAgent(s, [cls], cfg, { campaignEffects: { fixedVitalityByDie: { 8: 2, 10: 3, 12: 4 } } });
      const modifier = Math.floor((con - 10) / 2);
      assert.equal(s.vitality.max, Math.max(1, die + modifier) + 2 * Math.max(1, fixed + modifier));
      assert.ok(!s.todo.some(t => /Vitality not rolled/.test(t.text)));
      assert.equal(s.progression[1].vitality, 0);
      assert.equal(s.progression[2].vitality, die);
    }
});
test("Big Budget adds four Wealth and Soap adds one open Subplot without changing class progression", () => {
  const base = computeAgent(agent(3), items, cfg);
  const changed = computeAgent(agent(3), items, cfg, { campaignEffects: { startingWealth: 4, extraSubplots: 1 } });
  assert.equal(changed.wealth.total, base.wealth.total + 4);
  assert.equal(changed.subplotPicks.available, base.subplotPicks.available + 1);
  assert.deepEqual(changed.base, base.base);
});
