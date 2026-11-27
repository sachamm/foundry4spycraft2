import test from "node:test";
import assert from "node:assert/strict";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { resolveKnowledgeCheck } from "../module/rules/knowledge.mjs";
import { campaignSkillPolicy } from "../module/rules/campaign-skills.mjs";
import { campaignEffects, activeQualities } from "../module/rules/gc/campaign.mjs";
import { rollNpcSkill, npcSkillPlan } from "../module/apps/gc/npc-play.mjs";
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
      assert.deepEqual(p.campaignSkillChecks.policy, { version: 1, active: true, uncapped: true });
    }
  assert.throws(() => campaignSkillPolicy({ campaignEffects: { uncappedSkills: 3 } }), /Review/);
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
