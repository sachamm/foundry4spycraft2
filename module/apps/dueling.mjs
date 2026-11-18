/**
 * Dueling Mastery and Supremacy on attack cards (p.178).
 *
 * - Dueling Supremacy: each melee-weapon hit raises the attacker's Initiative Count by 1. The attacker's resolved hit
 *   offers the change once.
 * - Dueling Mastery: an adjacent opponent who misses the character loses 2 from their Initiative Count. The GC
 *   confirms adjacency by using the control on the opponent's resolved miss against that character, once.
 *
 * Their Defense bonuses are prepared with the character (module/rules/engine.mjs).
 */
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

const MELEE = ["blunt", "exoticBlunt", "edged", "exoticEdged"];
const meleeWeaponHit = check =>
  check.checkKind === "attack" &&
  check.attackContext?.ranged === false &&
  check.attackContext?.disarm?.active !== true &&
  MELEE.includes(check.weaponProficiency) &&
  check.resolved === true &&
  !check.superseded;

/** The combatant of an actor in its started combat, if any. */
const combatantOf = actor =>
  [...(globalThis.game?.combats ?? [])]
    .filter(c => c.started)
    .flatMap(c => [...(c.combatants ?? [])])
    .find(c => c.actor?.uuid === actor?.uuid) ?? null;

export async function shiftCount(message, actor, amount, flag, label) {
  const combatant = combatantOf(actor);
  if (!combatant || !Number.isFinite(combatant.initiative))
    throw new Error(loc`${actor?.name ?? loc`This character`} has no rolled Initiative Count in a started combat.`);
  if (message.flags?.spycraft2?.[flag]) throw new Error(loc`${label} was already applied to this attack.`);
  await message.update({ [`flags.spycraft2.${flag}`]: { amount, combatantId: combatant.id } });
  await combatant.update({ initiative: combatant.initiative + amount });
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: foundry.utils.escapeHTML(
      loc`${label}: ${actor.name}’s Initiative Count ${amount > 0 ? "+" : ""}${amount} (now ${combatant.initiative}).`
    )
  });
}

rollPipeline.register({
  id: "duelingControls",
  kinds: ["attack"],
  order: 9760,
  chatControls({ message, check, actor, user }) {
    if (check.checkKind !== "attack" || check.resolved !== true || check.superseded) return null;
    const controls = [];
    if (
      meleeWeaponHit(check) &&
      check.successConfirmed === true &&
      !check.duelingSupremacy &&
      actor?.system?.activeFeatNames?.includes("Dueling Supremacy")
    )
      controls.push({
        label: loc`Dueling Supremacy: Initiative Count +1`,
        run: () => shiftCount(message, actor, 1, "duelingSupremacy", "Dueling Supremacy")
      });
    const target = check.attackContext?.targetActorUuid ? fromUuidSync(check.attackContext.targetActorUuid) : null;
    if (
      user?.isGM &&
      check.successConfirmed === false &&
      check.attackContext?.disarm?.active !== true &&
      !check.duelingMastery &&
      target?.system?.activeFeatNames?.includes("Dueling Mastery")
    )
      controls.push({
        label: loc`Dueling Mastery: adjacent attacker’s Initiative Count −2`,
        run: () => shiftCount(message, actor, -2, "duelingMastery", "Dueling Mastery")
      });
    return controls.length ? controls : null;
  }
});
