/**
 * Intense Stance (Whip Basics, p.180): while in the stance, the character may make no attack checks for 1 full round
 * to gain +2 on melee attack checks and damage during the following full round. `system.intenseStance` records the
 * declaration from the own Initiative Count; attacks are refused while holding, and the bonus applies afterwards.
 */
import { ownCountDurationActive, validOwnCountClock } from "./own-count-duration.mjs";
import { combatStanceState } from "./combat-stance.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

export const INTENSE_BONUS = 2;

export function intenseStanceState(system) {
  const r = system?.intenseStance,
    c = system?.intenseCombatContext;
  if (!r || r.version !== 1) return { holding: false, bonus: 0 };
  const window = start => ({ ...r, startRound: start, dueRound: start + 1 });
  if (ownCountDurationActive(window(r.startRound), c)) return { holding: true, bonus: 0, dueRound: r.startRound + 1 };
  if (ownCountDurationActive(window(r.startRound + 1), c))
    return { holding: false, bonus: INTENSE_BONUS, dueRound: r.startRound + 2 };
  return { holding: false, bonus: 0 };
}

export function intenseStancePlan(system, combat, { confirmed = false } = {}) {
  if (combatStanceState(system ?? {})?.key !== "intense") throw new Error(loc`Enter Intense Stance first.`);
  if (!validOwnCountClock(combat) || combat.turn !== combat.ownTurnIndex)
    throw new Error(loc`Declare it during your own Initiative Count in a started combat.`);
  if (confirmed !== true) throw new Error(loc`Confirm you will make no attack checks for 1 full round.`);
  const s = intenseStanceState({ ...system, intenseCombatContext: combat });
  if (s.holding || s.bonus) throw new Error(loc`Intense Stance is already building or paying off.`);
  return { version: 1, combatId: combat.id, combatantId: combat.combatantId, startRound: combat.round };
}

/** The damage bonus on a melee weapon’s damage roll. */
export const intenseDamage = (system, weapon) =>
  !weapon?.range && weapon?.proficiency !== "hurled" ? intenseStanceState(system).bonus : 0;

rollPipeline.register({
  id: "intenseStanceAttackTerm",
  kinds: ["attack"],
  order: 9196,
  terms({ system, ranged }) {
    const s = intenseStanceState(system);
    if (s.holding)
      return {
        key: "intenseStance",
        blockAt: 203,
        blocked: loc`Intense Stance: you make no attack checks this round.`
      };
    if (!s.bonus || ranged) return null;
    return {
      key: "intenseStance",
      plan: { version: 1, bonus: s.bonus },
      rowAt: 292,
      rows: [[loc`Intense Stance`, s.bonus]],
      noteAt: 504,
      notes: [loc`Intense Stance: +2 on this melee attack and its damage (p.180).`]
    };
  }
});
