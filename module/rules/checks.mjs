/** Pure Spycraft 2.0 result-cap logic. Keep raw dice results for auditability. */
export function resolveSkillResult(rawTotal, naturalDie, {cap = null, threat = 20, actionDieBonus = 0, succeeded = null} = {}) {
  // A missing outcome is provisional; a confirmed failure cannot retain threat/Triumph cap exceptions.
  const isThreat = succeeded !== false && threat > 0 && naturalDie >= threat;
  const numericCap = Number(cap);
  const capped = cap !== null && cap !== undefined && Number.isFinite(numericCap);
  // A result of 75+ is a Triumph irrespective of rank, and threats lift the cap.
  const triumph = succeeded !== false && rawTotal >= 75;
  const base = capped && !isThreat && !triumph ? Math.min(rawTotal, numericCap) : rawTotal;
  // Action dice increase the capped result, rather than the otherwise discarded overflow.
  const total = base + actionDieBonus;
  return { rawTotal, total, limited: total !== rawTotal + actionDieBonus, threat: isThreat, triumph: succeeded !== false && total >= 75 };
}

/** Skill-point expenditures are level-local; Spycraft has no fractional ranks. */
export function purchasedSkillRanks(points, isClassSkill, { discountedRanks = 0 } = {}) {
  const n = Number(points);
  if (!Number.isSafeInteger(n) || n < 0) return { ranks: 0, valid: false };
  const cheap=isClassSkill?n:Math.min(n,Math.max(0,discountedRanks)),remaining=n-cheap;
  return {ranks:cheap+Math.floor(remaining/2),valid:isClassSkill||remaining%2===0};
}

/** One skill point per level minimum; first career level receives fourfold points. */
export function availableSkillPoints(classPoints, intelligenceModifier, bonus, careerLevel) {
  return (Math.max(1, Number(classPoints) + Number(intelligenceModifier)) + Number(bonus)) * (careerLevel === 1 ? 4 : 1);
}
