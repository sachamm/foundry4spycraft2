import test from "node:test";
import assert from "node:assert/strict";
import {
  fireExposurePlan,
  legacyFireSourcePlan,
  readFireSource,
  reviewFireSourcePlan
} from "../module/rules/fire-sources.mjs";
import { hazardState, ignitePlan, reduceFire } from "../module/rules/hazards.mjs";
import { checkRecord } from "../module/rules/record-check.mjs";
import { RECORD_SHAPES } from "../module/data/record-shapes.mjs";

test("initial fire damage and later rounds accumulate per fire even without catching fire", () => {
  let state = hazardState({});
  let plan = fireExposurePlan(state, { id: "warehouse", label: "Warehouse fire", damage: 20, at: 1 });
  assert.equal(plan.scarSaveDue, false);
  assert.equal(plan.hazards.fire, null);
  plan = fireExposurePlan(plan.hazards, { id: "other", label: "Other fire", damage: 10, at: 2 });
  assert.equal(plan.scarSaveDue, false, "separate fires do not combine their totals");
  plan = fireExposurePlan(plan.hazards, { id: "warehouse", label: "Same fire", damage: 5, at: 3 });
  assert.equal(plan.scarSaveDue, true);
  state = ignitePlan(plan.hazards, { damage: 12, ap: 2, sourceId: "warehouse", worldTime: 3 });
  assert.equal(state.fire.suffered, 25);
  assert.equal(state.fire.sourceId, "warehouse");
  state = reduceFire(state, 12);
  assert.equal(state.fire, null);
  assert.equal(readFireSource(state, "warehouse").suffered, 25, "extinguishing does not erase an owed scarring save");
  assert.deepEqual(checkRecord(RECORD_SHAPES.hazards, state), []);
});

test("a hotter different fire keeps its own initial total and scarring outcome", () => {
  const first = fireExposurePlan(hazardState({}), { id: "first", label: "First", damage: 30 }).hazards;
  const burning = ignitePlan(first, { damage: 12, sourceId: "first" });
  const next = fireExposurePlan(burning, { id: "hotter", label: "Hotter", damage: 20 }).hazards;
  const result = ignitePlan(next, { damage: 20, sourceId: "hotter" });
  assert.equal(result.fire.suffered, 20);
  assert.equal(result.fire.sourceId, "hotter");
  assert.equal(readFireSource(result, "first").suffered, 30);
});

test("legacy fire keeps known damage and requires review of its unknown initial history", () => {
  const old = ignitePlan(hazardState({}), { damage: 12, worldTime: 10 });
  old.fire.suffered = 12;
  const migrated = legacyFireSourcePlan(old, "legacy");
  assert.equal(migrated.fire.suffered, 12);
  assert.equal(migrated.fireSources.legacy.needsReview, true);
  const next = fireExposurePlan(migrated, { id: "legacy", label: "Earlier fire", damage: 13 });
  assert.equal(next.source.suffered, 25);
  assert.equal(next.scarSaveDue, false, "unknown history does not silently authorize a roll");
  const reviewed = reviewFireSourcePlan(next.hazards, "legacy", {
    label: "Verified fire",
    suffered: 32,
    scarChecked: false,
    note: "Initial damage and subsequent rounds verified",
    reviewer: "gc",
    at: 20
  });
  assert.equal(readFireSource(reviewed, "legacy").needsReview, false);
  assert.equal(reviewed.fire.suffered, 32);
  assert.deepEqual(checkRecord(RECORD_SHAPES.hazards, reviewed), []);
});

test("invalid fire names, damage and source keys are refused before exposure changes", () => {
  for (const input of [
    { id: "__proto__", label: "Fire", damage: 5 },
    { id: "ok", label: "", damage: 5 },
    { id: "ok", label: "Fire", damage: 1.5 },
    { id: "ok", label: "Fire", damage: -1 }
  ]) {
    assert.throws(() => fireExposurePlan(hazardState({}), input), /Choose a named fire/);
  }
  const state = hazardState({});
  assert.equal(fireExposurePlan(state, { id: "blocked", label: "Blocked", damage: 0 }).hazards, state);
});
