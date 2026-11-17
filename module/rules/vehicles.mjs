/**
 * Object and vehicle damage rules (pp.224, 289–291). Pure functions: no Foundry access.
 * Numbers come from src/data/gear.json and src/data/vehicles.json through the generated tables.
 */
import {GEAR_RULES, VEHICLE_RULES} from './tables.mjs';

export const SIZE_CODES = Object.freeze(['N', 'F', 'D', 'T', 'S', 'M', 'L', 'H', 'G', 'C', 'E', 'V']);

const wholeNumber = (value, label) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a whole number of 0 or more.`);
  return value;
};

/** Size letter from a table label such as "L (2×3)"; empty when there is none. */
export function sizeCode(label) {
  const code = String(label ?? '').trim().charAt(0).toUpperCase();
  return SIZE_CODES.includes(code) && /^[A-Z](\b|$)/.test(String(label).trim().toUpperCase()) ? code : '';
}

/** DC of a Damage save against an amount of lethal damage (p.224). */
export function damageSaveDC(damage) {
  wholeNumber(damage, 'Damage');
  if (damage < 1) throw new Error('A Damage save is only made against 1 or more points of damage.');
  return GEAR_RULES.damageSaves.baseDC + Math.floor(damage / 2);
}

/**
 * How many Damage saves one hit makes the object fail (p.224).
 * Blast damage adds one per full step by which the save was missed; an activated critical hit doubles the total.
 */
export function failedDamageSaves({total, dc, blast = false, critical = false}) {
  if (!Number.isSafeInteger(total) || !Number.isSafeInteger(dc)) throw new Error('The save result and DC must be whole numbers.');
  if (total >= dc) return 0;
  const {blastStep, criticalMultiplier} = GEAR_RULES.damageSaves;
  const failed = 1 + (blast ? Math.floor((dc - total) / blastStep) : 0);
  return critical ? failed * criticalMultiplier : failed;
}

/** Action dice an attacker spends to activate a critical hit against an object of this Size (p.224). */
export function criticalDiceForSize(size) {
  return GEAR_RULES.damageSaves.criticalDice[sizeCode(size)] ?? 1;
}

/** Whether an object of this Size is intact, broken or destroyed after a number of failed saves (p.224). */
export function breakState(size, failedSaves) {
  wholeNumber(failedSaves, 'Failed saves');
  const {brokenAfter, destroyedMultiplier} = GEAR_RULES.damageSaves;
  const broken = brokenAfter[sizeCode(size)] ?? brokenAfter.M;
  const destroyed = broken * destroyedMultiplier;
  return {
    state: failedSaves >= destroyed ? 'destroyed' : failedSaves >= broken ? 'broken' : 'intact',
    brokenAt: broken,
    destroyedAt: destroyed
  };
}

/** The vehicle class record (skill, focus, untrained penalty, damage locations) for a class code such as "SGV". */
export function vehicleClass(code) {
  return VEHICLE_RULES.classes.find(c => c.code === code) ?? null;
}

/** Table 4.72 result for a class and a d20 roll: {code, label}. */
export function vehicleDamageLocation(classCode, roll) {
  const entry = vehicleClass(classCode);
  if (!entry) throw new Error('Choose the vehicle\'s category before rolling a Vehicle Damage result.');
  if (!Number.isSafeInteger(roll) || roll < 1 || roll > 20) throw new Error('A Vehicle Damage roll is a d20 result.');
  const code = entry.damageLocations[roll - 1];
  return {code, label: VEHICLE_RULES.damageLocations[code] ?? code};
}

/** Damage save bonus of a tyre hit by a Traction result, from the vehicle's Size (p.290). */
export function tractionSaveBonus(size) {
  return VEHICLE_RULES.tractionSaveBonus[sizeCode(size)] ?? 0;
}

/** Counters a vehicle accumulates from Vehicle Damage results. Every one is a whole number of 0 or more. */
export const VEHICLE_DAMAGE_COUNTERS = Object.freeze(['controls', 'engine', 'flotation', 'fuelHours', 'lift', 'traction']);

/**
 * A vehicle's current ratings after its recorded Vehicle Damage results (p.290–291).
 *  - Controls: Turning −1 each.
 *  - Engine: Acceleration −1 each, and each speed loses a quarter (rounded down) once per result.
 *  - Flotation: Acceleration and Turning −1 each.
 *  - Traction: Turning −2 each.
 *  - Lift: Maneuver error range +1 each.
 * A rating reduced to 0 by damage immobilizes the vehicle. Ratings the vehicle never had stay null.
 */
export function vehicleCondition(stats = {}, damage = {}) {
  const count = key => {
    const value = damage?.[key] ?? 0;
    return wholeNumber(value, `Vehicle damage "${key}"`);
  };
  const rating = value => Number.isSafeInteger(value) ? value : null;
  const baseAcceleration = rating(stats.acceleration), baseTurning = rating(stats.turning);
  const accelerationLoss = count('engine') + count('flotation');
  const turningLoss = count('controls') + count('flotation') + 2 * count('traction');
  const reduce = (base, loss) => base === null ? null : Math.max(0, base - loss);
  const acceleration = reduce(baseAcceleration, accelerationLoss), turning = reduce(baseTurning, turningLoss);
  const slow = speed => {
    if (!Number.isSafeInteger(speed)) return null;
    let current = speed;
    for (let i = 0; i < count('engine'); i++) current -= Math.floor(current * 0.25);
    return current;
  };
  const immobilized = baseAcceleration > 0 && acceleration === 0 && accelerationLoss > 0
    || baseTurning > 0 && turning === 0 && turningLoss > 0;
  return {
    acceleration, turning,
    cruiseMph: slow(stats.cruiseMph), topMph: slow(stats.topMph),
    maneuverErrorIncrease: count('lift'),
    fuelHoursLost: count('fuelHours'),
    immobilized
  };
}

/**
 * Defense of a vehicle against one attacker (p.289): its base Defense, the driver's Dexterity modifier while it
 * is moving, and the amount by which each of its ratings exceeds the attacker's own vehicle's rating.
 */
export function vehicleDefense({defense, moving = false, driverDexMod = 0, acceleration = null, turning = null, attacker = null}) {
  if (!Number.isSafeInteger(defense)) return null;
  const rows = [{label: 'Base Defense', value: defense}];
  if (moving && Number.isSafeInteger(driverDexMod) && driverDexMod !== 0) rows.push({label: 'Driver Dexterity', value: driverDexMod});
  if (attacker) {
    for (const [key, label, own] of [['acceleration', 'Acceleration lead', acceleration], ['turning', 'Turning lead', turning]]) {
      const other = attacker[key];
      if (Number.isSafeInteger(own) && Number.isSafeInteger(other) && own > other) rows.push({label, value: own - other});
    }
  }
  return {total: rows.reduce((sum, row) => sum + row.value, 0), rows};
}

/** Crew and passenger numbers from an Occupancy label such as "1+3". */
export function occupancy(label) {
  const match = /^([\d,]+)(?:\+([\d,]+))?$/.exec(String(label ?? '').trim());
  if (!match) return {crew: null, passengers: null};
  const number = text => Number(String(text).replaceAll(',', ''));
  return {crew: number(match[1]), passengers: match[2] ? number(match[2]) : 0};
}
