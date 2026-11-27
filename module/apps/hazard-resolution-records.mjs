import { queueResources } from "../services/transactions.mjs";
import { same } from "../rules/equal.mjs";
import { recordReplacementPatch } from "../rules/record-patch.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { markCard } from "./gc-relay.mjs";
import { loc } from "../i18n.mjs";
import { esc } from "../html.mjs";

const records = actor => actor?.flags?.spycraft2?.hazardResolutions ?? {};
const owned = actor => actor?.isOwner === true;
const keyOf = message => {
  if (typeof message?.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(message.id))
    throw Error(loc`This hazard needs its original saved chat card before applying effects.`);
  return message.id;
};
const evidence = (message, { policy = true } = {}) => {
  const check = message.flags?.spycraft2 ?? {},
    { resolved, ...save } = check.hazardSave ?? {};
  return {
    actorUuid: check.actorUuid,
    resolved: check.resolved,
    succeeded: check.successConfirmed,
    total: check.effectiveTotal,
    save,
    ...(policy ? { evasionContext: structuredClone(check.evasionContext ?? null) } : {})
  };
};
export const hazardResolution = (actor, message) => records(actor)[message?.id];
const requireOriginal = (actor, message, row) => {
  if (
    ![1, 2].includes(row.version) ||
    typeof row.attempt !== "string" ||
    !row.attempt ||
    !owned(actor) ||
    (message.blind && !game.user?.isGM) ||
    row.actorUuid !== actor.uuid ||
    row.messageUuid !== (message.uuid ?? message.id) ||
    !same(row.evidence, evidence(message, { policy: row.version >= 2 }))
  )
    throw Error(loc`The original hazard save or ownership changed. Preserve the actual effects for GC review.`);
};
async function commit(actor, key, next, old) {
  try {
    await actor.update(recordReplacementPatch(`flags.spycraft2.hazardResolutions.${key}`, next, old));
  } catch (error) {
    if (!same(records(actor)[key], next)) throw error;
  }
  if (!same(records(actor)[key], next))
    throw Error(loc`The hazard receipt was not saved; review the actual effects before retrying.`);
}
async function closeCard(message) {
  await markCard(message, "hazardSave.resolved", true, { quiet: true });
  if (message.flags?.spycraft2?.hazardSave?.resolved !== true)
    throw Error(
      loc`Hazard effects are recorded. Apply this result again to repair its card without repeating effects.`
    );
}

/** Reserve the entire effect before any condition, damage or secondary dice. Helpers take their own brief locks. */
export async function beginHazardResolution(actor, message) {
  const key = keyOf(message);
  let lease;
  await queueResources(
    [actor],
    async () => {
      const old = records(actor)[key],
        check = message.flags?.spycraft2;
      if (
        !owned(actor) ||
        check?.actorUuid !== actor.uuid ||
        check.resolved !== true ||
        check.superseded ||
        typeof check.successConfirmed !== "boolean" ||
        !Number.isFinite(check.effectiveTotal)
      )
        throw Error(loc`Finish and confirm the original hazard save before applying effects.`);
      if (old && old.state !== "released") {
        requireOriginal(actor, message, old);
        if (old.state !== "complete")
          throw Error(
            loc`This hazard already started. The GC must review its actual effects and dice; do not apply it again.`
          );
        lease = { key, row: old, alreadyComplete: true };
        return;
      }
      if (Object.values(records(actor)).some(r => r.state === "started"))
        throw Error(loc`Finish or review this character's pending hazard before applying another save.`);
      if (
        Object.values(actor.flags?.spycraft2?.damageApplications ?? {}).some(r =>
          ["applying", "needsReview", "undoing"].includes(r.state)
        )
      )
        throw Error(loc`Finish or review this character's pending damage application before applying a hazard save.`);
      const row = {
        version: 2,
        actorUuid: actor.uuid,
        messageUuid: message.uuid ?? message.id,
        attempt: foundry.utils.randomID(),
        evidence: evidence(message),
        state: "started",
        reviews: old?.reviews ?? []
      };
      await commit(actor, key, row, old);
      lease = { key, row, alreadyComplete: false };
    },
    { messages: [message] }
  );
  if (!lease) throw Error(loc`The hazard could not reserve its resolution. No effects were applied.`);
  return lease;
}

export async function finishHazardResolution(actor, message, lease) {
  await queueResources(
    [actor],
    async () => {
      const row = records(actor)[lease.key];
      requireOriginal(actor, message, row ?? {});
      if (row.attempt !== lease.row.attempt || !["started", "complete"].includes(row.state))
        throw Error(loc`The hazard receipt changed. The GC must review its actual effects.`);
      if (row.state !== "complete") await commit(actor, lease.key, { ...row, state: "complete" }, row);
      await closeCard(message);
    },
    { messages: [message] }
  );
  if (records(actor)[lease.key]?.state !== "complete" || message.flags?.spycraft2?.hazardSave?.resolved !== true)
    throw Error(loc`The hazard receipt is still pending. Review its actual effects before applying anything again.`);
  return lease.row.evidence.succeeded;
}

/** Keep actual outcomes, or release only after the GC verifies that nothing happened, including dice. */
export async function reviewHazardResolution(actor, message, options = {}) {
  if (!owned(actor) || !game.user?.isGM) return null;
  const byId = typeof message === "string";
  if (byId) message = game.messages?.get?.(message) ?? { id: message };
  const key = keyOf(message),
    expected = structuredClone(records(actor)[key] ?? null);
  if (expected?.state !== "started") return null;
  const sourceMissing = byId && !game.messages?.get?.(key);
  if (sourceMissing) {
    const proof = expected.evidence;
    if (!proof || !proof.save || expected.actorUuid !== actor.uuid)
      throw Error(loc`This interrupted hazard lacks readable original evidence. Preserve it for GC correction.`);
    message = {
      id: key,
      uuid: expected.messageUuid,
      flags: {
        spycraft2: {
          actorUuid: proof.actorUuid,
          resolved: proof.resolved,
          effectiveTotal: proof.total,
          successConfirmed: proof.succeeded,
          hazardSave: structuredClone(proof.save),
          evasionContext: structuredClone(proof.evasionContext ?? null)
        }
      }
    };
  }
  requireOriginal(actor, message, expected);
  let input = options;
  if (!Object.keys(input).length) {
    input = await systemDialog.input({
      window: { title: loc`Review interrupted hazard` },
      rejectClose: false,
      ok: { label: loc`Record review` },
      content: `<div class="spycraft2-roll-options"><p><b>${esc(expected.evidence.save.label ?? expected.evidence.save.kind)}</b> — ${loc`Saved result`} ${esc(expected.evidence.total)}; ${expected.evidence.succeeded ? loc`success` : loc`failure`}</p>${sourceMissing ? `<p class="inventory-warning">${loc`The original chat card is missing. This review uses the character's saved receipt; it cannot replay the result.`}</p>` : ""}<p>${loc`Review the actual conditions, health, attributes, dice and reports first. Keep the existing outcome without replaying it. Release only if applying this result produced no effects or dice.`}</p><label>${loc`Decision`} <select name="decision"><option value="keep">${loc`Keep actual effects and close this result`}</option><option value="release">${loc`Verified no effects and no dice; release this result`}</option></select></label><label><input name="noEffects" type="checkbox" /> ${loc`No effects of this result were applied`}</label><label><input name="noDice" type="checkbox" /> ${loc`No dice were rolled while applying this result`}</label><label>${loc`GC review note`} <input name="note" maxlength="500" required /></label></div>`
    });
    if (!input) return null;
  }
  if (
    !["keep", "release"].includes(input.decision) ||
    typeof input.note !== "string" ||
    !input.note.trim() ||
    input.note.length > 500 ||
    (input.decision === "release" && (input.noEffects !== true || input.noDice !== true))
  )
    throw Error(
      loc`Record a GC note. Releasing an interrupted hazard requires confirmation of both no effects and no dice.`
    );
  return queueResources(
    [actor],
    async () => {
      if (!owned(actor) || !game.user?.isGM || !game.user.id || !same(records(actor)[key], expected))
        throw Error(loc`The hazard receipt or GC ownership changed during review.`);
      if (sourceMissing && game.messages?.get?.(key))
        throw Error(loc`The source card is available again. Review that original card instead.`);
      requireOriginal(actor, message, expected);
      const next = {
        ...expected,
        state: input.decision === "keep" ? "complete" : "released",
        reviews: [
          ...expected.reviews,
          {
            reviewerId: game.user.id,
            decision: input.decision,
            note: input.note.trim(),
            noEffects: input.noEffects === true,
            noDice: input.noDice === true,
            sourceMissing
          }
        ]
      };
      await commit(actor, key, next, expected);
      if (input.decision === "keep" && !sourceMissing) await closeCard(message);
      return next;
    },
    { messages: sourceMissing ? [] : [message] }
  );
}
