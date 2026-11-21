import { esc } from "../html.mjs";
import { setConditionStatus } from "../rules/condition-status.mjs";
import { conditionDuration } from "../rules/timers.mjs";

export { conditionDuration };
import { loc } from "../i18n.mjs";

const values = c => (typeof c?.values === "function" ? [...c.values()] : Array.isArray(c) ? c : []);

/**
 * Turn a condition on. Returns a line only when it could not be set.
 * @param {{value: number, units: string}|null} [duration]  how long it lasts, as an effect duration
 */
export async function setCondition(target, id, label, duration = null) {
  if (target.statuses?.has(id)) return "";
  try {
    await setConditionStatus(target, id, true, { label, ...(duration ? { duration } : {}) });
    return "";
  } catch (error) {
    return loc`${label} could not be set (${esc(error.message)}); set it by hand.`;
  }
}

async function defeat(target) {
  for (const combat of values(globalThis.game?.combats))
    for (const combatant of combat.combatants ?? [])
      if (combatant.actor === target && !combatant.defeated) await combatant.update({ defeated: true });
}

/** Set the conditions a wound total brings (p.331). Returns lines for anything that could not be set. */
export async function woundConditions(target, state) {
  const lines = [];
  if (["unconscious", "dying"].includes(state)) lines.push(await setCondition(target, "unconscious", loc`Unconscious`));
  if (state === "dying") lines.push(await setCondition(target, "dying", loc`Dying`));
  if (["dead", "destroyed"].includes(state)) {
    lines.push(await setCondition(target, "dead", loc`Dead`));
    await defeat(target);
  }
  return lines;
}
