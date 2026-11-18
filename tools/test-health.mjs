import test from "node:test";
import assert from "node:assert/strict";
import {
  deathThreshold,
  healingPlan,
  healingResult,
  activeDefenseBoost,
  defenseBoostPlan,
  refreshPlan,
  activeFortunesOfWar,
  fortunesOfWarPlan
} from "../module/rules/health.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const system = () => ({
  size: "Medium",
  deathThreshold: -10,
  vitality: { value: 2, max: 10 },
  wounds: { value: 4, max: 10 },
  actionDice: { value: 5, die: 4, explodeAt: 3, bonus: 1 }
});
const combat = { id: "combat", started: true, round: 2 };
test("RAW pp.331,349: death thresholds are size-adjusted negative ten, independent of Constitution and maximum wounds", () => {
  assert.equal(deathThreshold(), -10);
  assert.equal(deathThreshold("Small"), -7);
  assert.equal(deathThreshold("Large (1×1)"), -15);
  const cls = {
    id: "c",
    name: "Test",
    type: "class",
    system: { identifier: "test", table: [], classSkills: [], skillPoints: 4, vitalityDie: 6 }
  };
  for (const con of [8, 18]) {
    const sys = computeAgent(
      {
        abilities: Object.fromEntries(
          ["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: k === "con" ? con : 10 }])
        ),
        progression: [{ classId: "test", skills: {}, vitality: 1 }]
      },
      [cls],
      cfg
    );
    assert.equal(sys.deathThreshold, -10);
    assert.equal(sys.wounds.max, con);
  }
});
test("RAW p.62: each healing die restores its own vitality result with modifiers, or exactly two wounds; maxima cap gains", () => {
  const sys = system(),
    plan = healingPlan(sys, { vitalityDice: 2, woundDice: 1 });
  assert.equal(plan.cost, 3);
  assert.equal(plan.formula, "1d4x>=3 + (1) + 1d4x>=3 + (1)");
  const result = healingResult(sys, plan, [4, 3]);
  assert.equal(result.vitality, 10);
  assert.equal(result.healedVitality, 8);
  assert.equal(result.wounds, 6);
  assert.equal(result.healedWounds, 2);
  sys.vitality.value = 15;
  assert.equal(healingResult(sys, plan, [4, 3]).vitality, 15);
  assert.throws(() => healingResult(sys, plan, [4]), /One result/);
});
test("healing validates whole-number costs, available dice, death, full resources and the separate combat Refresh requirement", () => {
  const sys = system();
  for (const options of [
    {},
    { vitalityDice: 1.5 },
    { vitalityDice: -1 },
    { woundDice: 6 },
    { woundDice: 1, inCombat: true },
    { woundDice: 1, dead: true }
  ])
    assert.equal(healingPlan(sys, options).blocked, true);
  sys.wounds.value = -10;
  assert.equal(healingPlan(sys, { woundDice: 1 }).blocked, true);
  sys.wounds.value = -9;
  assert.equal(healingPlan(sys, { woundDice: 1 }).blocked, false);
  sys.size = "Small";
  delete sys.deathThreshold;
  sys.wounds.value = -7;
  assert.equal(healingPlan(sys, { woundDice: 1 }).blocked, true);
  sys.wounds.value = 10;
  sys.vitality.value = 10;
  assert.equal(healingPlan(sys, { vitalityDice: 1, woundDice: 1 }).blocked, true);
});
test("RAW p.62: Defense duration includes the initial round and never carries to another or ended combat", () => {
  const sys = { defenseBoost: { combatId: "combat", startRound: 2, expiresAtRound: 5 }, combatContext: { ...combat } };
  for (const round of [2, 3, 4]) {
    sys.combatContext.round = round;
    assert.equal(activeDefenseBoost(sys).bonus, 2);
    assert.equal(activeDefenseBoost(sys).lastRound, 4);
  }
  for (const context of [
    { ...combat, round: 1 },
    { ...combat, round: 5 },
    { ...combat, id: "other" },
    { ...combat, started: false }
  ])
    assert.equal(activeDefenseBoost({ ...sys, combatContext: context }), null);
});
test("Defense spending requires round-start declaration and combat participation; active boosts must be replaced rather than stacked", () => {
  const sys = system();
  assert.equal(defenseBoostPlan(sys, combat, { atStartOfRound: true, combatant: true }).cost, 1);
  for (const options of [{}, { atStartOfRound: true }, { combatant: true }])
    assert.equal(defenseBoostPlan(sys, combat, options).blocked, true);
  sys.defenseBoost = { combatId: "combat", startRound: 2, expiresAtRound: 4 };
  assert.equal(defenseBoostPlan(sys, combat, { atStartOfRound: true, combatant: true }).blocked, true);
  assert.equal(
    defenseBoostPlan(sys, combat, { atStartOfRound: true, combatant: true, replaceExisting: true }).blocked,
    false
  );
});
test("the engine adds one flat two-point Defense bonus with a source breakdown and drops it at expiry", () => {
  const cls = {
    id: "c",
    name: "Test",
    type: "class",
    system: { identifier: "test", table: [], classSkills: [], skillPoints: 4, vitalityDie: 6 }
  };
  const input = {
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 10 }])),
    progression: [{ classId: "test", skills: {}, vitality: 1 }],
    combatContext: { ...combat },
    defenseBoost: { combatId: "combat", startRound: 2, expiresAtRound: 4 }
  };
  computeAgent(input, [cls], cfg);
  assert.equal(input.defense.total, 12);
  assert.ok(
    input.bonusSources.defense.some(source => source.source === "Action die Defense boost" && source.value === 2)
  );
  input.combatContext.round = 4;
  computeAgent(input, [cls], cfg);
  assert.equal(input.defense.total, 10);
});
globalThis.Actor = class {
  constructor() {
    this.uuid = "Actor.test";
    this.type = "agent";
    this.isOwner = true;
    this.statuses = new Set();
    this.system = system();
  }
  async update(data) {
    for (const [path, value] of Object.entries(data)) {
      const keys = path.replace(/^system\./, "").split(".");
      let o = this.system;
      for (const key of keys.slice(0, -1)) o = o[key] ??= {};
      const key = keys.at(-1);
      if (key.startsWith("-=")) delete o[key.slice(2)];
      else o[key] = value;
    }
  }
};
globalThis.game = { combat: null };
globalThis.ui = { notifications: { warn: () => null } };
let failPost = false,
  rollResults = [4, 3],
  rollTotal = 9,
  rollCount = 0,
  posts = 0,
  postHook = null;
const post = async () => {
  postHook?.();
  if (failPost) throw Error("message rejected");
  posts++;
  return {};
};
globalThis.ChatMessage = { getSpeaker: () => ({}), create: post };
globalThis.Roll = class {
  constructor(formula) {
    this.formula = formula;
    this.dice = rollResults.map(total => ({ total }));
    this.total = rollTotal;
    rollCount++;
  }
  async evaluate() {
    return this;
  }
  async toMessage() {
    return post();
  }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");
test("document healing spends real dice, updates both resources, and wound-only healing does not roll a die", async () => {
  const actor = new SpycraftActor();
  const result = await actor.healWithActionDice({ vitalityDice: 2, woundDice: 1 });
  assert.equal(result.healedVitality, 8);
  assert.equal(actor.system.actionDice.value, 2);
  assert.equal(actor.system.wounds.value, 6);
  const count = rollCount;
  await actor.healWithActionDice({ woundDice: 1 });
  assert.equal(rollCount, count);
  assert.equal(actor.system.wounds.value, 8);
  assert.equal(actor.system.actionDice.value, 1);
});
test("a failed healing post refunds dice and healing while preserving an unrelated wound loss", async () => {
  const actor = new SpycraftActor();
  failPost = true;
  postHook = () => {
    actor.system.wounds.value--;
  };
  await assert.rejects(actor.healWithActionDice({ woundDice: 1 }), /message rejected/);
  assert.equal(actor.system.actionDice.value, 5);
  assert.equal(actor.system.wounds.value, 3);
  assert.equal(actor.system.vitality.value, 2);
  failPost = false;
  postHook = null;
});
test("document Defense boosts store combat and expiry, reject stacking, and restore the old effect and die when posting fails", async () => {
  const actor = new SpycraftActor();
  game.combat = { ...combat, combatants: [{ actor: { uuid: actor.uuid } }] };
  rollResults = [3];
  rollTotal = 4;
  const boost = await actor.boostDefenseWithActionDie({ atStartOfRound: true });
  assert.equal(boost.expiresAtRound, 6);
  assert.equal(actor.system.actionDice.value, 4);
  const old = structuredClone(actor.system.defenseBoost);
  assert.equal(await actor.boostDefenseWithActionDie({ atStartOfRound: true }), null);
  assert.equal(actor.system.actionDice.value, 4);
  failPost = true;
  await assert.rejects(
    actor.boostDefenseWithActionDie({ atStartOfRound: true, replaceExisting: true }),
    /message rejected/
  );
  assert.equal(actor.system.actionDice.value, 4);
  assert.deepEqual(actor.system.defenseBoost, old);
  failPost = false;
  game.combat = null;
});

test("healing and per-round counters follow the actor’s participating combat, not whichever encounter is being viewed", async () => {
  const actor = new SpycraftActor();
  game.settings = { get: () => ({ round: "manual" }) };
  const other = { id: "other", round: 9, started: true, combatants: [{ actor: { uuid: "Actor.other" } }] };
  game.combat = other;
  game.combats = [other];
  assert.equal(actor.participatingCombat, null);
  assert.equal(actor.usagePeriods.round, "manual");
  await actor.healWithActionDice({ woundDice: 1 });
  assert.equal(actor.system.wounds.value, 6);
  const own = { id: "own", round: 3, started: true, combatants: [{ actor: { uuid: actor.uuid } }] };
  game.combats.push(own);
  assert.equal(actor.participatingCombat.id, "own");
  assert.equal(actor.usagePeriods.round, "own:3");
  const dice = actor.system.actionDice.value;
  assert.equal(await actor.healWithActionDice({ woundDice: 1 }), null);
  assert.equal(actor.system.actionDice.value, dice);
  game.combat = null;
  game.combats = [];
});

test("RAW p.359: Refresh forfeits a condition-free round and waits until the start of the next own initiative", () => {
  const sys = system(),
    options = { combatantId: "pc", currentCombatantId: "pc", forfeitActions: true };
  for (const patch of [{ conditions: ["fatigued"] }, { forfeitActions: false }, { currentCombatantId: "other" }])
    assert.equal(refreshPlan(sys, combat, { ...options, ...patch }).blocked, true);
  sys.refreshAction = refreshPlan(sys, combat, options).record;
  assert.equal(sys.refreshAction.dueRound, 3);
  assert.equal(refreshPlan(sys, combat, options).blocked, true);
  const finish = { ...options, phase: "complete", resource: "wounds", notTargeted: true, atStartOfInitiative: true };
  assert.equal(refreshPlan(sys, combat, finish).blocked, true);
  const due = { ...combat, round: 3 };
  assert.equal(refreshPlan(sys, due, finish).cost, 1);
  for (const patch of [
    { notTargeted: false },
    { atStartOfInitiative: false },
    { currentCombatantId: "other" },
    { combatantId: "other" },
    { resource: "both" }
  ])
    assert.equal(refreshPlan(sys, due, { ...finish, ...patch }).blocked, true);
  for (const wrong of [
    { ...due, id: "other" },
    { ...due, round: 4 },
    { ...due, started: false }
  ])
    assert.equal(refreshPlan(sys, wrong, finish).blocked, true);
  sys.refreshAction.targeted = true;
  assert.equal(refreshPlan(sys, due, finish).blocked, true);
});
test("combat Refresh spends nothing when declared or attacked; one die heals at the next initiative and cannot be reused", async () => {
  const actor = new SpycraftActor(),
    member = { id: "pc", actor: { uuid: actor.uuid } };
  game.combat = { ...combat, combatant: member, combatants: [member] };
  game.combats = [game.combat];
  await actor.refreshWithActionDie({ phase: "start", forfeitActions: true });
  assert.equal(actor.system.actionDice.value, 5);
  assert.equal(actor.system.refreshAction.state, "waiting");
  const complete = { phase: "complete", resource: "wounds", notTargeted: true, atStartOfInitiative: true };
  assert.equal(await actor.refreshWithActionDie(complete), null);
  game.combat.round++;
  await actor.refreshWithActionDie(complete);
  assert.equal(actor.system.actionDice.value, 4);
  assert.equal(actor.system.wounds.value, 6);
  assert.equal(actor.system.refreshAction.state, "completed");
  assert.equal(await actor.refreshWithActionDie(complete), null);
  assert.equal(actor.system.actionDice.value, 4);
  await actor.refreshWithActionDie({ phase: "start", forfeitActions: true });
  await actor.refreshWithActionDie({ phase: "targeted" });
  game.combat.round++;
  assert.equal(await actor.refreshWithActionDie(complete), null);
  assert.equal(actor.system.actionDice.value, 4);
  game.combat = null;
  game.combats = [];
});
test("a failed Refresh transaction restores the pending action and die so it may be retried, preserving unrelated damage", async () => {
  const actor = new SpycraftActor(),
    member = { id: "pc", actor: { uuid: actor.uuid } };
  game.combat = { ...combat, combatant: member, combatants: [member] };
  game.combats = [game.combat];
  await actor.refreshWithActionDie({ phase: "start", forfeitActions: true });
  game.combat.round++;
  failPost = true;
  postHook = () => {
    actor.system.wounds.value--;
  };
  await assert.rejects(
    actor.refreshWithActionDie({ phase: "complete", resource: "wounds", notTargeted: true, atStartOfInitiative: true }),
    /message rejected/
  );
  assert.equal(actor.system.actionDice.value, 5);
  assert.equal(actor.system.wounds.value, 3);
  assert.equal(actor.system.refreshAction.state, "waiting");
  failPost = false;
  postHook = null;
  game.combat = null;
  game.combats = [];
});

const warSystem = () => ({
  ...system(),
  legacyAbilities: { fortunesOfWar: { grade: 2 } },
  usagePeriods: { session: "session" },
  fortunesOfWarBoost: { combatId: "war", combatantId: "own", startRound: 2, dueRound: 3, session: "session" }
});
const warCombat = { id: "war", started: true, round: 2, turn: 2, ownTurnIndex: 1, combatantId: "own" };
test("RAW pp.49,346: Fortunes of War lasts through round rollover, ending at the start of its own next initiative", () => {
  const input = warSystem();
  for (const [round, turn, active] of [
    [2, 0, true],
    [2, 2, true],
    [3, 0, true],
    [3, 1, false],
    [3, 2, false],
    [4, 0, false]
  ])
    assert.equal(
      !!activeFortunesOfWar({ ...input, fortunesCombatContext: { ...warCombat, round, turn } }),
      active,
      `${round}:${turn}`
    );
  for (const context of [
    { ...warCombat, id: "other" },
    { ...warCombat, combatantId: "other" },
    { ...warCombat, started: false },
    { ...warCombat, round: 1 }
  ])
    assert.equal(activeFortunesOfWar({ ...input, fortunesCombatContext: context }), null);
  assert.equal(
    activeFortunesOfWar({ ...input, fortunesCombatContext: warCombat, usagePeriods: { session: "new" } }),
    null
  );
});
test("Fortunes of War cannot stack, requires an earned grade and a participating combatant, and can restart only after expiry", () => {
  const input = warSystem();
  assert.equal(fortunesOfWarPlan(input, warCombat).blocked, true);
  assert.equal(fortunesOfWarPlan(input, { ...warCombat, round: 3, turn: 1 }).record.dueRound, 4);
  for (const context of [
    null,
    { ...warCombat, started: false },
    { ...warCombat, combatantId: "" },
    { ...warCombat, ownTurnIndex: -1 }
  ])
    assert.equal(fortunesOfWarPlan(input, context).blocked, true);
  assert.equal(fortunesOfWarPlan({ ...input, legacyAbilities: {} }, warCombat).blocked, true);
});
test("all three Soldier grades double only Fortunes of War DR, preserving separate armor DR and session limits", () => {
  for (const [level, grade] of [
    [2, 1],
    [11, 2],
    [19, 3]
  ]) {
    const soldier = {
      id: "soldier",
      name: "Soldier",
      type: "class",
      system: {
        ...cfg.classFeatures.soldier,
        identifier: "soldier",
        table: [],
        classSkills: [],
        skillPoints: 4,
        vitalityDie: 12
      }
    };
    const armor = {
      id: "armor",
      name: "Armor",
      type: "armor",
      system: { equipped: true, armorSlot: "body", damageReduction: 4, damageReductionSubdual: 2 }
    };
    const input = {
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 10 }])),
      progression: Array.from({ length: level }, () => ({ classId: "soldier", skills: {}, vitality: 6 })),
      usagePeriods: { session: "session" },
      fortunesCombatContext: { ...warCombat },
      fortunesOfWarBoost: warSystem().fortunesOfWarBoost
    };
    computeAgent(input, [soldier, armor], cfg);
    assert.equal(input.legacyAbilities.fortunesOfWar.grade, grade);
    assert.equal(input.dr.melee, 4 + 2 * grade);
    assert.equal(input.dr.other, 2 + 2 * grade);
    const spec = input.limitedUses.find(s => s.id === "fortunesOfWar");
    assert.equal(spec.limit, input.actionDice.max);
    assert.equal(spec.cost, 0);
    input.fortunesCombatContext = { ...warCombat, round: 3, turn: 1 };
    computeAgent(input, [soldier, armor], cfg);
    assert.equal(input.dr.melee, 4 + grade);
  }
});
test("document Fortunes of War spends a session use, not an action die, and failed posting restores both record and counter", async () => {
  const actor = new SpycraftActor();
  actor.system = {
    ...warSystem(),
    fortunesOfWarBoost: null,
    resourceUses: {},
    limitedUses: [
      { id: "fortunesOfWar", name: "Fortunes of War", period: "session", limit: 3, cost: 0, workflow: "fortunesOfWar" }
    ]
  };
  const own = { id: "own", actor: { uuid: actor.uuid } },
    other = { id: "other", actor: { uuid: "Actor.other" } };
  game.combat = { ...warCombat, combatants: [own, other], turns: [other, own] };
  const record = await actor.boostFortunesOfWar();
  assert.equal(record.dueRound, 3);
  assert.equal(actor.system.resourceUses.fortunesOfWar.used, 1);
  assert.equal(actor.system.actionDice.value, 5);
  game.combat = { ...game.combat, round: 3, turn: 1 };
  failPost = true;
  await assert.rejects(actor.boostFortunesOfWar(), /message rejected/);
  assert.deepEqual(actor.system.fortunesOfWarBoost, record);
  assert.equal(actor.system.resourceUses.fortunesOfWar.used, 1);
  assert.equal(actor.system.actionDice.value, 5);
  failPost = false;
  game.combat = null;
});

const { noFearSource, noFearPlan, activeNoFear } = await import("../module/rules/health.mjs");
const fearSystem = () => ({
  ...system(),
  classLevels: { stuntman: 7 },
  abilities: { wis: { mod: 2 } },
  usagePeriods: { session: "fear-session" }
});
const fearCombat = { id: "fear-combat", started: true, round: 2, turn: 1, ownTurnIndex: 1, combatantId: "own" };
test("No Fear II uses Stuntman level, a frozen Wisdom duration with minimum one, and own-initiative activation", () => {
  for (let level = 0; level <= 10; level++)
    for (const mod of [-4, -1, 0, 2, 5]) {
      const s = { ...fearSystem(), classLevels: { stuntman: level }, abilities: { wis: { mod } } },
        p = noFearPlan(s, fearCombat);
      assert.equal(p.blocked, level < 7);
      if (level >= 7) {
        assert.equal(p.record.resistance, level);
        assert.equal(p.record.rounds, Math.max(1, mod + 1));
        assert.equal(p.record.dueRound, 2 + Math.max(1, mod + 1));
      }
    }
  for (const c of [
    null,
    { ...fearCombat, turn: 0 },
    { ...fearCombat, started: false },
    { ...fearCombat, combatantId: "" },
    { ...fearCombat, ownTurnIndex: -1 },
    { ...fearCombat, round: 1.5 },
    { ...fearCombat, turn: undefined, ownTurnIndex: undefined }
  ])
    assert.equal(noFearPlan(fearSystem(), c).blocked, true);
  assert.equal(noFearSource({ ...fearSystem(), classLevels: { stuntman: 6, soldier: 14 } }), null);
});
test("No Fear II expires at own initiative, source loss, another session/combat or malformed saved history", () => {
  const s = fearSystem();
  s.noFearBoost = noFearPlan(s, fearCombat).record;
  for (const [round, turn, active] of [
    [2, 1, true],
    [3, 0, true],
    [4, 2, true],
    [5, 0, true],
    [5, 1, false],
    [5, 2, false],
    [6, 0, false]
  ])
    assert.equal(
      !!activeNoFear({ ...s, noFearCombatContext: { ...fearCombat, round, turn } }),
      active,
      `${round}:${turn}`
    );
  assert.equal(activeNoFear({ ...s, abilities: { wis: { mod: 5 } }, noFearCombatContext: fearCombat }).rounds, 3);
  for (const change of [
    { usagePeriods: { session: "new" } },
    { classLevels: { stuntman: 6 } },
    { classLevels: { stuntman: 8 } },
    { noFearBoost: { ...s.noFearBoost, rounds: -1 } },
    { noFearBoost: { ...s.noFearBoost, dueRound: 99 } }
  ])
    assert.equal(activeNoFear({ ...s, ...change, noFearCombatContext: fearCombat }), null);
  for (const change of [
    { id: "other" },
    { combatantId: "other" },
    { started: false },
    { round: 1 },
    { ownTurnIndex: -1 },
    { turn: null },
    { round: undefined },
    { ownTurnIndex: undefined }
  ])
    assert.equal(activeNoFear({ ...s, noFearCombatContext: { ...fearCombat, ...change } }), null);
  assert.equal(noFearPlan({ ...s, noFearCombatContext: fearCombat }, fearCombat).blocked, true);
});
const { characterSurvivalStats } = await import("../module/rules/terrain.mjs");
test("No Fear II contributes class stress resistance, competes with Test Subject, adds independent feats and preserves immunity", () => {
  const s = fearSystem();
  s.noFearBoost = noFearPlan(s, fearCombat).record;
  s.noFearCombatContext = fearCombat;
  s.classLevels.grunt = 4;
  s.abilities.con = { mod: 2 };
  s.armor = { resistances: { stress: 1 } };
  s.originEffects = [{ qualityKey: "damageResistance", resistanceType: "stress" }];
  s.activeFeatNames = ["Battle Hardened"];
  assert.equal(characterSurvivalStats(s).resistances.stress, 12);
  assert.equal(characterSurvivalStats(s).resistances.subdual, 2);
  s.originEffects = Array.from({ length: 4 }, () => ({ qualityKey: "damageResistance", resistanceType: "stress" }));
  assert.equal(characterSurvivalStats(s).resistances.stress, 18);
  s.armor.resistances.stress = "all";
  assert.equal(characterSurvivalStats(s).resistances.stress, "all");
  s.noFearCombatContext = { ...fearCombat, round: 5, turn: 1 };
  s.armor.resistances.stress = 1;
  s.originEffects = [];
  assert.equal(characterSurvivalStats(s).resistances.stress, 5);
});
test("No Fear II document spends one session use at zero dice, rejects duplicates, and refunds failed posting", async () => {
  const actor = new SpycraftActor();
  actor.system = {
    ...fearSystem(),
    resourceUses: {},
    limitedUses: [{ id: "noFear", name: "No Fear II", period: "session", limit: 1, cost: 0, workflow: "noFear" }]
  };
  actor.system.actionDice.value = 0;
  const own = { id: "own", actor: { uuid: actor.uuid } },
    other = { id: "other", actor: { uuid: "Actor.other" } };
  game.combat = { ...fearCombat, combatants: [own, other], turns: [other, own] };
  const results = await Promise.all([actor.activateNoFear(), actor.activateNoFear()]);
  assert.equal(results.filter(r => r?.resistance === 7).length, 1);
  assert.equal(actor.system.resourceUses.noFear.used, 1);
  assert.equal(actor.system.actionDice.value, 0);
  actor.system.resourceUses = {};
  actor.system.noFearBoost = null;
  failPost = true;
  try {
    await assert.rejects(actor.activateNoFear(), /message rejected/);
    assert.equal(actor.system.noFearBoost, null);
    assert.equal(actor.system.resourceUses.noFear, undefined);
    assert.equal(actor.system.actionDice.value, 0);
  } finally {
    failPost = false;
    game.combat = null;
  }
});

const canonicalStuntman = JSON.parse(
  await (await import("node:fs/promises")).readFile(new URL("../src/data/classes.json", import.meta.url), "utf8")
).find(c => c.key === "stuntman");
test("the full engine grants No Fear II only at Stuntman seven and derives resistance without changing stress thresholds", () => {
  const stuntman = {
    id: "stuntman",
    type: "class",
    name: "Stuntman",
    system: {
      ...canonicalStuntman,
      identifier: "stuntman",
      table: [],
      classSkills: [],
      skillPoints: 4,
      vitalityDie: 12
    }
  };
  for (let level = 1; level <= 10; level++) {
    const s = {
      abilities: Object.fromEntries(
        ["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: k === "wis" ? 14 : 12 }])
      ),
      progression: Array.from({ length: level }, () => ({ classId: "stuntman", skills: {}, vitality: 6 })),
      usagePeriods: { session: "fear-session" },
      noFearCombatContext: fearCombat
    };
    computeAgent(s, [stuntman], cfg);
    assert.equal(
      s.limitedUses.some(r => r.id === "noFear"),
      level >= 7
    );
    if (level < 7) continue;
    const spec = s.limitedUses.find(r => r.id === "noFear");
    assert.equal(spec.limit, 1);
    assert.equal(spec.period, "session");
    assert.equal(spec.cost, 0);
    const before = s.stressThreshold;
    assert.equal(before, 14 + level);
    s.noFearBoost = noFearPlan(s, fearCombat).record;
    computeAgent(s, [stuntman], cfg);
    assert.equal(s.survivalStats.resistances.stress, level);
    assert.equal(s.stressThreshold, before);
    s.noFearCombatContext = { ...fearCombat, round: 5, turn: 1 };
    computeAgent(s, [stuntman], cfg);
    assert.equal(s.survivalStats.resistances.stress, undefined);
  }
});

const { recoveryRatePlan } = await import("../module/rules/health.mjs");
test("all twenty Career Levels use exact natural recovery, all Treatment rate outcomes and additive Fast Healing/Interest multipliers", () => {
  for (let level = 1; level <= 20; level++)
    for (const fast of [false, true])
      for (const interest of [false, true])
        for (const [treatment, mult] of Object.entries({
          none: 1,
          success: 2,
          threat: 3,
          criticalSuccess: 5,
          error: 0
        })) {
          const s = {
              level,
              originEffects: fast ? [{ qualityKey: "fastHealing" }] : [],
              stressThreshold: 19,
              subdualThreshold: 16
            },
            p = recoveryRatePlan(s, { treatment, interest }),
            natural = treatment === "error" ? 0 : mult + (fast ? 1 : 0);
          assert.equal(p.vitalityPerHour, level * natural);
          assert.equal(p.woundsPerDay, natural);
          assert.deepEqual(
            p.stress.map(r => [r.thresholdValue, r.seconds, r.points]),
            [60, 600, 3600, 86400, 604800].map((seconds, i) => [
              (i + 1) * 19,
              seconds,
              1 + (fast ? 1 : 0) + (interest ? 1 : 0)
            ])
          );
          assert.deepEqual(
            p.subdual.map(r => r.points),
            Array(5).fill(fast ? 2 : 1)
          );
        }
});
test("recovery rates reject malformed levels/outcomes/declarations, do not duplicate a nonrepeatable quality and preserve unknown threshold values", () => {
  for (const level of [-1, 1.5, 21, NaN, "3"]) assert.throws(() => recoveryRatePlan({ level }), /Career Level/);
  for (const treatment of ["__proto__", "constructor", "criticalFailure", "unknown", ["success"], null])
    assert.throws(() => recoveryRatePlan({ level: 3 }, { treatment }), /Treatment/);
  for (const poorForaging of [1, "true", null])
    assert.throws(() => recoveryRatePlan({ level: 3 }, { poorForaging }), /Foraging/);
  for (const interest of [1, "true", null])
    assert.throws(() => recoveryRatePlan({ level: 3 }, { interest }), /Confirm/);
  const p = recoveryRatePlan({
    level: 3,
    originEffects: [{ qualityKey: "fastHealing" }, { qualityKey: "fastHealing" }]
  });
  assert.equal(p.naturalMultiplier, 2);
  assert.equal(p.stress[0].thresholdValue, null);
  assert.equal(p.subdual[0].thresholdValue, null);
});
test("Fast Healing changes rates rather than doubling action-die healing quantities or changing existing health", () => {
  const s = { ...system(), level: 3, originEffects: [{ qualityKey: "fastHealing" }] },
    before = structuredClone(s);
  const p = recoveryRatePlan(s, { treatment: "criticalSuccess", interest: true });
  assert.equal(p.naturalMultiplier, 6);
  assert.equal(p.stressMultiplier, 3);
  assert.equal(p.subdualMultiplier, 2);
  assert.deepEqual(s, before);
  const h = healingResult(s, healingPlan(s, { vitalityDice: 1, woundDice: 1 }), [2]);
  assert.equal(h.healedVitality, 3);
  assert.equal(h.healedWounds, 2);
});
globalThis.foundry = {
  utils: { escapeHTML: s => String(s) },
  applications: { api: { DialogV2: { input: async () => null } } }
};
const { calculateRecoveryRates } = await import("../module/apps/recovery-rates.mjs");
test("the recovery calculator returns rates or cancels without changing health, damage state, time or resources", async () => {
  const actor = {
      system: { ...system(), level: 3, originEffects: [{ qualityKey: "fastHealing" }] },
      update() {
        throw Error("Read-only calculator must not update");
      }
    },
    before = structuredClone(actor.system);
  let warnings = [];
  const oldWarn = ui.notifications.warn;
  ui.notifications.warn = m => warnings.push(m);
  try {
    const p = await calculateRecoveryRates(actor, { treatment: "threat", interest: true });
    assert.equal(p.vitalityPerHour, 12);
    assert.equal(p.woundsPerDay, 4);
    assert.equal(await calculateRecoveryRates(actor), null);
    assert.equal(await calculateRecoveryRates(actor, { treatment: "unknown" }), null);
    assert.match(warnings[0], /Treatment/);
    assert.deepEqual(actor.system, before);
    actor.system.activeFeatNames = ["Quick Healer"];
    const quick = await calculateRecoveryRates(actor, { treatment: "none" });
    assert.equal(quick.quickHealer, true);
    assert.equal(quick.vitalityIntervalSeconds, 1800);
    assert.equal(quick.vitalityPerHour, 12);
  } finally {
    ui.notifications.warn = oldWarn;
  }
});
const originDefinitions = JSON.parse(
  await (await import("node:fs/promises")).readFile(new URL("../src/data/origins.json", import.meta.url), "utf8")
);
test("the full engine derives Fast Healing recovery from the actual Test Subject selection and updates rates on source removal", () => {
  const subject = originDefinitions.specialties.find(o => o.name === "Test Subject"),
    origin = {
      id: "subject",
      name: subject.name,
      type: "origin",
      system: {
        ...subject,
        originChoices: { up: "con", down: "int", npcQuality0: "fastHealing", npcQuality1: "aquatic" }
      }
    },
    stuntman = {
      id: "stuntman",
      name: "Stuntman",
      type: "class",
      system: { ...canonicalStuntman, identifier: "stuntman", vitalityDie: 12 }
    },
    source = {
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
      progression: Array.from({ length: 7 }, () => ({ classId: "stuntman", skills: {}, vitality: 6 }))
    };
  let s = computeAgent(structuredClone(source), [origin, stuntman], cfg);
  assert.equal(s.recoveryRates.vitalityPerHour, 14);
  assert.equal(s.recoveryRates.woundsPerDay, 2);
  assert.equal(s.recoveryRates.stress[0].thresholdValue, 19);
  origin.system.originChoices.npcQuality0 = "fearless";
  s = computeAgent(structuredClone(source), [origin, stuntman], cfg);
  assert.equal(s.recoveryRates.vitalityPerHour, 7);
  assert.equal(s.recoveryRates.woundsPerDay, 1);
  source.progression = Array.from({ length: 21 }, () => ({ classId: "stuntman", skills: {}, vitality: 6 }));
  s = computeAgent(source, [origin, stuntman], cfg);
  assert.equal(s.recoveryRates, null);
  assert.ok(s.warnings.some(w => w.includes("recovery rates")));
});

test("failed Foraging combines its half-rate modifier with other rate multipliers and rounds point recovery down", () => {
  for (const level of [1, 3, 20])
    for (const fast of [false, true])
      for (const interest of [false, true])
        for (const [treatment, mult] of Object.entries({
          none: 1,
          success: 2,
          threat: 3,
          criticalSuccess: 5,
          error: 0
        })) {
          const p = recoveryRatePlan(
              { level, originEffects: fast ? [{ qualityKey: "fastHealing" }] : [] },
              { treatment, interest, poorForaging: true }
            ),
            natural = treatment === "error" ? 0 : mult + (fast ? 1 : 0) - 0.5;
          assert.equal(p.vitalityPerHour, Math.floor(level * natural));
          assert.equal(p.woundsPerDay, Math.floor(natural));
          assert.equal(p.stress[0].points, Math.floor(1 + (fast ? 1 : 0) + (interest ? 1 : 0) - 0.5));
          assert.equal(p.subdual[0].points, fast ? 1 : 0);
        }
});

test("the Quick Healer ruling halves already-modified recovery intervals after rate combination and Foraging rounding", () => {
  for (let level = 0; level <= 20; level++)
    for (const fast of [false, true])
      for (const treatment of ["none", "success", "threat", "criticalSuccess", "error"])
        for (const interest of [false, true])
          for (const poorForaging of [false, true]) {
            const s = {
                level,
                originEffects: fast ? [{ qualityKey: "fastHealing" }] : [],
                stressThreshold: 19,
                subdualThreshold: 16
              },
              base = recoveryRatePlan(s, { treatment, interest, poorForaging }),
              q = recoveryRatePlan({ ...s, activeFeatNames: ["Quick Healer"] }, { treatment, interest, poorForaging });
            assert.equal(q.timeMultiplier, 0.5);
            assert.equal(q.naturalMultiplier, base.naturalMultiplier);
            assert.equal(q.stressMultiplier, base.stressMultiplier);
            assert.equal(q.vitalityPoints, base.vitalityPoints);
            assert.equal(q.woundPoints, base.woundPoints);
            assert.equal(q.vitalityIntervalSeconds, 1800);
            assert.equal(q.woundIntervalSeconds, 43200);
            assert.equal(q.vitalityPerHour, 2 * base.vitalityPerHour);
            assert.equal(q.woundsPerDay, 2 * base.woundsPerDay);
            for (let i = 0; i < 5; i++) {
              assert.equal(q.stress[i].seconds, base.stress[i].seconds / 2);
              assert.equal(q.stress[i].points, base.stress[i].points);
              assert.equal(q.subdual[i].seconds, base.subdual[i].seconds / 2);
              assert.equal(q.subdual[i].points, base.subdual[i].points);
            }
          }
});
test("Quick Healer reports exact half-time intervals in whole seconds and preserves the three-day/twelve-hour half-week", () => {
  const p = recoveryRatePlan({ level: 3, activeFeatNames: ["Quick Healer"] });
  assert.deepEqual(
    p.stress.map(r => r.seconds),
    [30, 300, 1800, 43200, 302400]
  );
  assert.deepEqual(
    p.stress.map(r => r.label),
    ["30 seconds", "5 minutes", "30 minutes", "12 hours", "3 days 12 hours"]
  );
  assert.equal(p.vitalityIntervalLabel, "30 minutes");
  assert.equal(p.woundIntervalLabel, "12 hours");
});
const awaitClassText = await (
    await import("node:fs/promises")
  ).readFile(new URL("../src/data/classes.json", import.meta.url), "utf8"),
  awaitFeatText = await (
    await import("node:fs/promises")
  ).readFile(new URL("../src/data/feats.json", import.meta.url), "utf8");
test("Quick Healer applies only while its actual prerequisite-qualified feat is active and expires with a temporary mission grant", () => {
  const d = JSON.parse(awaitClassText),
    soldier = d.find(c => c.key === "soldier"),
    f = JSON.parse(awaitFeatText),
    guts = {
      id: "guts",
      type: "feat",
      name: "Guts",
      system: { ...f.find(f => f.name === "Guts"), tree: "basicCombat", acquiredAtLevel: 1 }
    },
    quick = {
      id: "quick",
      type: "feat",
      name: "Quick Healer",
      system: { ...f.find(f => f.name === "Quick Healer"), tree: "basicCombat", acquiredAtLevel: 3 }
    },
    cls = {
      id: "soldier",
      type: "class",
      name: "Soldier",
      system: { ...soldier, identifier: "soldier", vitalityDie: 12 }
    },
    source = {
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
      progression: Array.from({ length: 3 }, () => ({ classId: "soldier", vitality: 6, skills: {} })),
      usagePeriods: { mission: "quick-a" }
    };
  let s = computeAgent(structuredClone(source), [cls, guts, quick], cfg);
  assert.equal(s.recoveryRates.quickHealer, true);
  assert.equal(s.recoveryRates.vitalityPerHour, 6);
  s = computeAgent(structuredClone(source), [cls, quick], cfg);
  assert.equal(s.recoveryRates.quickHealer, false);
  assert.equal(s.recoveryRates.vitalityPerHour, 3);
  quick.system = {
    ...quick.system,
    granted: true,
    featKind: "temporary",
    temporaryGrant: { period: "mission", epoch: "quick-a" }
  };
  s = computeAgent(structuredClone(source), [cls, guts, quick], cfg);
  assert.equal(s.recoveryRates.quickHealer, true);
  s = computeAgent({ ...structuredClone(source), usagePeriods: { mission: "quick-b" } }, [cls, guts, quick], cfg);
  assert.equal(s.recoveryRates.quickHealer, false);
});
test("Quick Healer plus Fast Healing gives four-times effective recovery without changing instant action-die healing or actor data", async () => {
  const actor = {
      system: {
        ...system(),
        level: 3,
        activeFeatNames: ["Quick Healer"],
        originEffects: [{ qualityKey: "fastHealing" }]
      }
    },
    before = structuredClone(actor.system),
    p = await calculateRecoveryRates(actor, { treatment: "none" });
  assert.equal(p.vitalityPoints, 6);
  assert.equal(p.vitalityPerHour, 12);
  assert.equal(p.woundPoints, 2);
  assert.equal(p.woundsPerDay, 4);
  assert.deepEqual(actor.system, before);
  assert.equal(healingResult(actor.system, healingPlan(actor.system, { woundDice: 1 }), []).healedWounds, 2);
  const poor = await calculateRecoveryRates(actor, { treatment: "none", poorForaging: true });
  assert.equal(poor.vitalityPoints, 4);
  assert.equal(poor.vitalityPerHour, 8);
});
test("every Shaken grade prevents beginning Refresh even when only the derived condition context is supplied", () => {
  const combat = { id: "c", round: 1, started: true },
    options = { phase: "start", combatantId: "pc", currentCombatantId: "pc", forfeitActions: true };
  for (const shakenGrade of [1, 2, 3, 4]) {
    const plan = refreshPlan({ abilities: {}, conditionContext: { shakenGrade } }, combat, options);
    assert.equal(plan.blocked, true);
    assert.match(plan.reason, /condition/);
  }
  const invalid = refreshPlan(
    { abilities: {}, shakenState: { sourceKind: "effects", grade: null, needsReview: true } },
    combat,
    options
  );
  assert.equal(invalid.blocked, true);
  assert.match(invalid.reason, /Review/);
});
test("source-specific healing modifiers require exactly one finite modifier for each vitality die", () => {
  const s = system(),
    p = healingPlan({ ...s, actionDice: { ...s.actionDice, value: 2 } }, { vitalityDice: 2 });
  for (const vitalityBonuses of [null, {}, [1], [1, NaN], [1, Infinity]])
    assert.throws(() => healingResult(s, { ...p, vitalityBonuses }, [2, 3]), /modifier/);
  assert.equal(healingResult(s, { ...p, vitalityBonuses: [1, 2] }, [2, 3]).healedVitality, 8);
});
