import test from "node:test";
import assert from "node:assert/strict";
import {
  attackKindOf,
  attackOutcome,
  attackResolutionNote,
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
  assert.equal(attackKindOf({ proficiency: "hurled" }), "hurledWeapon");
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
