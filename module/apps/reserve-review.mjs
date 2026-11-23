import { queueResources } from "../services/transactions.mjs";
import { reserveValue, getReserveReview } from "../rules/reserve-transactions.mjs";
import { loc } from "../i18n.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { same } from "../rules/equal.mjs";
const balance = value => {
  if (!["string", "number"].includes(typeof value) || (typeof value === "string" && !value.trim()))
    throw new Error(loc`Confirm each final whole-number balance.`);
  return Number(value);
};
const clone = structuredClone;
export function requireSettledReserve(actor) {
  if (getReserveReview(actor).needsReview)
    throw new Error(loc`The GC must review the interrupted Reserve transaction first.`);
}
export async function holdReserveReview(actor, event, reason) {
  const review = { ...clone(event), needsReview: true, reason };
  game.spycraft2 ??= {};
  game.spycraft2.pendingReserveReviews ??= {};
  game.spycraft2.pendingReserveReviews[actor.uuid] = review;
  actor.system.reserveTransactionReview = review;
  try {
    await actor.update({ "flags.spycraft2.reserveTransactionReview": review });
  } catch {}
  return review;
}
function sourceSnapshot(actor, review) {
  return {
    epoch: actor.system.missionReserves?.epoch,
    attempt: clone(actor.system.missionReserves?.attempts?.[review.id] ?? null),
    fields: review.fields.map(f => reserveValue(actor, f.path) ?? null),
    ability: review.ability ? clone(actor.system.resourceUses?.[review.ability.id] ?? null) : null
  };
}
const messagesFor = (actor, review) =>
  [...(game.messages ?? [])].filter(
    m =>
      m.flags?.spycraft2?.actorUuid === actor.uuid &&
      m.flags.spycraft2.gearAttempt?.id === review.id &&
      m.flags.spycraft2.gearAttempt.epoch === review.epoch &&
      !m.flags.spycraft2.superseded
  );
export async function reviewReserveTransaction(actor, options = {}) {
  if (!game.user.isGM || !actor.isOwner) throw new Error(loc`Only the GC can review this Reserve transaction.`);
  const review = clone(getReserveReview(actor));
  if (!review.needsReview) return null;
  const expected = sourceSnapshot(actor, review),
    messages = messagesFor(actor, review);
  let input = options;
  if (!Object.keys(input).length) {
    const esc = foundry.utils.escapeHTML;
    input = await systemDialog.input({
      window: { title: loc`Review interrupted Reserve transaction` },
      rejectClose: false,
      content: `<p>${loc`${esc(review.attempt.name)}. ${esc(review.reason)} Inspect its Request chat and each funder before confirming final balances.`}</p>${review.fields.map((f, i) => `<label>${loc`${esc(f.label)} (before ${f.before}, reserved ${f.reserved})`} <input name="field_${i}" type="number" min="0" step="1" value="${expected.fields[i] ?? 0}" /></label>`).join("")}${review.ability ? `<label>${loc`Final Request ability uses in this period`} <input name="abilityUsed" type="number" min="0" step="1" value="${expected.ability?.used ?? 0}" /></label>` : ""}<label>${loc`Acquisition`} <select name="messageUuid"><option value="">${loc`Cancel the acquisition; keep the reviewed final balances`}</option>${messages.map(m => `<option value="${esc(m.uuid ?? m.id)}">${loc`Keep the recorded check ${esc(m.id)}`}</option>`).join("")}</select></label><label>${loc`GC explanation`} <input name="resolution" /></label><label><input name="fundersSettled" type="checkbox" /> ${loc`I reviewed and settled every funder separately; these balances do not change their action dice`}</label><label><input name="confirmed" type="checkbox" /> ${loc`I confirm these final Reserve balances and the acquisition disposition`}</label>`
    });
    if (!input) return null;
    input = {
      ...input,
      values: review.fields.map((_, i) => balance(input["field_" + i])),
      abilityUsed: input.abilityUsed == null ? undefined : balance(input.abilityUsed)
    };
  }
  if (
    input.confirmed !== true ||
    input.fundersSettled !== true ||
    !Array.isArray(input.values) ||
    input.values.length !== review.fields.length ||
    input.values.some(v => !Number.isSafeInteger(v) || v < 0) ||
    typeof input.resolution !== "string" ||
    !input.resolution.trim() ||
    (review.ability && (!Number.isSafeInteger(input.abilityUsed) || input.abilityUsed < 0))
  )
    throw new Error(loc`Confirm the final whole-number balances, settled funders and GC explanation.`);
  return queueResources([actor], async () => {
    if (
      !game.user.isGM ||
      !actor.isOwner ||
      !same(getReserveReview(actor), review) ||
      !same(sourceSnapshot(actor, review), expected) ||
      expected.epoch !== review.epoch
    )
      throw new Error(loc`The Reserve review or its sources changed. Open it again.`);
    const message = input.messageUuid
      ? messagesFor(actor, review).find(m => (m.uuid ?? m.id) === input.messageUuid)
      : null;
    if (input.messageUuid && !message) throw new Error(loc`Choose the recorded check for this acquisition.`);
    const resolution = {
      text: input.resolution.trim(),
      reviewer: game.user.id,
      messageUuid: message?.uuid ?? message?.id ?? "",
      values: input.values,
      ...(review.ability ? { abilityUsed: input.abilityUsed } : {})
    };
    const attempt = {
        ...(expected.attempt ?? review.attempt),
        ...(message ? { messageUuid: message.uuid ?? message.id } : { status: "cancelled", success: false }),
        reserveReview: resolution
      },
      completed = { ...review, needsReview: false, resolution },
      patch = {
        ["system.missionReserves.attempts." + review.id]: attempt,
        "flags.spycraft2.reserveTransactionReview": completed
      };
    review.fields.forEach((f, i) => (patch[f.path] = input.values[i]));
    if (review.ability)
      patch["system.resourceUses." + review.ability.id] = {
        ...(expected.ability ?? review.ability.reserved),
        epoch: review.ability.reserved.epoch,
        used: input.abilityUsed
      };
    try {
      await actor.update(patch);
    } catch (error) {
      if (!same(actor.flags?.spycraft2?.reserveTransactionReview, completed)) throw error;
    }
    delete game.spycraft2?.pendingReserveReviews?.[actor.uuid];
    actor.system.reserveTransactionReview = completed;
    return attempt;
  });
}
