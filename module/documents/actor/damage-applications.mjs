import { queueResources } from "../../services/transactions.mjs";
import { damageApplicationKey, damageApplicationSignature } from "../../rules/attack-damage-hits.mjs";
import { loc } from "../../i18n.mjs";
import { recordReplacementPatch } from "../../rules/record-patch.mjs";

const leases = new WeakMap();
export const damageApplications = actor => actor.flags?.spycraft2?.damageApplications ?? {};

export async function beginDamageApplication(actor, check, messageId, input) {
  const key = damageApplicationKey(check, messageId),
    signature = damageApplicationSignature(check, input);
  const lease = {};
  await queueResources([actor], async () => {
    if (Object.values(damageApplications(actor)).some(r => ["applying", "needsReview", "undoing"].includes(r.state)))
      throw Error(loc`Finish or review this target's pending damage application before applying another hit.`);
    const old = damageApplications(actor)[key];
    if (old && old.state !== "undone")
      throw Error(
        loc`This damage already reached this target or needs GC review. Use its original receipt instead of applying it again.`
      );
    const attempt = foundry.utils.randomID();
    await actor.update(
      recordReplacementPatch(
        `flags.spycraft2.damageApplications.${key}`,
        { version: 1, signature, attempt, state: "applying", messageId },
        old
      )
    );
    leases.set(lease, { actor, key, signature, attempt });
  });
  return lease;
}

export async function finishDamageApplication(lease, completed, evidence = {}) {
  const data = leases.get(lease);
  if (!data) throw Error(loc`The original damage application receipt is missing.`);
  await queueResources([data.actor], async () => {
    const row = damageApplications(data.actor)[data.key];
    if (row?.attempt !== data.attempt || row.signature !== data.signature)
      throw Error(loc`The damage application changed. Ask the GC to review its actual effects.`);
    await data.actor.update({
      [`flags.spycraft2.damageApplications.${data.key}`]: {
        ...row,
        ...evidence,
        state: completed ? "complete" : "needsReview"
      }
    });
  });
}

export async function reviewDamageApplication(actor, key, { decision, note, confirmedNoEffects = false } = {}) {
  if (!game.user?.isGM || !actor.isOwner || typeof note !== "string" || !note.trim())
    throw Error(loc`The GC must record what actually happened to this target.`);
  return queueResources([actor], async () => {
    const row = damageApplications(actor)[key];
    if (!row || !["applying", "needsReview", "undoing", "complete"].includes(row.state))
      throw Error(loc`Choose this target's original pending damage receipt.`);
    if (decision !== "keep" && (decision !== "release" || !confirmedNoEffects || row.lethalPlan || row.undoEntry))
      throw Error(
        loc`Only a verified application with no effects or dice may be released. Keep actual effects and review their correction.`
      );
    await actor.update({
      [`flags.spycraft2.damageApplications.${key}`]: {
        ...row,
        state: decision === "keep" ? "complete" : "undone",
        review: { note: note.trim(), decision, userId: game.user.id }
      }
    });
    return row;
  });
}

export function damageApplicationUndo(lease) {
  const data = leases.get(lease);
  return { actorUuid: data.actor.uuid, key: data.key, attempt: data.attempt };
}

/** Caller already holds the target's resource lock during Undo. */
export async function setDamageUndo(actor, receipt, state) {
  const row = damageApplications(actor)[receipt.key];
  if (row?.attempt !== receipt.attempt || !["complete", "undoing"].includes(row.state))
    throw Error(loc`Review this damage application's current receipt before Undo.`);
  await actor.update({ [`flags.spycraft2.damageApplications.${receipt.key}.state`]: state });
}
