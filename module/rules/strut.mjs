import { restraintActionBlock } from "./restraints.mjs";
import { actionDiceGain } from "./action-dice.mjs";
import { attributeActionBlock } from "./attributes.mjs";
export const hasStrut = system =>
  (system.classLevels?.brawler ?? 0) >= 3 &&
  (system.classOptionSelections ?? []).some(s => s.classId === "brawler" && s.name === "Strut");
/** Brawler Ploy, p.66. The GC confirms the next half action, not an arbitrary later action. */
export function strutGainPlan(
  system,
  check,
  { actorUuid, messageUuid, combat, careerDie, nextHalfActionConfirmed = false } = {}
) {
  if (system.actionDiceSettlementReview?.needsReview)
    throw new Error("Review the interrupted action-die settlement before granting Strut dice.");
  if (!hasStrut(system)) throw new Error("Choose the Brawler Strut ploy before using it.");
  if (
    check?.actorUuid !== actorUuid ||
    check.checkKind !== "attack" ||
    check.superseded ||
    check.criticalFailure ||
    !(check.threatConfirmed === true || check.criticalSuccess === true)
  )
    throw new Error("Strut requires this character’s confirmed attack threat or critical hit.");
  const melee =
    check.unarmed === true || check.weaponProficiency === "unarmed" || check.attackContext?.ranged === false;
  if (!melee) throw new Error("Strut requires an unarmed or melee attack.");
  if (
    !combat?.started ||
    !combat.id ||
    !Number.isSafeInteger(combat.round) ||
    combat.round < 1 ||
    !Number.isSafeInteger(combat.ownTurnIndex) ||
    combat.ownTurnIndex < 0 ||
    !Number.isSafeInteger(combat.turn) ||
    combat.turn !== combat.ownTurnIndex ||
    !combat.combatantId
  )
    throw new Error("Spend the next half action posturing during this character’s initiative in the same combat.");
  if (
    check.rollCombat?.id !== combat.id ||
    check.rollCombat?.combatantId !== combat.combatantId ||
    !Number.isSafeInteger(check.rollCombat?.round) ||
    check.rollCombat.round < 1 ||
    check.rollCombat.round > combat.round
  )
    throw new Error("The eligible attack must be recorded in this combat.");
  if (
    check.strutPoolId ||
    Object.values(system.bonusActionDice ?? {}).some(p => p.source === "strut" && p.messageUuid === messageUuid)
  )
    throw new Error("This attack already supplied its Strut grant.");
  if (nextHalfActionConfirmed !== true)
    throw new Error("The GC must confirm that the next half action after this attack was spent posturing.");
  const blocked = restraintActionBlock(system) || attributeActionBlock(system, { kind: "ability" });
  if (blocked) throw new Error(blocked);
  if (system.conditionContext?.held || system.conditionContext?.pinned)
    throw new Error("Held/Pinned: this non-free posturing action is unavailable.");
  return {
    ...actionDiceGain(system, careerDie),
    source: "strut",
    label: "Strut",
    baseDie: careerDie,
    baseCount: 1,
    bold: system.activeFeatNames?.includes("Fortune Favors the Bold") === true
  };
}
export function strutPool(system, gain, { id, messageUuid, combat, periods = system.usagePeriods } = {}) {
  if (
    typeof id !== "string" ||
    !/^[A-Za-z0-9_-]+$/.test(id) ||
    system.bonusActionDice?.[id] ||
    gain?.source !== "strut" ||
    typeof messageUuid !== "string" ||
    !messageUuid ||
    !combat?.id ||
    !combat.combatantId ||
    !Number.isFinite(system.worldTime)
  )
    throw new Error("Review the Strut grant source and receipt.");
  return {
    id,
    source: "strut",
    label: "Strut",
    unrestricted: true,
    baseDie: gain.baseDie,
    baseCount: 1,
    bold: gain.bold,
    die: gain.die,
    granted: gain.units,
    remaining: gain.units,
    scene: String(periods?.scene ?? "initial"),
    session: String(periods?.session ?? "initial"),
    mission: String(periods?.mission ?? "initial"),
    at: system.worldTime,
    combatId: combat.id,
    combatantId: combat.combatantId,
    combatRound: combat.round,
    messageUuid,
    nextHalfActionConfirmed: true,
    needsReview: false
  };
}
