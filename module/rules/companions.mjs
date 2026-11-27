/**
 * Companion characters linked to an owner (`system.companionOf = { ownerUuid, feat }` on the companion).
 *
 * Animal Partner (p.201), an NPC animal:
 * - XP reward no greater than 35 + 5 × the owner's Style and Terrain feats, before its 2 free trained qualities.
 * - A special character: its Threat Level is the owner's career level − 2 and its health grade is 1 higher, using the
 *   special-character vitality and wounds.
 * - Medium or larger gains Wolf Pack Mastery; Small or smaller gains evasion I. No action dice of its own; the owner
 *   may spend theirs for it. Helpful toward the owner.
 * - One partner per selection of the feat.
 *
 * Personal Lieutenant (p.204), an agent:
 * - Career level half the owner's (rounded down); attributes from 32 points; at most 1 action die; never the Animal
 *   Partner or Personal Lieutenant feats; no Wealth, contacts, Interests or Subplots of their own.
 * - Ordinary acquisition requires owner Career Level 6+; Origin grants can bypass that prerequisite.
 * - Gains one level for each two owner levels after acquisition; one lieutenant.
 *
 * If either dies, the owner loses Reputation equal to their career level, or that × $50,000 in Net Worth.
 */
import { NPC_RULES } from "./npc-tables.mjs";
import { loc } from "../i18n.mjs";

export const ANIMAL_PARTNER = "Animal Partner";
export const PERSONAL_LIEUTENANT = "Personal Lieutenant";

const count = (system, name) => (system?.activeFeatSelections ?? []).filter(f => f?.name === name).length;

/** Size grants are derived from the companion build, without purchasing another feat or ability. */
export function animalPartnerBenefits({ active = false, size = null } = {}) {
  const none = { version: 1, feats: [], evasion: 0, needsReview: false, note: null };
  if (!active) return none;
  const small = ["Nuisance", "Fine", "Diminutive", "Tiny", "Small"],
    large = ["Medium", "Large", "Huge", "Gargantuan", "Colossal", "Enormous"];
  if (![...small, ...large].includes(size))
    return {
      ...none,
      needsReview: true,
      note: loc`Animal Partner: verify the animal's Size before granting Wolfpack Mastery or Evasion I.`
    };
  return small.includes(size)
    ? { ...none, evasion: 1, note: loc`Animal Partner grants Evasion I at this Size.` }
    : { ...none, feats: ["Wolfpack Mastery"], note: loc`Animal Partner grants Wolfpack Mastery at this Size.` };
}

/** The highest XP reward an Animal Partner may have. */
export const animalPartnerCap = ownerSystem =>
  35 + 5 * (ownerSystem?.activeFeatSelections ?? []).filter(f => ["style", "terrain"].includes(f?.tree)).length;

export const partnerThreatLevel = ownerLevel => Math.max(1, (Number(ownerLevel) || 0) - 2);

/** NPC qualities with the "trained" tag (marked trainable in the quality catalog). */
export const TRAINED_QUALITIES = Object.freeze(
  (NPC_RULES.qualities ?? []).filter(q => /trainable/i.test(q.costLabel ?? "")).map(q => q.id)
);

/** Review an Animal Partner NPC: [warnings], with the XP counted against the cap. */
export function animalPartnerReview(ownerSystem, npc) {
  const warnings = [];
  if (!ownerSystem?.activeFeatNames?.includes(ANIMAL_PARTNER))
    warnings.push(loc`Animal Partner: the owner no longer has the feat.`);
  if (npc?.npcType !== "animal") warnings.push(loc`Animal Partner: make this NPC an animal.`);
  const qualities = npc?.npcProfile?.qualities ?? [],
    trained = qualities.filter(q => TRAINED_QUALITIES.includes(q?.id)),
    catalog = Object.fromEntries((NPC_RULES.qualities ?? []).map(q => [q.id, q])),
    free = trained
      .map(q => (catalog[q.id]?.cost ?? 0) * (q.units ?? 1))
      .sort((a, b) => b - a)
      .slice(0, 2)
      .reduce((n, c) => n + c, 0);
  if (trained.length < 2) warnings.push(loc`Animal Partner: choose its 2 trained qualities.`);
  const xp = npc?.npcBuild?.xp,
    cap = animalPartnerCap(ownerSystem);
  if (!Number.isFinite(xp))
    warnings.push(
      loc`Animal Partner: finish the NPC build so its XP reward can be checked against the owner's allowance.`
    );
  if (Number.isFinite(xp) && xp - free > cap)
    warnings.push(loc`Animal Partner: XP reward ${xp - free} (without its 2 free trained qualities) exceeds ${cap}.`);
  return { warnings, cap, xp: Number.isFinite(xp) ? xp - free : null };
}

/** Preserve the two-level cadence from the original feat acquisition, including odd owner levels. */
export function lieutenantAdvancement(system, ownerSystem) {
  const acquired = system.companionOf?.ownerLevelAtAcquisition,
    current = ownerSystem?.level;
  if (!Number.isSafeInteger(acquired) || acquired < 0 || !Number.isSafeInteger(current) || current < acquired)
    return { level: null, needsReview: true };
  return { level: Math.floor(acquired / 2) + Math.floor((current - acquired) / 2), needsReview: false };
}

/** Review a Personal Lieutenant agent against its recorded advancement history. */
export function lieutenantReview(system, ownerSystem) {
  const warnings = [],
    advancement = lieutenantAdvancement(system, ownerSystem),
    level = advancement.level;
  if (!ownerSystem?.activeFeatNames?.includes(PERSONAL_LIEUTENANT))
    warnings.push(loc`Personal Lieutenant: the owner no longer has the feat.`);
  if (advancement.needsReview)
    warnings.push(loc`Personal Lieutenant: the GC must verify the owner's Career Level when the feat was gained.`);
  else if ((system.level ?? 0) !== level)
    warnings.push(
      loc`Personal Lieutenant: recorded advancement calls for Career Level ${level}; the saved build is level ${system.level ?? 0}.`
    );
  if (system.pointBuyBudget !== 32) warnings.push(loc`Personal Lieutenant: attributes are bought with 32 points.`);
  for (const feat of [ANIMAL_PARTNER, PERSONAL_LIEUTENANT])
    if (system.activeFeatNames?.includes(feat)) warnings.push(loc`Personal Lieutenant: may not take ${feat}.`);
  if ((system.contacts ?? []).length) warnings.push(loc`Personal Lieutenant: has no contacts of their own.`);
  if ((system.subplots ?? []).length) warnings.push(loc`Personal Lieutenant: has no Subplots.`);
  if (String(system.interests ?? "").trim()) warnings.push(loc`Personal Lieutenant: has no Interests.`);
  if (Object.values(system.wealthAllocation ?? {}).some(value => Number(value) > 0))
    warnings.push(
      loc`Personal Lieutenant: the owner supplies Wealth and equipment. Review the saved personal Wealth allocations with the GC.`
    );
  if (system.actionDice?.value > 1)
    warnings.push(
      loc`Personal Lieutenant: the GC must review extra saved action dice; only the single starting die is allowed.`
    );
  return { warnings, level };
}

/** Whether the owner may add another companion of this kind, given those already linked. */
export function companionSlots(ownerSystem, linked = []) {
  if (ownerSystem?.companionOf?.feat === PERSONAL_LIEUTENANT) return { animalPartner: 0, personalLieutenant: 0 };
  const occupied = linked.filter(c => c.replacementAvailable !== true),
    partners = occupied.filter(c => c.feat === ANIMAL_PARTNER).length,
    lieutenants = occupied.filter(c => c.feat === PERSONAL_LIEUTENANT).length;
  return {
    animalPartner: Math.max(0, count(ownerSystem, ANIMAL_PARTNER) - partners),
    personalLieutenant:
      ownerSystem?.activeFeatNames?.includes(PERSONAL_LIEUTENANT) &&
      ((ownerSystem.level ?? 0) >= 1 || (ownerSystem.level === 0 && ownerSystem.originOnlyCreation === true))
        ? Math.max(0, 1 - lieutenants)
        : 0
  };
}

/** What the owner loses when a companion dies. */
export const companionLoss = ownerSystem => {
  const level = Number(ownerSystem?.level) || 0;
  return { reputation: level, netWorth: level * 50000 };
};
