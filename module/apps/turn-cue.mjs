/**
 * Tell a player when the combat reaches a character they control, so nobody has to watch the tracker.
 * A client setting turns it off.
 */
import { loc } from "../i18n.mjs";

/** Whether this user should hear that the acting combatant is theirs. */
export function isMyTurn(combat, user = game.user) {
  const combatant = combat?.combatant;
  if (!combat?.started || !combatant || user?.isGM) return false;
  const actor = combatant.actor;
  return !!actor && actor.testUserPermission?.(user, "OWNER") === true && !combatant.defeated;
}

export function announceTurn(combat, changed) {
  if (!("turn" in (changed ?? {})) && !("round" in (changed ?? {}))) return false;
  let enabled = true;
  try {
    enabled = game.settings.get("spycraft2", "turnNotice") !== false;
  } catch {
    /* not registered */
  }
  if (!enabled || !isMyTurn(combat)) return false;
  ui.notifications.info(loc`Your turn: ${combat.combatant.name}.`);
  combat.combatant.actor?.sheet?.element?.querySelector?.(".round-tracker")?.classList.add("sc2-your-turn");
  return true;
}

export function installTurnCue() {
  game.settings.register("spycraft2", "turnNotice", {
    name: loc`Tell me when it is my turn`,
    hint: loc`Shows a notice when the combat reaches a character you control.`,
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
  Hooks.on("updateCombat", announceTurn);
}
