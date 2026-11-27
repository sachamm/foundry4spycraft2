import test from "node:test";
import assert from "node:assert/strict";
import {
  acquireDamageHit,
  validateDamageHit,
  damageHitCount,
  assertDamageNotStarted,
  reviewDamageHits,
  rememberDamageBoost
} from "../module/documents/actor/damage-hits.mjs";
import {
  beginDamageApplication,
  finishDamageApplication,
  recordDamageComponent,
  damageApplicationUndo,
  setDamageUndo,
  reviewDamageApplication
} from "../module/documents/actor/damage-applications.mjs";

let serial = 0,
  actor,
  source,
  cards;
function set(object, path, value) {
  const keys = path.split(".");
  for (const key of keys.slice(0, -1)) object = object[key] ??= {};
  const key = keys.at(-1);
  if (key.startsWith("-=")) {
    delete object[key.slice(2)];
    return;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    object[key] ??= {};
    for (const [child, entry] of Object.entries(value)) set(object[key], child, entry);
  } else object[key] = structuredClone(value);
}
function setup() {
  cards = [];
  actor = {
    uuid: "Actor.pc",
    isOwner: true,
    flags: {},
    async update(data) {
      for (const [key, value] of Object.entries(data)) set(this, key, value);
    }
  };
  source = {
    id: "attack",
    uuid: "ChatMessage.attack",
    flags: {
      spycraft2: {
        checkKind: "attack",
        damageHitsVersion: 1,
        actorUuid: actor.uuid,
        weaponUuid: "Actor.pc.Item.weapon",
        effectiveTotal: 25,
        successConfirmed: true,
        attackContext: { ranged: true },
        attackResolution: { targetUuid: "Actor.npc", hit: true, hits: 2, total: 25, defense: 15 }
      }
    }
  };
  globalThis.game = { user: { isGM: true }, messages: cards, settings: { get: () => ({}) } };
  globalThis.foundry = { utils: { randomID: () => `id${++serial}` } };
  globalThis.fromUuid = async uuid => (uuid === source.uuid ? source : uuid === actor.uuid ? actor : null);
  globalThis.Roll = { fromJSON: JSON.parse };
  globalThis.ChatMessage = {
    getSpeaker: () => ({}),
    create: async data => {
      const card = { ...data, id: `card${++serial}`, uuid: `ChatMessage.card${serial}` };
      cards.push(card);
      return card;
    }
  };
}
const context = () => ({
  actor,
  checkKind: "damage",
  weaponUuid: "Actor.pc.Item.weapon",
  phase: "before",
  options: { sourceAttack: { uuid: source.uuid } }
});
const claim = () => actor.flags.spycraft2.attackDamageHits.attack.slots.at(-1);
async function roll(ctx, { post = true, lostResponse = false } = {}) {
  return acquireDamageHit(ctx)(async extra => {
    const inner = { ...ctx, options: { ...ctx.options, ...extra } };
    assert.equal(acquireDamageHit(inner), null);
    await validateDamageHit(inner);
    await validateDamageHit({ ...inner, phase: "after" });
    const check = { checkKind: "damage", actorUuid: actor.uuid, sourceAttack: extra.sourceAttack, effectiveTotal: 9 };
    await extra.recordRolledResult({
      check,
      roll: { toJSON: () => ({ formula: "1d6+3", total: 9 }) },
      alternativeRolls: []
    });
    if (!post) throw Error("posting failed");
    const card = await ChatMessage.create({
      flags: { spycraft2: check },
      rolls: [{ toJSON: () => ({ formula: "1d6+3", total: 9 }) }]
    });
    if (lostResponse) throw Error("lost chat response");
    return card;
  });
}

test("actual hit ordinals survive deleted chat and reject extra damage rolls", async () => {
  setup();
  const first = await roll(context());
  assert.equal(first.flags.spycraft2.sourceAttack.hitIndex, 1);
  cards.length = 0;
  const second = await roll(context());
  assert.equal(second.flags.spycraft2.sourceAttack.hitIndex, 2);
  assert.equal(damageHitCount(actor, source), 2);
  await assert.rejects(roll(context()), /Every hit/);
  assert.throws(() => assertDamageNotStarted(actor, source), /Damage already started/);
});

test("lost successful chat response reconciles the original card once", async () => {
  setup();
  const card = await roll(context(), { lostResponse: true });
  assert.equal(cards.length, 1);
  assert.equal(claim().state, "posted");
  assert.equal(claim().messageUuid, card.uuid);
});

test("recorded critical activation and a legal damage boost survive restored cards", async () => {
  setup();
  source.flags.spycraft2.criticalSuccess = true;
  source.flags.spycraft2.criticalActivation = { baseCost: 2 };
  const card = await roll(context());
  source.flags.spycraft2.criticalActivation.baseCost = 9;
  assert.equal(card.flags.spycraft2.sourceAttack.criticalSource.criticalActivation.baseCost, 2);
  const next = { ...card.flags.spycraft2, effectiveTotal: 13, boostSpent: 1, boostTotal: 4 };
  await rememberDamageBoost(actor, card, next);
  const id = claim().claimId;
  cards.length = 0;
  await reviewDamageHits(actor, source, { restoreClaimId: id });
  assert.equal(cards[0].flags.spycraft2.effectiveTotal, 13);
  assert.equal(cards[0].flags.spycraft2.boostSpent, 1);
});

test("failed chat posting retains actual dice and restores without another roll", async () => {
  setup();
  await assert.rejects(roll(context(), { post: false }), /posting failed/);
  const saved = structuredClone(claim());
  assert.equal(saved.state, "rolled");
  await reviewDamageHits(actor, source, { restoreClaimId: saved.claimId });
  assert.equal(cards.length, 1);
  assert.deepEqual(cards[0].rolls, [{ formula: "1d6+3", total: 9 }]);
  await reviewDamageHits(actor, source, { restoreClaimId: saved.claimId });
  assert.equal(cards.length, 1);
  assert.equal(damageHitCount(actor, source), 1);
});

test("known pre-roll cancellation frees a slot; interrupted RNG never does", async () => {
  setup();
  await acquireDamageHit(context())(async () => null);
  assert.equal(claim().state, "cancelled");
  await assert.rejects(
    acquireDamageHit(context())(async extra => {
      await validateDamageHit({ ...context(), options: { ...extra } });
      throw Error("unknown dice");
    }),
    /unknown dice/
  );
  assert.equal(claim().state, "needsReview");
  const id = claim().claimId;
  await assert.rejects(reviewDamageHits(actor, source, { restoreClaimId: id }), /no saved actual result/);
  await reviewDamageHits(actor, source, { consumeClaimId: id });
  assert.equal(claim().state, "consumed");
  assert.equal((await roll(context())).flags.spycraft2.sourceAttack.hitIndex, 2);
});

test("forged leases and changed attack facts cannot roll a reserved hit", async () => {
  setup();
  await assert.rejects(
    validateDamageHit({ ...context(), options: { ...context().options, damageHitLease: {} } }),
    /original damage roll/
  );
  await assert.rejects(
    acquireDamageHit(context())(async extra => {
      source.flags.spycraft2.attackResolution.hits = 1;
      await validateDamageHit({ ...context(), options: { ...extra } });
    }),
    /history changed/
  );
});

test("older attacks require an explicit reviewed consumed-hit history", async () => {
  setup();
  delete source.flags.spycraft2.damageHitsVersion;
  await assert.rejects(roll(context()), /older attack/);
  await reviewDamageHits(actor, source, { legacyUsed: 1 });
  assert.equal((await roll(context())).flags.spycraft2.sourceAttack.hitIndex, 2);
  await assert.rejects(roll(context()), /Every hit/);
});

const damageCheck = () => ({
  actorUuid: "Actor.other",
  effectiveTotal: 9,
  sourceAttack: { claimId: "actualhit", hitIndex: 1, uuid: "ChatMessage.other" }
});
const input = () => ({ targetUuid: actor.uuid, damage: 9, kind: "lethal" });

test("concurrent and restored damage cards share one target-held application receipt", async () => {
  setup();
  const results = await Promise.allSettled([
    beginDamageApplication(actor, damageCheck(), "card1", input()),
    beginDamageApplication(actor, damageCheck(), "card2", input())
  ]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  const lease = results.find(r => r.status === "fulfilled").value;
  await finishDamageApplication(lease, true);
  await assert.rejects(beginDamageApplication(actor, damageCheck(), "restored", input()), /already reached/);
});

test("failed application remains held for review; only completed Undo enables the same hit again", async () => {
  setup();
  const lease = await beginDamageApplication(actor, damageCheck(), "card1", input());
  await finishDamageApplication(lease, false);
  await assert.rejects(beginDamageApplication(actor, damageCheck(), "card2", input()), /pending damage application/);
  await assert.rejects(setDamageUndo(actor, damageApplicationUndo(lease), "undone"), /before Undo/);
  await finishDamageApplication(lease, true);
  const receipt = damageApplicationUndo(lease);
  await actor.update({ [`flags.spycraft2.damageApplications.${receipt.key}.lethalPlan`]: { woundLoss: 3 } });
  await setDamageUndo(actor, receipt, "undoing");
  await assert.rejects(beginDamageApplication(actor, damageCheck(), "card3", input()), /pending damage application/);
  await setDamageUndo(actor, receipt, "undone");
  const retry = await beginDamageApplication(actor, damageCheck(), "card4", input());
  assert.equal(actor.flags.spycraft2.damageApplications[receipt.key].lethalPlan, undefined);
  assert.notEqual(damageApplicationUndo(retry).attempt, receipt.attempt);
  await assert.rejects(setDamageUndo(actor, receipt, "undone"), /before Undo/);
});

test("damage application freezes its result but permits another target", async () => {
  setup();
  assert.throws(
    () =>
      assertDamageNotStarted(actor, {
        flags: { spycraft2: { checkKind: "damage", damageApplicationStarted: { targetUuid: actor.uuid } } }
      }),
    /Damage already started/
  );
  await beginDamageApplication(actor, damageCheck(), "card1", input());
  const other = { ...actor, uuid: "Actor.otherTarget", flags: {}, _actionDieQueue: undefined };
  await beginDamageApplication(other, damageCheck(), "card1", { ...input(), targetUuid: other.uuid });
});

test("GC review cannot release a compound hit with an already delivered component", async () => {
  setup();
  const lease = await beginDamageApplication(actor, damageCheck(), "card1", input());
  await recordDamageComponent(lease, "flash");
  await recordDamageComponent(lease, "flash", { uuid: "ChatMessage.originalFlash" });
  await recordDamageComponent(lease, "bang");
  await finishDamageApplication(lease, false);
  const { key } = damageApplicationUndo(lease);
  await assert.rejects(
    reviewDamageApplication(actor, key, {
      decision: "release",
      note: "The second save was cancelled",
      confirmedNoEffects: true
    }),
    /Only a verified/
  );
  await reviewDamageApplication(actor, key, {
    decision: "keep",
    note: "First save kept; remaining effect resolved manually"
  });
  assert.equal(actor.flags.spycraft2.damageApplications[key].components.flash.messageUuid, "ChatMessage.originalFlash");
});

test("GC review requires a note and cannot release positive health or Undo evidence", async () => {
  setup();
  const lease = await beginDamageApplication(actor, damageCheck(), "card1", input());
  await finishDamageApplication(lease, false);
  const { key } = damageApplicationUndo(lease);
  await assert.rejects(
    reviewDamageApplication(actor, key, { decision: "release", confirmedNoEffects: true }),
    /record what actually/
  );
  game.user.isGM = false;
  await assert.rejects(
    reviewDamageApplication(actor, key, { decision: "keep", note: "Actual effects reviewed" }),
    /GC must/
  );
  game.user.isGM = true;
  await reviewDamageApplication(actor, key, {
    decision: "release",
    note: "No RNG or writes occurred",
    confirmedNoEffects: true
  });
  const next = await beginDamageApplication(actor, damageCheck(), "card2", input());
  await finishDamageApplication(next, false, { lethalPlan: { woundLoss: 3 } });
  await assert.rejects(
    reviewDamageApplication(actor, key, {
      decision: "release",
      note: "Health already changed",
      confirmedNoEffects: true
    }),
    /Only a verified/
  );
  await reviewDamageApplication(actor, key, { decision: "keep", note: "Kept the actual health change" });
  assert.equal(actor.flags.spycraft2.damageApplications[key].state, "complete");
});
