import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  accelerationSchedule,
  explosionPlan,
  hazardLine,
  movementMode,
  signatureDefense,
  signatureSizes,
  vehicleHazards,
  vehicleSignatures
} from "../module/rules/vehicle-environment.mjs";
import { controlCheckPlan } from "../module/rules/vehicle-play-rules.mjs";
import { smashAfterWin, smashEligible, smashRangeLead, smashState, spendSmash } from "../module/rules/chase.mjs";
import { SIZE_CODES } from "../module/rules/vehicles.mjs";
import { VEHICLE_RULES } from "../module/rules/tables.mjs";

const vehicles = JSON.parse(readFileSync(new URL("../src/data/vehicles.json", import.meta.url)));

test("the generated tables carry the explosion, acceleration, signature, hazard and Smash data", () => {
  for (const key of ["explosions", "accelerationDistance", "signature", "hazards", "smash"])
    assert.deepEqual(VEHICLE_RULES[key], vehicles[key], key);
});

test("every vehicle category has a movement mode, and every hazard row has a cell for each mode", () => {
  for (const c of vehicles.classes) assert.ok(["ground", "air", "water"].includes(movementMode(c.code)), c.code);
  for (const rows of Object.values(vehicles.hazards.groups))
    for (const row of rows) {
      for (const mode of ["ground", "air", "water"]) assert.ok(row[mode] !== undefined, `${row.key} ${mode}`);
      if (Array.isArray(row.ground)) assert.equal(row.ground.length, 3, row.key);
      for (const cell of [row.ground, row.air, row.water].flat())
        assert.match(cell, /^(x|[+-]?\d+[ds]?)$/, `${row.key}: ${cell}`);
    }
});

test("explosion and signature rows grow and shrink steadily with Size", () => {
  const sizes = SIZE_CODES.filter(s => vehicles.explosions.bySize[s]);
  for (const column of ["gas", "aviationGas", "jetFuel"]) {
    const dice = sizes.map(s => vehicles.explosions.bySize[s][column]);
    for (let i = 1; i < dice.length; i++) {
      const [n0, d0] = dice[i - 1].dice.split("d").map(Number),
        [n1, d1] = dice[i].dice.split("d").map(Number);
      assert.ok(n1 * (d1 + 1) > n0 * (d0 + 1) && dice[i].blast >= dice[i - 1].blast, `${column} ${sizes[i]}`);
    }
  }
  const signature = SIZE_CODES.filter(s => vehicles.signature.bySize[s] !== undefined).map(
    s => vehicles.signature.bySize[s]
  );
  for (let i = 1; i < signature.length; i++) assert.equal(signature[i], signature[i - 1] - 5);
});

test("a burning vehicle explodes by Size and fuel, multiplied by its remaining hours", () => {
  assert.deepEqual(explosionPlan({ size: "L", fuel: "G", remainingHours: 3.7 }), {
    explodes: true,
    dice: "3d6",
    blast: 2,
    ap: 8,
    multiplier: 3,
    formula: "(3d6) * 3",
    column: "gas",
    houseRule: "",
    page: 291
  });
  assert.equal(explosionPlan({ size: "H", fuel: "J", remainingHours: 0 }).multiplier, 1);
  assert.equal(explosionPlan({ size: "V", fuel: "V", remainingHours: 2 }).dice, "9d8");
  assert.equal(explosionPlan({ size: "G", fuel: "J" }).blast, 8);
  assert.equal(explosionPlan({ size: "T", fuel: "G" }).dice, "2d4");
  assert.match(explosionPlan({ size: "M", fuel: "P" }).houseRule, /House rule/);
  for (const fuel of ["B", "D", "E", "F", "N"]) assert.equal(explosionPlan({ size: "L", fuel }).explodes, false, fuel);
  assert.equal(explosionPlan({ size: "L", fuel: "U" }).explodes, false);
  assert.equal(explosionPlan({ size: "L", fuel: "" }).explodes, false);
});

test("acceleration to distance reads the rating band and stops at top MPH", () => {
  const car = accelerationSchedule({ acceleration: 5, topMph: 120 });
  assert.deepEqual([car.first, car.later, car.speeds.at(-1)], [30, 24, 120]);
  assert.deepEqual(car.speeds, [30, 54, 78, 102, 120]);
  assert.deepEqual(
    [
      accelerationSchedule({ acceleration: 0, topMph: 25 }).first,
      accelerationSchedule({ acceleration: 0, topMph: 25 }).later
    ],
    [2, 1]
  );
  assert.equal(accelerationSchedule({ acceleration: 12, topMph: 600 }).first, 300);
  assert.equal(accelerationSchedule({ acceleration: 9, topMph: 100, drawnBy: 3 }).rating, 1);
  assert.equal(accelerationSchedule({ acceleration: 9, topMph: 100, drawnBy: 1 }).rating, 0);
  assert.equal(accelerationSchedule({ acceleration: 4, topMph: null }), null);
});

test("signature uses the listed sensor Size, jamming, speed and the Maneuvering Room", () => {
  assert.deepEqual(signatureSizes("LOB (radar M, sonar T, thermal S), HOB (thermal G)"), {
    radar: "M",
    sonar: "T",
    thermal: "G"
  });
  const fighter = { vehicleClass: "PFA", size: "H", qualities: "LOB (radar L), JAM (5)" };
  assert.equal(signatureDefense(fighter, "radar").value, 30);
  assert.equal(signatureDefense(fighter, "thermal").value, 25);
  assert.equal(signatureDefense(fighter, "sonar"), null);
  assert.equal(signatureDefense(fighter, "radar", { jamming: true }).value, 20);
  assert.equal(signatureDefense(fighter, "radar", { fasterThanCruising: true, room: "open" }).value, 30);
  assert.equal(signatureDefense(fighter, "radar", { room: "tight" }).value, 20);
  assert.deepEqual(
    vehicleSignatures({ vehicleClass: "SUB", size: "C", qualities: "" }).map(s => [s.sensor, s.value]),
    [
      ["radar", 15],
      ["sonar", 15],
      ["thermal", 15]
    ]
  );
  assert.deepEqual(
    vehicleSignatures({ vehicleClass: "SGV", size: "L" }).map(s => s.sensor),
    ["radar", "thermal"]
  );
});

test("hazards add up by mode, with off-road and tracked figures, Size relief, Stabilized and tolerance", () => {
  const car = { vehicleClass: "SGV", size: "L", qualities: "", cruiseMph: 60, topMph: 120 };
  const rough = vehicleHazards(car, { terrain: "jungle", surface: "rugged", weather: "rainHeavy", wind: "windStrong" });
  assert.deepEqual(
    [rough.modifier, rough.errorIncrease, rough.speedCut, rough.cruiseMph, rough.topMph],
    [-11, 3, true, 45, 90]
  );
  assert.match(vehicleHazards(car, { surface: "broken" }).blocked, /cannot travel/);
  const jeep = vehicleHazards({ ...car, qualities: "ORD" }, { surface: "broken" });
  assert.deepEqual([jeep.blocked, jeep.modifier, jeep.damagePerRound], [null, -5, true]);
  assert.equal(vehicleHazards({ ...car, qualities: "ORD, TRK" }, { surface: "shifting" }).modifier, -1);
  const boat = vehicleHazards(
    { vehicleClass: "STW", size: "L", qualities: "" },
    { surface: "rough", weather: "hurricane" }
  );
  assert.deepEqual([boat.modifier, boat.errorIncrease, boat.speedCut], [-12, 0, true]);
  // Rain and wind penalties shrink by 1 per Size above Large; Stabilized cuts each weather penalty by 2.
  const jet = { vehicleClass: "SVA", size: "C", qualities: "" };
  assert.equal(vehicleHazards(jet, { wind: "windSevere" }).modifier, -3);
  assert.equal(vehicleHazards(jet, { weather: "thunderstorm" }).modifier, -6);
  assert.equal(
    vehicleHazards({ ...jet, qualities: "STB" }, { weather: "thunderstorm", wind: "windLight" }).modifier,
    -4
  );
  // Environmental tolerance ignores the hazard it names, or the one chosen when it says "any one".
  assert.equal(
    vehicleHazards(
      { vehicleClass: "PSA", size: "M", qualities: "ENV (desert)" },
      { terrain: "desert", weather: "fogLight" }
    ).modifier,
    -1
  );
  assert.equal(
    vehicleHazards({ ...car, qualities: "ENV (any one)" }, { surface: "slippery", tolerance: "slippery" }).modifier,
    0
  );
  assert.match(
    vehicleHazards({ ...car, qualities: "ENV (any one)" }, { surface: "slippery" }).notes.join(" "),
    /choose the hazard/
  );
  assert.equal(vehicleHazards({ vehicleClass: "", size: "L" }, { surface: "rough" }).modifier, 0);
  assert.match(hazardLine(rough), /total -11/);
});

test("a control check adds the hazard modifier and error increase, and refuses impassable ground", () => {
  const driver = { skills: { drive: { ranks: 3 } }, focuses: { drive: ["Standard Ground Vehicles"] } };
  const car = { vehicleClass: "SGV", size: "L", qualities: "", damage: {} };
  const hazards = vehicleHazards(car, { surface: "slippery", weather: "fogDense" });
  const plan = controlCheckPlan(car, driver, { hazards });
  assert.deepEqual([plan.penalty, plan.errorIncrease], [-8, 2]);
  assert.match(plan.note, /Hazards -8, error \+2/);
  assert.match(
    controlCheckPlan(car, driver, { hazards: vehicleHazards(car, { surface: "shifting" }) }).blocked,
    /cannot travel/
  );
  assert.equal(
    controlCheckPlan({ ...car, qualitiesNow: "TRO" }, { skills: { drive: { ranks: 0 } } }).blocked?.startsWith(
      "Trained only"
    ),
    true
  );
});

test("Smash points belong to one pilot in a powered aircraft and move with opposed checks", () => {
  assert.equal(smashEligible({ vehicleClass: "PFA", qualities: "HOT" }), true);
  assert.equal(smashEligible({ vehicleClass: "PSA", qualities: "LOB (radar S), UNP" }), false);
  assert.equal(smashEligible({ vehicleClass: "SGV" }), false);
  assert.equal(smashState({ side: "prey", points: 0 }), null);
  assert.deepEqual(smashAfterWin({ side: "prey", points: 2 }, "prey"), { side: "prey", points: 3 });
  assert.deepEqual(smashAfterWin({ side: "prey", points: 2 }, "predator"), { side: "prey", points: 1 });
  assert.equal(smashAfterWin({ side: "prey", points: 1 }, "predator"), null);
  const predator = spendSmash({ side: "predator", points: 2 }, 5);
  assert.deepEqual([predator.lead, predator.smash], [4, { side: "predator", points: 1 }]);
  const prey = spendSmash({ side: "prey", points: 1 }, 5);
  assert.deepEqual([prey.lead, prey.smash, prey.defenseBonus], [5, null, 4]);
  assert.throws(() => spendSmash(null, 5), /Nobody holds/);
  assert.equal(smashRangeLead(4, { side: "prey", points: 3 }), 7);
  assert.equal(smashRangeLead(4, null), 4);
});
