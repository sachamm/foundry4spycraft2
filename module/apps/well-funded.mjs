import { wellFundedPlan } from "../rules/well-funded.mjs";
import { loc } from "../i18n.mjs";
import { postedReceipt } from "../services/message-lookup.mjs";
import { formDialog } from "./dialog-kit.mjs";
export async function useWellFunded(actor, options = {}) {
  if (actor.type !== "agent" || !actor.isOwner) return null;
  let input = options;
  if (!Object.keys(input).length) {
    input = await formDialog({
      title: loc`Well-Funded: come up with cash`,
      fields: [
        { text: "home", label: loc`Home`, maxlength: 200 },
        { check: "atHome", label: loc`I am at my home` },
        {
          note: loc`Once per mission, receive additional cash equal to $200 × your total Wealth. This records cash received; it does not change your Wealth allocation.`
        }
      ]
    });
    if (!input) return null;
  }
  const state = () => ({ ...actor.system, usagePeriods: actor.usagePeriods }),
    expected = wellFundedPlan(state(), input),
    guard = () => {
      if (JSON.stringify(wellFundedPlan(state(), input)) !== JSON.stringify(expected))
        throw new Error(loc`The Well-Funded source, Wealth or mission changed before this grant completed.`);
    };
  return actor.useLimitedAbility(
    "wellFunded",
    async () => {
      guard();
      const id = foundry.utils.randomID(),
        record = { ...expected, at: game.time?.worldTime ?? 0 },
        esc = foundry.utils.escapeHTML;
      try {
        await actor.update({ ["system.wellFundedGrants." + id]: record });
        guard();
        if (JSON.stringify(actor.system.wellFundedGrants?.[id]) !== JSON.stringify(record))
          throw new Error(loc`The saved cash grant needs review.`);
        return await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: loc`Well-Funded: received $${record.amount} ($200 × total Wealth ${record.wealth}) at ${esc(record.home)}. One mission use spent; no action die or Reserve spent.`,
          flags: { spycraft2: { actorUuid: actor.uuid, wellFunded: { id, ...record } } }
        });
      } catch (error) {
        const posted = postedReceipt(actor, "wellFunded", id);
        if (posted) return posted;
        if (actor.system.wellFundedGrants?.[id]) {
          try {
            await actor.update({ ["system.wellFundedGrants.-=" + id]: null });
          } catch {
            ui.notifications.warn(
              loc`The Well-Funded cash grant may still be saved. Its mission use remains spent; review the cash history before correcting the use count.`
            );
            return { needsReview: true, id };
          }
        }
        throw error;
      }
    },
    { workflow: "wellFundedCash" }
  );
}
