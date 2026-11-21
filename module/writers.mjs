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
