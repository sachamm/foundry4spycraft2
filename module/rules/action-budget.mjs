/** A turn's actions: two half actions, or one full action. Pure bookkeeping; the table still decides what an action costs. */
export const HALF_ACTIONS_PER_TURN = 2;
export const ACTION_COST = { half: 1, full: 2 };

/** The saved budget, or a fresh one when it belongs to another round: a combatant takes one turn a round. */
export function actionBudget(saved, { round }) {
  return saved && saved.round === round ? saved : { round, used: 0 };
}

/**
 * Spend an action from a turn's budget.
 * @returns {{ok: boolean, state: object, left: number}} ok is false when the turn has too little left
 */
export function spendAction(state, kind, { extra = 0, label = "" } = {}) {
  const cost = ACTION_COST[kind];
  if (!cost) throw new Error(`Unknown action kind: ${kind}`);
  // `extra` is half actions granted on top of the turn's own, such as the one a Press buys.
  const limit = HALF_ACTIONS_PER_TURN + Math.max(0, extra),
    used = state.used + cost;
  if (used > limit) return { ok: false, state, left: limit - state.used };
  // What marked each half action, in order, so a pip can say where its mark came from.
  const sources = [...pipSources(state, state.used), ...Array(cost).fill(String(label ?? ""))];
  return { ok: true, state: { ...state, used, sources }, left: limit - used };
}

/** What marked each of the first `count` half actions; "" for a mark with no record (set by hand, or older). */
export function pipSources(state, count = state?.used ?? 0) {
  const known = Array.isArray(state?.sources) ? state.sources : [];
  return Array.from({ length: Math.max(0, count) }, (_, index) => String(known[index] ?? ""));
}

/** The record after its count is set by hand: marks kept keep their source, new ones carry `label`. */
export function setActionsUsed(state, used, label = "") {
  const kept = pipSources(state, Math.min(used, state?.used ?? 0));
  return { ...state, used, sources: [...kept, ...Array(Math.max(0, used - kept.length)).fill(String(label ?? ""))] };
}

/** Give back everything spent this turn. */
export const resetActions = state => ({ ...state, used: 0, sources: [] });
