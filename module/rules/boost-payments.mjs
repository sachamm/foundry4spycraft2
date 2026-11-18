import { shakenActionDieCost } from "./shaken.mjs";
import { multipartActionDicePlan, paymentIdValid } from "./action-die-payments.mjs";
/** Actor receipts, rather than editable counters on the roll, prove this check's previously paid surcharge. */
export function paidBoostSurcharge(actor, message) {
  let paid = 0;
  const messageUuid = message?.uuid ?? message?.id;
  for (const row of Object.values(actor.flags?.spycraft2?.actionDiePayments ?? {})) {
    if (
      row?.actorUuid !== actor.uuid ||
      row.messageUuid !== messageUuid ||
      row.details?.benefit !== "checkBoost" ||
      !["spent", "reviewed"].includes(row.state) ||
      (row.state === "reviewed" && row.benefitRemains !== true)
    )
      continue;
    const fee = row.details.surcharge,
      base = row.details.boostCount,
      parts = row.allocations;
    if (
      !paymentIdValid(row.id) ||
      !Number.isSafeInteger(fee) ||
      fee < 0 ||
      fee > 2 ||
      !Number.isSafeInteger(base) ||
      base < 0 ||
      (base === 0 &&
        !(
          typeof row.details.generousDonorUuid === "string" &&
          row.details.generousDonorUuid &&
          row.details.generousDonorUuid !== actor.uuid &&
          fee > 0
        )) ||
      !Array.isArray(parts) ||
      parts.some(p => !Number.isSafeInteger(p.count) || p.count < 1 || !["boost", "surcharge"].includes(p.scope)) ||
      parts.filter(p => p.scope === "surcharge").reduce((n, p) => n + p.count, 0) !== fee ||
      parts.filter(p => p.scope === "boost").reduce((n, p) => n + p.count, 0) !== base ||
      row.count !== base + fee
    )
      throw new Error("Review this check’s saved boost-payment evidence.");
    paid += fee;
  }
  if (!Number.isSafeInteger(paid) || paid > 2)
    throw new Error("Review the previously paid boost surcharge for this check.");
  return paid;
}
export function boostPaymentQuote(
  actor,
  message,
  { count = 1, bonusPoolId = "", surchargeBonusPoolId, surchargeAllocations } = {}
) {
  const system = actor.actionDiceFundingSystem,
    cost = shakenActionDieCost(system, { baseCost: count, surchargePaid: paidBoostSurcharge(actor, message) });
  if (cost.blocked) throw new Error(cost.reason);
  const pool = system.bonusActionDice?.[bonusPoolId],
    feeSource =
      surchargeBonusPoolId === undefined || surchargeBonusPoolId === "same"
        ? pool?.unrestricted
          ? bonusPoolId
          : ""
        : surchargeBonusPoolId;
  const allocations = [
    { bonusPoolId, count, scope: "boost" },
    ...boostSurchargeAllocations(cost.surcharge, { surchargeBonusPoolId: feeSource, surchargeAllocations })
  ];
  const payment = multipartActionDicePlan(system, allocations, {
    id: "boostQuote",
    actorUuid: actor.uuid,
    message,
    periods: actor.usagePeriods,
    purpose: "Check boost"
  });
  return { ...cost, allocations, payments: payment.payments };
}
export const boostPaymentSignature = quote =>
  JSON.stringify([quote.grade, quote.totalGrade, quote.surchargePaid, quote.surcharge, quote.payments]);

/** Generous: the receiver pays only their remaining check surcharge; the Pointman supplies the one benefit die. */
export function generousSurchargeQuote(actor, message, { surchargeBonusPoolId = "", surchargeAllocations } = {}) {
  const system = actor.actionDiceFundingSystem;
  if (system.actionDiceSettlementReview?.needsReview || system.actionDieAwardReview?.needsReview)
    throw new Error("Resolve the teammate’s interrupted action-die records before Generous.");
  const cost = shakenActionDieCost(system, { baseCost: 0, surchargePaid: paidBoostSurcharge(actor, message) });
  if (cost.blocked) throw new Error(cost.reason);
  const allocations = boostSurchargeAllocations(cost.surcharge, { surchargeBonusPoolId, surchargeAllocations });
  if (!cost.surcharge) return { ...cost, allocations, payments: [] };
  const payment = multipartActionDicePlan(system, allocations, {
    id: "generousQuote",
    actorUuid: actor.uuid,
    message,
    periods: actor.usagePeriods,
    purpose: "Generous receiver surcharge"
  });
  return { ...cost, allocations, payments: payment.payments };
}

function boostSurchargeAllocations(fee, { surchargeBonusPoolId = "", surchargeAllocations } = {}) {
  if (surchargeAllocations !== undefined && !Array.isArray(surchargeAllocations))
    throw new Error("Choose valid split surcharge contributions.");
  if (surchargeAllocations?.length) {
    if (
      surchargeAllocations.length > 32 ||
      surchargeAllocations.some(p => !Number.isSafeInteger(p?.count) || p.count < 1) ||
      surchargeAllocations.reduce((n, p) => n + p.count, 0) !== fee
    )
      throw new Error(`Surcharge contributions must total the remaining ${fee}-die check fee.`);
    return surchargeAllocations.map(p => ({ bonusPoolId: p.bonusPoolId ?? "", count: p.count, scope: "surcharge" }));
  }
  return fee ? [{ bonusPoolId: surchargeBonusPoolId, count: fee, scope: "surcharge" }] : [];
}
