import test from "node:test";
import assert from "node:assert/strict";
import {
  anticipateActive,
  anticipateDodge,
  anticipatePlan,
  combatOptionChecks,
  coupDeGracePlan,
  jointActionPlan,
  opponentDC,
  standOffStress,
  tireOutcome
} from "../module/rules/combat-options.mjs";
import {
  CRITICAL_MISS_TABLE,
  applyCriticalChoice,
  attackFamily,
  criticalEffectChoices,
  criticalHitChoices,
  criticalMissChoices
} from "../module/rules/critical-effects.mjs";
import { UNDERWATER_ATTACK_TERM, underwaterAttackPlan } from "../module/rules/underwater-combat.mjs";
import { RollPipeline, planTerms } from "../module/rules/roll-pipeline.mjs";
import { incomingDefensePlan } from "../module/rules/defense.mjs";

const clock = (round, turn = 0) => ({
  started: true,
  id: "combat",
  combatantId: "me",
  round,
  turn,
  ownTurnIndex: 1
});

test("Anticipate: Wisdom dodge (at least +1), threat cut on a critical, flat-footed on a critical failure", () => {
  const system = { abilities: { wis: { mod: 3 } } };
  assert.equal(opponentDC(6), 16);
  assert.throws(() => opponentDC(-1), /base attack bonus/);
  const hit = anticipatePlan(system, { outcome: "critical", opponentUuid: "Actor.x", opponentName: "Guard" });
  assert.equal(hit.dodge, 3);
  assert.equal(hit.threatReduction, 3);
  assert.equal(
    anticipatePlan({ abilities: { wis: { mod: -1 } } }, { outcome: "success", opponentUuid: "a", opponentName: "b" })
      .dodge,
    1
  );
  assert.equal(anticipatePlan(system, { outcome: "criticalFailure" }).flatFooted, true);
  assert.throws(() => anticipatePlan(system, { outcome: "success" }), /opponent/);
  assert.throws(() => anticipatePlan(system, { outcome: "maybe" }), /result/);
});

test("Anticipate lasts until the start of the character's Count next round", () => {
  const record = anticipatePlan(
    { abilities: { wis: { mod: 2 } } },
    { outcome: "success", opponentUuid: "a", opponentName: "b", combat: clock(3, 1) }
  );
  assert.equal(anticipateActive(record, clock(3, 2)), true);
  assert.equal(anticipateActive(record, clock(4, 0)), true);
  assert.equal(anticipateActive(record, clock(4, 1)), false);
  assert.equal(anticipateDodge(record, { fromOpponent: true, combat: clock(3, 2) }), 2);
  assert.equal(anticipateDodge(record, { fromOpponent: true, vulnerable: true, combat: clock(3, 2) }), 0);
  assert.equal(anticipateDodge(record, { fromOpponent: false, combat: clock(3, 2) }), 0);
});

test("Anticipate's dodge joins the incoming Defense unless the character is vulnerable", () => {
  const system = {
    defense: { total: 15, dodgeBonuses: 0 },
    abilities: { dex: { mod: 2 } },
    conditionContext: {}
  };
  const base = incomingDefensePlan(system, {}).total;
  const plan = incomingDefensePlan(system, { anticipateDodge: 2 });
  assert.equal(plan.total, base + 2);
  assert.ok(plan.notes.some(note => /Anticipate/.test(note)));
  assert.equal(incomingDefensePlan(system, { anticipateDodge: 2, invisibleAttacker: true }).anticipate, 0);
});

test("Joint Action, Stand Off, Tire and Coup de Grace numbers", () => {
  assert.deepEqual(jointActionPlan({ abilities: { cha: { mod: 1 } } }, 2), { most: 2, teammates: 2, dc: 20 });
  assert.throws(() => jointActionPlan({ abilities: { cha: { mod: 1 } } }, 3), /At most 2/);
  assert.equal(jointActionPlan({ abilities: { cha: { mod: -2 } } }, 1).most, 1);
  assert.equal(standOffStress(1, -3), 1);
  assert.equal(standOffStress(4, 2), 6);
  assert.deepEqual(tireOutcome("wonCritical"), { target: "opponent", damage: "2d4+2", flatFooted: false });
  assert.deepEqual(tireOutcome("lostCritical"), { target: "self", damage: "1d4+1", flatFooted: true });
  assert.throws(() => tireOutcome("draw"), /opposed check/);
  assert.deepEqual(coupDeGracePlan(14), { dc: 24, woundsOnFailure: -10 });
});

test("the new combat-action checks join their skills once", () => {
  const ids = key => combatOptionChecks(key, []).map(c => c.id);
  assert.deepEqual(ids("senseMotive"), ["anticipate"]);
  assert.deepEqual(ids("tactics"), ["joint-action"]);
  assert.deepEqual(ids("resolve"), ["stand-off", "tire"]);
  assert.deepEqual(ids("bluff"), []);
  const twice = combatOptionChecks("resolve", combatOptionChecks("resolve", []));
  assert.equal(twice.length, 2);
  const tire = twice.find(c => c.id === "tire");
  assert.equal(tire.error, 2);
  assert.ok(tire.tags.includes("Armor Check Penalty"));
});

test("Table 5.4 choices follow the attack family and the final error range", () => {
  assert.equal(attackFamily("unarmed"), "unarmed");
  assert.equal(attackFamily("exoticEdged"), "melee");
  assert.equal(attackFamily("explosives"), "hurled");
  assert.equal(attackFamily("rifle"), "firearm");
  assert.deepEqual(
    CRITICAL_MISS_TABLE.firearm.map(r => [r.cost, r.minimumError]),
    [
      [1, 1],
      [2, 1],
      [2, 2],
      [3, 2],
      [4, 3],
      [4, 3]
    ]
  );
  const narrow = criticalMissChoices({ checkKind: "attack", weaponProficiency: "handgun", error: 1 });
  assert.deepEqual(
    narrow.map(c => c.cost),
    [1, 2]
  );
  const wide = criticalMissChoices({ checkKind: "attack", weaponProficiency: "blunt", error: 3 });
  assert.equal(wide.length, 4);
  assert.deepEqual(criticalMissChoices({ checkKind: "skill", error: 4 }), []);
  assert.equal(criticalHitChoices({ checkKind: "attack" }).length, 7);
});

test("a ready-made choice sets the effect and base cost for its own result kind only", () => {
  const check = { checkKind: "attack", weaponProficiency: "unarmed", error: 2 };
  const [, , dazed] = criticalEffectChoices(check, "failure");
  const filled = applyCriticalChoice(check, { kind: "failure", preset: dazed.id, effect: "near the stairs" });
  assert.equal(filled.baseCost, 3);
  assert.match(filled.effect, /stunned.*— near the stairs$/);
  assert.throws(() => applyCriticalChoice(check, { kind: "success", preset: dazed.id }), /does not apply/);
  assert.deepEqual(applyCriticalChoice(check, { kind: "success", effect: "x" }), { kind: "success", effect: "x" });
});

test("underwater attacks: unarmed free, melee and explosives penalised with wider errors, others need gear", () => {
  const novice = { skillTotals: { athletics: { ranks: 2 } } },
    swimmer = { skillTotals: { athletics: { ranks: 5 } } },
    aquatic = { originEffects: [{ qualityKey: "aquatic" }] };
  assert.equal(underwaterAttackPlan(novice, { proficiency: "edged" }, {}), null);
  assert.deepEqual(underwaterAttackPlan(novice, { proficiency: "unarmed" }, { underwater: true }).penalty, 0);
  const melee = underwaterAttackPlan(novice, { proficiency: "edged" }, { underwater: true });
  assert.deepEqual([melee.penalty, melee.error], [-4, 2]);
  assert.equal(underwaterAttackPlan(swimmer, { proficiency: "blunt" }, { underwater: true }).penalty, -2);
  assert.equal(underwaterAttackPlan(aquatic, { proficiency: "blunt" }, { underwater: true }).penalty, 0);
  assert.equal(underwaterAttackPlan(novice, { proficiency: "explosives" }, { underwater: true }).error, 2);
  assert.match(underwaterAttackPlan(novice, { proficiency: "handgun" }, { underwater: true }).blocked, /gear/);
  const geared = underwaterAttackPlan(novice, { proficiency: "rifle" }, { underwater: true, underwaterGear: true });
  assert.deepEqual([geared.penalty, geared.error], [-4, 0]);
});

test("the underwater attack term reaches the attack plan", async () => {
  const pipeline = new RollPipeline().register(UNDERWATER_ATTACK_TERM);
  const terms = planTerms(
    "attack",
    {
      system: { skillTotals: { athletics: { ranks: 0 } } },
      weapon: { proficiency: "edged" },
      options: { underwater: true }
    },
    pipeline
  );
  const term = terms.list.find(t => t.key === "underwaterAttack");
  assert.ok(term);
  assert.equal(terms.sum("error"), 2);
  assert.deepEqual(terms.merge("rows").find(([label]) => /Underwater/.test(label))[1], -4);
});

test("GC combat references: encounter distance, surfaces, deviation and gas", async () => {
  const ref = await import("../module/rules/gc/combat-reference.mjs");
  assert.deepEqual(ref.encounterDistance("indoors", 30), { lineOfSight: true, feet: null, limited: false });
  assert.equal(ref.encounterDistance("open", 21).feet, 420);
  const capped = ref.encounterDistance("open", 21, 300);
  assert.deepEqual([capped.feet, capped.limited], [300, true]);
  assert.equal(ref.encounterDistance("rough", 18).feet, 90);
  assert.equal(ref.senseLimit({ senses: { visualIncrement: 120, hearingIncrement: 60 } }), 1200);
  assert.deepEqual(ref.surfaceMove("mudKnee", 30), { squares: 2, feet: 10, bonusStep: false });
  assert.deepEqual(ref.surfaceMove("ice", 30), { squares: 6, feet: 30, bonusStep: true });
  assert.equal(ref.surfaceMove("stepHigh", 30).squares, null);
  assert.deepEqual([1, 2, 3, 6, 7, 10, 14].map(ref.deviationDie), ["1d2", "1d2", "1d4", "1d6", "1d8", "1d10", "1d10"]);
  assert.equal(ref.ricochetSquares(5), 2);
  assert.deepEqual(
    [0, 1, 2, 3, 6, 10, 20].map(r => ref.gasIncrements(r)),
    [1, 2, 2, 3, 4, 5, 5]
  );
  assert.equal(ref.gasIncrements(20, "moderate"), 3);
  assert.equal(ref.gasIncrements(20, "strong"), 1);
  assert.deepEqual(ref.gasClearing(6, "light"), { lingerMinutes: 6, minutesPerIncrement: 0.5, immediate: false });
  assert.equal(ref.gasClearing(6, "strong").immediate, true);
});
