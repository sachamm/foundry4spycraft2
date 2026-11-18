import test from "node:test";
import assert from "node:assert/strict";
import { crewDamageSaveBonus, simulatorJockey } from "../module/rules/driving-feats.mjs";
import { controlCheckPlan } from "../module/rules/vehicle-play-rules.mjs";

const person = (feats = [], mechanics = 0) => ({
  activeFeatNames: feats,
  skillTotals: { mechanics: { ranks: mechanics } }
});

test("Demolition Derby adds +2 only for the vehicle's operator", () => {
  assert.deepEqual(crewDamageSaveBonus(person(["Demolition Derby"])), { bonus: 2, notes: ["Demolition Derby +2"] });
  assert.equal(crewDamageSaveBonus(person(), [person(["Demolition Derby"])]).bonus, 0, "a passenger does not");
  assert.deepEqual(crewDamageSaveBonus(null), { bonus: 0, notes: [] });
});

test("Duct Tape and Bubblegum adds half Mechanics ranks rounded up; only the best one aboard counts", () => {
  assert.equal(crewDamageSaveBonus(person(["Duct Tape and Bubblegum"], 5)).bonus, 3);
  assert.equal(crewDamageSaveBonus(person([], 9), [person(["Duct Tape and Bubblegum"], 4)]).bonus, 2, "a rider counts");
  assert.equal(
    crewDamageSaveBonus(person(["Duct Tape and Bubblegum"], 3), [
      person(["Duct Tape and Bubblegum"], 8),
      person(["Duct Tape and Bubblegum"], 1)
    ]).bonus,
    4
  );
  assert.equal(crewDamageSaveBonus(person(["Duct Tape and Bubblegum"], 0)).bonus, 0);
  const both = crewDamageSaveBonus(person(["Demolition Derby", "Duct Tape and Bubblegum"], 6));
  assert.deepEqual(both, { bonus: 5, notes: ["Demolition Derby +2", "Duct Tape and Bubblegum +3"] });
});

test("Simulator Jockey ignores the Drone quality's Maneuver error increase", () => {
  const drone = { vehicleClass: "SGV", qualities: "DRN" },
    driver = feats => ({ activeFeatNames: feats, skillTotals: { drive: { ranks: 4 } }, focusTotals: { drive: [] } });
  assert.ok(simulatorJockey(driver(["Simulator Jockey"])));
  const plain = controlCheckPlan(drone, driver([])),
    jockey = controlCheckPlan(drone, driver(["Simulator Jockey"]));
  assert.equal(plain.errorIncrease, 1);
  assert.equal(jockey.errorIncrease, 0);
  assert.match(jockey.note, /Simulator Jockey/);
});
