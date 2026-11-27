import { loc } from "../i18n.mjs";

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
      (actor?.type === "npc" && (["special", "villain"].includes(system.npcType) || promoted)))
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
