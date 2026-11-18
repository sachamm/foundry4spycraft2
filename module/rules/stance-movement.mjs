import { COMBAT_STANCES, combatStanceState } from "./combat-stance.mjs";
import { validOwnCountClock } from "./own-count-duration.mjs";
import { loc } from "../i18n.mjs";
export function stanceMovementRoundKey(system, combat = null) {
  if (combat !== null) {
    if (!validOwnCountClock(combat))
      throw Error(loc`Review the current combat round before recording stance movement.`);
    return combat.id + ":" + combat.round;
  }
  if (!Number.isFinite(system.worldTime))
    throw Error(loc`Review the current world time before recording out-of-combat movement.`);
  return "world:" + Math.floor(system.worldTime / 6);
}
export function stanceMovementState(system, combat = null) {
  const key = stanceMovementRoundKey(system, combat),
    r = system.stanceRoundMovement;
  if (r != null && (r.version !== 1 || typeof r.key !== "string" || !r.key || !Number.isFinite(r.feet) || r.feet < 0))
    throw Error(loc`Review the recorded round movement total.`);
  const feet = r?.key === key ? r.feet : 0,
    stance = combatStanceState(system),
    limitFeet = COMBAT_STANCES[stance?.key]?.movementLimitFeet ?? 20;
  return {
    version: 1,
    key,
    feet,
    sideActive: stance?.key === "side",
    cappedActive: !!COMBAT_STANCES[stance?.key]?.movementLimitFeet,
    stanceName: stance?.name ?? null,
    limitFeet,
    remainingFeet: Math.max(0, limitFeet - feet)
  };
}
/** The GC reviews the TOTAL already moved, making repeat saves idempotent. */
export function stanceMovementReviewPlan(
  system,
  { combat = null, totalFeet, confirmed = false, enteringSide = false, enteringStance = null } = {}
) {
  if (confirmed !== true) throw Error(loc`The GC must confirm the total distance already moved this round.`);
  const current = stanceMovementState(system, combat);
  if (!Number.isFinite(totalFeet) || totalFeet < current.feet)
    throw Error(loc`Enter a finite round total at least as large as the recorded movement; it cannot go backwards.`);
  const limit =
    COMBAT_STANCES[enteringStance]?.movementLimitFeet ??
    (enteringSide ? 20 : current.cappedActive ? current.limitFeet : null);
  if (limit !== null && totalFeet > limit)
    throw Error(
      (COMBAT_STANCES[enteringStance]?.name ?? (enteringSide ? loc`Side Stance` : current.stanceName)) +
        loc` permits no more than ` +
        limit +
        loc` ft. of movement during any round.`
    );
  return { version: 1, key: current.key, feet: totalFeet };
}
export function stanceMovementRoutePlan(system, { combat = null, distanceFeet } = {}) {
  const stance = combatStanceState(system);
  if (!COMBAT_STANCES[stance?.key]?.movementLimitFeet) return null;
  const current = stanceMovementState(system, combat);
  if (!Number.isFinite(distanceFeet) || distanceFeet < 0)
    throw Error(loc`Enter the actual distance this route adds toward the stance’s round limit.`);
  if (current.feet + distanceFeet > current.limitFeet)
    throw Error(
      loc`This route would exceed ` +
        stance.name +
        "’s " +
        current.limitFeet +
        loc` ft. round limit; only ` +
        current.remainingFeet +
        loc` ft. remains.`
    );
  return {
    version: 1,
    stanceId: stance.id,
    roundKey: current.key,
    priorFeet: current.feet,
    distanceFeet,
    totalFeet: current.feet + distanceFeet,
    maximumRoundFeet: current.limitFeet
  };
}
