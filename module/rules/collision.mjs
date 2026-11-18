/**
 * Collision damage (Table 5.6, p.335) and crashes (p.366).
 *
 * Damage dealt by an object or a character of a Size is dice per full 10 MPH of relative speed: objects use the
 * object column, characters the character column. It has armor-piercing equal to MPH / 10 (rounded down), and
 * Large or bigger sources add takedown. A character who loses vitality or wounds to it also takes a quarter as much
 * stress (rounded down). A crashing vehicle takes collision damage at its own Size; each occupant makes a Reflex
 * save, DC half that damage (rounded down), and on a failure takes half of it (rounded down).
 *
 * - Demolition Derby (p.192): a vehicle the character operates takes 1 less per die of collision damage (minimum 1).
 * - Bail Out! (p.191): a crash Reflex save that succeeds costs only 1 point per die; a failure costs 1 less per die
 *   (minimum 1 per die).
 * The Table 5.6 Size modifiers to armor-piercing are left to the GC: the table and its example disagree on whose
 * Size applies.
 */
import { loc } from "../i18n.mjs";

export const COLLISION = Object.freeze({
  D: { object: { die: "1", type: "subdual" }, character: null },
  T: { object: { die: "1d2", type: "subdual" }, character: { die: "1", type: "subdual" } },
  S: { object: { die: "1d4", type: "subdual" }, character: { die: "1d2", type: "subdual" } },
  M: { object: { die: "1d4", type: "lethal" }, character: { die: "1", type: "lethal" } },
  L: { object: { die: "1d6", type: "lethal" }, character: { die: "1d3", type: "lethal" }, takedown: true },
  H: { object: { die: "1d8", type: "lethal" }, character: { die: "1d4", type: "lethal" }, takedown: true },
  G: { object: { die: "1d12", type: "lethal" }, character: { die: "1d6", type: "lethal" }, takedown: true },
  C: { object: { die: "2d10", type: "lethal" }, character: { die: "1d10", type: "lethal" }, takedown: true },
  E: { object: { die: "2d12", type: "lethal" }, character: { die: "1d12", type: "lethal" }, takedown: true }
});

/** The collision damage a source of this Size deals at a relative speed. */
export function collisionDamagePlan(size, mph, { source = "object" } = {}) {
  const row = COLLISION[size]?.[source];
  const tens = Math.floor((Number(mph) || 0) / 10);
  if (!row || tens < 1) return { formula: "0", dice: 0, perDie: 0, type: "lethal", ap: 0, takedown: false };
  const [count, faces] = row.die.includes("d") ? row.die.split("d").map(Number) : [Number(row.die), 1];
  return {
    formula: row.die.includes("d") ? `${count * tens}d${faces}` : String(count * tens),
    dice: row.die.includes("d") ? count * tens : 0,
    flat: row.die.includes("d") ? 0 : count * tens,
    type: row.type,
    ap: tens,
    takedown: COLLISION[size]?.takedown === true
  };
}

/** Lower each rolled die by an amount, to a minimum of 1 per die. */
export const reducePerDie = (faces = [], amount = 1) => faces.reduce((n, f) => n + Math.max(1, f - amount), 0);

/** Demolition Derby: the operated vehicle's collision damage from these dice. */
export const demolitionDerbyDamage = (driverSystem, faces) =>
  driverSystem?.activeFeatNames?.includes("Demolition Derby")
    ? reducePerDie(faces, 1)
    : faces.reduce((n, f) => n + f, 0);

/**
 * An occupant's share of a crash: the Reflex DC, and the damage on a success or failure.
 * @param {number} vehicleDamage  the damage the vehicle took
 * @param {number} dice           the number of dice rolled for it
 */
export function crashOccupantPlan(occupantSystem, vehicleDamage, dice) {
  const half = Math.floor(vehicleDamage / 2),
    bail = occupantSystem?.activeFeatNames?.includes("Bail Out!") === true;
  return {
    dc: half,
    onSuccess: bail ? Math.min(half, dice) : 0,
    onFailure: bail ? Math.max(dice, half - dice) : half,
    bailOut: bail
  };
}

export const crashOccupantNote = (name, plan) =>
  plan.bailOut
    ? loc`${name}: Reflex DC ${plan.dc}; success ${plan.onSuccess} damage, failure ${plan.onFailure} (Bail Out!, p.191).`
    : loc`${name}: Reflex DC ${plan.dc}; failure ${plan.onFailure} damage.`;
