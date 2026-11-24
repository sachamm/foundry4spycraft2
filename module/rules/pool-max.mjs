/**
 * Vitality, wounds and action dice follow their maximums. A new agent starts each pool full, and whenever a build
 * choice or a change in play moves a maximum, the current value moves by the same amount. A hurt character who
 * gains a level keeps the damage taken; one who loses a maximum keeps the same damage taken.
 */
import { same } from "./equal.mjs";

export const FOLLOWED_POOLS = ["vitality", "wounds", "actionDice"];
/** An NPC has no action dice of its own; its vitality and wounds exist only while it is a special character. */
export const NPC_POOLS = ["vitality", "wounds"];
/** The pools followed for one actor type, and whether a maximum of 0 empties the pool (an NPC that stops being special). */
export const poolRules = type =>
  type === "npc" ? { pools: NPC_POOLS, emptyAtZero: true } : { pools: FOLLOWED_POOLS, emptyAtZero: false };
/** Where each agent records the maximums its current values last followed. */
export const POOL_MAX_FLAG = "poolMax";

const whole = Number.isSafeInteger;

/**
 * The update that brings current values in line with changed maximums. An empty object means nothing to write.
 * @param {object} system  Prepared agent data, with each pool's value and max.
 * @param {object|null|undefined} seen  The maximums recorded last time. Missing means none were recorded yet: the
 *   current maximums are recorded and the current values are left as they are.
 */
export function poolMaxPlan(system, seen, { pools = FOLLOWED_POOLS, emptyAtZero = false } = {}) {
  const patch = {},
    next = {};
  for (const key of pools) {
    const value = system?.[key]?.value,
      max = system?.[key]?.max;
    if (!whole(value) || !whole(max)) {
      if (whole(seen?.[key])) next[key] = seen[key];
      continue;
    }
    next[key] = max;
    // A fall that could not take its full amount (a floor, or an NPC that stopped being special) remembers where
    // the pool stood, so a maximum that comes back restores the damage taken instead of healing it. Any other
    // change to the value in between (damage, healing) makes the memory stale and it is dropped.
    const memory = seen?.kept?.[key],
      remembered = memory && whole(memory.value) && whole(memory.max) && memory.after === value ? memory : null;
    const moved = whole(seen?.[key]) && seen[key] !== max;
    let after = value,
      keep = remembered;
    if (moved) {
      const from = remembered ?? { value, max: seen[key] },
        net = max - from.max;
      after = emptyAtZero && max === 0 ? 0 : followedValue(key, from.value, net, max);
      keep = after === from.value + net ? null : { value: from.value, max: from.max, after };
    }
    // An update merges into the stored record, so a memory that is spent is overwritten with null, not left out.
    if (keep || (seen?.kept && key in seen.kept)) (next.kept ??= {})[key] = keep ?? null;
    if (after !== value) patch[`system.${key}.value`] = after;
  }
  if (!same(next, seen ?? null)) patch[`flags.spycraft2.${POOL_MAX_FLAG}`] = next;
  return patch;
}

/**
 * What a new agent records before its first preparation. An empty pool records a maximum of 0, so it then rises to
 * the full maximum the way any rise is followed; a pool that already holds a value (a copy of a played character)
 * records nothing and keeps that value.
 */
export function newAgentPoolMax(system, pools = FOLLOWED_POOLS) {
  const seen = {};
  for (const key of pools) if ((system?.[key]?.value ?? 0) === 0) seen[key] = 0;
  return seen;
}

/** One pool's value after its maximum moved by change. */
export function followedValue(key, value, change, max) {
  if (change > 0)
    // Action dice are a pool that awards can take past the starting count, so a rise is never capped.
    return key === "actionDice" ? value + change : Math.max(value, Math.min(value + change, max));
  // A falling maximum takes the same amount away, but never empties a pool by itself (wounds stop at 1, so losing
  // a maximum cannot knock a character out), and never pushes an already low value lower than it was.
  const floor = key === "wounds" ? 1 : 0;
  return Math.max(value + change, Math.min(value, floor));
}
