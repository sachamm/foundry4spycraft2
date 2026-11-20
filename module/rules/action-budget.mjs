/** A turn's actions: two half actions, or one full action. Pure bookkeeping; the table still decides what an action costs. */
export const HALF_ACTIONS_PER_TURN = 2;
export const ACTION_COST = { half: 1, full: 2 };

/** The saved budget, or a fresh one when it belongs to another turn. */
export function actionBudget(saved, { round, turn }) {
  return saved && saved.round === round && saved.turn === turn ? saved : { round, turn, used: 0 };
}

/**
 * Spend an action from a turn's budget.
 * @returns {{ok: boolean, state: object, left: number}} ok is false when the turn has too little left
 */
export function spendAction(state, kind, { extra = 0 } = {}) {
  const cost = ACTION_COST[kind];
  if (!cost) throw new Error(`Unknown action kind: ${kind}`);
  // `extra` is half actions granted on top of the turn's own, such as the one a Press buys.
  const limit = HALF_ACTIONS_PER_TURN + Math.max(0, extra),
    used = state.used + cost;
  if (used > limit) return { ok: false, state, left: limit - state.used };
  return { ok: true, state: { ...state, used }, left: limit - used };
}

/** Give back everything spent this turn. */
export const resetActions = state => ({ ...state, used: 0 });
