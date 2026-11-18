import test from "node:test";
import assert from "node:assert/strict";
import { makeFatigueActor } from "./fixtures/fatigue-actor.mjs";
import { clock } from "./fixtures/feint.mjs";
import { tripAttackPlan, tripAttackSkillChecks } from "../module/rules/trip-attack.mjs";
import { tripDefensePlan, tripDefenseSkillChecks } from "../module/rules/trip.mjs";
import { tripOutcomePlan as plan } from "../module/rules/trip-outcomes.mjs";
import {
  settleTripOutcome as settle,
  reviewTripOutcome as review,
  manageTripOutcomes
} from "../module/apps/trip-outcomes.mjs";
for (const id of ["sprawled", "flat-footed"])
  if (!CONFIG.statusEffects.some(s => s.id === id)) CONFIG.statusEffects.push({ id, name: id });
foundry.utils.escapeHTML = String;
const attack = tripAttackSkillChecks("acrobatics")[0],
  defend = tripDefenseSkillChecks("acrobatics")[0],
  opts = { opposedConfirmed: true };
function receipt(id, c) {
  return {
    id,
    uuid: "ChatMessage." + id,
    flags: { spycraft2: c },
    update: async function (p) {
      for (const [k, v] of Object.entries(p))
        this.flags.spycraft2[k.replace("flags.spycraft2.", "")] = structuredClone(v);
      return this;
    }
  };
}
function pair(won = true) {
  const a = makeFatigueActor(),
    d = makeFatigueActor();
  for (const [x, id] of [
    [a, "Actor.attacker"],
    [d, "Actor.defender"]
  ]) {
    x.uuid = id;
    x.name = "Same character name";
    x.system.activeFeatNames = [];
    x.system.size = "Medium";
    x.flags = {};
  }
  a.mentalLeapCombatContext = clock;
  d.mentalLeapCombatContext = () => ({ ...clock(), combatantId: "defender", ownTurnIndex: 1 });
  game.actors = [a, d];
  game.user.isGM = true;
  const p = tripAttackPlan(a.system, "acrobatics", attack, {
      tripAttackOpponentName: d.name,
      tripAttackOpponentUuid: d.uuid,
      tripAttackOpponentSize: "Medium",
      tripAttackAdjacent: true,
      tripAttackSizeDifference: 0,
      tripAttackParticipantsConfirmed: true,
      tripAttackHalfActionConfirmed: true,
      tripAttackCombat: clock()
    }).evidence,
    q = tripDefensePlan(d.system, "acrobatics", defend, {
      tripOpponentName: a.name,
      tripOpponentUuid: a.uuid,
      tripOpponentSize: "Medium",
      tripAdjacent: true,
      tripSizeDifference: 0,
      tripIncomingConfirmed: true,
      tripDefenseCombat: d.mentalLeapCombatContext()
    }).evidence,
    base = {
      checkKind: "skill",
      skillKey: "acrobatics",
      checkMethod: "roll",
      resolved: true,
      rollData: { total: 2 },
      naturalDie: 10
    },
    am = receipt("acting", {
      ...base,
      actorUuid: a.uuid,
      checkId: "trip",
      tripAttack: p,
      successConfirmed: won,
      effectiveTotal: won ? 20 : 10
    }),
    dm = receipt("defending", {
      ...base,
      actorUuid: d.uuid,
      checkId: "resist-trip",
      tripDefense: q,
      successConfirmed: !won,
      effectiveTotal: won ? 10 : 20
    });
  game.messages = [am, dm];
  game.messages.get = id => game.messages.find(m => m.id === id);
  return { a, d, am, dm };
}
const scope = (a, d, extra = {}) => ({ attackerUuid: a.uuid, defenderUuid: d.uuid, combat: clock(), ...extra });
const pplan = ({ a, d, am, dm }, extra = {}) => plan(am.flags.spycraft2, dm.flags.spycraft2, scope(a, d, extra));
test("ordinary pair has reciprocal identities even with duplicate names and yields the exact winning/losing condition", () => {
  for (const won of [true, false]) {
    const f = pair(won),
      p = pplan(f);
    assert.equal(p.condition, won ? "sprawled" : "flat-footed");
    assert.equal(p.conditionActorUuid, won ? f.d.uuid : f.a.uuid);
  }
});
test("invalid roles, unresolved/superseded/malformed/foreign/name-only receipts cannot settle", () => {
  for (const patch of [
    { checkKind: "attack" },
    { checkId: "other" },
    { resolved: false },
    { superseded: "other" },
    { checkMethod: "take10" },
    { effectiveTotal: NaN },
    { rollData: { total: NaN } },
    { successConfirmed: false },
    { actorUuid: "Actor.other" }
  ]) {
    const f = pair();
    Object.assign(f.am.flags.spycraft2, patch);
    assert.throws(() => pplan(f));
  }
  for (const change of [p => (p.version = 2), p => (p.opponentUuid = "Actor.other"), p => (p.role = "attacker")]) {
    const f = pair();
    change(f.dm.flags.spycraft2.tripDefense);
    assert.throws(() => pplan(f), /reciprocal/);
  }
});
test("paired clocks and reciprocal Sizes must agree with original own Count and actual participants", () => {
  for (const change of [
    f => (f.am.flags.spycraft2.tripAttack.combat.turn = 1),
    f => f.dm.flags.spycraft2.tripDefense.combat.round++,
    f => (f.dm.flags.spycraft2.tripDefense.combat.combatantId = "participant"),
    f => (f.dm.flags.spycraft2.tripDefense.opponentSize = "Large"),
    f => (f.dm.flags.spycraft2.tripDefense.sizeDifference = -1),
    f => (f.am.flags.spycraft2.tripAttack.sizeBonus = 4),
    f => (f.am.flags.spycraft2.tripAttack.halfActionConfirmed = false)
  ]) {
    const f = pair();
    change(f);
    assert.throws(() => pplan(f));
  }
  assert.throws(() => pplan(pair(), { combat: { ...clock(), round: 4 } }), /original/);
});
test("opposed ties use higher recorded skill bonus then explicit random tie-break confirmation", () => {
  const f = pair(),
    x = f.am.flags.spycraft2,
    y = f.dm.flags.spycraft2;
  y.effectiveTotal = 20;
  y.rollData = { total: 1 };
  assert.equal(pplan(f).attackerWon, true);
  y.rollData.total = 3;
  assert.throws(() => pplan(f), /winner/);
  y.rollData.total = 2;
  assert.throws(() => pplan(f), /tie-break/);
  assert.equal(pplan(f, { tieResolvedConfirmed: true }).tieResolved, true);
  assert.throws(() => pplan(f, { tieResolvedConfirmed: "true" }));
});
test("all activated critical roles are explicitly held for their separate Trip sequence", () => {
  for (const side of ["am", "dm"])
    for (const critical of ["criticalSuccess", "criticalFailure"]) {
      const f = pair();
      f[side].flags.spycraft2[critical] = true;
      assert.throws(() => pplan(f), /critical Trip/);
    }
});
test("actual concurrent settlement applies one condition, stamps both cards and never refreshes after recovery", async () => {
  const { a, d, am, dm } = pair();
  const [x, y] = await Promise.all([settle(a, am, dm, opts), settle(a, am, dm, opts)]);
  assert.deepEqual(x, y);
  assert.equal(d.statuses.has("sprawled"), true);
  assert.equal(d.effects.length, 1);
  assert.equal(a.effects.length, 0);
  assert.deepEqual(am.flags.spycraft2.tripSettlement, dm.flags.spycraft2.tripSettlement);
  await d.deleteEmbeddedDocuments("ActiveEffect", [d.effects[0].id]);
  await settle(a, am, dm, opts);
  assert.equal(d.effects.length, 0);
  assert.equal(a.system.actionDice.value, 0);
});
test("defender win applies flat-footed to the attacker and preserves pre-existing independent conditions", async () => {
  const { a, d, am, dm } = pair(false);
  const r = await settle(a, am, dm, opts);
  assert.equal(r.condition, "flat-footed");
  assert.equal(a.statuses.has("flat-footed"), true);
  assert.equal(d.effects.length, 0);
  const before = a.effects[0].toObject();
  await settle(a, am, dm, opts);
  assert.deepEqual(a.effects[0].toObject(), before);
});
test("ownership, visibility, blind access, actual message identity and explicit same-action confirmation are mandatory", async () => {
  for (const change of [
    f => (f.d.isOwner = false),
    f => (f.a.isOwner = false),
    f => (f.dm.visible = false),
    f => (f.am.isContentVisible = false),
    f => {
      f.am.blind = true;
      game.user.isGM = false;
    },
    f => game.messages.splice(0, 1)
  ]) {
    const f = pair();
    change(f);
    await assert.rejects(settle(f.a, f.am, f.dm, opts));
    assert.equal(f.a.effects.length + f.d.effects.length, 0);
  }
  const f = pair();
  await assert.rejects(settle(f.a, f.am, f.dm, {}), /Confirm/);
});
test("partially saved reservations block automatic condition creation and GC can apply the pending condition once", async () => {
  const { a, d, am, dm } = pair(),
    update = dm.update;
  let fail = true;
  dm.update = async function (p) {
    if (fail) {
      fail = false;
      throw Error("reservation failed");
    }
    return update.call(this, p);
  };
  await assert.rejects(settle(a, am, dm, opts), /reservation/);
  assert.equal(d.effects.length, 0);
  await assert.rejects(settle(a, am, dm, opts), /GC review/);
  const r = await review(a, am, dm, { confirmed: true, resolution: "applyPending" });
  assert.equal(r.gcReviewed, true);
  assert.equal(d.effects.length, 1);
  await settle(a, am, dm, opts);
  assert.equal(d.effects.length, 1);
});
test("effect posted before a failed final stamp recovers using the exact operation without another effect or RNG", async () => {
  const { a, d, am, dm } = pair(),
    update = am.update;
  let fail = true;
  am.update = async function (p) {
    if (p["flags.spycraft2.tripSettlement"]?.state === "applied" && fail) {
      fail = false;
      throw Error("stamp failed");
    }
    return update.call(this, p);
  };
  await assert.rejects(settle(a, am, dm, opts), /stamp/);
  const id = d.effects[0].id;
  const r = await settle(a, am, dm, opts);
  assert.equal(r.recovered, true);
  assert.equal(d.effects.length, 1);
  assert.equal(d.effects[0].id, id);
});
test("ended interrupted condition requires explicit already-applied GC review and is never refreshed", async () => {
  const { a, d, am, dm } = pair(),
    update = am.update;
  let fail = true;
  am.update = async function (p) {
    if (p["flags.spycraft2.tripSettlement"]?.state === "applied" && fail) {
      fail = false;
      throw Error("stamp failed");
    }
    return update.call(this, p);
  };
  await assert.rejects(settle(a, am, dm, opts));
  await d.deleteEmbeddedDocuments("ActiveEffect", [d.effects[0].id]);
  await assert.rejects(settle(a, am, dm, opts), /may already have ended/);
  const r = await review(a, am, dm, { confirmed: true, resolution: "alreadyApplied" });
  assert.equal(r.resolution, "alreadyApplied");
  assert.equal(d.effects.length, 0);
  await settle(a, am, dm, opts);
  assert.equal(d.effects.length, 0);
});
test("partial applied dual-message stamp recovers after turn advances without rechecking current earned weapon sources", async () => {
  const { a, d, am, dm } = pair(),
    update = dm.update;
  let fail = true;
  dm.update = async function (p) {
    if (p["flags.spycraft2.tripSettlement"]?.state === "applied" && fail) {
      fail = false;
      throw Error("second stamp failed");
    }
    return update.call(this, p);
  };
  await assert.rejects(settle(a, am, dm, opts));
  a.mentalLeapCombatContext = () => ({ ...clock(), round: 4 });
  await d.deleteEmbeddedDocuments("ActiveEffect", [d.effects[0].id]);
  const r = await settle(a, am, dm, opts);
  assert.equal(r.state, "applied");
  assert.equal(d.effects.length, 0);
  assert.deepEqual(am.flags.spycraft2.tripSettlement, dm.flags.spycraft2.tripSettlement);
});
test("saved pairs reject changed evidence or another source and prevent reusing an opposing receipt", async () => {
  const { a, d, am, dm } = pair();
  await settle(a, am, dm, opts);
  const other = receipt("other", structuredClone(am.flags.spycraft2));
  delete other.flags.spycraft2.tripSettlement;
  game.messages.push(other);
  await assert.rejects(settle(a, other, dm, opts), /another pair/);
  dm.flags.spycraft2.effectiveTotal++;
  await assert.rejects(settle(a, am, dm, opts), /changed evidence/);
  assert.equal(d.effects.length, 1);
});
test("GC review requires ownership, explicit confirmation and an existing prepared pair; cancellation does nothing", async () => {
  const { a, d, am, dm } = pair();
  await assert.rejects(review(a, am, dm, { confirmed: true, resolution: "applyPending" }), /prepared/);
  await assert.rejects(review(a, am, dm, { confirmed: false, resolution: "applyPending" }), /owning GC/);
  game.user.isGM = false;
  await assert.rejects(review(a, am, dm, { confirmed: true, resolution: "alreadyApplied" }), /owning GC/);
  game.user.isGM = true;
  assert.equal(await manageTripOutcomes(a), null);
  assert.equal(d.effects.length, 0);
});
test("already-sprawled target retains its independent effect and a forced stance exit completes inside settlement", async () => {
  const { a, d, am, dm } = pair();
  await d.createEmbeddedDocuments("ActiveEffect", [
    { statuses: ["sprawled"], flags: { spycraft2: { conditionOperation: "independent" } } }
  ]);
  const id = d.effects[0].id,
    update = d.update;
  let exits = 0;
  d.system.combatStance = { version: 1, key: "punishing", id: "priorStance", enteredAt: 0 };
  d.update = async patch => {
    if (Object.hasOwn(patch, "system.combatStance")) {
      assert.equal(patch["system.combatStance"], null);
      exits++;
    }
    return update(patch);
  };
  await settle(a, am, dm, opts);
  assert.equal(d.effects.length, 1);
  assert.equal(d.effects[0].id, id);
  assert.equal(exits, 1);
  assert.ok(!d.system.combatStance);
});
test("committed-then-rejected final stamp is recognized without reapplying an ended condition", async () => {
  const { a, d, am, dm } = pair(),
    update = am.update;
  let fail = true;
  am.update = async function (p) {
    await update.call(this, p);
    if (p["flags.spycraft2.tripSettlement"]?.state === "applied" && fail) {
      fail = false;
      throw Error("response lost");
    }
    return this;
  };
  await assert.rejects(settle(a, am, dm, opts), /response lost/);
  assert.equal(am.flags.spycraft2.tripSettlement.state, "applied");
  await d.deleteEmbeddedDocuments("ActiveEffect", [d.effects[0].id]);
  await settle(a, am, dm, opts);
  assert.equal(d.effects.length, 0);
  assert.equal(dm.flags.spycraft2.tripSettlement.state, "applied");
});
test("failed effect creation keeps a durable prepared pair for explicit GC completion only", async () => {
  const { a, d, am, dm } = pair(),
    create = d.createEmbeddedDocuments;
  d.createEmbeddedDocuments = async () => {
    throw Error("effect unavailable");
  };
  await assert.rejects(settle(a, am, dm, opts), /effect unavailable/);
  d.createEmbeddedDocuments = create;
  assert.equal(am.flags.spycraft2.tripSettlement.state, "prepared");
  await assert.rejects(settle(a, am, dm, opts), /GC review/);
  await review(a, am, dm, { confirmed: true, resolution: "applyPending" });
  assert.equal(d.effects.length, 1);
});
test("malformed saved condition, target, outcome and operation fields reject recovery before any new effect", async () => {
  for (const patch of [
    { condition: "sleeping" },
    { conditionActorUuid: "Actor.other" },
    { attackerWon: false },
    { wasCondition: "true" },
    { operationId: "" },
    { round: 99 }
  ]) {
    const { a, d, am, dm } = pair();
    await settle(a, am, dm, opts);
    for (const m of [am, dm]) Object.assign(m.flags.spycraft2.tripSettlement, patch);
    await d.deleteEmbeddedDocuments("ActiveEffect", [d.effects[0].id]);
    await assert.rejects(settle(a, am, dm, opts), /malformed/);
    assert.equal(d.effects.length, 0);
  }
});
test("actual winning critical settlement records one version2 final opportunity and applies its sprawled condition once", async () => {
  for (const kind of ["success", "failure", "both"]) {
    const { a, d, am, dm } = pair();
    if (kind !== "failure") am.flags.spycraft2.criticalSuccess = true;
    if (kind !== "success") dm.flags.spycraft2.criticalFailure = true;
    const r = await settle(a, am, dm, opts);
    assert.equal(r.version, 2);
    assert.equal(r.criticalOpportunity, "finalAttack");
    assert.equal(r.finalAttackPenalty, 4);
    assert.equal(d.effects.length, 1);
    await settle(a, am, dm, opts);
    assert.equal(d.effects.length, 1);
  }
});
test("actual critical defender win records one free counter and preserves the first attacker’s flat-footed loss", async () => {
  for (const kind of ["success", "failure"]) {
    const { a, d, am, dm } = pair(false);
    if (kind === "success") dm.flags.spycraft2.criticalSuccess = true;
    else am.flags.spycraft2.criticalFailure = true;
    const r = await settle(a, am, dm, opts);
    assert.equal(r.version, 3);
    assert.equal(r.criticalOpportunity, "counterTrip");
    assert.equal(r.counterTripDepth, 0);
    assert.equal(a.statuses.has("flat-footed"), true);
    assert.equal(d.effects.length, 0);
    await settle(a, am, dm, opts);
    assert.equal(a.effects.length, 1);
  }
});
