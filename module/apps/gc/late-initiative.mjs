/**
 * A combatant who rolls Initiative after the round began, on a Count already passed, would sort above the turn and
 * lose the round. Such a late roller takes the next turn instead, once this round; the order then carries on from
 * where it was.
 *
 * The record lives on the combat (flags.spycraft2.late = { round, ids, resume }), so whoever presses Next turn, GC or
 * player, reads the same state.
 */
import { isLeadGM } from "../../writers.mjs";

/**
 * Where a forward turn change should go instead, or null to let it stand.
 * @param {{round:number, turn:number, nextTurn:number, nextRound:number, order:string[], late:object|null}} state
 * @returns {{turn:number, late:object|null}|null}
 */
export function lateTurnRedirect({ round, turn, nextTurn, nextRound, order, late }) {
  if (!late || late.round !== round) return null;
  // The round ends: whatever was owed this round is dropped.
  if (nextRound !== round) return { turn: nextTurn, late: null };
  const acting = order[turn];
  // A late roller just had its turn: back to the one who would have come next.
  if (late.resume && late.current === acting) {
    const index = order.indexOf(late.resume);
    const rest = { ...late, current: null, resume: null };
    if (index >= 0) return { turn: index, late: rest };
    return { turn: nextTurn, late: rest };
  }
  const owed = (late.ids ?? []).filter(id => {
    const index = order.indexOf(id);
    return index >= 0 && index < nextTurn;
  });
  if (!owed.length) return null;
  const [first, ...others] = owed;
  return {
    turn: order.indexOf(first),
    late: {
      round,
      ids: [...others, ...(late.ids ?? []).filter(id => !owed.includes(id))],
      current: first,
      resume: late.resume ?? order[nextTurn] ?? null
    }
  };
}

/** Record that a combatant rolled late on a Count already passed this round. */
export function lateEntry(late, { round, id }) {
  const same = late?.round === round ? late : { round, ids: [] };
  return same.ids.includes(id) ? same : { ...same, ids: [...same.ids, id] };
}

export function installLateInitiative() {
  const unrolled = new Set();
  Hooks.on("preUpdateCombatant", (combatant, changed) => {
    if (combatant.initiative === null && Number.isFinite(changed?.initiative) && combatant.parent?.started)
      unrolled.add(combatant.id);
  });
  Hooks.on("updateCombatant", async combatant => {
    const combat = combatant.parent;
    if (!unrolled.has(combatant.id) || !combat?.started) return;
    unrolled.delete(combatant.id);
    if (!isLeadGM()) return;
    combat.setupTurns?.();
    const index = combat.turns.findIndex(entry => entry.id === combatant.id);
    // A Count still to come this round needs nothing; one already passed is owed a turn.
    if (index < 0 || index >= combat.turn) return;
    await combat.update({
      "flags.spycraft2.late": lateEntry(combat.flags?.spycraft2?.late ?? null, {
        round: combat.round,
        id: combatant.id
      })
    });
    ui.notifications.info(game.i18n.format("SPYCRAFT.Console.LateTurn", { name: combatant.name }));
  });
  Hooks.on("preUpdateCombat", (combat, changed, options) => {
    if (!combat.started || options?.direction < 0 || options?.spycraft2KeepTurn) return;
    if (!Object.hasOwn(changed, "turn") && !Object.hasOwn(changed, "round")) return;
    const late = combat.flags?.spycraft2?.late ?? null;
    if (!late) return;
    const redirect = lateTurnRedirect({
      round: combat.round,
      turn: combat.turn,
      nextTurn: changed.turn ?? combat.turn,
      nextRound: changed.round ?? combat.round,
      order: combat.turns.map(entry => entry.id),
      late
    });
    if (!redirect) return;
    changed.turn = redirect.turn;
    foundry.utils.setProperty(changed, "flags.spycraft2.late", redirect.late);
  });
}
