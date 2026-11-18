import { healingPlan } from "./health.mjs";
import { actionDiceFundingContext } from "./bonus-pools.mjs";
import { actionDieBenefitQuote } from "./benefit-payments.mjs";
import { multipartActionDicePlan } from "./action-die-payments.mjs";
import { loc } from "../i18n.mjs";
/** One healing benefit; each contribution retains its own dietype and unrolled wound count. */
export function mixedHealingQuote(
  actor,
  { healingAllocations, surchargeBonusPoolId = "same", surchargeAllocations } = {},
  context = {}
) {
  if (!Array.isArray(healingAllocations) || !healingAllocations.length || healingAllocations.length > 32)
    throw new Error(loc`Choose healing benefit contributions from valid sources.`);
  const groups = new Map();
  let vitalityDice = 0,
    woundDice = 0;
  for (const row of healingAllocations) {
    const { bonusPoolId = "", vitalityDice: v = 0, woundDice: w = 0 } = row ?? {};
    if (
      typeof bonusPoolId !== "string" ||
      ![v, w].every(n => Number.isSafeInteger(n) && n >= 0) ||
      !Number.isSafeInteger(v + w) ||
      v + w < 1
    )
      throw new Error(loc`Choose whole nonnegative vitality/wound dice and at least one benefit die per source.`);
    const old = groups.get(bonusPoolId) ?? { bonusPoolId, vitalityDice: 0, woundDice: 0 };
    old.vitalityDice += v;
    old.woundDice += w;
    groups.set(bonusPoolId, old);
    vitalityDice += v;
    woundDice += w;
  }
  const baseCost = vitalityDice + woundDice;
  if (!Number.isSafeInteger(baseCost)) throw new Error(loc`The healing cost is unsafe.`);
  const system = actor.actionDiceFundingSystem,
    fee = actionDieBenefitQuote(actor, {
      baseCost: 0,
      benefitCount: 1,
      bonusPoolId: groups.keys().next().value,
      surchargeBonusPoolId,
      surchargeAllocations,
      purpose: "Healing surcharge"
    }),
    parts = [...groups.values()].map(p => ({
      bonusPoolId: p.bonusPoolId,
      count: p.vitalityDice + p.woundDice,
      scope: "general"
    })),
    payment = multipartActionDicePlan(system, [...parts, ...fee.allocations], {
      id: "healingQuote",
      actorUuid: actor.uuid,
      periods: actor.usagePeriods,
      purpose: "Mixed-source healing"
    });
  const plan = healingPlan(
    { ...actor.system, actionDice: { ...system.actionDice, value: baseCost } },
    { ...context, vitalityDice, woundDice }
  );
  if (plan.blocked) throw new Error(plan.reason);
  const healingSources = [...groups.values()].map(row => {
    const funding = actionDiceFundingContext(system, { bonusPoolId: row.bonusPoolId, periods: actor.usagePeriods });
    if (funding.blocked) throw new Error(funding.reason);
    const ad = funding.system.actionDice,
      die = ad.die,
      explodeAt = ad.explodeAt ?? die,
      bonus = ad.bonus ?? 0;
    if (
      ![4, 6, 8, 10, 12].includes(die) ||
      !Number.isSafeInteger(explodeAt) ||
      explodeAt < 2 ||
      explodeAt > die ||
      !Number.isFinite(bonus)
    )
      throw new Error(loc`Review the selected healing die type and modifiers.`);
    return { ...row, die, explodeAt, bonus, label: funding.label };
  });
  const terms = healingSources.flatMap(p =>
      Array(p.vitalityDice).fill(`1d${p.die}x>=${p.explodeAt}${p.bonus ? ` + (${p.bonus})` : ""}`)
    ),
    vitalityBonuses = healingSources.flatMap(p => Array(p.vitalityDice).fill(p.bonus));
  return {
    baseCost,
    benefitCount: 1,
    surcharge: fee.surcharge,
    cost: payment.count,
    grade: fee.grade,
    allocations: payment.allocations,
    payments: payment.payments,
    healingSources,
    plan: { ...plan, bonus: 0, formula: terms.length ? terms.join(" + ") : null, vitalityBonuses }
  };
}
export const mixedHealingSignature = q =>
  JSON.stringify([
    q.baseCost,
    q.surcharge,
    q.healingSources,
    q.payments.map(p => [p.bonusPoolId, p.count, p.die, p.poolFingerprint])
  ]);
