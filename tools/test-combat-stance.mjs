import test from "node:test";
import assert from "node:assert/strict";
import { makeFatigueActor } from "./fixtures/fatigue-actor.mjs";
import {
  combatStanceState as state,
  combatStanceProof as proof,
  combatStanceDeclaration as declare,
  validateCombatStanceProof as validate,
  punishingDamagePlan as damage
} from "../module/rules/combat-stance.mjs";
import {
  declareCombatStance,
  endCombatStance,
  installCombatStanceHooks,
  settlePunishingDamage
} from "../module/apps/combat-stance.mjs";
import { rollEvidence } from "../module/rules/outcomes.mjs";
import { clock, sword, prep } from "./fixtures/feint.mjs";
foundry.utils.escapeHTML = String;
const record = () => ({ version: 1, key: "punishing", id: "stance1", enteredAt: 0 });
function actor() {
  const a = makeFatigueActor();
  a.uuid = "Actor.feint";
  a.flags = {};
  a.system.activeFeatNames = ["Flail Basics"];
  a.system.combatStance = record();
  a.mentalLeapCombatContext = clock;
  a.documentName = "Actor";
  a.items = [sword({ qualities: "", damage: "1d6", error: 1, threat: 20, range: 0 })];
  a.items.get = id => a.items.find(i => i.id === id);
  a.system = prep(a.system, a.items);
  a.update = async patch => {
    for (const [k, v] of Object.entries(patch)) {
      if (k === "flags.spycraft2.stanceDamageUses") {
        a.flags.spycraft2 ??= {};
        a.flags.spycraft2.stanceDamageUses = structuredClone(v);
      } else a.system[k.replace(/^system\./, "")] = structuredClone(v);
    }
    return a;
  };
  return a;
}
const hit = a => ({
  actorUuid: a.uuid,
  checkKind: "attack",
  resolved: true,
  successConfirmed: true,
  attackContext: { combatStance: proof(a.system), ranged: false }
});
test("one supported stance requires its earned feat; incapacities suppress its benefit immediately", () => {
  const a = actor();
  assert.equal(state(a.system).name, "Punishing Stance");
  for (const c of ["helpless", "prone", "sprawled", "paralyzed", "sleeping", "unconscious", "bound"])
    assert.equal(state({ ...a.system, conditionContext: { [c]: true } }), null, c);
  assert.equal(state({ ...a.system, activeFeatNames: [] }), null);
  for (const r of [
    { ...record(), version: 2 },
    { ...record(), id: "" },
    { ...record(), key: "fabricated" }
  ])
    assert.equal(state({ ...a.system, combatStance: r }), null);
  assert.equal(proof(a.system, { ranged: true }).stance, null);
});
test("entering costs a confirmed legal half action on own Count; normal is free and invalid declarations fail closed", () => {
  const a = actor(),
    input = { halfActionConfirmed: true, legalConfirmed: true, combat: clock() };
  assert.equal(declare(a.system, "punishing", input).key, "punishing");
  assert.equal(declare(a.system, "normal", { legalConfirmed: true }), null);
  for (const patch of [
    { halfActionConfirmed: false },
    { halfActionConfirmed: "true" },
    { legalConfirmed: false },
    { combat: { ...clock(), turn: 1 } },
    { combat: { ...clock(), started: false } }
  ])
    assert.throws(() => declare(a.system, "punishing", { ...input, ...patch }));
  assert.throws(() => declare({ ...a.system, conditionContext: { held: true } }, "punishing", input));
  assert.equal(declare({ ...a.system, conditionContext: { held: true } }, "normal", { legalConfirmed: true }), null);
  assert.throws(() => declare(a.system, "side", input));
});
test("declaration replaces rather than stacks stance and cancellation does not mutate it", async () => {
  const a = actor();
  await declareCombatStance(a, { stance: "punishing", halfActionConfirmed: true, legalConfirmed: true });
  assert.notEqual(a.system.combatStance.id, "stance1");
  const before = structuredClone(a.system.combatStance);
  assert.equal(await declareCombatStance(a), null);
  assert.deepEqual(a.system.combatStance, before);
  await endCombatStance(a, "old");
  assert.deepEqual(a.system.combatStance, before);
  await declareCombatStance(a, { stance: "normal", legalConfirmed: true });
  assert.equal(a.system.combatStance, null);
});
test("condition and source hooks persist forced exits so clearing a condition cannot restore the old benefit", async () => {
  const handlers = {};
  globalThis.Hooks = { on: (key, fn) => (handlers[key] = fn) };
  installCombatStanceHooks();
  for (const event of [
    "updateActor",
    "createActiveEffect",
    "updateActiveEffect",
    "deleteActiveEffect",
    "createItem",
    "updateItem",
    "deleteItem"
  ]) {
    const a = actor();
    a.system.conditionContext.prone = true;
    await handlers[event](event === "updateActor" ? a : { parent: a });
    a.system.conditionContext.prone = false;
    assert.equal(a.system.combatStance, null, event);
  }
  const a = actor();
  a.system.activeFeatNames = [];
  await handlers.updateItem({ parent: a });
  assert.equal(a.system.combatStance, null);
});
let draw = async () => {},
  posts = [];
globalThis.Roll = class {
  constructor(_f, data) {
    this.total = 12 + (data.total ?? 0);
    this.dice = [{ total: 12 }];
  }
  async evaluate() {
    await draw();
    return this;
  }
  async toMessage(data) {
    posts.push(data);
    return data;
  }
};
globalThis.ChatMessage = { getSpeaker: () => ({}) };
test("real Actor binds stance to melee attack, excludes independent damage, and blocks stance changes during RNG", async () => {
  const a = actor();
  posts = [];
  draw = async () => {};
  const m = await a.rollAttack(a.items[0], { attackAction: "standard" });
  assert.equal(m.flags.spycraft2.attackContext.combatStance.stance.key, "punishing");
  assert.equal(damage({ ...m.flags.spycraft2, resolved: true, successConfirmed: true }).amount, 2);
  for (const change of [
    a => (a.system.combatStance = null),
    a => (a.system.conditionContext.prone = true),
    a => (a.system.activeFeatNames = [])
  ]) {
    const a = actor();
    posts = [];
    draw = async () => change(a);
    await assert.rejects(a.rollAttack(a.items[0], { attackAction: "standard" }), /changed/);
    assert.equal(posts.length, 0);
  }
  draw = async () => {};
});
test("actual ranged attack exits before dice, while cancelled quick dialog never exits or rolls", async () => {
  const a = actor();
  a.items[0].system = { ...a.items[0].system, proficiency: "hurled", range: 20, sizeHands: "T/1h" };
  a.system = prep(a.system, a.items);
  let seen = false;
  draw = async () => {
    seen = true;
    assert.equal(a.system.combatStance, null);
  };
  await a.rollAttack(a.items[0], { attackAction: "standard" });
  assert.equal(seen, true);
  a.system.combatStance = record();
  seen = false;
  assert.equal(await a.rollAttack(a.items[0], { askContext: true }), null);
  assert.equal(a.system.combatStance.id, "stance1");
  assert.equal(seen, false);
  draw = async () => {};
});
test("damage follows original resolved stance hit after leaving, never adds to base damage or accepts miss, ranged or retrospective stance", () => {
  const a = actor(),
    c = hit(a);
  a.system.combatStance = null;
  assert.deepEqual(damage(c), {
    version: 1,
    stanceId: "stance1",
    amount: 2,
    damageType: "subdual",
    actionDiceAllowed: false
  });
  for (const bad of [
    { ...c, resolved: false },
    { ...c, successConfirmed: false },
    { ...c, superseded: "later" },
    { ...c, attackContext: { ...c.attackContext, ranged: true } },
    { ...c, attackContext: { ranged: false } }
  ])
    assert.throws(() => damage(bad));
  const before = rollEvidence(c);
  c.attackContext.combatStance.stance.id = "changed";
  assert.notEqual(rollEvidence(c), before);
  assert.doesNotThrow(() => validate(a, null, {}));
});
test("fixed subdual receipt settles once under concurrent/repeated calls and rejects unconfirmed or foreign hits", async () => {
  const a = actor(),
    m = { uuid: "ChatMessage.hit", flags: { spycraft2: hit(a) } };
  game.messages = [m];
  ChatMessage.create = async d => {
    const m = { ...d, uuid: "ChatMessage.fixed" };
    game.messages.push(m);
    return m;
  };
  await assert.rejects(settlePunishingDamage(a, m), /Confirm/);
  const [x, y] = await Promise.all([
    settlePunishingDamage(a, m, { damageConfirmed: true }),
    settlePunishingDamage(a, m, { damageConfirmed: true })
  ]);
  assert.equal(x, y);
  assert.equal(game.messages.filter(m => m.flags?.spycraft2?.checkKind === "stanceDamage").length, 1);
  assert.equal(x.flags.spycraft2.punishingDamage.amount, 2);
  assert.equal(x.flags.spycraft2.actionDiceAllowed, false);
  assert.equal(x.rolls, undefined);
  a.system.combatStance = null;
  assert.equal(await settlePunishingDamage(a, m), x);
  await assert.rejects(settlePunishingDamage({ ...a, uuid: "foreign" }, m, { damageConfirmed: true }), /own/);
});
