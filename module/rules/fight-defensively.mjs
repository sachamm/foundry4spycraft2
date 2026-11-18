/**
 * Fight Defensively, a trick open to every character (p.357).
 *
 * - A free action at the start of the character's Initiative Count: −4 to every attack and skill check and +2 dodge
 *   to Defense, both for 1 full round. `system.fightDefensively` records the declaration, timed from the own Count.
 * - Equilibrium Supremacy (p.194) adds a dodge bonus of half the character's Covert feats, rounded up, while it lasts.
 * - The Tribesman specialty adds +1 Defense while it lasts, rising by 1 at Career Levels 5, 10, 15 and 20.
 * - An enraged character may not take it.
 */
import { ownCountDurationActive, validOwnCountClock } from "./own-count-duration.mjs";
import { loc } from "../i18n.mjs";

export const FIGHT_DEFENSIVELY_PENALTY = 4;
export const FIGHT_DEFENSIVELY_DODGE = 2;

/** Half the character's active Covert feats, rounded up (Equilibrium Supremacy). */
export function equilibriumSupremacyDodge(system) {
  if (!system?.activeFeatNames?.includes("Equilibrium Supremacy")) return 0;
  const covert = (system.activeFeatSelections ?? []).filter(f => f && typeof f === "object" && f.tree === "covert");
  return Math.ceil(covert.length / 2);
}

/** Tribesman: +1, plus 1 at each of Career Levels 5, 10, 15 and 20. */
export function tribesmanDefense(system) {
  if (system?.specialtyName !== "Tribesman") return 0;
  const level = Number.isSafeInteger(system.level) ? system.level : 0;
  return 1 + Math.min(4, Math.floor(level / 5));
}

export function fightDefensivelyState(system) {
  const r = system?.fightDefensively;
  if (!r || r.version !== 1 || !ownCountDurationActive(r, system.fightDefensivelyCombatContext))
    return { active: false, penalty: 0, dodgeBonus: 0, equilibrium: 0, tribesman: 0 };
  return {
    active: true,
    penalty: FIGHT_DEFENSIVELY_PENALTY,
    dodgeBonus: FIGHT_DEFENSIVELY_DODGE,
    equilibrium: equilibriumSupremacyDodge(system),
    tribesman: tribesmanDefense(system),
    dueRound: r.dueRound
  };
}

export function fightDefensivelyPlan(system, combat, { confirmed = false, enraged = false } = {}) {
  if (enraged) throw new Error(loc`An enraged character cannot fight defensively.`);
  if (!validOwnCountClock(combat) || combat.turn !== combat.ownTurnIndex)
    throw new Error(loc`Fight defensively at the start of this character’s Initiative Count in a started combat.`);
  if (confirmed !== true)
    throw new Error(loc`Confirm the free action and the −4 attack/skill penalty for the full round.`);
  if (fightDefensivelyState({ ...system, fightDefensivelyCombatContext: combat }).active)
    throw new Error(loc`This character is already fighting defensively this round.`);
  return {
    version: 1,
    combatId: combat.id,
    combatantId: combat.combatantId,
    startRound: combat.round,
    dueRound: combat.round + 1
  };
}
