import test from "node:test";
import assert from "node:assert/strict";
import {
  attributeCollapsePlan,
  wisdomCollapseEpisode,
  attributeActionBlock,
  attributeDefensePlan
} from "../module/rules/attributes.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { healingPlan, refreshPlan } from "../module/rules/health.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const keys = ["str", "dex", "con", "int", "wis", "cha"],
  state = (key, value) => ({ abilities: Object.fromEntries(keys.map(k => [k, { value: k === key ? value : 12 }])) }),
  expected = {
    str: ["Dazed", "Sprawled", "Helpless"],
    dex: ["Paralyzed"],
    con: ["Dead"],
    int: ["Stunned"],
    wis: [],
    cha: ["Unconscious"]
  };
test("all six zero/negative attribute boundaries derive their exact conditions without clamping scores or confusing ordinary low positive scores", () => {
  for (const key of keys)
    for (const value of [-20, -1, 0, 1, 8, 12]) {
      const s = state(key, value),
        before = structuredClone(s),
        p = attributeCollapsePlan(s);
      assert.equal(p.entries.length, value <= 0 ? 1 : 0, key + "/" + value);
      assert.deepEqual(p.conditions, value <= 0 ? expected[key] : []);
      assert.equal(p.dead, key === "con" && value <= 0);
      assert.equal(p.immobile, key !== "wis" && value <= 0);
      assert.equal(p.wisdomEpisode, key === "wis" && value <= 0);
      assert.deepEqual(s, before);
    }
  for (const key of ["str", "dex"]) assert.match(attributeCollapsePlan(state(key, 0)).entries[0].text, /still speak/);
  assert.deepEqual(attributeCollapsePlan({}).entries, []);
  assert.deepEqual(attributeCollapsePlan(state("str", NaN)).entries, []);
});
test("multiple collapsed attributes retain every independent consequence; Wisdom alone does not invent a movement penalty", () => {
  const s = { abilities: Object.fromEntries(keys.map(k => [k, { value: 0 }])) },
    p = attributeCollapsePlan(s);
  assert.equal(p.entries.length, 6);
  assert.deepEqual(p.conditions, ["Dazed", "Sprawled", "Helpless", "Paralyzed", "Dead", "Stunned", "Unconscious"]);
  assert.equal(p.wisdomEpisode, true);
  assert.equal(attributeCollapsePlan(state("wis", 0)).immobile, false);
});
const cls = {
    id: "test",
    name: "Test",
    type: "class",
    system: { identifier: "test", skillPoints: 4, vitalityDie: 8, proficiencies: 0, classSkills: [], table: [] }
  },
  source = () => ({
    abilities: Object.fromEntries(keys.map(k => [k, { base: 12, misc: 0 }])),
    progression: [{ classId: "test", vitality: 8, skills: {} }],
    actionDice: { value: 3 },
    wounds: { value: 4 },
    vitality: { value: 4 },
    focuses: {}
  });
test("engine keeps damaged scores and modifiers, blocks movement for collapse, preserves earned Intelligence pools/focuses and leaves raw health/dice untouched", () => {
  for (const key of keys) {
    const s = source();
    s.abilities[key].misc = -13;
    const result = computeAgent(s, [cls], cfg);
    assert.equal(result.abilities[key].value, -1);
    assert.equal(result.abilities[key].mod, -6);
    assert.equal(result.speed, key === "wis" ? 30 : 0);
    assert.equal(result.attributeCollapse.entries[0].key, key);
    assert.equal(result.vitality.value, 4);
    assert.equal(result.wounds.value, 4);
    assert.equal(result.actionDice.value, 3);
    assert.ok(result.warnings.some(w => w.includes(result.attributeCollapse.entries[0].label + " -1")));
  }
  const baseline = computeAgent(source(), [cls], cfg),
    damaged = source();
  damaged.abilities.int.misc = -12;
  const after = computeAgent(damaged, [cls], cfg);
  assert.equal(after.skillPoints[0].available, baseline.skillPoints[0].available);
  assert.equal(after.focusPicks.generic.available, baseline.focusPicks.generic.available);
});
test("zero or negative Constitution blocks both action-die healing and Refresh despite healthy wounds, while missing/positive attributes retain existing behavior", () => {
  const base = { actionDice: { value: 3, die: 4 }, wounds: { value: 4, max: 12 }, vitality: { value: 4, max: 12 } },
    combat = { id: "combat", started: true, round: 1 },
    opts = { combatantId: "me", currentCombatantId: "me", forfeitActions: true };
  for (const con of [-5, 0, 1, 12]) {
    const s = { ...base, ...state("con", con) };
    assert.equal(healingPlan(s, { vitalityDice: 1 }).blocked, con <= 0);
    assert.equal(refreshPlan(s, combat, opts).blocked, con <= 0);
  }
  assert.equal(healingPlan(base, { vitalityDice: 1 }).blocked, false);
  assert.equal(refreshPlan(base, combat, opts).blocked, false);
  for (const key of keys) assert.equal(refreshPlan({ ...base, ...state(key, 0) }, combat, opts).blocked, true, key);
});
test("every Wisdom-episode die result has equal-probability outcomes, exact 2d10 minutes and one doubling for any combination of qualifying conditions", () => {
  for (const choiceDie of [1, 2])
    for (let a = 1; a <= 10; a++)
      for (let b = 1; b <= 10; b++)
        for (let mask = 0; mask < 8; mask++) {
          const p = wisdomCollapseEpisode(state("wis", 0), {
            choiceDie,
            durationDice: [a, b],
            sleeping: !!(mask & 1),
            stunned: !!(mask & 2),
            unconscious: !!(mask & 4)
          });
          assert.equal(p.condition, choiceDie === 1 ? "Frenzied" : "Terrified");
          assert.equal(p.minutes, (a + b) * (mask ? 2 : 1));
        }
  for (const other of ["int", "cha"]) {
    const s = state("wis", 0);
    s.abilities[other].value = 0;
    assert.equal(wisdomCollapseEpisode(s, { choiceDie: 1, durationDice: [2, 4] }).minutes, 12);
  }
  assert.throws(() => wisdomCollapseEpisode(state("wis", 1), { choiceDie: 1, durationDice: [1, 1] }), /Wisdom/);
  for (const dice of [[], [1], [0, 1], [1, 11], [1, 1.5]])
    assert.throws(() => wisdomCollapseEpisode(state("wis", 0), { choiceDie: 1, durationDice: dice }), /d10/);
  assert.throws(() => wisdomCollapseEpisode(state("wis", 0), { choiceDie: 3, durationDice: [1, 1] }));
});
let rolls = [],
  posts = [],
  notifications = [],
  input = null;
globalThis.Actor = class {};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = { user: { isGM: true }, i18n: { localize: s => s }, settings: { get: () => ({}) } };
globalThis.foundry = {
  applications: { api: { DialogV2: { input: async () => input } } },
  utils: { escapeHTML: s => String(s) }
};
globalThis.ui = {
  notifications: {
    warn: s => {
      notifications.push(s);
      return null;
    }
  }
};
globalThis.Roll = class {
  constructor(formula) {
    this.formula = formula;
  }
  async evaluate() {
    rolls.push(this.formula);
    if (this.formula === "1d2") {
      this.total = 2;
      this.dice = [{ results: [{ result: 2 }] }];
    } else {
      this.total = 7;
      this.dice = [{ results: [{ result: 3 }, { result: 4 }] }];
    }
    return this;
  }
};
globalThis.ChatMessage = {
  getSpeaker: () => ({}),
  async create(data) {
    posts.push(data);
    return data;
  }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");
test("the actor episode workflow is explicitly GC-declared, posts both real dice, respects current conditions and spends no health/dice or permanent condition state", async () => {
  const a = new SpycraftActor();
  a.type = "agent";
  a.isOwner = true;
  a.uuid = "Actor.qa";
  a.system = { ...state("wis", 0), actionDice: { value: 3 }, wounds: { value: 4 } };
  a.statuses = new Set(["stunned"]);
  const before = structuredClone(a.system);
  input = null;
  assert.equal(await a.rollWisdomCollapse(), null);
  assert.equal(await a.rollWisdomCollapse({ confirmed: "true" }), null);
  const result = await a.rollWisdomCollapse({ confirmed: true });
  assert.equal(result.condition, "Terrified");
  assert.equal(result.minutes, 14);
  assert.deepEqual(rolls, ["1d2", "2d10"]);
  assert.equal(posts.at(-1).rolls.length, 2);
  assert.equal(posts.at(-1).flags.spycraft2.actionDiceAllowed, false);
  assert.deepEqual(a.system, before);
  a.system.abilities.wis.value = 1;
  assert.equal(await a.rollWisdomCollapse({ confirmed: true }), null);
});

test("No-Action conditions reject skills, Knowledge, attacks and mental abilities; paralysis preserves Knowledge/pure mental actions with its explicit STR/DEX prohibition", () => {
  for (const key of ["str", "con", "int", "cha"])
    for (const kind of ["skill", "knowledge", "attack", "mentalAbility"])
      assert.match(
        attributeActionBlock(state(key, 0), { kind, ability: "int", purelyMentalConfirmed: true }),
        /no actions/
      );
  for (const status of ["dead", "unconscious", "stunned", "dazed"])
    assert.match(attributeActionBlock({ conditionContext: { [status]: true } }, { kind: "skill" }), /no actions/);
  const p = state("dex", 0);
  assert.equal(attributeActionBlock(p, { kind: "knowledge" }), "");
  assert.equal(attributeActionBlock(p, { kind: "mentalAbility" }), "");
  assert.match(attributeActionBlock(p, { kind: "attack" }), /Paralyzed/);
  for (const ability of ["str", "dex"])
    assert.match(attributeActionBlock(p, { kind: "skill", ability, purelyMentalConfirmed: true }), /Paralyzed/);
  for (const ability of ["con", "int", "wis", "cha"]) {
    assert.match(attributeActionBlock(p, { kind: "skill", ability }), /confirm/);
    assert.equal(attributeActionBlock(p, { kind: "skill", ability, purelyMentalConfirmed: true }), "");
  }
  assert.equal(attributeActionBlock(state("wis", 0), { kind: "skill" }), "");
});
test("dead characters cannot roll saves, while involuntary saves remain available for non-dead No-Action conditions and default Foundry stun/sleep IDs double Wisdom episodes", async () => {
  const a = new SpycraftActor();
  a.type = "agent";
  a.isOwner = true;
  a.uuid = "Actor.qa";
  a.system = state("con", 0);
  a.statuses = new Set();
  let called = 0;
  a.rollCheck = async () => {
    called++;
    return "save";
  };
  assert.equal(await a.rollSave("fort"), null);
  assert.equal(called, 0);
  a.system = state("str", 0);
  assert.equal(await a.rollSave("fort"), "save");
  assert.equal(called, 1);
  for (const id of ["stun", "sleep"]) {
    a.system = state("wis", 0);
    a.statuses = new Set([id]);
    const p = await a.rollWisdomCollapse({ confirmed: true });
    assert.equal(p.doubleDuration, true);
    assert.equal(p.minutes, 14);
  }
});

test("vulnerability from collapse, Mental Leap and manual conditions loses positive Dexterity/dodge only; prone alone stays distinct", () => {
  const dodgeEntries = [
    { type: "dodge", value: 3 },
    { type: "dodge", value: 2 },
    { type: "dodge", value: -2 },
    { type: "unnamed", value: 4 }
  ];
  for (const dexterity of [-4, 0, 4])
    for (const key of [
      "helpless",
      "unconscious",
      "paralyzed",
      "sleeping",
      "vulnerable",
      "stunned",
      "sprawled",
      "held",
      "pinned"
    ]) {
      const p = attributeDefensePlan(
        { abilities: { dex: { mod: dexterity } }, conditionContext: { [key]: true } },
        { dodgeEntries }
      );
      assert.equal(p.vulnerable, true, key);
      assert.equal(p.dexterity, Math.min(0, dexterity), key);
      assert.equal(p.dodgeLost, 5, key);
      assert.equal(p.helpless, ["helpless", "unconscious", "paralyzed", "sleeping"].includes(key), key);
    }
  for (const key of ["str", "dex", "int", "cha"])
    assert.equal(attributeDefensePlan(state(key, 0)).vulnerable, true, key);
  for (const key of ["wis", "con"]) assert.equal(attributeDefensePlan(state(key, 0)).vulnerable, false, key);
  assert.equal(attributeDefensePlan({ mentalLeapState: { unconscious: true } }).helpless, true);
  assert.equal(
    attributeDefensePlan({ conditionContext: { prone: true }, abilities: { dex: { mod: 4 } } }, { dodgeEntries })
      .dexterity,
    4
  );
  assert.equal(attributeDefensePlan({ encumbrance: { condition: "Vulnerable" } }, { dodgeEntries }).dodgeLost, 5);
});
test("engine applies vulnerability to current Defense without spending health/dice or mutating stored attributes", () => {
  const normal = source();
  normal.abilities.dex.base = 16;
  const a = computeAgent(normal, [cls], cfg);
  const manual = source();
  manual.abilities.dex.base = 16;
  manual.conditionContext = { unconscious: true };
  const b = computeAgent(manual, [cls], cfg);
  assert.equal(b.helpless, true);
  assert.equal(b.defense.dexterity, 0);
  assert.equal(b.defense.total, a.defense.total - 3);
  assert.equal(b.actionDice.value, 3);
  assert.equal(b.wounds.value, 4);
  const low = source();
  low.abilities.dex.base = 8;
  low.conditionContext = { stunned: true };
  const c = computeAgent(low, [cls], cfg);
  assert.equal(c.defense.dexterity, -1);
  assert.equal(c.defense.vulnerable, true);
});
