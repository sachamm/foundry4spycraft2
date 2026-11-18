// These fixtures supply required gear unless a case explicitly overrides gearStatus; absence/kit boundaries are tested in test-skill-gear.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { breakthroughPlan } from "../module/rules/breakthrough.mjs";
import { limitedUseAbilities } from "../module/rules/limited-uses.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const state = () => ({
  classLevels: { virtuoso: 10, scientist: 3 },
  actionDice: { value: 3 },
  resourceUses: {},
  skillFeatRules: [],
  skillTotals: {
    analysis: {
      name: "Analysis",
      ranks: 4,
      cap: 30,
      threat: 20,
      totals: [
        { ability: "int", total: 8 },
        { ability: "wis", total: 6 }
      ]
    },
    science: {
      name: "Science",
      ability: "int",
      focus: true,
      ranks: 12,
      cap: 50,
      threat: 19,
      bonusEntries: [{ type: "insight", value: 2 }],
      totals: [{ ability: "int", total: 20 }]
    }
  },
  focusTotals: { science: ["Engineering"] },
  conditionalSkillBonuses: [{ skill: "science", focus: "Engineering", kind: "misc", type: "insight", value: 4 }]
});
const items = () => [
    { id: "v", type: "class", system: { identifier: "virtuoso", keySkill: "science", keyFocus: "Engineering" } }
  ],
  result = {
    ability: "int",
    total: 8,
    threat: 20,
    error: 3,
    cap: 30,
    actionDiceAllowed: false,
    notes: "Target rules."
  };
test("Breakthrough substitutes the focused key skill bonus, preserves target rules and never adds both skill bonuses", () => {
  const p = breakthroughPlan(state(), items(), cfg, result, { modifier: 3 });
  assert.equal(p.total, 25);
  assert.equal(p.breakthrough.bonus, 22);
  assert.equal(p.breakthrough.focus, "Engineering");
  assert.equal(p.breakthrough.replacedTotal, 8);
  for (const k of ["threat", "error", "cap", "actionDiceAllowed"]) assert.equal(p[k], result[k]);
  assert.equal(result.total, 8);
  assert.equal(breakthroughPlan(state(), items(), cfg, { ...result, ability: "wis" }).total, 22);
  assert.equal(breakthroughPlan(state(), items(), cfg, result, { checkKind: "knowledge" }).total, 22);
});
test("all native level boundaries and invalid target/source/focus choices are checked", () => {
  for (let n = 0; n <= 10; n++) {
    const s = state();
    s.classLevels.virtuoso = n;
    assert.equal(
      limitedUseAbilities(s, items(), cfg).some(x => x.id === "breakthrough"),
      n === 10
    );
    if (n < 10) assert.throws(() => breakthroughPlan(s, items(), cfg, result));
  }
  for (const ability of ["str", "dex", "con", "cha"])
    assert.throws(() => breakthroughPlan(state(), items(), cfg, { ...result, ability }));
  for (const kind of ["attack", "save", "damage"])
    assert.throws(() => breakthroughPlan(state(), items(), cfg, result, { checkKind: kind }));
  assert.throws(() => breakthroughPlan(state(), items(), cfg, result, { sourceAbility: "wis" }));
  assert.throws(() => breakthroughPlan(state(), [], cfg, result));
  const s = state();
  s.focusTotals.science = [];
  assert.throws(() => breakthroughPlan(s, items(), cfg, result), /focus/);
  s.focusTotals.science = ["Engineering"];
  s.skillTotals.science.ranks = 5;
  assert.throws(() => breakthroughPlan(s, items(), cfg, result), /six/);
});
let posts = [],
  failPost = false,
  rolls = 0,
  scene = "scene";
globalThis.Actor = class {
  constructor() {
    this.type = "agent";
    this.uuid = "Actor.virtuoso";
    this.isOwner = true;
    this.system = state();
    this.items = items();
    this.items.get = id => this.items.find(i => i.id === id);
    this.system.limitedUses = limitedUseAbilities(this.system, this.items, cfg);
  }
  async update(patch) {
    for (const [path, value] of Object.entries(patch)) {
      const keys = path.replace(/^system\./, "").split(".");
      let obj = this.system;
      for (const k of keys.slice(0, -1)) obj = obj[k] ??= {};
      const k = keys.at(-1);
      if (k.startsWith("-=")) delete obj[k.slice(2)];
      else obj[k] = structuredClone(value);
    }
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = {
  user: { id: "gm", isGM: true },
  settings: { get: (_s, k) => (k === "linguistics" ? false : { session: "session", scene }) },
  i18n: { localize: s => s, format: s => s }
};
globalThis.foundry = {
  utils: { escapeHTML: s => String(s) },
  applications: { api: { DialogV2: { input: async () => ({ chosen: "1" }) } } }
};
globalThis.ui = { notifications: { warn: () => null } };
globalThis.ChatMessage = { getSpeaker: () => ({}) };
globalThis.Roll = class {
  constructor(formula, data) {
    this.total = 7 + data.total;
    this.dice = [{ total: 7 }];
    rolls++;
  }
  async evaluate() {
    return this;
  }
  async toMessage(data) {
    if (failPost) throw Error("post failed");
    posts.push(data);
    return data;
  }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");
const input = { check: "appraise", breakthrough: true };
function reset() {
  posts = [];
  failPost = false;
  rolls = 0;
  scene = "scene";
}
test("Skills and Knowledge share one scene use, record the substituted bonus and refresh only with a new scene", async () => {
  reset();
  const a = new SpycraftActor();
  const m = await a.rollSkill("analysis", "int", { gearStatus: "available", ...input, modifier: 3 });
  assert.equal(m.flags.spycraft2.rollData.total, 25);
  assert.equal(m.flags.spycraft2.breakthrough.bonus, 22);
  assert.equal(a.system.resourceUses.breakthrough.used, 1);
  assert.equal(await a.rollKnowledge({ skill: "analysis", breakthrough: true }), null);
  assert.equal(posts.length, 1);
  scene = "next";
  const k = await a.rollKnowledge({ skill: "analysis", breakthrough: true });
  assert.equal(k.flags.spycraft2.rollData.total, 22);
  assert.equal(k.flags.spycraft2.actionDiceAllowed, false);
  assert.equal(k.flags.spycraft2.checkKind, "knowledge");
  assert.equal(a.system.resourceUses.breakthrough.used, 1);
  assert.equal(a.system.actionDice.value, 3);
});
test("Breakthrough combines with Bright Idea atomically without a nested queue or charging either allowance twice", async () => {
  reset();
  const a = new SpycraftActor();
  await a.rollSkill("analysis", "int", { gearStatus: "available", ...input, brightIdea: true });
  assert.equal(posts.length, 1);
  assert.equal(rolls, 2);
  assert.equal(posts[0].flags.spycraft2.rollData.total, 22);
  assert.equal(a.system.resourceUses.breakthrough.used, 1);
  assert.equal(a.system.resourceUses.brightIdeaScientist.used, 1);
  assert.equal(await a.rollKnowledge({ skill: "analysis", breakthrough: true, brightIdea: true }), null);
  assert.equal(a.system.resourceUses.brightIdeaScientist.used, 1);
  scene = "next";
  const k = await a.rollKnowledge({ skill: "analysis", breakthrough: true, brightIdea: true });
  assert.equal(k.flags.spycraft2.breakthrough.bonus, 22);
  assert.equal(a.system.resourceUses.brightIdeaScientist.used, 2);
  assert.equal(a.system.actionDice.value, 3);
});
test("failed posts refund both independent uses and costs; changed sources fail before posting, and competing scene uses execute once", async () => {
  reset();
  const a = new SpycraftActor();
  failPost = true;
  await assert.rejects(
    a.rollSkill("analysis", "int", { gearStatus: "available", ...input, brightIdea: true, hailMaryUncap: true }),
    /post failed/
  );
  assert.equal(a.system.actionDice.value, 3);
  assert.equal(a.system.resourceUses.breakthrough, undefined);
  assert.equal(a.system.resourceUses.brightIdeaScientist, undefined);
  failPost = false;
  const update = a.update.bind(a);
  let changed = false;
  a.update = async patch => {
    await update(patch);
    if (!changed && patch["system.resourceUses.breakthrough"]) {
      changed = true;
      a.items[0].system.keySkill = "missing";
    }
  };
  await assert.rejects(a.rollKnowledge({ skill: "analysis", breakthrough: true }), /key skill/);
  assert.equal(a.system.resourceUses.breakthrough, undefined);
  a.update = update;
  a.items[0].system.keySkill = "science";
  await Promise.all([
    a.rollKnowledge({ skill: "analysis", breakthrough: true }),
    a.rollSkill("analysis", "int", { gearStatus: "available", ...input })
  ]);
  assert.equal(posts.length, 1);
  assert.equal(a.system.resourceUses.breakthrough.used, 1);
});
test("combined use plans reject duplicate or unaffordable sources before any state mutation", async () => {
  reset();
  const a = new SpycraftActor();
  a.system.limitedUses.push(
    { id: "paidA", name: "Paid A", period: "scene", limit: 1, cost: 2, workflow: "manual" },
    { id: "paidB", name: "Paid B", period: "scene", limit: 1, cost: 2, workflow: "manual" }
  );
  let calls = 0;
  assert.equal(
    await a.useLimitedAbility("paidA", () => calls++, { additionalUses: [{ id: "paidB", workflow: "manual" }] }),
    null
  );
  assert.equal(calls, 0);
  assert.deepEqual(a.system.resourceUses, {});
  await assert.rejects(
    a.useLimitedAbility("paidA", () => calls++, { additionalUses: [{ id: "paidA", workflow: "manual" }] }),
    /distinct/
  );
  assert.deepEqual(a.system.resourceUses, {});
});

const { resolveSkillCheck } = await import("../module/rules/skills.mjs");
const { resolveKnowledgeCheck } = await import("../module/rules/knowledge.mjs");
const { substituteSkillBonus } = await import("../module/rules/breakthrough.mjs");
test("Breakthrough retains the named check’s helmet Vision penalty, listed synergy and discretionary modifier", async () => {
  reset();
  const a = new SpycraftActor();
  a.system.armor = { visionCheck: -3 };
  a.system.skillTotals.falsify = { name: "Falsify", ranks: 10, cap: 40, totals: [{ ability: "int", total: 13 }] };
  const m = await a.rollSkill("analysis", "int", {
      gearStatus: "available",
      ...input,
      modifier: 1,
      synergySkill: "falsify"
    }),
    c = m.flags.spycraft2;
  assert.equal(c.rollData.total, 22);
  assert.equal(c.breakthrough.bonus, 22);
  assert.equal(c.breakthrough.preservedBonus, 2);
  assert.equal(c.breakthrough.preservedAdjustment, -2);
  assert.equal(c.breakthrough.replacedSkillBonus, 8);
  assert.equal(a.system.resourceUses.breakthrough.used, 1);
});
test("an INT-converted Acrobatics check retains the worst applicable ACP when its skill bonus is replaced", async () => {
  reset();
  const a = new SpycraftActor();
  a.system.classLevels.schemer = 4;
  a.system.actionDice.max = 3;
  a.system.abilities = { dex: { mod: 2 }, int: { mod: 5 } };
  a.system.armor = { check: -4 };
  a.system.encumbrance = { check: -2 };
  a.system.skillTotals.acrobatics = {
    name: "Acrobatics",
    ranks: 4,
    cap: 30,
    threat: 20,
    totals: [{ ability: "dex", total: 6 }]
  };
  a.system.limitedUses = limitedUseAbilities(a.system, a.items, cfg);
  const m = await a.rollSkill("acrobatics", "dex", {
    gearStatus: "available",
    check: "balance",
    allAccordingToPlan: true,
    breakthrough: true
  });
  assert.equal(m.flags.spycraft2.rollData.total, 18);
  assert.equal(m.flags.spycraft2.breakthrough.preservedAdjustment, -4);
  assert.equal(a.system.resourceUses.allAccordingToPlan.used, 1);
  assert.equal(a.system.resourceUses.breakthrough.used, 1);
});
test("an owned forte for the actual Drive check survives substitution rather than becoming an unrelated key-skill forte", () => {
  const s = state();
  s.classLevels.schemer = 4;
  s.abilities = { dex: { mod: 2 }, int: { mod: 5 } };
  s.skillTotals.drive = {
    name: "Drive",
    focus: true,
    ranks: 6,
    cap: 35,
    threat: 20,
    totals: [{ ability: "dex", total: 8 }]
  };
  s.focusTotals.drive = ["Car"];
  s.skillFortes = [{ skill: "drive", focus: "Car", forte: "Racing" }];
  const check = cfg.skills.drive.checks.find(c => c.attributes.includes("dex")),
    target = resolveSkillCheck(s, "drive", check, {
      gearStatus: "available",
      ability: "dex",
      focus: "Car",
      forte: true,
      allAccordingToPlan: true,
      synergySkill: "none"
    });
  assert.equal(target.checkAdjustment, 1);
  assert.equal(breakthroughPlan(s, items(), cfg, target).total, 23);
});
test("replacement and check modifiers keep only the best positive/worst negative named bonuses", () => {
  const source = {
      skillBonus: 20,
      skillBonusEntries: [
        { type: "gear", value: 2 },
        { type: "insight", value: 4 }
      ]
    },
    target = {
      checkBonusEntries: [
        { type: "gear", value: 4 },
        { type: "insight", value: 3 },
        { type: "synergy", value: 2 },
        { type: "synergy", value: 5 },
        { type: "synergy", value: -1 },
        { type: "synergy", value: -3 }
      ],
      checkAdjustment: -2
    };
  const r = substituteSkillBonus(source, target);
  assert.equal(r.preservedBonus, 4);
  assert.equal(r.total, 22);
  assert.throws(() => substituteSkillBonus({ skillBonus: Infinity }, target), /Review/);
});
test("an applicable Elbow Grease check bonus still applies, without doubling a same-type source gear bonus", () => {
  const s = state();
  s.classLevels.scientist = 4;
  s.classOptionSelections = [{ classId: "scientist", name: "Elbow Grease" }];
  s.skillTotals.science.bonusEntries.push({ type: "gear", value: 2 });
  s.skillTotals.science.totals[0].total += 2;
  s.skillTotals.mechanics = {
    name: "Mechanics",
    ranks: 4,
    cap: 30,
    threat: 20,
    totals: [{ ability: "int", total: 5 }]
  };
  const check = cfg.skills.mechanics.checks.find(c => c.id === "repair"),
    target = resolveSkillCheck(s, "mechanics", check, {
      gearStatus: "available",
      ability: "int",
      synergySkill: "none"
    }),
    r = breakthroughPlan(s, items(), cfg, target);
  assert.equal(target.total, 9);
  assert.equal(r.breakthrough.bonus, 24);
  assert.equal(r.breakthrough.preservedBonus, 2);
  assert.equal(r.total, 26);
});
test("Knowledge retains its Ph.D. synergy after substitution and stacks it against a source synergy only once", async () => {
  for (const sourceSynergy of [0, 4, 7]) {
    reset();
    const a = new SpycraftActor();
    a.system.skillTotals.analysis.ranks = 10;
    a.system.knowledgePhdSkills = ["analysis"];
    if (sourceSynergy) {
      a.system.skillTotals.science.bonusEntries.push({ type: "synergy", value: sourceSynergy });
      a.system.skillTotals.science.totals[0].total += sourceSynergy;
    }
    const m = await a.rollKnowledge({ skill: "analysis", breakthrough: true, modifier: 1 });
    assert.equal(m.flags.spycraft2.rollData.total, sourceSynergy <= 5 ? 28 : 30);
    assert.equal(m.flags.spycraft2.breakthrough.preservedBonus, Math.max(0, 5 - sourceSynergy));
    assert.equal(m.flags.spycraft2.actionDiceAllowed, false);
  }
});
test("ordinary Knowledge also applies the one-best-synergy rule when its base bonus already has the same named type", () => {
  const s = state();
  s.knowledge = 7;
  s.knowledgeBonusEntries = [
    { type: "synergy", value: 2 },
    { type: "insight", value: 2 }
  ];
  s.knowledgeSkillEffects = [{ skill: "analysis", kind: "misc", type: "insight", value: 4 }];
  s.skillTotals.analysis.ranks = 15;
  const r = resolveKnowledgeCheck(s, { skill: "analysis" });
  assert.equal(r.synergy, 3);
  assert.equal(r.total, 10);
  assert.equal(r.actionDiceAllowed, false);
});
test("a conditional surprise-check benefit remains on Notice and keeps the original WIS attribute after bonus replacement", async () => {
  reset();
  const a = new SpycraftActor();
  a.system.classLevels.sleuth = 4;
  a.system.classOptionSelections = [{ classId: "sleuth", name: "Alertness" }];
  a.system.skillTotals.notice = {
    name: "Notice",
    ranks: 4,
    cap: 30,
    threat: 20,
    totals: [{ ability: "wis", total: 6 }]
  };
  const check = cfg.skills.notice.checks.find(c => c.id === "awareness") ?? cfg.skills.notice.checks[0];
  const m = await a.rollSkill("notice", "wis", {
    gearStatus: "available",
    check: check.id,
    breakthrough: true,
    surprise: true,
    synergySkill: "none"
  });
  assert.equal(m.flags.spycraft2.rollData.total, 26);
  assert.equal(m.flags.spycraft2.ability, "wis");
  assert.equal(m.flags.spycraft2.breakthrough.preservedBonus, 4);
});

const { nestPlan } = await import("../module/rules/breakthrough.mjs");
function nestState() {
  const s = state();
  s.classLevels.sniper = 4;
  s.classOptionSelections = [{ classId: "sniper", name: "Nest" }];
  s.skillTotals.sneak = {
    name: "Sneak",
    ranks: 4,
    cap: 30,
    threat: 19,
    totals: [
      { ability: "dex", total: 6 },
      { ability: "cha", total: 7 }
    ]
  };
  s.skillTotals.tactics = {
    name: "Tactics",
    ability: "wis",
    ranks: 0,
    cap: 3,
    bonusEntries: [{ type: "insight", value: 2 }],
    totals: [
      { ability: "wis", total: 11 },
      { ability: "cha", total: 13 }
    ]
  };
  s.armor = { check: -4 };
  s.encumbrance = { check: -2 };
  s.sizeHideModifier = 4;
  return s;
}
const nestOptions = { skillKey: "sneak", checkId: "hide", halfCoverConfirmed: true };
test("Nest checks every Sneak option and native level, requires the earned choice and actual half-cover/visual confirmation", () => {
  for (let n = 0; n <= 10; n++)
    for (const check of cfg.skills.sneak.checks) {
      const s = nestState();
      s.classLevels.sniper = n;
      const target = resolveSkillCheck(s, "sneak", check, { gearStatus: "available", ability: "dex" });
      if (n >= 4 && check.id === "hide")
        assert.equal(nestPlan(s, cfg, target, { ...nestOptions, checkId: check.id }).nest.bonus, 11);
      else assert.throws(() => nestPlan(s, cfg, target, { ...nestOptions, checkId: check.id }));
    }
  const s = nestState(),
    t = resolveSkillCheck(s, "sneak", cfg.skills.sneak.checks[0], { gearStatus: "available", ability: "dex" });
  for (const halfCoverConfirmed of [false, undefined, "true", 1])
    assert.throws(() => nestPlan(s, cfg, t, { ...nestOptions, halfCoverConfirmed }));
  s.classOptionSelections = [];
  assert.throws(() => nestPlan(s, cfg, t, nestOptions));
});
test("Nest retains Hide ACP, size, situational modifier, original attribute and target rules; Tactics source cap/ranks do not limit the bonus", () => {
  const s = nestState();
  for (const ability of ["dex", "cha"]) {
    const t = resolveSkillCheck(s, "sneak", cfg.skills.sneak.checks[0], {
        gearStatus: "available",
        ability,
        modifier: 2
      }),
      p = nestPlan(s, cfg, t, nestOptions);
    assert.equal(p.total, 13);
    assert.equal(p.nest.preservedAdjustment, 2);
    for (const k of ["ability", "threat", "error", "cap", "method", "actionDiceAllowed"]) assert.equal(p[k], t[k]);
    assert.equal(p.ability, ability);
    assert.equal(t.total, ability === "dex" ? 8 : 9);
    assert.equal(nestPlan(s, cfg, t, { ...nestOptions, sourceAbility: "cha" }).total, 15);
  }
});
test("Nest keeps typed check stacking, rejects invalid sources and competing replacement, and does not modify the original result", () => {
  const s = nestState(),
    t = {
      ...result,
      ability: "dex",
      checkBonusEntries: [
        { type: "insight", value: 4 },
        { type: "synergy", value: 2 }
      ],
      checkAdjustment: -1
    },
    p = nestPlan(s, cfg, t, nestOptions);
  assert.equal(p.total, 14);
  assert.equal(p.nest.preservedBonus, 4);
  assert.equal(t.total, 8);
  assert.throws(() => nestPlan(s, cfg, t, { ...nestOptions, sourceAbility: "int" }));
  assert.throws(() => nestPlan(s, cfg, t, { ...nestOptions, breakthrough: true }));
  assert.throws(() => nestPlan(s, cfg, t, { ...nestOptions, skillKey: "tactics" }));
  s.skillTotals.tactics.totals[0].total = Infinity;
  assert.throws(() => nestPlan(s, cfg, t, nestOptions));
});
test("the real skill entry records Nest without spending dice or scene uses and never enables Bright Idea merely from its WIS bonus", async () => {
  reset();
  const a = new SpycraftActor();
  a.system = nestState();
  a.system.limitedUses = limitedUseAbilities(a.system, a.items, cfg);
  const options = { check: "hide", nest: true, nestHalfCoverConfirmed: true, modifier: 2 };
  const m = await a.rollSkill("sneak", "dex", { gearStatus: "available", ...options });
  assert.equal(m.flags.spycraft2.rollData.total, 13);
  assert.equal(m.flags.spycraft2.nest.bonus, 11);
  assert.equal(m.flags.spycraft2.ability, "dex");
  assert.equal(a.system.actionDice.value, 3);
  assert.deepEqual(a.system.resourceUses, {});
  assert.equal(await a.rollSkill("sneak", "dex", { gearStatus: "available", ...options, brightIdea: true }), null);
  assert.equal(posts.length, 1);
  await assert.rejects(
    a.rollSkill("sneak", "dex", { gearStatus: "available", ...options, check: "stash-item" }),
    /Hide/
  );
  await assert.rejects(
    a.rollSkill("sneak", "dex", { gearStatus: "available", ...options, breakthrough: true }),
    /INT\/WIS/
  );
});
test("Nest rechecks its source after an independently reserved ability, refunding that allowance if the earned choice changed", async () => {
  reset();
  const a = new SpycraftActor();
  a.system = nestState();
  a.system.classLevels.schemer = 4;
  a.system.abilities = { dex: { mod: 2 }, int: { mod: 5 } };
  a.system.actionDice.max = 3;
  a.system.limitedUses = limitedUseAbilities(a.system, a.items, cfg);
  const update = a.update.bind(a);
  a.update = async p => {
    await update(p);
    if (p["system.resourceUses.allAccordingToPlan"]) a.system.classOptionSelections = [];
  };
  await assert.rejects(
    a.rollSkill("sneak", "dex", {
      gearStatus: "available",
      check: "hide",
      nest: true,
      nestHalfCoverConfirmed: true,
      allAccordingToPlan: true
    }),
    /earned/
  );
  assert.equal(posts.length, 0);
  assert.equal(a.system.resourceUses.allAccordingToPlan, undefined);
  assert.equal(a.system.actionDice.value, 3);
});

const { ambientLightPlan, lowLightVisionSources, AMBIENT_LIGHT } = await import("../module/rules/senses.mjs");
test("all five ambient-light rows match Table 5.14; low-light vision ignores only Faint/Dim penalties", () => {
  const expected = {
    none: [null, -8, 8],
    faint: [-60, -4, 4],
    dim: [-30, -2, 2],
    moderate: [0, 0, 0],
    bright: [30, 1, -2]
  };
  for (const [ambientLight, values] of Object.entries(expected)) {
    const normal = ambientLightPlan({}, { ambientLight, visionCheck: true });
    assert.deepEqual([normal.visualDelta, normal.skillModifier, normal.targetDefenseBonus], values);
    for (const classId of ["scout", "sniper"]) {
      const s = { classOptionSelections: [{ classId, name: "Low-Light Vision" }] },
        p = ambientLightPlan(s, { ambientLight, visionCheck: true }),
        ignored = ["faint", "dim"].includes(ambientLight);
      assert.deepEqual([p.visualDelta, p.skillModifier, p.targetDefenseBonus], ignored ? [0, 0, 0] : values);
      assert.equal(p.blinded, ambientLight === "none");
    }
  }
  assert.equal(Object.keys(AMBIENT_LIGHT).length, 5);
  assert.throws(() => ambientLightPlan({}, { ambientLight: "darkish" }));
  assert.equal(ambientLightPlan({}).specified, false);
});
test("earned class choices and validated Test Subject quality supply low-light vision; unrelated descriptions do not", () => {
  assert.deepEqual(
    lowLightVisionSources({ classOptionSelections: [{ classId: "soldier", name: "Low-Light Vision" }] }),
    []
  );
  assert.deepEqual(lowLightVisionSources({ originEffects: [{ source: "Test Subject", name: "Low-light vision" }] }), [
    "Test Subject low-light vision"
  ]);
  assert.equal(
    ambientLightPlan({ originEffects: [{ name: "Low-light vision" }] }, { ambientLight: "dim", visionCheck: true })
      .skillModifier,
    0
  );
});
test("every named skill option applies ambient light only with its Vision tag; low-light vision never removes helmet penalties", () => {
  for (const [key, skill] of Object.entries(cfg.skills))
    for (const check of skill.checks ?? []) {
      const s = state();
      s.skillTotals[key] = {
        name: skill.name,
        ranks: 6,
        cap: 30,
        threat: 20,
        focus: !!skill.focus,
        totals: check.attributes.map(ability => ({ ability, total: 10 }))
      };
      s.armor = { visionCheck: -3 };
      const baseline = resolveSkillCheck(s, key, check, { gearStatus: "available", synergySkill: "none" }),
        dim = resolveSkillCheck(s, key, check, { gearStatus: "available", synergySkill: "none", ambientLight: "dim" }),
        vision = check.tags.includes("Vision");
      assert.equal(dim.total, baseline.total - (vision ? 2 : 0), key + "/" + check.id);
      s.classOptionSelections = [{ classId: "sniper", name: "Low-Light Vision" }];
      const improved = resolveSkillCheck(s, key, check, {
        gearStatus: "available",
        synergySkill: "none",
        ambientLight: "dim"
      });
      assert.equal(improved.total, baseline.total, key + "/" + check.id);
      const dark = resolveSkillCheck(s, key, check, {
        gearStatus: "available",
        synergySkill: "none",
        ambientLight: "none"
      });
      assert.equal(dark.total, baseline.total - (vision ? 8 : 0));
      if (vision) assert.match(dark.notes, /do not attempt a check requiring eyesight/);
    }
});
test("the actual skill path records lighting and Breakthrough retains the remaining ambient and equipment modifiers", async () => {
  reset();
  const a = new SpycraftActor();
  a.system.armor = { visionCheck: -3 };
  const m = await a.rollSkill("analysis", "int", {
    gearStatus: "available",
    check: "appraise",
    ambientLight: "dim",
    breakthrough: true
  });
  assert.equal(m.flags.spycraft2.rollData.total, 17);
  assert.equal(m.flags.spycraft2.ambientLight.skillModifier, -2);
  assert.equal(m.flags.spycraft2.breakthrough.preservedAdjustment, -5);
  scene = "next";
  a.system.classOptionSelections = [{ classId: "sniper", name: "Low-Light Vision" }];
  const n = await a.rollSkill("analysis", "int", {
    gearStatus: "available",
    check: "appraise",
    ambientLight: "dim",
    breakthrough: true
  });
  assert.equal(n.flags.spycraft2.rollData.total, 19);
  assert.equal(n.flags.spycraft2.breakthrough.preservedAdjustment, -3);
  const dark = await a.rollSkill("analysis", "int", {
    gearStatus: "available",
    check: "appraise",
    ambientLight: "none"
  });
  assert.equal(dark.flags.spycraft2.rollData.total, -3);
  assert.equal(dark.flags.spycraft2.ambientLight.blinded, true);
  assert.match(dark.flavor, /requiring eyesight/);
  assert.equal(posts.length, 3);
});
