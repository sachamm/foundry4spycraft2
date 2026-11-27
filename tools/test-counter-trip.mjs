import test from "node:test";
import assert from "node:assert/strict";
import { fixture, request, controls, finishPair } from "./fixtures/counter-trip.mjs";
import {
  takeCounterTrip as take,
  validateTripCounterIntent,
  validateTripCounterProof,
  reviewCounterTrip
} from "../module/apps/counter-trip.mjs";
import { tripAttackPlan, tripCounterSkillCheck } from "../module/rules/trip-attack.mjs";
import { settleTripOutcome, counterTripSource } from "../module/apps/trip-outcomes.mjs";
import { takeTripFinalAttack } from "../module/apps/trip-final-attack.mjs";
test("earned counter-Trip is canonical free Acrobatics DEX with ACP/error+1, actual original target and one private source", async () => {
  const f = await fixture(),
    m = await take(f.d, request()),
    c = m.flags.spycraft2;
  assert.equal(c.checkId, "counter-trip");
  assert.equal(c.ability, "dex");
  assert.equal(c.tripAttack.version, 2);
  assert.equal(c.tripAttack.halfActionConfirmed, false);
  assert.equal(c.tripAttack.counterTrip.depth, 1);
  assert.equal(c.tripAttack.opponentUuid, f.a.uuid);
  assert.notEqual(c.tripAttack.combat.turn, c.tripAttack.combat.ownTurnIndex);
  assert.equal(c.error, 4);
  assert.equal(c.meleeSkillFeats.sources[0].feat, "Spear Basics");
  assert.equal(c.rollData.total, f.d.system.skillTotals.acrobatics.totals.find(t => t.ability === "dex").total + 2);
  assert.match(c.baseFlavor, /Free action/);
  assert.equal(Object.hasOwn(c, "tripCounterLease"), false);
  assert.equal(controls.draws, 1);
  assert.equal(f.a.statuses.has("flat-footed"), true);
  assert.equal(f.d.system.actionDice.value, 0);
});
test("either original critical source and both together earn only one counter across concurrent or repeated calls", async () => {
  for (const kind of ["success", "failure", "both"]) {
    const f = await fixture(kind),
      rs = await Promise.allSettled([take(f.d, request()), take(f.d, request())]);
    assert.equal(game.messages.length, 3);
    assert.equal(rs.filter(r => r.status === "fulfilled" && r.value).length, 1);
    const m = await take(f.d, request());
    assert.equal(m.uuid, game.messages[2].uuid);
    assert.equal(controls.draws, 1);
  }
});
test("no parent source, copied private facts, wrong actor or fabricated free check can authorize RNG", async () => {
  const f = await fixture();
  await assert.rejects(take(f.a, request()), /actual visible/);
  const m = await take(f.d, request()),
    p = m.flags.spycraft2.tripAttack;
  assert.throws(() => validateTripCounterIntent(f.d, p.counterTrip, {}), /control/);
  await assert.rejects(
    f.d.rollSkill("acrobatics", "dex", { check: "counter-trip", tripCounter: p.counterTrip }),
    /control/
  );
  assert.equal(controls.draws, 1);
  const unearned = tripAttackPlan(f.d.system, "acrobatics", tripCounterSkillCheck(), {
    tripAttackCombat: f.d.mentalLeapCombatContext()
  });
  assert.ok(unearned.blockedReason);
});
test("ordinary Size/adjacency/free-action confirmations remain mandatory without granting an implicit Size exception", async () => {
  for (const patch of [
    { tripAttackAdjacent: false },
    { tripAttackParticipantsConfirmed: false },
    { immediateConfirmed: false },
    { tripAttackSizeDifference: -2 },
    { tripAttackSizeDifference: 1 }
  ]) {
    const f = await fixture();
    await assert.rejects(take(f.d, request(patch)));
    assert.equal(controls.draws, 0);
    assert.equal(game.messages.length, 2);
    assert.equal(f.dm.flags.spycraft2.tripCounterUse, undefined);
  }
  const f = await fixture();
  f.a.system.size = "Huge";
  await assert.rejects(take(f.d, request({ tripAttackSizeDifference: -2 })));
  assert.equal(controls.draws, 0);
});
test("current participant/round, target Size/availability and gear changes during RNG reject without publishing a second action", async () => {
  for (const change of [
    f => (f.combat.turn = 1),
    f => f.combat.round++,
    f => (f.a.system.size = "Large"),
    f => {
      game.actors = game.actors.filter(a => a !== f.a);
      f.combat.turns[0].actor = null;
    },
    f => {
      f.d.items.find(i => i.type === "weapon").system.equipped = false;
      f.d.derive();
    },
    f => f.am.flags.spycraft2.effectiveTotal++
  ]) {
    const f = await fixture();
    controls.hook = () => change(f);
    await assert.rejects(take(f.d, request()));
    assert.equal(game.messages.length, 2);
    assert.equal(f.dm.flags.spycraft2.tripCounterUse, undefined);
    assert.equal(f.a.statuses.has("flat-footed"), true);
  }
});
test("posted response loss retains one counter and owning GC recovery reattaches it without another roll", async () => {
  const f = await fixture();
  controls.post = "after";
  const m = await take(f.d, request());
  assert.equal(game.messages.length, 3);
  assert.equal(f.dm.flags.spycraft2.tripCounterUse.state, "reserved");
  assert.equal((await reviewCounterTrip(f.d, { sourceMessage: f.dm.uuid, confirmed: true })).messageUuid, m.uuid);
  assert.equal(controls.draws, 1);
  assert.equal(f.dm.flags.spycraft2.tripCounterUse.state, "posted");
});
test("unposted failures release only the unused counter reservation and keep the original attacker condition", async () => {
  const f = await fixture();
  controls.post = "before";
  await assert.rejects(take(f.d, request()), /before post/);
  assert.equal(game.messages.length, 2);
  assert.equal(f.dm.flags.spycraft2.tripCounterUse, undefined);
  assert.equal(f.a.statuses.has("flat-footed"), true);
});
test("a successful ordinary counter sprawls the original attacker while preserving its prior flat-footed condition", async () => {
  const f = await fixture(),
    m = await take(f.d, request()),
    d = await finishPair(f, m);
  const r = await settleTripOutcome(f.d, m, d, { opposedConfirmed: true });
  assert.equal(r.version, 4);
  assert.equal(r.counterTripDepth, 1);
  assert.equal(r.criticalOpportunity, null);
  assert.equal(f.a.statuses.has("sprawled"), true);
  assert.equal(f.a.statuses.has("flat-footed"), true);
  await settleTripOutcome(f.d, m, d, { opposedConfirmed: true });
  assert.equal(f.a.effects.length, 2);
});
test("a counter defensive critical win or counter attacking critical failure applies flat-footed and never earns a third Trip", async () => {
  for (const kind of ["success", "failure"]) {
    const f = await fixture(),
      m = await take(f.d, request()),
      d = await finishPair(f, m, { won: false, critical: kind === "failure" ? "failure" : "" });
    if (kind === "success") d.flags.spycraft2.criticalSuccess = true;
    const r = await settleTripOutcome(f.d, m, d, { opposedConfirmed: true });
    assert.equal(r.version, 4);
    assert.equal(r.criticalOpportunity, null);
    assert.equal(f.d.statuses.has("flat-footed"), true);
    assert.throws(() => counterTripSource(f.a, d), /never grants a third/);
    await assert.rejects(take(f.a, request({ sourceMessage: d.uuid })), /third/);
    assert.equal(controls.draws, 1);
  }
});
test("the counter attacking critical final attack remains legal off own Count through same-active-parent reordering", async () => {
  const f = await fixture(),
    m = await take(f.d, request()),
    d = await finishPair(f, m, { critical: "success" });
  const s = await settleTripOutcome(f.d, m, d, { opposedConfirmed: true });
  assert.equal(s.criticalOpportunity, "finalAttack");
  const original = f.combat.turns[0],
    counter = f.combat.turns[1];
  f.combat.turns = [counter, { id: "spare", actor: { uuid: "Actor.spare" } }, original];
  f.combat.combatants = f.combat.turns;
  f.combat.turn = 2;
  controls.natural = 5;
  const final = await takeTripFinalAttack(f.d, {
    sourceMessage: m.uuid,
    weaponId: "sword",
    immediateConfirmed: true,
    attackLegalConfirmed: true
  });
  assert.equal(final.flags.spycraft2.finalAttack.activeCombatantId, "original");
  assert.equal(final.flags.spycraft2.finalAttack.penalty, 4);
  assert.equal(f.d.system.resourceUses.finalAttackRound.used, 1);
  assert.equal(f.d.system.actionDice.value, 0);
});
test("counter replacement proof must descend from its owned unresolved original and cannot create a new free roll", async () => {
  const f = await fixture(),
    m = await take(f.d, request()),
    c = m.flags.spycraft2;
  assert.throws(
    () =>
      validateTripCounterProof(f.d, c.tripAttack, {
        checkKind: "skill",
        skillKey: "acrobatics",
        checkId: "counter-trip"
      }),
    /control/
  );
  const r = await f.d.rollCheck(c.formula, c.rollData, { ...c, rerollOf: m.uuid });
  assert.deepEqual(r.flags.spycraft2.tripAttack, c.tripAttack);
  m.flags.spycraft2.resolved = true;
  await assert.rejects(f.d.rollCheck(c.formula, c.rollData, { ...c, rerollOf: m.uuid }), /unresolved/);
});
test("private counter metadata carries source identities without copying opposed roll totals and cannot be altered", async () => {
  const f = await fixture(),
    m = await take(f.d, request()),
    p = m.flags.spycraft2.tripAttack;
  for (const key of ["sourceEvidence", "rollData", "naturalDie", "effectiveTotal"])
    assert.equal(Object.hasOwn(p.counterTrip, key), false);
  const c = m.flags.spycraft2;
  for (const patch of [{ targetUuid: "Actor.other" }, { depth: 2 }, { activeCombatantId: "other" }])
    assert.throws(() =>
      validateTripCounterProof(
        f.d,
        { ...p, counterTrip: { ...p.counterTrip, ...patch } },
        { checkKind: "skill", skillKey: "acrobatics", checkId: "counter-trip", rerollOf: m.uuid }
      )
    );
});
test("GC can close a missing interrupted counter without authorizing new RNG and cannot close a still-active attempt", async () => {
  const f = await fixture();
  f.dm.flags.spycraft2.tripCounterUse = { id: "interrupted", state: "reserved", counter: {} };
  await assert.rejects(reviewCounterTrip(f.d, { sourceMessage: f.dm.uuid, confirmed: true }), /No unique/);
  assert.equal(
    (await reviewCounterTrip(f.d, { sourceMessage: f.dm.uuid, confirmed: true, closeUnused: true })).newRollAuthorized,
    false
  );
  assert.equal(f.dm.flags.spycraft2.tripCounterUse.state, "closed");
  await assert.rejects(take(f.d, request()), /already reserved/);
  const g = await fixture();
  controls.hook = async () => {
    await assert.rejects(
      reviewCounterTrip(g.d, { sourceMessage: g.dm.uuid, confirmed: true, closeUnused: true }),
      /no client is executing/
    );
  };
  await take(g.d, request());
  assert.equal(controls.draws, 1);
});
test("counter source stamp failure retains its original root and recovers through a strict matching review", async () => {
  const f = await fixture(),
    update = f.dm.update;
  f.dm.update = async function (p) {
    if (p["flags.spycraft2.tripCounterUse"]?.state === "posted") throw Error("source stamp failed");
    return update.call(this, p);
  };
  const m = await take(f.d, request());
  assert.equal(f.dm.flags.spycraft2.tripCounterUse.state, "reserved");
  f.dm.update = update;
  await reviewCounterTrip(f.d, { sourceMessage: f.dm.uuid, confirmed: true });
  assert.equal(f.dm.flags.spycraft2.tripCounterUse.messageUuid, m.uuid);
  assert.equal(controls.draws, 1);
});
test("finished counter history remains idempotent after the original Count ends and never refreshes ended conditions", async () => {
  const f = await fixture(),
    m = await take(f.d, request()),
    d = await finishPair(f, m);
  await settleTripOutcome(f.d, m, d, { opposedConfirmed: true });
  await f.a.deleteEmbeddedDocuments(
    "ActiveEffect",
    f.a.effects.filter(e => e.statuses.has("sprawled")).map(e => e.id)
  );
  f.combat.round++;
  assert.equal((await take(f.d, request())).uuid, m.uuid);
  await settleTripOutcome(f.d, m, d, { opposedConfirmed: true });
  assert.equal(f.a.statuses.has("sprawled"), false);
  assert.equal(controls.draws, 1);
});
test("counter final attack rejects a changed active parent even when the countering character reaches its own Count", async () => {
  const f = await fixture(),
    m = await take(f.d, request()),
    d = await finishPair(f, m, { critical: "success" });
  await settleTripOutcome(f.d, m, d, { opposedConfirmed: true });
  f.combat.turn = 1;
  await assert.rejects(
    takeTripFinalAttack(f.d, {
      sourceMessage: m.uuid,
      weaponId: "sword",
      immediateConfirmed: true,
      attackLegalConfirmed: true
    }),
    /original Initiative/
  );
  assert.equal(controls.draws, 1);
  assert.equal(f.d.system.resourceUses?.finalAttackRound, undefined);
});
test("ownership lost during RNG leaves a durable unposted reservation for GC closure rather than silently replaying it", async () => {
  const f = await fixture();
  controls.hook = () => {
    f.d.isOwner = false;
  };
  await assert.rejects(take(f.d, request()), /unused counter-Trip needs GC review/);
  assert.equal(game.messages.length, 2);
  assert.equal(f.dm.flags.spycraft2.tripCounterUse.state, "reserved");
  f.d.isOwner = true;
  await reviewCounterTrip(f.d, { sourceMessage: f.dm.uuid, confirmed: true, closeUnused: true });
  assert.equal(f.dm.flags.spycraft2.tripCounterUse.state, "closed");
  assert.equal(controls.draws, 1);
});
test("the counter source picker offers the earned defender card and excludes the losing attacker’s copied settlement", async () => {
  const f = await fixture(),
    input = foundry.applications.api.DialogV2.input;
  let html = "";
  foundry.applications.api.DialogV2.input = async x => {
    html = x.content;
    return null;
  };
  try {
    assert.equal(await take(f.a), null);
    assert.ok(!html.includes('value="' + f.am.uuid + '"'));
    assert.equal(await take(f.d), null);
    assert.ok(html.includes('value="' + f.dm.uuid + '"'));
    assert.equal(controls.draws, 0);
  } finally {
    foundry.applications.api.DialogV2.input = input;
  }
});
test("a source changed while waiting for the rule mutex requires a new confirmation before any reservation or RNG", async () => {
  const { queueRuleState } = await import("../module/apps/rule-resource-scope.mjs"),
    f = await fixture();
  let release, entered;
  const ready = new Promise(r => (entered = r)),
    hold = queueRuleState(
      f.d,
      () =>
        new Promise(r => {
          release = r;
          entered();
        })
    );
  await ready;
  const attempt = take(f.d, request());
  f.am.flags.spycraft2.tripSettlement.operationId = "reviewed-new-operation";
  f.dm.flags.spycraft2.tripSettlement.operationId = "reviewed-new-operation";
  release();
  await hold;
  await assert.rejects(attempt, /source changed while preparing/);
  assert.equal(f.dm.flags.spycraft2.tripCounterUse, undefined);
  assert.equal(controls.draws, 0);
});
test("a reservation write which commits before rejecting remains held for explicit GC closure and cannot roll again", async () => {
  const f = await fixture(),
    update = f.dm.update;
  let reject = true;
  f.dm.update = async function (p) {
    await update.call(this, p);
    if (reject && p["flags.spycraft2.tripCounterUse"]?.state === "reserved") {
      reject = false;
      throw Error("reservation response lost");
    }
    return this;
  };
  await assert.rejects(take(f.d, request()), /response lost/);
  assert.equal(f.dm.flags.spycraft2.tripCounterUse.state, "reserved");
  assert.equal(controls.draws, 0);
  await assert.rejects(take(f.d, request()), /already reserved/);
  await reviewCounterTrip(f.d, { sourceMessage: f.dm.uuid, confirmed: true, closeUnused: true });
  assert.equal(f.dm.flags.spycraft2.tripCounterUse.state, "closed");
  assert.equal(game.messages.length, 2);
});
test("settling a Trip leaves an Undo note with both characters and the card's settlement mark (round-3 council)", async () => {
  const f = await fixture(),
    m = await take(f.d, request()),
    d = await finishPair(f, m);
  const notes = [];
  ChatMessage.create = async data => (data.flags?.spycraft2?.undo && notes.push(data.flags.spycraft2.undo), data);
  try {
    await settleTripOutcome(f.d, m, d, { opposedConfirmed: true });
  } finally {
    delete ChatMessage.create;
  }
  assert.equal(notes.length, 1);
  assert.ok(notes[0].entries.length >= 1);
  assert.ok(notes[0].cardMarks?.some(mark => mark.key === "tripSettlement"));
});
