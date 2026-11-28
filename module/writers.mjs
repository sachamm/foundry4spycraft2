/**
 * Which connected client writes shared state, so only one of them does. Pure: rules modules use it too.
 */

/** True on the client of the active GC that Foundry has chosen to lead (game.users.activeGM). */
export const isLeadGM = (game = globalThis.game) =>
  game?.user?.isGM === true && game.users?.activeGM?.id === game.user.id;

/**
 * The one connected user who writes for a character: the active GC, or with no GC connected the connected owner
 * whose id sorts first. null when nobody connected may write it.
 */
export function primaryWriterFor(actor, game = globalThis.game) {
  if (game?.users?.activeGM) return game.users.activeGM;
  const users = typeof game?.users?.[Symbol.iterator] === "function" ? [...game.users] : [];
  return (
    users
      .filter(user => user.active && actor?.testUserPermission?.(user, "OWNER"))
      .sort((a, b) => a.id.localeCompare(b.id))[0] ?? null
  );
}

/**
 * A per-character queue for reconcile hooks: `work(actor)` runs soon, once for any number of calls in a row, and
 * again if another call arrives while it runs. Callers check first that this client is the one that writes.
 */
export function writerQueue(work, onError = () => {}) {
  const pending = new WeakMap();
  return actor => {
    const queued = pending.get(actor);
    if (queued) {
      queued.again = true;
      return queued.promise;
    }
    const state = { again: true };
    pending.set(actor, state);
    state.promise = Promise.resolve()
      .then(async () => {
        do {
          state.again = false;
          await work(actor);
        } while (state.again);
      })
      .catch(onError)
      .finally(() => pending.delete(actor));
    return state.promise;
  };
}
