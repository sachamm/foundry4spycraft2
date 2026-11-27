import { formDialog } from "./dialog-kit.mjs";
import { refuse } from "../error-notices.mjs";
import { campaignSkillDCPlan } from "../rules/campaign-skill-dc.mjs";
import { loc } from "../i18n.mjs";

export async function resolveCampaignSkillDC(actor, message) {
  if (!actor?.isOwner || message.flags?.spycraft2?.actorUuid !== actor.uuid) return null;
  if (message.blind && !game.user?.isGM) return refuse(loc`The GC resolves secret results.`);
  const input = await formDialog({
    title: loc`Resolve against campaign DC`,
    ok: loc`Resolve check`,
    fields: [
      { number: "baseDC", label: loc`Source DC before campaign modifiers`, min: "0", step: "1", required: true },
      { check: "confirmed", label: loc`The GC confirms this fixed DC; this is not an opposed check` },
      {
        note: loc`Uses the campaign DC policy recorded with this check. Include other source-specific DC adjustments in the entered value.`
      }
    ]
  });
  if (!input) return null;
  try {
    const baseDC = String(input.baseDC ?? "").trim() === "" ? NaN : Number(input.baseDC);
    const plan = campaignSkillDCPlan(message.flags.spycraft2, { baseDC, confirmed: input.confirmed === true });
    return await actor.confirmCheckOutcome(message, {
      succeeded: plan.succeeded,
      difficultyClass: plan.dc,
      campaignDC: plan
    });
  } catch (error) {
    return refuse(error.message);
  }
}
