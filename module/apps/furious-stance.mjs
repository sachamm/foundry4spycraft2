/**
 * Furious Stance at the end of each round, carried out by the GC's client (see module/rules/furious-stance.mjs).
 * When a started combat moves to a later round, each combatant in the stance gains one Count per melee attack it
 * made in the round that just ended. The combatant keeps a record of the last round counted.
 */
import { furiousMeleeAttackCount, furiousStanceRoundPlan, furiousStanceNote } from "../rules/furious-stance.mjs";
import { loc } from "../i18n.mjs";

const checkRecords = () =>
  [...(globalThis.game?.messages ?? [])].map(m => m.flags?.spycraft2).filter(c => c?.checkKind === "attack");

export async function applyFuriousStanceRound(combat, round) {
  const records = checkRecords();
  for (const c of combat.combatants ?? []) {
    const actor = c.actor;
    if (!actor || !["agent", "npc"].includes(actor.type)) continue;
    let plan = null;
    try {
      plan = furiousStanceRoundPlan(actor.system, {
        initiative: c.initiative,
        combatId: combat.id,
        round,
        count: furiousMeleeAttackCount(records, { actorUuid: actor.uuid, combatId: combat.id, round }),
        record: c.flags?.spycraft2?.furiousStance ?? null
      });
    } catch (error) {
      ui.notifications.warn(loc`${actor.name}: ${error.message}`);
      continue;
    }
    if (!plan) continue;
    await c.update({ initiative: plan.initiative, "flags.spycraft2.furiousStance": plan.record });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      whisper: ChatMessage.getWhisperRecipients?.("GM") ?? [],
      content: `<p>${foundry.utils.escapeHTML(furiousStanceNote(actor.name, plan))}</p>`
    });
  }
}

export function installFuriousStanceHooks() {
  Hooks.on("preUpdateCombat", (combat, changed, options) => {
    if (Object.hasOwn(changed, "round")) options.spycraft2FuriousFromRound = combat.round;
  });
  Hooks.on("updateCombat", (combat, changed, options) => {
    if (game.users?.activeGM?.isSelf !== true || !combat.started || !Object.hasOwn(changed, "round")) return;
    const ended = changed.round - 1;
    // Only a move forward ends a round; a rewind or a jump of several rounds counts just the round before.
    if (!Number.isSafeInteger(ended) || ended < 1) return;
    if (Number.isSafeInteger(options?.spycraft2FuriousFromRound) && options.spycraft2FuriousFromRound >= changed.round)
      return;
    applyFuriousStanceRound(combat, ended).catch(error =>
      ui.notifications.warn(loc`Furious Stance Count needs review: ${error.message}`)
    );
  });
}
