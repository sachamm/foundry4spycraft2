/** Gunslinger’s Eye on the Main tab (see module/rules/gunslinger.mjs). */
import { gunslingerReading, gunslingerNote } from "../rules/gunslinger.mjs";
import { attackCharacterTargetChoices } from "./character-target.mjs";
import { loc } from "../i18n.mjs";

export async function useGunslingersEye(actor, options = {}) {
  if (!actor.isOwner) return null;
  const esc = foundry.utils.escapeHTML,
    choices = attackCharacterTargetChoices().filter(a => a.uuid !== actor.uuid);
  let input = options;
  if (!Object.hasOwn(input, "targetUuid")) {
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Gunslinger’s Eye` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`Free action: size up a character to learn their ranged attack bonus, Initiative bonus and number of Ranged Combat feats. Once per character per mission (p.182).`}</p><label>${loc`Character`} <select name="targetUuid">${choices
        .map(a => `<option value="${esc(a.uuid)}">${esc(a.name)}</option>`)
        .join("")}</select></label></div>`
    });
    if (!input) return null;
  }
  const target = choices.find(a => a.uuid === input.targetUuid),
    mission = String(actor.usagePeriods?.mission ?? "initial").replaceAll(".", "%2E"),
    history = actor.flags?.spycraft2?.gunslingersEye ?? {};
  const reading = gunslingerReading(target, { history, mission });
  return actor.useLimitedAbility(
    "gunslingersEye",
    async () => {
      await actor.update({
        [`flags.spycraft2.gunslingersEye.${mission}`]: [...(history[mission] ?? []), target.uuid]
      });
      return ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        whisper: [...new Set([game.user.id, ...(ChatMessage.getWhisperRecipients?.("GM") ?? []).map(u => u.id)])],
        content: esc(gunslingerNote(target, reading))
      });
    },
    { workflow: "gunslingersEye" }
  );
}
