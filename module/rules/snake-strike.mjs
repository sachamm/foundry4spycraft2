/**
 * Snake Strike, p.183: once per opponent per combat, as a free action, the character draws a weapon not yet used this
 * combat and takes a Feint action. If the Feint succeeds, their next successful attack against that opponent with the
 * drawn weapon this round adds 1 sneak attack die.
 *
 * `system.snakeStrikes` records each declaration (after the GC confirms the Feint succeeded). The damage roll of the
 * next hit may add the die; a damage roll carrying the declaration's id uses it.
 */
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

const rows = system => (Array.isArray(system?.snakeStrikes) ? system.snakeStrikes : []);

/** Whether the weapon already made an attack in this combat. */
export const weaponUsedThisCombat = (weaponUuid, combatId, posted = []) =>
  posted.some(c => c?.checkKind === "attack" && c.weaponUuid === weaponUuid && c.rollCombat?.id === combatId);

export function snakeStrikePlan(
  system,
  combat,
  { targetUuid = "", weaponId = "", weaponUuid = "", feintWonConfirmed = false, posted = [] } = {}
) {
  if (!system?.activeFeatNames?.includes("Snake Strike")) throw new Error(loc`Snake Strike has not been earned.`);
  if (!combat?.started || typeof combat.id !== "string") throw new Error(loc`Use Snake Strike in a started combat.`);
  if (!targetUuid || !weaponId) throw new Error(loc`Choose the opponent and the weapon you draw.`);
  if (rows(system).some(r => r.combatId === combat.id && r.targetUuid === targetUuid))
    throw new Error(loc`Snake Strike was already used against this opponent this combat.`);
  if (weaponUsedThisCombat(weaponUuid, combat.id, posted))
    throw new Error(loc`Snake Strike draws a weapon you have not used yet this combat.`);
  if (feintWonConfirmed !== true) throw new Error(loc`The GC must confirm the Feint succeeded.`);
  return { version: 1, combatId: combat.id, round: combat.round, targetUuid, weaponId };
}

/** The declaration that may add its die to this damage roll, or null. `posted` are message flags. */
export function snakeStrikeOpen(system, { combatId, round, weaponId, targetUuid, posted = [] } = {}) {
  const used = new Set(posted.filter(c => c?.checkKind === "damage" && c.snakeStrike).map(c => c.snakeStrike));
  return (
    rows(system).find(
      r =>
        r.combatId === combatId &&
        r.round === round &&
        r.weaponId === weaponId &&
        r.targetUuid === targetUuid &&
        !used.has(r.id)
    ) ?? null
  );
}

rollPipeline.register({ id: "snakeStrikeRecord", order: 9641, record: ["snakeStrike"] });

rollPipeline.register({
  id: "snakeStrikeContent:damage",
  dialogs: ["damage"],
  order: 35,
  dialog: ({ actor }) => [
    {
      at: 49,
      html: actor?.system?.activeFeatNames?.includes("Snake Strike")
        ? `<label><input type="checkbox" name="snakeStrike" /> ${loc`Snake Strike: add 1 sneak attack die (the drawn weapon’s next hit this round on the Feinted opponent)`}</label>`
        : ""
    }
  ],
  read: (context, input) => (input?.snakeStrike === true ? { snakeStrike: true } : null)
});
