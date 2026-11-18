import { wellFundedPlan } from "../rules/well-funded.mjs";
import { loc } from "../i18n.mjs";
export async function useWellFunded(actor, options = {}) {
  if (actor.type !== "agent" || !actor.isOwner) return null;
  let input = options;
  if (!Object.keys(input).length) {
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Well-Funded: come up with cash` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><label>${loc`Home`} <input name="home" maxlength="200" /></label><label><input name="atHome" type="checkbox" /> ${loc`I am at my home`}</label><p>${loc`Once per mission, receive additional cash equal to $200 × your total Wealth. This records cash received; it does not change your Wealth allocation.`}</p></div>`
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
        const posted = game.messages?.find?.(
          m => m.flags?.spycraft2?.actorUuid === actor.uuid && m.flags.spycraft2.wellFunded?.id === id
        );
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
