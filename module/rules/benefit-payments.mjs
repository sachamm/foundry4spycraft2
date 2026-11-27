import { shakenActionDieCost } from "./shaken.mjs";
import { multipartActionDicePlan } from "./action-die-payments.mjs";
import { loc } from "../i18n.mjs";
/** Quote after waivers. Explicit split allocations are for unrolled benefits; rolled benefits retain one primary die source. */
export function actionDieBenefitQuote(
  actor,
  {
    baseCost,
    benefitCount = 1,
    bonusPoolId = "",
    surchargeBonusPoolId = "same",
    purpose = "Action-die benefit",
    allocations,
    surchargeAllocations,
    benefit = "",
    message = null
  } = {}
) {
  if (!Number.isSafeInteger(baseCost) || baseCost < 0)
    throw new Error(loc`Choose a whole nonnegative base action-die cost.`);
  const system = actor.actionDiceFundingSystem;
  if (system.actionDieAwardReview?.needsReview || system.actionDiceSettlementReview?.needsReview)
    throw new Error(loc`Resolve the interrupted action-die records before another benefit.`);
  const cost = shakenActionDieCost(system, { baseCost, benefitCount });
  if (cost.blocked) throw new Error(cost.reason);
  if (allocations !== undefined && !Array.isArray(allocations))
    throw new Error(loc`Choose a valid split action-die payment.`);
  if (surchargeAllocations !== undefined && !Array.isArray(surchargeAllocations))
    throw new Error(loc`Choose valid split surcharge contributions.`);
  if (surchargeAllocations?.length) {
    if (
      surchargeAllocations.length > 32 ||
      surchargeAllocations.some(p => !Number.isSafeInteger(p?.count) || p.count < 1)
    )
      throw new Error(loc`Choose whole positive surcharge contributions.`);
    const total = surchargeAllocations.reduce((n, p) => n + (p?.count ?? NaN), 0);
    if (!Number.isSafeInteger(total) || total !== cost.surcharge)
      throw new Error(loc`Surcharge contributions must total the ${cost.surcharge}-die fee.`);
    if (allocations?.length) throw new Error(loc`Choose either a full split payment or split surcharge contributions.`);
  }
  if (allocations?.length) {
    if (allocations.length > 32 || allocations.some(p => !Number.isSafeInteger(p?.count) || p.count < 1))
      throw new Error(loc`Choose whole positive payment contributions.`);
    const total = allocations.reduce((n, p) => n + (p?.count ?? NaN), 0);
    if (!Number.isSafeInteger(total) || total !== cost.cost)
      throw new Error(loc`Split contributions must total the final ${cost.cost}-die cost.`);
    const restricted = p => system.bonusActionDice?.[p.bonusPoolId]?.source === "favoredGear";
    if (allocations.filter(restricted).reduce((sum, p) => sum + p.count, 0) > baseCost)
      throw Error(loc`Favored Gear dice cannot pay a Shaken surcharge.`);
    const parts = allocations.map(p => ({
        bonusPoolId: p.bonusPoolId ?? "",
        count: p.count,
        scope: benefit === "criticalSuccess" && restricted(p) ? "threat" : "general"
      })),
      payment = multipartActionDicePlan(system, parts, {
        id: "benefitQuote",
        actorUuid: actor.uuid,
        periods: actor.usagePeriods,
        message,
        purpose
      });
    return { ...cost, allocations: parts, payments: payment.payments };
  }
  if (!cost.cost) return { ...cost, allocations: [], payments: [] };
  const feeSource =
    surchargeBonusPoolId === "same" || surchargeBonusPoolId === undefined
      ? system.bonusActionDice?.[bonusPoolId]?.source === "favoredGear"
        ? ""
        : bonusPoolId
      : surchargeBonusPoolId;
  const selected = [
    ...(baseCost
      ? [
          {
            bonusPoolId,
            count: baseCost,
            scope:
              benefit === "criticalSuccess" && system.bonusActionDice?.[bonusPoolId]?.source === "favoredGear"
                ? "threat"
                : "general"
          }
        ]
      : []),
    ...(surchargeAllocations?.length
      ? surchargeAllocations.map(p => ({ bonusPoolId: p.bonusPoolId ?? "", count: p.count, scope: "surcharge" }))
      : cost.surcharge
        ? [{ bonusPoolId: feeSource, count: cost.surcharge, scope: "surcharge" }]
        : [])
  ];
  const payment = multipartActionDicePlan(system, selected, {
    id: "benefitQuote",
    actorUuid: actor.uuid,
    periods: actor.usagePeriods,
    message,
    purpose
  });
  return { ...cost, allocations: selected, payments: payment.payments };
}
