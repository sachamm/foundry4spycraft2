/** Dueling Basics on the Main tab and on attack cards (see module/rules/dueling-basics.mjs). */
import { duelingBasicsPlan } from "../rules/dueling-basics.mjs";
import { attackCharacterTargetChoices } from "./character-target.mjs";
import { expertiseCombatContext } from "./combat-expertise.mjs";
import { setConditionStatus } from "../rules/condition-status.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

export async function declareDuelingBasics(actor, options = {}) {
  if (!actor.isOwner) return null;
  const esc = foundry.utils.escapeHTML,
    choices = attackCharacterTargetChoices().filter(a => a.uuid !== actor.uuid);
  let input = options;
  if (!Object.hasOwn(input, "confirmed")) {
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Dueling Basics` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`During your Initiative Count: +2 dodge against one opponent you are aware of, or +1 dodge against all attacks, for 1 full round (p.178).`}</p><label>${loc`Opponent`} <select name="opponentUuid"><option value="">${loc`None: +1 dodge against all attacks`}</option>${choices
        .map(a => `<option value="${esc(a.uuid)}">${esc(a.name)}</option>`)
        .join(
          ""
        )}</select></label><label><input name="confirmed" type="checkbox" /> ${loc`I am aware of the chosen opponent`}</label></div>`
    });
    if (!input) return null;
  }
  const opponent = choices.find(a => a.uuid === input.opponentUuid),
    record = duelingBasicsPlan(actor.system, expertiseCombatContext(actor), {
      ...input,
      opponentUuid: opponent?.uuid ?? "",
      opponentName: opponent?.name ?? ""
    });
  await actor.update({ "system.duelingBasics": record });
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: esc(
      opponent
        ? loc`Dueling Basics: +2 dodge against ${opponent.name}’s attacks until the start of own Initiative Count in round ${record.dueRound}.`
        : loc`Dueling Basics: +1 dodge against all attacks until the start of own Initiative Count in round ${record.dueRound}.`
    )
  });
}

// A missed Dueling Basics reach attack leaves the attacker flat-footed.
rollPipeline.register({
  id: "duelingReachControl",
  kinds: ["attack"],
  order: 9765,
  chatControls({ message, check, actor }) {
    if (
      !check.attackContext?.duelingReach ||
      check.successConfirmed !== false ||
      check.superseded ||
      check.duelingReachMiss
    )
      return null;
    return [
      {
        label: loc`Dueling Basics: flat-footed`,
        hint: loc`Dueling Basics miss: become flat-footed`,
        run: async () => {
          await message.update({ "flags.spycraft2.duelingReachMiss": true });
          return setConditionStatus(actor, "flat-footed", true, { label: loc`Flat-footed`, aliases: ["flatFooted"] });
        }
      }
    ];
  }
});

// No Quarter: the hit's damage roll gives up the recorded sneak attack dice.
rollPipeline.register({
  id: "noQuarterControl",
  kinds: ["attack"],
  order: 9766,
  chatControls({ check, actor }) {
    const nq = check.attackContext?.noQuarter;
    if (!nq || check.successConfirmed !== true || check.superseded) return null;
    const weapon = check.weaponUuid ? fromUuidSync(check.weaponUuid) : null;
    return weapon
      ? [
          {
            label: loc`Roll damage (No Quarter)`,
            hint: loc`Roll damage (No Quarter: ${nq.dice} fewer sneak dice)`,
            run: () => actor.rollDamage(weapon, { noQuarterDice: nq.dice })
          }
        ]
      : null;
  }
});
