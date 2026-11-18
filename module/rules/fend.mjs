import { validOwnCountClock } from "./own-count-duration.mjs";
import { attributeActionBlock } from "./attributes.mjs";
import { restraintActionBlock } from "./restraints.mjs";
import { stanceMovementState, stanceMovementReviewPlan } from "./stance-movement.mjs";
import { loc } from "../i18n.mjs";
export const stableFend = v =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x
  );
export function validFendTiming(p) {
  return (
    p?.version === 1 &&
    ((p.combat === null && Number.isFinite(p.worldTime) && p.activeCombatantId === null) ||
      (p.worldTime === null &&
        validOwnCountClock(p.combat) &&
        typeof p.activeCombatantId === "string" &&
        !!p.activeCombatantId))
  );
}
export function fendTiming(actor) {
  const combat = actor.mentalLeapCombatContext?.() ?? null,
    activeCombatantId = combat
      ? (actor.participatingCombat?.turns?.[combat.turn]?.id ??
        (combat.turn === combat.ownTurnIndex ? combat.combatantId : null))
      : null,
    p = {
      version: 1,
      combat,
      activeCombatantId,
      worldTime: combat ? null : (globalThis.game?.time?.worldTime ?? actor.system.worldTime)
    };
  if (!validFendTiming(p)) throw Error(loc`Review the actual active participant or world time before declaring Fend.`);
  return p;
}
export function sameFendTiming(original, current) {
  if (!validFendTiming(original) || !validFendTiming(current)) return false;
  if (original.combat === null) return current.combat === null && current.worldTime === original.worldTime;
  const a = original.combat,
    b = current.combat;
  return (
    !!b &&
    a.id === b.id &&
    a.round === b.round &&
    a.combatantId === b.combatantId &&
    original.activeCombatantId === current.activeCombatantId
  );
}
/** Record a GC-confirmed completed5ft move once; do not move tokens or invent a Standard Move action. */
export function fendMovementPlan(
  system,
  {
    timing,
    originalTiming,
    totalFeet,
    immediateConfirmed = false,
    routeConfirmed = false,
    movementCompleted = false
  } = {}
) {
  if (
    immediateConfirmed !== true ||
    routeConfirmed !== true ||
    movementCompleted !== true ||
    !sameFendTiming(originalTiming, timing)
  )
    throw Error(
      loc`Confirm Fend’s legal5ft move completed immediately after this actual Standard Attack, during the same active participant’s Count.`
    );
  const block = attributeActionBlock(system, { purelyMental: false }) || restraintActionBlock(system);
  if (
    block ||
    system.incapacitatedForMovement === true ||
    system.encumbrance?.immobile === true ||
    system.postureMovement?.bonusStep === false ||
    system.wounds?.value < 0
  )
    throw Error(block || loc`The current posture, condition or immobility prevents Fend movement.`);
  const state = stanceMovementState({ ...system, worldTime: timing.worldTime }, timing.combat);
  if (!Number.isFinite(totalFeet) || totalFeet !== state.feet + 5)
    throw Error(
      loc`The new completed round total must add exactly5ft to its current recorded total; do not repeat the move.`
    );
  const record = stanceMovementReviewPlan(
    { ...system, worldTime: timing.worldTime },
    { combat: timing.combat, totalFeet, confirmed: true }
  );
  return {
    version: 1,
    distanceFeet: 5,
    priorFeet: state.feet,
    roundMovement: record,
    immediateConfirmed: true,
    routeConfirmed: true,
    movementCompleted: true,
    timing: structuredClone(timing)
  };
}
