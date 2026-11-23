/** Entering and ending a berserker rage from the Main tab (see module/rules/berserker.mjs). */
import {
  berserkerTier,
  berserkerStartPlan,
  berserkerEndPlan,
  berserkerRageState,
  berserkerNote
} from "../rules/berserker.mjs";
import { setConditionStatus } from "../rules/condition-status.mjs";
import { loc } from "../i18n.mjs";
import { formDialog } from "./dialog-kit.mjs";

const combatOf = actor => {
  const c = actor.participatingCombat;
  return c?.started ? { id: c.id, started: true, round: c.round } : null;
};

export async function enterBerserkerRage(actor, options = {}) {
  if (!actor.isOwner) return null;
  const tier = berserkerTier(actor.system);
  let input = options;
  if (tier?.enter === "full" && !Object.hasOwn(input, "actionConfirmed")) {
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Berserker rage` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`Rage for ${tier.duration} rounds: Strength and Constitution +${tier.bonus}, enraged. Afterwards you are ${tier.after} for as many minutes as you raged (pp.183–184).`}</p><label><input name="actionConfirmed" type="checkbox" /> ${loc`I spend a full action to enter the rage`}</label></div>`
    });
    if (!input) return null;
  }
  berserkerStartPlan(actor.system, combatOf(actor), { id: "check", rolledRounds: 1, ...input });
  return actor.useLimitedAbility(
    "berserkerRage",
    async () => {
      const roll = await new Roll(berserkerTier(actor.system).duration).evaluate(),
        rage = berserkerStartPlan(actor.system, combatOf(actor), {
          ...input,
          id: foundry.utils.randomID(),
          rolledRounds: roll.total
        });
      await actor.update({ "system.berserkerRage": rage });
      await setConditionStatus(actor, "enraged", true, { label: loc`Enraged` });
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: foundry.utils.escapeHTML(
          loc`${actor.name} flies into a berserker rage for ${rage.rounds} rounds: Strength and Constitution +${rage.bonus}, enraged.`
        )
      });
      return rage;
    },
    { workflow: "berserkerRage" }
  );
}

export async function endBerserkerRage(actor, options = {}) {
  if (!actor.isOwner) return null;
  const tier = berserkerTier(actor.system),
    state = berserkerRageState(actor.system.berserkerRage, combatOf(actor));
  let input = options;
  if (state.active && tier?.end === "half" && !Object.hasOwn(input, "actionConfirmed")) {
    input = await formDialog({
      title: loc`End the rage`,
      fields: [{ check: "actionConfirmed", label: loc`I spend a half action to calm down` }]
    });
    if (!input) return null;
  }
  const plan = berserkerEndPlan(actor.system, combatOf(actor), input);
  await actor.update({ "system.berserkerRage": null });
  await setConditionStatus(actor, "enraged", false, { label: loc`Enraged` });
  await actor.applyFatigue({
    kind: plan.after,
    source: loc`Berserker rage (${plan.minutes} minutes)`,
    confirmed: true
  });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: foundry.utils.escapeHTML(berserkerNote(actor.name, plan))
  });
  return plan;
}
