import test from "node:test";
import assert from "node:assert/strict";
import {
  possessedActionDice,
  masterPlanGainPlan,
  masterPlanPool,
  checkBonusPool,
  difficultSkillBonusPlan
} from "../module/rules/bonus-pools.mjs";
import { strutPool } from "../module/rules/strut.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const periods = { scene: "scene", session: "session", mission: "mission" },
  gambling = cfg.skills.streetwise.checks.find(c => c.id === "gambling");
const state = () => ({
  actorUuid: "Actor.gambling",
  level: 12,
  worldTime: 0,
  classLevels: { schemer: 8, stuntman: 8 },
  coreClassIds: [],
  activeFeatNames: ["The Dice are Hot"],
  abilities: { int: { value: 18, mod: 4 } },
  conditionContext: {},
  actionDice: { value: 3, die: 8 },
  bonusActionDice: {},
  usagePeriods: { ...periods },
  bonusPoolCombats: { combat: { started: true, round: 1 } },
  bonusPoolChecks: {},
  skillTotals: Object.fromEntries(
    Object.values(cfg.skills).map(s => [
      s.key,
      {
        name: s.name,
        ranks: 13,
        cap: 60,
        ability: s.abilities[0],
        totals: s.abilities.map(ability => ({ ability, total: 16 }))
      }
    ])
  )
});
function temporary(s) {
  s.bonusActionDice.master = masterPlanPool(s, masterPlanGainPlan(s), { id: "master" });
  s.bonusActionDice.strut = strutPool(
    s,
    { source: "strut", baseDie: 8, bold: false, die: 8, units: 1 },
    { id: "strut", messageUuid: "ChatMessage.strut", combat: { id: "combat", round: 1, combatantId: "own" } }
  );
  s.bonusActionDice.adrenaline = {
    id: "adrenaline",
    source: "adrenalineJunkie",
    label: "Adrenaline Junkie",
    unrestricted: true,
    baseDie: 8,
    baseCount: 1,
    bold: false,
    die: 8,
    granted: 1,
    remaining: 1,
    ...periods,
    at: 0,
    woundEventKey: "event"
  };
}
function compulsory(s) {
  const m = {
    uuid: "ChatMessage.check",
    flags: {
      spycraft2: {
        actorUuid: s.actorUuid,
        checkKind: "skill",
        checkMethod: "roll",
        skillKey: "athletics",
        ability: "str",
        requiredBonusPoolId: "bound"
      }
    }
  };
  s.bonusActionDice.bound = checkBonusPool(
    s,
    difficultSkillBonusPlan(s, { method: "roll", ability: "str" }, { dc: 40 }),
    { id: "bound", messageUuid: m.uuid, skillKey: "athletics", ability: "str" }
  );
  s.bonusPoolChecks[m.uuid] = m;
  return m;
}
const options = { gearStatus: "available", synergySkill: "none" };
test("RAW p.189 Gambling counts ordinary and active unrestricted bonus dice, including counts above starting pools", () => {
  const s = state();
  temporary(s);
  assert.deepEqual(
    possessedActionDice(s).sources.map(p => p.count),
    [4, 1, 1]
  );
  assert.equal(possessedActionDice(s).total, 9);
  const r = resolveSkillCheck(s, "streetwise", gambling, options);
  assert.equal(r.gamblingDice.total, 9);
  assert.equal(r.total, 25);
  assert.equal(r.cap, null);
  assert.match(r.notes, /3 ordinary \+ 6 bonus/);
  s.actionDice.value = 17;
  assert.equal(possessedActionDice(s).total, 23);
});
test("expired scene/combat/session pools and spent balances stop contributing without deleting grant history", () => {
  const s = state();
  temporary(s);
  s.usagePeriods.scene = "later";
  assert.equal(possessedActionDice(s).total, 4);
  s.bonusPoolCombats.combat.started = false;
  assert.equal(possessedActionDice(s).total, 3);
  assert.equal(s.bonusActionDice.master.remaining, 4);
  s.usagePeriods = { ...periods };
  s.bonusPoolCombats.combat.started = true;
  s.bonusActionDice.strut.remaining = 0;
  assert.equal(possessedActionDice(s).total, 8);
  s.usagePeriods.session = "later";
  assert.equal(possessedActionDice(s).total, 3);
});
test("currently possessed compulsory dice count while bound to a live owned check and are forfeited on resolution, replacement or activated error", () => {
  const s = state(),
    m = compulsory(s);
  assert.equal(possessedActionDice(s).total, 4);
  assert.equal(possessedActionDice(s).sources[0].source, "iKnowWhatDoing");
  for (const flag of ["resolved", "superseded", "criticalFailure"]) {
    m.flags.spycraft2[flag] = true;
    assert.equal(possessedActionDice(s).total, 3);
    delete m.flags.spycraft2[flag];
  }
  s.bonusActionDice.bound.forfeited = true;
  assert.equal(possessedActionDice(s).total, 3);
  delete s.bonusActionDice.bound.forfeited;
  delete s.bonusPoolChecks[m.uuid];
  assert.throws(() => possessedActionDice(s), /missing check/);
  s.bonusActionDice.bound.session = "old";
  assert.equal(possessedActionDice(s).total, 3);
});
test("Gambling synergy uses normal typed stacking and does not change unrelated named skill uses", () => {
  const s = state();
  temporary(s);
  s.skillTotals.bluff.ranks = 25;
  const r = resolveSkillCheck(s, "streetwise", gambling, {
    ...options,
    synergySkill: "bluff",
    synergyConditionMet: true
  });
  assert.equal(r.synergy, 5);
  assert.equal(r.total, 25);
  s.actionDice.value = 0;
  s.bonusActionDice = {};
  const lower = resolveSkillCheck(s, "streetwise", gambling, {
    ...options,
    synergySkill: "bluff",
    synergyConditionMet: true
  });
  assert.equal(lower.total, 21);
  const other = cfg.skills.streetwise.checks.find(c => c.id !== "gambling");
  assert.equal(resolveSkillCheck(s, "streetwise", other, options).gamblingDice, null);
});
test("unsafe or unprovable possessed balances block the feat rather than silently awarding an incorrect modifier", () => {
  for (const change of [
    s => (s.actionDieAwardReview = { needsReview: true }),
    s => (s.actionDiceSettlementReview = { needsReview: true }),
    s => (s.actionDice.value = "3"),
    s => (s.actionDice.value = -1),
    s => {
      temporary(s);
      s.bonusActionDice.master.remaining = "2";
    },
    s => (s.bonusActionDice.unknown = { remaining: 1 }),
    s => {
      temporary(s);
      s.actionDice.value = Number.MAX_SAFE_INTEGER;
    },
    s => {
      const m = compulsory(s);
      m.flags.spycraft2.actorUuid = "other";
    },
    s => {
      compulsory(s);
      s.bonusActionDice.bound.forfeited = "false";
    }
  ]) {
    const s = state();
    change(s);
    const r = resolveSkillCheck(s, "streetwise", gambling, options);
    assert.equal(r.blocked, true);
    assert.match(r.blockedReason, /Review|review|safe whole/);
    s.activeFeatNames = [];
    assert.equal(resolveSkillCheck(s, "streetwise", gambling, options).gamblingDice, null);
  }
});
globalThis.Actor = class {
  constructor() {
    this.uuid = "Actor.gambling";
    this.type = "agent";
    this.isOwner = true;
    this.system = state();
    this.items = [];
    this.statuses = new Set();
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = {
  user: { isGM: true },
  combats: [],
  settings: { get: (_s, key) => (key === "usagePeriods" ? periods : {}) },
  i18n: { localize: String }
};
globalThis.foundry = { utils: { escapeHTML: String } };
globalThis.ui = { notifications: { warn: () => null } };
const { SpycraftActor } = await import("../module/documents/actor.mjs");
test("the actual actor roll receives the frozen owned-dice breakdown and malformed sources stop before rolling", async () => {
  const a = new SpycraftActor();
  temporary(a.system);
  let calls = 0;
  a.rollCheck = async (formula, data, options) => {
    calls++;
    return { data, options };
  };
  const r = await a.rollSkill("streetwise", "wis", { check: "gambling", ...options });
  assert.equal(r.data.total, 25);
  assert.equal(r.options.gamblingDice.total, 9);
  assert.equal(r.options.gamblingDice.bonus, 6);
  assert.equal(r.options.cap, null);
  a.system.bonusActionDice.master.remaining = "bad";
  assert.equal(await a.rollSkill("streetwise", "wis", { check: "gambling", ...options }), null);
  assert.equal(calls, 1);
});
