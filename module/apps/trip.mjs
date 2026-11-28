import { attackCharacterTargetChoices } from "./character-target.mjs";
import { responseOwnSize } from "../rules/trip.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
export function tripDefenseContent(key, actor) {
  if (key !== "acrobatics") return "";
  const esc = foundry.utils.escapeHTML;
  return (
    `<details><summary>${loc`Resist Trip (ordinary incoming action)`}</summary><p>${loc`Choose Resist Trip above: Acrobatics/DEX, Armor Check Penalty and action error+1. Equilibrium Mastery adds its current Covert-count dodge bonus unless you are vulnerable. Only the larger participant gains +4 per Size category. Other character options replacing the response require their separate rules.`}</p><p>${loc`My current Size:`} ` +
    esc(responseOwnSize(actor?.system) ?? loc`GC review`) +
    `</p><label>${loc`Actual attacking character`} <select name="tripOpponentUuid"><option value="">${loc`Unrecorded attacker (manual outcomes)`}</option>` +
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
    `</select></label><label>${loc`Unrecorded attacker name`} <input name="tripOpponentName" maxlength="200" /></label><label><input name="tripAdjacent" type="checkbox" /> ${loc`The attacker is adjacent`}</label><label>${loc`My Size categories minus the attacker’s`} <input name="tripSizeDifference" type="number" min="-11" max="1" step="1" value="0" /></label><label><input name="tripIncomingConfirmed" type="checkbox" /> ${loc`The GC confirms a legal incoming Trip, participants, adjacency and actual Size difference`}</label><p>${loc`For reciprocal recorded characters, finish both cards and use Main’s Trip outcomes. A winning attacking critical earns one Trip final attack at−4. An original critical defensive win earns Main’s Counter-Trip; the second Trip never grants a third. Unrecorded opponents and weapon-quality variants remain separate.`}</p></details>`
  );
}

export function tripDefenseTargetInput(input, actor, { key, check } = {}) {
  if (key !== "acrobatics" || check?.id !== "resist-trip") return {};
  const uuid = input.tripOpponentUuid ?? "";
  if (typeof uuid !== "string") throw Error(loc`Choose the actual Trip attacker.`);
  if (!uuid) return { tripOpponentUuid: "", tripOpponentSize: null };
  const target = attackCharacterTargetChoices().find(a => a.uuid === uuid && a.uuid !== actor.uuid);
  if (!target) throw Error(loc`Choose a currently observed other character as the Trip attacker.`);
  return {
    tripOpponentUuid: target.uuid,
    tripOpponentName: target.name,
    tripOpponentSize: responseOwnSize(target.system)
  };
}
export function validateTripDefenseTarget(actor, proof) {
  if (proof?.version !== 3) return;
  const target = attackCharacterTargetChoices().find(a => a.uuid === proof.opponentUuid && a.uuid !== actor.uuid);
  if (!target || responseOwnSize(target.system) !== proof.opponentSize)
    throw Error(loc`The actual Trip attacker or current Size changed before posting.`);
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "tripDefenseTarget",
  order: 1500,
  validate: ({ actor, options }) => validateTripDefenseTarget(actor, options.tripDefense)
});

// Roll pipeline: this rule's section of the "skill" dialog.
rollPipeline.register({
  id: "tripDefenseContent:skill",
  dialogs: ["skill"],
  dialog: ({ actor, key }) => [{ at: 300, html: tripDefenseContent(key, actor) }]
});
