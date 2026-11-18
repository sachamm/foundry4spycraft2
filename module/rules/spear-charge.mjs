import { stanceMovementState } from "./stance-movement.mjs";
import { combatStanceState } from "./combat-stance.mjs";
import { validOwnCountClock } from "./own-count-duration.mjs";
import { attributeActionBlock } from "./attributes.mjs";
import { restraintActionBlock } from "./restraints.mjs";
import { loc } from "../i18n.mjs";
/** Spear Charge p.179: this declaration checks completed movement, never moves tokens. */
export function spearChargeMovementPlan(
  system,
  { distanceFeet, towardFeet, routeConfirmed = false, movementCompleted = false, combat = null } = {}
) {
  if (!validOwnCountClock(combat) || combat.turn !== combat.ownTurnIndex)
    throw Error(loc`Take Spear Charge’s full action during your own Initiative Count.`);
  const block = restraintActionBlock(system) || attributeActionBlock(system, { kind: "skill", ability: "dex" });
  if (block || system.wounds?.value < 0) throw Error(block || loc`This character cannot take Spear Charge movement.`);
  if (
    !Number.isFinite(system.speed) ||
    system.speed < 0 ||
    system.conditionSpeedReview ||
    system.postureMovement?.standardMove === false
  )
    throw Error(loc`Resolve current Speed and a posture permitting movement before Spear Charge.`);
  if (
    routeConfirmed !== true ||
    movementCompleted !== true ||
    !Number.isFinite(distanceFeet) ||
    !Number.isFinite(towardFeet) ||
    distanceFeet < 10 ||
    distanceFeet > system.speed ||
    towardFeet < 10 ||
    towardFeet > distanceFeet
  )
    throw Error(
      loc`Confirm the completed legal route immediately before this attack: at least10 ft. toward this target, total counted distance no farther than current Speed.`
    );
  const round = stanceMovementState(system, combat);
  if (round.feet < distanceFeet || (round.cappedActive && round.feet > round.limitFeet))
    throw Error(
      loc`Record the total completed movement this round before attacking; it must include this route and obey the current stance limit.`
    );
  return {
    version: 1,
    distanceFeet,
    towardFeet,
    routeConfirmed: true,
    movementCompleted: true,
    speed: system.speed,
    combat: structuredClone(combat),
    roundMovement: { key: round.key, feet: round.feet },
    stance: combatStanceState(system)
  };
}
