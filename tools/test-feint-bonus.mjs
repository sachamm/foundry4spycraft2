import test from "node:test";
import assert from "node:assert/strict";
import { makeFatigueActor } from "./fixtures/fatigue-actor.mjs";
import { clock, sword, prep } from "./fixtures/feint.mjs";
import {
  feintAttackBonusPlan as plan,
  feintBonusGrantPlan as grant,
  feintBonusRows
} from "../module/rules/feint-bonus.mjs";
import { grantFeintCriticalBonus, validateFeintAttackBonusProof } from "../module/apps/feint-bonus.mjs";
import { rollEvidence } from "../module/rules/outcomes.mjs";
import { queueResources } from "../module/services/transactions.mjs";
foundry.utils.escapeHTML = String;
let draw = async () => {},
  mode = "normal",
  sequence = 0;
globalThis.ChatMessage = { getSpeaker: () => ({}) };
function receipt(id, c) {
  const m = { id, uuid: "ChatMessage." + id, flags: { spycraft2: c } };
  game.messages.push(m);
  return m;
}
globalThis.Roll = class {
  constructor(_f, data) {
    this.total = 12 + (data.total ?? 0);
    this.dice = [{ total: 12 }];
  }
  async evaluate() {
    await draw();
    return this;
  }
  async toMessage(d) {
    if (mode === "before") throw Error("posting failed");
    const m = receipt("attack" + ++sequence, d.flags.spycraft2);
    if (mode === "after") throw Error("response lost");
    return m;
  }
};
function actor() {
  const a = makeFatigueActor();
  a.uuid = "Actor.feint";
  a.name = "Winner";
  a.flags = {};
  a.items = [sword({ qualities: "", damage: "1d6", error: 1, threat: 20, range: 0 })];
  a.items.get = id => a.items.find(i => i.id === id);
  a.system = prep(a.system, a.items);
  a.clock = clock();
  a.mentalLeapCombatContext = () => ({ ...a.clock });
  a.update = async patch => {
    for (const [k, v] of Object.entries(patch)) a.system[k.replace("system.", "")] = structuredClone(v);
    return a;
  };
  game.messages = [];
  game.combat = { id: a.clock.id, started: true, combatants: [{ actor: a }] };
  game.combats = [game.combat];
  game.actors = [
    a,
    { uuid: "Actor.loser", type: "agent", isOwner: true, name: "Loser", system: {} },
    { uuid: "Actor.other", type: "agent", isOwner: true, name: "Other", system: {} }
  ];
  draw = async () => {};
  mode = "normal";
  return a;
}
function source(a, id = "source") {
  const b = {
      actorUuid: a.uuid,
      checkKind: "skill",
      skillKey: "sleightOfHand",
      checkId: "feint",
      checkMethod: "roll",
      resolved: true,
      successConfirmed: true,
      criticalSuccess: true,
      rawTotal: 20,
      effectiveTotal: 20,
      naturalDie: 20,
      rollData: { total: 0 }
    },
    d = {
      ...b,
      actorUuid: "Actor.loser",
      skillKey: "notice",
      checkId: "resist-feint",
      successConfirmed: false,
      criticalSuccess: false,
      rawTotal: 10,
      effectiveTotal: 10,
      naturalDie: 10
    },
    am = receipt(id, b),
    dm = receipt(id + "Defender", d),
    s = {
      version: 1,
      criticalBenefitVersion: 1,
      criticalAttackBonus: 2,
      winnerUuid: a.uuid,
      loserUuid: "Actor.loser",
      combatId: a.clock.id,
      round: a.clock.round,
      criticalDueRound: a.clock.round + 1,
      sourceMessage: am.uuid,
      defenderMessage: dm.uuid,
      sourceEvidence: [rollEvidence(b), rollEvidence(d)]
    };
  b.feintSettlement = structuredClone(s);
  d.feintSettlement = structuredClone(s);
  return s;
}
const attackOptions = () => ({ attackAction: "standard", targetActorUuid: "Actor.loser" });
test("critical Feint bonus uses the actual opponent through the end of the following round and never stacks or refreshes after use", async () => {
  const a = actor(),
    s = source(a);
  await grantFeintCriticalBonus(a, s);
  for (const round of [3, 4])
    assert.equal(plan(a.system, { targetUuid: "Actor.loser", combat: { ...clock(), round } }).attackBonus, 2);
  for (const patch of [{ round: 2 }, { round: 5 }, { id: "other" }])
    assert.equal(plan(a.system, { targetUuid: "Actor.loser", combat: { ...clock(), ...patch } }).attackBonus, 0);
  assert.equal(plan(a.system, { targetUuid: "Actor.other", combat: clock() }).attackBonus, 0);
  assert.equal(plan(a.system, { targetUuid: "Actor.loser", combat: clock(), defensive: true }).attackBonus, 0);
  const next = source(a, "second");
  await grantFeintCriticalBonus(a, next);
  assert.equal(plan(a.system, { targetUuid: "Actor.loser", combat: clock() }).attackBonus, 2);
  assert.equal(plan(a.system, { targetUuid: "Actor.loser", combat: clock() }).sourceMessages.length, 2);
  a.system.feintBonuses[0].usedBy = "used";
  await grantFeintCriticalBonus(a, s);
  assert.equal(a.system.feintBonuses[0].usedBy, "used");
});
test("malformed source histories and conflicting replay facts require review instead of inventing an available bonus", () => {
  const a = actor(),
    s = source(a),
    r = grant(a.system, s).record;
  for (const patch of [
    { version: 2 },
    { sourceMessage: "" },
    { dueRound: 9 },
    { usedBy: 1 },
    { receiptUuid: "posted" }
  ])
    assert.throws(() => feintBonusRows({ feintBonuses: [{ ...r, ...patch }] }));
  assert.throws(() => grant({ feintBonuses: [r] }, { ...s, loserUuid: "other" }));
  assert.equal(grant({}, { ...s, criticalAttackBonus: 0 }), null);
});
test("real Actor adds2 once, binds actual source proof and leaves other-opponent attacks independent", async () => {
  const a = actor(),
    s = source(a);
  await grantFeintCriticalBonus(a, s);
  const base = a.weaponAttack(a.items[0], { targetActorUuid: "Actor.other" }).total,
    m = await a.rollAttack(a.items[0], attackOptions());
  assert.equal(m.flags.spycraft2.rollData.total, base + 2);
  assert.equal(m.flags.spycraft2.attackContext.feintBonus.attackBonus, 2);
  assert.equal(a.system.feintBonuses[0].receiptUuid, m.uuid);
  const next = await a.rollAttack(a.items[0], attackOptions());
  assert.equal(next.flags.spycraft2.rollData.total, base);
  assert.equal(next.flags.spycraft2.attackContext.feintBonus.attackBonus, 0);
});
test("concurrent attacks share one pending benefit and separate final/base resource queues do not deadlock", async () => {
  const a = actor(),
    s = source(a);
  await grantFeintCriticalBonus(a, s);
  const results = await Promise.allSettled([
    a.rollAttack(a.items[0], attackOptions()),
    a.rollAttack(a.items[0], attackOptions())
  ]);
  assert.equal(
    results.filter(x => x.status === "fulfilled" && x.value.flags.spycraft2.attackContext.feintBonus.attackBonus === 2)
      .length,
    1
  );
  assert.equal(game.messages.filter(m => m.flags.spycraft2.attackContext?.feintBonus?.attackBonus === 2).length, 1);
  const a2 = actor();
  await grantFeintCriticalBonus(a2, source(a2));
  const timeout = new Promise((_, reject) => setTimeout(() => reject(Error("Nested resource deadlock")), 1000));
  const m = await Promise.race([queueResources([a2], () => a2.rollAttack(a2.items[0], attackOptions())), timeout]);
  assert.equal(m.flags.spycraft2.attackContext.feintBonus.attackBonus, 2);
});
test("unposted failure, cancellation and source/target/round drift refund only this attack, while committed posting errors stay spent", async () => {
  for (const kind of ["before", "after", "cancel", "source", "target", "round"]) {
    const a = actor();
    await grantFeintCriticalBonus(a, source(a));
    mode = ["before", "after"].includes(kind) ? kind : "normal";
    if (kind === "cancel") {
      const old = foundry.applications.api.DialogV2.input;
      foundry.applications.api.DialogV2.input = async () => null;
      assert.equal(await a.rollAttack(a.items[0], { askContext: true }), null);
      foundry.applications.api.DialogV2.input = old;
    } else {
      if (kind === "source")
        draw = async () => {
          game.messages[0].flags.spycraft2.criticalSuccess = false;
        };
      if (kind === "round")
        draw = async () => {
          a.clock.round = 5;
        };
      const request = attackOptions();
      if (kind === "target")
        draw = async () => {
          request.targetActorUuid = "Actor.other";
        };
      const result = await Promise.allSettled([a.rollAttack(a.items[0], request)]);
      assert.equal(result[0].status, kind === "after" ? "fulfilled" : "rejected", kind);
    }
    assert.equal(a.system.feintBonuses[0].usedBy != null, kind === "after", kind);
    assert.equal(a.system.feintBonuses[0].receiptUuid != null, kind === "after", kind);
  }
});
test("current owned original replacement keeps the spent bonus without another grant and rejects foreign or changed source proofs", async () => {
  const a = actor();
  await grantFeintCriticalBonus(a, source(a));
  const original = await a.rollAttack(a.items[0], attackOptions()),
    c = original.flags.spycraft2,
    p = c.attackContext.feintBonus;
  const replacement = await a.rollCheck(c.formula, c.rollData, { ...c, rerollOf: original.uuid });
  assert.equal(replacement.flags.spycraft2.attackContext.feintBonus.attackBonus, 2);
  assert.equal(a.system.feintBonuses[0].receiptUuid, original.uuid);
  for (const patch of [{ actorUuid: "foreign" }, { resolved: true }, { superseded: "other" }]) {
    const saved = structuredClone(original.flags.spycraft2);
    Object.assign(original.flags.spycraft2, patch);
    assert.throws(() =>
      validateFeintAttackBonusProof(a, p, {
        checkKind: "attack",
        attackContext: c.attackContext,
        rerollOf: original.uuid
      })
    );
    original.flags.spycraft2 = saved;
  }
  assert.equal(a.system.feintBonuses.length, 1);
});

test("GC review retains posted attempts or releases only a confirmed missing receipt without extending its original deadline", async () => {
  const { reviewFeintBonuses } = await import("../module/apps/feint-bonus.mjs"),
    a = actor();
  await grantFeintCriticalBonus(a, source(a));
  const m = await a.rollAttack(a.items[0], attackOptions()),
    attemptId = a.system.feintBonuses[0].usedBy;
  a.system.feintBonuses[0].receiptUuid = null;
  const seen = game.messages.length;
  await assert.rejects(reviewFeintBonuses(a, { attemptId, confirmed: false }));
  assert.equal((await reviewFeintBonuses(a, { attemptId, confirmed: true })).receiptUuid, m.uuid);
  assert.equal(game.messages.length, seen);
  const b = actor();
  await grantFeintCriticalBonus(b, source(b));
  b.system.feintBonuses[0].usedBy = "interrupted";
  b.clock.round = 5;
  const result = await reviewFeintBonuses(b, { attemptId: "interrupted", confirmed: true });
  assert.equal(result.released, true);
  assert.equal(b.system.feintBonuses[0].usedBy, null);
  assert.equal(b.system.feintBonuses[0].dueRound, 4);
  assert.equal(plan(b.system, { targetUuid: "Actor.loser", combat: b.clock }).attackBonus, 0);
});
test("replacement preserves a spent bonus after its original deadline, while modern zero-source attacks cannot gain a later grant", async () => {
  const a = actor();
  await grantFeintCriticalBonus(a, source(a));
  const original = await a.rollAttack(a.items[0], attackOptions()),
    c = original.flags.spycraft2;
  a.clock.round = 5;
  const m = await a.rollCheck(c.formula, c.rollData, { ...c, rerollOf: original.uuid });
  assert.equal(m.flags.spycraft2.rollData.total, c.rollData.total);
  original.flags.spycraft2.resolved = true;
  original.flags.spycraft2.superseded = m.uuid;
  const second = await a.rollCheck(m.flags.spycraft2.formula, m.flags.spycraft2.rollData, {
    ...m.flags.spycraft2,
    rerollOf: m.uuid
  });
  assert.equal(second.flags.spycraft2.attackContext.feintBonus.attackBonus, 2);
  const b = actor(),
    zero = await b.rollAttack(b.items[0], attackOptions());
  await grantFeintCriticalBonus(b, source(b));
  b.clock.round = 4;
  const z = await b.rollCheck(zero.flags.spycraft2.formula, zero.flags.spycraft2.rollData, {
    ...zero.flags.spycraft2,
    rerollOf: zero.uuid
  });
  assert.equal(z.flags.spycraft2.attackContext.feintBonus.attackBonus, 0);
  assert.equal(b.system.feintBonuses[0].usedBy, null);
});

test("malformed pending history blocks an attack with a review reason while preserving readable weapon-sheet previews", () => {
  const a = actor();
  a.system.feintBonuses = [{ version: 99 }];
  const preview = a.weaponAttack(a.items[0], attackOptions());
  assert.equal(preview.blocked, true);
  assert.match(preview.reason, /Review/);
  assert.equal(preview.feintBonus.attackBonus, 0);
});
