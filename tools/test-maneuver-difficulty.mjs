import test from "node:test";
import assert from "node:assert/strict";
import { maneuverDifficulty } from "../module/rules/vehicle-play-rules.mjs";

const driver = (...feats) => ({ activeFeatNames: feats });

test("stunts and speed raise the Maneuver DC and error range", () => {
  assert.deepEqual(
    [
      maneuverDifficulty(driver(), { stunt: "major" }).dc,
      maneuverDifficulty(driver(), { stunt: "major" }).errorIncrease
    ],
    [15, 2]
  );
  assert.equal(maneuverDifficulty(driver(), { stunt: "minor", fast: true }).dc, 10);
  assert.equal(maneuverDifficulty(driver(), {}).notes.length, 0);
  assert.throws(() => maneuverDifficulty(driver(), { stunt: "huge" }), /listed stunt/);
});

test("Get Radical! lowers a stunt's DC by 5 and error by 1; Need for Speed removes the speed penalty", () => {
  const radical = maneuverDifficulty(driver("Get Radical!"), { stunt: "moderate" });
  assert.deepEqual([radical.dc, radical.errorIncrease], [5, 0]);
  assert.match(radical.notes.join(" "), /Get Radical!/);
  assert.equal(maneuverDifficulty(driver("Get Radical!"), { stunt: "minor" }).errorIncrease, 0);
  const speedy = maneuverDifficulty(driver("Need for Speed"), { fast: true });
  assert.equal(speedy.dc, 0);
  assert.match(speedy.notes.join(" "), /Need for Speed/);
});

test("collision damage by Size and speed; Demolition Derby and Bail Out! reduce it", async () => {
  const { collisionDamagePlan, reducePerDie, demolitionDerbyDamage, crashOccupantPlan } =
    await import("../module/rules/collision.mjs");
  assert.deepEqual((({ formula, ap, takedown }) => ({ formula, ap, takedown }))(collisionDamagePlan("L", 40)), {
    formula: "4d6",
    ap: 4,
    takedown: true
  });
  assert.equal(collisionDamagePlan("M", 40, { source: "character" }).formula, "4");
  assert.equal(collisionDamagePlan("M", 5).formula, "0");
  assert.equal(reducePerDie([1, 2, 6]), 1 + 1 + 5);
  assert.equal(demolitionDerbyDamage({ activeFeatNames: ["Demolition Derby"] }, [1, 4]), 4);
  assert.equal(demolitionDerbyDamage({ activeFeatNames: [] }, [1, 4]), 5);
  assert.deepEqual(crashOccupantPlan({ activeFeatNames: [] }, 21, 4), {
    dc: 10,
    onSuccess: 0,
    onFailure: 10,
    bailOut: false
  });
  assert.deepEqual(crashOccupantPlan({ activeFeatNames: ["Bail Out!"] }, 21, 4), {
    dc: 10,
    onSuccess: 4,
    onFailure: 6,
    bailOut: true
  });
});

test("Mount Up: a ridden mount uses the rider's higher Defense and Reflex", async () => {
  const { mountUpPlan } = await import("../module/rules/driving-feats.mjs");
  const rider = { activeFeatNames: ["Mount Up"], defense: { total: 18 }, saves: { ref: { total: 7 } } };
  assert.deepEqual(mountUpPlan({ vehicleClass: "M/AD" }, rider, { saves: { ref: { total: 4 } } }), {
    defense: 18,
    reflex: 7
  });
  assert.equal(mountUpPlan({ vehicleClass: "SGV" }, rider, {}), null);
  assert.equal(mountUpPlan({ vehicleClass: "M/AD" }, { activeFeatNames: [] }, {}), null);
});
