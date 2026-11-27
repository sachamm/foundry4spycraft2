/** Feat Purchase (p.406): after a mission an agent may spend XP on one more feat choice. */
import { refuse } from "../error-notices.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { campaignLevelRow, campaignRules, featPurchasePlan } from "../rules/campaign-rules.mjs";
import { TABLES } from "../rules/tables.mjs";
import { loc } from "../i18n.mjs";
import { queueRuleState } from "./rule-resource-scope.mjs";
import { withUndo } from "./undo.mjs";

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

export async function buyFeatWithXP(actor) {
  if (!actor?.isOwner) return refuse(loc`Only the character's owner or the GC can spend their XP.`);
  const plan = featPurchasePlan(actor.system, levelRow(actor.system.level));
  if (!plan.allowed) return refuse(plan.reason);
  const ok = await systemDialog.confirm({
    window: { title: loc`Buy a feat with XP` },
    yes: { label: loc`Spend ${plan.cost} XP` },
    no: { label: loc`Cancel` },
    rejectClose: false,
    content: `<p>${loc`Spend ${plan.cost} XP for one more feat choice? Feat Purchase allows this after a mission (p.406).`}</p>`
  });
  if (!ok) return null;
  // Worked out again from the current sheet, one purchase at a time: a second dialog left open cannot buy a feat
  // with XP the first one already spent.
  const spent = await queueRuleState(actor, async () => {
    const now = featPurchasePlan(actor.system, levelRow(actor.system.level));
    if (!now.allowed || now.cost !== plan.cost) return null;
    // An Undo note puts both the XP and the purchase count back.
    await withUndo([actor], loc`Feat bought with XP: ${actor.name}`, () =>
      actor.update({
        "system.xp": now.xp,
        "system.featTrades.purchased": (actor.system.featTrades?.purchased ?? 0) + 1
      })
    );
    return now;
  });
  if (!spent) return refuse(loc`The XP or level changed while the dialog was open. Open Buy a feat again.`);
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p>${loc`${actor.name} spent ${spent.cost} XP on one more feat choice (Feat Purchase).`}</p>`
  });
}
