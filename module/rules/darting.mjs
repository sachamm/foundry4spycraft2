import { dartingStyleState } from "./darting-state.mjs";
import { validOwnCountClock } from "./own-count-duration.mjs";
import { weaponGrip, possessionUnavailable } from "./gear.mjs";
import { attributeActionBlock } from "./attributes.mjs";
import { restraintActionBlock } from "./restraints.mjs";
export const dartingWeaponEligible = w =>
  ["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged", "hurled", "exoticHurled"].includes(w?.proficiency);
function canAct(system, combat) {
  const block = restraintActionBlock(system, { free: true }) || attributeActionBlock(system, { kind: "attack" });
  if (block || system.conditionContext?.sleeping || system.wounds?.value < 0 || system.mentalLeapState?.unconscious)
    throw new Error(block || "This character cannot take the Darting Weapon action.");
  if (
    system.refreshAction?.state === "waiting" &&
    system.refreshAction.combatId === combat.id &&
    system.refreshAction.startRound === combat.round
  )
    throw new Error("Refresh forfeited this round’s chance to act.");
}
export function dartingDeclarationPlan(
  system,
  combat,
  { extraAttacks = 1, atStartOfInitiative = false, confirmed = false } = {}
) {
  if (!system.activeFeatNames?.includes("Darting Weapon")) throw new Error("Darting Weapon has not been earned.");
  if (![1, 2].includes(extraAttacks) || (extraAttacks === 2 && !system.activeFeatNames.includes("Flashing Weapon")))
    throw new Error("Choose one final attack with Darting Weapon, or two with earned Flashing Weapon.");
  if (
    !validOwnCountClock(combat) ||
    !Number.isSafeInteger(combat.round + 1) ||
    combat.turn !== combat.ownTurnIndex ||
    atStartOfInitiative !== true ||
    confirmed !== true
  )
    throw new Error("Confirm the start of your own Initiative Count and accept the full-round penalty.");
  const old = dartingStyleState({ ...system, dartingCombatContext: combat });
  if (old.active || old.needsReview)
    throw new Error(old.reason || "An accepted Darting Weapon tradeoff is already active.");
  canAct(system, combat);
  return {
    combatId: combat.id,
    combatantId: combat.combatantId,
    startRound: combat.round,
    dueRound: combat.round + 1,
    penalty: 2 * extraAttacks,
    extraAttacks,
    atStartOfInitiative: true,
    confirmed: true
  };
}
export function dartingFinalAttackPlan(system, combat, items, { weaponId, confirmed = false } = {}) {
  const state = dartingStyleState({ ...system, dartingCombatContext: combat }),
    record = system.dartingStyle;
  if (!state.active || state.needsReview)
    throw new Error(state.reason || "No current Darting Weapon final attacks are granted.");
  if (!validOwnCountClock(combat) || combat.turn !== combat.ownTurnIndex || combat.round !== record.startRound)
    throw new Error("Take this free final attack during the declaring Initiative Count.");
  canAct(system, combat);
  if (confirmed !== true) throw new Error("Confirm this final melee or hurled attack is legal now.");
  const item = items.find(i => i.id === weaponId),
    w = item?.system;
  if (
    item?.type !== "weapon" ||
    !dartingWeaponEligible(w) ||
    w.equipped !== true ||
    w.carried === false ||
    w.reserve ||
    w.destroyed ||
    !Number.isSafeInteger(w.quantity ?? 1) ||
    (w.quantity ?? 1) < 1 ||
    possessionUnavailable(w)
  )
    throw new Error("Choose an owned, readied and usable melee or hurled weapon.");
  const grip = weaponGrip(system, w);
  if (grip.blocked) throw new Error(grip.reason || "The current weapon grip is unavailable.");
  return {
    declarationId: record.id,
    weaponId,
    extraAttacks: record.extraAttacks,
    combatId: combat.id,
    round: combat.round,
    combatantId: combat.combatantId,
    confirmed: true,
    attackAction: "standard",
    free: true
  };
}
