import { feintBonusRows } from "../rules/feint-bonus.mjs";
import { sideStanceRows } from "../rules/side-stance.mjs";
import { sideDamageUseRows, reviewSideStanceDamage } from "./side-stance-damage.mjs";
import { reviewSideStanceAttack } from "./side-stance.mjs";
import { reviewFeintBonuses } from "./feint-bonus.mjs";
import { attackCharacterTargetChoices } from "./character-target.mjs";
import { loc } from "../i18n.mjs";
export async function reviewFeintBenefits(actor, input = {}) {
  if (!game.user.isGM || !actor.isOwner) throw Error(loc`The GC must review interrupted Feint benefits.`);
  if (!Object.hasOwn(input, "attemptId")) {
    const esc = foundry.utils.escapeHTML,
      name = uuid => attackCharacterTargetChoices().find(a => a.uuid === uuid)?.name ?? "Recorded opponent",
      entries = [],
      errors = [];
    try {
      for (const id of new Set(
        feintBonusRows(actor.system)
          .filter(r => r.usedBy && !r.receiptUuid)
          .map(r => r.usedBy)
      )) {
        const r = feintBonusRows(actor.system).find(r => r.usedBy === id);
        entries.push({
          value: id,
          label: loc`Critical Feint attack — ${name(r.targetUuid)}, Feint round ${r.madeRound}`
        });
      }
    } catch (error) {
      errors.push(error.message);
    }
    try {
      for (const id of new Set(
        sideStanceRows(actor.system)
          .filter(r => r.usedBy && !r.receiptUuid)
          .map(r => r.usedBy)
      )) {
        const r = sideStanceRows(actor.system).find(r => r.usedBy === id);
        entries.push({ value: "side:" + id, label: loc`Side Stance attack — ${name(r.targetUuid)}` });
      }
    } catch (error) {
      errors.push(error.message);
    }
    try {
      for (const r of sideDamageUseRows(actor.system).filter(r => !r.receiptUuid))
        entries.push({ value: "damage:" + r.reservationId, label: loc`Side Stance damage — ${name(r.targetUuid)}` });
    } catch (error) {
      errors.push(error.message);
    }
    if (!entries.length && !errors.length)
      return ui.notifications.info(loc`No interrupted Feint benefit is awaiting review.`);
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Review interrupted Feint benefit` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`Recover any interrupted resource lock first. Review the source and result receipts. A posted attack or damage roll keeps its spent benefit; a confirmed missing result releases only its unused reservation. Leaving Side Stance still discards an unused die, and critical bonus deadlines remain unchanged.`}</p>${errors.map(e => `<p>${esc(e)}</p>`).join("")}<label>${loc`Interrupted result`} <select name="attemptId">${entries.map(e => `<option value="${esc(e.value)}">${esc(e.label)}</option>`).join("")}</select></label><label><input name="confirmed" type="checkbox" /> ${loc`No client is still executing this result; I reviewed its receipts and current resources`}</label></div>`
    });
    if (!input) return null;
  }
  const value = input.attemptId;
  if (typeof value !== "string" || !value) throw Error(loc`Choose a recorded interrupted result.`);
  if (value.startsWith("side:"))
    return reviewSideStanceAttack(actor, { attemptId: value.slice(5), confirmed: input.confirmed });
  if (value.startsWith("damage:"))
    return reviewSideStanceDamage(actor, { reservationId: value.slice(7), confirmed: input.confirmed });
  return reviewFeintBonuses(actor, input);
}
