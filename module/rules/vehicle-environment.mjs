/**
 * Vehicles and their surroundings (pp.291–293): fuel explosions (Table 4.73), acceleration to distance (Table 4.74),
 * signature (Table 4.75) and terrain and weather hazards (Table 4.76). Pure functions: no Foundry access.
 * The numbers come from src/data/vehicles.json through the generated tables.
 */
import {VEHICLE_RULES} from './tables.mjs';
import {SIZE_CODES, sizeCode} from './vehicles.mjs';
import {hasQuality, parseQualities, qualityNumber} from './vehicle-play-rules.mjs';

const sizeIndex = code => SIZE_CODES.indexOf(sizeCode(code));

/** Whether a vehicle category moves on the ground, in the air or on (or under) water. */
export function movementMode(vehicleClass) {
  return VEHICLE_RULES.hazards.modeByClass[vehicleClass] ?? null;
}

/* ---------------------------------------------------------------------- */
/*  Fuel explosions (Table 4.73)                                          */
/* ---------------------------------------------------------------------- */

/**
 * The explosion when a burning vehicle's fuel goes up: dice, blast increment (5-ft. squares), armor-piercing and the
 * multiplier from its remaining fuel hours (rounded down, at least 1). Returns {explodes: false, reason} otherwise.
 * Vehicles smaller than Small use the Small row.
 */
export function explosionPlan({size, fuel, remainingHours = 0}) {
  const table = VEHICLE_RULES.explosions, code = String(fuel ?? '').toUpperCase();
  if (!code) return {explodes: false, reason: 'It carries no fuel that can explode.'};
  if (table.noExplosion.includes(code)) return {explodes: false, reason: 'Diesel, oil, nuclear and battery power cannot explode.'};
  const column = table.columnByFuel[code];
  if (!column) return {explodes: false, reason: 'The GC decides whether this fuel can explode.'};
  const s = sizeCode(size), smallest = SIZE_CODES.indexOf('S');
  const row = table.bySize[s] ?? (sizeIndex(s) >= 0 && sizeIndex(s) < smallest ? table.bySize.S : null);
  if (!row) return {explodes: false, reason: 'Record the vehicle\'s Size first.'};
  const entry = row[column], multiplier = Math.max(1, Math.floor(Number(remainingHours) || 0));
  return {explodes: true, ...entry, multiplier, formula: `(${entry.dice}) * ${multiplier}`, column, houseRule: table.columnHouseRule?.[code] ?? '', page: table.page};
}

/* ---------------------------------------------------------------------- */
/*  Acceleration to distance (Table 4.74)                                 */
/* ---------------------------------------------------------------------- */

/**
 * The Table 4.74 values for a vehicle: the share of top MPH gained in the first round and in each round after,
 * rounded down, and the speed after each round until top MPH is reached. A drawn vehicle uses the drawing animal's
 * or vehicle's Acceleration minus 2 (minimum 0).
 */
export function accelerationSchedule({acceleration, topMph, drawnBy = null, startMph = 0}) {
  const table = VEHICLE_RULES.accelerationDistance;
  let rating = Number.isSafeInteger(drawnBy) ? Math.max(0, drawnBy - table.drawnPenalty) : acceleration;
  if (!Number.isSafeInteger(rating) || !Number.isSafeInteger(topMph) || topMph <= 0) return null;
  rating = Math.max(0, rating);
  const band = table.bands.find(b => rating >= b.min && (b.max === null || rating <= b.max));
  const share = ([n, d]) => Math.floor(topMph * n / d);
  const first = share(band.first), later = share(band.later), speeds = [];
  let speed = Math.max(0, startMph);
  for (let round = 1; speed < topMph && round <= 60; round++) {
    const gain = round === 1 && startMph <= 0 ? first : later;
    if (gain <= 0) break;
    speed = Math.min(topMph, speed + gain);
    speeds.push(speed);
  }
  return {rating, first, later, firstShare: band.first, laterShare: band.later, speeds, page: table.page};
}

/* ---------------------------------------------------------------------- */
/*  Signature (Table 4.75)                                                */
/* ---------------------------------------------------------------------- */

/** Sizes listed for each sensor by the High-observable (HOB) or Low-observable (LOB) quality, e.g. {radar: 'M'}. */
export function signatureSizes(qualities) {
  const out = {};
  for (const q of parseQualities(qualities)) {
    if (q.code !== 'HOB' && q.code !== 'LOB') continue;
    for (const part of q.param.split(',')) {
      const match = /^\s*(radar|sonar|thermal)\s+([A-Z])\b/i.exec(part);
      if (match) out[match[1].toLowerCase()] = match[2].toUpperCase();
    }
  }
  return out;
}

/**
 * Signature Defense and DC of a vehicle against one sensor type: from its signature Size (listed sizes take
 * precedence), active jamming gear (radar only, half its Power Rating in Size categories), speed above cruising and
 * the Maneuvering Room. Returns null for a sensor type the vehicle's movement mode does not have.
 */
export function signatureDefense(system, sensor, {fasterThanCruising = false, room = null, jamming = false} = {}) {
  const table = VEHICLE_RULES.signature, mode = movementMode(system?.vehicleClass);
  if (!mode || !table.sensorsByMode[mode].includes(sensor)) return null;
  const qualities = system.qualitiesNow ?? system.qualities ?? '';
  const listed = signatureSizes(qualities)[sensor];
  let size = listed ?? sizeCode(system.size || system.sizeLabel);
  let sizeLabel = `${listed ? 'Signature' : 'Actual'} Size ${size}`;
  if (jamming && sensor === 'radar' && hasQuality(qualities, 'JAM')) {
    const steps = Math.floor(Math.max(0, qualityNumber(qualities, 'JAM') ?? 0) / 2);
    const index = Math.min(SIZE_CODES.length - 1, sizeIndex(size) + steps);
    if (steps && sizeIndex(size) >= 0) { size = SIZE_CODES[index]; sizeLabel += `, jamming: as ${size}`; }
  }
  const base = table.bySize[size];
  if (!Number.isSafeInteger(base)) return {sensor, size, value: null, rows: [], note: 'No signature listed for this Size.'};
  const rows = [{label: sizeLabel, value: base}];
  if (fasterThanCruising) rows.push({label: 'Faster than cruising MPH', value: table.fasterThanCruising});
  if (room && Number.isSafeInteger(table.room[room])) rows.push({label: `Maneuvering Room ${room}`, value: table.room[room]});
  return {sensor, size, value: rows.reduce((sum, row) => sum + row.value, 0), rows, listed: !!listed};
}

/** Signature Defense/DC for every sensor type the vehicle can be found with. */
export function vehicleSignatures(system, options = {}) {
  const mode = movementMode(system?.vehicleClass);
  if (!mode) return [];
  return VEHICLE_RULES.signature.sensorsByMode[mode].map(sensor => signatureDefense(system, sensor, options)).filter(Boolean);
}

/* ---------------------------------------------------------------------- */
/*  Terrain and weather hazards (Table 4.76)                              */
/* ---------------------------------------------------------------------- */

export const HAZARD_GROUPS = Object.freeze(['terrain', 'surface', 'weather', 'wind']);
const WEATHER_GROUPS = new Set(['weather', 'wind']);

/** Hazard rows of one group for choosing on a sheet: [[key, label]]. */
export const hazardOptions = group => (VEHICLE_RULES.hazards.groups[group] ?? []).map(row => [row.key, row.label]);

const parseCell = cell => {
  const text = String(cell ?? '0').trim();
  if (text === 'x') return {value: 0, blocked: true, damage: false, speedCut: false};
  return {value: Number(text.replace(/[ds]/g, '')) || 0, blocked: false, damage: text.includes('d'), speedCut: text.includes('s')};
};

/** The hazard row a quality parameter such as "arctic" or "desert" names, if any. */
const toleranceRow = param => {
  const word = String(param ?? '').toLowerCase().trim();
  if (!word) return null;
  for (const group of HAZARD_GROUPS) {
    const row = VEHICLE_RULES.hazards.groups[group].find(r => r.key.toLowerCase() === word || r.label.toLowerCase() === word);
    if (row) return row.key;
  }
  return null;
};

/**
 * The effect of the chosen terrain, surface, weather and wind on a vehicle's Maneuver checks. All modifiers add up.
 *  - Ground vehicles read the off-road or tracked figure when they have those qualities.
 *  - Ground and air vehicles also raise their error range by a third of the total penalty (rounded down).
 *  - Rain, snow and wind penalties shrink by 1 per Size above Large; Stabilized cuts each weather penalty by 2.
 *  - Environmental tolerance ignores the one hazard it names (or `tolerance` when its listing says "any one").
 */
export function vehicleHazards(system, choice = {}) {
  const data = VEHICLE_RULES.hazards, mode = movementMode(system?.vehicleClass);
  const empty = {mode, modifier: 0, errorIncrease: 0, blocked: null, damagePerRound: false, speedCut: false, rows: [], notes: []};
  if (!mode) return empty;
  const qualities = system.qualitiesNow ?? system.qualities ?? '';
  const variant = hasQuality(qualities, 'TRK') ? 2 : hasQuality(qualities, 'ORD') ? 1 : 0;
  const env = parseQualities(qualities).find(q => q.code === 'ENV');
  const ignored = env ? toleranceRow(env.param) ?? toleranceRow(choice.tolerance) : null;
  const stabilized = hasQuality(qualities, 'STB');
  const relief = Math.max(0, sizeIndex(system.size || system.sizeLabel) - SIZE_CODES.indexOf(data.sizeReliefAbove));
  const out = {...empty, rows: [], notes: []};
  for (const group of HAZARD_GROUPS) {
    const row = data.groups[group].find(r => r.key === choice[group]);
    if (!row) continue;
    const raw = row[mode], cell = parseCell(Array.isArray(raw) ? raw[variant] : raw);
    let value = cell.value;
    const why = [];
    if (row.key === ignored) { if (value || cell.blocked || cell.damage || cell.speedCut) why.push('environmental tolerance'); value = 0; cell.blocked = cell.damage = cell.speedCut = false; }
    if (value < 0 && row.sizeRelief && relief) { value = Math.min(0, value + relief); why.push(`Size relief ${relief}`); }
    if (value < 0 && stabilized && WEATHER_GROUPS.has(group)) { value = Math.min(0, value + 2); why.push('Stabilized'); }
    if (cell.blocked) out.blocked = `This vehicle cannot travel over ${row.label.toLowerCase()} ground.`;
    if (cell.damage) out.damagePerRound = true;
    if (cell.speedCut) out.speedCut = true;
    out.modifier += value;
    out.rows.push({group, key: row.key, label: row.label, value, why});
  }
  const divisor = data.errorFromTotal[mode];
  if (divisor && out.modifier < 0) out.errorIncrease = Math.floor(-out.modifier / divisor);
  if (out.speedCut) {
    const cut = speed => Number.isSafeInteger(speed) ? speed - Math.floor(speed * 0.25) : null;
    out.cruiseMph = cut(system.condition?.cruiseMph ?? system.cruiseMph);
    out.topMph = cut(system.condition?.topMph ?? system.topMph);
    out.notes.push('Cruising and top MPH each drop by a quarter.');
  }
  if (out.damagePerRound) out.notes.push('One Vehicle Damage result each round it travels faster than half its cruising MPH.');
  if (out.errorIncrease) out.notes.push(`Maneuver error range +${out.errorIncrease}.`);
  if (env && !ignored) out.notes.push('Environmental tolerance: choose the hazard it ignores.');
  return out;
}

/** One-line summary of a hazard result for sheets and chat. */
export function hazardLine(result) {
  if (!result?.rows.length) return '';
  const parts = result.rows.map(r => `${r.label} ${r.value >= 0 ? '+' : ''}${r.value}${r.why.length ? ` (${r.why.join(', ')})` : ''}`);
  return `Hazards (Table ${VEHICLE_RULES.hazards.table}): ${parts.join(', ')}; total ${result.modifier >= 0 ? '+' : ''}${result.modifier}.${result.blocked ? ` ${result.blocked}` : ''}${result.notes.length ? ` ${result.notes.join(' ')}` : ''}`;
}
