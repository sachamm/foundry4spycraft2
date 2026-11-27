import test from "node:test";
import assert from "node:assert/strict";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { SKILLS, TABLES } from "../module/rules/tables.mjs";
import {
  abilityIncreaseLevels,
  campaignFeatTrades,
  featPurchasePlan,
  campaignGearCaliber,
  campaignInterestBase,
  campaignLevelRow,
  campaignRuleLines,
  fragileVitality,
  setCampaignRulesSource
} from "../module/rules/campaign-rules.mjs";
import { buildPacks } from "./lib/pack-docs.mjs";

const classes = Object.fromEntries(buildPacks().packs.classes.docs.map(d => [d.name, d]));

function agent(levels = 1, className = "Soldier", extra = {}) {
  const doc = classes[className];
  const sys = {
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 10, misc: 0 }])),
    pointBuyBudget: 36,
    abilityIncreases: { l4: "", l8: "", l12: "", l16: "", l20: "" },
    progression: Array.from({ length: levels }, () => ({ classId: doc.system.identifier, vitality: 1, skills: {} })),
    skills: Object.fromEntries(SKILLS.map(s => [s.key, { ability: "", misc: 0, classSkill: false }])),
    proficiencies: Object.fromEntries(
      Object.keys(cfg.proficiencies).map(k => [k, { proficient: false, forte: false }])
    ),
    focuses: { cultures: [], drive: [], profession: [], science: [], fortes: [] },
    interests: "",
    contacts: [],
    subplots: [],
    wealthAllocation: { lifestyle: 0, possessions: 0, spendingCash: 0 },
    misc: {},
    vitality: { value: 0 },
    wounds: { value: 0 },
    actionDice: { value: 0 },
    xp: 0
  };
  Object.assign(sys, extra);
  computeAgent(sys, [{ id: "c", name: doc.name, type: doc.type, system: structuredClone(doc.system) }], cfg);
  return sys;
}

test("with no growth quality, Table 1.3 is unchanged", () => {
  for (const row of TABLES.levels) assert.equal(campaignLevelRow(row, {}), row);
  assert.deepEqual(abilityIncreaseLevels({}), [4, 8, 12, 16, 20]);
  for (const row of TABLES.interests) assert.equal(campaignInterestBase(row[0], row[1], {}), row[1]);
});

test("the formulas reproduce Table 1.3 at the standard intervals", () => {
  const standard = { attributeInterval: 4, featInterval: 3, interestInterval: 4, proficiencyInterval: 2 };
  // Force the formula path with a fraction of exactly 1 but a non-standard marker removed: compare by hand.
  for (const row of TABLES.levels.slice(1)) {
    assert.equal(1 + Math.floor(row.level / standard.featInterval), row.feats);
    assert.equal(Math.floor(row.level / standard.attributeInterval), row.abilityIncreases);
    assert.equal(Math.floor((row.level - 1) / standard.proficiencyInterval), row.proficiencies);
  }
  for (const row of TABLES.interests) assert.equal(2 + (row[0] >= 2 ? 1 + Math.floor((row[0] - 2) / 4) : 0), row[1]);
});

test("Fast and Slow qualities change the schedule", () => {
  const fast = {
    featInterval: 2,
    attributeInterval: 3,
    proficiencyInterval: 1,
    interestInterval: 3,
    xpToLevelFraction: 0.5
  };
  const row6 = campaignLevelRow(TABLES.levels[6], fast);
  assert.equal(row6.feats, 4);
  assert.equal(row6.abilityIncreases, 2);
  assert.equal(row6.proficiencies, 5);
  assert.equal(row6.xp, Math.floor(TABLES.levels[6].xp / 2));
  assert.deepEqual(abilityIncreaseLevels({ attributeInterval: 5 }), [5, 10, 15, 20]);
  assert.equal(campaignInterestBase(5, 3, { interestInterval: 3 }), 4);
  assert.ok(campaignRuleLines(fast).some(line => line.includes("feat every 2")));
});

test("the engine follows the qualities in force", t => {
  t.after(() => setCampaignRulesSource(null));
  const before = agent(6);
  setCampaignRulesSource(() => ({
    featInterval: 2,
    pointBuy: 32,
    wealthBonus: 4,
    fixedVitality: true,
    allClassSkills: true
  }));
  const after = agent(6);
  assert.equal(after.feats.any.slots, before.feats.any.slots + 1);
  assert.equal(after.pointBuy.budget, 32);
  assert.equal(after.wealth.total, before.wealth.total + 4);
  // Soldier vitality is d12: 4 a level after the first instead of the rolled 1.
  assert.equal(after.vitality.max, before.vitality.max + 5 * 3);
  assert.equal(fragileVitality(10, { fixedVitality: true }), 3);
  assert.ok(Object.values(after.skillTotals ?? {}).length);
});

test("budget qualities shift gear Calibers", () => {
  assert.deepEqual(campaignGearCaliber(3, { gearCaliberShift: 1 }), {
    caliber: 4,
    shift: 1,
    pastV: false,
    lost: false
  });
  assert.equal(campaignGearCaliber(5, { gearCaliberShift: 1 }).pastV, true);
  assert.equal(campaignGearCaliber(1, { gearCaliberShift: -1 }).lost, true);
  assert.equal(campaignGearCaliber(2, {}).caliber, 2);
});

test("Feat Purchase, Modular, Soap and Routine reach the sheet", t => {
  t.after(() => setCampaignRulesSource(null));
  const trades = { featTrades: { purchased: 1, modular: 2 }, crossroadsTitle: "" };
  const before = agent(3, "Soldier", trades);
  assert.ok(before.warnings.some(line => line.includes("Feat Purchase is not in force")));
  assert.equal(before.pointBuy.budget, 36);
  setCampaignRulesSource(() => ({ featPurchase: true, modularFeats: true, subplotLimitBonus: 1 }));
  const after = agent(3, "Soldier", trades);
  assert.equal(after.feats.any.slots, before.feats.any.slots + 3);
  assert.equal(after.pointBuy.budget, 32);
  assert.equal(after.subplotPicks.available, before.subplotPicks.available + 1);
  assert.deepEqual(campaignFeatTrades({ modular: -1 }, { modularFeats: true }), {
    feats: -1,
    points: 2,
    purchased: 0,
    modular: -1,
    problems: []
  });
});

test("a purchased feat costs 1,000 XP per level and cannot drop below the level's minimum", () => {
  const effects = { featPurchase: true };
  assert.equal(featPurchasePlan({ level: 2, xp: 6000 }, { xp: 3000 }, {}).allowed, false);
  const plan = featPurchasePlan({ level: 2, xp: 6000 }, { xp: 3000 }, effects);
  assert.deepEqual([plan.allowed, plan.cost, plan.xp], [true, 2000, 4000]);
  assert.equal(featPurchasePlan({ level: 2, xp: 4000 }, { xp: 3000 }, effects).allowed, false);
});

test("Routine leaves a Crossroads Title without benefits", t => {
  t.after(() => setCampaignRulesSource(null));
  const titled = agent(3, "Soldier", { crossroadsTitle: "seasoned" });
  assert.equal(titled.crossroads.actionDice, 1);
  setCampaignRulesSource(() => ({ noCrossroads: true }));
  const routine = agent(3, "Soldier", { crossroadsTitle: "seasoned" });
  assert.equal(routine.crossroads.actionDice, 0);
  assert.equal(routine.actionDice.max, titled.actionDice.max - 1);
  assert.ok(routine.warnings.some(line => line.startsWith("Routine is in force")));
});
