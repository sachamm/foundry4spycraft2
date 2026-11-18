const stable = v =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map(k => [k, x[k]])
        )
      : x
  );
import { validOwnCountClock } from "./own-count-duration.mjs";
export function feintBonusRows(system) {
  const rows = system.feintBonuses ?? [];
  if (!Array.isArray(rows)) throw Error("Review the recorded Feint attack bonuses.");
  const seen = new Set();
  for (const r of rows) {
    if (
      r?.version !== 1 ||
      typeof r.sourceMessage !== "string" ||
      !r.sourceMessage ||
      seen.has(r.sourceMessage) ||
      typeof r.defenderMessage !== "string" ||
      !r.defenderMessage ||
      typeof r.targetUuid !== "string" ||
      !r.targetUuid ||
      typeof r.combatId !== "string" ||
      !r.combatId ||
      !Number.isSafeInteger(r.madeRound) ||
      r.madeRound < 1 ||
      r.dueRound !== r.madeRound + 1 ||
      !Number.isSafeInteger(r.dueRound) ||
      !Array.isArray(r.sourceEvidence) ||
      r.sourceEvidence.length !== 2 ||
      r.sourceEvidence.some(s => typeof s !== "string") ||
      (r.usedBy != null && (typeof r.usedBy !== "string" || !r.usedBy)) ||
      (r.receiptUuid != null && (typeof r.receiptUuid !== "string" || !r.receiptUuid)) ||
      (r.receiptUuid && !r.usedBy)
    )
      throw Error("Review the recorded Feint attack bonuses.");
    seen.add(r.sourceMessage);
  }
  return rows;
}
export function feintBonusGrantPlan(system, settlement) {
  if (settlement.criticalAttackBonus !== 2) return null;
  const rows = feintBonusRows(system),
    record = {
      version: 1,
      sourceMessage: settlement.sourceMessage,
      defenderMessage: settlement.defenderMessage,
      targetUuid: settlement.loserUuid,
      combatId: settlement.combatId,
      madeRound: settlement.round,
      dueRound: settlement.criticalDueRound,
      sourceEvidence: structuredClone(settlement.sourceEvidence),
      usedBy: null,
      receiptUuid: null
    },
    existing = rows.find(r => r.sourceMessage === record.sourceMessage);
  if (existing) {
    const { usedBy, receiptUuid, ...facts } = existing,
      { usedBy: _u, receiptUuid: _r, ...expected } = record;
    if (stable(facts) !== stable(expected))
      throw Error("The recorded Feint attack bonus changed; ask the GC to review its source.");
    return { existing: true, record: existing };
  }
  feintBonusRows({ feintBonuses: [record] });
  return { existing: false, record };
}
export function feintAttackBonusPlan(system, { targetUuid = "", combat = null, proof = null, defensive = false } = {}) {
  const rows = feintBonusRows(system),
    target = typeof targetUuid === "string" && targetUuid ? targetUuid : null,
    empty = {
      version: 1,
      targetUuid: target,
      combatId: combat?.id ?? null,
      attackRound: combat?.round ?? null,
      sourceMessages: [],
      attackBonus: 0
    };
  if (defensive || !target || !validOwnCountClock(combat)) return empty;
  const active = r =>
    r.targetUuid === target && r.combatId === combat.id && combat.round >= r.madeRound && combat.round <= r.dueRound;
  const reserved = proof?.attemptId && rows.some(r => r.usedBy === proof.attemptId),
    selected = rows.filter(r => active(r) && (reserved ? r.usedBy === proof.attemptId : r.usedBy == null));
  return { ...empty, sourceMessages: selected.map(r => r.sourceMessage).sort(), attackBonus: selected.length ? 2 : 0 };
}
export function feintBonusProofFacts(proof) {
  if (!proof) return null;
  const { attemptId, ...facts } = proof;
  return facts;
}
export function assertFeintBonusPlan(system, proof, context) {
  if (!proof) return;
  const expected = feintAttackBonusPlan(system, { ...context, proof });
  if (
    proof.version !== 1 ||
    (proof.attackBonus === 2 && (typeof proof.attemptId !== "string" || !proof.attemptId)) ||
    stable(expected) !== stable(feintBonusProofFacts(proof))
  )
    throw Error("The Feint next-attack bonus, opponent or round changed before posting.");
}

export const feintAttackTarget = options =>
  options.characterTarget?.actorUuid ||
  options.targetActorUuid ||
  options.cheapShot?.targetUuid ||
  options.finalAttack?.opponentUuid ||
  options.finalAttack?.targetUuid ||
  null;
