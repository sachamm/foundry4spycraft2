import { attributeActionBlock } from "./attributes.mjs";
import { restraintActionBlock } from "./restraints.mjs";
import { validOwnCountClock } from "./own-count-duration.mjs";
import { loc } from "../i18n.mjs";
/** Contempt p.174; standard animal NPCs p.441. */
export function contemptPlan(
  system,
  combat,
  target,
  { targetStandardConfirmed = false, attackLegalConfirmed = false } = {}
) {
  if (!system.activeFeatNames?.includes("Contempt") || !Number.isSafeInteger(system.level) || system.level < 6)
    throw new Error(loc`Contempt requires an earned feat and Career Level6+.`);
  if (!validOwnCountClock(combat) || combat.turn !== combat.ownTurnIndex)
    throw new Error(loc`Take this free final attack during your Initiative Count in a started combat.`);
  if (
    !target?.uuid ||
    target.type !== "npc" ||
    !["standard", "animal"].includes(target.npcType) ||
    targetStandardConfirmed !== true ||
    attackLegalConfirmed !== true
  )
    throw new Error(
      loc`Choose an actual standard NPC or GC-confirmed standard animal and confirm this legal attack; special characters cannot qualify.`
    );
  const allowance = system.actionDice?.max;
  if (!Number.isSafeInteger(allowance) || allowance < 0)
    throw new Error(loc`Review the character’s starting action-die allowance.`);
  const block = restraintActionBlock(system, { free: true }) || attributeActionBlock(system, { kind: "attack" });
  if (block || system.wounds?.value < 0 || system.mentalLeapState?.unconscious)
    throw new Error(block || loc`This character cannot take a final attack.`);
  const refresh = system.refreshAction;
  if (refresh?.state === "waiting" && refresh.combatId === combat.id && refresh.startRound === combat.round)
    throw new Error(loc`Refresh forfeited this round’s chance to act.`);
  return {
    source: "contempt",
    combatId: combat.id,
    round: combat.round,
    combatantId: combat.combatantId,
    targetUuid: target.uuid,
    targetType: target.npcType,
    standardConfirmed: true,
    combatAllowance: allowance,
    attackAction: "standard",
    free: true
  };
}
