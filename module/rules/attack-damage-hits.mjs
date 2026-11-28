import { sameValues } from "./equal.mjs";
import { loc } from "../i18n.mjs";
import { validateCoverAttackBasis } from "./cover-interception.mjs";

const identity = value => typeof value === "string" && value.length > 0;
const STATES = new Set(["reserved", "started", "rolled", "posted", "needsReview", "consumed", "cancelled"]);

/** The attack facts a damage roll cannot change after its hit was reserved. Critical activation is separate. */
export function attackDamageBasis(check, { actorUuid, weaponUuid } = {}) {
  const pending = check?.coverAwaiting;
  if (pending) {
    if (
      pending.version !== 1 ||
      !identity(pending.id) ||
      check.superseded ||
      check.criticalFailure ||
      check.successConfirmed !== true ||
      check.npcDefensePending ||
      check.actorUuid !== actorUuid ||
      check.weaponUuid !== weaponUuid ||
      pending.basis?.actorUuid !== actorUuid ||
      pending.basis?.weaponUuid !== weaponUuid ||
      pending.basis?.interceptedHits < 1
    )
      throw Error(loc`Review the original cover interception before rolling its damage.`);
    validateCoverAttackBasis(check, pending.basis);
    const basis = pending.basis;
    return {
      version: 1,
      actorUuid,
      weaponUuid,
      targetUuid: basis.targetUuid,
      total: basis.total,
      defense: basis.baseDefense,
      hits: basis.potentialHits,
      cover: { grade: basis.grade, bonus: basis.grade * 2 },
      ranged: check.attackContext?.ranged === true,
      fireAction: structuredClone(basis.fireAction),
      coverPending: { version: 1, id: pending.id, basis: structuredClone(basis) }
    };
  }
  const r = check?.attackResolution;
  if (
    check?.checkKind !== "attack" ||
    check.actorUuid !== actorUuid ||
    !identity(actorUuid) ||
    !identity(weaponUuid) ||
    check.weaponUuid !== weaponUuid ||
    check.superseded ||
    check.npcDefensePending ||
    check.criticalFailure ||
    check.successConfirmed !== true ||
    r?.hit !== true ||
    !identity(r.targetUuid) ||
    !Number.isSafeInteger(r.hits) ||
    r.hits < 1 ||
    !Number.isFinite(check.effectiveTotal) ||
    r.total !== check.effectiveTotal ||
    !Number.isSafeInteger(r.defense) ||
    r.defense < 0
  )
    throw Error(loc`Resolve the actual successful attack and weapon before rolling damage for its hits.`);
  return {
    version: 1,
    actorUuid,
    weaponUuid,
    targetUuid: r.targetUuid,
    total: r.total,
    defense: r.defense,
    hits: r.hits,
    cover: structuredClone(r.cover ?? null),
    ranged: check.attackContext?.ranged === true,
    fireAction: structuredClone(check.attackContext?.fireAction ?? null)
  };
}

export function newDamageHitLedger(basis, { legacyUsed = 0 } = {}) {
  if (!Number.isSafeInteger(legacyUsed) || legacyUsed < 0 || legacyUsed > basis.hits)
    throw Error(loc`Review how many of this attack's hits already had damage rolled.`);
  return { version: 1, basis: structuredClone(basis), legacyUsed, slots: [] };
}

export function validateDamageHitLedger(ledger, basis) {
  if (
    ledger?.version !== 1 ||
    !sameValues(ledger.basis, basis) ||
    !Array.isArray(ledger.slots) ||
    !Number.isSafeInteger(ledger.legacyUsed) ||
    ledger.legacyUsed < 0 ||
    ledger.legacyUsed > basis.hits
  )
    throw Error(loc`The attack's recorded hit count or damage history changed. Ask the GC to review it.`);
  const claims = new Set(),
    indices = new Set();
  for (const row of ledger.slots) {
    if (
      !identity(row.claimId) ||
      claims.has(row.claimId) ||
      !Number.isSafeInteger(row.index) ||
      row.index <= ledger.legacyUsed ||
      row.index > basis.hits ||
      !STATES.has(row.state) ||
      (row.state !== "cancelled" && indices.has(row.index))
    )
      throw Error(loc`Review the reserved damage hits and their delivery history.`);
    claims.add(row.claimId);
    if (row.state !== "cancelled") indices.add(row.index);
  }
  return ledger;
}

export function reserveDamageHit(ledger, basis, claimId) {
  validateDamageHitLedger(ledger, basis);
  if (!identity(claimId) || ledger.slots.some(row => row.claimId === claimId))
    throw Error(loc`Finish the original damage roll instead of reserving its hit again.`);
  const used = new Set(ledger.slots.filter(row => row.state !== "cancelled").map(row => row.index));
  let index = ledger.legacyUsed + 1;
  while (used.has(index)) index++;
  if (index > basis.hits) throw Error(loc`Every hit of this attack already has a damage roll or a pending delivery.`);
  return {
    ...structuredClone(ledger),
    slots: [...structuredClone(ledger.slots), { claimId, index, state: "reserved" }]
  };
}

export function damageHitClaim(ledger, basis, { claimId, hitIndex }) {
  validateDamageHitLedger(ledger, basis);
  const row = ledger.slots.find(slot => slot.claimId === claimId);
  if (!row || row.index !== hitIndex || row.state === "cancelled")
    throw Error(loc`Use the damage hit reserved by this attack's original roll.`);
  return row;
}

export function damageHitsStarted(ledger) {
  return !!ledger && (ledger.legacyUsed > 0 || ledger.slots?.some(row => row.state !== "cancelled"));
}

/** A restored damage card keeps the same application identity on each actual target. */
export function damageApplicationKey(check, messageId) {
  const id = check?.sourceAttack?.claimId ?? messageId;
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id))
    throw Error(loc`Review the damage card's stable application identity.`);
  return `${check?.sourceAttack?.claimId ? "hit" : "roll"}-${id}`;
}

/** The applied amount and defenses are fixed independently of a chat document's replacement id. */
export function damageApplicationSignature(check, input) {
  return JSON.stringify([
    check.actorUuid,
    check.sourceAttack?.uuid ?? "",
    check.sourceAttack?.claimId ?? "",
    check.sourceAttack?.hitIndex ?? null,
    check.effectiveTotal,
    input.targetUuid,
    input.damage,
    input.kind,
    input.type ?? "",
    input.attackKind,
    input.armorPiercing ?? 0,
    input.armorPiercingAll === true,
    input.critical === true,
    input.criticalDice ?? 0,
    input.blast === true,
    input.juggernaut ?? 0
  ]);
}
