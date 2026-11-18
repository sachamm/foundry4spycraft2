import test from "node:test";
import assert from "node:assert/strict";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { limitedUseAbilities } from "../module/rules/limited-uses.mjs";

import { oldSchoolPlan, oldSchoolEligible } from "../module/rules/old-school.mjs";
import { rollEvidence, rollEvidenceMatches, adjudicateCheck } from "../module/rules/outcomes.mjs";
let serial = 0,
  posts = [],
  actors = [],
  natural = 7,
  stressDie = 4,
  evaluations = { d20: 0, stress: 0 },
  failPost = "",
  hook = null,
  periods = { scene: "s", session: "t", mission: "m" };
function apply(o, p) {
  for (const [path, value] of Object.entries(p)) {
    const keys = path.split(".");
    let target = o;
    for (const key of keys.slice(0, -1)) target = target[key] ??= {};
    const last = keys.at(-1);
    if (last.startsWith("-=")) delete target[last.slice(2)];
    else target[last] = structuredClone(value);
  }
}
const state = () => ({
  activeFeatNames: ["Old School", "Training", "Charmer", "Career Agent"],
  activeFeatSelections: [],
  resourceUses: {},
  usagePeriods: { scene: "s", session: "t", mission: "m" },
  actionDice: { value: 0, max: 3, die: 4 },
  abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 14, mod: 2 }])),
  skillTotals: Object.fromEntries(
    Object.values(cfg.skills).map(s => [
      s.key,
      {
        name: s.name,
        ranks: s.key === "analysis" ? 6 : 0,
        cap: 30,
        threat: 20,
        bonusEntries: [],
        totals: s.abilities.map(ability => ({ ability, total: 7 }))
      }
    ])
  ),
  analysisTasks: {},
  accumulatedDamage: { version: 1, revision: 1, stress: 0, subdual: 0, pending: [] },
  survivalStats: { resistances: {}, resistanceSources: [], noFear: null },
  stressThreshold: 14,
  subdualThreshold: 14,
  saves: { will: { total: 2 }, fort: { total: 2 }, ref: { total: 2 } }
});
globalThis.Actor = class {
  constructor() {
    this.uuid = "Actor.pressure" + ++serial;
    this.name = "Pressure fixture";
    this.type = "agent";
    this.isOwner = true;
    this.flags = {};
    this.items = new Map();
    this.items.filter = fn => [...this.items.values()].filter(fn);
    this.items.find = fn => [...this.items.values()].find(fn);
    this.extraUses = [];
    this.system = state();
  }
  async update(p) {
    apply(this, p);
    this.system.limitedUses = [...limitedUseAbilities(this.system, [], cfg), ...this.extraUses];
    return this;
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = {
  user: { id: "gm", isGM: true },
  settings: { get: () => periods },
  time: { worldTime: 0 },
  i18n: { localize: String, format: String },
  messages: {
    get contents() {
      return posts;
    },
    [Symbol.iterator]() {
      return posts[Symbol.iterator]();
    }
  },
  actors: {
    get contents() {
      return actors;
    },
    get: id => actors.find(a => a.id === id),
    [Symbol.iterator]() {
      return actors[Symbol.iterator]();
    }
  },
  combats: []
};
globalThis.foundry = {
  utils: { randomID: () => String(++serial), escapeHTML: String },
  applications: { api: { DialogV2: { input: async () => null } } }
};
globalThis.ui = { notifications: { warn: message => ({ native: true, message }) } };
globalThis.ChatMessage = { getSpeaker: () => ({}) };
globalThis.fromUuid = async uuid => posts.find(m => m.uuid === uuid) ?? actors.find(a => a.uuid === uuid) ?? null;
globalThis.Roll = class {
  constructor(formula, data = {}) {
    this.formula = formula;
    const stress = formula.replace(/\s/g, "") === "1d6",
      fixed = /^(10|20)\b/.test(formula);
    this.total = (stress ? stressDie : fixed ? parseInt(formula) : natural) + (data.total ?? data.mod ?? 0);
    this.dice = fixed
      ? []
      : [
          {
            number: 1,
            faces: stress ? 6 : 20,
            total: stress ? stressDie : natural,
            results: [{ result: stress ? stressDie : natural, active: true }]
          }
        ];
    this._evaluated = false;
  }
  async evaluate() {
    this._evaluated = true;
    evaluations[this.formula.replace(/\s/g, "") === "1d6" ? "stress" : "d20"]++;
    await hook?.("evaluate", this);
    return this;
  }
  toJSON() {
    return { formula: this.formula, total: this.total, dice: structuredClone(this.dice), _evaluated: this._evaluated };
  }
  static fromJSON(json) {
    const data = JSON.parse(json),
      r = new Roll(data.formula);
    Object.assign(r, data);
    return r;
  }
  async toMessage(data) {
    await hook?.("post", this, data);
    if (failPost === "before") throw Error("post failed");
    const m = {
      ...data,
      id: "r" + ++serial,
      uuid: "ChatMessage.r" + serial,
      rolls: [this],
      async update(p) {
        apply(this, p);
        return this;
      }
    };
    posts.push(m);
    if (failPost === "committed") throw Error("post committed then rejected");
    return m;
  }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");
function actor() {
  periods = { scene: "s", session: "t", mission: "m" };
  posts = [];
  actors = [];
  natural = 7;
  stressDie = 4;
  evaluations = { d20: 0, stress: 0 };
  failPost = "";
  hook = null;
  game.time.worldTime = 0;
  game.spycraft2 = {};
  game.user.isGM = true;
  const a = new SpycraftActor();
  a.system.limitedUses = limitedUseAbilities(a.system, [], cfg);
  actors.push(a);
  return a;
}
const facts = {
  target: "Veteran <agent>",
  targetLevel: 6,
  missionThreatLevel: 6,
  sharedClassAbility: "Accurate",
  sharedFeats: [],
  confirmed: true
};
const roll = (a, patch = {}) =>
  a.rollCheck(
    "1d20 + @total",
    { total: 7 },
    { checkKind: "skill", ability: "cha", skillKey: "impress", checkId: "influence", oldSchool: facts, ...patch }
  );
test("every level boundary and both alternate shared-source qualifications require explicit current facts", () => {
  for (let mission = 1; mission <= 20; mission++)
    for (let target = 1; target <= 20; target++) {
      const input = { ...facts, targetLevel: target, missionThreatLevel: mission };
      if (target <= mission)
        assert.equal(oldSchoolPlan(state(), { ability: "cha", checkKind: "skill" }, input).bonus, 4);
      else assert.throws(() => oldSchoolPlan(state(), { ability: "cha", checkKind: "skill" }, input), /Level/);
    }
  const input = { ...facts, sharedClassAbility: "", sharedFeats: ["Charmer", "Training", "Career Agent", "Training"] };
  assert.equal(oldSchoolPlan(state(), { ability: "cha" }, input).sharedFeats.length, 3);
  for (const patch of [
    { sharedClassAbility: "", sharedFeats: ["Training", "Training", "Training"] },
    { sharedClassAbility: "", sharedFeats: ["Training", "Charmer"] },
    { sharedFeats: ["Unknown"] },
    { target: "" },
    { confirmed: "true" },
    { confirmed: false },
    { targetLevel: 0 },
    { targetLevel: 6.5 },
    { missionThreatLevel: NaN },
    { sharedFeats: "Training" }
  ])
    assert.throws(() => oldSchoolPlan(state(), { ability: "cha" }, { ...facts, ...patch }));
});
test("final attribute controls eligibility for all check kinds, including named skill uses and substituted attributes", () => {
  for (const ability of Object.keys(cfg.abilities))
    for (const checkKind of [
      "skill",
      "ability",
      "knowledge",
      "attack",
      "save",
      "initiative",
      "gear",
      "check",
      "damage"
    ])
      assert.equal(oldSchoolEligible(state(), { ability, checkKind }), ability === "cha" && checkKind !== "damage");
  for (const skill of Object.values(cfg.skills))
    for (const check of skill.checks)
      for (const ability of skill.abilities)
        assert.equal(
          oldSchoolEligible(state(), { ability, checkKind: "skill", skillKey: skill.key, checkId: check.id }),
          ability === "cha"
        );
  assert.equal(oldSchoolEligible(state(), { ability: "cha", resultSource: "masterThief" }), false);
});
test("actual Actor adds the unnamed check bonus once before caps without altering dice, formula, skill bonus or boost permissions", async () => {
  for (const cap of [null, 15, 30]) {
    const a = actor(),
      m = await roll(a, { cap });
    const c = m.flags.spycraft2;
    assert.equal(c.rawTotal, 18);
    assert.equal(c.rolledTotal, 14);
    assert.equal(c.effectiveTotal, cap === 15 ? 15 : 18);
    assert.equal(c.naturalDie, 7);
    assert.equal(c.oldSchool.bonus, 4);
    assert.equal(c.formula, "1d20 + @total");
    assert.equal(c.rollData.total, 7);
    assert.equal(c.actionDiceAllowed, true);
    assert.match(m.flavor, /Veteran &lt;agent&gt;/);
    assert.match(m.flavor, /Effective result/);
    assert.equal(a.system.actionDice.value, 0);
    const final = adjudicateCheck(c, true);
    assert.equal(final.effectiveTotal, cap === 15 ? 15 : 18);
    assert.equal(c.rawTotal, 18);
  }
});
test("fixed checks, Practice Makes Perfect and alternative rolls preserve the natural die and apply the bonus only once", async () => {
  let a = actor(),
    m = await a.rollCheck(
      "10 + @total",
      { total: 7 },
      { ability: "cha", checkKind: "skill", checkMethod: "take10", oldSchool: facts }
    );
  assert.equal(m.flags.spycraft2.rawTotal, 21);
  assert.equal(m.flags.spycraft2.naturalDie, null);
  assert.equal(m.flags.spycraft2.actionDiceAllowed, false);
  a = actor();
  m = await roll(a, { practiceMakesPerfect: true });
  assert.equal(m.flags.spycraft2.rawTotal, 21);
  assert.equal(m.flags.spycraft2.minimumAdjustment, 3);
  assert.equal(m.flags.spycraft2.naturalDie, 7);
  m = await roll(a, { chooseTwice: true });
  assert.equal(m.flags.spycraft2.alternatives.length, 2);
  assert.equal(m.flags.spycraft2.rawTotal, 18);
  assert.equal(evaluations.d20, 3);
});
test("actual Ability and Skill entry points forward explicit facts; changed final attribute cannot retain the bonus", async () => {
  let a = actor(),
    m = await a.rollAbility("cha", { oldSchool: facts });
  assert.equal(m.flags.spycraft2.rawTotal, 13);
  assert.equal(m.flags.spycraft2.ability, "cha");
  m = await a.rollSkill("impress", "cha", { check: "influence", oldSchool: facts, synergySkill: "none" });
  assert.ok(m.flags.spycraft2.oldSchool);
  a.system.classLevels = { schemer: 4 };
  await a.update({});
  await assert.rejects(
    a.rollSkill("impress", "cha", { check: "influence", allAccordingToPlan: true, oldSchool: facts }),
    /Charisma/
  );
  assert.equal(a.system.resourceUses.allAccordingToPlan, undefined);
});
test("source, shared feat, class source and mission drift during real RNG reject posting", async () => {
  for (const phase of ["source", "shared", "class", "mission"]) {
    const a = actor(),
      input =
        phase === "shared"
          ? { ...facts, sharedClassAbility: "", sharedFeats: ["Training", "Charmer", "Career Agent"] }
          : facts;
    hook = () => {
      if (phase === "source") a.system.activeFeatNames = [];
      if (phase === "shared") a.system.activeFeatNames = a.system.activeFeatNames.filter(n => n !== "Charmer");
      if (phase === "class") a.system.classLevels = { soldier: 1 };
      if (phase === "mission") periods.mission = "next";
    };
    await assert.rejects(roll(a, { oldSchool: input }), /Old School|shared feat/);
    assert.equal(posts.length, 0);
  }
});
test("Old School target evidence is immutable, while legacy receipts remain compatible", async () => {
  const a = actor(),
    m = await roll(a),
    c = m.flags.spycraft2,
    e = rollEvidence(c);
  assert.equal(rollEvidenceMatches(e, c), true);
  for (const key of Object.keys(c.oldSchool)) {
    const changed = structuredClone(c);
    changed.oldSchool[key] = "changed";
    assert.equal(rollEvidenceMatches(e, changed), false, key);
  }
  const legacy = { checkKind: "skill", rawTotal: 12 };
  assert.equal(rollEvidenceMatches(rollEvidence(legacy), legacy), true);
  assert.equal(rollEvidenceMatches(e, { ...c, oldSchool: null }), false);
});
test("the actual prompt supports decline and cancellation with no roll, and rejects incomplete declarations", async () => {
  const a = actor(),
    original = foundry.applications.api.DialogV2.input;
  let content;
  try {
    foundry.applications.api.DialogV2.input = async options => {
      content = options.content;
      return null;
    };
    assert.equal(await a.rollAbility("cha"), null);
    assert.equal(evaluations.d20, 0);
    assert.match(content, /sharedClassAbility/);
    foundry.applications.api.DialogV2.input = async () => ({ apply: false });
    const m = await a.rollAbility("cha");
    assert.equal(m.flags.spycraft2.oldSchool, null);
    assert.equal(m.flags.spycraft2.rawTotal, 9);
    foundry.applications.api.DialogV2.input = async () => ({ apply: true, ...facts, sharedFeats: "" });
    const n = await a.rollAbility("cha");
    assert.equal(n.flags.spycraft2.rawTotal, 13);
    foundry.applications.api.DialogV2.input = async () => ({
      apply: true,
      ...facts,
      confirmed: false,
      sharedFeats: ""
    });
    await assert.rejects(a.rollAbility("cha"), /Confirm/);
  } finally {
    foundry.applications.api.DialogV2.input = original;
  }
});
test("a real permitted reroll preserves the same target and applies +4 once without reusing a stale mission", async () => {
  const a = actor(),
    m = await roll(a);
  await a.confirmCheckOutcome(m, { succeeded: false });
  a.extraUses.push({
    id: "perfect",
    name: "Perfect",
    workflow: "reroll",
    mastery: "Perfect Skill Mastery",
    period: "session",
    limit: 3,
    cost: 0
  });
  await a.update({});
  natural = 8;
  const n = await a.rerollCheck(m, { resource: "perfect", failed: true });
  assert.equal(n.flags.spycraft2.rawTotal, 19);
  assert.equal(n.flags.spycraft2.rolledTotal, 15);
  assert.deepEqual(n.flags.spycraft2.oldSchool, m.flags.spycraft2.oldSchool);
  assert.equal(a.system.resourceUses.perfect.used, 1);
});

test("critical-range natural results and negative checks retain their ordinary semantics with the +4 check bonus", async () => {
  for (const die of [1, 20]) {
    const a = actor();
    natural = die;
    const m = await roll(a, { cap: 15 });
    assert.equal(m.flags.spycraft2.naturalDie, die);
    assert.equal(m.flags.spycraft2.error, 1);
    assert.equal(m.flags.spycraft2.threat, 20);
    assert.equal(m.flags.spycraft2.rawTotal, die + 11);
  }
  const a = actor(),
    m = await a.rollCheck("1d20 + @total", { total: -20 }, { checkKind: "skill", ability: "cha", oldSchool: facts });
  assert.equal(m.flags.spycraft2.rawTotal, -9);
  assert.equal(m.flags.spycraft2.effectiveTotal, -9);
});
