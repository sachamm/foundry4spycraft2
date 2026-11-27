import { skillPurchasePolicy, skillPurchasePolicyRecord } from "../rules/skill-purchase-policy.mjs";
import { queueResources } from "../services/transactions.mjs";
import { withUndo } from "./undo.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { sameValues } from "../rules/equal.mjs";
import { loc } from "../i18n.mjs";

/** Review purchase-time class-skill policy without changing the points originally allocated. */
export async function reviewSkillPurchasePolicy(actor, options = {}) {
  if (!game.user?.isGM || !actor?.isOwner || actor.type !== "agent" || actor.system.companionOf?.ownerUuid)
    throw Error(loc`The owning GC reviews a player character's skill-cost history.`);
  const before = structuredClone(actor.toObject().system.progression),
    levels = before.map((entry, idx) => ({
      level: idx + 1,
      policy: skillPurchasePolicy(entry, idx + 1, actor.system.campaignEffects)
    }));
  if (!levels.length) throw Error(loc`Add a career level before reviewing skill-cost history.`);
  let input = options;
  if (input.confirmed !== true)
    input = await systemDialog.input({
      window: { title: loc`${actor.name}: skill-cost history` },
      position: { width: 620 },
      rejectClose: false,
      ok: { label: loc`Record purchase rules` },
      content: `<div class="spycraft2-roll-options"><p>${loc`Record whether Jack-of-All-Trades applied when skills were bought at this career level. This preserves allocated points; ranks are recalculated from the reviewed purchase-time costs. Current season rules do not determine earlier costs.`}</p>
    <label>${loc`Career level`} <select name="level">${levels.map(row => `<option value="${row.level}"${row.level === (levels.find(l => l.policy.needsReview)?.level ?? 1) ? " selected" : ""}>${loc`Level ${row.level}`}: ${row.policy.needsReview ? loc`review needed` : row.policy.recorded ? (row.policy.allSkillsClass ? loc`Jack-of-All-Trades recorded` : loc`normal class-skill rules recorded`) : loc`no saved campaign policy`}</option>`).join("")}</select></label>
    <label>${loc`Rules at that level's skill purchase`} <select name="policy"><option value="">${loc`Choose the historical rules`}</option><option value="normal">${loc`Normal class-skill costs`}</option><option value="all">${loc`Jack-of-All-Trades: every skill was a class skill`}</option></select></label>
    <label>${loc`Source or review note`} <input name="note" type="text" required /></label>
    <label><input type="checkbox" name="confirmed" /> ${loc`The GC confirms these purchase-time rules from the character's history`}</label></div>`
    });
  if (!input) return null;
  return queueResources([actor], async () => {
    if (
      !game.user?.isGM ||
      !actor.isOwner ||
      actor.type !== "agent" ||
      actor.system.companionOf?.ownerUuid ||
      !sameValues(before, actor.toObject().system.progression)
    )
      throw Error(loc`The character or skill-purchase history changed during review. Reopen it.`);
    const level = Number(input.level);
    if (
      !Number.isSafeInteger(level) ||
      level < 1 ||
      level > before.length ||
      !["normal", "all"].includes(input.policy) ||
      input.confirmed !== true
    )
      throw Error(loc`Choose a career level and confirm its historical skill-cost rules.`);
    const record = skillPurchasePolicyRecord(
        level,
        { allSkillsClass: input.policy === "all" ? 1 : 0 },
        {
          source: "gc-review",
          reviewerId: game.user.id,
          note: input.note,
          at: game.time?.worldTime ?? 0
        }
      ),
      next = structuredClone(before);
    next[level - 1].skillPolicy = record;
    await withUndo(
      [actor],
      loc`${actor.name}: level ${level} skill costs reviewed as ${input.policy === "all" ? loc`Jack-of-All-Trades` : loc`normal class-skill rules`}`,
      async () => {
        try {
          await actor.update({ "system.progression": next });
        } catch (error) {
          if (!sameValues(actor.toObject().system.progression, next)) throw error;
        }
      }
    );
    return record;
  });
}
