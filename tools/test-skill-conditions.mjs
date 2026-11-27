import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { skillBonusCondition } from "../module/rules/skill-conditions.mjs";
import { isolatedClassAbilityCalculation as computeAgent } from "./lib/class-ability-fixture.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { resolveKnowledgeCheck } from "../module/rules/knowledge.mjs";
import { substituteSkillBonus, nestPlan } from "../module/rules/breakthrough.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const defs = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))),
  soldier = defs.find(c => c.key === "soldier"),
  items = [
    {
      id: "soldier",
      name: "Soldier",
      type: "class",
      system: { ...soldier, identifier: "soldier", vitalityDie: soldier.vitality }
    }
  ],
  keys = ["athletics", "search", "tactics", "resolve", "notice", "drive"];
function compute(conditions = {}) {
  return computeAgent(
    {
      abilities: Object.fromEntries(
        Object.entries({ str: 12, dex: 13, con: 14, int: 15, wis: 12, cha: 11 }).map(([k, base]) => [k, { base }])
      ),
      conditionContext: conditions,
      progression: Array.from({ length: 4 }, (_, i) => ({
        classId: "soldier",
        vitality: 6,
        skills: Object.fromEntries(keys.map(k => [k, i ? 1 : 4]))
      })),
      actionDice: { value: 3 },
      vitality: { value: 4 },
      wounds: { value: 4 }
    },
    structuredClone(items),
    cfg
  );
}
const options = { gearStatus: "available", synergySkill: "none", trackingSurface: "verySoft" };
test("RAW pp.340,342 Baffled halves the signed skill bonus rounded up; Incompetent sets it to +0 with precedence", () => {
  for (const normal of [-5, -4, -1, 0, 1, 2, 5, 6]) {
    assert.equal(
      skillBonusCondition({ conditionContext: { baffled: true } }, normal).total,
      Math.ceil(normal / 2) || 0
    );
    assert.equal(skillBonusCondition({ conditionContext: { incompetent: true } }, normal).total, 0);
    assert.equal(skillBonusCondition({ conditionContext: { baffled: true, incompetent: true } }, normal).total, 0);
    assert.equal(skillBonusCondition({}, normal).total, normal);
  }
  assert.throws(() => skillBonusCondition({}, Infinity), /Review/);
});
test("all thirty skills and alternate attributes display the conditioned bonus without changing ranks, caps, purchases or other statistics", () => {
  const a = compute(),
    b = compute({ baffled: true }),
    c = compute({ incompetent: true });
  for (const [key, s] of Object.entries(a.skillTotals)) {
    for (const row of s.totals) {
      assert.equal(
        b.skillTotals[key].totals.find(t => t.ability === row.ability).total,
        Math.ceil(row.total / 2) || 0,
        key + "/" + row.ability
      );
      assert.equal(c.skillTotals[key].totals.find(t => t.ability === row.ability).total, 0);
    }
    for (const condition of [b, c]) {
      assert.equal(condition.skillTotals[key].ranks, s.ranks);
      assert.equal(condition.skillTotals[key].cap, s.cap);
      assert.equal(condition.skillTotals[key].purchasedRanks, s.purchasedRanks);
    }
  }
  assert.deepEqual(a.skillPoints, b.skillPoints);
  assert.deepEqual(a.skillPoints, c.skillPoints);
  for (const condition of [b, c]) {
    assert.equal(condition.bab, a.bab);
    assert.equal(condition.defense.total, a.defense.total);
    assert.deepEqual(condition.saves, a.saves);
    assert.equal(condition.actionDice.value, 3);
  }
});
test("every named use applies the reduction once while preserving its own error, threat, cap and separate modifiers", () => {
  const a = compute(),
    b = compute({ baffled: true }),
    c = compute({ incompetent: true });
  let checked = 0;
  for (const [key, skill] of Object.entries(cfg.skills))
    for (const check of skill.checks)
      for (const ability of check.attributes) {
        const n = resolveSkillCheck(a, key, check, { ...options, ability, modifier: 3 }),
          half = resolveSkillCheck(b, key, check, { ...options, ability, modifier: 3 }),
          zero = resolveSkillCheck(c, key, check, { ...options, ability, modifier: 3 });
        if (!n) continue;
        const separate = n.total - n.skillBonusCondition.total;
        assert.equal(half.total, Math.ceil(n.skillBonusCondition.normal / 2) + separate || 0, key + "/" + check.id);
        assert.equal(zero.total, separate || 0, key + "/" + check.id);
        for (const p of [half, zero]) {
          assert.equal(p.cap, n.cap);
          assert.equal(p.error, n.error);
          assert.equal(p.threat, n.threat);
        }
        checked++;
      }
  assert.ok(checked >= 100);
});
test("Sickened, Drunk, Entangled, armor and discretionary check penalties are not halved or erased", () => {
  const a = compute(),
    b = compute({ baffled: true, sickened: true, drunk: true, entangled: true }),
    check = cfg.skills.acrobatics.checks.find(c => c.id === "balance");
  b.armor = { check: -2 };
  const n = resolveSkillCheck(a, "acrobatics", check, { ...options, ability: "dex" }),
    r = resolveSkillCheck(b, "acrobatics", check, { ...options, ability: "dex", modifier: 3 });
  const acp = check.tags.includes("Armor Check Penalty") ? -2 : 0;
  assert.equal(r.total, Math.ceil(n.skillBonusCondition.normal / 2) - 2 - 2 - 4 + acp + 3);
  assert.equal(r.checkAdjustment, -2 - 2 - 4 + acp + 3);
  b.classLevels.schemer = b.activeClassLevels.schemer = 4;
  const changed = resolveSkillCheck(b, "acrobatics", check, { ...options, ability: "dex", allAccordingToPlan: true });
  const base = n.normalSkillBonus + b.abilities.int.mod - b.abilities.dex.mod;
  assert.equal(changed.total, Math.ceil(base / 2) - 2 + acp);
  assert.equal(changed.ability, "int");
});
test("conditional character/gear bonuses are reduced with the bonus; named synergy stays separate", () => {
  const s = compute({ baffled: true });
  s.classOptionSelections.push({ classId: "scientist", name: "Elbow Grease" });
  const skill = s.skillTotals.mechanics;
  skill.bonusEntries = [{ type: "gear", value: 2 }];
  for (const row of skill.totals) {
    row.normalSkillBonus = 10;
    row.skillBonus = 5;
    row.total = 5;
  }
  const c = cfg.skills.mechanics.checks.find(c => c.id === "repair"),
    r = resolveSkillCheck(s, "mechanics", c, { ...options, ability: "int", modifier: 3 });
  assert.equal(r.skillBonusCondition.normal, 12);
  assert.equal(r.skillBonusCondition.total, 6);
  assert.equal(r.total, 9);
  s.conditionContext.incompetent = true;
  assert.equal(resolveSkillCheck(s, "mechanics", c, { ...options, ability: "int", modifier: 3 }).total, 3);
});
test("Knowledge follows the standard skill-check condition while related-rank/PhD synergy remains a check modifier", () => {
  for (const state of ["baffled", "incompetent"]) {
    const s = compute({ [state]: true, sickened: true });
    s.skillTotals.search.ranks = 16;
    s.knowledgePhdSkills = ["search"];
    const r = resolveKnowledgeCheck(s, { skill: "search", modifier: 3 });
    assert.equal(r.skillBonusCondition.normal, s.knowledgeStandardBonus);
    assert.equal(r.synergy, 8);
    assert.equal(r.total, (state === "baffled" ? Math.ceil(s.knowledgeStandardBonus / 2) : 0) + 8 + 3 - 2);
    assert.equal(s.knowledge, (state === "baffled" ? Math.ceil(s.knowledgeStandardBonus / 2) : 0) - 2);
  }
});
test("skill-bonus replacement reuses the original bonus and reduces the combined bonus once, retaining typed stacking", () => {
  for (const state of ["baffled", "incompetent"]) {
    const source = {
        normalSkillBonus: 20,
        skillBonus: state === "baffled" ? 10 : 0,
        skillBonusEntries: [{ type: "gear", value: 2 }],
        skillBonusCondition: { state }
      },
      target = {
        skillBonusCondition: { state },
        checkBonusEntries: [
          { type: "gear", value: 4 },
          { type: "synergy", value: 5 }
        ],
        checkAdjustment: -2
      },
      r = substituteSkillBonus(source, target);
    assert.equal(r.total, (state === "baffled" ? 11 : 0) + 5 - 2);
    assert.equal(r.skillBonusCondition.normal, 22);
  }
  const s = compute({ baffled: true });
  s.classLevels.sniper = s.activeClassLevels.sniper = 4;
  s.classOptionSelections.push({ classId: "sniper", name: "Nest" });
  s.skillTotals.tactics.bonusEntries = [{ type: "gear", value: 2 }];
  for (const t of s.skillTotals.tactics.totals) {
    t.normalSkillBonus = 20;
    t.skillBonus = 10;
    t.total = 8;
  }
  const target = {
      ability: "dex",
      skillBonusCondition: { state: "baffled" },
      checkBonusEntries: [
        { type: "gear", value: 4 },
        { type: "synergy", value: 3 }
      ],
      checkAdjustment: -2
    },
    r = nestPlan(s, cfg, target, {
      skillKey: "sneak",
      checkId: "hide",
      halfCoverConfirmed: true,
      sourceAbility: "wis"
    });
  assert.equal(r.total, 12);
  assert.equal(r.nest.skillBonusCondition.normal, 22);
});
globalThis.Actor = class {
  constructor() {
    this.type = "agent";
    this.isOwner = true;
    this.uuid = "Actor.conditions";
    this.system = compute({ baffled: true });
    this.items = [];
    this.statuses = new Set();
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = { user: { isGM: true }, settings: { get: () => false }, i18n: { localize: String } };
globalThis.foundry = {
  utils: { escapeHTML: String },
  applications: { api: { DialogV2: { input: async () => ({ resistingBaffled: true }) } } }
};
globalThis.ui = { notifications: { warn: () => null } };
const { SpycraftActor } = await import("../module/documents/actor.mjs");
test("all three actual saves receive +8 only while Baffled and when resisting that condition", async () => {
  const a = new SpycraftActor();
  a.rollCheck = async (formula, data, options) => ({ data, options });
  for (const key of ["fort", "ref", "will"]) {
    const n = await a.rollSave(key),
      r = await a.rollSave(key, { resistingBaffled: true });
    assert.equal(r.data.total, n.data.total + 8);
    assert.equal(r.options.baffledSaveBonus, 8);
    assert.equal((await a.rollSave(key, { resistingBaffled: "true" })).options.baffledSaveBonus, 0);
  }
  const dialog = await a.rollSave("will", { askContext: true });
  assert.equal(dialog.options.baffledSaveBonus, 8);
  a.system.conditionContext.baffled = false;
  assert.equal((await a.rollSave("will", { resistingBaffled: true })).options.baffledSaveBonus, 0);
});
test("actual skill and Knowledge entries retain condition arithmetic in their roll receipts", async () => {
  const a = new SpycraftActor();
  a.rollCheck = async (formula, data, options) => ({ data, options });
  const s = await a.rollSkill("athletics", "str", { check: "power-lifting", ...options }),
    k = await a.rollKnowledge({ skill: "search" });
  assert.equal(s.options.skillBonusCondition.state, "baffled");
  assert.equal(s.options.skillBonusCondition.total, Math.ceil(s.options.skillBonusCondition.normal / 2));
  assert.equal(k.options.skillBonusCondition.state, "baffled");
  assert.equal(k.options.skillBonusCondition.total, Math.ceil(k.options.skillBonusCondition.normal / 2));
});
