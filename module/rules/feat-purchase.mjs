import { loc } from "../i18n.mjs";
import { campaignXP } from "./campaign-creation.mjs";

export const featPurchaseKey = mission => encodeURIComponent(String(mission)).replaceAll(".", "%2E");

/** Paid choices remain permanent when the campaign quality later ends. */
export function purchasedFeatSources(records = {}, level = 0, cfg) {
  const sources = [],
    warnings = [];
  for (const [key, record] of Object.entries(records ?? {})) {
    const valid =
      record?.version === 1 &&
      typeof record.mission === "string" &&
      record.mission.trim() &&
      key === featPurchaseKey(record.mission) &&
      Number.isSafeInteger(record.level) &&
      record.level >= 1 &&
      record.level <= 20 &&
      [record.cost, record.beforeXP, record.afterXP, record.minimumXP].every(Number.isSafeInteger) &&
      Number.isFinite(record.xpFraction) &&
      record.xpFraction > 0 &&
      record.cost === 1000 * record.level &&
      record.beforeXP - record.afterXP === record.cost &&
      record.minimumXP === campaignXP(cfg.tables.levels[record.level]?.xp, { xpToLevelFraction: record.xpFraction }) &&
      record.afterXP >= record.minimumXP;
    if (!valid) {
      warnings.push(
        loc`Review the Feat Purchase receipt for mission ${key}; it grants no feat choice until corrected.`
      );
      continue;
    }
    if (record.level <= level)
      sources.push({
        id: `featPurchase:${key}`,
        kind: "featPurchase",
        career: record.level,
        tree: "any",
        levelAllowance: 0,
        label: loc`Feat Purchase: ${record.mission} (Career Level ${record.level})`
      });
  }
  return { sources, warnings };
}

export function featPurchasePlan(
  system,
  records,
  cfg,
  { effects = {}, mission = "", missionActive = true, missionCompleteConfirmed = false, at = 0 } = {}
) {
  if (effects.featPurchase !== true) throw new Error(loc`Feat Purchase must be active for this campaign.`);
  if (
    !missionCompleteConfirmed ||
    missionActive !== false ||
    typeof mission !== "string" ||
    !mission.trim() ||
    mission === "initial"
  )
    throw new Error(loc`Finish the current mission and confirm its XP settlement before purchasing a feat choice.`);
  if (purchasedFeatSources(records, system.level, cfg).warnings.length)
    throw new Error(loc`Review existing Feat Purchase receipts before buying another choice.`);
  const key = featPurchaseKey(mission);
  if (records?.[key]) throw new Error(loc`A feat choice has already been purchased for this mission.`);
  const level = system.level,
    beforeXP = system.xp;
  if (!Number.isSafeInteger(level) || level < 1 || level > 20 || !Number.isSafeInteger(beforeXP) || beforeXP < 0)
    throw new Error(loc`Complete a Career Level 1–20 character with valid XP before purchasing a feat choice.`);
  const xpFraction = effects.xpToLevelFraction ?? 1;
  const minimumXP = campaignXP(cfg.tables.levels[level]?.xp, effects),
    cost = 1000 * level,
    afterXP = beforeXP - cost;
  if (!Number.isSafeInteger(minimumXP) || !Number.isFinite(xpFraction) || xpFraction <= 0 || afterXP < minimumXP)
    throw new Error(
      loc`This purchase costs ${cost} XP and must leave at least ${minimumXP} XP for Career Level ${level}.`
    );
  return { key, record: { version: 1, mission, level, cost, beforeXP, afterXP, minimumXP, xpFraction, at } };
}
