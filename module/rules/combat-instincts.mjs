import { attributeActionBlock } from "./attributes.mjs";
import { restraintActionBlock } from "./restraints.mjs";
import { uncannyDodgePlan } from "./defense.mjs";
import { validOwnCountClock } from "./own-count-duration.mjs";
/** Combat Instincts p.172: an explicit immediate reaction may occur outside own Count. */
export function combatInstinctsPlan(
  system,
  combat,
  check,
  {
    defenseTotal,
    triggerConfirmed = false,
    adjacentConfirmed = false,
    notFlatFootedConfirmed = false,
    immediateConfirmed = false,
    gcTimingResolution = ""
  } = {}
) {
  if (!system.activeFeatNames?.includes("Combat Instincts")) throw new Error("Combat Instincts has not been earned.");
  if (!validOwnCountClock(combat)) throw new Error("Resolve Combat Instincts in this character’s started combat.");
  if (
    !check ||
    check.checkKind !== "attack" ||
    check.checkMethod !== "roll" ||
    check.successConfirmed !== false ||
    check.resolved !== true ||
    check.superseded ||
    check.criticalSuccess ||
    check.attackContext?.disarm?.active ||
    !Number.isFinite(check.effectiveTotal) ||
    check.rollCombat?.id !== combat.id ||
    check.rollCombat.round !== combat.round
  )
    throw new Error(
      "Choose the current round’s recorded, resolved missed attack against you; opposed Disarm checks do not qualify."
    );
  if ([triggerConfirmed, adjacentConfirmed, notFlatFootedConfirmed, immediateConfirmed].some(v => v !== true))
    throw new Error(
      "The GC must confirm this attack targeted you, adjacency, your non-flat-footed state at the miss and the immediate reaction."
    );
  const margin = defenseTotal - check.effectiveTotal;
  if (!Number.isFinite(defenseTotal) || !Number.isFinite(margin) || margin < 5)
    throw new Error("The actual incoming Defense must exceed the final attack result by at least 5.");
  const knownFlatFooted = system.conditionContext?.flatFooted === true && !uncannyDodgePlan(system).cannotBeFlatFooted;
  if (knownFlatFooted && !gcTimingResolution.trim())
    throw new Error(
      "The recorded flat-footed source needs GC timing review before claiming a non-flat-footed trigger."
    );
  const block = restraintActionBlock(system, { free: true }) || attributeActionBlock(system, { kind: "attack" });
  if (block || system.wounds?.value < 0 || system.mentalLeapState?.unconscious)
    throw new Error(block || "This character cannot take the final attack.");
  const refresh = system.refreshAction;
  if (refresh?.state === "waiting" && refresh.combatId === combat.id && refresh.startRound === combat.round)
    throw new Error("Refresh forfeited this round’s chance to act.");
  return {
    source: "combatInstincts",
    combatId: combat.id,
    round: combat.round,
    combatantId: combat.combatantId,
    opponentUuid: check.actorUuid,
    defenseTotal,
    opponentResult: check.effectiveTotal,
    missMargin: margin,
    adjacentConfirmed: true,
    notFlatFootedConfirmed: true,
    immediateConfirmed: true,
    ...(knownFlatFooted ? { gcTimingResolution } : {}),
    attackAction: "standard",
    free: true
  };
}
