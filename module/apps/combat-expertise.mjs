import { combatExpertisePlan } from "../rules/combat-expertise.mjs";
import { attributeActionBlock } from "../rules/attributes.mjs";
import { restraintActionBlock } from "../rules/restraints.mjs";
import { queueResources } from "../services/transactions.mjs";
import { loc } from "../i18n.mjs";
export function expertiseCombatContext(actor) {
  const c = actor.participatingCombat,
    own = c?.turns?.find(t => t.actor?.uuid === actor.uuid);
  return c
    ? {
        id: c.id,
        started: c.started,
        round: c.round,
        turn: c.turn,
        combatantId: own?.id,
        ownTurnIndex: c.turns?.findIndex(t => t.id === own?.id) ?? -1
      }
    : null;
}
export async function activateCombatExpertise(actor, options = {}) {
  if (actor.type !== "agent" || !actor.isOwner) return null;
  const snapshot = JSON.stringify(expertiseCombatContext(actor));
  let input = options;
  if (!Object.hasOwn(input, "penalty")) {
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Combat Expertise` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`Free action on your own Initiative Count: take a penalty on every attack and skill check and gain the same amount as a dodge bonus to Defense until the start of your next Initiative Count. The penalty remains even when vulnerability removes the dodge bonus.`}</p><label>${loc`Penalty`} <input name="penalty" type="number" min="1" max="${Math.min(6, actor.system.defense?.base ?? 0)}" step="1" value="1" /></label><label><input name="confirmed" type="checkbox" /> ${loc`I take this free action and accept the penalty for the full round`}</label></div>`
    });
    if (!input) return null;
  }
  return queueResources([actor], async () => {
    if (!actor.isOwner) throw new Error(loc`You must own the character.`);
    const combat = expertiseCombatContext(actor);
    if (JSON.stringify(combat) !== snapshot)
      throw new Error(loc`The Initiative Count changed. Declare Combat Expertise again.`);
    const block =
      restraintActionBlock(actor.system, { free: true }) || attributeActionBlock(actor.system, { kind: "attack" });
    if (
      block ||
      actor.system.conditionContext?.sleeping ||
      actor.system.wounds?.value < 0 ||
      actor.system.mentalLeapState?.unconscious
    )
      throw new Error(block || loc`This character cannot take the Combat Expertise free action.`);
    const refresh = actor.system.refreshAction;
    if (refresh?.state === "waiting" && refresh.combatId === combat?.id && refresh.startRound === combat?.round)
      throw new Error(loc`Refresh forfeited this round’s chance to act.`);
    const penalty = typeof input.penalty === "string" && input.penalty.trim() ? Number(input.penalty) : input.penalty;
    const record = {
      ...combatExpertisePlan(actor.system, combat, { penalty, confirmed: input.confirmed }),
      id: foundry.utils.randomID()
    };
    try {
      await actor.update({ "system.combatExpertise": record });
    } catch (error) {
      if (JSON.stringify(actor.system.combatExpertise) !== JSON.stringify(record)) throw error;
    }
    try {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: loc`Combat Expertise: −${record.penalty} to all attack and skill checks; +${record.penalty} dodge Defense until the start of own Initiative Count in round ${record.dueRound}. Dodge is lost when vulnerable.`,
        flags: {
          spycraft2: {
            actorUuid: actor.uuid,
            checkKind: "combatExpertise",
            actionDiceAllowed: false,
            combatExpertise: record
          }
        }
      });
    } catch (error) {
      ui.notifications.warn(
        loc`Combat Expertise is active, but its chat notice could not be confirmed. Review the character sheet before declaring another use.`
      );
    }
    return record;
  });
}
