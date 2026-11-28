/**
 * The visibility option for Roll#toMessage.
 *
 * Foundry 14 renamed the option from `rollMode` ("publicroll", "gmroll", "blindroll", "selfroll") to `messageMode`
 * ("public", "gm", "blind", "self") and warns about the old name. This returns the new option when the running
 * Foundry lists the mode, and the old one otherwise, so a roll keeps its visibility on either.
 */
const RENAMED = { publicroll: "public", gmroll: "gm", blindroll: "blind", selfroll: "self" };

export function messageModeOption(rollMode, config = globalThis.CONFIG) {
  if (!rollMode) return {};
  const mode = RENAMED[rollMode] ?? rollMode,
    modes = config?.ChatMessage?.modes;
  return modes && typeof modes === "object" && Object.hasOwn(modes, mode) ? { messageMode: mode } : { rollMode };
}

/**
 * The visibility of an NPC's roll: one the GC marked "GC only" keeps its attacks, damage and saves to the GC, unless the
 * roll chose its own visibility. Players' rolls and every other check are left as they are.
 */
export function npcRollMode(actor, checkKind, rollMode, user = globalThis.game?.user) {
  if (rollMode !== undefined && rollMode !== null && rollMode !== "") return rollMode;
  return actor?.type === "npc" &&
    user?.isGM &&
    actor.flags?.spycraft2?.gcOnlyRolls === true &&
    ["attack", "damage", "save"].includes(checkKind)
    ? "gmroll"
    : rollMode;
}
