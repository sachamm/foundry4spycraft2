/** Declare Fight Defensively from the sheet (p.357). */
import { fightDefensivelyPlan } from "../rules/fight-defensively.mjs";
import { expertiseCombatContext } from "./combat-expertise.mjs";
import { restraintActionBlock } from "../rules/restraints.mjs";
import { loc } from "../i18n.mjs";

export async function declareFightDefensively(actor, options = {}) {
  if (!actor.isOwner) return null;
  let input = options;
  if (!Object.hasOwn(input, "confirmed")) {
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Fight Defensively` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`Free action at the start of your Initiative Count: −4 to every attack and skill check and +2 dodge to Defense for 1 full round (p.357).`}</p><label><input name="confirmed" type="checkbox" /> ${loc`I take this free action and accept the penalty for the full round`}</label></div>`
    });
    if (!input) return null;
  }
  const block = restraintActionBlock(actor.system, { free: true });
  if (block) throw new Error(block);
  const record = {
    ...fightDefensivelyPlan(actor.system, expertiseCombatContext(actor), {
      confirmed: input.confirmed === true,
      enraged: actor.system.berserkerRageState?.active === true || actor.system.conditionContext?.enraged === true
    }),
    id: foundry.utils.randomID()
  };
  await actor.update({ "system.fightDefensively": record });
  const s = actor.system.fightDefensivelyState ?? {},
    extra = [
      s.equilibrium ? loc`+${s.equilibrium} dodge from Equilibrium Supremacy` : "",
      s.tribesman ? loc`+${s.tribesman} Defense from Tribesman` : ""
    ].filter(Boolean);
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: foundry.utils.escapeHTML(
      loc`Fight Defensively: −4 to all attack and skill checks; +2 dodge Defense until the start of own Initiative Count in round ${record.dueRound}.` +
        (extra.length ? ` (${extra.join("; ")})` : "")
    ),
    flags: { spycraft2: { actorUuid: actor.uuid, checkKind: "fightDefensively", fightDefensively: record } }
  });
}
