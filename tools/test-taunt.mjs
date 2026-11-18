import test from "node:test";
import assert from "node:assert/strict";
import {
  tauntSkillChecks,
  tauntCheckPlan,
  tauntOutcome,
  underminePlan,
  underminedState,
  underminedSpendBlock,
  tauntAttackBonus
} from "../module/rules/taunt.mjs";
import { actionDicePaymentPlan } from "../module/rules/bonus-pools.mjs";
import { conditionSkillPenalty } from "../module/rules/attributes.mjs";

const combat = (extra = {}) => ({
  id: "c",
  started: true,
  round: 2,
  turn: 1,
  combatantId: "own",
  ownTurnIndex: 1,
  ...extra
});
const declare = (extra = {}) => ({
  tauntOpponentUuid: "Actor.t",
  tauntOpponentName: "Vex",
  tauntInRangeConfirmed: true,
  tauntCombat: combat(),
  ...extra
});

test("Taunt and Resist Taunt are named checks on Manipulate (Cha) and Sense Motive (Wis)", () => {
  const [taunt] = tauntSkillChecks("manipulate", []);
  assert.deepEqual([taunt.id, taunt.attributes, taunt.tags, taunt.page], ["taunt", ["cha"], "Hearing, Language", 361]);
  assert.deepEqual(tauntSkillChecks("senseMotive", [])[0].attributes, ["wis"]);
  assert.deepEqual(tauntSkillChecks("notice", []), []);
});

test("the Taunt plan needs an opponent, the own Count, range, and a rolled check", () => {
  const check = { id: "taunt" };
  const plan = tauntCheckPlan({}, "manipulate", check, declare());
  assert.equal(plan.blockedReason, "");
  assert.deepEqual([plan.evidence.role, plan.evidence.opponentUuid], ["attacker", "Actor.t"]);
  assert.match(tauntCheckPlan({}, "manipulate", check, declare({ tauntOpponentUuid: "" })).blockedReason, /opposing/);
  assert.match(
    tauntCheckPlan({}, "manipulate", check, declare({ tauntCombat: combat({ turn: 0 }) })).blockedReason,
    /Initiative Count/
  );
  assert.match(tauntCheckPlan({}, "manipulate", check, declare({ tauntInRangeConfirmed: false })).blockedReason, /CQB/);
  assert.match(tauntCheckPlan({}, "manipulate", check, { ...declare(), method: "take10" }).blockedReason, /taking 10/);
  const defend = tauntCheckPlan(
    {},
    "senseMotive",
    { id: "resist-taunt" },
    {
      ...declare({ tauntCombat: combat({ turn: 0 }) }),
      tauntIncomingLegalConfirmed: true
    }
  );
  assert.equal(defend.evidence.role, "defender", "a response may be off the own Count");
});

const acting = (extra = {}) => ({
  actorUuid: "Actor.a",
  resolved: true,
  effectiveTotal: 18,
  taunt: { role: "attacker", opponentUuid: "Actor.t", combat: combat() },
  ...extra
});
const defending = (extra = {}) => ({
  actorUuid: "Actor.t",
  resolved: true,
  effectiveTotal: 14,
  taunt: { role: "defender", opponentUuid: "Actor.a", combat: combat() },
  ...extra
});

test("the opposed result decides the outcome; criticals enrage or raise the opponent's bonus", () => {
  assert.deepEqual(tauntOutcome(acting(), defending()), { attackerWon: true, critical: false, bonus: 0 });
  assert.equal(tauntOutcome(acting({ criticalSuccess: true }), defending()).critical, true);
  assert.deepEqual(tauntOutcome(acting({ effectiveTotal: 10 }), defending()), {
    attackerWon: false,
    critical: false,
    bonus: 1
  });
  assert.equal(tauntOutcome(acting({ effectiveTotal: 10, criticalFailure: true }), defending()).bonus, 2);
  assert.throws(() => tauntOutcome(acting({ effectiveTotal: 14 }), defending()), /tied/);
  assert.equal(tauntOutcome(acting({ effectiveTotal: 14 }), defending(), { tieWinner: "defender" }).attackerWon, false);
  assert.throws(() => tauntOutcome(acting(), defending({ actorUuid: "Actor.x" })), /Pair/);
  assert.deepEqual(tauntOutcome(acting(), null, { declared: "lostCritical" }), {
    attackerWon: false,
    critical: true,
    bonus: 2
  });
});

test("Undermine: Charisma penalty on Initiative and skills, no action dice, for Style-feat rounds", () => {
  const taunter = {
    activeFeatNames: ["Undermine"],
    abilities: { cha: { mod: 3 } },
    activeFeatSelections: [{ tree: "style" }, { tree: "style" }, { tree: "covert" }]
  };
  const record = underminePlan(taunter, { ...acting(), messageUuid: "ChatMessage.m" });
  assert.deepEqual([record.penalty, record.rounds, record.startRound, record.startTurn], [3, 2, 2, 1]);
  assert.equal(underminePlan({ ...taunter, activeFeatNames: [] }, acting()), null);
  const target = ctx => ({ undermined: record, underminedCombatContext: ctx });
  const at = (round, turn) => underminedState(target({ id: "c", round, turn })).active;
  assert.deepEqual([at(2, 1), at(3, 0), at(4, 0), at(4, 1), at(1, 5)], [true, true, true, false, false]);
  assert.equal(underminedState(target({ id: "other", round: 2, turn: 1 })).active, false);
  const system = target({ id: "c", round: 3, turn: 0 });
  assert.match(underminedSpendBlock(system), /cannot spend action dice/);
  assert.equal(actionDicePaymentPlan({ ...system, actionDice: { value: 3 } }, { count: 1 }).blocked, true);
  assert.equal(conditionSkillPenalty(system, "cha") - conditionSkillPenalty({}, "cha"), -3);
});

test("a won Taunt bonus applies once to the next attack on the taunter in the same combat", () => {
  const system = {
    tauntBonuses: [{ version: 1, sourceMessage: "M1", targetUuid: "Actor.a", combatId: "c", bonus: 2 }]
  };
  const ask = posted =>
    tauntAttackBonus(system, { actorUuid: "Actor.t", targetUuid: "Actor.a", combatId: "c", posted });
  assert.equal(ask([]).bonus, 2);
  assert.equal(
    ask([{ actorUuid: "Actor.t", checkKind: "attack", attackContext: { tauntBonus: { sourceMessage: "M1" } } }]),
    null
  );
  assert.equal(tauntAttackBonus(system, { actorUuid: "Actor.t", targetUuid: "Actor.b", combatId: "c" }), null);
  assert.equal(tauntAttackBonus(system, { actorUuid: "Actor.t", targetUuid: "Actor.a", combatId: "d" }), null);
});

test("a planned Taunt check carries its evidence and Cha key attribute", async () => {
  await import("../module/rolls/index.mjs");
  const { resolveSkillCheck } = await import("../module/rules/skills.mjs");
  const { SPYCRAFT: cfg } = await import("../module/config.mjs");
  const system = {
    activeFeatNames: [],
    classOptionSelections: [],
    skillTotals: Object.fromEntries(
      Object.values(cfg.skills).map(s => [
        s.key,
        { name: s.name, ranks: 5, cap: 50, threat: 20, totals: s.abilities.map(ability => ({ ability, total: 8 })) }
      ])
    )
  };
  const [check] = tauntSkillChecks("manipulate", []);
  const r = resolveSkillCheck(system, "manipulate", check, { ...declare(), synergySkill: "none", ability: "cha" });
  assert.equal(r.blocked ?? false, false, r.reason);
  assert.equal(r.taunt?.role, "attacker");
  assert.equal(r.ability, "cha");
});

test("Martial Arts counts as armed for Intimidate; Fortune Favors the Bold improves session dice", async () => {
  const { stoneColdSkillPlan } = await import("../module/rules/stone-cold.mjs");
  const plan = stoneColdSkillPlan({ activeFeatNames: ["Martial Arts"] }, "intimidate", {
    id: "coercion",
    tags: "Gear (weapon), Hearing"
  });
  assert.equal(plan.evidence.source, "Martial Arts");
  assert.doesNotMatch(plan.check.tags, /Gear \(weapon\)/);
  const { sessionGain } = await import("../module/rules/periods.mjs");
  assert.deepEqual(sessionGain({ activeFeatNames: ["Fortune Favors the Bold"], actionDice: { die: 12 } }, 3), {
    die: 6,
    units: 6
  });
  assert.equal(sessionGain({ activeFeatNames: [], actionDice: { die: 8 } }, 3).units, 3);
});

test("False Start: the restart step follows Table 3.1", async () => {
  const { falseStartRestart } = await import("../module/rules/timing.mjs");
  assert.deepEqual(
    ["1 Half Action", "1 Round", "5 Minutes", "1 Hour", "2 Hours", "3 Days", "2 Weeks", "Varies"].map(
      falseStartRestart
    ),
    ["", "round", "minute", "10 minutes", "hour", "day", "week", ""]
  );
});
