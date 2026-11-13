/** Pure Spycraft 2.0 result-cap logic. Keep raw dice results for auditability. */
export function resolveSkillResult(rawTotal, naturalDie, {cap = null, threat = 20, actionDieBonus = 0} = {}) {
  const isThreat = naturalDie >= threat;
  const numericCap = Number(cap);
  const capped = cap !== null && cap !== undefined && Number.isFinite(numericCap);
  // A result of 75+ is a Triumph irrespective of rank, and threats lift the cap.
  const triumph = rawTotal + actionDieBonus >= 75;
  const base = capped && !isThreat && !triumph ? Math.min(rawTotal, numericCap) : rawTotal;
  // Action dice increase the capped result, rather than the otherwise discarded overflow.
  const total = base + actionDieBonus;
  return { rawTotal, total, limited: total !== rawTotal + actionDieBonus, threat: isThreat, triumph: total >= 75 };
}

/** A check made with 0 ranks is untrained: its error range grows by 2 (base 1 becomes 1-3). */
export function skillErrorRange(ranks, base = 1) {
  return Number(base) + (Number(ranks) > 0 ? 0 : 2);
}

/** Vitality gained at one career level: die result plus Constitution modifier, never less than 1. */
export function vitalityGain(dieResult, conModifier) {
  return Math.max(1, Number(dieResult) + Number(conModifier));
}

const STRENGTH_PROFICIENCIES = ["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged", "hurled", "exoticHurled"];
/**
 * Melee, unarmed and non-explosive hurled attacks add the Strength modifier to damage.
 * Grenades and other hurled weapons whose damage has a special type (expl, fire, flash...) do not.
 */
export function damageAddsStrength(proficiency, damage) {
  if (!STRENGTH_PROFICIENCIES.includes(proficiency)) return false;
  return /^\s*\+?\s*\d*d\d+(\s*[+-]\s*\d+)?\s*(sub(dual)?|lethal)?\s*$/i.test(String(damage ?? ""));
}

/** Damage roll formula with a Strength modifier applied; a penalty cannot take damage below 1. */
export function strengthDamageFormula(formula, strModifier) {
  const m = Number(strModifier) || 0;
  if (!m) return formula;
  return m > 0 ? `${formula} + ${m}` : `max(${formula} - ${-m}, 1)`;
}

/** Skill-point expenditures are level-local; Spycraft has no fractional ranks. */
export function purchasedSkillRanks(points, isClassSkill) {
  const n = Number(points);
  if (!Number.isSafeInteger(n) || n < 0) return { ranks: 0, valid: false };
  return { ranks: isClassSkill ? n : Math.floor(n / 2), valid: isClassSkill || n % 2 === 0 };
}

/** One skill point per level minimum; first career level receives fourfold points. */
export function availableSkillPoints(classPoints, intelligenceModifier, bonus, careerLevel) {
  return Math.max(1, Number(classPoints) + Number(intelligenceModifier) + Number(bonus)) * (careerLevel === 1 ? 4 : 1);
}
