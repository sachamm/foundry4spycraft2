import test from "node:test";
import assert from "node:assert/strict";
import { actor, attack, hit, controls } from "./fixtures/thread-needle.mjs";
import { threadNeedleAttackFacts, threadNeedleEndPlan } from "../module/rules/thread-needle.mjs";
import { meleeTrickContent } from "../module/apps/standard-attack-context.mjs";
import { prep } from "./fixtures/feint.mjs";
import { eligibleAttackDamageHits } from "../module/apps/attack-damage-benefits.mjs";
import { rollEvidence } from "../module/rules/outcomes.mjs";
test("Thread the Needle is an actual staff Standard Attack, no full action or numeric attack/damage/threat bonus", async () => {
  const a = actor(),
    normal = a.weaponAttack(a.items[0], { attackAction: "standard", targetActorUuid: "Actor.target" }),
    m = await attack(a),
    c = m.flags.spycraft2;
  assert.equal(c.rollData.total, normal.total);
  assert.equal(c.threat, normal.threat);
  assert.equal(c.error, normal.error);
  assert.equal(c.attackContext.meleeTrick.fullActionConfirmed, false);
  assert.equal(c.attackContext.meleeTrick.damageBonus, 0);
  assert.equal(c.attackContext.meleeTrick.attackBonus, 0);
  assert.equal(a.system.actionDice.value, 0);
  assert.match(meleeTrickContent(a), /hit holds the actual target/);
  assert.match(c.baseFlavor, /source-specific Held/);
});
test("wrong source/family/readiness, nonstandard/ranged/disarm, manual target and conflicting feat trick reject before RNG", async () => {
  for (const patch of [
    { meleeTrickOnlyConfirmed: false },
    { attackAction: "other" },
    { meleeFeatTrick: "fend" },
    {
      targetActorUuid: "",
      meleeTrickTargetName: "Door",
      meleeTrickTargetConfirmed: true,
      characterTarget: { source: "gcManual", characterType: "object", name: "Door" }
    }
  ]) {
    const a = actor();
    let draws = 0;
    controls.draw = async () => draws++;
    try {
      await attack(a, patch);
    } catch {}
    assert.equal(draws, 0);
    assert.equal(game.messages.length, 0);
  }
  for (const change of [
    a => (a.system.activeFeatNames = []),
    a => (a.items[0].system.meleeFamily = "spear"),
    a => (a.items[0].system.equipped = false),
    a => (a.items[0].system.proficiency = "hurled")
  ]) {
    const a = actor();
    change(a);
    a.system = prep(a.system, a.items);
    try {
      await attack(a);
    } catch {}
    assert.equal(game.messages.length, 0);
  }
});
test("Thread-only hit invents no zero-value damage claim; a combined All-out hit supplies only its real damage bonus", async () => {
  let { a } = await hit();
  assert.deepEqual(eligibleAttackDamageHits(a, a.items[0]), []);
  ({ a } = await hit(actor(), { allOutPenalty: 2 }));
  const hits = eligibleAttackDamageHits(a, a.items[0]);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].proof.bonus, 4);
  assert.equal(hits[0].proof.source, "All-out Attack");
});
test("current source/target/profile changes during actual RNG reject publication; original owned unresolved replacement retains earned trick after feat loss", async () => {
  for (const change of [
    a => (a.system.activeFeatNames = []),
    a => {
      a.items[0].system.equipped = false;
      a.system = prep(a.system, a.items);
    },
    a => (a.items[0].system.damage = "9d9"),
    a => game.actors.splice(1, 1)
  ]) {
    const a = actor();
    controls.draw = async () => change(a);
    await assert.rejects(attack(a), /changed|requires|target|context/);
    assert.equal(game.messages.length, 0);
  }
  const a = actor(),
    m = await attack(a),
    c = m.flags.spycraft2;
  a.system.activeFeatNames = [];
  const r = await a.rollCheck(c.formula, c.rollData, { ...c, rerollOf: m.uuid });
  assert.equal(r.flags.spycraft2.attackContext.meleeTrick.key, "threadNeedle");
  assert.equal(r.flags.spycraft2.rollData.total, c.rollData.total);
});
test("finished source requires the exact actual character hit and preserves immutable target/trick evidence", async () => {
  const { m } = await hit(),
    c = m.flags.spycraft2,
    e = rollEvidence(c);
  assert.equal(threadNeedleAttackFacts(c).targetUuid, "Actor.target");
  for (const patch of [
    { successConfirmed: false },
    { resolved: false },
    { superseded: "other" },
    { criticalFailure: true }
  ])
    assert.throws(() => threadNeedleAttackFacts({ ...c, ...patch }), /finished successful/);
  const n = structuredClone(c);
  n.attackContext.meleeTrick.targetUuid = "Actor.other";
  assert.throws(() => threadNeedleAttackFacts(n), /actual character/);
  assert.notEqual(e, rollEvidence(n));
});
test("ending by movement uses resulting separation beyond five feet and actual holder movement, never distance traveled or guessed target movement", () => {
  assert.deepEqual(threadNeedleEndPlan({ reason: "release", confirmed: true }), { reason: "release" });
  assert.equal(
    threadNeedleEndPlan({ reason: "movedBeyond", confirmed: true, holderMovedConfirmed: true, separationFeet: 5.1 })
      .separationFeet,
    5.1
  );
  for (const x of [
    { reason: "escape", confirmed: true },
    { reason: "release", confirmed: false },
    { reason: "movedBeyond", confirmed: true, separationFeet: 20 },
    { reason: "movedBeyond", confirmed: true, holderMovedConfirmed: true, separationFeet: 5 }
  ])
    assert.throws(() => threadNeedleEndPlan(x));
});

test("a genuine earned final Standard Attack may declare Thread without bypassing its private source or shared round allowance", async () => {
  const { actor: finalActor } = await import("./fixtures/trip-final-attack.mjs"),
    { takeTripFinalAttack } = await import("../module/apps/trip-final-attack.mjs"),
    a = finalActor(),
    w = a.items[0];
  a.system.activeFeatNames.push("Staff Basics");
  Object.assign(w.system, { proficiency: "exoticBlunt", meleeFamily: "staff", sizeHands: "M/2h", useHands: 2 });
  const m = await takeTripFinalAttack(a, {
    sourceMessage: "ChatMessage.source",
    weaponId: "sword",
    immediateConfirmed: true,
    attackLegalConfirmed: true,
    meleeTrick: "threadNeedle",
    meleeTrickOnlyConfirmed: true
  });
  assert.equal(m.flags.spycraft2.attackContext.meleeTrick.key, "threadNeedle");
  assert.equal(m.flags.spycraft2.attackContext.meleeTrick.fullActionConfirmed, false);
  assert.equal(m.flags.spycraft2.finalAttack.source, "trip");
  assert.equal(a.system.resourceUses.finalAttackRound.used, 1);
});
