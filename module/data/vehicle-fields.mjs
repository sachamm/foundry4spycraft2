/**
 * Vehicle statistics shared by the vehicle Item (a gear pick) and the vehicle Actor (the same vehicle on a scene).
 * Labels hold the printed table cell; the numeric fields beside them are null when the table gives no plain number.
 */

/** Field names copied between a vehicle Item and a vehicle Actor. */
export const VEHICLE_STAT_KEYS = Object.freeze([
  'vehicleClass', 'size', 'footprint', 'sizeLabel', 'occupancy', 'crew', 'passengers',
  'accelerationTurning', 'acceleration', 'turning', 'mph', 'cruiseMph', 'topMph',
  'defenseSave', 'defense', 'damageSave', 'upgrades', 'complexity', 'cargo', 'rangeFuel', 'qualities',
  'year', 'streetValue', 'restricted', 'caliber'
]);

export function vehicleStatFields() {
  // Read at call time so this module can be imported where Foundry's data fields are not loaded.
  const {BooleanField, NumberField, StringField} = foundry.data.fields;
  const label = () => new StringField({required: true, blank: true, initial: ''});
  const rating = () => new NumberField({required: true, nullable: true, integer: true, initial: null});
  return {
    /** Category code from Table 4.71 (PGV, SGV, HGV, M/AD, PSA, PFA, SVA, RWA, PSW, STW, SHP, SUB). */
    vehicleClass: label(),
    size: label(),
    footprint: label(),
    sizeLabel: label(),
    occupancy: label(),
    crew: rating(),
    passengers: rating(),
    accelerationTurning: label(),
    acceleration: rating(),
    turning: rating(),
    mph: label(),
    cruiseMph: rating(),
    topMph: rating(),
    defenseSave: label(),
    defense: rating(),
    damageSave: rating(),
    upgrades: new NumberField({required: true, nullable: false, integer: true, initial: 0, min: 0}),
    complexity: label(),
    cargo: label(),
    rangeFuel: label(),
    qualities: label(),
    year: label(),
    streetValue: label(),
    restricted: new BooleanField()
  };
}

/** The subset of a vehicle's system data that describes the vehicle itself. */
export function vehicleStats(system) {
  return Object.fromEntries(VEHICLE_STAT_KEYS.filter(key => system?.[key] !== undefined).map(key => [key, system[key]]));
}
