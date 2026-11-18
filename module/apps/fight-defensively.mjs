/** Declare Fight Defensively from the sheet (p.357). */
import { fightDefensivelyPlan } from "../rules/fight-defensively.mjs";
import { intenseStancePlan } from "../rules/intense-stance.mjs";
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

/** Intense Stance (Whip Basics, p.180): give up attacks for 1 full round for +2 melee attack and damage the next. */
export async function declareIntenseStance(actor, options = {}) {
  if (!actor.isOwner) return null;
  let input = options;
  if (!Object.hasOwn(input, "confirmed")) {
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Intense Stance` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`Make no attack checks for 1 full round; during the following full round your melee attacks gain +2 to the attack check and damage (p.180).`}</p><label><input name="confirmed" type="checkbox" /> ${loc`I make no attack checks until my next Initiative Count`}</label></div>`
    });
    if (!input) return null;
  }
  const record = {
    ...intenseStancePlan(actor.system, expertiseCombatContext(actor), { confirmed: input.confirmed === true }),
    id: foundry.utils.randomID()
  };
  await actor.update({ "system.intenseStance": record });
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: foundry.utils.escapeHTML(
      loc`Intense Stance: no attacks until the start of own Initiative Count in round ${record.startRound + 1}; then +2 melee attack and damage until round ${record.startRound + 2}.`
    )
  });
}
