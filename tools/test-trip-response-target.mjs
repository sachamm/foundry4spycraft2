import test from "node:test";
import assert from "node:assert/strict";
import {
  tripDefenseSkillChecks,
  tripDefensePlan,
  validateTripDefenseProof,
  TRIP_SIZES
} from "../module/rules/trip.mjs";
import { tripDefenseTargetInput, validateTripDefenseTarget } from "../module/apps/trip.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
import { actor, clock, state, controls } from "./fixtures/trip-attack.mjs";
const check = tripDefenseSkillChecks("acrobatics")[0],
  input = patch => ({
    gearStatus: "available",
    synergySkill: "none",
    tripOpponentUuid: "Actor.target",
    tripOpponentName: "Target",
    tripOpponentSize: "Medium",
    tripAdjacent: true,
    tripSizeDifference: 0,
    tripIncomingConfirmed: true,
    tripDefenseCombat: clock(),
    ...patch
  }),
  roll = (a, patch = {}) => a.rollSkill("acrobatics", "dex", { check: "resist-trip", ...input(patch) });
test("observed incoming response binds actual attacker UUID/Size and combat while remaining available off own Count", () => {
  const c = { ...clock(), turn: 1 },
    p = tripDefensePlan(state(), "acrobatics", check, input({ tripDefenseCombat: c }));
  assert.equal(p.blockedReason, "");
  assert.equal(p.evidence.version, 3);
  assert.equal(p.evidence.role, "defender");
  assert.equal(p.evidence.opponentUuid, "Actor.target");
  assert.deepEqual(p.evidence.combat, c);
  assert.equal(p.evidence.opponentSize, "Medium");
});
test("all 144 observed Size pairs validate exact reciprocal difference and ordinary target limit", () => {
  for (let a = 0; a < 12; a++)
    for (let b = 0; b < 12; b++) {
      const p = tripDefensePlan(
        { ...state(), size: TRIP_SIZES[a] },
        "acrobatics",
        check,
        input({ tripOpponentSize: TRIP_SIZES[b], tripSizeDifference: a - b })
      );
      assert.equal(!!p.blockedReason, a - b > 1);
      if (!p.blockedReason) assert.equal(p.sizeBonus, 4 * Math.max(0, a - b));
    }
  assert.match(
    tripDefensePlan(state(), "acrobatics", check, input({ tripOpponentSize: "Large" })).blockedReason,
    /does not match/
  );
  assert.ok(
    tripDefensePlan({ ...state(), size: "Custom reviewed" }, "acrobatics", check, input({ tripSizeDifference: -2 }))
      .evidence
  );
});
test("observed response requires actual valid clock and attacker fields while manual/legacy v1-v2 retain source checks", () => {
  for (const patch of [
    { tripDefenseCombat: null },
    { tripOpponentUuid: 5 },
    { tripOpponentSize: 4 },
    { tripOpponentSize: "" }
  ])
    assert.ok(tripDefensePlan(state(), "acrobatics", check, input(patch)).blockedReason);
  const p = tripDefensePlan(state(), "acrobatics", check, input({ tripOpponentUuid: "" })).evidence;
  assert.equal(p.version, 2);
  const opts = { checkKind: "skill", skillKey: "acrobatics", checkId: "resist-trip", ability: "dex" };
  assert.doesNotThrow(() => validateTripDefenseProof(state(), p, opts));
  const old = { ...p, version: 1 };
  delete old.ownSize;
  assert.doesNotThrow(() => validateTripDefenseProof(state(), old, opts));
  assert.throws(() => validateTripDefenseProof({ ...state(), size: "Large" }, p, opts), /changed/);
});
test("actual picker ignores fabricated selected name/Size, rejects self/unseen/foreign documents and leaves other uses alone", () => {
  const a = actor(),
    v = tripDefenseTargetInput(input({ tripOpponentName: "Fake", tripOpponentSize: "Vast" }), a, {
      key: "acrobatics",
      check
    });
  assert.deepEqual(v, { tripOpponentUuid: "Actor.target", tripOpponentName: "Target", tripOpponentSize: "Medium" });
  for (const uuid of [a.uuid, "Actor.unseen", "Item.object"])
    assert.throws(
      () => tripDefenseTargetInput(input({ tripOpponentUuid: uuid }), a, { key: "acrobatics", check }),
      /observed other/
    );
  assert.deepEqual(tripDefenseTargetInput(input(), a, { key: "acrobatics", check: { id: "jump" } }), {});
  assert.deepEqual(tripDefenseTargetInput(input({ tripOpponentUuid: "" }), a, { key: "acrobatics", check }), {
    tripOpponentUuid: "",
    tripOpponentSize: null
  });
});
test("actual Actor records authoritative opponent and clock with distinct Great Sword defensive source", async () => {
  const a = actor("Great Sword Basics");
  a.clock.turn = 1;
  const m = await roll(a, {
      tripOpponentName: "Fake",
      tripOpponentSize: "Vast",
      tripDefenseCombat: { ...clock(), id: "fake" }
    }),
    c = m.flags.spycraft2;
  assert.equal(c.tripDefense.version, 3);
  assert.equal(c.tripDefense.opponentName, "Target");
  assert.equal(c.tripDefense.opponentSize, "Medium");
  assert.equal(c.tripDefense.combat.id, clock().id);
  assert.equal(c.tripDefense.combat.turn, 1);
  assert.equal(c.meleeSkillFeats.sources[0].feat, "Great Sword Basics");
  assert.equal(c.tripAttack, null);
  assert.equal(a.system.actionDice.value, 0);
});
test("actual selected attacker Size, availability, own Size and combat changes during RNG reject without posting", async () => {
  for (const kind of ["targetSize", "targetGone", "ownSize", "round", "turn"]) {
    const a = actor("Great Sword Basics"),
      n = game.messages.length;
    controls.draw = async () => {
      if (kind === "targetSize") game.actors.find(a => a.uuid === "Actor.target").system.size = "Large";
      if (kind === "targetGone") game.actors = game.actors.filter(a => a.uuid !== "Actor.target");
      if (kind === "ownSize") a.system.size = "Large";
      if (kind === "round") a.clock.round++;
      if (kind === "turn") a.clock.turn = 1;
    };
    await assert.rejects(roll(a), /changed|match|observed/);
    assert.equal(game.messages.length, n, kind);
  }
});
test("owned original response replacement retains UUID through cosmetic rename and rejects historical clock/Size drift before RNG", async () => {
  const a = actor("Great Sword Basics"),
    m = await roll(a),
    c = m.flags.spycraft2;
  game.actors.find(a => a.uuid === "Actor.target").name = "Same UUID renamed";
  let draws = 0;
  controls.draw = async () => draws++;
  const r = await a.rollCheck(c.formula, c.rollData, { ...c, rerollOf: m.uuid });
  assert.deepEqual(r.flags.spycraft2.tripDefense, c.tripDefense);
  a.clock.round++;
  await assert.rejects(a.rollCheck(c.formula, c.rollData, { ...c, rerollOf: m.uuid }), /changed/);
  a.clock.round--;
  game.actors.find(a => a.uuid === "Actor.target").system.size = "Large";
  assert.throws(() => validateTripDefenseTarget(a, c.tripDefense), /changed/);
  await assert.rejects(a.rollCheck(c.formula, c.rollData, { ...c, rerollOf: m.uuid }), /changed/);
  assert.equal(draws, 1);
});
test("new response fields remain immutable and cannot be stripped to accept an old roll signature", () => {
  const p = resolveSkillCheck(state(), "acrobatics", check, input()).tripDefense,
    c = { checkKind: "skill", skillKey: "acrobatics", checkId: "resist-trip", tripDefense: p },
    e = rollEvidence(c);
  for (const key of Object.keys(p)) {
    const n = structuredClone(c);
    delete n.tripDefense[key];
    assert.equal(rollEvidenceMatches(e, n), false, key);
  }
  assert.equal(
    rollEvidenceMatches(
      rollEvidence({
        ...c,
        tripDefense: {
          ...p,
          version: 2,
          opponentUuid: undefined,
          opponentSize: undefined,
          combat: undefined,
          role: undefined
        }
      }),
      c
    ),
    false
  );
});
test("actual manual response remains available without a recorded opponent while invalid selected forms draw no dice", async () => {
  const a = actor();
  let draws = 0;
  controls.draw = async () => draws++;
  const n = game.messages.length;
  for (const patch of [
    { tripOpponentUuid: a.uuid },
    { tripOpponentUuid: "Actor.missing" },
    { tripSizeDifference: 1 },
    { tripAdjacent: false }
  ])
    await roll(a, patch).catch(() => null);
  assert.equal(draws, 0);
  assert.equal(game.messages.length, n);
  const m = await roll(a, { tripOpponentUuid: "", tripOpponentName: "GC-reviewed unrecorded attacker" });
  assert.equal(m.flags.spycraft2.tripDefense.version, 2);
  assert.equal(draws, 1);
});
