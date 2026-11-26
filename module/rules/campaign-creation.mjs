/** Numeric creation changes from campaign qualities (pp.407–408). No world reads or document writes. */
export function campaignAttributeLevels(effects = {}, standard = [4, 8, 12, 16, 20]) {
  const interval = effects.attributeInterval;
  return Number.isSafeInteger(interval) && interval >= 2 && interval <= 20
    ? Array.from({ length: Math.floor(20 / interval) }, (_, i) => (i + 1) * interval)
    : standard;
}
export function campaignFeatCount(level, standard, effects = {}) {
  const interval = effects.featInterval;
  return Number.isSafeInteger(interval) && interval >= 2 && level > 0 ? 1 + Math.floor(level / interval) : standard;
}
export function campaignProficiencyCount(level, standard, effects = {}) {
  const interval = effects.proficiencyInterval;
  return Number.isSafeInteger(interval) && interval >= 1 ? Math.floor(Math.max(0, level - 1) / interval) : standard;
}
export function campaignXP(value, effects = {}) {
  return Number.isFinite(value) ? Math.floor(value * (effects.xpToLevelFraction ?? 1)) : value;
}
/** User ruling: the first additional Interest remains at level 2; the quality changes subsequent spacing. */
export function campaignInterestCount(level, standard, effects = {}) {
  const interval = effects.interestInterval;
  return Number.isSafeInteger(interval) && interval >= 1
    ? 2 + (level >= 2 ? 1 + Math.floor((level - 2) / interval) : 0)
    : standard;
}
