/** Campaign combat constants, pp.406–407. Specific feat extensions retain their benefit. */
export function campaignCQBRange(feats = [], effects = {}) {
  const base = Number.isFinite(effects.cqbRange) && effects.cqbRange >= 0 ? effects.cqbRange : 30;
  return feats.includes("Marksmanship Supremacy") ? Math.max(60, base) : base;
}
/** Only player characters receive Blockbuster's successful-save protection. */
export const ignoresSuccessfulHalfSave = (actor, effects = {}) =>
  actor?.type === "agent" && !actor.system?.companionOf?.ownerUuid && effects.ignoreSuccessfulHalfSave === true;
