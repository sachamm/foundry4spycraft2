import { dartingStyleState } from "./darting-state.mjs";
import { validOwnCountClock } from "./own-count-duration.mjs";
import { weaponGrip, possessionUnavailable } from "./gear.mjs";
import { attributeActionBlock } from "./attributes.mjs";
import { restraintActionBlock } from "./restraints.mjs";
import { loc } from "../i18n.mjs";
export const dartingWeaponEligible = w =>
  ["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged", "hurled", "exoticHurled"].includes(w?.proficiency);
/** Follow-Up Shot / Hail of Fire (pp.181–182) use the same tradeoff with a firearm or heavy weapon. */
export const followUpWeaponEligible = w =>
  ["handgun", "rifle", "shotgun", "submachineGun", "tactical", "guided", "indirectFire"].includes(w?.proficiency);
export const FINAL_ATTACK_TRADEOFFS = Object.freeze({
  darting: { feat: "Darting Weapon", double: "Flashing Weapon", eligible: dartingWeaponEligible },
  followUp: { feat: "Follow-Up Shot", double: "Hail of Fire", eligible: followUpWeaponEligible }
});
function canAct(system, combat) {
  const block = restraintActionBlock(system, { free: true }) || attributeActionBlock(system, { kind: "attack" });
  if (block || system.conditionContext?.sleeping || system.wounds?.value < 0 || system.mentalLeapState?.unconscious)
    throw new Error(block || loc`This character cannot take the Darting Weapon action.`);
  if (
    system.refreshAction?.state === "waiting" &&
    system.refreshAction.combatId === combat.id &&
    system.refreshAction.startRound === combat.round
  )
    throw new Error(loc`Refresh forfeited this round’s chance to act.`);
}
export function dartingDeclarationPlan(
  system,
  combat,
  { extraAttacks = 1, atStartOfInitiative = false, confirmed = false, kind = "darting" } = {}
) {
  const t = FINAL_ATTACK_TRADEOFFS[kind];
  if (!t) throw new Error(loc`Choose Darting Weapon or Follow-Up Shot.`);
  if (!system.activeFeatNames?.includes(t.feat)) throw new Error(loc`${t.feat} has not been earned.`);
  if (![1, 2].includes(extraAttacks) || (extraAttacks === 2 && !system.activeFeatNames.includes(t.double)))
    throw new Error(loc`Choose one final attack with ${t.feat}, or two with earned ${t.double}.`);
  if (
    !validOwnCountClock(combat) ||
    !Number.isSafeInteger(combat.round + 1) ||
    combat.turn !== combat.ownTurnIndex ||
    atStartOfInitiative !== true ||
    confirmed !== true
  )
    throw new Error(loc`Confirm the start of your own Initiative Count and accept the full-round penalty.`);
  const old = dartingStyleState({ ...system, dartingCombatContext: combat });
  if (old.active || old.needsReview)
    throw new Error(old.reason || loc`An accepted Darting Weapon tradeoff is already active.`);
  canAct(system, combat);
  return {
    combatId: combat.id,
    combatantId: combat.combatantId,
    startRound: combat.round,
    dueRound: combat.round + 1,
    penalty: 2 * extraAttacks,
    extraAttacks,
    atStartOfInitiative: true,
    confirmed: true,
    ...(kind === "followUp" ? { kind } : {})
  };
}
export function dartingFinalAttackPlan(system, combat, items, { weaponId, confirmed = false } = {}) {
  const state = dartingStyleState({ ...system, dartingCombatContext: combat }),
    record = system.dartingStyle;
  if (!state.active || state.needsReview)
    throw new Error(state.reason || loc`No current Darting Weapon final attacks are granted.`);
  if (!validOwnCountClock(combat) || combat.turn !== combat.ownTurnIndex || combat.round !== record.startRound)
    throw new Error(loc`Take this free final attack during the declaring Initiative Count.`);
  canAct(system, combat);
  if (confirmed !== true) throw new Error(loc`Confirm this final melee or hurled attack is legal now.`);
  const item = items.find(i => i.id === weaponId),
    w = item?.system;
  if (
    item?.type !== "weapon" ||
    !FINAL_ATTACK_TRADEOFFS[state.kind].eligible(w) ||
    w.equipped !== true ||
    w.carried === false ||
    w.reserve ||
    w.destroyed ||
    !Number.isSafeInteger(w.quantity ?? 1) ||
    (w.quantity ?? 1) < 1 ||
    possessionUnavailable(w)
  )
    throw new Error(
      state.kind === "followUp"
        ? loc`Choose an owned, readied and usable firearm or heavy weapon.`
        : loc`Choose an owned, readied and usable melee or hurled weapon.`
    );
  const grip = weaponGrip(system, w);
  if (grip.blocked) throw new Error(grip.reason || loc`The current weapon grip is unavailable.`);
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
