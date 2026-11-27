import test from "node:test";
import assert from "node:assert/strict";
import {
  attackDamageBasis,
  newDamageHitLedger,
  reserveDamageHit,
  damageHitClaim,
  damageHitsStarted,
  damageApplicationKey,
  damageApplicationSignature
} from "../module/rules/attack-damage-hits.mjs";
import { criticalDamageDefaults } from "../module/rules/damage-application.mjs";

const source = () => ({
  actorUuid: "Actor.pc",
  weaponUuid: "Actor.pc.Item.weapon",
  checkKind: "attack",
  effectiveTotal: 25,
  successConfirmed: true,
  attackContext: { ranged: true, fireAction: { action: "twoShotBurst" } },
  attackResolution: { targetUuid: "Actor.npc", hit: true, hits: 2, total: 25, defense: 15, cover: null }
});
const basis = check => attackDamageBasis(check, { actorUuid: "Actor.pc", weaponUuid: "Actor.pc.Item.weapon" });

test("each actual attack hit reserves one damage roll, including pending and missing deliveries", () => {
  const b = basis(source()),
    first = reserveDamageHit(newDamageHitLedger(b), b, "first"),
    second = reserveDamageHit(first, b, "second");
  assert.equal(first.slots[0].index, 1);
  assert.equal(second.slots[1].index, 2);
  assert.throws(() => reserveDamageHit(second, b, "third"), /Every hit/);
  for (const state of ["started", "rolled", "posted", "needsReview", "consumed"]) {
    const saved = structuredClone(second);
    saved.slots[0].state = state;
    assert.throws(() => reserveDamageHit(saved, b, "another"), /Every hit/);
    assert.equal(damageHitsStarted(saved), true);
  }
  assert.throws(() => reserveDamageHit(first, b, "first"), /original damage roll/);
});

test("only a known unrolled cancellation releases a hit; a new reservation gets a new identity", () => {
  const b = basis(source()),
    first = reserveDamageHit(newDamageHitLedger(b), b, "cancelled");
  first.slots[0].state = "cancelled";
  assert.equal(damageHitsStarted(first), false);
  const next = reserveDamageHit(first, b, "actual");
  assert.equal(next.slots[1].index, 1);
  assert.equal(damageHitClaim(next, b, { claimId: "actual", hitIndex: 1 }).state, "reserved");
  assert.throws(() => damageHitClaim(next, b, { claimId: "cancelled", hitIndex: 1 }));
  assert.throws(() => damageHitClaim(next, b, { claimId: "actual", hitIndex: 2 }));
});

test("damage cannot silently use a different weapon, target, count or unresolved NPC reaction", () => {
  const s = source(),
    b = basis(s),
    ledger = newDamageHitLedger(b);
  for (const change of [
    { weaponUuid: "other" },
    { superseded: true },
    { npcDefensePending: {} },
    { successConfirmed: false }
  ])
    assert.throws(() => basis({ ...s, ...change }));
  const changed = basis({ ...s, attackResolution: { ...s.attackResolution, targetUuid: "Actor.other" } });
  assert.throws(() => reserveDamageHit(ledger, changed, "next"), /history changed/);
  assert.throws(() => basis({ ...s, attackResolution: { ...s.attackResolution, total: 24 } }));
});

test("legacy consumed hits remain occupied even after their cards are deleted", () => {
  const b = basis(source()),
    ledger = newDamageHitLedger(b, { legacyUsed: 1 }),
    next = reserveDamageHit(ledger, b, "second");
  assert.equal(next.slots[0].index, 2);
  assert.throws(() => reserveDamageHit(next, b, "third"));
  assert.throws(() => newDamageHitLedger(b, { legacyUsed: 3 }));
});

test("a restored card has the same per-target hit identity and input fingerprint without reusing another hit", () => {
  const check = {
      actorUuid: "Actor.pc",
      effectiveTotal: 7,
      sourceAttack: { uuid: "ChatMessage.attack", claimId: "first", hitIndex: 1 }
    },
    input = { targetUuid: "Actor.target", damage: 7, kind: "lethal", attackKind: "ranged" };
  assert.equal(damageApplicationKey(check, "oldCard"), damageApplicationKey(check, "restoredCard"));
  assert.notEqual(
    damageApplicationKey(check, "oldCard"),
    damageApplicationKey(
      { ...check, sourceAttack: { ...check.sourceAttack, claimId: "second", hitIndex: 2 } },
      "oldCard"
    )
  );
  assert.equal(
    damageApplicationSignature(check, input),
    damageApplicationSignature(structuredClone(check), structuredClone(input))
  );
  assert.notEqual(
    damageApplicationSignature(check, input),
    damageApplicationSignature(check, { ...input, critical: true })
  );
  assert.notEqual(damageApplicationKey({}, "oldCard"), damageApplicationKey({}, "otherCard"));
});

test("the first numbered hit retains critical damage when later hits are applied first", () => {
  const attack = { criticalSuccess: true, criticalActivation: { baseCost: 2 }, attackResolution: { hits: 2 } };
  assert.equal(criticalDamageDefaults(attack, "second", { hitIndex: 2 }).critical, false);
  assert.equal(criticalDamageDefaults(attack, "first", { hitIndex: 1 }).critical, true);
  attack.criticalShotApplied = { damageMessageId: "second" };
  assert.equal(criticalDamageDefaults(attack, "first", { hitIndex: 1 }).critical, true);
  assert.equal(criticalDamageDefaults(attack, "second", { hitIndex: 2 }).critical, false);
});
