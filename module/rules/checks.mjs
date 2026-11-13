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
