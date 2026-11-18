import { queueResources } from "../rules/transactions.mjs";
import { actionDicePoolFingerprint } from "../rules/bonus-pools.mjs";
import { rollEvidence } from "../rules/outcomes.mjs";
import {
  multipartActionDicePlan,
  multipartPaymentRecord,
  multipartDebitPatch,
  multipartRefundPatch,
  paymentRecordMatches,
  getActionDieSettlementReview,
  setPendingActionDieReview,
  clearPendingActionDieReview,
  beginActionDiePayment,
  endActionDiePayment,
  paymentLockToken,
  paymentIdValid
} from "../rules/action-die-payments.mjs";
import { loc } from "../i18n.mjs";
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b),
  clone = structuredClone;
const wholeInput = v => (typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN);
const currentSystem = actor => ({
  ...actor.actionDiceFundingSystem,
  actionDiceSettlementReview: getActionDieSettlementReview(actor)
});
export async function markMultipartActionDieReview(actor, payment, error, details = {}) {
  const payments = clone(payment.payments ?? [payment]),
    existing = getActionDieSettlementReview(actor),
    rows =
      existing.needsReview && existing.id !== payment.id
        ? [...(existing.payments ?? (existing.payment ? [existing.payment] : [])), ...payments]
        : payments;
  const byPath = new Map();
  for (const row of rows) {
    const previous = byPath.get(row.paymentPath);
    byPath.set(
      row.paymentPath,
      previous
        ? {
            ...previous,
            count: previous.count + row.count,
            ...(previous.poolFingerprint !== row.poolFingerprint
              ? { poolFingerprint: null, conflictingSources: [...(previous.conflictingSources ?? [previous]), row] }
              : {})
          }
        : row
    );
  }
  const review = {
    ...details,
    id: payment.id ?? foundry.utils.randomID(),
    needsReview: true,
    at: game.time?.worldTime ?? 0,
    reason: error.message,
    payments: [...byPath.values()],
    payment: [...byPath.values()][0],
    markerIds: [
      ...new Set([...(existing.needsReview ? (existing.markerIds ?? []) : []), ...(payment.id ? [payment.id] : [])])
    ],
    purpose: payment.purpose ?? details.purpose ?? "Action-die use",
    messageUuid: payment.messageUuid ?? details.messageUuid ?? ""
  };
  setPendingActionDieReview(actor, review);
  try {
    await actor.update(actor.actorRecordRestorePatch("flags.spycraft2.actionDiceSettlementReview", review));
  } catch {}
  ui.notifications.warn(
    loc`The action-die payment needs GC review. Check the recorded benefit and each selected balance before retrying.`
  );
  return review;
}
/** Caller must already hold this character’s resource transaction. This pays final quoted amounts; it never rolls fee dice. */
export async function payMultipartActionDiceLocked(
  actor,
  allocations,
  perform,
  { id = foundry.utils.randomID(), message = null, purpose = "Action-die use", details = {} } = {}
) {
  if (!actor.isOwner) throw new Error(loc`You must own the character spending action dice.`);
  if (getActionDieSettlementReview(actor).needsReview)
    throw new Error(loc`Resolve the interrupted action-die payment before spending.`);
  if (actor.flags?.spycraft2?.actionDiePayments?.[id])
    throw new Error(loc`This payment reference already exists. Inspect its recorded result before retrying.`);
  const plan = multipartActionDicePlan(currentSystem(actor), allocations, {
      id,
      actorUuid: actor.uuid,
      message,
      periods: actor.usagePeriods,
      purpose
    }),
    record = multipartPaymentRecord(plan, {
      lockToken: paymentLockToken(actor),
      at: game.time?.worldTime ?? 0,
      details
    });
  beginActionDiePayment(actor, id);
  try {
    try {
      await actor.update(multipartDebitPatch(record));
    } catch (error) {
      if (!paymentRecordMatches(actor, record)) {
        const unchanged = plan.payments.every(
          p =>
            (p.bonusPoolId
              ? actor.system.bonusActionDice?.[p.bonusPoolId]?.remaining
              : actor.system.actionDice.value) === p.balance
        );
        if (!unchanged)
          await markMultipartActionDieReview(actor, record, error, { ...details, purpose: "Payment reservation" });
        throw error;
      }
    }
    if (!paymentRecordMatches(actor, record)) {
      const error = new Error(loc`The payment reservation receipt is missing.`);
      await markMultipartActionDieReview(actor, record, error, details);
      throw error;
    }
    let result;
    try {
      result = await perform(plan);
    } catch (error) {
      if (error.actionDiceSettlementReview) {
        await markMultipartActionDieReview(actor, record, error, { ...details, ...error.actionDiceSettlementReview });
        throw error;
      }
      try {
        if (!paymentRecordMatches(actor, record))
          throw new Error(loc`The original payment reservation changed before refund.`);
        const patch = multipartRefundPatch(actor.actionDiceFundingSystem, record),
          refunded = patch["flags.spycraft2.actionDiePayments." + id];
        try {
          await actor.update(patch);
        } catch (rollback) {
          if (!paymentRecordMatches(actor, refunded)) throw rollback;
        }
        if (!paymentRecordMatches(actor, refunded)) throw new Error(loc`The refund receipt is missing.`);
      } catch (rollback) {
        await markMultipartActionDieReview(actor, record, rollback, { ...details, purpose: "Payment refund" });
        throw new AggregateError([error, rollback], loc`The selected action-die balances need GC review.`);
      }
      throw error;
    }
    const spent = {
      ...record,
      state: "spent",
      ...(typeof result?.uuid === "string" ? { resultUuid: result.uuid } : {})
    };
    try {
      await actor.update({ ["flags.spycraft2.actionDiePayments." + id]: spent });
      if (!paymentRecordMatches(actor, spent)) throw new Error(loc`The final payment receipt is missing.`);
    } catch (error) {
      if (!paymentRecordMatches(actor, spent))
        await markMultipartActionDieReview(actor, record, error, {
          ...details,
          callbackCompleted: true,
          resultUuid: spent.resultUuid ?? null
        });
    }
    return result;
  } finally {
    endActionDiePayment(actor, id);
    actor.system.actionDiceSettlementReview = getActionDieSettlementReview(actor);
  }
}
function balanceState(actor, row) {
  const pool = row.bonusPoolId ? actor.system.bonusActionDice?.[row.bonusPoolId] : null;
  return {
    balance: row.bonusPoolId ? pool?.remaining : actor.system.actionDice.value,
    fingerprint: actionDicePoolFingerprint(pool),
    granted: pool?.granted ?? null
  };
}
function validateRows(review) {
  if (
    !Array.isArray(review.payments) ||
    !review.payments.length ||
    new Set(review.payments.map(p => p.paymentPath)).size !== review.payments.length
  )
    throw new Error(loc`Review the saved payment sources.`);
  for (const row of review.payments)
    if (
      typeof row.bonusPoolId !== "string" ||
      (row.bonusPoolId && !paymentIdValid(row.bonusPoolId)) ||
      row.paymentPath !==
        (row.bonusPoolId ? "system.bonusActionDice." + row.bonusPoolId + ".remaining" : "system.actionDice.value")
    )
      throw new Error(loc`Review the original payment paths.`);
}
function relatedPaymentState(review, actorUuid) {
  const messages = game.messages ? [...game.messages.values()] : [],
    byUuid = uuid =>
      uuid ? messages.find(m => (m.uuid ?? m.id) === uuid || m.id === String(uuid).split(".").at(-1)) : null;
  const financial = paymentIdValid(review.id)
    ? messages.find(m => {
        const c = m.flags?.spycraft2;
        return (
          c?.actorUuid === actorUuid &&
          [c.preRollFunding?.id, c.rerollFunding?.id, c.funding?.paymentId, c.lastBoostPayment?.id].includes(review.id)
        );
      })
    : null;
  const uuid = review.messageUuid || review.resultUuid,
    message = uuid
      ? byUuid(uuid)
      : review.attemptId
        ? messages.find(
            m =>
              m.flags?.spycraft2?.actorUuid === review.recipientActorUuid &&
              m.flags.spycraft2.gearAttempt?.id === review.attemptId
          )
        : financial;
  const result = byUuid(review.replacementUuid || review.resultUuid) ?? financial;
  const capture = m =>
    m
      ? {
          uuid: m.uuid ?? m.id,
          evidence: rollEvidence(m.flags?.spycraft2 ?? {}),
          content: m.content ?? null,
          flavor: m.flavor ?? null,
          rolls: [...(m.rolls ?? [])].map(r => r.toJSON?.() ?? r)
        }
      : null;
  const receiver = review.recipientActorUuid
    ? typeof globalThis.fromUuidSync === "function"
      ? globalThis.fromUuidSync(review.recipientActorUuid)
      : game.actors?.find?.(a => a.uuid === review.recipientActorUuid)
    : null;
  return {
    message: capture(message),
    result: result !== message ? capture(result) : null,
    request: review.attemptId
      ? {
          recipientActorUuid: review.recipientActorUuid,
          epoch: receiver?.system.missionReserves?.epoch ?? null,
          attempt: receiver?.system.missionReserves?.attempts?.[review.attemptId] ?? null
        }
      : null
  };
}
export async function reviewMultipartActionDice(actor, options = {}) {
  if (!game.user.isGM || !actor.isOwner) throw new Error(loc`Only the GC may review the selected action-die balances.`);
  const review = clone(getActionDieSettlementReview(actor));
  if (!review.needsReview) return null;
  validateRows(review);
  const snapshot = () => ({
      review: getActionDieSettlementReview(actor),
      balances: review.payments.map(p => balanceState(actor, p)),
      vitality: actor.system.vitality.value,
      wounds: actor.system.wounds.value,
      refresh: actor.system.refreshAction ?? null,
      defense: actor.system.defenseBoost ?? null,
      eagleEye: actor.system.eagleEyeBoost ?? null,
      uses: actor.system.resourceUses ?? {},
      related: relatedPaymentState(review, actor.uuid)
    }),
    expected = clone(snapshot());
  let input = options;
  if (input.healthReviewed === undefined) {
    const esc = foundry.utils.escapeHTML;
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Review action-die payment` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`${esc(review.reason)} Review the actual benefit, health and action state first.`}</p><p>${esc(review.purpose ?? loc`Action-die payment`)}${review.attemptId ? loc`; Request recipient ${esc(review.recipientActorUuid)}, attempt ${esc(review.attemptId)}` : ""}</p>${Array.isArray(review.abilities) && review.abilities.length ? `<p>${loc`Ability uses: ${review.abilities.map(id => esc(String(actor.system.limitedUses?.find(s => s.id === id)?.name ?? id))).join("; ")}.`}</p>` : ""}${review.payments
        .map((p, i) => {
          const current = expected.balances[i],
            unavailable = !!p.bonusPoolId && current.fingerprint !== p.poolFingerprint;
          return `<label>${loc`${esc(p.label)} final balance`} <input name="balance_${i}" type="number" min="0" step="1" value="${current.balance ?? 0}" /></label>${unavailable ? `<label><input name="unavailable_${i}" type="checkbox" /> ${loc`The original grant is unavailable or replaced; leave its current source untouched`}</label>` : ""}`;
        })
        .join(
          ""
        )}<label>${loc`Benefit`} <select name="benefitRemains"><option value="true">${loc`The activation was applied; keep its benefit/use recorded`}</option><option value="false">${loc`The activation was cancelled; no result or benefit was retained`}</option></select></label>${review.limitedUseSettlement?.length ? `<p>${loc`An effect ending normally does not cancel its activation.`}</p><label><input name="restoreLimitedUses" type="checkbox" /> ${loc`Restore this cancelled activation’s recorded limited uses; no roll or benefit was used or retained`}</label>` : ""}<label>${loc`GC explanation`} <input name="resolution" /></label><label><input name="healthReviewed" type="checkbox" /> ${loc`I reviewed actual health, action state, benefit and all selected balances`}</label></div>`
    });
    if (!input) return null;
    const number = v => (typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN);
    input = {
      ...input,
      balances: review.payments.map((_, i) => number(input["balance_" + i])),
      unavailable: review.payments.map((_, i) => input["unavailable_" + i] === true),
      benefitRemains:
        input.benefitRemains === "true" ? true : input.benefitRemains === "false" ? false : input.benefitRemains
    };
  }
  if (input.balances === undefined && review.payments.length === 1)
    input = {
      ...input,
      balances: [wholeInput(input.balance)],
      unavailable: [false],
      benefitRemains: input.benefitRemains ?? false
    };
  if (
    input.healthReviewed !== true ||
    typeof input.resolution !== "string" ||
    !input.resolution.trim() ||
    !Array.isArray(input.balances) ||
    input.balances.length !== review.payments.length ||
    typeof input.benefitRemains !== "boolean" ||
    (input.restoreLimitedUses === true && input.benefitRemains)
  )
    throw new Error(loc`Confirm each final balance, the benefit disposition and the GC explanation.`);
  return queueResources([actor], async () => {
    if (!game.user.isGM || !actor.isOwner || !same(snapshot(), expected))
      throw new Error(loc`The saved payment, balances or related action state changed. Review them again.`);
    const patch = {},
      settled = [];
    for (const [i, row] of review.payments.entries()) {
      const current = balanceState(actor, row),
        unavailable = !!row.bonusPoolId && current.fingerprint !== row.poolFingerprint,
        value = input.balances[i];
      if (unavailable) {
        if (input.unavailable?.[i] !== true) throw new Error(loc`Confirm that the changed grant is left untouched.`);
        settled.push(null);
        continue;
      }
      if (!Number.isSafeInteger(value) || value < 0 || (row.bonusPoolId && value > current.granted))
        throw new Error(loc`Choose valid whole-die balances within the original grants.`);
      patch[row.paymentPath] = value;
      if (review.grantReview && row.bonusPoolId)
        patch["system.bonusActionDice." + row.bonusPoolId + ".needsReview"] = false;
      settled.push(value);
    }
    if (input.restoreLimitedUses === true) {
      const rows = review.limitedUseSettlement;
      if (!Array.isArray(rows) || !rows.length || new Set(rows.map(r => r.id)).size !== rows.length)
        throw new Error(loc`Review the recorded limited uses.`);
      for (const row of rows) {
        const valid = v => v && typeof v.epoch === "string" && Number.isSafeInteger(v.used) && v.used >= 0;
        const invalid =
          typeof row.id !== "string" ||
          !/^[A-Za-z0-9_%:-]+$/.test(row.id) ||
          ["constructor", "prototype", "__proto__"].includes(row.id) ||
          !valid(row.reserved) ||
          (row.before !== null && !valid(row.before)) ||
          !same(actor.system.resourceUses?.[row.id], row.reserved);
        const wrongIncrement =
          valid(row.before) && valid(row.reserved) && row.before.epoch === row.reserved.epoch
            ? row.reserved.used !== row.before.used + 1
            : row.reserved?.used !== 1;
        if (invalid || wrongIncrement)
          throw new Error(loc`A limited-use source changed or has invalid restoration data.`);
        Object.assign(
          patch,
          actor.actorRecordRestorePatch("system.resourceUses." + row.id, row.before === null ? undefined : row.before)
        );
      }
    }
    const completed = {
      ...review,
      needsReview: false,
      limitedUsesRestored: input.restoreLimitedUses === true,
      benefitRemains: input.benefitRemains,
      resolution: input.resolution.trim(),
      reviewedBy: game.user.id,
      resolvedAt: game.time?.worldTime ?? 0,
      settledBalances: settled,
      ...(settled.length === 1 ? { settledBalance: settled[0] } : {})
    };
    for (const id of review.markerIds ?? [])
      if (paymentIdValid(id) && actor.flags?.spycraft2?.actionDiePayments?.[id])
        patch["flags.spycraft2.actionDiePayments." + id] = {
          ...actor.flags.spycraft2.actionDiePayments[id],
          state: "reviewed",
          benefitRemains: input.benefitRemains,
          resolution: completed.resolution
        };
    patch["flags.spycraft2.actionDiceSettlementReview"] = completed;
    try {
      await actor.update(patch);
    } catch (error) {
      if (!same(actor.flags?.spycraft2?.actionDiceSettlementReview, completed)) throw error;
    }
    clearPendingActionDieReview(actor, review.id);
    actor.system.actionDiceSettlementReview = completed;
    return completed;
  });
}
