import { applyNpcDrained } from "./npc-drained.mjs";
import { sameValues } from "../rules/equal.mjs";
import { rollEvidence } from "../rules/outcomes.mjs";
import { loc } from "../i18n.mjs";

/** A special NPC's original fifth-tier stress save hands off to the same reviewed Drained application as its sheet. */
export async function applyNpcStressDrained(actor, message, save) {
  if (
    actor.type !== "npc" ||
    save.damageKind !== "stress" ||
    !(save.stressTier === 5 || save.failureOutcome === "Drained")
  )
    throw Error(loc`Review the original fifth-tier NPC stress save before applying Drained.`);
  const reference = save.eventId ?? message.id;
  if (typeof reference !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(reference))
    throw Error(loc`This stress save needs a stable original event reference before applying Drained.`);
  const original = structuredClone(save),
    evidence = rollEvidence(message.flags.spycraft2),
    id = `stress${reference}`;
  const validateSource = () => {
    const check = message.flags?.spycraft2;
    if (
      !actor.isOwner ||
      check?.actorUuid !== actor.uuid ||
      check.resolved !== true ||
      check.successConfirmed !== false ||
      check.superseded ||
      !sameValues(check.hazardSave, original) ||
      rollEvidence(check) !== evidence
    )
      throw Error(
        loc`The original NPC stress save changed during Drained review. Keep its dice and review the source.`
      );
  };
  validateSource();
  if (actor.flags?.spycraft2?.drained?.applications?.[id]) return actor.flags.spycraft2.drained;
  const result = await applyNpcDrained(actor, {
    id,
    levels: 1,
    source: loc`Failed stress save: ${message.uuid}`,
    validateSource
  });
  if (!result) throw Error(loc`NPC Drained was not recorded. Review the original stress save before completing it.`);
  return result;
}
