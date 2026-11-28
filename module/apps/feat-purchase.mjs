/** Feat Purchase (p.407): after a mission an agent may spend XP on one more feat choice. */
import { refuse } from "../error-notices.mjs";

import { campaignLevelRow, campaignRules, featPurchasePlan } from "../rules/campaign-rules.mjs";
import { TABLES } from "../rules/tables.mjs";
import { loc } from "../i18n.mjs";

const levelRow = level => {
  const row = TABLES.levels.find(entry => entry.level === level);
  return row ? campaignLevelRow(row) : null;
};

/** What the feats pane offers under Feat Purchase and Modular, or null when neither is in force. */
export function featTradeContext(system) {
  const effects = campaignRules();
  if (!effects.featPurchase && !effects.modularFeats) return null;
  const plan = featPurchasePlan(system, levelRow(system.level));
  return {
    purchase: effects.featPurchase === true,
    modular: effects.modularFeats === true,
    purchased: system.featTrades?.purchased ?? 0,
    modularValue: system.featTrades?.modular ?? 0,
    purchaseLabel: plan.cost ? loc`Buy a feat for ${plan.cost} XP` : loc`Buy a feat with XP`,
    purchaseHint: plan.allowed ? "" : plan.reason
  };
}

/** Existing macros use the same purchase receipt and mission/XP safeguards as the sheet. */
export async function buyFeatWithXP(actor) {
  if (!actor?.isOwner) return refuse(loc`Only the character's owner or the GC can spend their XP.`);
  if (typeof actor.purchaseFeatChoice !== "function")
    return refuse(loc`Open the character sheet and use its reviewed Feat Purchase action.`);
  return actor.purchaseFeatChoice();
}
