/**
 * Better Luck Next Time, p.189: when a single action die spent to boost a skill check or save rolls a natural 1,
 * the character gets that die back once the check is resolved.
 *
 * A qualifying boost leaves a pending entry in the check's `betterLuckRefunds` (module/rules/action-dice.mjs).
 * Resolving the check settles every entry once: an ordinary die returns to the ordinary count; a bonus-pool die
 * returns to its unrestricted pool if that pool is still live, and is otherwise lost with it.
 */
import { unrestrictedBonusPoolStatus } from "./bonus-pools.mjs";
import { loc } from "../i18n.mjs";

/** The balance changes a resolved check's pending refunds make, or null when there are none. */
export function betterLuckSettlement(system, check, { periods = system.usagePeriods } = {}) {
  const refunds = Array.isArray(check?.betterLuckRefunds) ? check.betterLuckRefunds : [];
  if (!refunds.length || check.betterLuckRefunded === true) return null;
  let ordinary = 0;
  const pools = {},
    lost = [];
  for (const r of refunds) {
    if (!r?.bonusPoolId) {
      ordinary++;
      continue;
    }
    const pool = system.bonusActionDice?.[r.bonusPoolId],
      remaining = (pools[r.bonusPoolId] ?? pool?.remaining ?? 0) + 1;
    // A check-bound pool belongs to the check now being resolved, so only unrestricted pools take a die back. Ask
    // the pool's status as if it held a die, to tell "still live" apart from "spent".
    const live =
      pool?.unrestricted === true &&
      Number.isSafeInteger(pool.granted) &&
      remaining <= pool.granted &&
      unrestrictedBonusPoolStatus(
        { ...system, bonusActionDice: { ...system.bonusActionDice, [r.bonusPoolId]: { ...pool, remaining: 1 } } },
        r.bonusPoolId,
        { periods }
      ).available > 0;
    if (live) pools[r.bonusPoolId] = remaining;
    else lost.push(pool?.label ?? r.bonusPoolId);
  }
  const value = (system.actionDice?.value ?? 0) + ordinary;
  if (!Number.isSafeInteger(value)) throw Error(loc`The refunded action-die balance exceeds a safe whole number.`);
  return { ordinary, value, pools, lost, count: refunds.length };
}

export function betterLuckNote(settlement) {
  const back = settlement.count - settlement.lost.length;
  return (
    (back === 1
      ? loc`Better Luck Next Time: 1 action die returned after a natural 1 on a boost.`
      : loc`Better Luck Next Time: ${back} action dice returned after natural 1s on boosts.`) +
    (settlement.lost.length
      ? " " + loc`Not returned (its bonus dice have expired): ${settlement.lost.join(", ")}.`
      : "")
  );
}
