/**
 * Shots in a weapon and in reserve (pp.258, 359).
 *
 * A weapon's ammunition code gives the shots it holds and the loads that come with it. One load starts in the weapon;
 * the others are the reserve. `shotsLoaded` and `shotsSpare` on the weapon are empty until its first shot or reload,
 * and then hold the counts.
 */
import { ammunitionConfiguration } from "./ammunition.mjs";
import { loc } from "../i18n.mjs";

/** Bottomless Clip uses the printed stockpile, without changing its saved supply. */
export const unlimitedAmmunition = (weapon, effects = {}) =>
  !weapon?.ammunitionOnly && ammunitionConfiguration(weapon).selected?.shots >= 5 && effects.bottomlessClip === true;

const whole = value => Number.isSafeInteger(value) && value >= 0;
/** A Reload refills a magazine, belt or drum; an internal supply takes up to 3 shots a Reload (p.359). */
const SINGLE_FED_SHOTS = 3;

/**
 * @param {object} weapon  a weapon's system data
 * @returns {{tracked: false}|{tracked: true, capacity, loaded, spare, containerType, counted}}
 *          counted is false while the weapon still has its printed supply untouched
 */
export function ammunitionState(weapon = {}) {
  const code = weapon.ammunitionOnly ? null : ammunitionConfiguration(weapon).selected;
  if (!code || !whole(code.capacity) || code.capacity < 1) return { tracked: false };
  const capacity = code.capacity,
    counted = whole(weapon.shotsLoaded) || whole(weapon.shotsSpare);
  return {
    tracked: true,
    capacity,
    containerType: code.containerType,
    loaded: whole(weapon.shotsLoaded) ? Math.min(capacity, weapon.shotsLoaded) : code.loads > 0 ? capacity : 0,
    spare: whole(weapon.shotsSpare) ? weapon.shotsSpare : capacity * Math.max(0, code.loads - 1),
    counted
  };
}

/** The counts after firing. Throws when the weapon holds too few shots. */
export function spendShotsPlan(state, shots) {
  if (!state?.tracked) return null;
  if (!whole(shots) || shots < 1) throw new Error(loc`Enter the shots fired as a whole number, 1 or more.`);
  if (shots > state.loaded)
    throw new Error(loc`The weapon holds ${state.loaded} shot(s) and this takes ${shots}. Reload first.`);
  return { shotsLoaded: state.loaded - shots, shotsSpare: state.spare, shots };
}

/** The counts after one Reload action. Throws when there is nothing to load or no room for it. */
export function reloadPlan(state) {
  if (!state?.tracked) throw new Error(loc`This weapon has no ammunition code to count shots from.`);
  const room = state.capacity - state.loaded;
  if (room < 1) throw new Error(loc`The weapon is already full.`);
  if (state.spare < 1) throw new Error(loc`No ammunition is left in reserve for this weapon.`);
  const moved = Math.min(room, state.spare, state.containerType === "S" ? SINGLE_FED_SHOTS : room);
  return { shotsLoaded: state.loaded + moved, shotsSpare: state.spare - moved, moved };
}

/** Back to the printed supply: a full weapon and every other load in reserve. */
export function resupplyPlan(state) {
  if (!state?.tracked) throw new Error(loc`This weapon has no ammunition code to count shots from.`);
  return { shotsLoaded: null, shotsSpare: null };
}

/** The sheet's line for a weapon's ammunition. */
export function ammunitionLabel(state) {
  if (!state?.tracked) return "";
  return loc`${state.loaded}/${state.capacity} shots loaded, ${state.spare} in reserve`;
}
