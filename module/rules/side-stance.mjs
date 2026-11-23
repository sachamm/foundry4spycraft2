import { combatStanceState } from "./combat-stance.mjs";
import { loc } from "../i18n.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { feintAttackTarget } from "./feint-bonus.mjs";
import { stable } from "./equal.mjs";
export function sideStanceRows(system) {
  const rows = system.sideStanceFeints ?? [];
  if (!Array.isArray(rows)) throw Error(loc`Review the recorded Side Stance benefits.`);
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
      throw Error(loc`Review the recorded Side Stance benefits.`);
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
      throw Error(loc`The recorded Side Stance Feint changed; ask the GC to review its source.`);
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
    throw Error(loc`The Side Stance die, successful Feints or actual opponent changed before posting.`);
}
export function sideStanceDefensePenalty(system) {
  return combatStanceState(system)?.key === "side" ? -1 : 0;
}

// Side Stance's pending sneak die as part of an attack plan.
rollPipeline.register({
  id: "sideStanceAttackTerm",
  kinds: ["attack"],
  order: 9060,
  terms({ system, options, ranged }) {
    let plan,
      review = "";
    try {
      plan = sideStanceAttackPlan(system, {
        targetUuid: feintAttackTarget(options),
        proof: options.sideStanceProof,
        defensive: options.disarm?.role === "defender",
        ranged
      });
    } catch (error) {
      review = error.message;
      plan = { version: 1, stanceId: null, targetUuid: feintAttackTarget(options), sourceMessages: [], dice: 0 };
    }
    return {
      key: "sideStance",
      plan,
      blockAt: 70,
      blocked: review,
      noteAt: 90,
      notes: plan.dice
        ? [
            loc`Side Stance: the next attack against a successfully Feinted opponent uses the one pending sneak die; it is spent even if this attack misses. Apply it only with a qualifying successful Standard Attack’s damage (pp.178,339).`
          ]
        : []
    };
  }
});
