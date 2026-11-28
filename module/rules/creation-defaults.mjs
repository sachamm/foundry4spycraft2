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
 * The prototype-token settings a new NPC takes unless the creator chose otherwise: hostile, its name and bars shown
 * to the GC, and for a special character a linked token with vitality and wounds bars. A standard NPC stays unlinked,
 * since each token is another one of its kind, and has no pool a bar could show. Null when nothing is added.
 * @param {object} given    the prototype token in the creation data
 * @param {string} npcType  "standard", "special", "villain" or "animal"
 */
export function npcTokenDefaults(given = {}, npcType = "standard") {
  const out = {},
    C = globalThis.CONST ?? {},
    special = npcType === "special" || npcType === "villain";
  if (given.disposition === undefined) out.disposition = C.TOKEN_DISPOSITIONS?.HOSTILE ?? -1;
  if (given.displayName === undefined) out.displayName = C.TOKEN_DISPLAY_MODES?.OWNER_HOVER ?? 20;
  if (special) {
    if (given.actorLink === undefined) out.actorLink = true;
    if (given.displayBars === undefined) out.displayBars = C.TOKEN_DISPLAY_MODES?.OWNER ?? 40;
    if (given.bar1?.attribute === undefined) out.bar1 = { attribute: "vitality" };
    if (given.bar2?.attribute === undefined) out.bar2 = { attribute: "wounds" };
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Character data imported from a file (the sheet's Import Data), with the prototype token linked when it is an agent's
 * or a companion's. An export from before linked tokens were the default would otherwise bring back an unlinked
 * prototype, and every token placed from it would keep its own copy of the character. Null when nothing changes.
 * @param {object} data   the parsed file
 * @param {string} [type] the type of the character being imported into, when the file does not say
 */
export function linkedImport(data, type) {
  if (!data || typeof data !== "object" || data.prototypeToken?.actorLink !== false) return null;
  const kind = data.type ?? type;
  if (kind !== "agent" && !(kind === "npc" && data.system?.companionOf?.ownerUuid)) return null;
  return { ...data, prototypeToken: { ...data.prototypeToken, actorLink: true } };
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

/**
 * A token's name after its actor is renamed. A token still called by the old name, or by the old name and a number
 * ("Guard 3"), follows the actor; one the GC named by hand is left alone (null).
 */
export function renamedTokenName(tokenName, oldName, newName) {
  if (!oldName || !newName || oldName === newName || typeof tokenName !== "string") return null;
  if (tokenName === oldName) return newName;
  // A copy number follows the name either way it is written: ours ("Guard 2") or Foundry's ("Guard (2)").
  if (tokenName.startsWith(`${oldName} `) && /^(\d+|\(\d+\))$/.test(tokenName.slice(oldName.length + 1)))
    return `${newName}${tokenName.slice(oldName.length)}`;
  return null;
}

/** The token's new name against any of the names the actor recently had, newest first. */
export function renamedFromAny(tokenName, oldNames = [], newName) {
  for (const old of oldNames) {
    const next = renamedTokenName(tokenName, old, newName);
    if (next) return next;
  }
  return null;
}
