/**
 * Round reminders: what a combat tracker step should prompt for.
 *
 * A dying character rolls to stabilize at the end of each round (p.331) and a burning character takes the fire's
 * damage when its turn begins (p.337). A tactician's Stratagem moves the tactician and teammates up the order at
 * the start of each round. Both rolls already exist as buttons on the sheet; this works out which
 * characters need them when the tracker moves, so the GC's client can post a card with the button.
 * Pure rules; module/apps/round-reminders.mjs posts the cards.
 */
import { woundState } from "./damage-application.mjs";

/**
 * @param {object} step
 * @param {object[]} step.combatants  [{ actorUuid, name, special, wounds, burning, stratagem, defeated }]
 * @param {boolean} step.roundEnded   the tracker moved forward out of a round that was played
 * @param {boolean} step.roundStarted a round has just begun, the first one included (defaults to roundEnded)
 * @param {string|null} step.turnActorUuid  the actor whose turn has just begun, if the turn moved forward
 * @returns {{kind: "dying"|"burning"|"stratagem", actorUuid: string, name: string}[]} one entry per character and kind
 */
export function roundReminders({
  combatants = [],
  roundEnded = false,
  roundStarted = roundEnded,
  turnActorUuid = null
} = {}) {
  const out = [],
    seen = new Set();
  const add = (kind, combatant) => {
    const key = `${kind}:${combatant.actorUuid}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, actorUuid: combatant.actorUuid, name: combatant.name });
  };
  for (const combatant of combatants) {
    if (!combatant?.actorUuid || combatant.defeated) continue;
    if (roundEnded && combatant.special && woundState(Number(combatant.wounds), combatant.deathThreshold) === "dying")
      add("dying", combatant);
    if (roundStarted && combatant.stratagem > 0) add("stratagem", combatant);
    if (turnActorUuid && combatant.actorUuid === turnActorUuid && combatant.burning) add("burning", combatant);
  }
  return out;
}

/**
 * Reminders that go to the same people share one card, a line each: a round ending with three dying NPCs posts one
 * card to the GC, not three. `ownersOf(reminder)` lists the user ids that may see it; the order of the reminders is
 * kept within each card.
 */
export function groupReminders(reminders = [], ownersOf = () => []) {
  const groups = new Map();
  for (const reminder of reminders) {
    const owners = [...new Set(ownersOf(reminder) ?? [])].sort();
    const key = owners.join(",");
    if (!groups.has(key)) groups.set(key, { owners, reminders: [] });
    groups.get(key).reminders.push(reminder);
  }
  return [...groups.values()];
}
