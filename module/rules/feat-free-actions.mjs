import { validOwnCountClock } from "./own-count-duration.mjs";
import { attributeActionBlock } from "./attributes.mjs";
import { restraintActionBlock } from "./restraints.mjs";
import { loc } from "../i18n.mjs";
export const FREE_ACTION_FEATS = { quickDraw: "Quick Draw", surgeOfSpeed: "Surge of Speed" };
export const QUICK_DRAW_ACTIONS = {
  draw: "Draw Weapon",
  holster: "Holster Weapon",
  pickUp: "Pick Up Weapon",
  reload: "Reload"
};
/** p.175: convert a confirmed legal action; never silently resolve gear, movement or a skill check. */
export function featFreeActionPlan(
  system,
  combat,
  {
    source = "",
    action = "",
    description = "",
    confirmed = false,
    nonAttackHalfActionConfirmed = false,
    purelyMentalConfirmed = false
  } = {}
) {
  const name = FREE_ACTION_FEATS[source];
  if (!name || !system.activeFeatNames?.includes(name))
    throw new Error(loc`Choose an earned Quick Draw or Surge of Speed feat.`);
  if (!validOwnCountClock(combat) || combat.turn !== combat.ownTurnIndex)
    throw new Error(loc`Use this free action during this character’s Initiative Count in a started combat.`);
  const mental = source === "surgeOfSpeed" && purelyMentalConfirmed === true;
  const blocked =
    restraintActionBlock(system, { free: true }) ||
    attributeActionBlock(system, { kind: mental ? "mentalAbility" : "skill", ability: mental ? "" : "dex" });
  if (blocked) throw new Error(blocked);
  if (system.conditionContext?.bound === true && source === "quickDraw")
    throw new Error(loc`Bound: weapon handling requires the use of your hands.`);
  if (
    system.refreshAction?.state === "waiting" &&
    system.refreshAction.combatId === combat.id &&
    system.refreshAction.startRound === combat.round
  )
    throw new Error(loc`Refresh forfeited this round’s chance to act.`);
  if (confirmed !== true || typeof description !== "string" || !description.trim() || description.length > 1000)
    throw new Error(loc`Describe the actual legal action and confirm its circumstances with the GC.`);
  if (source === "quickDraw" && !Object.hasOwn(QUICK_DRAW_ACTIONS, action))
    throw new Error(loc`Quick Draw permits only Draw Weapon, Holster Weapon, Pick Up Weapon or Reload.`);
  if (source === "surgeOfSpeed" && (action !== "nonAttackHalfAction" || nonAttackHalfActionConfirmed !== true))
    throw new Error(loc`Surge of Speed requires one non-attack half action.`);
  return {
    version: 1,
    source: name,
    resourceId: source,
    action: source === "quickDraw" ? QUICK_DRAW_ACTIONS[action] : loc`Non-attack half action`,
    description: description.trim(),
    actionCost: "free",
    combatId: combat.id,
    combatantId: combat.combatantId,
    round: combat.round,
    turn: combat.turn,
    nonAttackHalfActionConfirmed: source === "surgeOfSpeed",
    purelyMentalConfirmed: mental,
    confirmed: true
  };
}
