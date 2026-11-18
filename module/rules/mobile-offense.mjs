import { validOwnCountClock } from "./own-count-duration.mjs";
import { combatMovementPlan } from "./combat-movement.mjs";
import { totalDefenseState } from "./total-defense.mjs";
import { loc } from "../i18n.mjs";
/** Mobile Offense p.175; included Standard Move in Total Defense p.361. No token/action execution. */
export function mobileOffensePlan(
  system,
  combat,
  {
    movementKind = "standardMove",
    moveDistanceFeet,
    attackAtFeet,
    moveConfirmed = false,
    routeConfirmed = false,
    adjacentThreateningOpponent = false,
    passesThreateningAdjacency = false,
    offCountMoveSource = ""
  } = {}
) {
  if (!system.activeFeatNames?.includes("Mobile Offense")) throw new Error(loc`Mobile Offense has not been earned.`);
  if (!validOwnCountClock(combat))
    throw new Error(loc`Resolve this move’s final attack in the character’s started combat.`);
  const offCount = combat.turn !== combat.ownTurnIndex;
  if (
    offCount &&
    (typeof offCountMoveSource !== "string" || !offCountMoveSource.trim() || offCountMoveSource.length > 300)
  )
    throw new Error(loc`Name the actual GC-confirmed source allowing this Standard Move outside own Count.`);
  if (moveConfirmed !== true)
    throw new Error(
      loc`The GC must confirm a legal Standard Move is actually in progress and the final attack occurs at the declared point.`
    );
  if (!["standardMove", "totalDefense"].includes(movementKind))
    throw new Error(loc`Mobile Offense requires a Standard Move, not Run or another movement action.`);
  if (
    !Number.isFinite(moveDistanceFeet) ||
    moveDistanceFeet < 0 ||
    !Number.isFinite(attackAtFeet) ||
    attackAtFeet < 0 ||
    attackAtFeet > moveDistanceFeet
  )
    throw new Error(loc`Choose a finite attack point from the start through the end of the counted Standard Move.`);
  const refresh = system.refreshAction;
  if (refresh?.state === "waiting" && refresh.combatId === combat.id && refresh.startRound === combat.round)
    throw new Error(loc`Refresh forfeited this round’s chance to act.`);
  let speed = system.speed,
    originId = null;
  if (movementKind === "totalDefense") {
    const r = system.totalDefense;
    if (
      !totalDefenseState({ ...system, totalDefenseCombatContext: combat }).active ||
      r.startRound !== combat.round ||
      r.actionConfirmed !== true ||
      typeof r.id !== "string" ||
      !r.id ||
      r.movement?.routeConfirmed !== true ||
      !Number.isFinite(r.movement.maximumFeet) ||
      r.movement.maximumFeet < 0 ||
      r.movement.distanceFeet !== moveDistanceFeet ||
      moveDistanceFeet > r.movement.maximumFeet
    )
      throw new Error(
        loc`Choose the Standard Move already recorded within this Count’s actual Total Defense action; this control cannot grant or replay one.`
      );
    if (!Number.isFinite(speed) || speed < 0) throw new Error(loc`Resolve current Speed first.`);
    speed *= system.activeFeatNames?.includes("Combat Mobility") ? 2 : 1;
    originId = r.id;
  }
  const movement = combatMovementPlan(
    { ...system, speed },
    {
      action: "standardMove",
      distanceFeet: moveDistanceFeet,
      routeConfirmed,
      adjacentThreateningOpponent,
      passesThreateningAdjacency
    }
  );
  return {
    source: "mobileOffense",
    ...(offCount ? { offCountMoveSource: offCountMoveSource.trim() } : {}),
    combatId: combat.id,
    round: combat.round,
    combatantId: combat.combatantId,
    movementKind,
    originId,
    moveDistanceFeet,
    attackAtFeet,
    maximumMoveFeet: movement.maximumFeet,
    sourceSpeed: system.speed,
    routeConfirmed: true,
    moveConfirmed: true,
    adjacentThreateningOpponent,
    passesThreateningAdjacency,
    attackAction: "standard",
    free: true
  };
}
