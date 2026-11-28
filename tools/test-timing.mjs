// These fixtures supply required gear unless a case explicitly overrides gearStatus; absence/kit boundaries are tested in test-skill-gear.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { skillTimingPlan, requiredSkillSeconds } from "../module/rules/timing.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
const analysis = {
  timeMultiplier: 0.5,
  timeSource: "Intelligence Analysis",
  minimumTimeSeconds: 60,
  timeRounding: "up"
};
test("user timing matrix adds all increases but applies only one reducing effect", () => {
  for (const [method, base] of [
    ["roll", 1],
    ["take10", 2],
    ["take20", 20]
  ]) {
    const p = skillTimingPlan({
      method,
      crossCheck: true,
      time: "1 Hour",
      professional: true,
      classEffect: { timeMultiplier: 0.25, timeSource: "Quarter-time option" },
      timeEffects: [
        { id: "faceless", multiplier: 3 },
        { id: "disposition", multiplier: 0.5, rounding: "up" }
      ]
    });
    assert.equal(p.timeMultiplier, base + 3.25);
    assert.equal(p.timeReduction, "class");
    assert.equal(p.skillTiming.policy, "additive-one-reduction");
  }
  assert.equal(skillTimingPlan({ method: "take10", crossCheck: true }).timeMultiplier, 4);
  assert.equal(skillTimingPlan({ method: "take20", crossCheck: true }).timeMultiplier, 22);
});
test("rounding happens after additive timing; fixed-time overrides and floors retain their own duration", () => {
  const p = skillTimingPlan({
    crossCheck: true,
    timeEffects: [{ id: "disposition", multiplier: 0.5, rounding: "up" }]
  });
  assert.equal(p.timeMultiplier, 2.5);
  assert.equal(requiredSkillSeconds(11, p), 28);
  const fixed = skillTimingPlan({
    classEffect: { timeMultiplier: 0, minimumTimeSeconds: 6 },
    crossCheck: true,
    timeEffects: [{ id: "faceless", multiplier: 3 }]
  });
  assert.equal(fixed.timeMultiplier, 0);
  assert.equal(fixed.minimumTimeSeconds, 30);
  assert.equal(requiredSkillSeconds(3600, fixed), 30);
  assert.doesNotMatch(fixed.notes, /0×/);
  assert.equal(
    skillTimingPlan({ timeEffects: [{ id: "supportive", multiplier: 1 / 3, rounding: "up" }] }).timeMultiplier,
    1 / 3
  );
});
test("printed fixed durations form the base for taking and Cross-Check without stacking reductions", () => {
  for (const [method, multiplier] of [
    ["roll", 3],
    ["take10", 4],
    ["take20", 22]
  ]) {
    const p = skillTimingPlan({
      method,
      time: "1 Minute",
      crossCheck: true,
      professional: true,
      classEffect: { timeChoices: [{ id: "fixed", name: "Fixed duration", multiplier: 0, fixedSeconds: 6 }] }
    });
    assert.equal(p.timeReduction, "fixed");
    assert.equal(requiredSkillSeconds(60, p), 6 * multiplier);
    assert.equal(p.skillTiming.reduction.fixedSeconds, 6);
    assert.equal(p.skillTiming.fixedMultiplier, multiplier);
    assert.equal(p.minimumTimeSeconds, 6 * multiplier);
  }
});

test("invalid source factors, duplicate effects, rounding and overflowing durations stop timing before a result is used", () => {
  for (const input of [
    { timeEffects: [{ id: "bad", multiplier: NaN }] },
    { timeEffects: [{ id: "bad", multiplier: -1 }] },
    {
      timeEffects: [
        { id: "same", multiplier: 3 },
        { id: "same", multiplier: 3 }
      ]
    },
    { timeEffects: [{ id: "bad", multiplier: 0.5, rounding: "sideways" }] },
    { classEffect: { timeMultiplier: NaN } },
    { classEffect: { timeChoices: {} } }
  ])
    assert.throws(() => skillTimingPlan(input), /Review/);
  assert.throws(() => requiredSkillSeconds(Number.MAX_VALUE, { timeMultiplier: 2 }), /Review/);
  assert.throws(() => requiredSkillSeconds(10, { timeMultiplier: 1, timeRounding: "sideways" }), /Review/);
});
test("p.102 permits one reduction: two halves never become a quarter, and the selected source owns its minimum and rounding", () => {
  const input = { professional: true, classEffect: analysis, time: "1 Hour" };
  const auto = skillTimingPlan(input);
  assert.equal(auto.timeMultiplier, 0.5);
  assert.equal(auto.timeReduction, "professional");
  assert.equal(auto.minimumTimeSeconds, 6);
  assert.equal(auto.timeRounding, null);
  const cls = skillTimingPlan({ ...input, reduction: "class" });
  assert.equal(cls.timeMultiplier, 0.5);
  assert.equal(cls.minimumTimeSeconds, 60);
  assert.equal(cls.timeRounding, "up");
  assert.match(cls.notes, /Round up/);
  assert.equal(skillTimingPlan({ ...input, reduction: "none" }).timeMultiplier, 1);
});
test("take-10 normalization, forte, False Start and half-time benefits compete instead of multiplying", () => {
  assert.equal(
    skillTimingPlan({
      method: "take10",
      take10Normal: true,
      professional: true,
      classEffect: analysis,
      time: "1 Minute"
    }).timeMultiplier,
    1
  );
  const taking = skillTimingPlan({
    method: "take20",
    falseStart: true,
    professional: true,
    classEffect: analysis,
    time: "1 Minute"
  });
  assert.equal(taking.timeMultiplier, 15);
  assert.equal(taking.timeReduction, "falseStart");
  assert.equal(
    skillTimingPlan({ method: "take20", falseStart: true, professional: true, reduction: "falseStart" }).timeMultiplier,
    15
  );
  assert.equal(skillTimingPlan({ method: "take20", take10Normal: true }).timeMultiplier, 20);
});
test("automatic selection compares actual minima for fixed listed times, while variable times expose an explicit choice", () => {
  const input = { method: "take20", falseStart: true, classEffect: analysis };
  const short = skillTimingPlan({ ...input, time: "1 Second" });
  assert.equal(short.timeReduction, "falseStart");
  assert.equal(short.timeMultiplier, 15);
  assert.equal(short.minimumTimeSeconds, 0);
  const long = skillTimingPlan({ ...input, time: "1 Minute" });
  assert.equal(long.timeReduction, "falseStart");
  assert.equal(long.timeMultiplier, 15);
  assert.match(skillTimingPlan({ ...input, time: "Varies per challenge" }).notes, /Variable time/);
  assert.throws(() => skillTimingPlan({ reduction: "professional" }), /not available/);
  assert.throws(() => skillTimingPlan({ method: "roll", falseStart: true, reduction: "falseStart" }), /not available/);
});
test("user ruling combines Cross-Check with one reduction and retains scaled minimum durations", () => {
  const a = skillTimingPlan({ professional: true, crossCheck: true });
  assert.equal(a.timeMultiplier, 2.5);
  assert.equal(a.minimumTimeSeconds, 18);
  assert.equal(a.minimumTime, "3 rounds");
  const b = skillTimingPlan({ classEffect: analysis, crossCheck: true });
  assert.equal(b.timeMultiplier, 2.5);
  assert.equal(b.minimumTimeSeconds, 180);
  assert.equal(b.minimumTime, "3 minutes");
  assert.equal(b.timeRounding, "up");
  assert.equal(b.timeBaseMultiplier, 0.5);
  assert.equal(b.crossCheckMultiplier, 3);
  assert.equal(b.timeRoundingBeforeCrossCheck, false);
  assert.match(b.notes, /Round up after combining/);
  const trap = skillTimingPlan({
    classEffect: { timeMultiplier: 0.5, timeSource: "Booby Trap", minimumTimeSeconds: 3, timeRounding: "down" },
    crossCheck: true
  });
  assert.equal(trap.minimumTimeSeconds, 9);
  assert.equal(trap.minimumTime, "9 seconds");
});
test("skill resolver honors explicit eligible reductions, blocks unavailable sources and reports only the applied timing effect", () => {
  const system = {
    classOptionSelections: [{ classId: "snoop", name: "Intelligence Analysis" }],
    skillTotals: {
      investigation: {
        name: "Investigation",
        ranks: 4,
        cap: 30,
        threat: 20,
        totals: [{ ability: "int", total: 7 }],
        take10TimeMultiplier: 1
      }
    },
    skillFeatRules: [
      { name: "Mark of a Professional", skill: "investigation" },
      { name: "False Start", skill: "investigation" }
    ]
  };
  const check = {
    id: "research",
    name: "Research Check",
    attributes: ["int"],
    mode: "Secret",
    tags: "Cross-Check",
    time: "1 Hour (Take 10/Take 20)",
    error: 1,
    page: 125
  };
  const options = { usingComputer: true, unopposed: true, method: "take20", safeToTake: true };
  const r = resolveSkillCheck(system, "investigation", check, { gearStatus: "available", ...options });
  assert.equal(r.timeMultiplier, 15);
  assert.doesNotMatch(r.notes, /Intelligence Analysis: half/);
  assert.match(r.notes, /False Start/);
  const chosen = resolveSkillCheck(system, "investigation", check, {
    gearStatus: "available",
    ...options,
    timingReduction: "class",
    crossCheckActive: true
  });
  assert.equal(chosen.timeMultiplier, 21.5);
  assert.equal(chosen.minimumTimeSeconds, 180);
  assert.equal(chosen.timeRounding, "up");
  assert.equal(
    resolveSkillCheck(system, "investigation", check, {
      gearStatus: "available",
      ...options,
      method: "roll",
      timingReduction: "falseStart"
    }).blocked,
    true
  );
});

const { SPYCRAFT: cfg } = await import("../module/config.mjs");
const { computeAgent } = await import("../module/rules/engine.mjs");
const { readFileSync } = await import("node:fs");
const { rollEvidence, rollEvidenceMatches } = await import("../module/rules/outcomes.mjs");
const featDefs = JSON.parse(readFileSync(new URL("../src/data/feats.json", import.meta.url)));
const makeFeat = (name, choice = "", level = 1) => ({
  id: name,
  name,
  type: "feat",
  system: { ...structuredClone(featDefs.find(f => f.name === name)), choice, acquiredAtLevel: level, granted: true }
});
function professionalSystem(basic = "Examiner", include = true) {
  const cls = {
      id: "qa",
      name: "QA",
      type: "class",
      system: { identifier: "qa", skillPoints: 4, vitalityDie: 6, classSkills: Object.keys(cfg.skills), table: [] }
    },
    items = [
      cls,
      makeFeat(basic),
      makeFeat("False Start", basic, 3),
      ...(include ? [makeFeat("Mark of a Professional", basic, 9)] : [])
    ];
  return computeAgent(
    {
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 10 }])),
      progression: Array.from({ length: 9 }, () => ({ classId: "qa", vitality: 1, skills: {} }))
    },
    items,
    cfg
  );
}
test("Mark of a Professional covers all fifteen Basic Skill choices and every named use only in its mapped pair", () => {
  let checked = 0;
  for (const [basic, pair] of Object.entries(cfg.tables.basicSkillFeats)) {
    const s = professionalSystem(basic),
      before = professionalSystem(basic, false);
    assert.equal(s.featStatus["Mark of a Professional"].ok, true, basic);
    for (const [key, skill] of Object.entries(cfg.skills))
      for (const check of skill.checks) {
        const opts = { gearStatus: "available", synergySkill: "none", unopposed: true },
          r = resolveSkillCheck(s, key, check, opts),
          b = resolveSkillCheck(before, key, check, opts);
        checked++;
        const applies = pair.includes(key);
        assert.equal(!!r.professionalFeat, applies, basic + "/" + key + "/" + check.id);
        assert.equal(
          r.error,
          applies ? (b.error > 0 ? Math.max(1, b.error - 1) : 0) : b.error,
          basic + "/" + key + "/" + check.id
        );
        if (applies) {
          const option = r.timeReductionOptions.find(c => c.id === "professional");
          assert.ok(option, basic + "/" + key + "/" + check.id);
          assert.equal(option.multiplier, 0.5);
          assert.equal(option.minimum, 6);
          assert.equal(r.professionalFeat.timing.applied, r.timeReduction === "professional");
        } else {
          assert.equal(r.timeMultiplier, b.timeMultiplier);
          assert.equal(r.minimumTimeSeconds, b.minimumTimeSeconds);
        }
      }
  }
  assert.equal(checked, 1500);
});
test("Professional timing requires a strict unopposed declaration and respects virtual focus restrictions and its one-round minimum", () => {
  const s = professionalSystem(),
    check = {
      id: "qa",
      name: "QA Check",
      attributes: ["int"],
      mode: "Active",
      tags: "",
      error: 1,
      time: "1 Second (Take 10/Take 20)",
      page: 200
    };
  s.skillFeatRules = [
    { name: "Mark of a Professional", choice: "Field of Expertise", skill: "science", focuses: ["Engineering"] }
  ];
  for (const unopposed of [false, "true", 1, undefined]) {
    const r = resolveSkillCheck(s, "science", check, { gearStatus: "available", focus: "Engineering", unopposed });
    assert.equal(r.timeReduction, "none");
    assert.equal(r.professionalFeat.unopposed, false);
  }
  for (const method of ["roll", "take10", "take20"]) {
    const r = resolveSkillCheck(s, "science", check, {
      gearStatus: "available",
      focus: "Engineering",
      method,
      safeToTake: true,
      unopposed: true,
      timingReduction: "professional"
    });
    assert.equal(r.timeMultiplier, { roll: 0.5, take10: 1.5, take20: 19.5 }[method]);
    assert.equal(r.minimumTimeSeconds, 6);
  }
  assert.equal(
    resolveSkillCheck(s, "science", check, { gearStatus: "available", focus: "Chemistry", unopposed: true })
      .professionalFeat,
    null
  );
});
test("Professional source, error and timing context are immutable in outcome evidence, without rewriting legacy receipts", () => {
  const s = professionalSystem(),
    p = resolveSkillCheck(s, "analysis", cfg.skills.analysis.checks[0], { gearStatus: "available", unopposed: true }),
    c = { checkKind: "skill", professionalFeat: p.professionalFeat },
    e = rollEvidence(c);
  assert.equal(rollEvidenceMatches(e, c), true);
  for (const key of [
    "source",
    "skillKey",
    "checkId",
    "focus",
    "rules",
    "unopposed",
    "method",
    "errorBefore",
    "errorAfter",
    "timing"
  ]) {
    const changed = structuredClone(c);
    changed.professionalFeat[key] = "edited";
    assert.equal(rollEvidenceMatches(e, changed), false, key);
  }
  assert.equal(rollEvidenceMatches(e, { checkKind: "skill" }), false);
  assert.equal(rollEvidenceMatches(rollEvidence({ checkKind: "skill" }), c), false);
});
globalThis.Actor = class {
  constructor() {
    this.type = "agent";
    this.uuid = "Actor.professional";
    this.isOwner = true;
    this.system = professionalSystem();
    this.items = [];
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = { user: { isGM: true }, settings: { get: () => false }, i18n: { localize: s => s } };
globalThis.foundry = { utils: { escapeHTML: s => String(s) } };
globalThis.ui = { notifications: { warn: () => null } };
globalThis.ChatMessage = { getSpeaker: () => ({}) };
const { SpycraftActor } = await import("../module/documents/actor.mjs");
test("actual Actor skill entry preserves Professional context and rejects a source lost during the real roll before posting", async () => {
  const a = new SpycraftActor();
  let captured,
    posted = 0,
    hook = () => {};
  globalThis.Roll = class {
    constructor() {
      this.total = 12;
      this.dice = [{ total: 12 }];
    }
    async evaluate() {
      hook();
      return this;
    }
    async toMessage(d) {
      posted++;
      captured = d.flags.spycraft2;
      return d;
    }
  };
  const opts = {
    check: cfg.skills.analysis.checks[0].id,
    gearStatus: "available",
    unopposed: true,
    synergySkill: "none"
  };
  await a.rollSkill("analysis", "int", opts);
  assert.equal(posted, 1);
  assert.equal(captured.professionalFeat.source, "Mark of a Professional");
  hook = () => {
    a.system.skillFeatRules = a.system.skillFeatRules.filter(r => r.name !== "Mark of a Professional");
  };
  await assert.rejects(a.rollSkill("analysis", "int", opts), /changed/);
  assert.equal(posted, 1);
});

test("Comedy of Errors makes taking 10 take four times as long (p.406)", async () => {
  const { setCampaignRulesSource } = await import("../module/rules/campaign-rules.mjs");
  assert.equal(skillTimingPlan({ method: "take10" }).timeMultiplier, 2);
  setCampaignRulesSource(() => ({ take10TimeMultiplier: 4 }));
  try {
    assert.equal(skillTimingPlan({ method: "take10" }).timeMultiplier, 4);
  } finally {
    setCampaignRulesSource(() => ({}));
  }
});
