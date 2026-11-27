/**
 * Not the Face, p.204.
 *
 * While taking Total Defense or Fighting Defensively, the character gains DR equal to their Charisma modifier against
 * melee and unarmed attacks. It is added to the prepared DR for the unarmed and melee weapon attack kinds. The same DR
 * also supplies Charisma damage resistance through the attribute-damage ledger.
 */
export function notTheFaceDR(system, chaMod) {
  if (!system?.activeFeatNames?.includes("Not the Face")) return 0;
  if (!system.totalDefenseState?.active && !system.fightDefensivelyState?.active) return 0;
  return Number.isSafeInteger(chaMod) && chaMod > 0 ? chaMod : 0;
}

export function notTheFaceCharismaResistance(system) {
  const ability = system?.abilities?.cha;
  const modifier = Number.isSafeInteger(ability?.mod)
    ? ability.mod
    : Number.isSafeInteger(ability?.value)
      ? Math.floor((ability.value - 10) / 2)
      : 0;
  return notTheFaceDR(system, modifier);
}
