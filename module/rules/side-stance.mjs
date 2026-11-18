import { combatStanceState } from "./combat-stance.mjs";
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
export function sideStanceRows(system) {
  const rows = system.sideStanceFeints ?? [];
  if (!Array.isArray(rows)) throw Error("Review the recorded Side Stance benefits.");
  const seen = new Set();
  for (const r of rows) {
    if (
      r?.version !== 1 ||
      typeof r.sourceMessage !== "string" ||
      !r.sourceMessage ||
      seen.has(r.sourceMessage) ||
      typeof r.defenderMessage !== "string" ||
      !r.defenderMessage ||
      typeof r.stanceId !== "string" ||
      !r.stanceId ||
      typeof r.targetUuid !== "string" ||
      !r.targetUuid ||
      !Array.isArray(r.sourceEvidence) ||
      r.sourceEvidence.length !== 2 ||
      r.sourceEvidence.some(s => typeof s !== "string") ||
      (r.usedBy != null && (typeof r.usedBy !== "string" || !r.usedBy)) ||
      (r.receiptUuid != null && (typeof r.receiptUuid !== "string" || !r.receiptUuid)) ||
      (r.receiptUuid && !r.usedBy)
    )
      throw Error("Review the recorded Side Stance benefits.");
    seen.add(r.sourceMessage);
  }
  return rows;
}
export function sideStanceGrantPlan(system, settlement, feint) {
  const stance = combatStanceState(system),
    original = feint?.combatStance?.stance;
  if (
    !settlement.attackerWon ||
    settlement.sideBenefitVersion !== 1 ||
    feint?.version !== 3 ||
    original?.key !== "side" ||
    original.feat !== "Fencing Basics" ||
    stance?.key !== "side" ||
    stance.id !== original.id
  )
    return null;
  const record = {
      version: 1,
      sourceMessage: settlement.sourceMessage,
      defenderMessage: settlement.defenderMessage,
      stanceId: stance.id,
      targetUuid: settlement.defenderUuid,
      sourceEvidence: structuredClone(settlement.sourceEvidence),
      usedBy: null,
      receiptUuid: null
    },
    rows = sideStanceRows(system),
    existing = rows.find(r => r.sourceMessage === record.sourceMessage);
  if (existing) {
    const { usedBy, receiptUuid, ...facts } = existing,
      { usedBy: _u, receiptUuid: _r, ...expected } = record;
    if (stable(facts) !== stable(expected))
      throw Error("The recorded Side Stance Feint changed; ask the GC to review its source.");
    return { existing: true, record: existing };
  }
  sideStanceRows({ sideStanceFeints: [record] });
  return { existing: false, record };
}
/** One pending die TOTAL. Any qualifying target consumes all pending Feints in this stance. */
export function sideStanceAttackPlan(
  system,
  { targetUuid = "", proof = null, defensive = false, ranged = false } = {}
) {
  const rows = sideStanceRows(system),
    stance = combatStanceState(system),
    id = stance?.key === "side" ? stance.id : null,
    target = typeof targetUuid === "string" && targetUuid ? targetUuid : null,
    empty = { version: 1, stanceId: ranged ? null : id, targetUuid: target, sourceMessages: [], dice: 0 };
  if (ranged || defensive || !id || !target) return empty;
  const reserved = proof?.attemptId && rows.some(r => r.usedBy === proof.attemptId),
    selected = rows.filter(r => r.stanceId === id && (reserved ? r.usedBy === proof.attemptId : r.usedBy == null));
  if (!selected.some(r => r.targetUuid === target)) return empty;
  return { ...empty, sourceMessages: selected.map(r => r.sourceMessage).sort(), dice: 1 };
}
export function assertSideStancePlan(system, proof, context) {
  if (!proof) return;
  const { attemptId, ...facts } = proof,
    expected = sideStanceAttackPlan(system, { ...context, proof });
  if (
    proof.version !== 1 ||
    (proof.dice === 1 && (typeof attemptId !== "string" || !attemptId)) ||
    stable(facts) !== stable(expected)
  )
    throw Error("The Side Stance die, successful Feints or actual opponent changed before posting.");
}
export function sideStanceDefensePenalty(system) {
  return combatStanceState(system)?.key === "side" ? -1 : 0;
}
