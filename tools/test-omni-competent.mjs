import test from "node:test";
import assert from "node:assert/strict";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { resolveKnowledgeCheck } from "../module/rules/knowledge.mjs";
import { campaignSkillPolicy } from "../module/rules/campaign-skills.mjs";
import { campaignEffects, activeQualities } from "../module/rules/gc/campaign.mjs";
import { rollNpcSkill, npcSkillPlan } from "../module/apps/gc/npc-play.mjs";
import { skillPenaltyValue } from "../module/rules/skill-penalties.mjs";
import { RollPipeline, planTotal } from "../module/rules/roll-pipeline.mjs";
const effects = campaignEffects(activeQualities(["omni-competent"])).effects;
const state = (campaign = effects) => ({
  campaignEffects: campaign,
  activeFeatNames: [],
  knowledgeStandardBonus: 10,
  abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(key => [key, { value: 12, mod: 1 }])),
  skillTotals: Object.fromEntries(
    Object.entries(cfg.skills).map(([key, skill]) => [
      key,
      {
        name: skill.name,
        ranks: 5,
        cap: 15,
        threat: 20,
        totals: skill.abilities.map(ability => ({ ability, total: 8, normalSkillBonus: 8 }))
      }
    ])
  )
});
const opts = { gearStatus: "available", synergySkill: "none" };

test("Omni-Competent removes named skill caps and makes every canonical check active", () => {
  for (const [key, skill] of Object.entries(cfg.skills))
    for (const check of skill.checks) {
      const p = resolveSkillCheck(state(), key, check, { ...opts, secret: true });
      assert.equal(p.cap, null, `${key}/${check.id}`);
      assert.equal(p.mode, "Active");
      assert.equal(p.rollMode, undefined);
      assert.equal(p.actionDiceAllowed, true);
      assert.deepEqual(p.campaignSkillChecks.policy, { version: 1, active: true, uncapped: true, penaltyDivisor: 2 });
    }
  assert.throws(() => campaignSkillPolicy({ campaignEffects: { uncappedSkills: 3 } }), /Review/);
});

test("each odd penalty halves its magnitude independently, retains minimum minus one and leaves bonuses alone", () => {
  for (const [before, after] of [
    [-7, -3],
    [-5, -2],
    [-4, -2],
    [-3, -1],
    [-2, -1],
    [-1, -1],
    [0, 0],
    [3, 3]
  ]) {
    assert.equal(skillPenaltyValue(state(), before), after);
    assert.equal(skillPenaltyValue(state({}), before), before);
  }
  assert.throws(() => skillPenaltyValue(state({ skillPenaltyDivisor: 3 }), -3), /Review/);
  assert.throws(() => skillPenaltyValue(state(), NaN), /modifier/);
});

test("named skills reduce independent ability, misc, gear, condition, armor, vision and situational penalties before conditioning", () => {
  const s = state();
  s.abilities.dex = { value: 4, mod: -3 };
  s.skills = { acrobatics: { misc: -3 } };
  s.skillTotals.acrobatics.bonusEntries = [{ source: "Gear", type: "gear", value: -3 }];
  s.skillTotals.acrobatics.totals = [{ ability: "dex", total: -4, normalSkillBonus: -4 }];
  s.conditionContext = { sickened: true, drunk: true, entangled: true, shakenI: true };
  s.armor = { check: -3, visionCheck: -3 };
  const check = {
    id: "test",
    name: "Test",
    mode: "Active",
    attributes: ["dex"],
    tags: ["Armor Check Penalty", "Vision"],
    time: "1 Half Action",
    error: 1,
    synergies: []
  };
  const p = resolveSkillCheck(s, "acrobatics", check, { modifier: -3, synergySkill: "none" });
  assert.equal(p.skillBonus, 2);
  assert.equal(p.checkAdjustment, -7); // Shaken does not penalize Dexterity checks.
  assert.equal(p.total, -5);
  assert.match(p.notes, /Situational modifier: -3 → -1/);
  s.conditionContext.baffled = true;
  assert.equal(resolveSkillCheck(s, "acrobatics", check, { modifier: -3, synergySkill: "none" }).total, -6);
  s.conditionContext.incompetent = true;
  assert.equal(resolveSkillCheck(s, "acrobatics", check, { modifier: -3, synergySkill: "none" }).total, -7);
});

test("Knowledge keeps synergy and conditioning separate from each reduced penalty", () => {
  const s = state();
  s.knowledgeStandardBonus = -4;
  s.knowledgeBonusEntries = [{ source: "Source", type: "gear", value: -3 }];
  s.abilities.int = { value: 4, mod: -3 };
  s.misc = { knowledge: -3 };
  s.conditionContext = { sickened: true };
  const p = resolveKnowledgeCheck(s, { skill: "analysis", modifier: -3 });
  assert.equal(p.skillBonus, 2);
  assert.equal(p.checkAdjustment, -2);
  assert.equal(p.total, 1); // Five relevant ranks still grant the ordinary +1 synergy.
  assert.match(p.notes, /Situational modifier: -3 → -1/);
});

test("plan contributors halve their own penalties rather than the combined negative sum", () => {
  const pipeline = new RollPipeline();
  pipeline.register({
    id: "penalties",
    stage: "plan",
    modifiers: () => [
      { label: "First", value: -3 },
      { label: "Second", value: -3 },
      { label: "Bonus", value: 4 }
    ]
  });
  const p = planTotal("skill", { system: state() }, [["Base", 10]], pipeline);
  assert.equal(p.total, 12);
  assert.deepEqual(
    p.planModifiers.map(row => row.value),
    [-1, -1, 4]
  );
  assert.equal(planTotal("attack", { system: state() }, [["Base", 10]], pipeline).total, 8);
});

test("NPC skill rolls preserve the strongest morale source and reduce quality, attribute and situational penalties separately", async () => {
  globalThis.CONFIG = { SPYCRAFT: cfg };
  globalThis.foundry = { utils: { escapeHTML: String } };
  const actor = {
    isOwner: true,
    system: {
      ...state({ ...effects, socialCheckMorale: -4 }),
      npcType: "standard",
      npcProfile: { enabled: true },
      competence: 5,
      conditionContext: { shakenI: true },
      qualityEffects: { skillOptions: [{ id: "penalty", label: "Quality", modifier: -3, skills: ["impress"] }] }
    },
    rollCheck: async (_formula, data, options) => ({ data, options })
  };
  actor.system.abilities.cha = { value: 4, mod: -3 };
  const p = await rollNpcSkill(actor, {
    key: "impress/persuasion",
    ability: "cha",
    modifier: -3,
    "quality-penalty": true,
    secret: true
  });
  assert.equal(p.data.total, 0); // 5 competence −1 attribute −1 situation −1 quality −2 strongest morale.
  assert.match(p.options.flavor, /Situational modifier: -3 → -1/);
  p.options.validateSkillContext();
  actor.system.campaignEffects.skillPenaltyDivisor = 1;
  assert.throws(() => p.options.validateSkillContext(), /changed before posting/);
});

test("derived sheet figures and actual named/Knowledge checks agree without applying the reduction twice", () => {
  const data = {
    abilities: Object.fromEntries(
      ["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: ["dex", "int"].includes(k) ? 4 : 10 }])
    ),
    progression: [{ classId: "test", vitality: 4, skills: { acrobatics: 2 } }],
    skills: { acrobatics: { misc: -3, ability: "dex" } },
    misc: { knowledge: -3 }
  };
  const cls = {
    id: "test",
    name: "Test",
    type: "class",
    system: {
      identifier: "test",
      table: [],
      classSkills: ["acrobatics"],
      vitalityDie: 8,
      skillPoints: 4,
      bonuses: [
        { target: "skills.acrobatics.misc", value: "-3", bonusType: "gear" },
        { target: "knowledge", value: "-3", bonusType: "gear" }
      ]
    }
  };
  const origin = {
    id: "origin",
    name: "Penalty fixture",
    type: "origin",
    system: { originType: "talent", bonuses: cls.system.bonuses }
  };
  const normal = computeAgent(structuredClone(data), [cls, origin], cfg);
  const omni = computeAgent(structuredClone(data), [cls, origin], cfg, { campaignEffects: effects });
  assert.equal(normal.skillTotals.acrobatics.total, -7);
  assert.equal(omni.skillTotals.acrobatics.total, -1);
  const p = resolveSkillCheck(
    omni,
    "acrobatics",
    cfg.skills.acrobatics.checks.find(c => c.id === "balance"),
    { synergySkill: "none" }
  );
  assert.equal(p.total, -1);
  assert.equal(normal.knowledge, -8);
  assert.equal(omni.knowledge, -2);
  assert.equal(resolveKnowledgeCheck(omni, { skill: "acrobatics" }).total, -2);
});

test("uncapped current skill figures preserve purchase rank limits and skill-point budgets", () => {
  const data = {
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 10 }])),
      progression: [{ classId: "test", vitality: 4, skills: { analysis: 2 } }],
      misc: {}
    },
    cls = {
      id: "test",
      name: "Test",
      type: "class",
      system: { identifier: "test", table: [], classSkills: [], vitalityDie: 8, skillPoints: 4 }
    },
    normal = computeAgent(structuredClone(data), [cls], cfg),
    omni = computeAgent(structuredClone(data), [cls], cfg, { campaignEffects: effects });
  for (const key of Object.keys(cfg.skills)) {
    assert.equal(omni.skillTotals[key].cap, null);
    assert.equal(omni.skillTotals[key].ranks, normal.skillTotals[key].ranks);
    assert.equal(omni.skillTotals[key].maxRanks, normal.skillTotals[key].maxRanks);
  }
  assert.deepEqual(omni.skillPoints, normal.skillPoints);
});

test("Knowledge becomes active without granting Photographic Memory taking permissions", () => {
  const old = resolveKnowledgeCheck(state({}), { skill: "analysis" }),
    omni = resolveKnowledgeCheck(state(), { skill: "analysis" });
  assert.equal(old.rollMode, "blindroll");
  assert.equal(old.actionDiceAllowed, false);
  assert.equal(omni.rollMode, undefined);
  assert.equal(omni.actionDiceAllowed, true);
  assert.equal(omni.blocked, false, omni.blockedReason);
  assert.equal(omni.total, old.total);
  assert.equal(omni.requiredTimeSeconds, old.requiredTimeSeconds);
  assert.equal(omni.campaignSkillChecks.policy.active, true);
  const taking = resolveKnowledgeCheck(state(), { skill: "analysis", method: "take10", safeToTake: true });
  assert.equal(taking.blocked, true);
  assert.match(taking.blockedReason, /Photographic Memory/);
});

test("actual NPC checks save uncapped campaign policy and reject a changed policy before posting", async () => {
  globalThis.CONFIG = { SPYCRAFT: cfg };
  globalThis.game = { user: { isGM: true } };
  for (const npcType of ["standard", "special", "villain"])
    for (const enabled of [false, true]) {
      const actor = {
          isOwner: true,
          system: { ...state(), npcType, competence: 5, npcProfile: { enabled } },
          rollCheck: async (_formula, data, options) => ({ data, options })
        },
        result = await rollNpcSkill(actor, { key: "impress/persuasion", ability: "cha", manualBonus: 5 });
      assert.equal(npcSkillPlan(actor, "impress").cap, null);
      assert.equal(result.options.cap, null);
      assert.equal(result.options.campaignSkillChecks.policy.active, true);
      result.options.validateSkillContext();
      actor.system.campaignEffects = {};
      assert.throws(() => result.options.validateSkillContext(), /changed before posting/);
    }
});

test("actual PC named and Knowledge entry points bind policy changes in either direction", async () => {
  globalThis.Actor = class {
    constructor() {
      this.system = state();
      this.items = [];
      this.type = "agent";
      this.uuid = "Actor.omni";
      this.isOwner = true;
    }
  };
  globalThis.CONFIG = { SPYCRAFT: cfg };
  globalThis.game = {
    user: { id: "gc", isGM: true },
    settings: { get: () => false },
    i18n: { localize: String },
    actors: []
  };
  globalThis.foundry = { utils: { escapeHTML: String } };
  globalThis.ui = { notifications: { warn: () => null } };
  const { SpycraftActor } = await import("../module/documents/actor.mjs"),
    actor = new SpycraftActor();
  actor.rollCheck = async (_formula, data, options) => ({ data, options });
  for (const roll of [
    () => actor.rollSkill("impress", "cha", { check: "persuasion", ...opts }),
    () => actor.rollKnowledge({ skill: "analysis" })
  ]) {
    actor.system.campaignEffects = effects;
    let result = await roll();
    assert.equal(result.options.campaignSkillChecks.policy.active, true);
    result.options.validateSkillContext();
    actor.system.campaignEffects = {};
    assert.throws(() => result.options.validateSkillContext(), /changed before/);
    result = await roll();
    assert.equal(result.options.campaignSkillChecks, null);
    actor.system.campaignEffects = effects;
    assert.throws(() => result.options.validateSkillContext(), /changed before/);
  }
});
