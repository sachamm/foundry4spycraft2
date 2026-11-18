import test from "node:test";
import assert from "node:assert/strict";
import {
  DAMAGE_TYPES,
  acidFirstDamage,
  acidHitsArmor,
  acidRoundPlan,
  acidSavePlan,
  addExposure,
  applyAcid,
  bangOutcome,
  breathRounds,
  electricalFailure,
  explosiveDamageTaken,
  explosiveSavePlan,
  explosiveStunRounds,
  exposureInterval,
  fallingStress,
  flashOutcome,
  halveAcid,
  injuriesReached,
  laserDamage,
  survivalFailure,
  survivalReset,
  survivalSaveMade,
  survivalSavePlan,
  typedStress,
  vacuumDamage
} from "../module/rules/damage-types.mjs";
import { hazardState } from "../module/rules/hazards.mjs";
import { checkRecord } from "../module/rules/record-check.mjs";
import { RECORD_SHAPES } from "../module/data/record-shapes.mjs";

test("stress comes back as the listed share of vitality and wounds lost", () => {
  assert.deepEqual(typedStress("acid", 5), { points: 2, formula: null });
  assert.deepEqual(typedStress("collision", 20), { points: 5, formula: null });
  assert.deepEqual(typedStress("electrical", 7), { points: 1, formula: null });
  assert.deepEqual(typedStress("explosive", 0), { points: 0, formula: "1d4" });
  assert.deepEqual(typedStress("laser", 9), { points: 2, formula: null });
  assert.deepEqual(typedStress("vacuum", 7), { points: 4, formula: null }, "vacuum rounds up");
  assert.deepEqual(typedStress("bang", 30), { points: 0, formula: null });
  assert.throws(() => typedStress("plasma", 1), /listed damage type/);
  assert.equal(fallingStress(20, 2), 0);
  assert.equal(fallingStress(30, 3), 6);
});

test("bang stuns for half the margin and deafens twice as long; flash blinds for a quarter", () => {
  assert.deepEqual(bangOutcome(25, 20), { affected: true, stunned: 3, deafened: 6, stress: "1d4", takedown: true });
  assert.deepEqual(bangOutcome(15, 15), { affected: true, stunned: 0, deafened: 0, stress: null, takedown: false });
  assert.equal(bangOutcome(25, 1, { deafened: true }).affected, false);
  assert.deepEqual(flashOutcome(20, 11), { affected: true, blinded: 3, stress: "1d4" });
  assert.equal(flashOutcome(20, 1, { blinded: true }).affected, false);
  assert.equal(flashOutcome(20, 1, { lineOfSight: false }).affected, false);
});

test("explosive saves: movement bonus, forced failure, halving to at least 1, stun from a quarter of the margin", () => {
  assert.deepEqual(explosiveSavePlan(24, { moved: "full" }), { dc: 24, bonus: 8, reflexFails: false, takedown: true });
  assert.equal(explosiveSavePlan(10, { cannotMove: true }).reflexFails, true);
  assert.equal(explosiveSavePlan(10, { cannotMove: true, halfCover: true }).reflexFails, false);
  assert.throws(() => explosiveSavePlan(10, { moved: "sprint" }), /moved/);
  assert.equal(explosiveDamageTaken(1, true), 1);
  assert.equal(explosiveDamageTaken(9, true), 4);
  assert.equal(explosiveDamageTaken(9, false), 9);
  assert.equal(explosiveStunRounds(20, 15), 2);
});

test("laser loses a die per range increment past the first", () => {
  assert.deepEqual(laserDamage("3d6", 3), { formula: "1d6", dice: 1, removed: 2 });
  assert.deepEqual(laserDamage("2d8+2", 1), { formula: "2d8+2", dice: 2, removed: 0 });
  assert.equal(laserDamage("2d6", 5).formula, "0");
  assert.throws(() => laserDamage("lots"), /dice/);
});

test("acid: armor roll, Reflex DC and bonus, halving, lingering and the scarring threshold", () => {
  assert.equal(acidHitsArmor("partial", 2), true);
  assert.equal(acidHitsArmor("partial", 3), false);
  assert.equal(acidHitsArmor("full", 4), true);
  assert.equal(acidHitsArmor("none", 1), false);
  assert.deepEqual(acidSavePlan(11, 5), { dc: 11, bonus: 2 });
  assert.equal(acidFirstDamage(11, true), 5);
  let hazards = applyAcid(hazardState({}), { damage: 5, suffered: 5, worldTime: 0 });
  assert.equal(hazards.acid.damage, 5);
  hazards = halveAcid(hazards);
  assert.equal(hazards.acid.damage, 2);
  const round = acidRoundPlan(hazards);
  assert.equal(round.damage, 2);
  assert.equal(round.hazards.acid.suffered, 7);
  hazards = halveAcid(halveAcid(round.hazards));
  assert.equal(hazards.acid, null, "halving 1 leaves nothing");
  const heavy = acidRoundPlan(applyAcid(hazardState({}), { damage: 10, suffered: 20 }));
  assert.equal(heavy.injurySaveDue, true);
  assert.throws(() => acidRoundPlan(hazardState({})), /No acid/);
});

test("electrical failure: nausea, Count loss, and unconsciousness instead of reeling", () => {
  assert.deepEqual(electricalFailure(9, 20), {
    nauseated: "1d6",
    countLoss: 4,
    countAfter: 16,
    unconsciousMinutes: null
  });
  assert.equal(electricalFailure(14, 4).unconsciousMinutes, 3);
  assert.equal(electricalFailure(6).countAfter, null);
});

test("cold and heat strike on the listed schedule", () => {
  assert.equal(exposureInterval("cold", 20), 3600);
  assert.equal(exposureInterval("cold", -10), 600);
  assert.equal(exposureInterval("cold", -60), 300);
  assert.equal(exposureInterval("cold", 50, "liquid"), 60);
  assert.equal(exposureInterval("cold", 35, "liquid"), 6);
  assert.equal(exposureInterval("cold", 45), null);
  assert.equal(exposureInterval("heat", 95), 3600);
  assert.equal(exposureInterval("heat", 120), 600);
  assert.equal(exposureInterval("heat", 150), 300);
  assert.equal(exposureInterval("heat", 150, "liquid"), 60);
  assert.equal(exposureInterval("heat", 212, "liquid"), 6);
  assert.throws(() => exposureInterval("acid", 10), /cold and heat/);
});

test("running totals reach each injury save once, per source", () => {
  assert.deepEqual(injuriesReached("electrical", 0, 60).length, 2);
  assert.deepEqual(injuriesReached("cold", 49, 50), [{ at: 50, ability: "con" }]);
  let tracked = addExposure(hazardState({}), { type: "vacuum", amount: 20, source: "airlock" });
  assert.deepEqual(tracked.injuries, []);
  tracked = addExposure(tracked.hazards, { type: "vacuum", amount: 10, source: "airlock" });
  assert.deepEqual(tracked.injuries, [{ at: 25, ability: "wis" }]);
  const other = addExposure(tracked.hazards, { type: "vacuum", amount: 10, source: "hull breach" });
  assert.equal(other.hazards.exposure.suffered, 10, "a new source starts its own total");
  assert.equal(vacuumDamage(17, { firstRound: true, saved: true }), 8);
  assert.equal(vacuumDamage(17, { firstRound: false, saved: true }), 17);
});

test("survival saves start at their base DC, rise by 1 each, and reset", () => {
  let hazards = hazardState({});
  assert.equal(survivalSavePlan(hazards, "suffocation").dc, 10);
  assert.equal(survivalSavePlan(hazards, "smoke").dc, 15);
  hazards = survivalSaveMade(survivalSaveMade(hazards, "smoke"), "smoke");
  assert.equal(survivalSavePlan(hazards, "smoke").dc, 17);
  assert.equal(survivalSavePlan(hazards, "thirst").dc, 10);
  hazards = survivalReset(hazards, "smoke");
  assert.equal(survivalSavePlan(hazards, "smoke").dc, 15);
  assert.throws(() => survivalSavePlan(hazards, "boredom"), /survival hazard/);
  assert.equal(breathRounds({ abilities: { con: { value: 13 } } }), 26);
  assert.equal(survivalFailure("starvation", { days: 5 }).lethal, "1d6+5d4");
  assert.equal(survivalFailure("pressure", { depth: 150 }).subdual, "1d6+3d6");
  assert.equal(survivalFailure("suffocation").vitalityToZero, true);
  assert.deepEqual(survivalFailure("suffocation", { standard: true }).conditions, [{ id: "unconscious" }]);
  assert.equal(survivalFailure("smoke").lethal, "1d4");
});

test("the hazards record keeps acid, exposure and survival counts and fits its shape", () => {
  let hazards = applyAcid(hazardState({}), { damage: 6, suffered: 3, worldTime: 12 });
  hazards = addExposure(hazards, { type: "cold", amount: 4, source: "lake", interval: 60 }).hazards;
  hazards = survivalSaveMade(hazards, "sleep", { worldTime: 99 });
  const reread = hazardState({ hazards });
  assert.deepEqual(reread.acid, hazards.acid);
  assert.deepEqual(reread.exposure, hazards.exposure);
  assert.deepEqual(reread.survival, hazards.survival);
  assert.deepEqual(checkRecord(RECORD_SHAPES.hazards, hazards), []);
  assert.ok(Object.values(DAMAGE_TYPES).every(rule => Number.isSafeInteger(rule.page)));
});
