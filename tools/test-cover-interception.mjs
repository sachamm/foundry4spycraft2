import test from "node:test";
import assert from "node:assert/strict";
import {
  coverInterceptionBasis,
  coverInterceptionPlan,
  coveredAttackOutcome,
  validateCoverAttack
} from "../module/rules/cover-interception.mjs";
import {
  attackDamageBasis,
  newDamageHitLedger,
  reserveDamageHit,
  damageHitClaim
} from "../module/rules/attack-damage-hits.mjs";
import { assertDamageNotStarted } from "../module/documents/actor/damage-hits.mjs";
import { attackOutcome, attackResolutionNote } from "../module/rules/damage-application.mjs";
import {
  beginNpcHitDefense,
  npcHitDefenseOutcome,
  npcHitDefenseCanBenefit,
  addNpcHitDefenseDie
} from "../module/rules/gc/post-hit-defense.mjs";

const attack = (total = 16, fireAction = null) => ({
  checkKind: "attack",
  actorUuid: "Actor.attacker",
  weaponUuid: "Actor.attacker.Item.weapon",
  effectiveTotal: total,
  rawTotal: total,
  naturalDie: 10,
  attackContext: { fireAction }
});
const basis = (check = attack(), grade = 3) =>
  coverInterceptionBasis(check, {
    attackUuid: "ChatMessage.attack",
    targetUuid: "Actor.target",
    baseDefense: 12,
    grade
  });
const row = (index, result = "penetrated", originalDamage = 10, remainingDamage = 6) => ({
  damageUuid: "ChatMessage.damage" + index,
  originalDamage,
  result,
  remainingDamage,
  note: "GC reviewed original cover selection and save"
});
const plan = (b, rows) => coverInterceptionPlan(b, rows, { id: "cover-review", confirmed: true });

test("partial cover intercepts an otherwise successful shot and total cover intercepts even a covered-Defense hit", () => {
  assert.equal(basis().interceptedHits, 1);
  const total = basis(attack(30), 4);
  assert.equal(total.directHits, 0);
  assert.equal(total.interceptedHits, 1);
  const held = coveredAttackOutcome(plan(total, [row(1, "held", 10, 0)]));
  assert.equal(held.hit, false);
  assert.equal(held.damage.length, 0);
  const through = coveredAttackOutcome(plan(total, [row(1)]));
  assert.equal(through.hit, true);
  assert.equal(through.damage[0].amount, 6);
});

test("a burst may hit directly with one shot while other shots intercept partial cover", () => {
  const b = basis(attack(23, { action: "burst" }), 3);
  assert.deepEqual([b.potentialHits, b.directHits, b.interceptedHits], [3, 2, 1]);
  const record = plan(b, [row(1, "direct", 10, 10), row(2, "direct", 11, 11), row(3, "held", 12, 0)]);
  assert.equal(coveredAttackOutcome(record).hits, 2);
  const raised = coveredAttackOutcome(record, { defense: 15 });
  assert.deepEqual(raised.needsCoverReview, [2]);
  assert.equal(raised.damage[0].amount, 10);
  assert.equal(record.rows[1].originalDamage, 11);
});

test("unreviewed saves stay pending; a Triumph's critical remains on cover and never transfers automatically", () => {
  const b = basis(attack(75), 4),
    record = plan(b, [row(1, "unreviewed", 10, 0)]);
  const pending = coveredAttackOutcome(record);
  assert.deepEqual(pending.needsCoverReview, [1]);
  assert.equal(pending.targetCriticalAllowed, false);
  const held = coveredAttackOutcome(plan(b, [row(1, "held", 10, 0)]));
  assert.equal(held.checkSucceeded, true);
  assert.equal(held.hit, false);
  const through = coveredAttackOutcome(plan(b, [row(1)]));
  assert.equal(through.hit, true);
  assert.equal(through.targetCriticalAllowed, false);
  const exposed = basis(attack(75, { action: "burst" }), 3);
  assert.equal(exposed.coverCritical, false, "direct shots through partial cover retain their own critical scope");
});

test("invalid or reused damage, fabricated remaining totals and changed original attacks are refused", () => {
  const b = basis(),
    check = attack(),
    record = plan(b, [row(1)]);
  assert.equal(validateCoverAttack(check, record), true);
  check.effectiveTotal++;
  assert.throws(() => validateCoverAttack(check, record), /original attack changed/);
  for (const extra of [
    { remainingDamage: 11 },
    { remainingDamage: -1 },
    { remainingDamage: 0.5 },
    { result: "held", remainingDamage: 1 },
    { note: "" },
    { damageUuid: "" }
  ])
    assert.throws(() => plan(b, [{ ...row(1), ...extra }]));
  assert.throws(() => plan(basis(attack(23, { action: "burst" }), 4), [row(1), row(1), row(3)]));
  assert.throws(() => plan({ ...b, grade: 4 }, [row(1)]), /does not match/);
  assert.throws(() => plan({ ...b, sourceEvidence: "not an original roll" }, [row(1)]), /original attack evidence/);
});

test("all four cover grades preserve the uncovered-hit boundary and total-cover penetration requirement", () => {
  for (const grade of [1, 2, 3, 4]) {
    const miss = basis(attack(11), grade),
      intercept = basis(attack(12), grade),
      edge = basis(attack(12 + grade * 2), grade);
    assert.deepEqual([miss.potentialHits, miss.interceptedHits], [0, 0]);
    assert.deepEqual([intercept.potentialHits, intercept.directHits, intercept.interceptedHits], [1, 0, 1]);
    assert.deepEqual([edge.directHits, edge.interceptedHits], grade === 4 ? [0, 1] : [1, 0]);
  }
});

test("pending cover uses one reserved damage result per potential shot and retains its ledger after adjudication", () => {
  const check = attack(23, { action: "burst" }),
    b = basis(check, 3);
  check.coverAwaiting = { version: 1, id: "original-cover", basis: b };
  const original = attackDamageBasis(check, { actorUuid: check.actorUuid, weaponUuid: check.weaponUuid });
  let ledger = newDamageHitLedger(original);
  for (let i = 1; i <= 3; i++) ledger = reserveDamageHit(ledger, original, "actual-shot-" + i);
  assert.throws(() => reserveDamageHit(ledger, original, "replacement"), /Every hit/);
  check.resolved = true;
  check.successConfirmed = false;
  check.attackResolution = { hit: false, hits: 0 };
  check.coverInterception = { state: "complete" };
  const after = attackDamageBasis(check, { actorUuid: check.actorUuid, weaponUuid: check.weaponUuid });
  assert.deepEqual(after, original);
  assert.equal(damageHitClaim(ledger, after, { claimId: "actual-shot-2", hitIndex: 2 }).index, 2);
  check.effectiveTotal++;
  assert.throws(
    () => attackDamageBasis(check, { actorUuid: check.actorUuid, weaponUuid: check.weaponUuid }),
    /original attack changed/
  );
});

test("damage frozen for actual cover saves cannot be boosted or replaced as an ordinary unused damage result", () => {
  assert.throws(
    () =>
      assertDamageNotStarted(
        {},
        { flags: { spycraft2: { checkKind: "damage", coverDamageFrozen: { id: "original-cover" } } } }
      ),
    /Damage already started/
  );
});

test("an attack Triumph remains a hit above ordinary Defense while total cover still intercepts it", () => {
  for (const fireAction of [
    null,
    { action: "burst" },
    { action: "twoShotBurst" },
    { action: "autofire", volleys: 3 }
  ]) {
    assert.deepEqual(attackOutcome({ total: 75, defense: 100, fireAction }), { hit: true, margin: -25, hits: 1 });
    assert.equal(attackOutcome({ total: 74, defense: 100, fireAction }).hit, false);
  }
  const check = attack(75);
  const partial = coverInterceptionBasis(check, {
    attackUuid: "ChatMessage.attack",
    targetUuid: "Actor.target",
    baseDefense: 100,
    grade: 3
  });
  const total = coverInterceptionBasis(check, {
    attackUuid: "ChatMessage.attack",
    targetUuid: "Actor.target",
    baseDefense: 100,
    grade: 4
  });
  assert.deepEqual([partial.directHits, partial.interceptedHits], [1, 0]);
  assert.deepEqual([total.directHits, total.interceptedHits], [0, 1]);
  assert.equal(coveredAttackOutcome(plan(total, [row(1, "held", 10, 0)])).hit, false);
  assert.match(
    attackResolutionNote({
      ...check,
      attackResolution: { targetName: "Target", defense: 100, hit: true, margin: -25, hits: 1 }
    }),
    /Triumph/
  );
});

test("NPC Defense reviews accept a Triumph below Defense and can reduce extra shots without removing its critical hit", () => {
  const check = attack(80, { action: "burst" });
  const start = defense =>
    beginNpcHitDefense(
      check,
      {
        targetUuid: "Actor.target",
        defense,
        total: 80,
        ...attackOutcome({ total: 80, defense, fireAction: { action: "burst" } })
      },
      { id: "review", attackerUuid: check.actorUuid, targetUuid: "Actor.target", session: "session", scene: "scene" }
    );
  const single = start(100);
  assert.equal(npcHitDefenseOutcome(single, check).hit, true);
  assert.equal(npcHitDefenseCanBenefit(single, check), false);
  const multiple = start(60);
  assert.equal(npcHitDefenseCanBenefit(multiple, check), true);
  const boosted = addNpcHitDefenseDie(multiple, check, {
    id: "defense-one",
    sourceUuid: "ChatMessage.defense-one",
    die: 12,
    rolls: [11],
    total: 11
  });
  assert.equal(npcHitDefenseOutcome(boosted, check).hits, 2);
  const final = addNpcHitDefenseDie(boosted, check, {
    id: "defense-two",
    sourceUuid: "ChatMessage.defense-two",
    die: 12,
    rolls: [10],
    total: 10
  });
  assert.equal(npcHitDefenseOutcome(final, check).hits, 1);
  assert.equal(npcHitDefenseCanBenefit(final, check), false);
});
