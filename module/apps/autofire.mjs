/**
 * Autofire Mastery, p.180: once per round per opponent, when the character hits an opponent with a ranged attack,
 * each teammate gains +2 to ranged attack checks against that opponent for 1 full round. A resolved ranged hit offers
 * the announcement; it is refused if this character already announced it against the same opponent this round.
 */
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

export function autofireMasteryUsed(messages, actorUuid, targetUuid, rollCombat) {
  return [...(messages ?? [])].some(m => {
    const a = m.flags?.spycraft2?.autofireMastery;
    return (
      a &&
      m.flags.spycraft2.actorUuid === actorUuid &&
      a.targetUuid === targetUuid &&
      a.combatId === rollCombat?.id &&
      a.round === rollCombat?.round
    );
  });
}

rollPipeline.register({
  id: "autofireMasteryControl",
  kinds: ["attack"],
  order: 9763,
  chatControls({ check, actor }) {
    const target = check.attackContext?.targetActorUuid;
    if (
      check.checkKind !== "attack" ||
      check.attackContext?.ranged !== true ||
      check.successConfirmed !== true ||
      check.superseded ||
      !target ||
      !check.rollCombat ||
      !actor?.system?.activeFeatNames?.includes("Autofire Mastery") ||
      autofireMasteryUsed(game.messages, actor.uuid, target, check.rollCombat)
    )
      return null;
    return [
      {
        label: loc`Autofire Mastery: team +2`,
        hint: loc`Autofire Mastery: teammates +2 against this opponent`,
        run: () => {
          if (autofireMasteryUsed(game.messages, actor.uuid, target, check.rollCombat))
            throw new Error(loc`Autofire Mastery was already used against this opponent this round.`);
          const name = fromUuidSync(target)?.name ?? loc`the opponent`;
          return ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: foundry.utils.escapeHTML(
              loc`Autofire Mastery: for 1 full round, ${actor.name}’s teammates gain +2 to ranged attack checks against ${name} (p.180).`
            ),
            flags: {
              spycraft2: {
                actorUuid: actor.uuid,
                autofireMastery: { targetUuid: target, combatId: check.rollCombat.id, round: check.rollCombat.round }
              }
            }
          });
        }
      }
    ];
  }
});
