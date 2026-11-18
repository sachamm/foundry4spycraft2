import test from "node:test";
import assert from "node:assert/strict";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { cardSharkProfessionPlan, cardSharkKnowledgePlan } from "../module/rules/card-shark.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { resolveKnowledgeCheck } from "../module/rules/knowledge.mjs";
import { actionDieBoostPlan, actionDieBoostResult, generousBoostPlan } from "../module/rules/action-dice.mjs";
import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
const state = () => ({
  activeFeatNames: ["Card Shark"],
  coreClassIds: [],
  knowledge: 8,
  abilities: { int: { mod: 2 } },
  actionDice: { value: 6, die: 4, explodeAt: 4, bonus: 0 },
  skillTotals: Object.fromEntries(
    Object.values(cfg.skills).map(s => [
      s.key,
      {
        name: s.name,
        ranks: 10,
        cap: 40,
        threat: 20,
        focus: s.focus,
        totals: s.abilities.map(ability => ({ ability, total: 12 }))
      }
    ])
  )
});
const gambling = {
  checkKind: "skill",
  skillKey: "streetwise",
  checkId: "gambling",
  ability: "wis",
  rawTotal: 10,
  cap: 40,
  actionDiceAllowed: true
};
test("every Profession use gains automatic Streetwise rank synergy with ordinary same-type stacking, even when no optional synergy is selected", () => {
  for (const ranks of [0, 3, 4, 5, 9, 10, 24, 25, 50]) {
    const s = state();
    s.skillTotals.streetwise.ranks = ranks;
    for (const c of cfg.skills.profession.checks) {
      const p = resolveSkillCheck(s, "profession", c, { synergySkill: "none", gearStatus: "available" });
      assert.equal(p.cardSharkProfession.synergy, Math.min(5, Math.floor(ranks / 5)));
      assert.ok(p.checkBonusEntries.some(e => e.source === "Card Shark"));
    }
    for (const key of Object.keys(cfg.skills).filter(k => k !== "profession"))
      assert.equal(cardSharkProfessionPlan(s, key), null);
  }
  const s = state(),
    c = cfg.skills.profession.checks[0],
    a = resolveSkillCheck(s, "profession", c, { synergySkill: "none" });
  s.activeFeatNames = [];
  const b = resolveSkillCheck(s, "profession", c, { synergySkill: "none" });
  assert.equal(a.total, b.total + 2);
});
test("all listed gambling Knowledge categories are active without Photographic Memory and cannot grant take 10/20 or unrelated active Knowledge", () => {
  const s = state();
  for (const category of ["rules", "people", "locations"]) {
    const p = resolveKnowledgeCheck(s, {
      skill: "streetwise",
      topic: "A specific gambling question",
      gamblingKnowledge: category,
      active: false
    });
    assert.equal(p.blocked, false, p.blockedReason);
    assert.equal(p.rollMode, undefined);
    assert.equal(p.actionDiceAllowed, true);
    assert.equal(p.cardSharkKnowledge.category, category);
    for (const method of ["take10", "take20"])
      assert.equal(
        resolveKnowledgeCheck(s, {
          skill: "streetwise",
          topic: "A gambling question",
          gamblingKnowledge: category,
          method,
          safeToTake: true
        }).blocked,
        true
      );
  }
  assert.equal(resolveKnowledgeCheck(s, { skill: "streetwise", active: true }).blocked, true);
  assert.equal(resolveKnowledgeCheck(s, { skill: "streetwise" }).rollMode, "blindroll");
  for (const patch of [
    { gamblingKnowledge: "other", topic: "Question" },
    { gamblingKnowledge: "rules", topic: "" },
    { gamblingKnowledge: "rules", topic: "x".repeat(1001) }
  ])
    assert.ok(cardSharkKnowledgePlan(s, patch).blockedReason);
  s.activeFeatNames = [];
  assert.ok(cardSharkKnowledgePlan(s, { gamblingKnowledge: "rules", topic: "Question" }).blockedReason);
});
test("Card Shark forces active action restrictions under Sleeping and remains compatible with Photographic Memory fixed results", () => {
  const s = state(),
    input = { skill: "streetwise", gamblingKnowledge: "rules", topic: "A gambling question" };
  s.conditionContext = { sleeping: true };
  assert.equal(resolveKnowledgeCheck(s, input).blocked, true);
  s.conditionContext = {};
  s.activeFeatNames.push("Photographic Memory");
  assert.equal(resolveKnowledgeCheck(s, { ...input, method: "take10", safeToTake: true }).blocked, false);
});
test("Gambling boosts roll two dice per paid die, stay capped at two with every doubled core and preserve per-die bonuses and the recorded cap", () => {
  for (const core of [[], ["snoop"], ["counterterrorist"], ["snoop", "counterterrorist"]]) {
    const s = state();
    s.coreClassIds = core;
    s.actionDice.bonus = 1;
    for (const count of [1, 2, 3]) {
      const p = actionDieBoostPlan(s, gambling, { count, openingRound: true });
      assert.equal(p.rolls, count * 2);
      assert.equal(p.count, count);
      assert.equal(p.formula.split(" + ").length, count * 2);
      const r = actionDieBoostResult(gambling, p, Array(count * 2).fill(2));
      assert.equal(r.added, count * 6);
      assert.equal(r.boostSpent, count);
      assert.equal(r.effectiveTotal, Math.min(40, 10 + count * 6));
    }
  }
  const s = state();
  for (const patch of [
    { checkKind: "knowledge" },
    { skillKey: "profession" },
    { checkId: "gather-information" },
    { checkKind: "damage" }
  ])
    assert.equal(actionDieBoostPlan(s, { ...gambling, ...patch }, { count: 1 }).rolls, 1);
  s.activeFeatNames = [];
  assert.equal(actionDieBoostPlan(s, gambling, { count: 1 }).rolls, 1);
});
test("a Generous donation stays exactly one donor die even when either character has Card Shark", () => {
  const s = state();
  s.coreClassIds = ["pointman"];
  const p = generousBoostPlan(s, gambling, { teammate: true, perceivedAtRoll: true, sameActor: false });
  assert.equal(p.rolls, 1);
  assert.equal(p.count, 1);
});
test("Card Shark contexts and their question/rank sources are frozen in outcome evidence", () => {
  for (const [key, value] of [
    ["cardSharkKnowledge", cardSharkKnowledgePlan(state(), { gamblingKnowledge: "rules", topic: "Question" }).evidence],
    ["cardSharkProfession", cardSharkProfessionPlan(state(), "profession")]
  ]) {
    const c = { checkKind: key === "cardSharkKnowledge" ? "knowledge" : "skill", [key]: value },
      e = rollEvidence(c);
    assert.equal(rollEvidenceMatches(e, c), true);
    const changed = structuredClone(c);
    changed[key].source = "Changed";
    assert.equal(rollEvidenceMatches(e, changed), false);
    delete changed[key];
    assert.equal(rollEvidenceMatches(e, changed), false);
  }
});
globalThis.Actor = class {
  constructor() {
    this.system = state();
    this.items = [];
    this.type = "agent";
    this.uuid = "Actor.cardShark";
    this.isOwner = true;
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = { user: { isGM: true }, settings: { get: () => false }, i18n: { localize: s => s } };
globalThis.foundry = { utils: { escapeHTML: String } };
globalThis.ui = { notifications: { warn: () => null } };
const { SpycraftActor } = await import("../module/documents/actor.mjs");
test("actual Actor dispatch records both contexts and rejects feat/rank changes before posting", async () => {
  const a = new SpycraftActor();
  let options;
  a.rollCheck = async (_formula, _data, input) => {
    options = input;
    await input.validateSkillContext?.();
    return input;
  };
  const c = cfg.skills.profession.checks[0];
  await a.rollSkill("profession", undefined, { check: c.id, synergySkill: "none" });
  assert.equal(options.cardSharkProfession.synergy, 2);
  a.system.skillTotals.streetwise.ranks = 15;
  assert.throws(() => options.validateSkillContext(), /changed/);
  const p = await a.rollKnowledge({ skill: "streetwise", gamblingKnowledge: "rules", topic: "A question" });
  assert.equal(p.cardSharkKnowledge.category, "rules");
  assert.equal(p.actionDiceAllowed, true);
  a.system.activeFeatNames = [];
  assert.throws(() => p.validateSkillContext(), /changed/);
});
