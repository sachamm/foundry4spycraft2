/**
 * Combat references for the GC (pp.323–349): base encounter distance (Table 5.1), special surface speeds
 * (Table 5.3), deviation (Table 5.11) and how a gas cloud spreads and clears. Numbers only; labels are ours.
 * This module is pure.
 */
import { loc } from "../../i18n.mjs";

/** Table 5.1: dice × feet per point; indoors is line of sight. */
export const ENCOUNTER_DISTANCES = {
  indoors: { dice: null, feet: 0 },
  open: { dice: "6d6", feet: 20 },
  temperate: { dice: "4d6", feet: 10 },
  dense: { dice: "2d6", feet: 10 },
  rough: { dice: "6d6", feet: 5 }
};
export const ENCOUNTER_LABELS = {
  get indoors() {
    return loc`Indoors (line of sight)`;
  },
  get open() {
    return loc`Aquatic, plains or desert (6d6 × 20 ft.)`;
  },
  get temperate() {
    return loc`Arctic, forest or outdoor urban (4d6 × 10 ft.)`;
  },
  get dense() {
    return loc`Jungle or swamp (2d6 × 10 ft.)`;
  },
  get rough() {
    return loc`Mountains or underwater (6d6 × 5 ft.)`;
  }
};

/**
 * The encounter distance from a rolled total, cut to the farthest anyone present can see or hear.
 * @param {string} location  a key of ENCOUNTER_DISTANCES
 * @param {number|null} rolled  the dice total (ignored indoors)
 * @param {number|null} senseLimit  the longest visual or hearing range among everyone present, in feet
 */
export function encounterDistance(location, rolled, senseLimit = null) {
  const entry = ENCOUNTER_DISTANCES[location];
  if (!entry) throw new Error(loc`Choose the location.`);
  if (!entry.dice) return { lineOfSight: true, feet: null, limited: false };
  const feet = Math.max(0, Math.trunc(Number(rolled) || 0)) * entry.feet,
    limit = Number.isFinite(senseLimit) && senseLimit > 0 ? senseLimit : null;
  return {
    lineOfSight: false,
    feet: limit !== null ? Math.min(feet, limit) : feet,
    rolledFeet: feet,
    limited: limit !== null && feet > limit
  };
}

/** The farthest a character can see or hear: ten increments of each (p.350). */
export function senseLimit(system) {
  const visual = Number(system?.senses?.visualIncrement) || 0,
    hearing = Number(system?.senses?.hearingIncrement) || 0;
  return Math.max(visual, hearing) * 10;
}

/* -------------------------------------------- */
/*  Table 5.3                                    */
/* -------------------------------------------- */

/** Speed spent per 5 ft. crossed (null: impassable without a check) and what crossing asks for. */
export const SURFACES = {
  wire: { cost: 15, page: 325 },
  cluttered: { cost: 10, page: 325 },
  ice: { cost: 5, page: 325 },
  ladder: { cost: 5, diagonal: true, page: 325 },
  mudKnee: { cost: 15, page: 325 },
  mudWaist: { cost: 30, page: 325 },
  snowShallow: { cost: 5, page: 325 },
  snowDeep: { cost: 10, page: 325 },
  stairs: { cost: 5, diagonal: true, page: 325 },
  stepLow: { cost: 5, page: 325 },
  stepMid: { cost: 10, page: 325 },
  stepHigh: { cost: null, page: 325 },
  waterKnee: { cost: 5, page: 325 },
  waterWaist: { cost: 10, page: 325 },
  windowSmall: { cost: 10, page: 325 },
  windowLarge: { cost: 5, page: 325 }
};
export const SURFACE_LABELS = {
  get wire() {
    return loc`Barbed, concertina or razor wire — Reflex DC 15 or 1d6 lethal`;
  },
  get cluttered() {
    return loc`Cluttered floor`;
  },
  get ice() {
    return loc`Ice — Acrobatics/Balance check`;
  },
  get ladder() {
    return loc`Ladder, per 5 ft. climbed — counts as a diagonal`;
  },
  get mudKnee() {
    return loc`Mud to the knee`;
  },
  get mudWaist() {
    return loc`Mud to the waist`;
  },
  get snowShallow() {
    return loc`Snow up to 2 ft.`;
  },
  get snowDeep() {
    return loc`Snow over 2 ft.`;
  },
  get stairs() {
    return loc`Stairs going up — counts as a diagonal`;
  },
  get stepLow() {
    return loc`Step up to 3 ft.`;
  },
  get stepMid() {
    return loc`Step of 3–5 ft.`;
  },
  get stepHigh() {
    return loc`Step over 5 ft. — Athletics/Climb check`;
  },
  get waterKnee() {
    return loc`Water to the knee — Acrobatics/Balance check`;
  },
  get waterWaist() {
    return loc`Water to the waist`;
  },
  get windowSmall() {
    return loc`Window up to 3 × 3 ft. — Acrobatics/Tumble DC 15 makes it 5 ft.; a closed one does 1d2 lethal unless Tumble DC 15`;
  },
  get windowLarge() {
    return loc`Larger window — a closed one does 1d2 lethal unless Tumble DC 15`;
  }
};

/**
 * How far a move gets across a surface.
 * @returns {{squares: number|null, feet: number|null, bonusStep: boolean}}
 */
export function surfaceMove(surface, speed) {
  const entry = SURFACES[surface];
  if (!entry) throw new Error(loc`Choose a listed surface.`);
  const budget = Math.max(0, Math.trunc(Number(speed) || 0));
  if (entry.cost === null) return { squares: null, feet: null, bonusStep: false };
  const squares = Math.floor(budget / entry.cost);
  // The bonus 5-ft. step cannot cross ground that doubles or triples the Speed it takes.
  return { squares, feet: squares * 5, bonusStep: entry.cost <= 5 };
}

/* -------------------------------------------- */
/*  Deviation                                    */
/* -------------------------------------------- */

/** Table 5.11: the die for the squares a miss strays, by range increment to the target. */
export function deviationDie(increment) {
  const step = Math.max(1, Math.min(10, Math.trunc(Number(increment) || 1)));
  return `1d${[2, 4, 6, 8, 10][Math.ceil(step / 2) - 1]}`;
}

/** A ricochet off something with a Damage save of +10 or better halves the squares left (rounded down). */
export const ricochetSquares = squares => Math.floor(Math.max(0, Number(squares) || 0) / 2);

/* -------------------------------------------- */
/*  Gas                                          */
/* -------------------------------------------- */

/** The round after release at which a cloud reaches each blast increment (1st on release). */
export const GAS_GROWTH = [0, 1, 3, 6, 10];
/** Wind: the largest increment reached and how much faster it clears. */
export const GAS_WIND = {
  none: { most: 5, clears: 1 },
  light: { most: 4, clears: 2 },
  moderate: { most: 3, clears: 3 },
  strong: { most: 1, clears: Infinity }
};

/**
 * The increments a gas cloud covers a number of rounds after release, before it starts to clear.
 * @param {number} rounds  whole rounds since the release Count
 * @param {string} wind    none, light, moderate or strong
 */
export function gasIncrements(rounds, wind = "none") {
  const w = GAS_WIND[wind];
  if (!w) throw new Error(loc`Choose the wind.`);
  const r = Math.max(0, Math.trunc(Number(rounds) || 0));
  return Math.min(w.most, GAS_GROWTH.filter(at => r >= at).length);
}

/**
 * When the cloud clears: it lingers 2d4 minutes after it stops growing, then loses an increment a minute. Wind makes
 * the clearing (not the lingering) faster; a strong wind clears it at once.
 * @param {number} lingerRoll  the 2d4 rolled
 */
export function gasClearing(lingerRoll, wind = "none") {
  const w = GAS_WIND[wind];
  if (!w) throw new Error(loc`Choose the wind.`);
  if (w.clears === Infinity) return { lingerMinutes: 0, minutesPerIncrement: 0, immediate: true };
  return {
    lingerMinutes: Math.max(0, Math.trunc(Number(lingerRoll) || 0)),
    minutesPerIncrement: 1 / w.clears,
    immediate: false
  };
}
