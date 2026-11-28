import { primaryWriterFor } from "../writers.mjs";
import { shakenRules } from "../rules/shaken.mjs";
import { GM_TOKEN_PREFIX, gmLockingActive, lockTable, requestLock } from "../rules/gm-locks.mjs";
import { loc } from "../i18n.mjs";
import { systemDialog } from "../apps/dialog-theme.mjs";
import {
  GC_RESOURCE_LOCK_ID,
  isResourceLock,
  RESOURCE_LOCK_ID,
  RULE_RESOURCE_LOCK_ID
} from "../rules/resource-locks.mjs";
import { Refusal, decline, refuseStep } from "../error-notices.mjs";
export { GC_RESOURCE_LOCK_ID, isResourceLock, RESOURCE_LOCK_ID, RULE_RESOURCE_LOCK_ID };
/** v14 native embedded-document uniqueness serializes resource transactions across clients.
 * Uses the authenticated document API and existing ownership, without a privileged socket relay.
 */
const scopeQueues = new Map();
const lockKey = (actor, scope) => `${actor.uuid}:${scope}`;
const held = new Map();
export class ResourceBusyError extends Refusal {}
/** Another transaction holds this character's lock right now. It clears by itself when that one finishes. */
export class ResourceLockedError extends ResourceBusyError {}
const BACKGROUND_RETRIES = 6;
const BACKGROUND_DELAY_MS = 350;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function requireSettledPeriod(allow) {
  const stored = globalThis.game?.settings?.get?.("spycraft2", "usagePeriodReview"),
    review = stored?.needsReview ? stored : (globalThis.game?.spycraft2?.pendingUsagePeriodReview ?? stored);
  if (!allow && review?.needsReview)
    throw new ResourceBusyError(loc`The GC must review the interrupted start before further resource use.`);
}

/**
 * One local barrier for every participant, acquired together to prevent reciprocal-queue deadlocks.
 *
 * `background` is for bookkeeping nobody asked for (a hook that reconciles a derived value after a character
 * changes). When the character is locked by someone's own action, such work waits and tries again instead of
 * putting a warning on screen about a transaction the viewer did not start.
 */
export function queueResources(actors, work, { messages = [], allowPeriodReview = false, background = false } = {}) {
  const unique = [...new Map(actors.filter(Boolean).map(actor => [actor.uuid, actor])).values()].sort((a, b) =>
    a.uuid < b.uuid ? -1 : a.uuid > b.uuid ? 1 : 0
  );
  const previous = unique.map(actor => (actor._actionDieQueue ?? Promise.resolve()).catch(() => {}));
  const pending = Promise.all(previous)
    .then(async () => {
      const attempt = () => {
        requireSettledPeriod(allowPeriodReview);
        const backend = globalThis.game?.spycraft2?.resourceLocks;
        if (globalThis.game?.ready && !backend)
          throw new Error(loc`The resource transaction service is unavailable. Reload the world before spending.`);
        return backend ? backend.run(unique, work, { messages, allowPeriodReview, background }) : work();
      };
      if (!background) return attempt();
      // The lock is taken before any work starts, so trying again never repeats part of the work.
      for (let tries = 0; ; tries++)
        try {
          return await attempt();
        } catch (error) {
          if (!(error instanceof ResourceLockedError) || tries >= BACKGROUND_RETRIES) throw error;
          await wait(BACKGROUND_DELAY_MS * (tries + 1));
        }
    })
    .catch(error => {
      if (error instanceof ResourceBusyError) {
        if (background && error instanceof ResourceLockedError)
          console.debug(
            "Field Agent's Handbook | Background bookkeeping skipped: the character stayed busy.",
            error.message
          );
        else refuseStep(error.message);
        return null;
      }
      throw error;
    });
  for (const actor of unique) actor._actionDieQueue = pending.catch(() => {});
  return pending;
}

/** Call only inside queueResources with the paying actor included in its participants. */
export async function payLockedActionDice(actor, count, perform) {
  if (!actor.isOwner) throw new Error(loc`You must own the paying character.`);
  const shaken = shakenRules(actor.system);
  if (shaken.needsReview || shaken.spendingForbidden)
    throw new Error(
      shaken.needsReview
        ? loc`Review the paying character’s Shaken sources.`
        : loc`Shaken IV: no action dice may be spent at all (p.342).`
    );
  if (!Number.isSafeInteger(count) || count < 1 || count > (actor.system.actionDice?.value ?? 0))
    throw new Error(loc`Not enough action dice remain.`);
  await actor.update({ "system.actionDice.value": actor.system.actionDice.value - count });
  try {
    return await perform();
  } catch (error) {
    try {
      await actor.update({ "system.actionDice.value": actor.system.actionDice.value + count });
    } catch (refundError) {
      // Keep the original failure visible: losing it behind the refund error hides why the spend failed.
      throw new AggregateError(
        [error, refundError],
        loc`${error?.message ?? error} The ${count} action dice spent were not refunded; restore them by hand.`
      );
    }
    throw error;
  }
}

async function readDocument(doc) {
  const result = await doc.constructor.database.get(doc.constructor, { query: { _id: doc.id } });
  if (result.length !== 1) throw new Error(loc`Cannot refresh ${doc.documentName} before its resource transaction.`);
  return result[0];
}
async function readActor(actor) {
  if (!actor.isToken) return readDocument(actor);
  // An unlinked token's resource overrides live in its Scene's ActorDelta, not its base Actor.
  const token = actor.token,
    scene = await readDocument(token.parent),
    fresh = scene.tokens.get(token.id)?.actor;
  if (!fresh) throw new Error(loc`The token was removed before its resource transaction.`);
  return fresh;
}
async function refreshActor(actor) {
  const fresh = await readActor(actor);
  actor.updateSource(fresh.toObject(), { recursive: false });
  if (!actor.isOwner) throw new Error(loc`Ownership changed while starting this resource transaction.`);
  return actor;
}
/**
 * A bookkeeping lock nobody is working under any more. Bookkeeping (see `background` on queueResources) only
 * recomputes derived values and finishes in moments, so one that is still there well after it started was left by a
 * client that closed mid-step. Removing it loses nothing: the next bookkeeping pass recomputes the same values.
 * A lock taken for someone's own action is never treated this way; it stays for the GC to review.
 */
export const BACKGROUND_LOCK_STALE_MS = 30000;
export function abandonedBackgroundLock(item, actor, scope = RESOURCE_LOCK_ID, now = Date.now()) {
  const lock = item?.flags?.spycraft2?.resourceLock;
  if (!lock?.background || !Number.isFinite(lock.started)) return false;
  return held.get(lockKey(actor, scope)) !== lock.token && now - lock.started >= BACKGROUND_LOCK_STALE_MS;
}
/**
 * Removing an abandoned lock is done by one client only, so two clients that both still see the old lock cannot
 * each remove "it" and have the second removal take away the lock the first one has just created. That client is
 * the active GC, or with no GC connected the first connected owner. It re-reads the character, removes the lock
 * only if the stored one is still the abandoned one, and handles one such request at a time per character.
 */
export const CLEAR_LOCK_QUERY = "spycraft2.clearAbandonedLock";
const CLEAR_TIMEOUT_MS = 5000;
const clearing = new Map();
// With nobody else connected who may write it, this client clears the lock itself.
const lockClearer = (actor, game = globalThis.game) => primaryWriterFor(actor, game) ?? game?.user ?? null;
function clearAbandonedLock(actor, scope) {
  const key = lockKey(actor, scope);
  const run = (clearing.get(key) ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const stored = (await readActor(actor)).items.get(scope);
      if (!isResourceLock(stored) || !abandonedBackgroundLock(stored, actor, scope)) return false;
      await actor.deleteEmbeddedDocuments("Item", [scope], { render: false });
      return true;
    });
  clearing.set(
    key,
    run.catch(() => {})
  );
  return run;
}
async function requestLockClear(actor, scope) {
  const clearer = lockClearer(actor);
  if (!clearer) return false;
  if (clearer.isSelf || clearer.id === globalThis.game?.user?.id) return clearAbandonedLock(actor, scope);
  try {
    return (
      (await clearer.query(CLEAR_LOCK_QUERY, { actorUuid: actor.uuid, scope }, { timeout: CLEAR_TIMEOUT_MS })) === true
    );
  } catch {
    return false;
  }
}
/** Answer other clients' requests to clear an abandoned bookkeeping lock. Call during `init`. */
export function registerLockRecovery() {
  CONFIG.queries[CLEAR_LOCK_QUERY] = async ({ actorUuid, scope } = {}) => {
    if (![RESOURCE_LOCK_ID, RULE_RESOURCE_LOCK_ID, GC_RESOURCE_LOCK_ID].includes(scope)) return false;
    const actor = typeof actorUuid === "string" ? await fromUuid(actorUuid) : null;
    if (actor?.documentName !== "Actor" || !actor.isOwner || lockClearer(actor)?.id !== game.user.id) return false;
    return clearAbandonedLock(actor, scope);
  };
}
/** Pauses before a held lock is reported, in milliseconds. */
const LOCK_RETRY_MS = [100, 250, 500];
/** Wait for a lock another client just took to be released; true once it has gone. */
async function lockCleared(actor, scope) {
  for (const delay of [...LOCK_RETRY_MS, 1000]) {
    await new Promise(resolve => setTimeout(resolve, delay));
    if (!actor.items.get(scope)) return true;
  }
  return false;
}
async function acquire(actor, scope = RESOURCE_LOCK_ID, { background = false } = {}) {
  if (!actor.isOwner) throw new Error(loc`You must own each character whose resources are being used.`);
  let existing = actor.items.get(scope);
  // Once the clearing client confirms the removal, go on to create the lock: the server still admits only one.
  if (existing && isResourceLock(existing) && abandonedBackgroundLock(existing, actor, scope))
    if (await requestLockClear(actor, scope)) existing = null;
  // Most transactions finish in well under a second, so wait a little before telling anyone (above all a player
  // who only opened a sheet) that one is in progress.
  for (const delay of LOCK_RETRY_MS) {
    if (!existing || !isResourceLock(existing)) break;
    await new Promise(resolve => setTimeout(resolve, delay));
    existing = actor.items.get(scope);
  }
  if (existing) {
    if (isResourceLock(existing))
      throw new ResourceLockedError(
        loc`${actor.name}: a resource transaction is in progress. Retry after it finishes; the GC can recover an interrupted transaction.`
      );
    throw new Error(loc`${actor.name}: the reserved resource-document ID is already used by another item.`);
  }
  // When the world asks the GC's client to arbitrate, the lock lives in that client's memory and nothing is written
  // to the character (module/rules/gm-locks.mjs). An unreachable GC falls back to the document lock below.
  if (gmLockingActive()) {
    const gmToken = GM_TOKEN_PREFIX + foundry.utils.randomID();
    const answer = await requestLock("acquire", [lockKey(actor, scope)], gmToken);
    if (answer.ok) {
      held.set(lockKey(actor, scope), gmToken);
      return gmToken;
    }
    if (!answer.unreachable)
      throw new ResourceLockedError(
        loc`${actor.name}: a resource transaction is in progress. Retry after it finishes; the GC can recover an interrupted transaction.`
      );
  }
  const token = foundry.utils.randomID(),
    data = {
      _id: scope,
      name: "Spycraft resource transaction",
      type: "gear",
      system: { quantity: 0, weight: 0, carried: false },
      flags: {
        spycraft2: {
          resourceLock: {
            token,
            userId: game.user.id,
            started: Date.now(),
            ...(background ? { background: true } : {})
          }
        }
      }
    };
  let docs;
  // Two clients can both see no lock and both ask for it; the server admits one. The other waits for that
  // transaction to end and asks once more, so a GC with a second GM connected is not stopped half way.
  for (let attempt = 0; ; attempt++)
    try {
      docs = await actor.createEmbeddedDocuments("Item", [data], { keepId: true, render: false });
      break;
    } catch (error) {
      if (!/already exists/.test(String(error?.message ?? error))) throw error;
      if (attempt >= 1 || !(await lockCleared(actor, scope)))
        throw new ResourceLockedError(
          loc`${actor.name}: another client started a resource transaction. Retry after it finishes.`
        );
    }
  const lock = docs[0];
  if (docs.length !== 1 || lock.id !== scope || lock.flags.spycraft2.resourceLock.token !== token)
    throw new Error(loc`The server did not create the expected resource transaction lock.`);
  held.set(lockKey(actor, scope), token);
  return token;
}
async function release(actor, token, scope = RESOURCE_LOCK_ID) {
  if (String(token).startsWith(GM_TOKEN_PREFIX)) {
    try {
      await requestLock("release", [lockKey(actor, scope)], token);
    } finally {
      if (held.get(lockKey(actor, scope)) === token) held.delete(lockKey(actor, scope));
    }
    return;
  }
  try {
    const fresh = await readActor(actor),
      lock = fresh.items.get(scope);
    if (lock?.flags?.spycraft2?.resourceLock?.token === token) {
      if (scope === RESOURCE_LOCK_ID) actor.updateSource(fresh.toObject(), { recursive: false });
      else if (!actor.items.has(scope)) actor.updateSource({ items: fresh.toObject().items }, { recursive: false });
      await actor.deleteEmbeddedDocuments("Item", [scope], { render: false });
    }
  } finally {
    if (held.get(lockKey(actor, scope)) === token) held.delete(lockKey(actor, scope));
  }
}
export async function runNativeResourceTransaction(
  actors,
  work,
  { messages = [], allowPeriodReview = false, background = false } = {}
) {
  const locks = [];
  let result;
  try {
    for (const actor of [...actors].sort((a, b) => (a.uuid < b.uuid ? -1 : a.uuid > b.uuid ? 1 : 0))) {
      const root = actor.isToken && locks.find(lock => !lock.actor.isToken && lock.actor.id === actor.token?.actorId);
      if (root) {
        const fresh = await readActor(actor),
          inherited = fresh.items.get(RESOURCE_LOCK_ID);
        if (inherited?.flags?.spycraft2?.resourceLock?.token === root.token) {
          held.set(lockKey(actor, RESOURCE_LOCK_ID), root.token);
          locks.push({ actor, token: root.token, covered: true });
          continue;
        }
      }
      locks.push({ actor, token: await acquire(actor, RESOURCE_LOCK_ID, { background }) });
    }
    // Everything below is read fresh from the server while the locks are held, before any work. The reads do not
    // depend on one another, so they go out together: one wait in place of one per setting, actor and message.
    const periods = Promise.all([
      refreshWorldSetting("spycraft2", "usagePeriods"),
      refreshWorldSetting("spycraft2", "usagePeriodReview")
    ]).then(() => requireSettledPeriod(allowPeriodReview));
    const refreshed = [
      periods,
      ...actors.map(actor => refreshActor(actor)),
      ...[...new Set(messages)].map(async message => {
        const originalActor = message.flags?.spycraft2?.actorUuid,
          fresh = await readDocument(message);
        if (fresh.flags?.spycraft2?.actorUuid !== originalActor)
          throw new Error(loc`The roll’s acting character changed before this transaction.`);
        message.updateSource(fresh.toObject(), { recursive: false });
        if (message.blind && !game.user.isGM) throw new Error(loc`The GC resolves secret results.`);
      })
    ];
    // Wait for every read to end before reporting a failure, so no refresh is still landing after the locks go.
    const failed = (await Promise.allSettled(refreshed)).find(outcome => outcome.status === "rejected");
    if (failed) throw failed.reason;
    result = await work();
  } finally {
    const failures = [];
    for (const lock of locks.reverse())
      try {
        if (lock.covered) held.delete(lockKey(lock.actor, RESOURCE_LOCK_ID));
        else await release(lock.actor, lock.token);
      } catch (error) {
        failures.push(error);
      }
    // Cleanup failure must not pretend a committed resource action failed and invite a duplicate retry.
    if (failures.length)
      ui.notifications.warn(
        loc`Resource transaction finished, but its lock needs GC recovery. Check the recorded result before retrying.`
      );
  }
  return result;
}
export async function recoverResourceTransaction(actor, { confirmed = false, scope = RESOURCE_LOCK_ID } = {}) {
  if (!game.user.isGM) throw new Error(loc`Only the GC can recover an interrupted resource transaction.`);
  if (held.has(lockKey(actor, scope))) throw new Error(loc`This client is still executing that resource transaction.`);
  // A lock arbitrated by this GC's client is simply dropped; there is no document to remove.
  const arbitrated = lockTable.holder(lockKey(actor, scope));
  if (arbitrated) {
    const holder = game.users.get(arbitrated.userId);
    const agreed =
      confirmed ||
      (await systemDialog.confirm({
        window: { title: loc`Recover interrupted resource transaction` },
        rejectClose: false,
        content: `<p>${loc`Check the recorded result and current resources before retrying. Make sure ${foundry.utils.escapeHTML(holder?.name ?? loc`the original user`)} is no longer carrying out this action.`}</p>`
      }));
    if (!agreed) return null;
    lockTable.clear(lockKey(actor, scope));
    ui.notifications.info(loc`The interrupted resource transaction was cleared.`);
    return true;
  }
  const fresh = await readActor(actor),
    lock = fresh.items.get(scope);
  if (!isResourceLock(lock)) return decline(loc`There is no interrupted resource transaction to recover.`);
  if (!confirmed) {
    const user = game.users.get(lock.flags.spycraft2.resourceLock.userId),
      input = await systemDialog.input({
        window: { title: loc`Recover interrupted resource transaction` },
        rejectClose: false,
        content: `<p>${loc`Check the recorded result and current resources before retrying. Coordinate with ${foundry.utils.escapeHTML(user?.name ?? loc`the original user`)} to ensure their action has stopped.`}</p><label><input type="checkbox" name="confirmed" /> ${loc`No client is still executing this resource transaction`}</label>`
      });
    if (!input?.confirmed) return null;
  }
  // Re-read after the declaration so a replacement transaction is never cleared accidentally.
  const current = await readActor(actor);
  if (current.items.get(scope)?.flags?.spycraft2?.resourceLock?.token !== lock.flags.spycraft2.resourceLock.token)
    throw new Error(loc`The resource transaction changed; it was not cleared.`);
  if (scope === RESOURCE_LOCK_ID) actor.updateSource(current.toObject(), { recursive: false });
  else if (!actor.items.has(scope)) actor.updateSource({ items: current.toObject().items }, { recursive: false });
  return actor.deleteEmbeddedDocuments("Item", [scope], { render: false });
}
export const nativeResourceLocks = {
  native: true,
  run: runNativeResourceTransaction,
  recover: recoverResourceTransaction
};

export const nativeResourceTransactionsEnabled = () => globalThis.game?.spycraft2?.resourceLocks?.native === true;
/** Refresh only a known world setting through its authenticated document API. */
export async function refreshWorldSetting(namespace, key) {
  const doc = globalThis.game?.settings?.get?.(namespace, key, { document: true });
  if (!doc?.constructor?.database) return null;
  const matches = await doc.constructor.database.get(doc.constructor, { query: { key: `${namespace}.${key}` } });
  if (matches.length > 1) throw new Error(loc`Ambiguous world setting ${namespace}.${key}.`);
  if (!matches.length) return null;
  const fresh = matches[0];
  if (doc.id === fresh.id) doc.updateSource(fresh.toObject(), { recursive: false });
  else {
    const storage = game.settings.storage.get("world");
    if (doc.id) storage.delete(doc.id);
    storage.set(fresh.id, fresh);
  }
  return fresh.value;
}
/** Period changes wait for every tracked actor/token resource action to finish. */
export function periodResourceActors() {
  const actors = [...(globalThis.game?.actors ?? [])];
  for (const scene of globalThis.game?.scenes ?? [])
    for (const token of scene.tokens ?? []) {
      const actor = token.actor;
      // NPC tokens read the period from the world setting and are reset by periodRefreshActors, so need no lock.
      if (actor?.type === "agent" && actor.isToken) actors.push(actor);
    }
  return [...new Map(actors.map(actor => [actor.uuid, actor])).values()];
}

/**
 * Every actor whose derived numbers read the usage periods: world actors and every unlinked token's actor, NPCs
 * included. A period change refreshes them all, though only the agents above are locked for it.
 */
export function periodRefreshActors() {
  const actors = [...(globalThis.game?.actors ?? [])];
  for (const scene of globalThis.game?.scenes ?? [])
    for (const token of scene.tokens ?? []) if (token.actor?.isToken) actors.push(token.actor);
  return [...new Map(actors.map(actor => [actor.uuid, actor])).values()];
}

/** Shared settings use a distinct native mutex on the fixed bookkeeping parent, independent of its own dice. */
export function queueResourceScope(actor, scope, work) {
  const key = lockKey(actor, scope),
    previous = scopeQueues.get(key) ?? Promise.resolve();
  const pending = previous
    .then(async () => {
      const token = await acquire(actor, scope);
      try {
        return await work();
      } finally {
        try {
          await release(actor, token, scope);
        } catch (error) {
          ui.notifications.warn(
            loc`GC resource transaction finished, but its lock needs recovery. Check the result before retrying.`
          );
        }
      }
    })
    .catch(error => {
      if (error instanceof ResourceBusyError) {
        ui.notifications.warn(error.message);
        return null;
      }
      throw error;
    });
  scopeQueues.set(
    key,
    pending.catch(() => {})
  );
  return pending;
}

/** Refresh a rule-scope participant only while its native rule lock is held. */
export async function refreshResourceActor(actor) {
  if (!held.has(lockKey(actor, RULE_RESOURCE_LOCK_ID)))
    throw Error(loc`Acquire the rule-state lock before refreshing this actor.`);
  return refreshActor(actor);
}

/** Read an actual source card from the server under the participant’s independent rule mutex. */
export async function refreshRuleStateMessage(actor, message) {
  if (!held.has(lockKey(actor, RULE_RESOURCE_LOCK_ID)))
    throw Error(loc`Acquire the rule-state lock before refreshing its source message.`);
  const originalActor = message.flags?.spycraft2?.actorUuid,
    fresh = await readDocument(message);
  if (fresh.flags?.spycraft2?.actorUuid !== originalActor)
    throw Error(loc`The roll’s acting character changed before this rule-state transaction.`);
  message.updateSource(fresh.toObject(), { recursive: false });
  if (message.blind && !game.user.isGM) throw Error(loc`The GC resolves secret results.`);
  return message;
}
