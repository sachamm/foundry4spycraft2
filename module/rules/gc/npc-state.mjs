import { npcSpendProfile } from "./gc-spend.mjs";

/** Special health also applies to an Animal Partner (p.201), while its underlying NPC type stays animal. */
export function npcIsSpecial(actor) {
  const system = actor.system;
  return system.animalPartner === true || ["special", "villain"].includes(system.npcType) || isPromoted(actor);
}
export const isPromoted = actor =>
  !!actor.system.promotion &&
  actor.system.promotion.mission === String(actor.system.usagePeriods?.mission ?? "initial");
export const spendProfile = actor => {
  const profile = npcSpendProfile({
    type: actor.system.npcType,
    qualities: actor.system.npcProfile?.enabled
      ? (actor.system.npcProfile.qualities ?? [])
      : actor.system.manualRole
        ? [{ id: actor.system.manualRole }]
        : [],
    promoted: isPromoted(actor)
  });
  return actor.system.animalPartner === true ? { ...profile, type: "special" } : profile;
};
