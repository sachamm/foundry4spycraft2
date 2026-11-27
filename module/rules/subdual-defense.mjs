import { preparedResistanceSource, subdualTypeSource, damageResistancePlan } from "./resistances.mjs";
import { armorTrainingDRForAttack } from "./armor-training.mjs";
import { loc } from "../i18n.mjs";
import { specialistDRIncrement } from "./weapon-specialist.mjs";
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
export function subdualDefenseSource(system, attackKind, weaponProficiency = "", typedDamageType = null) {
  if (!Object.hasOwn(SUBDUAL_ATTACK_KINDS, attackKind))
    throw new Error(loc`Choose the actual incoming attack’s DR category.`);
  const dr = system.armorDRByAttack?.[attackKind],
    face = ["unarmed", "meleeWeapon"].includes(attackKind) ? (system.notTheFaceDR ?? 0) : 0,
    typedResistanceSource = subdualTypeSource(system, typedDamageType);
  if (!Number.isSafeInteger(dr) || dr < 0 || dr !== armorTrainingDRForAttack(system, attackKind) + face)
    throw new Error(loc`Prepare and review the listed DR for this attack category.`);
  return {
    attackKind,
    listedDR: dr + specialistDRIncrement(system, attackKind, weaponProficiency),
    ...(weaponProficiency ? { weaponProficiency } : {}),
    ...(typedResistanceSource ? { typedDamageType, typedResistanceSource } : {}),
    components: structuredClone(system.damageReductionComponents),
    armorTraining: structuredClone(system.armorFeatRules ?? null),
    armorItems: [...(system.armor?.items ?? [])].sort(),
    ...preparedResistanceSource(system, "subdual")
  };
}
export const subdualDefenseSourceSnapshot = (system, kind, weaponProficiency = "", typedDamageType = null) =>
  JSON.stringify(subdualDefenseSource(system, kind, weaponProficiency, typedDamageType));
/** pp.332–333,339: AP reduces DR, each remaining point absorbs two subdual, then resistance applies. */
export function subdualDefensePlan(
  system,
  {
    rawDamage,
    attackKind,
    weaponProficiency = "",
    armorPiercing = 0,
    armorPiercingAll = false,
    criticalHit = false,
    typedDamageType = null
  } = {}
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
  const source = subdualDefenseSource(system, attackKind, weaponProficiency, typedDamageType),
    temporaryDR = armorPiercingAll ? 0 : Math.max(0, source.listedDR - armorPiercing),
    effectiveDR = temporaryDR * 2;
  if (!Number.isSafeInteger(effectiveDR)) throw new Error(loc`The doubled subdual DR cannot be represented safely.`);
  const afterDR = Math.max(0, rawDamage - effectiveDR),
    bruising = rawDamage > 0 && temporaryDR > 0 && afterDR === 0 ? 1 : 0,
    beforeResistance = afterDR + bruising,
    resisted = source.resistance === "all" ? beforeResistance : Math.min(beforeResistance, source.resistance),
    typedResistance = source.typedResistanceSource
      ? damageResistancePlan(system, typedDamageType, beforeResistance - resisted, source.typedResistanceSource)
      : null,
    netDamage = typedResistance?.net ?? beforeResistance - resisted;
  return {
    version: 1,
    kind: "subdual",
    rawDamage,
    ...source,
    armorPiercing: armorPiercingAll ? 0 : armorPiercing,
    armorPiercingAll,
    temporaryDR,
    effectiveDR,
    afterDR,
    bruising,
    beforeResistance,
    resisted,
    ...(typedResistance ? { typedResistance } : {}),
    netDamage,
    originalDamageNegatedByDR: bruising > 0,
    companionEffectsNegated: netDamage === 0,
    criticalBruisingReview: criticalHit && bruising > 0 && netDamage > 0
  };
}
