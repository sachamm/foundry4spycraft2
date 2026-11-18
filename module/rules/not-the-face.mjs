/**
 * Not the Face, p.204.
 *
 * While taking Total Defense or Fighting Defensively, the character gains DR equal to their Charisma modifier against
 * melee and unarmed attacks. It is added to the prepared DR for the unarmed and melee weapon attack kinds. The same DR
 * against Charisma damage is left to the GC (attribute damage has no DR step).
 */
export function notTheFaceDR(system, chaMod) {
  if (!system?.activeFeatNames?.includes("Not the Face")) return 0;
  if (!system.totalDefenseState?.active && !system.fightDefensivelyState?.active) return 0;
  return Number.isSafeInteger(chaMod) && chaMod > 0 ? chaMod : 0;
}
