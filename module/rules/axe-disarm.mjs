import { readiedMeleeFeatSource } from "./readied-weapons.mjs";
import { loc } from "../i18n.mjs";
import { stable } from "./equal.mjs";
/** Axe Basics p.176: gear +1 with melee Disarm attacks while holding a readied axe.
 * It need not be the attacking weapon. Ranged attacks get no bonus.
 */
export function axeDisarmPlan(system, { ranged = false } = {}) {
  if (ranged) return null;
  const source = readiedMeleeFeatSource(system, { name: "Axe Basics", family: "axe", bonus: 1 });
  return { version: 1, gearBonus: source ? 1 : 0, source };
}
export function validateAxeDisarmProof(system, disarm, { checkKind, weaponProficiency } = {}) {
  if (!disarm?.axeBasics) return;
  if (
    checkKind !== "attack" ||
    disarm.active !== true ||
    !["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged"].includes(weaponProficiency) ||
    stable(axeDisarmPlan(system)) !== stable(disarm.axeBasics)
  )
    throw Error(loc`The readied axe, Axe Basics source or melee Disarm attack changed before posting.`);
}
