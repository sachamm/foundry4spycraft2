import { underminedSpendBlock } from "./taunt.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import {
  actionDiceFundingContext,
  actionDicePoolFingerprint,
  bonusPoolForCheck,
  actionDicePaymentRefund
} from "./bonus-pools.mjs";
import { shakenRules } from "./shaken.mjs";
import { RESOURCE_LOCK_ID } from "./resource-locks.mjs";
import { loc } from "../i18n.mjs";
const active = new WeakMap(),
  local = new WeakMap(),
  same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const paymentIdValid = id =>
  typeof id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(id) && !["constructor", "prototype", "__proto__"].includes(id);
export const paymentLockToken = actor =>
  [...(actor.items ?? [])].find(i => i.id === RESOURCE_LOCK_ID)?.flags?.spycraft2?.resourceLock?.token ?? null;
export function beginActionDiePayment(actor, id) {
  const ids = active.get(actor) ?? new Set();
  if (ids.size) throw new Error(loc`Combine this character’s payment sources in one transaction.`);
  ids.add(id);
  active.set(actor, ids);
}
export function endActionDiePayment(actor, id) {
  active.get(actor)?.delete(id);
}
export function setPendingActionDieReview(actor, review) {
  local.set(actor, review);
  if (actor.system) actor.system.actionDiceSettlementReview = review;
}
export function clearPendingActionDieReview(actor, id) {
  if (local.get(actor)?.id === id) local.delete(actor);
}
export function getActionDieSettlementReview(actor) {
  const stored = actor.flags?.spycraft2?.actionDiceSettlementReview,
    pending = local.get(actor);
  if (stored?.needsReview) return stored;
  if (pending?.needsReview && !(stored?.id === pending.id && stored.needsReview === false)) return pending;
  const token = paymentLockToken(actor);
  for (const record of Object.values(actor.flags?.spycraft2?.actionDiePayments ?? {})) {
    if (
      record?.state !== "reserved" ||
      active.get(actor)?.has(record.id) ||
      (record.lockToken && record.lockToken === token)
    )
      continue;
    return {
      ...structuredClone(record.details ?? {}),
      id: record.id,
      needsReview: true,
      payments: record.payments,
      payment: record.payments?.[0],
      markerIds: [record.id],
      purpose: record.purpose,
      messageUuid: record.messageUuid,
      reason: loc`An interrupted payment has no final receipt. Review the actual benefit and every selected balance before retrying.`
    };
  }
  return stored ?? {};
}
export function multipartActionDicePlan(
  system,
  allocations,
  { id, actorUuid, message = null, periods = system.usagePeriods, purpose = "Action-die use" } = {}
) {
  const shaken = shakenRules(system);
  if (shaken.needsReview || system.actionDieAwardReview?.needsReview || system.actionDiceSettlementReview?.needsReview)
    throw new Error(loc`Review the interrupted action-die or condition records before spending.`);
  if (shaken.spendingForbidden) throw new Error(loc`Shaken IV: no action dice may be spent at all (p.342).`);
  if (underminedSpendBlock(system)) throw new Error(underminedSpendBlock(system));
  if (
    !paymentIdValid(id) ||
    typeof actorUuid !== "string" ||
    !actorUuid ||
    typeof purpose !== "string" ||
    !purpose.trim() ||
    purpose.length > 500 ||
    !Array.isArray(allocations) ||
    !allocations.length ||
    allocations.length > 32
  )
    throw new Error(loc`Choose a valid payment reference and its action-die sources.`);
  const groups = new Map(),
    parts = [];
  for (const allocation of allocations) {
    const { bonusPoolId = "", count, scope = "general" } = allocation ?? {};
    if (
      typeof bonusPoolId !== "string" ||
      (bonusPoolId && !paymentIdValid(bonusPoolId)) ||
      !Number.isSafeInteger(count) ||
      count < 1 ||
      !["general", "boost", "surcharge"].includes(scope)
    )
      throw new Error(loc`Choose whole positive amounts from valid action-die sources.`);
    let funding;
    if (scope === "boost") {
      const check = message?.flags?.spycraft2;
      if (
        check?.actorUuid !== actorUuid ||
        !Number.isFinite(check.rawTotal) ||
        check.resolved ||
        check.superseded ||
        check.criticalFailure
      )
        throw new Error(loc`Choose this character’s unresolved recorded roll for boost funding.`);
      if (bonusPoolId) {
        const pool = bonusPoolForCheck(system, bonusPoolId, message, { periods });
        if (!pool.available) throw new Error(pool.reason);
        const ad = system.actionDice ?? {},
          threshold = Math.max(2, pool.die - Math.max(0, (ad.die ?? 4) - (ad.explodeAt ?? ad.die ?? 4)));
        funding = {
          bonusPoolId,
          label: pool.label,
          paymentPath: "system.bonusActionDice." + bonusPoolId + ".remaining",
          balance: pool.remaining,
          die: pool.die,
          poolFingerprint: actionDicePoolFingerprint(pool),
          system: { ...system, actionDice: { ...ad, value: pool.remaining, die: pool.die, explodeAt: threshold } }
        };
      } else {
        if (check.actionDiceAllowed === false) throw new Error(loc`Ordinary action dice cannot fund this result.`);
        funding = actionDiceFundingContext(system, { periods });
      }
    } else funding = actionDiceFundingContext(system, { bonusPoolId, periods });
    if (funding.blocked) throw new Error(funding.reason);
    const existing = groups.get(bonusPoolId),
      total = (existing?.count ?? 0) + count;
    if (!Number.isSafeInteger(total) || total > funding.balance)
      throw new Error(loc`Not enough dice remain in a selected payment source.`);
    groups.set(bonusPoolId, {
      ...funding,
      count: total,
      afterBalance: funding.balance - total,
      poolFingerprint: funding.poolFingerprint ?? null
    });
    parts.push({ bonusPoolId, count, scope });
  }
  const prepared = [...groups.values()],
    total = prepared.reduce((sum, row) => sum + row.count, 0);
  if (!Number.isSafeInteger(total)) throw new Error(loc`The total action-die payment is unsafe.`);
  const payments = prepared.map(
      ({ bonusPoolId, label, paymentPath, balance, die, poolFingerprint, count, afterBalance }) => ({
        bonusPoolId,
        label,
        paymentPath,
        balance,
        die,
        poolFingerprint,
        count,
        afterBalance
      })
    ),
    primary = prepared[0];
  return {
    id,
    actorUuid,
    purpose: purpose.trim(),
    messageUuid: message?.uuid ?? message?.id ?? "",
    count: total,
    payments,
    allocations: parts,
    bonusPoolId: primary.bonusPoolId,
    label: primary.label,
    paymentPath: primary.paymentPath,
    balance: primary.balance,
    afterBalance: primary.afterBalance,
    die: primary.die,
    poolFingerprint: primary.poolFingerprint,
    system: { ...primary.system, actionDice: { ...primary.system.actionDice, value: Math.max(primary.balance, total) } }
  };
}
export function multipartPaymentRecord(plan, { lockToken = null, at = 0, details = {} } = {}) {
  if (!Number.isFinite(at)) throw new Error(loc`Review the payment time.`);
  return {
    id: plan.id,
    actorUuid: plan.actorUuid,
    purpose: plan.purpose,
    messageUuid: plan.messageUuid,
    count: plan.count,
    payments: structuredClone(plan.payments),
    allocations: structuredClone(plan.allocations),
    state: "reserved",
    lockToken,
    at,
    details: structuredClone(details)
  };
}
export function multipartDebitPatch(record) {
  return {
    ...Object.fromEntries(record.payments.map(p => [p.paymentPath, p.afterBalance])),
    ["flags.spycraft2.actionDiePayments." + record.id]: record
  };
}
export function multipartRefundPatch(system, record) {
  if (
    !paymentIdValid(record?.id) ||
    !Array.isArray(record.payments) ||
    !record.payments.length ||
    new Set(record.payments.map(p => p.paymentPath)).size !== record.payments.length
  )
    throw new Error(loc`Review the original payment sources.`);
  const patch = {};
  for (const payment of record.payments) Object.assign(patch, actionDicePaymentRefund(system, payment));
  patch["flags.spycraft2.actionDiePayments." + record.id] = { ...record, state: "refunded" };
  return patch;
}
export function paymentRecordMatches(actor, record) {
  return same(actor.flags?.spycraft2?.actionDiePayments?.[record.id], record);
}

// Recorded on the posted check as the roll was given them.
rollPipeline.register({
  id: "actionDiePaymentsRecord",
  order: 9610,
  record: ["preRollFunding", "rerollFunding", "rerollReceiptId"]
});
