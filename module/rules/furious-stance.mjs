/**
 * Club Basics' Furious Stance (p.177): at the end of each round spent in the stance, the character's Initiative
 * Count rises by the number of melee attacks they made during that round.
 *
 * Attacks are counted from posted attack records, which already carry the combat and round they were rolled in
 * (`rollCombat`). A replacement roll (a reroll) is the same attack, so only originals count. The defender's side of
 * a Disarm is not an attack the character made.
 */
import { combatStanceState } from "./combat-stance.mjs";
import { loc } from "../i18n.mjs";

/** Melee attacks a character made in one round of one combat, counted from posted check records. */
export function furiousMeleeAttackCount(records, { actorUuid, combatId, round } = {}) {
  let count = 0;
  for (const c of records ?? []) {
    if (
      c?.checkKind !== "attack" ||
      c.actorUuid !== actorUuid ||
      c.rollCombat?.id !== combatId ||
      c.rollCombat?.round !== round ||
      c.rerollOf ||
      c.attackContext?.ranged !== false ||
      c.attackContext?.disarm?.role === "defender"
    )
      continue;
    count++;
  }
  return count;
}

/**
 * The end-of-round Count change for one combatant, or null when there is none.
 * @param {object} system  the character's prepared system data (its current stance)
 * @param {object} facts   { initiative, combatId, round, count, record }; `record` is the combatant's last
 *                         Furious Stance entry, so a round is never counted twice and a rewound round is skipped
 */
export function furiousStanceRoundPlan(system, { initiative, combatId, round, count, record = null } = {}) {
  const stance = combatStanceState(system);
  if (stance?.key !== "furious") return null;
  if (typeof combatId !== "string" || !combatId || !Number.isSafeInteger(round) || round < 1) return null;
  if (record?.combatId === combatId && Number.isSafeInteger(record.round) && record.round >= round) return null;
  if (!Number.isSafeInteger(count) || count < 0) throw Error(loc`Review the melee attacks counted for Furious Stance.`);
  if (typeof initiative !== "number" || !Number.isFinite(initiative))
    throw Error(loc`Furious Stance needs a rolled Initiative Count.`);
  return {
    initiative: initiative + count,
    record: { version: 1, combatId, round, added: count, stanceId: stance.id }
  };
}

export function furiousStanceNote(name, plan) {
  return plan.record.added
    ? loc`${name}: Furious Stance raises the Initiative Count by ${plan.record.added} for the melee attacks made in round ${plan.record.round} (p.177).`
    : loc`${name}: no melee attacks in round ${plan.record.round}, so Furious Stance leaves the Initiative Count unchanged (p.177).`;
}
