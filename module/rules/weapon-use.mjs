import { combatStanceState } from "./combat-stance.mjs";
import { loc } from "../i18n.mjs";

/*
 * Whether a character can use a weapon right now, and with what grip. Kept apart from gear.mjs so the readied-weapon,
 * disarm and melee-trick rules can ask without importing all of gear (and gear, in turn, imports them).
 */

/** Weapon grip, pp.347,349. Zero means use the weapon's normal required grip. */
export function weaponGrip(system, weapon, { hands = weapon.useHands ?? 0 } = {}) {
  const required = Number(String(weapon.sizeHands ?? "").match(/\/\s*([12])h/i)?.[1] ?? 0);
  const size = String(system.size ?? "Medium").split(/[ (]/)[0];
  const small = size === "Small" || system.aging?.small;
  const unarmed = weapon.proficiency === "unarmed";
  const actual = Number(hands) || (!unarmed && small && required === 1 ? 2 : required);
  let reason = weapon.destroyed ? loc`This weapon was destroyed and cannot be used.` : "";
  if (!unarmed && small && required === 2) reason = loc`A Small character cannot use a two-handed weapon (p.349).`;
  else if (!unarmed && small && required === 1 && actual !== 2)
    reason = loc`A Small character must use both hands with a one-handed weapon (p.349).`;
  const supported = ["Medium", "Large", "Huge", "Gargantuan", "Colossal", "Enormous", "Vast"].includes(size);
  if (!unarmed && required === 2 && actual === 1 && !supported)
    reason = loc`Using a two-handed weapon in one hand requires Medium or larger size (p.347).`;
  const grippingOneHand = !unarmed && required === 2 && actual === 1 && combatStanceState(system)?.key === "gripping";
  const rockOneHand =
    required === 2 &&
    actual === 1 &&
    system.activeFeatNames?.includes("Rock and Roll!") &&
    (weapon.proficiency === "rifle" || ["saw", "gpmg", "hmg"].includes(weapon.weaponCategory));
  if ((rockOneHand || grippingOneHand) && !weapon.destroyed) reason = "";
  const bracedGrip = !unarmed && required === 1 && actual === 2;
  return {
    required,
    hands: actual,
    blocked: !!reason,
    reason,
    attackPenalty: rockOneHand || grippingOneHand ? -2 : !unarmed && required === 2 && actual === 1 ? -4 : 0,
    strengthIncrease: bracedGrip ? 4 : 0,
    initiativeLoss: bracedGrip ? 2 : 0
  };
}

/** Legacy reference entries are recognized before their embedded documents are refreshed. */
export function weaponUnavailable(weapon) {
  const possessionReason = possessionUnavailable(weapon);
  if (possessionReason) return possessionReason;
  if (weapon.destroyed) return loc`A destroyed weapon cannot be used until it is replaced.`;
  if (weapon.reserve) return loc`Unassigned or reserved gear is not available for an attack.`;
  if (weapon.quantity === 0) return loc`No copies of this weapon remain.`;
  if (weapon.ammunitionOnly || ["Standard arrow", "Explosive arrow"].includes(weapon.name))
    return loc`This is ammunition. Use it with a matching bow or crossbow; it cannot make an independent attack.`;
  return "";
}

/** Possessions wait for the GC; mixed acquisition records need a review first. */
export function possessionUnavailable(gear) {
  if (gear.favoredGearUnavailableReason) return gear.favoredGearUnavailableReason;
  if (gear.possessionSource && !gear.possessionApproved)
    return loc`The GC must approve this Possession before it enters play (p.216).`;
  if (gear.possessionSource && (gear.pick || gear.reserveAcquisition))
    return loc`Review this item’s conflicting personal and mission acquisition records.`;
  return "";
}
