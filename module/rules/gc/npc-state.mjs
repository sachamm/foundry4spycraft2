import { npcSpendProfile } from "./gc-spend.mjs";

/** Whether this NPC currently counts as special: by type, or promoted for the current mission (p.398). */
export function npcIsSpecial(actor) {
  const system = actor.system;
  return ["special", "villain"].includes(system.npcType) || isPromoted(actor);
}
export const isPromoted = actor =>
  !!actor.system.promotion &&
  actor.system.promotion.mission === String(actor.system.usagePeriods?.mission ?? "initial");
export const spendProfile = actor =>
  npcSpendProfile({
    type: actor.system.npcType,
    qualities: actor.system.npcProfile?.enabled
      ? (actor.system.npcProfile.qualities ?? [])
      : actor.system.manualRole
        ? [{ id: actor.system.manualRole }]
        : [],
    promoted: isPromoted(actor)
  });
