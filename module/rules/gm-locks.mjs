import { loc } from "../i18n.mjs";
/**
 * Resource locks arbitrated by the Game Control's client.
 *
 * The default lock is a document created on the character (module/services/transactions.mjs). This alternative keeps
 * the lock in the active GM's memory instead: a client asks the GM for the lock, works, and gives it back. Nothing
 * is written to the character, so an interrupted action leaves no document behind, and a client that disconnects
 * loses its locks automatically.
 *
 * It is used only when the world setting `spycraft2.lockMode` is "gm" and a GM is connected; otherwise the
 * document locks are used. Requests travel over Foundry's user queries (CONFIG.queries, User#query).
 *
 * Limit: the table lives in one client. If the active GM is signed in from two browsers, each has its own table and
 * their own actions are not excluded from one another. The document lock has no such limit, which is why it stays
 * the default.
 */

export const LOCK_QUERY = "spycraft2.resourceLock";
export const GM_TOKEN_PREFIX = "gm:";
const QUERY_TIMEOUT_MS = 5000;

/** Locks held in one client's memory: key → { token, userId, at }. */
export class LockTable {
  #locks = new Map();

  /** Take every key or none. Returns { ok: true } or { ok: false, busy: [keys], holders: [userIds] }. */
  acquire(keys, token, userId, now = Date.now()) {
    if (!Array.isArray(keys) || !keys.length || keys.some(k => typeof k !== "string" || !k)) {
      return { ok: false, busy: [], error: loc`A lock request names at least one key.` };
    }
    if (typeof token !== "string" || !token)
      return { ok: false, busy: [], error: loc`A lock request carries a token.` };
    const busy = keys.filter(key => this.#locks.has(key) && this.#locks.get(key).token !== token);
    if (busy.length) return { ok: false, busy, holders: [...new Set(busy.map(key => this.#locks.get(key).userId))] };
    for (const key of keys) this.#locks.set(key, { token, userId, at: now });
    return { ok: true };
  }

  /** Give back the keys this token holds. Keys held by another token are left alone. */
  release(keys, token) {
    let released = 0;
    for (const key of keys ?? []) {
      if (this.#locks.get(key)?.token === token) {
        this.#locks.delete(key);
        released += 1;
      }
    }
    return { ok: true, released };
  }

  /** Drop every lock a user holds (they disconnected). */
  releaseUser(userId) {
    let released = 0;
    for (const [key, lock] of this.#locks) {
      if (lock.userId === userId) {
        this.#locks.delete(key);
        released += 1;
      }
    }
    return released;
  }

  /** Who holds a key, or null. */
  holder(key) {
    const lock = this.#locks.get(key);
    return lock ? { ...lock } : null;
  }

  /** Force a key free (GC recovery). */
  clear(key) {
    return this.#locks.delete(key);
  }

  get size() {
    return this.#locks.size;
  }
}

/** The table this client arbitrates with when it is the active GM. */
export const lockTable = new LockTable();

/** The query handler the GM's client answers lock requests with. */
export function lockQueryHandler(table = lockTable) {
  return ({ action, keys, token, userId } = {}) => {
    if (action === "acquire") return table.acquire(keys, token, userId);
    if (action === "release") return table.release(keys, token);
    return { ok: false, busy: [], error: "Unknown lock request." };
  };
}

/** Whether this world asks the GM to arbitrate, and one is connected. */
export function gmLockingActive(game = globalThis.game) {
  let mode = "items";
  try {
    mode = game?.settings?.get?.("spycraft2", "lockMode") ?? "items";
  } catch {
    mode = "items";
  }
  return mode === "gm" && !!game?.users?.activeGM;
}

/**
 * Send a lock request to the active GM: answered from this client's own table when this client is that GM.
 * Returns the GM's answer, or { ok: false, unreachable: true } when no GM answers.
 */
export async function requestLock(action, keys, token, { game = globalThis.game, table = lockTable } = {}) {
  const gm = game?.users?.activeGM;
  if (!gm) return { ok: false, busy: [], unreachable: true };
  const request = { action, keys, token, userId: game.user?.id ?? null };
  if (gm.isSelf) return lockQueryHandler(table)(request);
  try {
    const answer = await gm.query(LOCK_QUERY, request, { timeout: QUERY_TIMEOUT_MS });
    return answer && typeof answer === "object" ? answer : { ok: false, busy: [], unreachable: true };
  } catch {
    return { ok: false, busy: [], unreachable: true };
  }
}

/** Register the setting, the query handler and disconnect clean-up. Call during `init`. */
export function registerGmLocks() {
  game.settings.register("spycraft2", "lockMode", {
    name: "SPYCRAFT.Settings.LockMode.Name",
    hint: "SPYCRAFT.Settings.LockMode.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: { items: "SPYCRAFT.Settings.LockMode.Items", gm: "SPYCRAFT.Settings.LockMode.Gm" },
    default: "items"
  });
  CONFIG.queries[LOCK_QUERY] = lockQueryHandler();
  Hooks.on("userConnected", (user, connected) => {
    if (!connected) lockTable.releaseUser(user.id);
  });
}
