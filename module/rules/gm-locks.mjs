import { loc } from "../i18n.mjs";
import { isResourceLock } from "./resource-locks.mjs";
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
 * A GC client that does not answer within QUERY_TIMEOUT_MS is not asked again for a minute: each spend in that time
 * goes straight to the document lock instead of waiting out the timeout again, and the player sees one notice. While
 * clients are mixed like that, the GC refuses a lock for a character that already carries a live document lock, so the
 * two kinds still exclude each other.
 *
 * Limit: the table lives in one client. If the active GM is signed in from two browsers, each has its own table and
 * their own actions are not excluded from one another. The document lock has no such limit, which is why it stays
 * the default.
 */

export const LOCK_QUERY = "spycraft2.resourceLock";
export const GM_TOKEN_PREFIX = "gm:";
export const QUERY_TIMEOUT_MS = 1500;
export const UNREACHABLE_MEMORY_MS = 60000;
/** The GC that last failed to answer, and until when it is not asked again: { gmId, until }, or null. */
let unreachableGM = null;

/** Forget a GC that failed to answer (tests, or a GC that reconnected). */
export function forgetUnreachableGM() {
  unreachableGM = null;
}

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

/** Whether the character a lock key names ("<actor uuid>:<scope>") carries a live document lock for that scope. */
function documentLockOn(key, resolve) {
  const at = typeof key === "string" ? key.lastIndexOf(":") : -1;
  if (at < 1) return false;
  try {
    return isResourceLock(resolve(key.slice(0, at))?.items?.get?.(key.slice(at + 1)));
  } catch {
    return false;
  }
}

/**
 * The query handler the GM's client answers lock requests with. A key whose character already carries a document
 * lock (taken by a client that could not reach this GC) is busy.
 */
export function lockQueryHandler(table = lockTable, { resolve = uuid => globalThis.fromUuidSync?.(uuid) } = {}) {
  return ({ action, keys, token, userId } = {}) => {
    if (action === "acquire") {
      const locked = Array.isArray(keys) ? keys.filter(key => documentLockOn(key, resolve)) : [];
      if (locked.length) return { ok: false, busy: locked, holders: [] };
      return table.acquire(keys, token, userId);
    }
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
export async function requestLock(
  action,
  keys,
  token,
  {
    game = globalThis.game,
    table = lockTable,
    now = Date.now(),
    notify = message => globalThis.ui?.notifications?.info(message)
  } = {}
) {
  const gm = game?.users?.activeGM;
  if (!gm) return { ok: false, busy: [], unreachable: true };
  const request = { action, keys, token, userId: game.user?.id ?? null };
  if (gm.isSelf) return lockQueryHandler(table)(request);
  const remembered = unreachableGM !== null && unreachableGM.gmId === gm.id;
  // Releases are always sent: the GC may only have been slow, and still hold the lock.
  if (action === "acquire" && remembered && now < unreachableGM.until)
    return { ok: false, busy: [], unreachable: true };
  let answer;
  try {
    answer = await gm.query(LOCK_QUERY, request, { timeout: QUERY_TIMEOUT_MS });
  } catch {
    answer = null;
  }
  if (answer && typeof answer === "object") {
    if (remembered) unreachableGM = null;
    return answer;
  }
  if (action === "acquire") {
    if (!remembered)
      notify(loc`The GC’s client did not answer in time. Spending uses locks on the character until it answers again.`);
    unreachableGM = { gmId: gm.id, until: now + UNREACHABLE_MEMORY_MS };
  }
  return { ok: false, busy: [], unreachable: true };
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
