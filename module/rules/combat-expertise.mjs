/** Combat Expertise p.172; full-round duration p.346. */
import { validOwnCountClock as validClock, ownCountDurationActive } from "./own-count-duration.mjs";
import { loc } from "../i18n.mjs";
export function combatExpertiseState(system) {
  const r = system.combatExpertise,
    c = system.expertiseCombatContext;
  if (!ownCountDurationActive(r, c) || !Number.isSafeInteger(r.penalty) || r.penalty < 1 || r.penalty > 6)
    return { active: false, penalty: 0, dodgeBonus: 0 };
  return { active: true, penalty: r.penalty, dodgeBonus: r.penalty, dueRound: r.dueRound };
}
export function combatExpertisePlan(system, combat, { penalty, confirmed = false } = {}) {
  if (!system.activeFeatNames?.includes("Combat Expertise"))
    throw new Error(loc`Combat Expertise has not been earned.`);
  if (!validClock(combat) || combat.turn !== combat.ownTurnIndex)
    throw new Error(loc`Declare Combat Expertise during this character’s Initiative Count in a started combat.`);
  const maximum = Math.min(6, system.defense?.base ?? 0);
  if (!Number.isSafeInteger(penalty) || penalty < 1 || penalty > maximum)
    throw new Error(loc`Choose a whole Combat Expertise penalty from 1 to ` + maximum + ".");
  if (confirmed !== true) throw new Error(loc`Confirm the free action and attack/skill penalty for the full round.`);
  if (combatExpertiseState({ ...system, expertiseCombatContext: combat }).active)
    throw new Error(loc`Combat Expertise is already active for this full round.`);
  return {
    combatId: combat.id,
    combatantId: combat.combatantId,
    startRound: combat.round,
    dueRound: combat.round + 1,
    penalty
  };
}
