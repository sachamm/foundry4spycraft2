/**
 * Brawling Supremacy, p.185: after hitting one opponent with 2 or more non-final unarmed attacks in a round, the
 * character may at once make 1 final attack against that opponent. Its tricks (One-Two, Sleeper Hold) live with the
 * unarmed and grapple tricks.
 */
import { unarmedWeapon } from "./kick.mjs";
import { loc } from "../i18n.mjs";

export const BRAWLING_SUPREMACY = "Brawling Supremacy";

const sameRound = (a, b) => !!a && !!b && a.id === b.id && a.round === b.round;

/** A resolved, non-final unarmed hit on a recorded target. */
export const unarmedHit = c =>
  c?.checkKind === "attack" &&
  c.successConfirmed === true &&
  !c.superseded &&
  !c.finalAttack &&
  !c.freeFinalAttack &&
  !!c.attackContext?.targetActorUuid &&
  unarmedWeapon({ proficiency: c.weaponProficiency, qualities: c.weaponQualities });

/**
 * Whether this hit earns the final attack: the actor has the feat, this is at least their second non-final unarmed
 * hit on the target this round, and no Brawling Supremacy final attack against that target was made this round.
 * `checks` are the posted checks' flags.
 */
export function brawlingFinalEligible(system, check, checks = []) {
  if (!system?.activeFeatNames?.includes(BRAWLING_SUPREMACY) || !unarmedHit(check) || !check.rollCombat) return false;
  const target = check.attackContext.targetActorUuid,
    mine = checks.filter(c => c?.actorUuid === check.actorUuid && sameRound(c.rollCombat, check.rollCombat));
  const hits = mine.filter(c => unarmedHit(c) && c.attackContext.targetActorUuid === target).length,
    taken = mine.some(
      c => c.finalAttack?.source === "brawlingSupremacy" && c.finalAttack.targetUuid === target && !c.superseded
    );
  return hits >= 2 && !taken;
}

export function brawlingFinalPlan(system, combat, check) {
  if (!system?.activeFeatNames?.includes(BRAWLING_SUPREMACY))
    throw new Error(loc`Brawling Supremacy has not been earned.`);
  if (!combat?.started || combat.id !== check?.rollCombat?.id || combat.round !== check.rollCombat.round)
    throw new Error(loc`Make the Brawling Supremacy final attack in the round of the hits.`);
  if (system.wounds?.value < 0 || system.mentalLeapState?.unconscious)
    throw new Error(loc`This character cannot take the final attack.`);
  return {
    source: "brawlingSupremacy",
    combatId: combat.id,
    round: combat.round,
    combatantId: combat.combatantId,
    targetUuid: check.attackContext.targetActorUuid,
    attackAction: "standard",
    free: true
  };
}

export const brawlingSupremacySpec = system =>
  system?.activeFeatNames?.includes(BRAWLING_SUPREMACY)
    ? {
        id: "brawlingSupremacy",
        name: loc`Brawling Supremacy (final attack after two unarmed hits)`,
        period: "round",
        limit: 8,
        workflow: "brawlingSupremacy",
        combatScoped: true,
        manualReviewable: true,
        hidden: true
      }
    : null;
