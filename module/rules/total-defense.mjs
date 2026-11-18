import { ruleName } from "./rule-name.mjs";
import { ownCountDurationActive, validOwnCountClock } from "./own-count-duration.mjs";
import { combatMovementPlan } from "./combat-movement.mjs";
import { loc } from "../i18n.mjs";
/** Total Defense p.361; action cost remains a confirmed table declaration. */
/** Equilibrium Basics p.194: an additional, normally stacking dodge bonus. */
export function equilibriumTotalDefenseBonus(system) {
  if (!system.activeFeatNames?.includes("Equilibrium Basics")) return { bonus: 0, evidence: null, blockedReason: "" };
  if (!Array.isArray(system.activeFeatSelections) || system.activeFeatSelections.some(f => !f || typeof f !== "object"))
    return {
      bonus: 0,
      evidence: null,
      blockedReason: loc`Review the active Covert feat selections for Equilibrium Basics.`
    };
  const selections = system.activeFeatSelections
    .filter(f => f.tree === "covert")
    .map(f => ({ name: f.name, choice: f.choice ?? "" }));
  if (
    !selections.some(f => ruleName(f) === "Equilibrium Basics") ||
    selections.some(f => typeof f.name !== "string" || !f.name.trim() || typeof f.choice !== "string")
  )
    return {
      bonus: 0,
      evidence: null,
      blockedReason: loc`Review the active Covert feat selections for Equilibrium Basics.`
    };
  selections.sort((a, b) => a.name.localeCompare(b.name) || a.choice.localeCompare(b.choice));
  return {
    bonus: selections.length,
    evidence: { version: 1, source: "Equilibrium Basics", covertFeats: selections, bonus: selections.length },
    blockedReason: ""
  };
}
function validEquilibriumDeclaration(p) {
  return (
    p?.version === 1 &&
    p.source === "Equilibrium Basics" &&
    Array.isArray(p.covertFeats) &&
    p.covertFeats.length > 0 &&
    p.bonus === p.covertFeats.length &&
    p.covertFeats.some(f => ruleName(f) === "Equilibrium Basics") &&
    p.covertFeats.every(f => typeof f?.name === "string" && f.name.trim() && typeof f.choice === "string")
  );
}
export function totalDefenseState(system) {
  const active = ownCountDurationActive(system.totalDefense, system.totalDefenseCombatContext),
    proof = system.totalDefense?.equilibrium;
  let equilibrium = { bonus: 0, evidence: null, blockedReason: "" };
  if (active && proof) {
    if (!validEquilibriumDeclaration(proof))
      equilibrium.blockedReason = loc`Review the Equilibrium Basics source recorded for this Total Defense declaration.`;
    else equilibrium = equilibriumTotalDefenseBonus(system);
  }
  return {
    active,
    bonus: active ? 4 + equilibrium.bonus : 0,
    dueRound: system.totalDefense?.dueRound ?? null,
    ...(equilibrium.evidence ? { equilibrium: equilibrium.evidence } : {}),
    ...(equilibrium.blockedReason ? { needsReview: true, reason: equilibrium.blockedReason } : {})
  };
}
export function totalDefensePlan(system, combat, options = {}) {
  if (!validOwnCountClock(combat) || combat.turn !== combat.ownTurnIndex)
    throw new Error(loc`Take Total Defense during this character’s Initiative Count in a started combat.`);
  if (options.actionConfirmed !== true) throw new Error(loc`Confirm spending the full action for Total Defense.`);
  const refresh = system.refreshAction;
  if (refresh?.state === "waiting" && refresh.combatId === combat.id && refresh.startRound === combat.round)
    throw new Error(loc`Refresh forfeited this round’s chance to act.`);
  if (totalDefenseState({ ...system, totalDefenseCombatContext: combat }).active)
    throw new Error(loc`Total Defense is already active for this full round.`);
  const equilibrium = equilibriumTotalDefenseBonus(system);
  if (equilibrium.blockedReason) throw new Error(equilibrium.blockedReason);
  const movement = combatMovementPlan(system, { ...options, action: "totalDefense" });
  return {
    ...(equilibrium.evidence ? { equilibrium: equilibrium.evidence } : {}),
    combatId: combat.id,
    combatantId: combat.combatantId,
    startRound: combat.round,
    dueRound: combat.round + 1,
    movement: { distanceFeet: movement.distanceFeet, maximumFeet: movement.maximumFeet, routeConfirmed: true },
    actionConfirmed: true
  };
}
