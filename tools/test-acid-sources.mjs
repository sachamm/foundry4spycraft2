import test from "node:test";
import assert from "node:assert/strict";
import {
  acidAttackPlan,
  acidInjuryDue,
  acidProtection,
  beginAcidRound,
  halveAcidSource,
  legacyAcidSourcePlan,
  readAcidSource,
  reviewAcidSourcePlan,
  settleAcidRound
} from "../module/rules/acid-sources.mjs";
import { hazardState } from "../module/rules/hazards.mjs";
import { checkRecord } from "../module/rules/record-check.mjs";
import { RECORD_SHAPES } from "../module/data/record-shapes.mjs";
import { applyAcid, acidRoundPlan, halveAcid, acidInjuryChecked } from "../module/rules/damage-types.mjs";

const protection = (extra = {}) => ({
  ap: 1,
  reduction: 2,
  unarmoredReduction: 2,
  armorHit: false,
  armorPresent: false,
  armorSaveVerified: false,
  ...extra
});
const hit = (hazards, id, damage, suffered = damage, extra = {}) =>
  acidAttackPlan(hazards, { id, label: id, damage, suffered, protection: protection(), at: 1, ...extra }).hazards;

test("separate acid attacks retain independent amounts, DR and injury thresholds", () => {
  let hazards = hit(hazardState({}), "first", 12);
  hazards = hit(hazards, "second", 14);
  assert.equal(hazards.acid.damage, 26, "the compatibility summary must not discard a smaller attack");
  for (const oldHelper of [applyAcid, acidRoundPlan, halveAcid, acidInjuryChecked])
    assert.throws(() => oldHelper(hazards, { damage: 1 }), /one acid attack/);
  assert.equal(acidInjuryDue(readAcidSource(hazards, "first")), false);
  assert.equal(
    acidInjuryDue(readAcidSource(hazards, "second")),
    false,
    "the two attacks' combined 26 damage is not one injury source"
  );
  hazards = halveAcidSource(hazards, "first", "end").hazards;
  const begun = beginAcidRound(hazards, "first", { attempt: "round1", protection: protection() });
  assert.equal(begun.damage, 6);
  assert.equal(begun.net, 4);
  const done = settleAcidRound(begun.hazards, "first", { attempt: "round1", suffered: 3 });
  assert.equal(done.source.suffered, 15, "only the actual damage after resistance contributes");
  assert.equal(readAcidSource(done.hazards, "second").suffered, 14);
  assert.equal(readAcidSource(done.hazards, "second").damage, 14);
  assert.deepEqual(checkRecord(RECORD_SHAPES.hazards, done.hazards), []);
  assert.deepEqual(checkRecord(RECORD_SHAPES.hazards, hazardState({ hazards: done.hazards })), []);
});

test("washing away the final acid cannot erase its already-earned injury save", () => {
  let hazards = hit(hazardState({}), "attack", 30, 24);
  hazards = halveAcidSource(hazards, "attack", "end").hazards;
  hazards = beginAcidRound(hazards, "attack", { attempt: "tick", protection: protection() }).hazards;
  hazards = settleAcidRound(hazards, "attack", { attempt: "tick", suffered: 1 }).hazards;
  while (readAcidSource(hazards, "attack").damage) hazards = halveAcidSource(hazards, "attack", "wash").hazards;
  const source = readAcidSource(hazards, "attack");
  assert.equal(hazards.acid, null);
  assert.equal(source.suffered, 25);
  assert.equal(source.phase, "gone");
  assert.equal(acidInjuryDue(source), true);
  assert.equal(readAcidSource(structuredClone(hazards), "attack").suffered, 25);
});

test("a round intent blocks another application and halving until its actual damage is settled", () => {
  const before = halveAcidSource(hit(hazardState({}), "attack", 12), "attack", "end").hazards;
  const pending = beginAcidRound(before, "attack", { attempt: "original", protection: protection() }).hazards;
  assert.throws(() => beginAcidRound(pending, "attack", { attempt: "again", protection: protection() }), /interrupted/);
  assert.throws(() => halveAcidSource(pending, "attack", "wash"), /Review/);
  assert.throws(() => settleAcidRound(pending, "attack", { attempt: "wrong", suffered: 3 }), /original application/);
  const done = settleAcidRound(pending, "attack", { attempt: "original", suffered: 3 }).hazards;
  assert.throws(() => settleAcidRound(done, "attack", { attempt: "original", suffered: 3 }), /original application/);
  assert.equal(readAcidSource(pending, "attack").suffered, 12, "the unmodified intent preserves prior actual damage");
});

test("natural halving is once per round, while washing is independent and consumes no automatic round", () => {
  let hazards = hit(hazardState({}), "attack", 16);
  assert.throws(
    () => beginAcidRound(hazards, "attack", { attempt: "early", protection: protection() }),
    /end-of-round/
  );
  hazards = halveAcidSource(hazards, "attack", "wash").hazards;
  assert.equal(readAcidSource(hazards, "attack").phase, "end");
  hazards = halveAcidSource(hazards, "attack", "end").hazards;
  assert.equal(readAcidSource(hazards, "attack").damage, 4);
  assert.throws(() => halveAcidSource(hazards, "attack", "end"), /already ended/);
  hazards = halveAcidSource(hazards, "attack", "wash").hazards;
  assert.equal(readAcidSource(hazards, "attack").phase, "round");
});

test("a known combat round cannot apply the same attack again despite extra button clicks", () => {
  let hazards = hit(hazardState({}), "attack", 12, 12, { combat: { id: "fight", round: 2 } });
  hazards = halveAcidSource(hazards, "attack", "end").hazards;
  assert.throws(
    () =>
      beginAcidRound(hazards, "attack", {
        attempt: "sameRound",
        protection: protection(),
        combat: { id: "fight", round: 2 }
      }),
    /already applied/
  );
  const next = beginAcidRound(hazards, "attack", {
    attempt: "nextRound",
    protection: protection(),
    combat: { id: "fight", round: 3 }
  });
  assert.equal(next.net, 4);
});

test("armor protection requires actual object-save evidence and retains the original AP and struck layer", () => {
  assert.throws(() => acidProtection(protection({ ap: 0 })), /AP/);
  assert.throws(() => acidProtection(protection({ reduction: 4 })), /clothes/);
  assert.throws(() => acidProtection(protection({ reduction: 4, armorHit: true, armorPresent: true })), /Damage saves/);
  const defenses = protection({ reduction: 4, armorHit: true, armorPresent: true, armorSaveVerified: true });
  let hazards = hit(hazardState({}), "attack", 12, 8, { protection: defenses });
  hazards = halveAcidSource(hazards, "attack", "end").hazards;
  assert.throws(
    () => beginAcidRound(hazards, "attack", { attempt: "changedAP", protection: { ...defenses, ap: 2 } }),
    /original AP/
  );
  const afterArmorLoss = beginAcidRound(hazards, "attack", {
    attempt: "armorFailed",
    protection: { ...defenses, reduction: 2, armorPresent: false }
  });
  assert.equal(afterArmorLoss.net, 4);
});

test("complete protection ends only that acid attack while retaining any earlier injury threshold", () => {
  let hazards = hit(hazardState({}), "attack", 30, 25);
  hazards = hit(hazards, "other", 5);
  hazards = halveAcidSource(hazards, "attack", "end").hazards;
  hazards = beginAcidRound(hazards, "attack", {
    attempt: "protected",
    protection: protection({ reduction: 20, unarmoredReduction: 20 })
  }).hazards;
  const done = settleAcidRound(hazards, "attack", { attempt: "protected", suffered: 0, effectsPrevented: true });
  assert.equal(done.injurySaveDue, true);
  assert.equal(done.source.damage, 0);
  assert.equal(readAcidSource(done.hazards, "other").damage, 5);
});

test("legacy merged history remains uncertain until a GC verifies its actual totals and defenses", () => {
  const original = { ...hazardState({}), acid: { damage: 6, suffered: 40, injuryChecked: false, startedAt: 1 } };
  assert.throws(() => hit(original, "newAttack", 4), /older merged/);
  const migrated = legacyAcidSourcePlan(original, "legacy");
  assert.equal(readAcidSource(migrated, "legacy").suffered, 40);
  assert.equal(readAcidSource(migrated, "legacy").protection, null);
  assert.equal(readAcidSource(migrated, "legacy").needsReview, true);
  assert.throws(
    () =>
      reviewAcidSourcePlan(migrated, "legacy", {
        label: "Still merged",
        damage: 6,
        suffered: 40,
        phase: "end",
        injuryChecked: false,
        protection: protection(),
        note: "Unknown attacks",
        reviewer: "gc",
        at: 2
      }),
    /one original attack/
  );
  assert.throws(() => halveAcidSource(migrated, "legacy", "end"), /Review/);
  const reviewed = reviewAcidSourcePlan(migrated, "legacy", {
    label: "Verified original attack",
    damage: 6,
    suffered: 40,
    phase: "end",
    injuryChecked: true,
    protection: protection(),
    note: "Confirmed original exposure, injury save and present armor",
    reviewer: "gc",
    at: 2,
    singleAttackVerified: true
  });
  assert.equal(readAcidSource(reviewed, "legacy").needsReview, false);
  assert.equal(acidInjuryDue(readAcidSource(reviewed, "legacy")), false);
  assert.equal(original.acid.suffered, 40);
  assert.deepEqual(checkRecord(RECORD_SHAPES.hazards, reviewed), []);
  const closed = reviewAcidSourcePlan(migrated, "legacy", {
    label: "Earlier attacks resolved by the GC",
    damage: 0,
    suffered: 40,
    phase: "gone",
    injuryChecked: true,
    protection: null,
    note: "Finished the separate exposures and their original injury outcomes by hand",
    reviewer: "gc",
    at: 3
  });
  assert.equal(readAcidSource(closed, "legacy").protection, null);
  assert.equal(readAcidSource(closed, "legacy").provenSingleAttack, false);
  assert.equal(closed.acid, null);
});
