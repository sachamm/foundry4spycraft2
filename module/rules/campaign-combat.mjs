import { loc } from "../i18n.mjs";

/** Keep each factor: p.329 combines multipliers additively, rather than multiplying them. */
export function campaignStressPolicy(effects = {}) {
  const multipliers = effects.stressDamageMultipliers ?? [];
  const minimum = effects.stressDamageMinimum ?? 0;
  if (
    !Array.isArray(multipliers) ||
    multipliers.some(n => !Number.isFinite(n) || n <= 0) ||
    !Number.isSafeInteger(minimum) ||
    minimum < 0
  )
    throw Error(loc`Review the campaign's stress damage modifiers.`);
  return multipliers.length ? { multipliers: [...multipliers], minimum } : null;
}
export function campaignStressDamage(rawDamage, policy = null, sourceMultipliers = []) {
  if (
    policy !== null &&
    (!policy ||
      typeof policy !== "object" ||
      Array.isArray(policy) ||
      !Array.isArray(policy.multipliers) ||
      !Number.isSafeInteger(policy.minimum))
  )
    throw Error(loc`Review the campaign's stress damage modifiers.`);
  if (
    !Number.isSafeInteger(rawDamage) ||
    rawDamage < 0 ||
    !Array.isArray(sourceMultipliers) ||
    sourceMultipliers.some(n => !Number.isFinite(n) || n <= 0)
  )
    throw Error(loc`Review the whole stress damage and its source multipliers.`);
  const checked = campaignStressPolicy(
    policy ? { stressDamageMultipliers: policy.multipliers, stressDamageMinimum: policy.minimum } : {}
  );
  const multipliers = [...(checked?.multipliers ?? []), ...sourceMultipliers];
  const multiplier = Math.max(0, 1 + multipliers.reduce((sum, n) => sum + n - 1, 0));
  const adjustedDamage = rawDamage === 0 ? 0 : Math.max(checked?.minimum ?? 0, Math.floor(rawDamage * multiplier));
  if (!Number.isSafeInteger(adjustedDamage))
    throw Error(loc`The adjusted stress damage exceeds the supported whole-number range.`);
  return { rawDamage, multipliers, multiplier, minimum: checked?.minimum ?? 0, adjustedDamage };
}

/** Campaign combat constants, pp.406–407. Specific feat extensions retain their benefit. */
export function campaignCQBRange(feats = [], effects = {}) {
  const base = Number.isFinite(effects.cqbRange) && effects.cqbRange >= 0 ? effects.cqbRange : 30;
  return feats.includes("Marksmanship Supremacy") ? Math.max(60, base) : base;
}
/** Only player characters receive Blockbuster's successful-save protection. */
export const ignoresSuccessfulHalfSave = (actor, effects = {}) =>
  actor?.type === "agent" && !actor.system?.companionOf?.ownerUuid && effects.ignoreSuccessfulHalfSave === true;

/** Wire Fu applies to player and special characters, including a currently promoted NPC (p.408). */
export function campaignFallingDamageDivisor(actor, effects = {}) {
  const divisor = effects.fallingDamageDivisor ?? 1;
  if (![1, 2].includes(divisor)) throw Error(loc`Review the campaign's falling damage modifier.`);
  const system = actor?.system ?? {},
    promoted =
      system.promoted === true || system.promotion?.mission === String(system.usagePeriods?.mission ?? "initial");
  return divisor === 2 &&
    (actor?.type === "agent" ||
      (actor?.type === "npc" &&
        (system.animalPartner === true || ["special", "villain"].includes(system.npcType) || promoted)))
    ? 2
    : 1;
}

/** User ruling: Fragile does not invent vitality dice for grade-built NPCs. */
export function campaignNpcHealthReview({ special = false, profileEnabled = false, effects = {} } = {}) {
  if (!special || !effects.fixedVitalityByDie) return [];
  return [
    profileEnabled
      ? loc`Fragile: this NPC retains Health-table vitality. The GC must review any exception based on class vitality dice.`
      : loc`Fragile: the GC must review this special character's entered vitality. Class vitality dice use the campaign's fixed later-level gains, plus Constitution.`
  ];
}
