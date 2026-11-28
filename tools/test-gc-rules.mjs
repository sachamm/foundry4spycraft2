import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GC_DATA } from "../module/rules/gc-tables.mjs";
import {
  antagonistReward,
  defaultMission,
  defaultThreatLevel,
  threatLevel,
  threatBonusActionDice,
  missionStanding,
  missionBaseXP,
  characterMissionXP,
  exposurePenalty
} from "../module/rules/gc/mission.mjs";
import {
  emptyDamageTrack,
  currentDamageTrack,
  damageSaveDC,
  resolveDamageSave,
  damageSaveAdjustment,
  healDamageTrack
} from "../module/rules/gc/npc-damage.mjs";
import {
  fluidModifier,
  addFluidModifier,
  endOfRound,
  thresholds,
  delay,
  press,
  readyTrigger,
  compareCombatants,
  dramaticInitiative,
  surpriseRound,
  FLUID_EVENTS
} from "../module/rules/gc/fluid-initiative.mjs";
import { npcSpendProfile, gcDieType, planSpend, actionDieTotal, GC_SPENDS } from "../module/rules/gc/gc-spend.mjs";
import {
  shiftDisposition,
  dispositionCheckModifier,
  loyaltyDecision,
  joinsCombat,
  persuadeToJoin,
  persuadeJoinPlan,
  dispositionToward,
  DISPOSITIONS
} from "../module/rules/gc/disposition.mjs";
import {
  CONFLICT_TYPES,
  startConflict,
  availableStrategies,
  chooseStrategy,
  strategyModifier,
  resolveCheck,
  advantageOptions,
  chooseAdvantages,
  nextRound,
  concede,
  adjustLead
} from "../module/rules/gc/conflict.mjs";
import {
  CAMPAIGN_QUALITIES,
  activeQualities,
  qualityAddition,
  qualityClash,
  qualityXP,
  campaignEffects,
  injuryThresholds,
  adjustedDC,
  adjustedStartingDice
} from "../module/rules/gc/campaign.mjs";
import {
  SECURITY_DEVICES,
  evaluatePR,
  fillPR,
  resolveDevice,
  sensorCheck,
  trapOutcome
} from "../module/rules/gc/security.mjs";

const source = name => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url)));

test("generated GC data matches its editable sources", () => {
  assert.deepEqual(GC_DATA.core, source("gc-core"));
  assert.deepEqual(GC_DATA.tables, source("gc-tables"));
  assert.deepEqual(GC_DATA.conflicts, source("conflicts"));
  assert.deepEqual(GC_DATA.campaignQualities, source("campaign-qualities"));
});

/* ----------------------------- Mission ----------------------------- */
test("p.423 Threat Level examples and limits", () => {
  assert.equal(defaultThreatLevel([5, 5, 5, 5, 5]), 5);
  assert.equal(defaultThreatLevel([5, 5, 5, 5, 5, 5]), 6);
  assert.equal(defaultThreatLevel([10, 11, 13, 19]), 11);
  assert.equal(defaultThreatLevel([]), 1);
  assert.equal(defaultThreatLevel([20, 20, 20, 20, 20, 20]), 20);
  assert.deepEqual(threatLevel({ threatAdjust: 2 }, [5, 5, 5, 5, 5]), {
    base: 5,
    adjust: 2,
    value: 7,
    override: false
  });
  assert.equal(threatLevel({ threatAdjust: 3 }, [5, 5, 5, 5, 5]).value, 5, "adjustments beyond ±2 are ignored");
  assert.equal(threatLevel({ threatAdjust: -2 }, [1]).value, 1);
  assert.equal(threatLevel({ threatOverride: 14 }, [1]).value, 14);
});
test("p.61 bonus starting dice when the Threat Level exceeds the average career level", () => {
  assert.equal(threatBonusActionDice(8, [5, 5, 5, 5]), 1);
  assert.equal(threatBonusActionDice(9, [5, 5, 5, 5]), 2);
  assert.equal(threatBonusActionDice(5, [5, 5]), 0);
  assert.equal(threatBonusActionDice(3, [5, 5]), 0);
});
test("Table 7.10 and Table 7.5 standing rewards", () => {
  assert.deepEqual(missionStanding({ caliber: 1 }), { reputation: 2, netWorth: 100000 });
  assert.deepEqual(missionStanding({ caliber: 5 }), { reputation: 20, netWorth: 1000000 });
  assert.deepEqual(missionStanding({ caliber: 3, threatAdjust: 2 }), { reputation: 12, netWorth: 600000 });
  // A fixed Threat Level pays on the adjustment it was fixed with, until a new one is applied.
  assert.deepEqual(
    missionStanding({ caliber: 3, threatAdjust: 2, threatLevel: 4, threatAdjustApplied: 0 }).reputation,
    10
  );
  assert.deepEqual(missionStanding({ caliber: 3, threatAdjust: -1 }), { reputation: 9, netWorth: 450000 });
  assert.equal(missionStanding({ caliber: 6 }), null);
});
test("mission base XP: objectives, complications, bundle and antagonists", () => {
  const mission = {
    ...defaultMission(),
    dramaticScenes: 1,
    objectives: [
      { name: "A", grade: 3, critical: true, complete: true },
      { name: "B", grade: 5, complete: false }
    ],
    antagonists: [
      { name: "Guards", typeKey: "guard", xp: 37, type: "standard", encountered: true },
      { name: "Guards 2", typeKey: "guard", xp: 37, type: "standard", encountered: true },
      { name: "Boss", xp: 50, type: "special", encountered: true },
      { name: "Unmet", xp: 99, type: "special", encountered: false }
    ]
  };
  const earned = missionBaseXP(mission);
  assert.equal(earned.total, 75 + 37 + 200, "grade 3 objective, one guard type, special ×4");
  const planned = missionBaseXP(mission, {}, { planned: true });
  assert.equal(planned.total, 75 + 125 + 37 + 200 + 396);
});
test("critical objectives, dramatic scenes, time limit, bundle and ignored complications", () => {
  const base = { ...defaultMission(), objectives: [{ name: "A", grade: 1, critical: true, complete: true }] };
  assert.equal(missionBaseXP(base).total, 25);
  assert.equal(
    missionBaseXP({ ...base, objectives: [{ name: "A", grade: 1, complete: true }] }).total,
    0,
    "−50 for no critical objective, floored at 0"
  );
  assert.equal(missionBaseXP({ ...base, objectives: [{ name: "A", grade: 4, complete: true }] }).rawTotal, 50);
  const three = {
    ...base,
    objectives: [1, 2, 3].map(i => ({ name: String(i), grade: 1, critical: true, complete: true }))
  };
  assert.equal(missionBaseXP(three).total, 75 + 50);
  assert.equal(missionBaseXP({ ...base, dramaticScenes: 3 }).total, 25 + 200);
  assert.equal(
    missionBaseXP({ ...base, objectives: [{ name: "A", grade: 4, critical: true, complete: true }], dramaticScenes: 0 })
      .total,
    50
  );
  assert.equal(missionBaseXP({ ...base, timeLimit: true }).total, 75);
  assert.equal(missionBaseXP({ ...base, timeLimit: { ignored: true } }).total, 50);
  assert.equal(
    missionBaseXP({
      ...base,
      objectives: [{ name: "A", grade: 5, critical: true, complete: true }],
      bundle: [{ name: "X", caliber: 4 }],
      bundleCommonItems: 3
    }).total,
    125 - 40 - 3
  );
  assert.equal(
    missionBaseXP({ ...base, otherComplications: [{ name: "Trap", xp: 35, ignored: true }] }).total,
    25 + 18,
    "ignored complication is half, rounded up"
  );
});
test("catalog complications use looked-up XP and report unknown or formula entries", () => {
  const lookup = {
    quality: id => ({ bleak: { name: "Bleak", xp: 75 }, cake: { name: "Cakewalk", xp: -75 } })[id],
    security: id => (id === "lock" ? { name: "Lock", xp: "PR × 2" } : null),
    gearRestriction: () => ({ name: "No picks", xp: 25 }),
    exposure: () => ({ name: "Honor", xp: 0 })
  };
  const mission = {
    ...defaultMission(),
    objectives: [{ name: "A", grade: 5, critical: true, complete: true }],
    qualities: [{ id: "bleak" }, { id: "cake", scripted: false }],
    security: [{ id: "lock" }, { id: "nope" }],
    gearRestrictions: [{ id: "x", count: 2 }],
    exposure: [{ id: "h" }]
  };
  const result = missionBaseXP(mission, lookup);
  assert.equal(result.total, 125 + 75 + 50);
  assert.equal(result.warnings.length, 2);
});
test("full and promoted special NPCs earn 300 XP per scene", () => {
  const mission = {
    ...defaultMission(),
    objectives: [{ name: "A", grade: 2, critical: true, complete: true }],
    antagonists: [
      { name: "Rival", full: true, scenes: 2, encountered: true },
      { name: "Lucky guard", promoted: true, encountered: true }
    ]
  };
  assert.equal(missionBaseXP(mission).total, 50 + 600 + 300);
});
test("p.440 character XP examples", () => {
  assert.deepEqual(characterMissionXP({ baseXP: 400, awards: 0, level: 5, threatLevel: 8 }), {
    awardXP: 0,
    multiplier: 5,
    total: 2000
  });
  assert.equal(characterMissionXP({ baseXP: 400, awards: 0, level: 13, threatLevel: 11 }).multiplier, 11);
  assert.equal(
    characterMissionXP({ baseXP: 100, awards: 3, level: 2, threatLevel: 2 }).total,
    (100 + 50) * 2,
    "award XP capped at 25 × level"
  );
  assert.throws(() => characterMissionXP({ baseXP: -1, level: 1, threatLevel: 1 }));
});
test("exposure penalties halve (rounded up) when preventing a worse infraction", () => {
  assert.deepEqual(exposurePenalty({ reputation: -5, netWorth: -250000 }), { reputation: -5, netWorth: -250000 });
  assert.deepEqual(exposurePenalty({ reputation: -5, netWorth: -250001 }, { preventing: true }), {
    reputation: -3,
    netWorth: -125001
  });
  assert.deepEqual(exposurePenalty({ reputation: -5, netWorth: 0 }, { halve: true }), { reputation: -2, netWorth: 0 });
});

/* ------------------------- NPC Damage saves ------------------------ */
test("pp.331–332 Damage save examples", () => {
  let track = emptyDamageTrack();
  assert.equal(damageSaveDC(8), 14);
  let result = resolveDamageSave(track, { damage: 8, bonus: 10, roll: 4 });
  assert.equal(result.dc, 14);
  assert.equal(result.failed, false);
  assert.equal(result.track.accumulated, 8);
  result = resolveDamageSave(result.track, { damage: 9, bonus: 10, roll: 7 });
  assert.equal(result.dc, 18);
  assert.equal(result.failed, true);
  assert.equal(result.state, "dead");
  assert.equal(result.track.accumulated, 0);
  assert.throws(() => resolveDamageSave(result.track, { damage: 1, bonus: 0, roll: 10 }), /out of the fight/);
  const animal = resolveDamageSave(emptyDamageTrack(), { damage: 15, bonus: 4, roll: 12, tough: 1 });
  assert.equal(animal.dc, 17);
  assert.equal(animal.state, "active");
  assert.equal(animal.ignored, 1);
  const second = resolveDamageSave(animal.track, { damage: 15, bonus: 4, roll: 2, tough: 1 });
  assert.equal(second.state, "dead");
});
test("blast and critical-hit extra failures; subdual knocks out", () => {
  const blast = resolveDamageSave(emptyDamageTrack(), { damage: 48, bonus: 6, roll: 10, blast: true });
  assert.equal(blast.dc, 34);
  assert.equal(blast.total, 16);
  assert.equal(blast.failures, 2);
  const rocket = resolveDamageSave(emptyDamageTrack(), {
    damage: 48,
    bonus: 2,
    roll: 10,
    blast: true,
    criticalDice: 2
  });
  assert.equal(rocket.margin, 22);
  assert.equal(rocket.failures, 5);
  const tough = resolveDamageSave(emptyDamageTrack(), {
    damage: 48,
    bonus: 2,
    roll: 10,
    blast: true,
    criticalDice: 2,
    tough: 5
  });
  assert.equal(tough.state, "active");
  assert.equal(tough.track.ignored, 5);
  assert.equal(
    resolveDamageSave(emptyDamageTrack(), { damage: 30, kind: "subdual", bonus: 0, roll: 5 }).state,
    "unconscious"
  );
  assert.equal(
    resolveDamageSave(emptyDamageTrack(), { damage: 2, bonus: 0, roll: 12, criticalDice: 1 }).state,
    "dead",
    "an activated critical is an automatic failed save"
  );
});
test("damage lingers within a scene and clears at the next; p.452 bonus conversion", () => {
  const track = { ...emptyDamageTrack(), accumulated: 12, ignored: 1, scene: "s1" };
  assert.equal(currentDamageTrack(track, "s1").accumulated, 12);
  assert.deepEqual({ ...currentDamageTrack(track, "s2") }, { ...emptyDamageTrack(), scene: "s2" });
  assert.equal(currentDamageTrack({ ...track, state: "dead" }, "s2").state, "dead");
  assert.equal(damageSaveAdjustment({ vitality: 5 }), 2);
  assert.equal(damageSaveAdjustment({ wounds: -2, vitality: -3 }), -3);
  assert.equal(healDamageTrack(track, 20).accumulated, 0);
});

/* ------------------------- Fluid initiative ------------------------ */
test("Table 5.2 has every printed event", () => {
  assert.equal(FLUID_EVENTS.length, 28);
  assert.equal(new Set(FLUID_EVENTS.map(e => e.id)).size, 28);
  assert.equal(fluidModifier("aim").amount, 1);
  assert.equal(fluidModifier("finalAttack", { times: 3 }).amount, -6);
  assert.equal(fluidModifier("regroup", { intBonus: 3 }).amount, 8);
  assert.equal(fluidModifier("diversion", { amount: 7 }).amount, -7);
  assert.equal(fluidModifier("electrical", { times: 6 }).amount, -6);
  assert.equal(fluidModifier("fatigued", { times: 4 }).amount, -3);
  assert.throws(() => fluidModifier("ready"));
});
test("once-per-round conditions and per-weapon proficiency penalty", () => {
  let { list } = addFluidModifier([], fluidModifier("fatigued"));
  assert.equal(addFluidModifier(list, fluidModifier("fatigued")).added, false);
  ({ list } = addFluidModifier(list, fluidModifier("unproficient", { weapon: "a" })));
  assert.equal(addFluidModifier(list, fluidModifier("unproficient", { weapon: "a" })).added, false);
  assert.equal(addFluidModifier(list, fluidModifier("unproficient", { weapon: "b" })).added, true);
  assert.equal(addFluidModifier(list, fluidModifier("failedSave")).added, true);
});
test("end of round caps at ±10; reeling at 0 or less; Press at 50+", () => {
  assert.deepEqual(thresholds(-7), { count: 13, reeling: true, flatFooted: true, mustPress: false });
  assert.equal(thresholds(-30).count, 1);
  assert.equal(thresholds(0).count, 20);
  assert.equal(thresholds(50).mustPress, true);
  const big = endOfRound(20, [fluidModifier("exhausted"), fluidModifier("criticalInjury")]);
  assert.equal(big.count, 10);
  assert.equal(big.capped, true);
  const up = endOfRound(20, [fluidModifier("triumph"), fluidModifier("aim")]);
  assert.equal(up.count, 30);
  const reel = endOfRound(4, [fluidModifier("failedStressSave")]);
  assert.equal(reel.count, 19);
  assert.equal(reel.reeling, true);
  assert.equal(endOfRound(45, [fluidModifier("triumph")]).mustPress, true);
  assert.equal(endOfRound(null, [fluidModifier("aim")]).count, null);
  assert.equal(
    endOfRound(20, [fluidModifier("delay", { times: 3 }), fluidModifier("aim")]).count,
    21,
    "immediate changes are not applied twice"
  );
});
test("Delay, Press and Ready (pp.356–359)", () => {
  assert.deepEqual(delay(22, 12, { initiativeBonus: 5 }), { count: 10, used: 12 });
  assert.throws(() => delay(22, 16, { initiativeBonus: 5 }));
  assert.throws(() => delay(8, 4, { initiativeBonus: 5 }), /below 5/);
  assert.equal(press(30).count, 10);
  assert.throws(() => press(24));
  assert.throws(() => press(40, { pressedThisRound: true }));
  assert.equal(readyTrigger(22, 14).count, 14);
  assert.equal(readyTrigger(22, 25).count, 22);
});
test("turn order: Count, then Initiative bonus, then roll-off", () => {
  const order = [
    { id: "a", count: 12, bonus: 3 },
    { id: "b", count: 15, bonus: 0 },
    { id: "c", count: 12, bonus: 5 },
    { id: "d", count: null, bonus: 9 },
    { id: "e", count: 12, bonus: 5, tiebreak: 17 }
  ]
    .sort(compareCombatants)
    .map(c => c.id);
  assert.deepEqual(order, ["b", "e", "c", "a", "d"]);
});
test("dramatic scene Initiative and surprise rounds", () => {
  assert.equal(dramaticInitiative(14), 28);
  assert.equal(dramaticInitiative(30), 50);
  assert.equal(dramaticInitiative(-3), -3);
  assert.equal(surpriseRound({ groups: [], aware: "all" }).occurs, false);
  assert.deepEqual(
    surpriseRound({
      groups: [
        { id: "pc", result: 22 },
        { id: "npc", result: 18 }
      ],
      aware: "none"
    }).winners,
    ["pc"]
  );
  assert.equal(
    surpriseRound({
      groups: [
        { id: "pc", result: 22 },
        { id: "npc", result: 18 }
      ],
      aware: "some",
      actingGroup: "npc"
    }).occurs,
    false
  );
  assert.equal(
    surpriseRound({
      groups: [
        { id: "pc", result: 12 },
        { id: "npc", result: 18 }
      ],
      aware: "some",
      actingGroup: "npc"
    }).occurs,
    true
  );
  assert.equal(
    surpriseRound({
      groups: [
        { id: "pc", result: 18 },
        { id: "npc", result: 18 }
      ],
      aware: "none"
    }).occurs,
    false
  );
});

/* --------------------------- GC action dice ------------------------ */
test("p.452 GC die type by NPC role and story-critical", () => {
  assert.equal(gcDieType(npcSpendProfile({})), 4);
  assert.equal(gcDieType(npcSpendProfile({ qualities: [{ id: "minion" }] })), 6);
  assert.equal(gcDieType(npcSpendProfile({ type: "special", qualities: [{ id: "henchman" }] })), 8);
  assert.equal(gcDieType(npcSpendProfile({ type: "special", qualities: [{ id: "mastermind" }] })), 10);
  assert.equal(gcDieType(npcSpendProfile({ qualities: [{ id: "story-critical", units: 2 }] })), 8);
  assert.equal(
    gcDieType(
      npcSpendProfile({ type: "special", qualities: [{ id: "mastermind" }, { id: "story-critical", units: 3 }] })
    ),
    12
  );
});
test("spend costs and restrictions", () => {
  const guard = npcSpendProfile({}),
    killer = npcSpendProfile({ qualities: [{ id: "treacherous" }] }),
    sage = npcSpendProfile({ qualities: [{ id: "prodigy" }] });
  const boss = npcSpendProfile({ type: "special", qualities: [{ id: "mastermind" }] }),
    hench = npcSpendProfile({ type: "special", qualities: [{ id: "henchman" }] });
  assert.deepEqual([planSpend("boostRoll", { npc: guard }).cost, planSpend("boostRoll", { npc: guard }).die], [1, 4]);
  assert.equal(planSpend("boostDC").die, 12);
  assert.throws(() => planSpend("boostDC", { alreadyBoostedDC: 1 }));
  assert.equal(planSpend("boostDC", { alreadyBoostedDC: 2, dramatic: true }).explodeLow, true);
  assert.throws(() => planSpend("boostDC", { alreadyBoostedDC: 3, dramatic: true }));
  assert.throws(() => planSpend("activateThreat", { npc: guard, checkKind: "attack" }), /treacherous/);
  assert.equal(planSpend("activateThreat", { npc: killer, checkKind: "attack", dice: 2 }).cost, 2);
  assert.throws(() => planSpend("activateThreat", { npc: killer, checkKind: "skill" }), /prodigy/);
  assert.equal(planSpend("activateThreat", { npc: sage, checkKind: "skill" }).cost, 1);
  assert.equal(planSpend("activateThreat", { npc: boss, checkKind: "attack" }).cost, 1);
  assert.equal(planSpend("promote", { npc: guard }).cost, 2);
  assert.throws(() => planSpend("promote", { npc: boss }));
  assert.equal(
    planSpend("activateThreat", { npc: npcSpendProfile({ promoted: true }), checkKind: "attack" }).cost,
    1,
    "a promoted NPC is special"
  );
  assert.equal(planSpend("saveNpc", { npc: npcSpendProfile({ type: "special" }) }).cost, 4);
  assert.equal(planSpend("saveNpc", { npc: hench }).cost, 3);
  assert.equal(planSpend("saveNpc", { npc: boss }).cost, 2);
  assert.throws(() => planSpend("saveNpc", { npc: guard }));
  assert.throws(() => planSpend("saveNpc", { npc: boss, dramatic: true }), /dramatic/);
  assert.equal(planSpend("dramaticScene").cost, 4);
  assert.throws(() => planSpend("dramaticScene", { dramatic: true }));
  assert.equal(planSpend("event", { eventCost: 3, triggered: true }).cost, 2);
  assert.equal(planSpend("event", { eventCost: 1, triggered: true }).cost, 0);
  assert.equal(planSpend("event", { free: true }).cost, 0);
  assert.throws(() => planSpend("event", { eventCost: 5 }));
  assert.equal(planSpend("campaignQuality", { qualityCost: 3 }).cost, 3);
  assert.throws(() => planSpend("campaignQuality", { qualityCost: null }));
  assert.throws(() => planSpend("boostDefenseAfterHit", { npc: guard }), /dramatic/);
  assert.equal(planSpend("knowsNothing", { npc: guard }).cost, 1);
  assert.equal(planSpend("knowsNothing", { npc: hench }).cost, 2);
  assert.throws(() => planSpend("knowsNothing", { npc: boss }));
  assert.equal(planSpend("terminalSituation", {}).cost, 1);
  assert.throws(() => planSpend("terminalSituation", { inCombat: true }));
  for (const spend of GC_SPENDS) assert.ok(spend.page && spend.label);
});
test("exploding action dice, including the dramatic-scene low explosion", () => {
  assert.deepEqual(actionDieTotal(6, [6, 6, 5]), { total: 17, used: 3, complete: true });
  assert.deepEqual(actionDieTotal(6, [4]), { total: 4, used: 1, complete: true });
  assert.equal(actionDieTotal(10, [1]).complete, true);
  assert.deepEqual(actionDieTotal(10, [1, 10, 3], { explodeLow: true }), { total: 14, used: 3, complete: true });
  assert.equal(actionDieTotal(6, [6]).complete, false);
});

/* ---------------------------- Disposition -------------------------- */
test("Table 7.14 rows", () => {
  assert.deepEqual(
    DISPOSITIONS.map(d => d.loyalty),
    [18, 16, 14, 12, 10, 8, 6, 4, 2]
  );
  assert.deepEqual(
    DISPOSITIONS.map(d => d.joinDC),
    [10, 15, 20, 25, 30, 40, 50, 60, null]
  );
  assert.deepEqual(
    DISPOSITIONS.map(d => d.joinRoll),
    [10, 8, 6, 4, 2, 4, 6, 8, 10]
  );
  assert.deepEqual(dispositionCheckModifier("friendly", "Bluff/Deception"), {
    kind: "intimacy",
    modifier: -4,
    error: 1,
    threat: 0
  });
  assert.deepEqual(dispositionCheckModifier("friendly", "impress/persuasion"), {
    kind: "fondness",
    modifier: 2,
    error: 0,
    threat: 1
  });
  assert.deepEqual(dispositionCheckModifier("hostile", "Streetwise/Haggle"), {
    kind: "fondness",
    modifier: -4,
    error: 2,
    threat: 0
  });
  assert.equal(dispositionCheckModifier("hostile", "Athletics/Jump").kind, null);
  assert.equal(dispositionCheckModifier("hostile", "Streetwise/Haggle", { villain: true }).modifier, 0);
});
test("shifts are limited to two grades per mission", () => {
  let record = { base: "neutral", toward: {} };
  let step = shiftDisposition(record, "pc", 1, { mission: "m1" });
  assert.equal(step.grade, "intrigued");
  record = { ...record, toward: { pc: step.entry } };
  step = shiftDisposition(record, "pc", 3, { mission: "m1" });
  assert.equal(step.grade, "friendly");
  assert.equal(step.limited, true);
  record = { ...record, toward: { pc: step.entry } };
  assert.equal(shiftDisposition(record, "pc", 1, { mission: "m1" }).applied, 0);
  assert.equal(
    shiftDisposition(record, "pc", -6, { mission: "m1" }).grade,
    "unfriendly",
    "two up, then at most four down: two below where the mission started"
  );
  assert.equal(shiftDisposition(record, "pc", 2, { mission: "m2" }).grade, "helpful");
  assert.equal(dispositionToward(record, "other"), "neutral");
  assert.throws(() => shiftDisposition(record, "pc", 1, { villain: true }));
  const auto = shiftDisposition({ base: "neutral", toward: {} }, "pc", 1, { mission: "m1", automatic: true });
  assert.throws(() => shiftDisposition({ toward: { pc: auto.entry } }, "pc", 1, { mission: "m1", automatic: true }));
});
test("loyalty, joining a fight and persuasion", () => {
  assert.equal(
    loyaltyDecision(
      [
        { id: "a", grade: "friendly" },
        { id: "b", grade: "neutral" }
      ],
      [14]
    ).sides,
    "a"
  );
  assert.equal(
    loyaltyDecision(
      [
        { id: "a", grade: "friendly" },
        { id: "b", grade: "neutral" }
      ],
      [15]
    ).sides,
    "b"
  );
  const three = loyaltyDecision(
    [
      { id: "n", grade: "neutral" },
      { id: "f", grade: "friendly" },
      { id: "al", grade: "aloof" }
    ],
    [20, 20]
  );
  assert.equal(three.sides, "al");
  assert.deepEqual(
    three.steps.map(s => s.id),
    ["f", "n", "al"]
  );
  assert.equal(
    loyaltyDecision(
      [
        { id: "a", grade: "friendly" },
        { id: "b", grade: "neutral" }
      ],
      [12],
      { foil: 3 }
    ).sides,
    "b"
  );
  assert.equal(joinsCombat("helpful", 10).joins, true);
  assert.equal(joinsCombat("neutral", 3).joins, false);
  assert.equal(joinsCombat("hostile", 8).hostile, true);
  assert.deepEqual(persuadeToJoin("neutral", 30), { dc: 30, success: true, needsTriumph: false });
  assert.equal(persuadeToJoin("adversarial", 99).success, false);
  assert.equal(persuadeToJoin("adversarial", 99, { triumph: true }).success, true);
});

/* ------------------------- Dramatic Conflicts ---------------------- */
test("conflict data: seven types with consistent strategies and advantages", () => {
  assert.deepEqual(Object.keys(CONFLICT_TYPES).sort(), [
    "brainwashing",
    "chase",
    "hacking",
    "infiltration",
    "interrogation",
    "manhunt",
    "seduction"
  ]);
  const counts = {
    chase: 24,
    brainwashing: 18,
    hacking: 17,
    infiltration: 26,
    interrogation: 12,
    manhunt: 25,
    seduction: 15
  };
  for (const [id, type] of Object.entries(CONFLICT_TYPES)) {
    assert.equal(type.strategies.length, counts[id], id);
    assert.equal(new Set(type.strategies.map(s => s.id)).size, type.strategies.length, `${id}: unique strategy ids`);
    const names = new Set(type.advantages.map(a => a.name));
    for (const s of type.strategies) {
      assert.ok(["general", "predator", "prey"].includes(s.side), `${id} ${s.name}`);
      assert.ok(s.modifier === null || Number.isSafeInteger(s.modifier), `${id} ${s.name} modifier`);
      for (const a of s.advantages) assert.ok(a === "*" || names.has(a), `${id} ${s.name}: ${a}`);
    }
    assert.ok(
      type.advantages.some(a => a.id === "lead" && a.leadShift === 1),
      `${id}: Lead advantage`
    );
  }
  const chase = CONFLICT_TYPES.chase.strategies;
  assert.equal(chase.find(s => s.name === "Cut Off").modifier, -12);
  assert.deepEqual([chase.find(s => s.name === "Clip").leadMin, chase.find(s => s.name === "Clip").leadMax], [1, 2]);
  assert.equal(chase.find(s => s.name === "Redline").modifier, 2);
});
test("a chase round: strategies, opposed check, advantages and victory", () => {
  let c = startConflict("chase", {
    predator: { name: "Agents", ratings: { Acceleration: 6, Turning: 3 } },
    prey: { name: "Courier", ratings: { Acceleration: 4, Turning: 6 } }
  });
  assert.equal(c.lead, 5);
  const predatorOptions = availableStrategies(c, "predator");
  assert.equal(predatorOptions.find(s => s.id === "redline").available, true);
  assert.equal(predatorOptions.find(s => s.id === "clip").available, false, "Lead 1–2 only");
  assert.equal(predatorOptions.find(s => s.id === "cut-off").available, false, "needs Acceleration or Turning 7+");
  assert.ok(!predatorOptions.some(s => s.side === "prey"));
  assert.throws(() => chooseStrategy(c, "predator", "clip"));
  assert.throws(() => chooseStrategy(c, "predator", "outfox"), /not open/);
  c = chooseStrategy(c, "predator", "redline");
  assert.equal(c.step, "strategies");
  assert.throws(() => chooseStrategy(c, "predator", "buy-time"), /cannot be changed/);
  assert.throws(() => resolveCheck(c, { predator: { result: 1 }, prey: { result: 1 } }));
  c = chooseStrategy(c, "prey", "outfox");
  assert.equal(c.step, "check");
  assert.equal(strategyModifier(c, "predator"), 2);
  assert.throws(() => resolveCheck(c, { predator: { result: 20 }, prey: { result: 20 } }), /tied/);
  c = resolveCheck(c, { predator: { result: 29, critical: "success" }, prey: { result: 20 } });
  assert.equal(c.lead, 4, "critical success shifts Lead 1");
  assert.equal(c.pending.advantages, 3, "1 + 9 ÷ 4");
  assert.deepEqual(
    advantageOptions(c).map(a => a.name),
    ["Lead"]
  );
  assert.throws(() => chooseAdvantages(c, ["lead", "lead", "lead", "lead"]));
  assert.throws(() => chooseAdvantages(c, ["victory"]));
  c = chooseAdvantages(c, ["lead", "lead", "lead"]);
  assert.equal(c.lead, 2, "Lead once, plus 1 per 2 further picks");
  assert.equal(c.step, "outside");
  c = nextRound(c);
  assert.equal(c.round, 2);
  assert.equal(c.predator.strategy, null);
  assert.equal(availableStrategies(c, "predator").find(s => s.id === "clip").available, true);
  c = chooseStrategy(chooseStrategy(c, "predator", "redline"), "prey", "outfox");
  c = resolveCheck(c, { predator: { result: 25 }, prey: { result: 12, critical: "failure" } });
  c = chooseAdvantages(c, ["lead"]);
  assert.equal(c.lead, 0);
  assert.equal(c.winner, "predator");
  assert.equal(c.step, "ended");
  assert.throws(() => nextRound(c));
});
test("prey wins at Lead 10; concede, Victory advantage, Swap and unknown starting Lead", () => {
  let c = startConflict("chase", { lead: 9, prey: { ratings: { Turning: 6 } } });
  c = chooseStrategy(chooseStrategy(c, "predator", "buy-time"), "prey", "outfox");
  c = resolveCheck(c, { predator: { result: 10 }, prey: { result: 11 } });
  c = chooseAdvantages(c, ["lead"]);
  assert.equal(c.winner, "prey");
  assert.equal(concede(startConflict("chase"), "prey").winner, "predator");
  assert.equal(adjustLead(startConflict("chase"), 10).winner, "prey");
  let v = startConflict("chase", { predator: { ratings: { Turning: 7 } } });
  v = chooseStrategy(chooseStrategy(v, "predator", "cut-off"), "prey", "buy-time");
  v = resolveCheck(v, { predator: { result: 15 }, prey: { result: 14 } });
  v = chooseAdvantages(v, ["victory"]);
  assert.equal(v.winner, "predator");
  let s = startConflict("chase", { lead: 4, predator: { name: "P" }, prey: { name: "Q" } });
  s = chooseStrategy(chooseStrategy(s, "predator", "quick-reverse"), "prey", "buy-time");
  s = resolveCheck(s, { predator: { result: 15 }, prey: { result: 14 } });
  s = chooseAdvantages(s, ["swap"]);
  assert.equal(s.predator.name, "Q");
  assert.equal(s.lead, 5);
  assert.throws(() => startConflict("hacking"), /starting Lead/);
  assert.equal(startConflict("hacking", { lead: 7 }).lead, 7);
  assert.throws(() => startConflict("chase", { lead: 10 }));
  assert.throws(() => startConflict("nope"));
});
test("strategies with requirements the tracker cannot verify need GC confirmation", () => {
  const c = startConflict("chase", { predator: { ratings: { Acceleration: 9, Turning: 9 } } });
  const stunt = availableStrategies(c, "predator").find(s => s.id === "stunt");
  assert.ok(stunt.confirm);
  assert.throws(() => chooseStrategy(c, "predator", "stunt"), /confirm/);
  assert.equal(chooseStrategy(c, "predator", "stunt", { confirmOther: true }).predator.strategy, "stunt");
});

/* -------------------------- Campaign qualities --------------------- */
test("campaign quality catalog", () => {
  assert.equal(CAMPAIGN_QUALITIES.length, 60);
  assert.equal(new Set(CAMPAIGN_QUALITIES.map(q => q.id)).size, 60);
  for (const q of CAMPAIGN_QUALITIES) {
    assert.ok(Number.isSafeInteger(q.xp), q.id);
    assert.ok(q.gcDice === null || Number.isSafeInteger(q.gcDice), q.id);
    assert.ok(q.summary.length > 10, q.id);
    assert.ok(!(q.seasonOnly && q.gcDice), q.id);
  }
  const find = id => CAMPAIGN_QUALITIES.find(q => q.id === id);
  assert.deepEqual([find("bleak").xp, find("bleak").gcDice], [75, null]);
  assert.deepEqual([find("gritty").xp, find("gritty").gcDice], [100, 4]);
  assert.deepEqual([find("bulletproof").xp, find("bulletproof").gcDice], [-75, 1]);
});
test("Faction and Freelance may never be in force together (p.407)", () => {
  assert.throws(
    () => qualityAddition("freelance", { scope: "season", active: activeQualities(["faction"]) }),
    /Freelance and Faction cannot be in force together \(p\.407\)/
  );
  assert.throws(
    () => qualityAddition("faction", { scope: "season", active: activeQualities(["freelance"]) }),
    /cannot be in force together/
  );
  assert.equal(qualityAddition("hybrid", { scope: "season", active: activeQualities(["faction"]) }).xp, 0);
  assert.match(qualityClash(["faction", "historical", "freelance"]), /Faction and Freelance/);
  assert.equal(qualityClash(["faction", "historical"]), "");
});
test("adding qualities by scope, XP and combined effects", () => {
  assert.throws(() => qualityAddition("fast-feats", { scope: "scripted" }), /whole season/);
  assert.equal(qualityAddition("fast-feats", { scope: "season" }).xp, -50);
  assert.throws(() => qualityAddition("bleak", { scope: "spend" }), /no action die cost/);
  assert.deepEqual(
    [qualityAddition("gritty", { scope: "spend" }).cost, qualityAddition("gritty", { scope: "spend" }).xp],
    [4, 0]
  );
  assert.throws(() => qualityAddition("gritty", { scope: "scripted", active: [{ id: "gritty" }] }));
  const active = activeQualities(
    ["fast-feats", "bleak"],
    [{ id: "gritty" }, { id: "cakewalk", scripted: false }, { id: "bleak" }]
  );
  assert.deepEqual(
    active.map(q => q.id),
    ["fast-feats", "bleak", "gritty", "cakewalk"]
  );
  assert.equal(qualityXP(active), -50 + 75 + 100);
  const { effects } = campaignEffects(active);
  assert.equal(effects.startingActionDice, -2);
  assert.equal(effects.featInterval, 2);
  assert.deepEqual(injuryThresholds(effects), { criticalInjuryMin: 16, criticalInjuryMax: 25, massiveDamage: 26 });
  assert.deepEqual(injuryThresholds({}), { criticalInjuryMin: 25, criticalInjuryMax: 49, massiveDamage: 50 });
  assert.equal(adjustedDC(20, effects), 15);
  assert.equal(adjustedDC(12, effects), 10);
  assert.equal(adjustedDC(8, effects), 8);
  assert.equal(adjustedDC(20, campaignEffects(activeQualities(["comedy-of-errors"])).effects), 25);
  assert.equal(adjustedStartingDice(3, effects, 1), 2);
  assert.equal(adjustedStartingDice(1, effects), 0);
  assert.equal(campaignEffects(activeQualities(["gritty", "bulletproof"])).conflicts.length > 0, true);
});

/* ------------------------------ Security --------------------------- */
test("Power Rating formulas", () => {
  assert.equal(evaluatePR("10 + (PR × 2)", 5), 20);
  assert.equal(evaluatePR("+(PR × 3)", 4), 12);
  assert.equal(evaluatePR("+(PR)", 4), 4);
  assert.equal(evaluatePR("12 + PR", 4), 16);
  assert.equal(evaluatePR("PR × 10", 3), 30);
  assert.equal(evaluatePR("per explosive", 3), null);
  assert.equal(evaluatePR(null, 3), null);
  assert.equal(fillPR("(PR)d6 acid", 4), "4d6 acid");
  assert.equal(fillPR("PR × 5 ft. radius", 4), "20 ft. radius");
  assert.throws(() => evaluatePR("PR × 2", 0));
});
test("every Table 7.9 device resolves at a Power Rating", () => {
  assert.equal(SECURITY_DEVICES.length, 55);
  for (const d of SECURITY_DEVICES) {
    const r = resolveDevice(d.id, 5);
    assert.ok(["lock", "sensor", "trap"].includes(r.kind), d.id);
    assert.ok(!/\bPR\b/.test(r.damage + r.targetArea), d.id);
    for (const key of ["xp", "detectDC", "disableDC", "damageSave", "awareness", "attack", "saveDC"])
      assert.ok(r[key] === null || Number.isFinite(r[key]), `${d.id} ${key}`);
  }
  const acid = resolveDevice("acid-jet", 5);
  assert.deepEqual(
    [acid.saveDC, acid.detectDC, acid.disableDC, acid.xp, acid.damage, acid.threat],
    [15, 30, 20, 50, "5d6 acid", 18]
  );
  assert.deepEqual(trapOutcome(acid, { saveResult: 15, damage: 17 }), { mode: "save", dc: 15, saved: true, damage: 8 });
  assert.equal(trapOutcome(acid, { saveResult: 14, damage: 17 }).damage, 17);
  assert.equal(sensorCheck(resolveDevice("chemical-sniffer", 3), 10, 99).triggered, true);
  assert.throws(() => sensorCheck(acid, 1, 1));
});
test("transcribed mission tables are complete", () => {
  const t = GC_DATA.tables;
  assert.equal(t.objectives.length, 100);
  for (const o of t.objectives) assert.equal(o.xp, o.grade * 25);
  assert.equal(t.exposure.length, 6);
  assert.equal(
    t.exposure.reduce((n, e) => n + e.infractions.length, 0),
    58
  );
  for (const e of t.exposure)
    for (const i of e.infractions) {
      assert.ok(i.reputation <= 0 && i.netWorth <= 0, i.name);
    }
  assert.equal(t.gearRestrictions.length, 8);
  assert.equal(t.events.length, 14);
  assert.equal(t.rollTables.length, 4);
  for (const table of t.rollTables) {
    assert.equal(table.results[0].range[0], 1);
    assert.equal(Math.max(...table.results.map(r => r.range[1])), 20);
  }
  assert.deepEqual(
    t.reputation.byCaliber.map(r => r.reputation),
    GC_DATA.core.mission.reputationByCaliber.map(r => r.reputation)
  );
});

test("each side may try once per combat to talk an NPC into the fight, until one succeeds (p.458)", () => {
  assert.equal(persuadeJoinPlan(null, { combatId: "", side: "a", gradeId: "neutral", result: 40 }).allowed, false);
  const miss = persuadeJoinPlan(null, { combatId: "c1", side: "a", gradeId: "neutral", result: 20 });
  assert.deepEqual([miss.allowed, miss.success, miss.dc], [true, false, 30]);
  assert.match(
    persuadeJoinPlan(miss.record, { combatId: "c1", side: "a", gradeId: "neutral", result: 40 }).reason,
    /already tried/
  );
  const won = persuadeJoinPlan(miss.record, { combatId: "c1", side: "b", gradeId: "friendly", result: 20 });
  assert.equal(won.success, true);
  assert.match(
    persuadeJoinPlan(won.record, { combatId: "c1", side: "c", gradeId: "neutral", result: 40 }).reason,
    /already won/
  );
  assert.equal(
    persuadeJoinPlan(won.record, { combatId: "c2", side: "a", gradeId: "neutral", result: 40 }).success,
    true
  );
  assert.equal(
    persuadeJoinPlan(null, { combatId: "c1", side: "a", gradeId: "adversarial", result: 99, triumph: true }).success,
    true
  );
});

test("Delay counts toward the round's ±10 limit; Press does not (p.324)", () => {
  const delayed = endOfRound(12, [fluidModifier("finalAttack", { times: 3 })], { alreadyApplied: -8 });
  assert.equal(delayed.delta, -2);
  assert.equal(delayed.capped, true);
  assert.equal(endOfRound(12, [fluidModifier("finalAttack", { times: 3 })]).delta, -6);
});

test("a Delay past 10 Counts stands, and the round's end never gives Counts back (p.356)", () => {
  assert.equal(endOfRound(10, [], { alreadyApplied: -12 }).count, 10);
  assert.equal(endOfRound(10, [fluidModifier("finalAttack", { times: 3 })], { alreadyApplied: -12 }).delta, 0);
});

test("a special antagonist's reward shows its four-times multiplier (p.452)", () => {
  assert.deepEqual(antagonistReward({ type: "special", xp: 84 }), { xp: 84, multiplier: 4, total: 336, special: true });
  assert.deepEqual(antagonistReward({ type: "standard", xp: 30 }), {
    xp: 30,
    multiplier: 1,
    total: 30,
    special: false
  });
});

test("Cakewalk and Comedy of Errors shift a device's skill DCs, not its Defense (p.406)", async () => {
  const { setCampaignRulesSource } = await import("../module/rules/campaign-rules.mjs");
  const plain = resolveDevice("acid-jet", 5);
  setCampaignRulesSource(() => ({ skillDC: 5 }));
  try {
    const shifted = resolveDevice("acid-jet", 5);
    if (Number.isFinite(plain.detectDC)) assert.equal(shifted.detectDC, plain.detectDC + 5);
    if (Number.isFinite(plain.disableDC)) assert.equal(shifted.disableDC, plain.disableDC + 5);
    assert.equal(shifted.defense, plain.defense);
  } finally {
    setCampaignRulesSource(null);
  }
});

test("the antagonist dialog's line says what the row adds, by the report's own arithmetic (p.452)", async () => {
  const { antagonistPreview } = await import("../module/rules/gc/mission.mjs");
  assert.match(antagonistPreview({ xp: 30 }), /Adds 30 XP/);
  assert.match(antagonistPreview({ xp: 30, special: true }), /Adds 120 XP: 30 × 4/);
  assert.match(antagonistPreview({ xp: 30, full: true, scenes: 2 }), /Adds 600 XP: 300 for each of 2/);
  assert.match(antagonistPreview({ xp: NaN }), /Enter the NPC's XP/);
});
