/**
 * The changes an unlinked token keeps of its own (Foundry's ActorDelta), read as plain data so the link review
 * (module/apps/token-links.mjs) and the world migration can decide what linking the token would lose.
 */
import { isResourceLock } from "./resource-locks.mjs";

/**
 * Whether an actor is one particular person whose token must be linked to it: an agent, or a companion that belongs
 * to an agent (an animal partner or a lieutenant). Generic NPCs keep unlinked tokens, so each copy has its own health.
 * @param {object} actor  an actor or its source data
 */
export const isPersonalCharacter = actor =>
  actor?.type === "agent" || (actor?.type === "npc" && !!actor.system?.companionOf?.ownerUuid);

const isPlainObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const hasEntries = value => isPlainObject(value) && Object.keys(value).length > 0;

/** The stored changes of an unlinked token (its ActorDelta source), or null. */
export function deltaSource(token) {
  const delta = token?._source?.delta ?? token?.delta;
  if (!delta) return null;
  return typeof delta.toObject === "function" ? delta.toObject() : delta;
}

/** Whether an embedded entry in a delta marks a deletion rather than a changed or added document. */
const isTombstone = entry => entry?._tombstone === true;

/** Plan one embedded collection: which documents the base character must delete, update and create. */
function embeddedPlan(entries, baseEntries, { skip = () => false } = {}) {
  const plan = { create: [], update: [], delete: [] };
  const base = new Set((baseEntries ?? []).map(entry => entry?._id).filter(Boolean));
  for (const entry of entries ?? []) {
    if (!entry?._id || skip(entry)) continue;
    if (isTombstone(entry)) {
      if (base.has(entry._id)) plan.delete.push(entry._id);
      continue;
    }
    const copy = structuredClone(entry);
    delete copy._tombstone;
    (base.has(entry._id) ? plan.update : plan.create).push(copy);
  }
  return plan;
}

/**
 * Everything the base character needs so that it matches what an unlinked token shows: the token's own sheet values,
 * name and picture, its added, changed and removed items and effects, and any player who owns the token but not the
 * character. Ownership is only ever raised. Resource locks are left out: they belong to an action in progress.
 * @param {object|null} delta       the token's ActorDelta source
 * @param {object} [baseSource]     the character's source data
 * @returns {{actor: object|null, items: object, effects: object, count: number}}
 */
export function deltaChanges(delta, baseSource = {}) {
  const actor = {};
  if (hasEntries(delta?.system)) actor.system = structuredClone(delta.system);
  for (const key of ["name", "img"])
    if (typeof delta?.[key] === "string" && delta[key] && delta[key] !== baseSource?.[key]) actor[key] = delta[key];
  if (hasEntries(delta?.flags)) actor.flags = structuredClone(delta.flags);
  if (isPlainObject(delta?.ownership)) {
    const raised = {};
    for (const [user, level] of Object.entries(delta.ownership)) {
      if (!Number.isFinite(level)) continue;
      const current = baseSource?.ownership?.[user] ?? (user === "default" ? 0 : null);
      if (current === null || level > current) raised[user] = level;
    }
    if (Object.keys(raised).length) actor.ownership = raised;
  }
  const items = embeddedPlan(delta?.items, baseSource?.items, { skip: isResourceLock }),
    effects = embeddedPlan(delta?.effects, baseSource?.effects);
  const embedded = plan => plan.create.length + plan.update.length + plan.delete.length;
  const count = Object.keys(actor).length + embedded(items) + embedded(effects);
  return { actor: Object.keys(actor).length ? actor : null, items, effects, count };
}

/** Whether a token's delta holds no changes from its character, so linking it loses nothing. */
export function deltaIsEmpty(delta, baseSource) {
  return deltaChanges(delta, baseSource).count === 0;
}
