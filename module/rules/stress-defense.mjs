import { preparedResistanceSource } from "./resistances.mjs";
/** p.333 resistance still applies to stress; p.339 stress bypasses all DR. */
export function stressDefenseSource(system) {
  return {
    ...preparedResistanceSource(system, "stress"),
    noFear: structuredClone(system.survivalStats.noFear ?? null)
  };
}
export const stressDefenseSourceSnapshot = system => JSON.stringify(stressDefenseSource(system));
export const fireStressDefenseSourceSnapshot = system =>
  JSON.stringify([stressDefenseSource(system), system.activeFeatNames?.includes("Firefighter Training") === true]);
export function stressDefensePlan(system, rawDamage, { fromFire = false } = {}) {
  if (!Number.isSafeInteger(rawDamage) || rawDamage < 0)
    throw new Error("Enter safe nonnegative whole stress damage before prepared resistance.");
  if (typeof fromFire !== "boolean") throw new Error("Confirm whether this stress damage was caused by fire.");
  const source = stressDefenseSource(system),
    firefighter = fromFire && system.activeFeatNames?.includes("Firefighter Training") === true,
    adjustedDamage = firefighter ? Math.floor(rawDamage / 2) : rawDamage,
    resisted = source.resistance === "all" ? adjustedDamage : Math.min(adjustedDamage, source.resistance),
    netDamage = adjustedDamage - resisted;
  return {
    version: 1,
    kind: "stress",
    rawDamage,
    ...source,
    ...(fromFire
      ? {
          fire: {
            confirmed: true,
            firefighter,
            source: firefighter ? "Firefighter Training" : null,
            adjustedDamage,
            reduction: rawDamage - adjustedDamage,
            rounding: "down"
          }
        }
      : {}),
    armorPiercing: "all",
    damageReductionApplied: 0,
    resisted,
    netDamage,
    companionEffectsNegated: netDamage === 0 && (!firefighter || adjustedDamage > 0 || rawDamage === 0)
  };
}
