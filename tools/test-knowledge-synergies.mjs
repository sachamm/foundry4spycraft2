// These fixtures supply required gear unless a case explicitly overrides gearStatus; absence/kit boundaries are tested in test-skill-gear.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { resolveKnowledgeCheck } from "../module/rules/knowledge.mjs";
import { readFileSync } from "node:fs";
import { computeAgent } from "../module/rules/engine.mjs";
const skill = (ranks = 1, patch = {}) => ({
  name: "Skill",
  ranks,
  totals: ["str", "dex", "con", "int", "wis", "cha"].map(ability => ({ ability, total: 0 })),
  threat: 20,
  cap: 30,
  ...patch
});

test("RAW p.92: source-listed skill synergies use one best rank bonus, capped at five", () => {
  const check = cfg.skills.acrobatics.checks.find(c => c.id === "balance");
  for (const ranks of [0, 4, 5, 9, 10, 24, 25, 40]) {
    const system = { skillTotals: { acrobatics: skill(), athletics: skill(ranks), resolve: skill(10) } };
    const result = resolveSkillCheck(system, "acrobatics", check, { gearStatus: "available" });
    assert.equal(result.synergy, Math.max(2, Math.min(5, Math.floor(ranks / 5))));
    assert.equal(result.total, result.synergy);
  }
});

test("conditional synergies require listed circumstances and appropriate owned focuses", () => {
  const check = cfg.skills.analysis.checks.find(c => c.id === "authenticate");
  const system = {
    skillTotals: { analysis: skill(), science: skill(10, { focus: true }) },
    focusTotals: { science: ["Genetics"] }
  };
  assert.equal(resolveSkillCheck(system, "analysis", check, { gearStatus: "available" }).synergy, 0);
  assert.equal(
    resolveSkillCheck(system, "analysis", check, { gearStatus: "available", synergySkill: "science" }).blocked,
    true
  );
  system.focusTotals.science.push("Chemistry");
  assert.equal(
    resolveSkillCheck(system, "analysis", check, {
      gearStatus: "available",
      synergySkill: "science",
      synergyFocus: "Chemistry"
    }).synergy,
    2
  );
  const maneuver = cfg.skills.acrobatics.checks.find(c => c.id === "maneuver");
  system.skillTotals.acrobatics = skill();
  system.skillTotals.streetwise = skill(10);
  assert.equal(
    resolveSkillCheck(system, "acrobatics", maneuver, { gearStatus: "available", synergySkill: "streetwise" }).blocked,
    true
  );
  assert.equal(
    resolveSkillCheck(system, "acrobatics", maneuver, {
      gearStatus: "available",
      synergySkill: "streetwise",
      synergyConditionMet: true
    }).synergy,
    2
  );
});

test("passive skill checks receive no rank synergy; unlisted synergy requires explicit GC allowance", () => {
  const system = { skillTotals: { notice: skill(), analysis: skill(25), acrobatics: skill() } };
  assert.equal(
    resolveSkillCheck(system, "notice", cfg.skills.notice.checks[0], {
      gearStatus: "available",
      synergySkill: "analysis",
      gcApprovedSynergy: true
    }).synergy,
    0
  );
  const check = cfg.skills.acrobatics.checks.find(c => c.id === "balance");
  assert.equal(
    resolveSkillCheck(system, "acrobatics", check, { gearStatus: "available", synergySkill: "analysis" }).blocked,
    true
  );
  assert.equal(
    resolveSkillCheck(system, "acrobatics", check, {
      gearStatus: "available",
      synergySkill: "analysis",
      gcApprovedSynergy: true
    }).synergy,
    5
  );
});

test("The Dice are Hot synergy competes with rank synergy instead of adding to it", () => {
  const system = {
    skillTotals: { streetwise: skill(), science: skill(25, { focus: true }) },
    focusTotals: { science: ["Mathematics"] },
    activeFeatNames: ["The Dice are Hot"],
    actionDice: { value: 3 }
  };
  const result = resolveSkillCheck(
    system,
    "streetwise",
    cfg.skills.streetwise.checks.find(c => c.id === "gambling"),
    { gearStatus: "available" }
  );
  assert.equal(result.total, 5);
  assert.equal(result.cap, null);
  system.actionDice.value = 6;
  assert.equal(
    resolveSkillCheck(
      system,
      "streetwise",
      cfg.skills.streetwise.checks.find(c => c.id === "gambling"),
      { gearStatus: "available" }
    ).total,
    6
  );
});

test("RAW p.98: an applicable skill forte also removes take-10 time doubling", () => {
  const system = {
    skillTotals: { science: skill(5, { focus: true }) },
    focusTotals: { science: ["Engineering"] },
    skillFortes: [{ skill: "science", focus: "Engineering", forte: "Bridges" }]
  };
  const check = {
    ...cfg.skills.science.checks.find(c => c.id === "engineering"),
    tags: "",
    time: "1 Minute (Take 10/Take 20)"
  };
  assert.equal(
    resolveSkillCheck(system, "science", check, {
      gearStatus: "available",
      focus: "Engineering",
      forte: true,
      method: "take10",
      safeToTake: true,
      synergySkill: "none"
    }).timeMultiplier,
    1
  );
});

test("RAW p.124: optional Linguistics is disabled unless the campaign explicitly enables it", () => {
  const system = { skillTotals: { cultures: skill() } },
    check = cfg.skills.cultures.checks.find(c => c.id === "linguistics");
  assert.equal(resolveSkillCheck(system, "cultures", check, { gearStatus: "available" }).blocked, true);
  assert.equal(
    resolveSkillCheck(system, "cultures", check, { gearStatus: "available", optionalRules: ["linguistics"] }).blocked,
    false
  );
});

test("RAW p.99: Knowledge uses one relevant rank synergy even while passive, with base error one and no untrained increase", () => {
  const system = { knowledge: -2, skillTotals: { analysis: skill(10) } };
  const result = resolveKnowledgeCheck(system, { skill: "analysis" });
  assert.equal(result.total, 0);
  assert.equal(result.synergy, 2);
  assert.equal(result.error, 1);
  assert.equal(result.rollMode, "blindroll");
  system.skillTotals.analysis.ranks = 0;
  assert.equal(resolveKnowledgeCheck(system, { skill: "analysis" }).total, -2);
  assert.equal(resolveKnowledgeCheck(system, { skill: "analysis" }).error, 1);
});

test("Knowledge insight bonuses stack by type, masteries set threat, and Photographic Memory permits active and fixed checks", () => {
  const system = {
    knowledge: 4,
    knowledgeBonusEntries: [{ value: 2, type: "insight" }],
    activeFeatNames: ["Photographic Memory"],
    skillTotals: { analysis: skill(5) },
    knowledgeSkillEffects: [
      { skill: "analysis", kind: "misc", type: "insight", value: 3 },
      { skill: "analysis", kind: "baseThreat", value: 18 }
    ]
  };
  const result = resolveKnowledgeCheck(system, { skill: "analysis", active: true });
  assert.equal(result.total, 6);
  assert.equal(result.threat, 18);
  assert.equal(result.rollMode, undefined);
  const take = resolveKnowledgeCheck(system, { skill: "analysis", method: "take20", active: true, safeToTake: true });
  assert.equal(take.fixedDie, 20);
  assert.equal(take.threat, 0);
  assert.equal(take.actionDiceAllowed, false);
  assert.ok(take.notes.startsWith("1 minute"));
  assert.equal(
    resolveKnowledgeCheck({ ...system, activeFeatNames: [] }, { skill: "analysis", active: true }).blocked,
    true
  );
});

test("Knowledge focus-limited benefits and Ph.D. synergy apply only to the relevant owned focus", () => {
  const system = {
    knowledge: 6,
    skillTotals: { science: skill(12, { focus: true }) },
    focusTotals: { science: ["Engineering", "Genetics"] },
    knowledgePhdSkills: ["science"],
    knowledgeSkillEffects: [
      { skill: "science", focus: "Engineering", kind: "misc", type: "insight", value: 2 },
      { skill: "science", focus: "Engineering", kind: "baseThreat", value: 19 }
    ]
  };
  const engineering = resolveKnowledgeCheck(system, { skill: "science", focus: "Engineering" });
  assert.equal(engineering.total, 14);
  assert.equal(engineering.synergy, 6);
  assert.equal(engineering.threat, 19);
  const other = resolveKnowledgeCheck(system, { skill: "science", focus: "Genetics" });
  assert.equal(other.total, 12);
  assert.equal(other.threat, 20);
  assert.equal(resolveKnowledgeCheck(system, { skill: "science", focus: "Mathematics" }).synergy, 0);
});

test("engine integrates Basic Skill mastery and Scientist Ph.D. into Knowledge without unrelated skill modifiers", () => {
  const classes = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))),
    feats = JSON.parse(readFileSync(new URL("../src/data/feats.json", import.meta.url)));
  const c = classes.find(c => c.key === "scientist"),
    cls = {
      id: "sci",
      type: "class",
      name: "Scientist",
      system: { ...c, identifier: c.key, vitalityDie: c.vitality, phdSkill: "science" }
    };
  const item = name => {
    const f = feats.find(f => f.name === name);
    return {
      id: name,
      name,
      type: "feat",
      system: { ...f, granted: true, choice: name === "Advanced Skill Mastery" ? "Actor" : "" }
    };
  };
  const system = {
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 10 }])),
    progression: Array.from({ length: 6 }, (_, i) => ({
      classId: "scientist",
      skills: i === 0 ? { science: 4 } : i === 1 ? { science: 1 } : {},
      vitality: 1
    })),
    skills: { bluff: { misc: 30 } },
    focuses: { science: ["Engineering"] },
    misc: {}
  };
  computeAgent(system, [cls, item("Actor"), item("Advanced Skill Mastery")], cfg);
  assert.equal(resolveKnowledgeCheck(system, { skill: "bluff" }).total, 9);
  assert.equal(resolveKnowledgeCheck(system, { skill: "bluff" }).threat, 18);
  const science = resolveKnowledgeCheck(system, { skill: "science", focus: "Engineering" });
  assert.equal(science.synergy, 2);
  assert.equal(science.total, 8);
});

test("RAW p.89: passive checks cannot be boosted; secret checks and checks made active by explicit abilities can", () => {
  const system = { skillTotals: { notice: skill(), analysis: skill() }, knowledge: 0 };
  const awareness = cfg.skills.notice.checks.find(c => c.id === "awareness"),
    secret = cfg.skills.analysis.checks.find(c => c.id === "authenticate");
  assert.equal(resolveSkillCheck(system, "notice", awareness, { gearStatus: "available" }).actionDiceAllowed, false);
  assert.equal(resolveSkillCheck(system, "analysis", secret, { gearStatus: "available" }).actionDiceAllowed, true);
  assert.equal(
    resolveSkillCheck(system, "notice", awareness, { gearStatus: "available", hailMaryActive: true }).actionDiceAllowed,
    true
  );
  system.coreClassIds = ["guide"];
  assert.equal(resolveSkillCheck(system, "notice", awareness, { gearStatus: "available" }).actionDiceAllowed, true);
  assert.equal(resolveKnowledgeCheck(system, { skill: "analysis" }).actionDiceAllowed, false);
  system.activeFeatNames = ["Photographic Memory"];
  assert.equal(resolveKnowledgeCheck(system, { skill: "analysis", active: true }).actionDiceAllowed, true);
});

const unfairDefinitions = JSON.parse(readFileSync(new URL("../src/data/feats.json", import.meta.url))),
  unfairClasses = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url)));
const unfairFeat = (name, patch = {}) => {
  const f = unfairDefinitions.find(f => f.name === name);
  return {
    id: name,
    name,
    type: "feat",
    system: {
      ...structuredClone(f),
      tree: f.tree[0].toLowerCase() + f.tree.slice(1).replace(/ ([a-z])/gi, (_, c) => c.toUpperCase()),
      acquiredAtLevel: name === "Unfair Advantage" ? 6 : 1,
      ...patch
    }
  };
};
function unfairAgent(extra = []) {
  const soldier = unfairClasses.find(c => c.key === "soldier"),
    system = {
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 16 }])),
      progression: Array.from({ length: 20 }, () => ({ classId: "soldier", vitality: 6, skills: {} })),
      focuses: { science: ["Engineering"], profession: ["Engineer"], drive: ["Car"], cultures: ["Central America"] }
    };
  return computeAgent(
    system,
    [
      { id: "soldier", name: "Soldier", type: "class", system: { ...soldier, identifier: "soldier", vitalityDie: 12 } },
      ...extra
    ],
    cfg
  );
}
test("Unfair Advantage increases all fifteen Basic Skill Knowledge insight sources once, matching their skill-check benefit", () => {
  for (const [name, skills] of Object.entries(cfg.tables.basicSkillFeats)) {
    const base = unfairAgent([unfairFeat(name)]),
      boosted = unfairAgent([unfairFeat(name), unfairFeat("Unfair Advantage")]);
    assert.equal(boosted.featStatus["Unfair Advantage"].ok, true, name);
    for (const skill of skills) {
      assert.equal(
        resolveKnowledgeCheck(boosted, { skill }).total - resolveKnowledgeCheck(base, { skill }).total,
        1,
        name + "/" + skill
      );
      assert.ok(boosted.knowledgeSkillEffects.some(e => e.skill === skill && e.type === "insight" && e.value === 3));
    }
  }
});
test("Unfair Advantage adjusts each applicable mastery source before named stacking without changing threat thresholds", () => {
  const chain = [unfairFeat("Examiner"), unfairFeat("Unfair Advantage")];
  for (const [name, value, threat] of [
    ["Advanced Skill Mastery", 4, 18],
    ["Grand Skill Mastery", 5, 17],
    ["Perfect Skill Mastery", 6, 16]
  ]) {
    chain.push(
      unfairFeat(name, {
        choice: "Examiner",
        acquiredAtLevel: name === "Advanced Skill Mastery" ? 6 : name === "Grand Skill Mastery" ? 12 : 18
      })
    );
    const s = unfairAgent(chain),
      r = resolveKnowledgeCheck(s, { skill: "analysis" });
    assert.equal(s.featStatus[name].ok, true);
    assert.equal(r.total, s.knowledge + value);
    assert.equal(r.threat, threat);
    assert.ok(s.knowledgeSkillEffects.some(e => e.skill === "analysis" && e.kind === "misc" && e.value === value));
  }
});
test("Photographic Memory’s global insight gets the same increase and competes with the related skill bonus rather than adding twice", () => {
  const base = unfairAgent([unfairFeat("Examiner"), unfairFeat("Photographic Memory")]),
    s = unfairAgent([unfairFeat("Examiner"), unfairFeat("Photographic Memory"), unfairFeat("Unfair Advantage")]);
  assert.equal(s.knowledge - base.knowledge, 1);
  assert.equal(s.knowledgeBonusEntries.find(e => e.type === "insight").value, 3);
  const related = resolveKnowledgeCheck(s, { skill: "analysis" }),
    unrelated = resolveKnowledgeCheck(s, { skill: "notice" });
  assert.equal(related.total, unrelated.total);
  assert.equal(related.total, s.knowledge);
  assert.equal(
    resolveKnowledgeCheck(s, { skill: "analysis", method: "take10", active: true, safeToTake: true }).total,
    related.total
  );
});
test("Unfair Advantage never turns a zero insight modifier into a bonus or softens an insight penalty", () => {
  const custom = {
      id: "insightFixture",
      name: "QA insight modifiers",
      type: "feat",
      system: {
        granted: true,
        bonuses: [
          { target: "skills.analysis.misc", value: "-2", bonusType: "insight" },
          { target: "skills.analysis.misc", value: "0", bonusType: "insight" },
          { target: "knowledge", value: "-2", bonusType: "insight" },
          { target: "knowledge", value: "0", bonusType: "insight" }
        ]
      }
    },
    s = unfairAgent([unfairFeat("Examiner"), unfairFeat("Unfair Advantage"), custom]);
  assert.ok(s.skillTotals.analysis.bonusEntries.some(e => e.type === "insight" && e.value === -2));
  assert.ok(s.knowledgeBonusEntries.some(e => e.type === "insight" && e.value === -2));
  assert.equal(
    s.knowledgeBonusEntries.some(e => e.value === 1),
    false
  );
  assert.equal(resolveKnowledgeCheck(s, { skill: "analysis" }).total, s.knowledge + 3);
});

test("RAW pp.198–199: the complete fifteen-feat Basic Skill mapping grants +2 insight and base threat19 to all named uses and related Knowledge, with no unrelated leakage", () => {
  const printed = {
    Actor: ["bluff", "impress"],
    Advisor: ["resolve", "profession"],
    Burglar: ["acrobatics", "sneak"],
    Diplomat: ["networking", "senseMotive"],
    Examiner: ["analysis", "medicine"],
    Fence: ["sleightOfHand", "streetwise"],
    Hustler: ["falsify", "manipulate"],
    Observer: ["notice", "search"],
    Officer: ["intimidate", "tactics"],
    "Private Eye": ["investigation", "security"],
    Scholar: ["bureaucracy", "science"],
    "Speed Demon": ["mechanics", "drive"],
    Survivalist: ["athletics", "survival"],
    Techie: ["computers", "electronics"],
    "World Traveler": ["blend", "cultures"]
  };
  const sortedPairs = o => Object.fromEntries(Object.entries(o).map(([name, pair]) => [name, [...pair].sort()]));
  assert.deepEqual(sortedPairs(cfg.tables.basicSkillFeats), sortedPairs(printed));
  const base = unfairAgent();
  for (const [name, covered] of Object.entries(printed)) {
    const s = unfairAgent([unfairFeat(name)]);
    assert.equal(s.featStatus[name].ok, true, name);
    for (const [key, skill] of Object.entries(cfg.skills)) {
      const expected = covered.includes(key) ? 2 : 0;
      for (const c of skill.checks) {
        const input = { gearStatus: "available", synergySkill: "none", optionalRules: ["linguistics"] },
          a = resolveSkillCheck(base, key, c, input),
          b = resolveSkillCheck(s, key, c, input);
        assert.equal(b.total - a.total, expected, name + "/" + key + "/" + c.id);
        assert.equal(b.threat, covered.includes(key) ? 19 : a.threat);
        assert.equal(b.error, a.error);
        assert.equal(b.cap, a.cap);
      }
      const a = resolveKnowledgeCheck(base, { skill: key }),
        b = resolveKnowledgeCheck(s, { skill: key });
      assert.equal(b.total - a.total, expected, name + "/Knowledge/" + key);
      assert.equal(b.threat, covered.includes(key) ? 19 : a.threat);
      assert.equal(b.error, a.error);
      assert.equal(b.rollMode, a.rollMode);
    }
  }
});

test("Omni-Competent (p.408) makes a Knowledge check active, with action dice, and no Photographic Memory needed", async () => {
  const { setCampaignRulesSource } = await import("../module/rules/campaign-rules.mjs");
  const system = { knowledge: 0, skillTotals: { analysis: skill(10) } };
  setCampaignRulesSource(() => ({ allChecksActive: true }));
  try {
    const result = resolveKnowledgeCheck(system, { skill: "analysis" });
    assert.equal(result.blocked, false);
    assert.equal(result.rollMode, undefined);
    assert.equal(result.actionDiceAllowed, true);
    assert.equal(resolveKnowledgeCheck(system, { skill: "analysis", active: true }).blocked, false);
  } finally {
    setCampaignRulesSource(null);
  }
});
