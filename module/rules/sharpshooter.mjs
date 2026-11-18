import { cqbRangedWeapon } from "./cqb.mjs";
/** p.182: reduce only a positive Size bonus against this ranged attack. */
export function sharpshooterDefensePlan(
  system,
  { ranged = false, attackerSystem = null, attackerWeapon = null, opponentConfirmed = false } = {}
) {
  const active = attackerSystem?.activeFeatNames?.includes("Sharpshooter Basics") === true;
  if (!active) return { active: false, sizeReduction: 0 };
  if (!ranged || !attackerWeapon || !cqbRangedWeapon(attackerWeapon) || typeof opponentConfirmed !== "boolean")
    throw Error("Sharpshooter Basics requires the selected ranged weapon, ranged attack and opponent declaration.");
  if (!opponentConfirmed) return { active: false, sizeReduction: 0 };
  if (!Number.isSafeInteger(system.sizeModifier))
    throw Error("Prepare the target’s actual Size Defense modifier before applying Sharpshooter Basics.");
  const originalSizeBonus = Math.max(0, system.sizeModifier),
    retainedSizeBonus = Math.floor(originalSizeBonus / 2);
  return {
    version: 1,
    active: true,
    originalSizeBonus,
    retainedSizeBonus,
    sizeReduction: originalSizeBonus - retainedSizeBonus
  };
}
