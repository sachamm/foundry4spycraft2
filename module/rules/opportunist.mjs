/**
 * Opportunist, p.175: once per round, when the character and an opponent can both see a second opponent who
 * becomes stunned or whose wound points fall below 0, the character may at once make one final attack against the
 * first opponent as a free action. A hit deals half standard damage, rounded up.
 *
 * The trigger happens at the table (sight lines, conditions and wounds), so the GC confirms it. The attack card
 * offers the halved damage roll, which is tied to that exact hit and can be rolled once.
 */
import { attributeActionBlock } from "./attributes.mjs";
import { restraintActionBlock } from "./restraints.mjs";
import { validOwnCountClock } from "./own-count-duration.mjs";
import { loc } from "../i18n.mjs";

export const OPPORTUNIST = "Opportunist";

export function opportunistPlan(
  system,
  combat,
  { triggerConfirmed = false, sightConfirmed = false, immediateConfirmed = false, triggerDescription = "" } = {}
) {
  if (!system.activeFeatNames?.includes(OPPORTUNIST)) throw Error(loc`Opportunist has not been earned.`);
  if (!validOwnCountClock(combat)) throw Error(loc`Use Opportunist in this character’s started combat.`);
  if (typeof triggerDescription !== "string" || triggerDescription.length > 300)
    throw Error(loc`Keep the trigger description within 300 characters.`);
  if ([triggerConfirmed, sightConfirmed, immediateConfirmed].some(v => v !== true))
    throw Error(
      loc`The GC must confirm that a second opponent just became stunned or fell below 0 wound points, that you and this opponent can both see them, and that this attack follows at once.`
    );
  const block = restraintActionBlock(system, { free: true }) || attributeActionBlock(system, { kind: "attack" });
  if (block || system.wounds?.value < 0 || system.mentalLeapState?.unconscious)
    throw Error(block || loc`This character cannot take the final attack.`);
  return {
    source: "opportunist",
    combatId: combat.id,
    round: combat.round,
    combatantId: combat.combatantId,
    triggerDescription: triggerDescription.trim(),
    triggerConfirmed: true,
    sightConfirmed: true,
    immediateConfirmed: true,
    halfDamage: true,
    attackAction: "standard",
    free: true
  };
}

/** The Opportunist hit a halved damage roll may come from, or an error saying why not. */
export function opportunistDamageSource(attack, { actorUuid, weaponUuid, messages = [], rerollOf = null } = {}) {
  const c = attack?.flags?.spycraft2;
  if (
    !c ||
    c.actorUuid !== actorUuid ||
    c.checkKind !== "attack" ||
    c.finalAttack?.source !== "opportunist" ||
    c.resolved !== true ||
    c.successConfirmed !== true ||
    c.superseded ||
    c.weaponUuid !== weaponUuid
  )
    throw Error(loc`Choose your own resolved Opportunist hit with this weapon.`);
  const attackUuid = attack.uuid ?? attack.id;
  if (
    !rerollOf &&
    [...messages].some(
      m => m.flags?.spycraft2?.checkKind === "damage" && m.flags.spycraft2.opportunistDamage?.attackUuid === attackUuid
    )
  )
    throw Error(loc`This Opportunist hit already has its damage roll.`);
  return { version: 1, attackUuid, halved: true };
}

/** Half standard damage, rounded up. */
export const halvedFormula = formula => `ceil((${formula}) / 2)`;

export const opportunistNote = finalAttack =>
  finalAttack?.source === "opportunist"
    ? loc`Opportunist: free final attack after another opponent was stunned or dropped below 0 wounds; a hit deals half damage, rounded up. Roll it from this card. One round use recorded (p.175).`
    : "";
