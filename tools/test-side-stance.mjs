import test from "node:test";
import assert from "node:assert/strict";
import { makeFatigueActor } from "./fixtures/fatigue-actor.mjs";
import { prep } from "./fixtures/feint.mjs";
import { combatStanceState } from "../module/rules/combat-stance.mjs";
import {
  sideStanceRows,
  sideStanceGrantPlan as grant,
  sideStanceAttackPlan as plan,
  sideStanceDefensePenalty as defense
} from "../module/rules/side-stance.mjs";
import { grantSideStanceFeint, validateSideStanceAttackProof } from "../module/apps/side-stance.mjs";
import { rollEvidence } from "../module/rules/outcomes.mjs";
import { actor, source, opts, controls } from "./fixtures/side-stance.mjs";
test("Side Stance requires earned Fencing Basics and applies its Defense penalty only while active", () => {
  const a = actor();
  assert.equal(combatStanceState(a.system).key, "side");
  assert.equal(defense(a.system), -1);
  for (const patch of [
    { combatStance: null },
    { activeFeatNames: [] },
    { conditionContext: { prone: true } },
    { conditionContext: { helpless: true } }
  ])
    assert.equal(defense({ ...a.system, ...patch }), 0);
  assert.equal(a.system.speed, 30);
});
test("only an acting successful Feint made while already in the same still-active Side Stance grants a die", () => {
  const a = actor(),
    { s, feint } = source(a);
  assert.equal(grant(a.system, s, feint).record.stanceId, "side1");
  for (const [settlement, p] of [
    [{ ...s, attackerWon: false }, feint],
    [s, { ...feint, version: 2 }],
    [s, { ...feint, combatStance: { version: 1, stance: null } }],
    [s, { ...feint, combatStance: { version: 1, stance: { ...feint.combatStance.stance, id: "earlier" } } }]
  ])
    assert.equal(grant(a.system, settlement, p), null);
  assert.equal(grant({ ...a.system, combatStance: null }, s, feint), null);
});
test("multiple successful Feints create one pending die total, eligible against either target and spent together", async () => {
  const a = actor();
  for (const [id, target] of [
    ["one", "Actor.target"],
    ["two", "Actor.other"]
  ]) {
    const { s, feint } = source(a, id, target);
    await grantSideStanceFeint(a, s, feint);
  }
  for (const targetUuid of ["Actor.target", "Actor.other"]) {
    const p = plan(a.system, { targetUuid });
    assert.equal(p.dice, 1);
    assert.equal(p.sourceMessages.length, 2);
  }
  assert.equal(plan(a.system, { targetUuid: a.uuid }).dice, 0);
  assert.equal(plan(a.system, { targetUuid: "Actor.target", ranged: true }).dice, 0);
  assert.equal(plan(a.system, { targetUuid: "Actor.target", defensive: true }).dice, 0);
  const m = await a.rollAttack(a.items[0], opts());
  assert.equal(m.flags.spycraft2.attackContext.sideStance.dice, 1);
  assert.equal(m.flags.spycraft2.attackContext.sideStance.sourceMessages.length, 2);
  assert.ok(a.system.sideStanceFeints.every(r => r.receiptUuid === m.uuid));
  assert.equal(plan(a.system, { targetUuid: "Actor.other" }).dice, 0);
  m.flags.spycraft2.resolved = true;
  m.flags.spycraft2.successConfirmed = false;
  assert.equal(plan(a.system, { targetUuid: "Actor.target" }).dice, 0);
});
test("leaving and re-entering discards an unused die, and replaying an old successful source never grants a new one", async () => {
  const a = actor(),
    { s, feint } = source(a);
  await grantSideStanceFeint(a, s, feint);
  a.system.combatStance = null;
  assert.equal(plan(a.system, { targetUuid: "Actor.target" }).dice, 0);
  a.system.combatStance = { version: 1, key: "side", id: "newSide" };
  assert.equal(plan(a.system, { targetUuid: "Actor.target" }).dice, 0);
  await grantSideStanceFeint(a, s, feint);
  assert.equal(a.system.sideStanceFeints.length, 1);
  const next = source(a, "newSource");
  await grantSideStanceFeint(a, next.s, next.feint);
  assert.equal(plan(a.system, { targetUuid: "Actor.target" }).dice, 1);
});
test("unposted failures refund only their claim; committed response failures retain the attack and used die", async () => {
  for (const kind of ["before", "after", "source", "target", "stance"]) {
    const a = actor(),
      { s, feint } = source(a);
    await grantSideStanceFeint(a, s, feint);
    controls.mode = ["before", "after"].includes(kind) ? kind : "normal";
    const request = opts();
    if (kind === "source")
      controls.draw = async () => {
        game.messages[0].flags.spycraft2.feint.combatStance.stance.id = "changed";
      };
    if (kind === "target")
      controls.draw = async () => {
        request.targetActorUuid = "Actor.other";
      };
    if (kind === "stance")
      controls.draw = async () => {
        a.system.combatStance = null;
      };
    const result = await Promise.allSettled([a.rollAttack(a.items[0], request)]);
    assert.equal(result[0].status, kind === "after" ? "fulfilled" : "rejected", kind);
    assert.equal(a.system.sideStanceFeints[0].usedBy != null, kind === "after", kind);
    if (kind === "stance") assert.equal(plan(a.system, { targetUuid: "Actor.target" }).dice, 0);
  }
});
test("concurrent attacks can consume only one pending die, and invalid histories block with readable weapon previews", async () => {
  const a = actor(),
    { s, feint } = source(a);
  await grantSideStanceFeint(a, s, feint);
  const result = await Promise.allSettled([a.rollAttack(a.items[0], opts()), a.rollAttack(a.items[0], opts())]);
  assert.equal(
    result.filter(r => r.status === "fulfilled" && r.value.flags.spycraft2.attackContext.sideStance.dice === 1).length,
    1
  );
  a.system.sideStanceFeints = [{ version: 99 }];
  assert.throws(() => sideStanceRows(a.system));
  const preview = a.weaponAttack(a.items[0], opts());
  assert.equal(preview.blocked, true);
  assert.match(preview.reason, /Review/);
});

test("a ranged attack leaves Side Stance before RNG, discarding its unused die without adding sneak entitlement", async () => {
  const a = actor(),
    { s, feint } = source(a);
  await grantSideStanceFeint(a, s, feint);
  a.items[0].system = { ...a.items[0].system, proficiency: "hurled", range: 20, qualities: "" };
  a.system = prep(a.system, a.items);
  controls.draw = async () => assert.equal(a.system.combatStance, null);
  const m = await a.rollAttack(a.items[0], opts());
  assert.equal(m.flags.spycraft2.attackContext.sideStance.dice, 0);
  assert.equal(m.flags.spycraft2.attackContext.sideStance.stanceId, null);
  assert.equal(a.system.sideStanceFeints[0].usedBy, null);
  a.system.combatStance = { version: 1, key: "side", id: "later" };
  assert.equal(plan(a.system, { targetUuid: "Actor.target" }).dice, 0);
});
test("an authenticated original replacement retains its already-used Side die after leaving, and cannot gain another die", async () => {
  const a = actor(),
    { s, feint } = source(a);
  await grantSideStanceFeint(a, s, feint);
  const original = await a.rollAttack(a.items[0], opts());
  a.system.combatStance = null;
  const c = original.flags.spycraft2,
    m = await a.rollCheck(c.formula, c.rollData, { ...c, rerollOf: original.uuid });
  assert.equal(m.flags.spycraft2.attackContext.sideStance.dice, 1);
  assert.equal(a.system.sideStanceFeints[0].receiptUuid, original.uuid);
  assert.throws(() =>
    validateSideStanceAttackProof(a, c.attackContext.sideStance, {
      checkKind: "attack",
      attackContext: c.attackContext,
      rerollOf: "ChatMessage.missing"
    })
  );
  assert.equal(plan(a.system, { targetUuid: "Actor.target" }).dice, 0);
});

test("actual engine applies Side Stance Defense−1 exactly once without changing Speed, attributes or health", async () => {
  const { readFileSync } = await import("node:fs"),
    { computeAgent } = await import("../module/rules/engine.mjs"),
    { SPYCRAFT: cfg } = await import("../module/config.mjs"),
    f = JSON.parse(readFileSync(new URL("../src/data/feats.json", import.meta.url))).find(
      f => f.name === "Fencing Basics"
    ),
    a = makeFatigueActor();
  a.items.push({ id: "fencing", name: f.name, type: "feat", system: { ...f, acquiredAtLevel: 1 } });
  a.raw.proficiencies = { edged: { proficient: true } };
  const base = computeAgent(structuredClone(a.raw), a.items, cfg);
  assert.ok(base.activeFeatNames.includes("Fencing Basics"));
  const raw = { ...structuredClone(a.raw), combatStance: { version: 1, key: "side", id: "engineSide" } },
    side = computeAgent(raw, a.items, cfg);
  assert.equal(side.defense.total, base.defense.total - 1);
  assert.equal(side.defenseBonusEntries.filter(e => e.source === "Side Stance").length, 1);
  assert.equal(side.speed, base.speed);
  assert.deepEqual(side.vitality, base.vitality);
  assert.deepEqual(side.wounds, base.wounds);
  for (const name of ["str", "dex", "con", "int", "wis", "cha"])
    assert.equal(side.abilities[name].value, base.abilities[name].value);
  assert.equal(
    computeAgent({ ...raw, conditionContext: { prone: true } }, a.items, cfg).defenseBonusEntries.some(
      e => e.source === "Side Stance"
    ),
    false
  );
});
test("a critical Feint can grant both bonuses and consume them through nested private leases without stacking or deadlock", async () => {
  const { grantFeintCriticalBonus } = await import("../module/apps/feint-bonus.mjs"),
    a = actor(),
    { s, feint } = source(a),
    am = game.messages.find(m => m.uuid === s.sourceMessage),
    dm = game.messages.find(m => m.uuid === s.defenderMessage);
  am.flags.spycraft2.criticalSuccess = true;
  Object.assign(s, {
    criticalBenefitVersion: 1,
    criticalAttackBonus: 2,
    combatId: a.clock.id,
    round: a.clock.round,
    criticalDueRound: a.clock.round + 1,
    sourceEvidence: [rollEvidence(am.flags.spycraft2), rollEvidence(dm.flags.spycraft2)]
  });
  am.flags.spycraft2.feintSettlement = structuredClone(s);
  dm.flags.spycraft2.feintSettlement = structuredClone(s);
  await grantSideStanceFeint(a, s, feint);
  await grantFeintCriticalBonus(a, s);
  const base = a.weaponAttack(a.items[0], opts("Actor.other")).total,
    m = await a.rollAttack(a.items[0], opts());
  assert.equal(m.flags.spycraft2.rollData.total, base + 2);
  assert.equal(m.flags.spycraft2.attackContext.sideStance.dice, 1);
  assert.equal(m.flags.spycraft2.attackContext.feintBonus.attackBonus, 2);
  assert.equal(a.system.feintBonuses[0].receiptUuid, m.uuid);
  assert.equal(a.system.sideStanceFeints[0].receiptUuid, m.uuid);
});
