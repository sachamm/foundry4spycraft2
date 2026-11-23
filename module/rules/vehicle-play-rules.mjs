/**
 * Vehicle play rules beyond damage (pp.289–297): qualities, fuel, crew and occupants, control checks and upgrades.
 * Pure functions: no Foundry access. Damage rules live in ./vehicles.mjs.
 */
import { simulatorJockey } from "./driving-feats.mjs";
import { VEHICLE_RULES } from "./tables.mjs";
import { SIZE_CODES, sizeCode, vehicleClass } from "./vehicles.mjs";
import { loc } from "../i18n.mjs";

/* ---------------------------------------------------------------------- */
/*  Qualities                                                              */
/* ---------------------------------------------------------------------- */

/** Split a qualities label such as "OPN (1/4 cover), ORD, HAR (1)" into [{code, param, label}]. */
export function parseQualities(label) {
  return String(label ?? "")
    .split(/,\s*(?![^()]*\))/)
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const match = /^([A-Z]{3})\b\s*(?:\((.*)\))?/.exec(part);
      return match
        ? { code: match[1], param: match[2]?.trim() ?? "", label: part }
        : { code: "", param: "", label: part };
    });
}

/** Reference entries for a qualities label: code, parameter, name and our short summary. */
export function qualityReference(label) {
  return parseQualities(label).map(q => {
    const [name, summary] = VEHICLE_RULES.qualities?.[q.code] ?? [q.label, ""];
    return { ...q, name, summary };
  });
}

/** Whether a qualities label includes a code, and its numeric parameter when it has one. */
export function hasQuality(label, code) {
  return parseQualities(label).some(q => q.code === code);
}
export function qualityNumber(label, code) {
  const q = parseQualities(label).find(entry => entry.code === code);
  if (!q) return null;
  const n = Number(String(q.param).replace(/[–−]/g, "-").match(/-?\d+/)?.[0]);
  return Number.isFinite(n) ? n : 0;
}

/** Rugged (RGD): +2 to Damage saves at Medium or smaller, and +2 more per Size category above Medium (p.294). */
export function ruggedBonus(size) {
  const index = SIZE_CODES.indexOf(sizeCode(size)),
    medium = SIZE_CODES.indexOf("M");
  return 2 + 2 * Math.max(0, index - medium);
}

/** Extra action dice to activate a critical hit against a vehicle with Heavy Armor (HAR). */
export const heavyArmorDice = qualities => Math.max(0, qualityNumber(qualities, "HAR") ?? 0);

/* ---------------------------------------------------------------------- */
/*  Secondary damage from Vehicle Damage results (p.290)                   */
/* ---------------------------------------------------------------------- */

/**
 * Damage passed on to cargo, an occupant, a weapon or other gear, or a draft animal: the attack's damage minus the
 * vehicle's Damage save bonus. Armor-piercing lowers that bonus first. Animals can take 0; the others take at least 1.
 */
export function secondaryDamage({ damage, saveBonus = 0, armorPiercing = 0, minimum = 1 }) {
  if (!Number.isSafeInteger(damage) || damage < 0) throw new Error(loc`Damage must be a whole number.`);
  const bonus = Math.max(0, (Number(saveBonus) || 0) - Math.max(0, Number(armorPiercing) || 0));
  return Math.max(minimum, damage - bonus);
}

/* ---------------------------------------------------------------------- */
/*  Fuel (pp.225, 365)                                                     */
/* ---------------------------------------------------------------------- */

export const FUEL_TYPES = Object.freeze({
  A: "Alcohol",
  B: "Battery",
  D: "Diesel",
  E: "Diesel electric",
  F: "Fuel oil",
  G: "Gas",
  J: "Jet fuel",
  N: "Nuclear",
  P: "Propane",
  U: "Unique fuel",
  V: "Aviation gas"
});
const UNIT_HOURS = {
  "": 1,
  hr: 1,
  hrs: 1,
  hour: 1,
  hours: 1,
  day: 24,
  days: 24,
  wk: 168,
  wks: 168,
  week: 168,
  weeks: 168,
  year: 8760,
  years: 8760,
  r: 1 / 600
};

/** {hours, fuel, fuelName} from a Range/Fuel label such as "7/G", "60 days/F" or "2r/A"; null when it has no fuel range. */
export function parseRangeFuel(label) {
  const text = String(label ?? "").trim();
  const match = /^([\d.,]+)\s*([a-z]*)\.?\s*\/+\s*([A-Z])$/i.exec(text);
  if (!match) return null;
  const unit = UNIT_HOURS[match[2].toLowerCase()];
  if (unit === undefined) return null;
  const fuel = match[3].toUpperCase();
  return { hours: Number(match[1].replaceAll(",", "")) * unit, fuel, fuelName: FUEL_TYPES[fuel] ?? fuel };
}

/** Remaining fuel after hours used and hours lost to Fuel damage results, never below 0. */
export function fuelState(rangeFuel, { used = 0, lost = 0, extraHours = 0 } = {}) {
  const range = parseRangeFuel(rangeFuel);
  if (!range) return null;
  const capacity = Math.max(1, range.hours + extraHours);
  const remaining = Math.max(0, capacity - Math.max(0, used) - Math.max(0, lost));
  return { ...range, capacity, used, lost, remaining, empty: remaining <= 0 };
}

/** Fuel hours spent travelling: double above cruising speed (p.225). */
export const travelFuel = (hours, { aboveCruising = false } = {}) =>
  Math.max(0, Number(hours) || 0) * (aboveCruising ? 2 : 1);

/* ---------------------------------------------------------------------- */
/*  Crew, occupants, entering and leaving (p.289)                          */
/* ---------------------------------------------------------------------- */

const PERSONAL = new Set(["PGV", "PSA", "PSW"]);

/** Skeleton crew of Tier I crew members that comes with a vehicle: Possession = crew − 1; mission gear = crew − team. */
export function skeletonCrew(crew, { source = "possession", teamSize = 1 } = {}) {
  if (!Number.isSafeInteger(crew) || crew <= 0) return 0;
  return Math.max(0, source === "mission" ? crew - Math.max(0, teamSize) : crew - 1);
}

/** Feet of movement to enter or leave: 5 for personal vehicles, 60 with Capital Scale, 10 otherwise. */
export function entryMovement(system) {
  if (hasQuality(system?.qualities, "CAP")) return 60;
  return PERSONAL.has(system?.vehicleClass) ? 5 : 10;
}

/** Reflex save to bail out (DC 15); crew in Ejection Seats add +6. */
export function bailOut(system, { role = "passenger" } = {}) {
  const ejection = hasQuality(system?.qualities, "EJS") && role !== "passenger";
  return { dc: VEHICLE_RULES.bailOutDC ?? 15, bonus: ejection ? 6 : 0, ejection };
}

/* ---------------------------------------------------------------------- */
/*  Control checks (Table 4.71, p.289)                                     */
/* ---------------------------------------------------------------------- */

const SKILL_KEYS = { Acrobatics: "acrobatics", Drive: "drive", Survival: "survival", Tactics: "tactics" };
const norm = text =>
  String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();

/**
 * How a driver makes a Maneuver check with a vehicle: the skill, the Drive focus that counts as training, the
 * category's untrained penalty adjusted by Forgiving and Unforgiving, Trained Only, and error increases from
 * Lift damage and the Drone quality. `hazards` is a vehicleHazards() result for the current terrain and weather.
 */
/** Maneuver DC changes for a stunt and for speed (p.125 table), as [DC, error]. */
export const MANEUVER_STUNTS = Object.freeze({
  minor: [5, 0],
  moderate: [10, 1],
  major: [15, 2],
  deathDefying: [20, 3]
});
/**
 * The declared stunt and speed of a Maneuver: the DC change for the GC and the error increase for the roll.
 * Get Radical! (p.192): a stunt's DC is 5 lower and the error range 1 lower (never below the check's own).
 * Need for Speed (p.192): no penalty for moving faster than half the top MPH.
 */
export function maneuverDifficulty(driver, { stunt = "", fast = false } = {}) {
  const feats = driver?.activeFeatNames ?? [],
    notes = [];
  let dc = 0,
    error = 0;
  if (stunt) {
    const row = MANEUVER_STUNTS[stunt];
    if (!row) throw new Error(loc`Choose a listed stunt.`);
    dc += row[0];
    error += row[1];
    if (feats.includes("Get Radical!")) {
      dc -= 5;
      error = Math.max(0, error - 1);
      notes.push(loc`Get Radical!: the stunt’s DC is 5 lower and its error range 1 lower.`);
    }
  }
  if (fast) {
    if (feats.includes("Need for Speed")) notes.push(loc`Need for Speed: no penalty for the speed.`);
    else dc += 5;
  }
  if (dc) notes.unshift(loc`Maneuver DC ${dc > 0 ? "+" : ""}${dc} for the declared stunt and speed.`);
  return { dc, errorIncrease: error, notes };
}

export function controlCheckPlan(vehicle, driver, { hazards = null } = {}) {
  const cls = vehicleClass(vehicle?.vehicleClass);
  if (!cls) return { blocked: loc`Choose the vehicle's category first.` };
  if (hazards?.blocked) return { blocked: hazards.blocked };
  const qualities = vehicle?.qualitiesNow ?? vehicle?.qualities ?? "",
    notes = [];
  const crewed = hasQuality(qualities, "CRW") || hasQuality(qualities, "CAP");
  const skillName = crewed ? "Tactics" : cls.skill;
  const skillKey = SKILL_KEYS[skillName];
  const focus = crewed ? "" : cls.focus;
  const ranks = driver?.skills?.[skillKey]?.ranks ?? driver?.skillTotals?.[skillKey]?.ranks ?? 0;
  const focuses = driver?.focusTotals?.drive ?? driver?.focuses?.drive ?? [];
  const hasFocus = !focus || focuses.some(f => norm(f) === norm(focus));
  const trained = ranks > 0 && hasFocus;
  let penalty = 0;
  if (!trained) {
    penalty = cls.untrainedPenalty;
    if (hasQuality(qualities, "FOR")) {
      penalty += 2;
      notes.push(loc`Forgiving: untrained penalty 2 less.`);
    }
    if (hasQuality(qualities, "UNF")) {
      penalty -= 4;
      notes.push(loc`Unforgiving: untrained penalty 4 worse.`);
    }
    if (hasQuality(qualities, "TRO"))
      return {
        blocked: loc`Trained only: this vehicle allows no untrained Maneuver checks.`,
        skillKey,
        skillName,
        focus,
        trained
      };
  }
  let errorIncrease = 0;
  const lift = vehicle?.damage?.lift ?? 0;
  if (lift) {
    errorIncrease += lift;
    notes.push(loc`Lift damage: error +${lift}.`);
  }
  if (hasQuality(qualities, "DRN")) {
    if (simulatorJockey(driver)) notes.push(loc`Drone: Simulator Jockey ignores its penalties.`);
    else {
      errorIncrease += 1;
      notes.push(loc`Drone: error +1.`);
    }
  }
  if (hazards?.rows?.length) {
    penalty += hazards.modifier;
    errorIncrease += hazards.errorIncrease;
    notes.push(
      loc`Hazards ${hazards.modifier >= 0 ? "+" : ""}${hazards.modifier}${hazards.errorIncrease ? loc`, error +${hazards.errorIncrease}` : ""}.`
    );
  }
  const why = !ranks ? `no ${skillName} ranks` : !hasFocus ? `no Drive (${focus}) focus` : "";
  const note =
    `Control check, ${cls.label}: ${skillName}${focus ? ` (Drive focus ${focus})` : ""}; ${trained ? "trained" : `untrained (${why})`}, modifier ${penalty}. ${notes.join(" ")}`.trim();
  return { blocked: null, skillKey, skillName, focus, trained, penalty, errorIncrease, note };
}

/* ---------------------------------------------------------------------- */
/*  Upgrades (Table 4.28, pp.296–297)                                     */
/* ---------------------------------------------------------------------- */

/**
 * Statistic changes of installed upgrades, keyed by the upgrade's table name (without "kit"/"factory").
 * Percentages apply to the base top MPH; qualities are added to the vehicle's list.
 */
const UPGRADE_EFFECTS = {
  "Camouflage paint scheme": { qualities: ["CMF"] },
  "Luxury fittings": { qualities: ["LUX"] },
  "Acceleration increase (stage I)": { acceleration: 1 },
  "Acceleration increase (stage II)": { acceleration: 1, topMphPercent: -10 },
  "Top speed increase (stage I)": { topMphPercent: 10 },
  "Top speed increase (stage II)": { topMphPercent: 10, fuelHours: -2 },
  "Advanced stability": { qualities: ["STB"] },
  "Control increase (stage I)": { turning: 1 },
  "Control increase (stage II)": { turning: 1, qualities: ["UNC"] },
  "Off-road suspension": { qualities: ["ORD", "UNC"] },
  "Emergency service package (basic)": { groundTurning: 1 },
  "Emergency service package (police)": { groundTurning: 1 },
  "Ergonomic seating": { qualities: ["COM"] },
  "Fine-tuning": { qualities: ["DEP"] },
  Weatherproofing: { qualities: ["ENV"] },
  "Convertible roof": { qualities: ["HOT", "OPN"], damageSavePercent: -20 },
  "Security package (stage I)": { damageSave: 4, acceleration: -1, topMphPercent: -10, qualities: ["RDD (crew)"] },
  "Security package (stage II)": {
    damageSave: 4,
    acceleration: -1,
    topMphPercent: -5,
    qualities: ["RDD (engine, fuel)"]
  },
  "Structural reinforcement": { qualities: ["RGD"] },
  "“Technical” conversion": { qualities: ["FMP (1)"] },
  "Snow tires": { turning: -1 },
  "Run-flat tires": { runFlat: true }
};
const upgradeKey = name =>
  String(name ?? "")
    .replace(/,\s*(kit|factory)$/i, "")
    .trim();
export const upgradeEffect = name => UPGRADE_EFFECTS[upgradeKey(name)] ?? null;

const GROUND = new Set(["PGV", "SGV", "HGV"]);

/**
 * A vehicle's statistics with its installed upgrades applied. `upgrades` is a list of {name, cost}.
 * Returns the adjusted statistics, the qualities label, upgrade points used and notes on what changed.
 */
export function upgradedStats(base, upgrades = []) {
  const out = {
    acceleration: base.acceleration,
    turning: base.turning,
    topMph: base.topMph,
    cruiseMph: base.cruiseMph,
    damageSave: base.damageSave,
    fuelHours: 0
  };
  const added = [],
    notes = [];
  let used = 0,
    topPercent = 0;
  for (const u of upgrades) {
    used += Math.max(0, Number(u.cost) || 0);
    const effect = upgradeEffect(u.name);
    if (!effect) continue;
    const num = (key, delta) => {
      if (Number.isSafeInteger(out[key])) out[key] = Math.max(0, out[key] + delta);
    };
    if (effect.acceleration) num("acceleration", effect.acceleration);
    if (effect.turning) num("turning", effect.turning);
    if (effect.groundTurning && GROUND.has(base.vehicleClass)) num("turning", effect.groundTurning);
    if (effect.damageSave) num("damageSave", effect.damageSave);
    if (effect.damageSavePercent && Number.isSafeInteger(out.damageSave))
      out.damageSave = Math.floor((out.damageSave * (100 + effect.damageSavePercent)) / 100);
    if (effect.topMphPercent) topPercent += effect.topMphPercent;
    if (effect.fuelHours) out.fuelHours += effect.fuelHours;
    if (effect.runFlat) out.runFlat = true;
    for (const q of effect.qualities ?? [])
      if (!hasQuality(base.qualities, q.slice(0, 3)) && !added.some(a => a.startsWith(q.slice(0, 3)))) added.push(q);
    notes.push(u.name);
  }
  if (topPercent && Number.isSafeInteger(out.topMph))
    out.topMph =
      topPercent > 0
        ? Math.ceil((out.topMph * (100 + topPercent)) / 100)
        : Math.floor((out.topMph * (100 + topPercent)) / 100);
  const qualities = [String(base.qualities ?? "").trim(), ...added].filter(Boolean).join(", ");
  return {
    ...out,
    qualities,
    used,
    free: Math.max(0, Number(base.upgrades) || 0),
    addedQualities: added,
    applied: notes
  };
}

/** Vehicular weapon spaces by Size: 1 at Medium, 3 at Large, +3 per Size above (p.297). */
export function weaponSpaces(size) {
  const index = SIZE_CODES.indexOf(sizeCode(size)),
    medium = SIZE_CODES.indexOf("M");
  if (index < medium) return 0;
  return index === medium ? 1 : 3 * (index - medium);
}
