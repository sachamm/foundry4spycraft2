/**
 * Campaign qualities (pp.405–408): season-long and per-mission rule switches.
 * Each has an XP modifier when scripted and, for some, a GC action die cost to add mid-mission.
 */
import { GC_DATA } from "../gc-tables.mjs";
import { loc } from "../../i18n.mjs";

export const CAMPAIGN_QUALITIES = GC_DATA.campaignQualities;
export const campaignQuality = id => CAMPAIGN_QUALITIES.find(quality => quality.id === id) ?? null;

/** Qualities in force: the season's, plus those scripted into or added to the current mission. */
export function activeQualities(season = [], mission = []) {
  const ids = new Set();
  const rows = [];
  for (const [source, list] of [
    ["season", season],
    ["mission", mission]
  ]) {
    for (const entry of list ?? []) {
      const id = typeof entry === "string" ? entry : entry?.id,
        quality = campaignQuality(id);
      if (!quality || ids.has(id)) continue;
      ids.add(id);
      rows.push({ ...quality, source, scripted: source === "season" || entry?.scripted !== false });
    }
  }
  return rows;
}

/**
 * Some qualities may never be in force together, such as Faction and Freelance (p.407); either row may list the
 * other under `excludes`. Returns the refusal for the first such pair among these ids, or "".
 */
export function qualityClash(ids = []) {
  const rows = [...new Set(ids)].map(campaignQuality).filter(Boolean);
  for (const [index, quality] of rows.entries())
    for (const other of rows.slice(index + 1))
      if (quality.excludes?.includes(other.id) || other.excludes?.includes(quality.id))
        return loc`${quality.name} and ${other.name} cannot be in force together (p.${quality.page}). Keep one of them.`;
  return "";
}

/** Can this quality be added to the list, and at what cost? */
export function qualityAddition(id, { scope, active = [] }) {
  const quality = campaignQuality(id);
  if (!quality) throw new Error(loc`Unknown campaign quality.`);
  if (active.some(entry => entry.id === id)) throw new Error(loc`${quality.name} is already in force.`);
  const clash = qualityClash([id, ...active.map(entry => entry.id)]);
  if (clash) throw new Error(clash);
  if (scope === "season") return { quality, cost: 0, xp: quality.xp };
  if (quality.seasonOnly) throw new Error(loc`${quality.name} can only be applied to a whole season.`);
  if (scope === "scripted") return { quality, cost: 0, xp: quality.xp };
  if (scope === "spend") {
    if (!Number.isSafeInteger(quality.gcDice) || quality.gcDice < 1)
      throw new Error(loc`${quality.name} has no action die cost, so it cannot be added once a mission is under way.`);
    return { quality, cost: quality.gcDice, xp: 0 }; // added in play: no XP change (p.398)
  }
  throw new Error(loc`Choose season, scripted or spend.`);
}

/** XP the scripted qualities add to (or take from) each mission's base reward. */
export const qualityXP = active =>
  active.filter(quality => quality.scripted).reduce((sum, quality) => sum + quality.xp, 0);

const MERGE = {
  startingActionDice: (a, b) => a + b,
  skillDC: (a, b) => a + b,
  criticalInjuryActivationCost: (a, b) => a + b,
  medicineDC: (a, b) => a + b,
  medicineError: (a, b) => a + b,
  gearCaliberShift: (a, b) => a + b,
  blastIncrementMultiplier: (a, b) => a * b,
  rangeIncrementMultiplier: (a, b) => a * b,
  xpToLevelFraction: (a, b) => a * b,
  attackThreatIncrease: (a, b) => a + b,
  attackModifier: (a, b) => a + b,
  stressMultiplier: (a, b) => a * b,
  complexTaskChallenges: (a, b) => a + b,
  leadAdvantageShift: (a, b) => a + b,
  honorExposureMultiplier: (a, b) => a * b,
  fallingDamageMultiplier: (a, b) => a * b,
  dispositionCheckModifier: (a, b) => a + b,
  surpriseHideBonus: (a, b) => a + b,
  favorableDispositionBonus: (a, b) => a + b,
  actionDieStep: (a, b) => a + b,
  lowestAttributeErrorIncrease: (a, b) => a + b,
  wealthBonus: (a, b) => a + b
};

/**
 * Combined machine-readable effects of the qualities in force. Additive numbers stack; anything
 * else that two qualities set differently is listed under `conflicts` for the GC.
 */
export function campaignEffects(active) {
  const effects = {},
    sources = {},
    conflicts = [],
    bonusFeatTrees = [];
  for (const quality of active) {
    for (const [key, value] of Object.entries(quality.effects ?? {})) {
      if (key === "bonusFeatTree") {
        bonusFeatTrees.push(value);
        continue;
      }
      if (!Object.hasOwn(effects, key)) {
        effects[key] = value;
        sources[key] = [quality.name];
        continue;
      }
      sources[key].push(quality.name);
      if (MERGE[key]) effects[key] = MERGE[key](effects[key], value);
      else if (JSON.stringify(effects[key]) !== JSON.stringify(value))
        conflicts.push({ key, qualities: [...sources[key]] });
    }
  }
  if (bonusFeatTrees.length) effects.bonusFeatTrees = bonusFeatTrees;
  return { effects, sources, conflicts };
}

/** Critical-injury numbers after campaign qualities (default 25–49 to check, 50+ drops to −9 wounds; p.331). */
export function injuryThresholds(effects = {}) {
  const [min, max] = effects.criticalInjuryRange ?? [25, 49];
  return { criticalInjuryMin: min, criticalInjuryMax: max, massiveDamage: effects.massiveDamageThreshold ?? max + 1 };
}

/** A skill DC after campaign qualities such as Cakewalk or Comedy of Errors. */
export function adjustedDC(dc, effects = {}) {
  if (!Number.isFinite(dc)) return dc;
  const shifted = dc + (effects.skillDC ?? 0);
  return Number.isFinite(effects.skillDCMinimum) && (effects.skillDC ?? 0) < 0
    ? Math.max(Math.min(dc, effects.skillDCMinimum), shifted)
    : shifted;
}

/** Starting action dice per session after campaign qualities and the Threat Level bonus (minimum 0). */
export const adjustedStartingDice = (base, effects = {}, threatBonus = 0) =>
  Math.max(0, base + (effects.startingActionDice ?? 0) + threatBonus);
