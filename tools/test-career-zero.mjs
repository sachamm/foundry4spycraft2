import test from "node:test";
import assert from "node:assert/strict";
import { buildPacks } from "./lib/pack-docs.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { featAcquisitionLevel, isCareerZeroCreation } from "../module/rules/career-zero.mjs";
import { captureFeatAcquisition, historicalFeatEligibility } from "../module/rules/feat-acquisition.mjs";

const docs = Object.values(buildPacks().packs).flatMap(pack => pack.docs);
const item = (name, type) => {
  const value = structuredClone(docs.find(doc => doc.name === name && doc.type === type));
  value.id = value._id;
  return value;
};
const base = level => ({
  originOnlyCreation: true,
  pointBuyBudget: 36,
  abilities: Object.fromEntries(
    ["str", "dex", "con", "int", "wis", "cha"].map((key, i) => [key, { base: i < 3 ? 14 : 12 }])
  ),
  progression: level ? [{ classId: "soldier", vitality: 12, skills: {} }] : [],
  focuses: { science: ["Biology"] },
  skills: {},
  misc: {},
  proficiencies: {},
  conditionContext: {}
});

test("actual Origin bonus feats can be acquired at Career Level 0 without treating legacy zero as known history", () => {
  const training = item("Training", "feat");
  Object.assign(training.system, {
    acquiredAtLevel: 0,
    acquiredAtCareerZero: true,
    trainingSkills: { acrobatics: 2, athletics: 3 }
  });
  training.system.acquisitionCheck = captureFeatAcquisition(
    { system: { level: 0 }, checkPrerequisites: () => ({ ok: true, unmet: [] }) },
    training.system
  );
  assert.equal(training.system.acquisitionCheck.level, 0);
  assert.equal(historicalFeatEligibility(training.system).ok, true);
  const items = [item("Brainy", "origin"), item("Researcher", "origin"), training];
  const sys = computeAgent(base(0), items, cfg);
  assert.ok(sys.activeFeatNames.includes("Training"));
  assert.equal(sys.featStatus[training.id].ok, true);
  assert.equal(sys.feats.trees.advancedSkill.spent, 1);
  assert.equal(sys.feats.trees.advancedSkill.slots, 1);
  assert.equal(sys.bankedTrainingPoints, 5);
  assert.equal(sys.skillTotals.acrobatics.ranks, 0);
  assert.equal(sys.skillTotals.athletics.ranks, 0);
  assert.equal(sys.maxRanks, 0);
  assert.ok(!sys.todo.some(task => /first class level/.test(task.text)));

  const later = computeAgent(base(1), [...items, item("Soldier", "class")], cfg);
  assert.equal(later.bankedTrainingPoints, 0);
  assert.equal(later.skillTotals.acrobatics.ranks, 2);
  assert.equal(later.skillTotals.athletics.ranks, 3);
  assert.equal(later.featStatus[training.id].ok, true);

  const legacy = structuredClone(training);
  legacy.system.acquiredAtCareerZero = false;
  delete legacy.system.acquisitionCheck;
  const unknown = computeAgent(base(0), [...items.filter(i => i.id !== training.id), legacy], cfg);
  assert.equal(unknown.activeFeatNames.includes("Training"), false);
  assert.equal(featAcquisitionLevel(legacy.system), 1);
});

test("ordinary new characters still receive first-class guidance and explicit zero history cannot evade historical checks", () => {
  const sys = computeAgent({ ...base(0), originOnlyCreation: false }, [], cfg);
  assert.ok(sys.todo.some(task => /first class level/.test(task.text)));
  assert.equal(isCareerZeroCreation(sys), false);
  const feat = { acquiredAtLevel: 0, acquiredAtCareerZero: true, tree: "advancedSkill" };
  feat.acquisitionCheck = captureFeatAcquisition(
    { system: { level: 0 }, checkPrerequisites: () => ({ ok: true, unmet: [] }) },
    feat
  );
  assert.equal(historicalFeatEligibility({ ...feat, acquiredAtCareerZero: false }).ok, false);
  assert.equal(historicalFeatEligibility({ ...feat, acquiredAtLevel: 1 }).ok, false);
});
