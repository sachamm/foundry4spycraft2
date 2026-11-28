import { attackCharacterTargetChoices } from "./character-target.mjs";
import { responseOwnSize } from "../rules/trip.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
export function tripAttackContent(key, actor) {
  if (key !== "acrobatics") return "";
  const esc = foundry.utils.escapeHTML;
  return (
    `<details><summary>${loc`Trip action (attacking)`}</summary><p>${loc`Choose Trip Action above: one half action on your Initiative Count, opposed Acrobatics/DEX, Armor Check Penalty and action error+1. Only the larger participant gains +4 per Size category; the target may be at most one category larger. Earned readied Axe/Spear/Whip skill bonuses apply automatically and gear bonuses do not stack.`}</p><p>${loc`My current Size:`} ` +
    esc(responseOwnSize(actor?.system) ?? loc`GC review`) +
    `</p><label>${loc`Actual opposing character`} <select name="tripAttackOpponentUuid"><option value="">${loc`Unrecorded character (manual outcomes)`}</option>` +
    attackCharacterTargetChoices()
      .filter(a => a.uuid !== actor?.uuid)
      .map(
        a =>
          '<option value="' +
          esc(a.uuid) +
          '">' +
          esc(a.name + " — Size " + (responseOwnSize(a.system) ?? "GC review")) +
          "</option>"
      )
      .join("") +
    `</select></label><label>${loc`Unrecorded opponent name`} <input name="tripAttackOpponentName" maxlength="200" /></label><label>${loc`My Size categories minus the target’s`} <input name="tripAttackSizeDifference" type="number" min="-1" max="11" step="1" value="0" /></label><label><input name="tripAttackAdjacent" type="checkbox" /> ${loc`The actual opponent is adjacent`}</label><label><input name="tripAttackParticipantsConfirmed" type="checkbox" /> ${loc`The GC confirms an opposing character and the participants’ actual Sizes`}</label><label><input name="tripAttackHalfActionConfirmed" type="checkbox" /> ${loc`This legal half action is available now on my Initiative Count`}</label><p>${loc`For recorded opposing characters, finish both checks and use Main’s Trip outcomes. A winning critical Trip also earns one Trip final attack at−4. An original critical defensive win earns Main’s Counter-Trip; the second Trip never grants a third. Unrecorded opponents and weapon-quality variants need their separate rules.`}</p></details>`
  );
}
export function tripAttackTargetInput(input, actor, { key, check } = {}) {
  if (key !== "acrobatics" || !["trip", "counter-trip"].includes(check?.id)) return {};
  const uuid = input.tripAttackOpponentUuid ?? "";
  if (typeof uuid !== "string") throw Error(loc`Choose the actual opposing character.`);
  if (!uuid) return { tripAttackOpponentUuid: "", tripAttackOpponentSize: null };
  const target = attackCharacterTargetChoices().find(a => a.uuid === uuid && a.uuid !== actor.uuid);
  if (!target) throw Error(loc`Choose a currently observed other character for Trip.`);
  return {
    tripAttackOpponentUuid: target.uuid,
    tripAttackOpponentName: target.name,
    tripAttackOpponentSize: responseOwnSize(target.system)
  };
}
export function validateTripAttackTarget(actor, proof) {
  if (!proof?.opponentUuid) return;
  const target = attackCharacterTargetChoices().find(a => a.uuid === proof.opponentUuid && a.uuid !== actor.uuid);
  if (!target || responseOwnSize(target.system) !== proof.opponentSize)
    throw Error(loc`The actual Trip opponent or current Size changed before posting.`);
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "tripAttackTarget",
  order: 1480,
  validate: ({ actor, options }) => validateTripAttackTarget(actor, options.tripAttack)
});

// Roll pipeline: this rule's section of the "skill" dialog.
rollPipeline.register({
  id: "tripAttackContent:skill",
  dialogs: ["skill"],
  dialog: ({ actor, key }) => [{ at: 290, html: tripAttackContent(key, actor) }]
});
