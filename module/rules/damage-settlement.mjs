import { rollEvidence } from "./outcomes.mjs";
import { knockoutDuration } from "./damage-application.mjs";
import { loc } from "../i18n.mjs";
import { same } from "./equal.mjs";
export function damageEventEvidence(record) {
  const { state, settlement, ...event } = record;
  return JSON.stringify(event);
}
export function damageSettlementPlan(record, message, { confirmed, selfInflicted, outcomeHandled } = {}, id, at) {
  const check = message?.flags?.spycraft2;
  if (
    confirmed !== true ||
    !check ||
    check.resolved !== true ||
    typeof check.successConfirmed !== "boolean" ||
    check.superseded ||
    !Number.isFinite(check.effectiveTotal)
  )
    throw new Error(loc`Confirm and finish the actual save in chat before settling its damage event.`);
  if (
    check.criticalFailure ||
    (check.criticalSuccess &&
      !(
        check.oneInAMillion === true &&
        check.checkId === "fort" &&
        check.naturalDie === 20 &&
        check.forcedThreat === true
      ))
  )
    throw new Error(loc`Review the unsupported critical result on this save (p.347).`);
  const succeeded = check.successConfirmed,
    expected = check.effectiveTotal >= record.save.dc;
  if (succeeded !== expected)
    throw new Error(
      loc`The confirmed save outcome disagrees with its final result and recorded DC. Correct it before settlement.`
    );
  let grade = 0,
    unconscious = false,
    knockout = null,
    handledByGC = false;
  if (!succeeded) {
    const listed = !record.save.needsOutcomeReview && record.save.tier > 0;
    if (listed && record.kind === "subdual") {
      // A failed subdual save knocks the character out for the band's unit × half the margin (p.339).
      unconscious = true;
      knockout = knockoutDuration(record.save.knockoutBase, record.save.dc, check.effectiveTotal);
    } else if (listed && record.kind === "stress" && record.save.tier <= 4) {
      grade = record.save.tier;
      if (typeof selfInflicted !== "boolean")
        throw new Error(loc`Declare whether this stress source was caused by the character’s own action.`);
    } else if (outcomeHandled === true) handledByGC = true;
    else if (!listed)
      throw new Error(
        loc`The GC must resolve this below-threshold critical failure outcome, then settle it as applied by hand.`
      );
    else throw new Error(loc`Apply the Drained outcome by hand, then settle this save as applied by hand.`);
  }
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(id) || !Number.isFinite(at))
    throw new Error(loc`Review the settlement reference and time.`);
  const applicationId = "damage-" + record.id;
  if (applicationId.length > 80)
    throw new Error(loc`Review the unusually long damage-event reference before applying its condition.`);
  return {
    version: 1,
    id,
    eventId: record.id,
    eventEvidence: damageEventEvidence(record),
    messageId: message.id,
    evidence: rollEvidence(check),
    succeeded,
    grade,
    selfInflicted: grade ? selfInflicted : null,
    applicationId: grade ? applicationId : null,
    // Only present when they apply, so settlements prepared by earlier versions still validate.
    ...(unconscious ? { unconscious, knockout } : {}),
    ...(handledByGC ? { handledByGC } : {}),
    at,
    state: "prepared"
  };
}
export function validateDamageSettlement(record, message, plan) {
  if (
    plan?.version !== 1 ||
    plan.eventId !== record.id ||
    plan.messageId !== message?.id ||
    plan.eventEvidence !== damageEventEvidence(record) ||
    plan.evidence !== rollEvidence(message?.flags?.spycraft2 ?? {})
  )
    throw new Error(
      loc`The prepared damage settlement or finished save changed. The GC must review the actual result and condition before retrying.`
    );
  const expected = damageSettlementPlan(
    record,
    message,
    { confirmed: true, selfInflicted: plan.selfInflicted, outcomeHandled: plan.handledByGC },
    plan.id,
    plan.at
  );
  if (!same(plan, expected)) throw new Error(loc`Review the prepared damage-settlement details.`);
  return plan;
}
