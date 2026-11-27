import { defenseBoostPlan } from "../health.mjs";
import { actionDieTotal } from "./gc-spend.mjs";
import { loc } from "../../i18n.mjs";

export function npcDefensePlan(
  system,
  combat,
  { die, balance, combatant, atStartOfRound = false, replaceExisting = false } = {}
) {
  if (![4, 6, 8, 10, 12].includes(die) || !Number.isSafeInteger(balance) || balance < 1)
    throw Error(loc`Review the NPC die type and available GC dice.`);
  const plan = defenseBoostPlan({ ...system, actionDice: { value: balance, die } }, combat, {
    atStartOfRound,
    combatant,
    replaceExisting
  });
  if (plan.blocked) throw Error(plan.reason);
  return { die, combatId: combat.id, startRound: combat.round };
}

export function npcDefenseResult(delivery, rolls) {
  if (
    delivery?.version !== 1 ||
    ![4, 6, 8, 10, 12].includes(delivery.die) ||
    typeof delivery.id !== "string" ||
    !delivery.id ||
    typeof delivery.combatId !== "string" ||
    !delivery.combatId ||
    !Number.isSafeInteger(delivery.startRound) ||
    delivery.startRound < 1 ||
    typeof delivery.explodeLow !== "boolean" ||
    !Array.isArray(rolls) ||
    !rolls.length
  )
    throw Error(loc`Review the NPC Defense delivery and its actual die results.`);
  const result = actionDieTotal(delivery.die, rolls, { explodeLow: delivery.explodeLow });
  if (
    !result.complete ||
    result.used !== rolls.length ||
    !Number.isSafeInteger(result.total) ||
    !Number.isSafeInteger(delivery.startRound + result.total)
  )
    throw Error(loc`Record the complete actual exploding die, ending with a non-exploding result.`);
  return {
    combatId: delivery.combatId,
    startRound: delivery.startRound,
    expiresAtRound: delivery.startRound + result.total,
    rounds: result.total,
    actionDiceReceiptId: delivery.id,
    gcFunded: true
  };
}
