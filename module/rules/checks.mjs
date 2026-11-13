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
