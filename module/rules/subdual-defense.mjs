import { preparedResistanceSource } from "./resistances.mjs";
import { armorTrainingDRForAttack } from "./armor-training.mjs";
import { loc } from "../i18n.mjs";
import { specialistDefense } from "./weapon-specialist.mjs";
/** DR categories of an incoming attack. The labels are read when asked for, in the reader's language. */
export const SUBDUAL_ATTACK_KINDS = {
  get unarmed() {
    return loc`Unarmed attack`;
  },
  get meleeWeapon() {
    return loc`Melee weapon`;
  },
  get hurledWeapon() {
    return loc`Non-grenade hurled weapon`;
  },
  get rangedWeapon() {
    return loc`Other ranged weapon`;
  },
  get other() {
    return loc`Other damage source`;
  }
};
export function subdualDefenseSource(system, attackKind) {
  if (!Object.hasOwn(SUBDUAL_ATTACK_KINDS, attackKind))
    throw new Error(loc`Choose the actual incoming attack’s DR category.`);
  const dr = system.armorDRByAttack?.[attackKind];
  if (!Number.isSafeInteger(dr) || dr < 0 || dr !== armorTrainingDRForAttack(system, attackKind))
    throw new Error(loc`Prepare and review the listed DR for this attack category.`);
  return {
    attackKind,
    listedDR: dr,
    components: structuredClone(system.damageReductionComponents),
    armorTraining: structuredClone(system.armorFeatRules ?? null),
    armorItems: [...(system.armor?.items ?? [])].sort(),
    ...preparedResistanceSource(system, "subdual")
  };
}
export const subdualDefenseSourceSnapshot = (system, kind) => JSON.stringify(subdualDefenseSource(system, kind));
/** pp.332–333,339: AP reduces DR, each remaining point absorbs two subdual, then resistance applies. */
export function subdualDefensePlan(
  system,
  { rawDamage, attackKind, armorPiercing = 0, armorPiercingAll = false, criticalHit = false, proficiency = "" } = {}
) {
  if (
    !Number.isSafeInteger(rawDamage) ||
    rawDamage < 0 ||
    !Number.isSafeInteger(armorPiercing) ||
    armorPiercing < 0 ||
    typeof armorPiercingAll !== "boolean" ||
    typeof criticalHit !== "boolean"
  )
    throw new Error(loc`Confirm whole subdual damage/AP and the actual AP(all)/critical checkboxes.`);
  // Weapon Specialist Foibles (p.50): DR 1/— more against the attacking weapon's chosen proficiencies.
  const foibles = proficiency ? specialistDefense(system, proficiency).damageReduction : 0;
  const source = subdualDefenseSource(system, attackKind),
    temporaryDR = armorPiercingAll ? 0 : Math.max(0, source.listedDR + foibles - armorPiercing),
    effectiveDR = temporaryDR * 2;
  if (!Number.isSafeInteger(effectiveDR)) throw new Error(loc`The doubled subdual DR cannot be represented safely.`);
  const afterDR = Math.max(0, rawDamage - effectiveDR),
    bruising = rawDamage > 0 && temporaryDR > 0 && afterDR === 0 ? 1 : 0,
    beforeResistance = afterDR + bruising,
    resisted = source.resistance === "all" ? beforeResistance : Math.min(beforeResistance, source.resistance),
    netDamage = beforeResistance - resisted;
  return {
    version: 1,
    kind: "subdual",
    rawDamage,
    ...source,
    armorPiercing: armorPiercingAll ? 0 : armorPiercing,
    armorPiercingAll,
    foibles,
    temporaryDR,
    effectiveDR,
    afterDR,
    bruising,
    beforeResistance,
    resisted,
    netDamage,
    originalDamageNegatedByDR: bruising > 0,
    companionEffectsNegated: netDamage === 0,
    criticalBruisingReview: criticalHit && bruising > 0 && netDamage > 0
  };
}
