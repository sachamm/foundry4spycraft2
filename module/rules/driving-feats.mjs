/**
 * Chase feats that change a vehicle's own numbers (pp.192–193).
 *
 * - Demolition Derby: a vehicle the character is operating gains +2 to Damage saves. (Its reduced collision damage
 *   needs a collision workflow, which the system does not have yet.)
 * - Duct Tape and Bubblegum: while the character pilots or rides in a vehicle, it gains a Damage save bonus of half
 *   their Mechanics ranks, rounded up. A vehicle takes only one such bonus: the best one aboard.
 * - Simulator Jockey: the driver ignores the Drone quality's penalties (applied in controlCheckPlan).
 */
import { loc } from "../i18n.mjs";

const feats = system => system?.activeFeatNames ?? [];

/** The Damage save bonus a vehicle's driver and occupants give it, with a note per source. */
export function crewDamageSaveBonus(driver, occupants = []) {
  let bonus = 0;
  const notes = [];
  if (feats(driver).includes("Demolition Derby")) {
    bonus += 2;
    notes.push(loc`Demolition Derby +2`);
  }
  const duct = [driver, ...occupants]
    .filter(s => feats(s).includes("Duct Tape and Bubblegum"))
    .map(s => Math.ceil((s.skillTotals?.mechanics?.ranks ?? s.skills?.mechanics?.ranks ?? 0) / 2))
    .reduce((best, n) => Math.max(best, n), 0);
  if (duct) {
    bonus += duct;
    notes.push(loc`Duct Tape and Bubblegum +${duct}`);
  }
  return { bonus, notes };
}

export const simulatorJockey = driver => feats(driver).includes("Simulator Jockey");
