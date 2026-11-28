import test from "node:test";
import assert from "node:assert/strict";
import { blastExposurePlan, validBlastExposureReview } from "../module/rules/blast-exposure.mjs";
import { blastDamageAt } from "../module/rules/damage-application.mjs";
import { measuredBlastActors } from "../module/apps/blast-dialog.mjs";

test("blast path review preserves ring attenuation, excludes blocked paths and retains failed-cover evidence", () => {
  const targets = [
    { uuid: "Actor.open", distanceFeet: 0 },
    { uuid: "Actor.blocked", distanceFeet: 5, route: "blocked" },
    {
      uuid: "Actor.breached",
      distanceFeet: 10,
      route: "breached",
      coverNote: "GC reviewed the original failed scenery Damage save"
    }
  ];
  const original = structuredClone(targets);
  const plan = blastExposurePlan(40, targets, 5, { routeConfirmed: true, shape: "cone" });
  assert.deepEqual(
    plan.targets.map(row => row.damage),
    [40, 0, 10]
  );
  assert.equal(plan.targets[2].coverNote, targets[2].coverNote);
  assert.equal(validBlastExposureReview(plan), true);
  assert.deepEqual(targets, original);
  for (const change of [
    { damage: 100 },
    { routeConfirmed: false },
    { targets: plan.targets.map((row, i) => (i === 2 ? { ...row, damage: 11 } : row)) }
  ])
    assert.equal(validBlastExposureReview({ ...plan, ...change }), false);
});

test("blast geometry requires actual confirmation, unique targets and evidence for breached cover", () => {
  const target = { uuid: "Actor.target", distanceFeet: 5 };
  assert.throws(() => blastExposurePlan(40, [target], 5), /Confirm the blast shape/);
  assert.throws(() => blastExposurePlan(40, [target], 5, { routeConfirmed: true, shape: "bent" }));
  assert.throws(() => blastExposurePlan(40, [target, target], 5, { routeConfirmed: true }), /only once/);
  assert.throws(
    () => blastExposurePlan(40, [{ ...target, route: "breached" }], 5, { routeConfirmed: true }),
    /actual failed Damage save/
  );
  assert.throws(() => blastExposurePlan(40, [{ ...target, coverNote: {} }], 5, { routeConfirmed: true }));
});

test("missing, coerced, negative or nonfinite distances never become Ground Zero", () => {
  for (const feet of [undefined, null, "", "5", NaN, Infinity, -1, Number.MAX_VALUE])
    assert.throws(() => blastDamageAt(40, feet, 5));
  for (const damage of [NaN, Infinity, 1.5, "40"]) assert.throws(() => blastDamageAt(damage, 0, 5));
  for (const increment of [0, -5, NaN, Infinity, 5.5, "5"]) assert.throws(() => blastDamageAt(40, 0, increment));
  assert.deepEqual(blastDamageAt(-2, 0, 5), { rings: 0, damage: 0 });
  assert.deepEqual(blastDamageAt(40, 12, 5), { rings: 2, damage: 10 });
});

test("multiple linked scene tokens cannot overwrite a shared actor with the final outer ring", () => {
  const actor = { uuid: "Actor.shared" },
    near = { actor, ring: 0, damage: 40 },
    far = { actor, ring: 3, damage: 5 };
  const grouped = measuredBlastActors([near, far]).get(actor.uuid);
  assert.equal(grouped.ambiguous, true);
  assert.deepEqual(
    grouped.positions.map(row => row.ring),
    [0, 3]
  );
  assert.equal(near.ring, 0);
});
