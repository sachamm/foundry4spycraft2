import test from "node:test";
import assert from "node:assert/strict";
import {
  attackKindOf,
  attackOutcome,
  attackResolutionNote,
  blastDamageAt,
  knockoutDuration,
  nonLethalHitPlan,
  wearOffPlan,
  damageProfile,
  drForAttack,
  dyingPlan,
  firstAidPlan,
  firstAidStandard,
  lethalHitLines,
  lethalHitPlan,
  opposedNote,
  opposedOutcome,
  reducedDamage,
  restPlan,
  woundState
} from "../module/rules/damage-application.mjs";
import { grappleBenefitChanges } from "../module/rules/combat-actions.mjs";
import { ammunitionLabel, ammunitionState, reloadPlan, spendShotsPlan } from "../module/rules/ammunition-use.mjs";

test("an attack hits on a result equal to or above Defense, whatever the die showed", () => {
  assert.deepEqual(attackOutcome({ total: 18, defense: 18 }), { hit: true, margin: 0, hits: 1 });
  assert.deepEqual(attackOutcome({ total: 17, defense: 18 }), { hit: false, margin: -1, hits: 0 });
  assert.throws(() => attackOutcome({ total: 17 }), /Defense/);
  assert.throws(() => attackOutcome({ defense: 12 }), /result/);
});

test("a Burst or Autofire counts the shots that land", () => {
  assert.equal(attackOutcome({ total: 25, defense: 15, fireAction: { action: "burst" } }).hits, 3);
  assert.equal(attackOutcome({ total: 20, defense: 15, fireAction: { action: "burst" } }).hits, 2);
  assert.equal(attackOutcome({ total: 25, defense: 15, fireAction: { action: "twoShotBurst" } }).hits, 2);
  assert.equal(attackOutcome({ total: 23, defense: 15, fireAction: { action: "autofire", volleys: 4 } }).hits, 3);
  assert.equal(
    attackOutcome({
      total: 24,
      defense: 15,
      fireAction: { action: "autofire", volleys: 5 },
      feats: ["Autofire Supremacy"]
    }).hits,
    4
  );
  assert.equal(attackOutcome({ total: 10, defense: 15, fireAction: { action: "burst" } }).hits, 0);
});

test("the attack card says how the attack fared against the Defense", () => {
  assert.equal(attackResolutionNote({}), "");
  // With NPC Defense kept from players, the public card gives only the outcome.
  const hidden = attackResolutionNote({
    attackResolution: { targetName: "Guard", defense: 14, hit: true, margin: 3, hits: 1, defenseHidden: true }
  });
  assert.equal(hidden, "Against Guard: a hit.");
  assert.match(
    attackResolutionNote({ attackResolution: { targetName: "Guard", defense: 14, hit: true, margin: 3, hits: 1 } }),
    /Guard's Defense 14: a hit by 3/
  );
  assert.match(
    attackResolutionNote({ attackResolution: { defense: 14, hit: false, margin: -2, hits: 0 } }),
    /miss by 2/
  );
  assert.match(
    attackResolutionNote({ attackResolution: { defense: 14, hit: true, margin: 6, hits: 2 } }),
    /2 shots hit/
  );
});

test("a printed damage entry gives its kind, special type, armor-piercing and blast", () => {
  assert.deepEqual(damageProfile("1d10+1", "—"), { kind: "lethal", type: "", armorPiercing: 0, blast: false });
  assert.equal(damageProfile("1d6 subdual").kind, "subdual");
  assert.equal(damageProfile("2d4 sub").kind, "subdual");
  assert.equal(damageProfile("4d4+2 (AP 4)").armorPiercing, 4);
  assert.equal(damageProfile("2d6", "AP (2), TKD").armorPiercing, 2);
  assert.equal(damageProfile("3d6 explosive", "BLS (10 ft.)").type, "explosive");
  assert.equal(damageProfile("3d6 explosive", "BLS (10 ft.)").blast, true);
  assert.equal(damageProfile("2d6 fire (AP 5)").type, "fire");
});

test("damage reduction comes off first, and armor-piercing lowers it", () => {
  assert.deepEqual(reducedDamage({ damage: 12, dr: 2 }), { damage: 12, dr: 2, net: 10, stopped: false });
  assert.equal(reducedDamage({ damage: 12, dr: 4, armorPiercing: 3 }).net, 11);
  assert.equal(reducedDamage({ damage: 12, dr: 4, armorPiercing: 9 }).net, 12);
  assert.equal(reducedDamage({ damage: 12, dr: 4, armorPiercingAll: true }).net, 12);
  assert.equal(reducedDamage({ damage: 3, dr: 4 }).stopped, true);
  assert.throws(() => reducedDamage({ damage: -1 }), /whole number/);
});

test("a standard hit comes off vitality, then wounds", () => {
  const facts = { vitality: 10, wounds: 12, woundsMax: 12 };
  const light = lethalHitPlan(facts, { damage: 6 });
  assert.deepEqual([light.vitality, light.wounds, light.fatigued, light.state], [4, 12, false, ""]);
  const heavy = lethalHitPlan(facts, { damage: 14 });
  assert.deepEqual([heavy.vitalityLoss, heavy.woundLoss, heavy.vitality, heavy.wounds], [10, 4, 0, 8]);
  assert.equal(heavy.fatigued, true);
  // Already fatigued by lost wounds: the condition does not come a second time.
  assert.equal(lethalHitPlan({ vitality: 0, wounds: 8, woundsMax: 12 }, { damage: 3 }).fatigued, false);
});

test("a critical hit goes to wounds while vitality remains", () => {
  const plan = lethalHitPlan({ vitality: 30, wounds: 12, woundsMax: 12 }, { damage: 9, critical: true });
  assert.deepEqual([plan.vitality, plan.wounds, plan.critical, plan.fatigued], [30, 3, true, true]);
  const spent = lethalHitPlan({ vitality: 0, wounds: 12, woundsMax: 12 }, { damage: 9, critical: true });
  assert.deepEqual([spent.wounds, spent.critical], [3, false]);
});

test("wound totals bring unconsciousness, dying, death and destruction", () => {
  assert.deepEqual([1, 0, -1, -9, -10, -24, -25].map(woundState), [
    "",
    "unconscious",
    "dying",
    "dying",
    "dead",
    "dead",
    "destroyed"
  ]);
  const facts = { vitality: 0, wounds: 5, woundsMax: 12 };
  assert.equal(lethalHitPlan(facts, { damage: 5 }).state, "unconscious");
  assert.equal(lethalHitPlan(facts, { damage: 8 }).state, "dying");
  assert.equal(lethalHitPlan(facts, { damage: 15 }).state, "dead");
  assert.equal(lethalHitPlan(facts, { damage: 5 }).stateChanged, true);
  assert.equal(lethalHitPlan({ vitality: 0, wounds: -3, woundsMax: 12 }, { damage: 2 }).stateChanged, false);
});

test("damage reduction that stops a hit bruises, and big hits call for a Fortitude save", () => {
  const stopped = lethalHitPlan({ vitality: 10, wounds: 12, woundsMax: 12 }, { damage: 2, dr: 3 });
  assert.deepEqual([stopped.net, stopped.bruise, stopped.vitality], [0, 1, 10]);
  assert.equal(lethalHitPlan({ vitality: 60, wounds: 12, woundsMax: 12 }, { damage: 24 }).massive, null);
  assert.deepEqual(lethalHitPlan({ vitality: 60, wounds: 12, woundsMax: 12 }, { damage: 31 }).massive, {
    dc: 15,
    toMinusNine: false
  });
  assert.deepEqual(lethalHitPlan({ vitality: 60, wounds: 12, woundsMax: 12 }, { damage: 52, dr: 1 }).massive, {
    dc: 25,
    toMinusNine: true
  });
  const lines = lethalHitLines(
    "Kevin",
    lethalHitPlan({ vitality: 4, wounds: 12, woundsMax: 12 }, { damage: 9, dr: 2 })
  );
  assert.match(lines.join(" "), /takes 7 damage/);
  assert.match(lines.join(" "), /Vitality –4, now 0/);
  assert.match(lines.join(" "), /Wounds –3, now 9/);
  assert.match(lines.join(" "), /fatigued/);
});

test("damage reduction is read from the column the attack uses", () => {
  const agent = { dr: { melee: 3, other: 1 }, armorDRByAttack: { unarmed: 4 } };
  assert.equal(drForAttack(agent, "unarmed"), 4);
  assert.equal(drForAttack(agent, "meleeWeapon"), 3);
  assert.equal(drForAttack(agent, "rangedWeapon"), 1);
  assert.equal(drForAttack({ qualityEffects: { damageReduction: 2 } }, "rangedWeapon"), 2);
  assert.equal(drForAttack({}, "other"), 0);
  assert.equal(attackKindOf({ proficiency: "unarmed" }), "unarmed");
  assert.equal(attackKindOf({ proficiency: "edged" }), "meleeWeapon");
  assert.equal(attackKindOf({ proficiency: "edged", ranged: true }), "hurledWeapon", "a thrown knife");
  assert.equal(attackKindOf({ proficiency: "rifle", ranged: true }), "rangedWeapon");
  assert.equal(attackKindOf({ proficiency: "hurled" }), "hurledWeapon");
  assert.equal(attackKindOf({ proficiency: "hurled", blast: true }), "other");
  assert.equal(attackKindOf({ proficiency: "handgun" }), "rangedWeapon");
  assert.equal(attackKindOf({}), "other");
});

test("rest returns vitality by the hour and wounds by the day, never past the maximum", () => {
  const facts = { vitality: 3, vitalityMax: 20, wounds: 8, woundsMax: 12 };
  const night = restPlan(facts, { hours: 8, days: 0, vitalityPerHour: 2, woundsPerDay: 1 });
  assert.deepEqual([night.vitality, night.wounds, night.vitalityGain, night.woundGain], [19, 8, 16, 0]);
  const week = restPlan(facts, { hours: 0, days: 7, vitalityPerHour: 2, woundsPerDay: 1 });
  assert.deepEqual([week.wounds, week.woundGain], [12, 4]);
  assert.equal(restPlan(facts, { hours: 100, vitalityPerHour: 2 }).vitality, 20);
  assert.throws(() => restPlan(facts, { hours: -1 }), /rest/);
});

test("First Aid returns rolled wounds and subdual damage and vitality equal to career level", () => {
  const plan = firstAidPlan(
    { vitality: 3, vitalityMax: 20, wounds: 8, woundsMax: 12, subdual: 3, level: 4 },
    { wounds: 5, subdual: 4 }
  );
  assert.deepEqual([plan.vitality, plan.wounds, plan.subdual, plan.woundGain, plan.subdualHealed], [7, 12, 0, 4, 3]);
  assert.throws(() => firstAidPlan({}, { wounds: 6, subdual: 2 }), /1d4\+1/);
  assert.deepEqual(firstAidStandard(9), { healed: 5, accumulated: 4 });
});

test("a dying character stabilizes on d% at or under Constitution, or loses a wound", () => {
  assert.deepEqual(dyingPlan({ wounds: -4, constitution: 12 }, 12), {
    stabilized: true,
    wounds: 0,
    state: "unconscious"
  });
  assert.deepEqual(dyingPlan({ wounds: -4, constitution: 12 }, 13), { stabilized: false, wounds: -5, state: "dying" });
  assert.equal(dyingPlan({ wounds: -9, constitution: 12 }, 50).state, "dead");
  assert.throws(() => dyingPlan({ wounds: 2, constitution: 12 }, 50), /dying/);
});

test("an opposed check goes to the higher result, then the higher bonus", () => {
  assert.equal(opposedOutcome({ total: 21 }, { total: 19 }), "first");
  assert.equal(opposedOutcome({ total: 17 }, { total: 19 }), "second");
  assert.equal(opposedOutcome({ total: 19, bonus: 9 }, { total: 19, bonus: 7 }), "first");
  assert.equal(opposedOutcome({ total: 19, bonus: 7 }, { total: 19, bonus: 7 }), "tie");
  assert.equal(opposedOutcome({ total: 19, bonus: 9 }, { total: 19, bonus: 7 }, { breakTies: false }), "tie");
  assert.equal(opposedOutcome({ total: 19, bonus: 9 }, { total: 19, bonus: null }), "tie");
  assert.match(opposedNote({ opposed: { name: "Guard", total: 19, outcome: "won" } }), /Guard's 19: won/);
  assert.equal(opposedNote({}), "");
});

test("a weapon's ammunition code gives the shots it holds and its reserve", () => {
  const pistol = { ammo: "15M4" };
  const fresh = ammunitionState(pistol);
  assert.deepEqual(
    [fresh.tracked, fresh.capacity, fresh.loaded, fresh.spare, fresh.counted],
    [true, 15, 15, 45, false]
  );
  assert.equal(ammunitionState({ ammo: "—" }).tracked, false);
  assert.equal(ammunitionState({ ammo: "15M4", ammunitionOnly: true }).tracked, false);
  const used = ammunitionState({ ...pistol, shotsLoaded: 4, shotsSpare: 30 });
  assert.deepEqual([used.loaded, used.spare, used.counted], [4, 30, true]);
  assert.match(ammunitionLabel(used), /4\/15 shots loaded, 30 in reserve/);
});

test("firing spends shots and Reload refills from the reserve", () => {
  const state = ammunitionState({ ammo: "15M4", shotsLoaded: 4, shotsSpare: 30 });
  assert.deepEqual(spendShotsPlan(state, 3), { shotsLoaded: 1, shotsSpare: 30, shots: 3 });
  assert.throws(() => spendShotsPlan(state, 5), /Reload first/);
  assert.deepEqual(reloadPlan(state), { shotsLoaded: 15, shotsSpare: 19, moved: 11 });
  assert.throws(() => reloadPlan(ammunitionState({ ammo: "15M4" })), /already full/);
  assert.throws(() => reloadPlan(ammunitionState({ ammo: "15M1", shotsLoaded: 0 })), /reserve/);
  // An internal supply takes up to 3 shots per Reload.
  const shotgun = ammunitionState({ ammo: "8S3", shotsLoaded: 1 });
  assert.deepEqual(reloadPlan(shotgun), { shotsLoaded: 4, shotsSpare: 13, moved: 3 });
  assert.equal(spendShotsPlan({ tracked: false }, 1), null);
});

test("stress and subdual damage on a character without a ledger add up against its thresholds", () => {
  const system = { abilities: { wis: { value: 12 }, con: { value: 10 } } };
  const light = nonLethalHitPlan(system, { stress: 0, subdual: 0 }, { kind: "subdual", damage: 8 });
  assert.deepEqual([light.net, light.total, light.saveRequired, light.totals.subdual], [8, 8, false, 8]);
  const heavy = nonLethalHitPlan(system, { stress: 0, subdual: 8 }, { kind: "subdual", damage: 10 });
  assert.deepEqual([heavy.total, heavy.saveRequired, heavy.saveKey, heavy.dc], [18, true, "fort", 12]);
  // Damage reduction counts twice against subdual damage; armor-piercing lowers it first.
  assert.equal(nonLethalHitPlan(system, {}, { kind: "subdual", damage: 10, dr: 3 }).net, 4);
  assert.equal(nonLethalHitPlan(system, {}, { kind: "subdual", damage: 10, dr: 3, armorPiercing: 2 }).net, 8);
  assert.equal(nonLethalHitPlan(system, {}, { kind: "subdual", damage: 5, dr: 3 }).stopped, true);
  // Stress ignores damage reduction; a critical hit forces a save below every threshold.
  const stress = nonLethalHitPlan(system, { stress: 20 }, { kind: "stress", damage: 8, dr: 5 });
  assert.deepEqual(
    [stress.net, stress.total, stress.saveKey, stress.dc, stress.failureOutcome],
    [8, 28, "will", 16, "Shaken II"]
  );
  assert.equal(nonLethalHitPlan(system, {}, { kind: "stress", damage: 2, critical: true }).dc, 16);
  assert.throws(() => nonLethalHitPlan(system, {}, { kind: "lethal", damage: 2 }), /stress or subdual/);
});

test("a knockout lasts the band's unit times half the margin, at least once", () => {
  assert.deepEqual(knockoutDuration("1 minute", 16, 11), { count: 2, unit: "minute" });
  assert.deepEqual(knockoutDuration("1 round", 12, 11), { count: 1, unit: "round" });
  assert.equal(knockoutDuration(null, 16, 11), null);
});

test("stress and subdual damage wear off faster as the total falls", () => {
  const rates = [
    { thresholdValue: 12, points: 1, seconds: 60 },
    { thresholdValue: 24, points: 1, seconds: 600 },
    { thresholdValue: 36, points: 1, seconds: 3600 }
  ];
  // 28: four points at 10 minutes each, then a point a minute for the remaining 20 minutes.
  assert.deepEqual(wearOffPlan(28, rates, 3600), { total: 4, recovered: 24 });
  assert.deepEqual(wearOffPlan(10, rates, 300), { total: 5, recovered: 5 });
  assert.deepEqual(wearOffPlan(40, rates, 3599), { total: 40, recovered: 0 });
  assert.deepEqual(wearOffPlan(5, rates, 86400), { total: 0, recovered: 5 });
  assert.deepEqual(wearOffPlan(9, [], 86400), { total: 9, recovered: 0 });
});

test("blast damage halves for each whole increment out from Ground Zero", () => {
  assert.deepEqual(blastDamageAt(40, 0, 5), { rings: 0, damage: 40 });
  assert.deepEqual(blastDamageAt(40, 12, 5), { rings: 2, damage: 10 });
  assert.deepEqual(blastDamageAt(40, 30, 25), { rings: 1, damage: 20 });
  assert.equal(blastDamageAt(3, 20, 5).damage, 0);
});

test("grapple benefits name the conditions they change on each side", () => {
  assert.deepEqual(grappleBenefitChanges(["pin"]), [{ side: "loser", id: "pinned", active: true }]);
  assert.deepEqual(grappleBenefitChanges(["sprawl"]), [
    { side: "winner", id: "prone", active: true },
    { side: "loser", id: "sprawled", active: true }
  ]);
  assert.deepEqual(grappleBenefitChanges(["escape"]), [
    { side: "winner", id: "held", active: false },
    { side: "winner", id: "pinned", active: false }
  ]);
  assert.deepEqual(grappleBenefitChanges(["draw", "injure"]), []);
  assert.throws(() => grappleBenefitChanges(["tickle"]), /listed grapple benefit/);
});
