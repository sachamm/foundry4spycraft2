/**
 * The prototype-token settings a new agent takes unless the creator chose otherwise: sight on, linked to the actor,
 * friendly. Null when every one of them was given.
 * @param {object} given  the prototype token in the creation data
 */
export function agentTokenDefaults(given = {}) {
  const out = {};
  if (given.sight?.enabled === undefined) out.sight = { enabled: true };
  if (given.actorLink === undefined) out.actorLink = true;
  if (given.disposition === undefined) out.disposition = globalThis.CONST?.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1;
  return Object.keys(out).length ? out : null;
}

/**
 * Whether a weapon added to an agent should arrive equipped: the agent has no equipped weapon yet, so a newly built
 * character's first weapon is ready to use. Compendium copies carry `equipped: false` as a stored default, so only
 * the agent's own items decide.
 * @param {object} data            the weapon's creation data
 * @param {Iterable<object>} items the agent's current items
 */
export function equipsAsFirstWeapon(data = {}, items = []) {
  if (data.type !== "weapon" || data.system?.equipped === true) return false;
  for (const item of items) if (item.type === "weapon" && item.system?.equipped) return false;
  return true;
}
