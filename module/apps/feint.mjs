import { attackCharacterTargetChoices } from "./character-target.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
export function feintContent(key, actor) {
  if (!["sleightOfHand", "notice"].includes(key)) return "";
  const acting = key === "sleightOfHand",
    esc = foundry.utils.escapeHTML;
  return `<details><summary>${acting ? loc`Feint action` : loc`Resist Feint`}</summary><p>${loc`Choose ${acting ? loc`Feint Action (Sleight of Hand/DEX, Hands-On and Vision)` : loc`Resist Feint (Notice/WIS, Vision)`} above. Both checks add action error+1. ${acting ? loc`The ordinary action requires one half action during your Initiative Count.` : loc`This rolls only your opposed response.`} Fencing Basics with a readied one-handed FIN sword or Flail Basics with a readied flail supplies +2 gear; these bonuses do not stack.`}</p><label>${loc`Actual opposing character`} <select name="feintOpponentUuid"><option value="">${loc`Unrecorded opponent (manual outcomes)`}</option>${attackCharacterTargetChoices()
    .filter(a => a.uuid !== actor?.uuid)
    .map(a => `<option value="${esc(a.uuid)}">${esc(a.name)}</option>`)
    .join(
      ""
    )}</select></label><label>${loc`Unrecorded opponent name`} <input name="feintOpponentName" maxlength="200" /></label><label><input name="feintAdjacent" type="checkbox" /> ${loc`The opponent is adjacent`}</label><label><input name="feintTargetEligibleConfirmed" type="checkbox" /> ${loc`The GC confirms ${acting ? loc`the opponent has` : loc`I have`} not already been targeted by a successful Feint this round`}</label><label><input name="feintLegalConfirmed" type="checkbox" /> ${loc`The GC confirms the participants and ${acting ? loc`the legal half action is available now` : loc`this is a legal incoming Feint`}`}</label><p>${loc`For a recorded opponent, confirm and resolve both participant checks in chat, then use Feint outcomes on Main. Unrecorded opponents retain manual outcomes. A critical next-attack bonus requires the recorded opponent on that attack. Alternative skills and free actions require their separate workflows.`}</p></details>`;
}

export function feintTargetInput(input, actor) {
  const uuid = input.feintOpponentUuid ?? "";
  if (!uuid) return {};
  const target = attackCharacterTargetChoices().find(a => a.uuid === uuid && a.uuid !== actor.uuid);
  if (!target) throw Error(loc`Choose a currently observed opposing character for Feint.`);
  return { feintOpponentUuid: target.uuid, feintOpponentName: target.name };
}
export function validateFeintTarget(actor, proof) {
  if (!proof?.opponentUuid) return;
  const target = attackCharacterTargetChoices().find(a => a.uuid === proof.opponentUuid && a.uuid !== actor.uuid);
  if (!target || target.name !== proof.opponentName)
    throw Error(loc`The actual Feint opponent changed before posting.`);
  const victim = proof.role === "attacker" ? target : actor;
  for (const row of victim.system.feintHistory ?? []) {
    if (
      row?.version !== 1 ||
      typeof row.sourceMessage !== "string" ||
      typeof row.combatId !== "string" ||
      !Number.isSafeInteger(row.round)
    )
      throw Error(loc`Review the recorded successful Feint history.`);
    if (row.combatId === proof.combat.id && row.round === proof.combat.round)
      throw Error(loc`This character has already been targeted by a successful Feint this round.`);
  }
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "feintTarget",
  order: 1170,
  record: ["feint"],
  validate: ({ actor, options }) => validateFeintTarget(actor, options.feint)
});

// Roll pipeline: this rule's section of the "skill" dialog.
rollPipeline.register({
  id: "feintContent:skill",
  dialogs: ["skill"],
  dialog: ({ actor, key }) => [{ at: 310, html: feintContent(key, actor) }]
});
