import { preparedResistanceSource } from "./resistances.mjs";
import { loc } from "../i18n.mjs";
import { campaignStress } from "./campaign-rules.mjs";
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
    throw new Error(loc`Enter safe nonnegative whole stress damage before prepared resistance.`);
  if (typeof fromFire !== "boolean") throw new Error(loc`Confirm whether this stress damage was caused by fire.`);
  const source = stressDefenseSource(system),
    firefighter = fromFire && system.activeFeatNames?.includes("Firefighter Training") === true,
    firefighterDamage = firefighter ? Math.floor(rawDamage / 2) : rawDamage,
    // Tense doubles stress damage and Mellow halves it, minimum 1 (pp.407–408).
    campaign = campaignStress(firefighterDamage),
    adjustedDamage = campaign.amount,
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
            adjustedDamage: firefighterDamage,
            reduction: rawDamage - firefighterDamage,
            rounding: "down"
          }
        }
      : {}),
    ...(campaign.multiplier !== 1
      ? { campaignQuality: { multiplier: campaign.multiplier, before: firefighterDamage, after: adjustedDamage } }
      : {}),
    armorPiercing: "all",
    damageReductionApplied: 0,
    resisted,
    netDamage,
    companionEffectsNegated: netDamage === 0 && (!firefighter || firefighterDamage > 0 || rawDamage === 0)
  };
}
