import { reflexDamagePlan } from "../rules/defense.mjs";
/** Read-only Evasion adjustment using a recorded Reflex save; health and other mitigation are separate. */
export async function checkReflexDamage(actor) {
  if (actor?.type !== "agent" || !actor.isOwner) return null;
  const saves = [...(game.messages ?? [])]
      .filter(
        m =>
          m.flags?.spycraft2?.actorUuid === actor.uuid &&
          m.flags.spycraft2.checkKind === "save" &&
          m.flags.spycraft2.checkId === "ref" &&
          m.flags.spycraft2.evasionContext &&
          !m.flags.spycraft2.superseded &&
          (!m.blind || game.user?.isGM)
      )
      .reverse(),
    esc = foundry.utils.escapeHTML;
  if (!saves.length) return ui.notifications.warn("Make a Reflex save with recorded Evasion context first.");
  const input = await foundry.applications.api.DialogV2.input({
    window: { title: "Reflex save — Evasion damage" },
    rejectClose: false,
    content: `<div class="spycraft2-roll-options"><label>Recorded Reflex save <select name="messageId">${saves.map(m => `<option value="${m.id}">${esc(m.flags.spycraft2.baseFlavor ?? "Reflex")} — result ${m.flags.spycraft2.effectiveTotal}, Evasion ${m.flags.spycraft2.evasionContext.grade}${m.flags.spycraft2.evasionContext.flatFooted ? ", flat-footed" : ""}</option>`).join("")}</select></label><label>Source damage before this saving-throw adjustment <input name="damage" type="number" min="0" step="1" value="0" /></label><label>Ordinary damage on a successful save, from the source rule <input name="normalSuccessDamage" type="number" min="0" step="1" value="0" /></label><label>GC-confirmed save outcome <select name="succeeded"><option value="">Choose…</option><option value="true">Succeeded</option><option value="false">Failed</option></select></label><label><input name="confirmed" type="checkbox" /> The GC confirms these damage amounts and the outcome</label><p>Uses the Evasion grade, flat-footedness and damage-reduction eligibility recorded when the save was made. Apply other damage mitigation and health changes separately.</p></div>`
  });
  if (!input) return null;
  const message = game.messages.get(input.messageId);
  if (
    !saves.some(m => m.id === message?.id) ||
    message.flags?.spycraft2?.actorUuid !== actor.uuid ||
    (message.blind && !game.user?.isGM)
  )
    return ui.notifications.warn("That recorded save is no longer available.");
  let plan;
  try {
    const number = k => (typeof input[k] === "string" && input[k].trim() === "" ? NaN : Number(input[k]));
    plan = reflexDamagePlan(message.flags.spycraft2, {
      damage: number("damage"),
      normalSuccessDamage: number("normalSuccessDamage"),
      succeeded: input.succeeded === "true" ? true : input.succeeded === "false" ? false : null,
      confirmed: input.confirmed === true
    });
  } catch (error) {
    return ui.notifications.warn(error.message);
  }
  await foundry.applications.api.DialogV2.input({
    window: { title: "Reflex save — damage result" },
    rejectClose: false,
    content: `<div class="spycraft2-roll-options"><p><b>Damage after the saving throw and Evasion: ${plan.total}</b></p><p>Source damage ${plan.damage}; ordinary successful-save damage ${plan.normalSuccessDamage}; save ${plan.succeeded ? "succeeded" : "failed"}.</p><p>Recorded Evasion grade ${plan.context.grade}; flat-footed ${plan.context.flatFooted ? "yes" : "no"}; save can reduce damage ${plan.context.reflexReducesDamage ? "yes" : "no"}.</p><p>${plan.evaded ? "Evasion: no damage with the successful save." : plan.halved ? "Evasion II: failed-save damage halved, rounded down." : "No Evasion damage adjustment applies."}</p><p>Apply other mitigation and health settlement separately. No health or action dice were changed.</p></div>`
  });
  return plan;
}
