/** Campaign combat constants, pp.406–407. Specific feat extensions retain their benefit. */
export function campaignCQBRange(feats = [], effects = {}) {
  const base = Number.isFinite(effects.cqbRange) && effects.cqbRange >= 0 ? effects.cqbRange : 30;
  return feats.includes("Marksmanship Supremacy") ? Math.max(60, base) : base;
}
