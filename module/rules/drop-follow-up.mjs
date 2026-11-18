/**
 * Cleave Basics (p.177) and Snap Shot (p.182): once per round, when one of the character's melee (Cleave) or
 * ranged (Snap Shot) attacks leaves an opponent unconscious or dead, they may at once make one more attack of the
 * same kind with the same weapon against a different opponent.
 *
 * The trigger is the character's own resolved hit from the current round; the GC confirms that it dropped the
 * opponent, since health and death are applied at the table. The extra attack is a free Standard Attack posted
 * through the final-attack workflow. Interpretation: the rules call it a "cleave" or "snap shot" attack rather than
 * a final attack; it is treated as one, so it shares the Nauseated one-final-attack allowance and cannot carry a
 * full-action trick.
 */
import { attributeActionBlock } from "./attributes.mjs";
import { restraintActionBlock } from "./restraints.mjs";
import { validOwnCountClock } from "./own-count-duration.mjs";
import { loc } from "../i18n.mjs";

export const DROP_FOLLOW_UPS = Object.freeze({
  cleaveBasics: Object.freeze({ feat: "Cleave Basics", name: "Cleave", ranged: false, page: 177 }),
  snapShot: Object.freeze({ feat: "Snap Shot", name: "Snap Shot", ranged: true, page: 182 })
});

/** Whether a posted check is the character's own resolved hit of the right kind in this combat round. */
export function dropTriggerEligible(check, { actorUuid, combat, ranged }) {
  return (
    !!check &&
    check.actorUuid === actorUuid &&
    check.checkKind === "attack" &&
    check.resolved === true &&
    check.successConfirmed === true &&
    !check.superseded &&
    check.attackContext?.ranged === ranged &&
    check.attackContext?.disarm?.active !== true &&
    typeof check.weaponUuid === "string" &&
    !!check.weaponUuid &&
    check.rollCombat?.id === combat?.id &&
    check.rollCombat?.round === combat?.round
  );
}

/**
 * The follow-up attack's receipt facts, or an error saying what is missing.
 * @param {string} key  "cleaveBasics" or "snapShot"
 */
export function dropFollowUpPlan(
  system,
  combat,
  check,
  {
    key,
    actorUuid,
    droppedConfirmed = false,
    immediateConfirmed = false,
    anotherOpponentConfirmed = false,
    targetUuid = ""
  } = {}
) {
  const d = Object.hasOwn(DROP_FOLLOW_UPS, key) ? DROP_FOLLOW_UPS[key] : null;
  if (!d) throw Error(loc`Choose Cleave or Snap Shot.`);
  if (!system.activeFeatNames?.includes(d.feat)) throw Error(loc`${d.feat} has not been earned.`);
  if (!validOwnCountClock(combat)) throw Error(loc`Use ${d.name} in this character’s started combat.`);
  if (!dropTriggerEligible(check, { actorUuid, combat, ranged: d.ranged }))
    throw Error(
      d.ranged
        ? loc`Choose your own resolved ranged hit from this round.`
        : loc`Choose your own resolved melee hit from this round.`
    );
  if ([droppedConfirmed, immediateConfirmed, anotherOpponentConfirmed].some(v => v !== true))
    throw Error(
      loc`The GC must confirm that hit left its opponent unconscious or dead, that this attack follows at once, and that it targets a different opponent.`
    );
  const dropped = check.attackContext?.targetActorUuid || "";
  if (dropped && targetUuid && dropped === targetUuid)
    throw Error(loc`${d.name} must target a different opponent from the one that dropped.`);
  const block = restraintActionBlock(system, { free: true }) || attributeActionBlock(system, { kind: "attack" });
  if (block || system.wounds?.value < 0 || system.mentalLeapState?.unconscious)
    throw Error(block || loc`This character cannot take the attack.`);
  return {
    source: key,
    name: d.name,
    combatId: combat.id,
    round: combat.round,
    combatantId: combat.combatantId,
    weaponUuid: check.weaponUuid,
    droppedTargetUuid: dropped || null,
    droppedConfirmed: true,
    immediateConfirmed: true,
    anotherOpponentConfirmed: true,
    attackAction: "standard",
    free: true
  };
}

export function dropFollowUpNote(finalAttack) {
  const d = DROP_FOLLOW_UPS[finalAttack?.source];
  return d
    ? loc`${d.name}: an immediate extra attack with the same weapon after the previous hit dropped its opponent; one round use recorded (p.${d.page}).`
    : "";
}
