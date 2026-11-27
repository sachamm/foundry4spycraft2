import { refuse } from "../error-notices.mjs";
import { savingThrowDamagePlan } from "../rules/defense.mjs";
import { loc } from "../i18n.mjs";
import { formDialog, raw } from "./dialog-kit.mjs";
/** Read-only save adjustment; health and other mitigation are separate. */
export async function checkReflexDamage(actor) {
  if (actor?.type !== "agent" || !actor.isOwner) return null;
  const saves = [...(game.messages ?? [])]
      .filter(
        m =>
          m.flags?.spycraft2?.actorUuid === actor.uuid &&
          m.flags.spycraft2.checkKind === "save" &&
          ["ref", "fort", "will"].includes(m.flags.spycraft2.checkId) &&
          (m.flags.spycraft2.campaignSaveContext || m.flags.spycraft2.evasionContext) &&
          !m.flags.spycraft2.superseded &&
          (!m.blind || game.user?.isGM)
      )
      .reverse(),
    esc = foundry.utils.escapeHTML;
  if (!saves.length) return refuse(loc`Make a save with its recorded context first.`);
  const input = await formDialog({
    title: loc`Save — damage adjustment`,
    fields: [
      {
        select: "messageId",
        label: loc`Recorded save`,
        optionsHtml: raw(
          saves
            .map(
              m =>
                `<option value="${m.id}">${loc`${esc(m.flags.spycraft2.baseFlavor ?? m.flags.spycraft2.checkId)} — result ${m.flags.spycraft2.effectiveTotal}`}</option>`
            )
            .join("")
        )
      },
      {
        number: "damage",
        label: loc`Source damage before this save adjustment`,
        min: "0",
        step: "1",
        value: "0"
      },
      {
        number: "normalSuccessDamage",
        label: loc`Ordinary damage on a successful save, from the source rule`,
        min: "0",
        step: "1",
        value: "0"
      },
      {
        select: "succeeded",
        label: loc`GC-confirmed save outcome`,
        options: [
          ["", loc`Choose…`],
          ["true", loc`Succeeded`],
          ["false", loc`Failed`]
        ]
      },
      { check: "confirmed", label: loc`The GC confirms these damage amounts and the outcome` },
      { check: "successHalves", label: loc`This source normally allows a successful save for half damage` },
      {
        note: loc`Uses the campaign policy and any Evasion context recorded with the save. Apply other damage mitigation and health changes separately.`
      }
    ]
  });
  if (!input) return null;
  const message = game.messages.get(input.messageId);
  if (
    !saves.some(m => m.id === message?.id) ||
    message.flags?.spycraft2?.actorUuid !== actor.uuid ||
    (message.blind && !game.user?.isGM)
  )
    return refuse(loc`That recorded save is no longer available.`);
  let plan;
  try {
    const number = k => (typeof input[k] === "string" && input[k].trim() === "" ? NaN : Number(input[k]));
    plan = savingThrowDamagePlan(message.flags.spycraft2, {
      damage: number("damage"),
      normalSuccessDamage: number("normalSuccessDamage"),
      succeeded: input.succeeded === "true" ? true : input.succeeded === "false" ? false : null,
      confirmed: input.confirmed === true,
      successHalves: input.successHalves === true
    });
  } catch (error) {
    return refuse(error.message);
  }
  await foundry.applications.api.DialogV2.input({
    window: { title: loc`Save — damage result` },
    rejectClose: false,
    content: `<div class="spycraft2-roll-options"><p><b>${loc`Damage after the save: ${plan.total}`}</b></p><p>${loc`Source damage ${plan.damage}; ordinary successful-save damage ${plan.normalSuccessDamage}; save ${plan.succeeded ? "succeeded" : "failed"}.`}</p>${plan.context ? `<p>${loc`Recorded Evasion grade ${plan.context.grade}; flat-footed ${plan.context.flatFooted ? "yes" : "no"}; save can reduce damage ${plan.context.reflexReducesDamage ? "yes" : "no"}.`}</p>` : ""}<p>${plan.blockbuster ? loc`Blockbuster: the successful save prevents this damage and its effects.` : plan.evaded ? loc`Evasion: no damage with the successful save.` : plan.halved ? loc`Evasion II: failed-save damage halved, rounded down.` : loc`No additional save damage adjustment applies.`}</p><p>${loc`Apply other mitigation and health settlement separately. No health or action dice were changed.`}</p></div>`
  });
  return plan;
}
