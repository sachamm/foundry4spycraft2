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
