import { triggerClaimKey, triggerClaimUsed } from "../rules/triggered-attacks.mjs";
import { postedReceipt } from "./message-lookup.mjs";
import { sameValues as same } from "../rules/equal.mjs";
import { recordReplacementPatch } from "../rules/record-patch.mjs";
import { loc } from "../i18n.mjs";

async function save(actor, key, value) {
  try {
    await actor.update(
      recordReplacementPatch(
        `flags.spycraft2.triggeredAttacks.${key}`,
        value,
        actor.flags?.spycraft2?.triggeredAttacks?.[key]
      )
    );
  } catch (error) {
    if (!same(actor.flags?.spycraft2?.triggeredAttacks?.[key], value)) throw error;
  }
  if (!same(actor.flags?.spycraft2?.triggeredAttacks?.[key], value))
    throw new Error(loc`The extra-attack claim was not saved. Review it before retrying.`);
}

/** Called inside the caller's actor resource lock. A posted result keeps its claim even if final bookkeeping fails. */
export async function withAttackTriggerClaim(actor, receipt, perform, validate) {
  const trigger = receipt.triggerMessageUuid;
  if (!trigger) return perform(validate);
  if (
    typeof trigger !== "string" ||
    !trigger.trim() ||
    typeof receipt.source !== "string" ||
    !receipt.source ||
    !receipt.id
  )
    throw new Error(loc`Review the extra attack's triggering result and source.`);
  const key = triggerClaimKey(receipt.source, trigger);
  const current = () => actor.flags?.spycraft2?.triggeredAttacks?.[key];
  if (triggerClaimUsed(actor.flags?.spycraft2?.triggeredAttacks, receipt.source, trigger, null, actor.uuid))
    throw new Error(loc`This trigger already supplied this extra attack or needs GC review.`);
  await validate();
  const reserved = {
    version: 1,
    id: receipt.id,
    actorUuid: actor.uuid,
    source: receipt.source,
    name: receipt.name ?? null,
    triggerMessageUuid: trigger,
    combatId: receipt.combatId ?? null,
    round: receipt.round ?? null,
    state: "reserved",
    at: Date.now()
  };
  await save(actor, key, reserved);
  const check = async () => {
    if (!same(current(), reserved)) throw new Error(loc`The extra-attack claim changed. Ask the GC to review it.`);
    await validate();
  };
  let message;
  try {
    message = await perform(check);
  } catch (error) {
    message = postedReceipt(actor, "finalAttack", receipt.id);
    if (!message) {
      if (!same(current(), reserved)) throw new Error(loc`The interrupted extra-attack claim needs GC review.`);
      try {
        await save(actor, key, { ...reserved, state: "void", reason: "No attack result posted" });
      } catch (cleanup) {
        throw new AggregateError([error, cleanup], loc`The unused extra-attack claim needs GC review.`);
      }
      throw error;
    }
  }
  try {
    if (!same(current(), reserved)) throw new Error(loc`The extra-attack claim changed after the result posted.`);
    await save(actor, key, { ...reserved, state: "committed", messageUuid: message.uuid });
  } catch {
    globalThis.ui?.notifications?.warn(
      loc`The extra attack posted. Its claim remains reserved for GC review; do not repeat it.`
    );
  }
  return message;
}
