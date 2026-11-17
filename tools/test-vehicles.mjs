import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  breakState, criticalDiceForSize, damageSaveDC, failedDamageSaves, occupancy, sizeCode, tractionSaveBonus,
  vehicleClass, vehicleCondition, vehicleDamageLocation, vehicleDefense
} from '../module/rules/vehicles.mjs';
import {GEAR_RULES, VEHICLE_RULES} from '../module/rules/tables.mjs';

const read = name => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url)));
const gear = read('gear'), vehicles = read('vehicles');

/* ---------------------------------------------------------------------- */
/*  Rules                                                                  */
/* ---------------------------------------------------------------------- */

test('a Damage save DC is 10 plus half the damage, and needs at least 1 point', () => {
  assert.equal(damageSaveDC(1), 10);
  assert.equal(damageSaveDC(15), 17);
  assert.equal(damageSaveDC(48), 34);
  for (const bad of [0, -3, 2.5, '12', null]) assert.throws(() => damageSaveDC(bad));
});

test('failed saves count the miss, blast steps of ten and a doubled critical hit', () => {
  assert.equal(failedDamageSaves({total: 17, dc: 17}), 0);
  assert.equal(failedDamageSaves({total: 16, dc: 17}), 1);
  assert.equal(failedDamageSaves({total: 16, dc: 34}), 1);
  assert.equal(failedDamageSaves({total: 16, dc: 34, blast: true}), 2);
  assert.equal(failedDamageSaves({total: 25, dc: 34, blast: true}), 1);
  assert.equal(failedDamageSaves({total: 12, dc: 34, blast: true, critical: true}), 6);
  assert.equal(failedDamageSaves({total: 40, dc: 34, blast: true, critical: true}), 0);
  assert.throws(() => failedDamageSaves({total: '16', dc: 34}));
});

test('Size sets when an object breaks, when it is destroyed and what a critical hit costs', () => {
  assert.deepEqual(breakState('M', 0), {state: 'intact', brokenAt: 1, destroyedAt: 2});
  assert.equal(breakState('T/1h', 1).state, 'broken');
  assert.equal(breakState('F', 2).state, 'destroyed');
  assert.equal(breakState('L (2×3)', 2).state, 'intact');
  assert.equal(breakState('L', 3).state, 'broken');
  assert.equal(breakState('L', 6).state, 'destroyed');
  assert.deepEqual([breakState('H', 0).brokenAt, breakState('G', 0).brokenAt, breakState('C', 0).brokenAt, breakState('E', 0).brokenAt, breakState('V', 0).brokenAt], [6, 9, 12, 15, 18]);
  assert.equal(breakState('V', 36).state, 'destroyed');
  // An unknown Size is treated as Medium rather than never breaking.
  assert.equal(breakState('', 1).state, 'broken');
  assert.deepEqual(['S', 'L', 'H', 'G', 'C', 'E', 'V'].map(criticalDiceForSize), [1, 1, 2, 2, 3, 3, 4]);
  assert.throws(() => breakState('M', -1));
});

test('size codes are read from table labels only when they start with a Size letter', () => {
  assert.equal(sizeCode('L (2×3)'), 'L');
  assert.equal(sizeCode('F/1h'), 'F');
  assert.equal(sizeCode('m'), 'M');
  assert.equal(sizeCode('Large'), '');
  assert.equal(sizeCode('—/1h'), '');
  assert.equal(sizeCode(''), '');
});

test('every vehicle category has a control skill, an untrained penalty and twenty damage locations', () => {
  assert.equal(VEHICLE_RULES.classes.length, 12);
  for (const entry of VEHICLE_RULES.classes) {
    assert.ok(entry.skill && entry.label, entry.code);
    assert.ok(entry.untrainedPenalty < 0, entry.code);
    assert.equal(entry.damageLocations.length, 20, entry.code);
    for (const code of entry.damageLocations) assert.ok(VEHICLE_RULES.damageLocations[code], `${entry.code} ${code}`);
    assert.equal(vehicleClass(entry.code), entry);
  }
  assert.equal(vehicleClass('SGV').focus, 'Standard Ground Vehicles');
  assert.equal(vehicleClass('M/AD').skill, 'Survival');
  assert.equal(vehicleClass('nope'), null);
  assert.deepEqual(vehicleDamageLocation('RWA', 17), {code: 'Rotors', label: 'Rotors'});
  assert.equal(vehicleDamageLocation('SGV', 1).label, 'Cargo');
  assert.equal(vehicleDamageLocation('SGV', 20).label, 'Weapon or secondary gear');
  assert.throws(() => vehicleDamageLocation('SGV', 0));
  assert.throws(() => vehicleDamageLocation('SGV', 21));
  assert.throws(() => vehicleDamageLocation('', 10));
});

test('recorded Vehicle Damage lowers ratings and speeds, and immobilizes at zero', () => {
  const car = {acceleration: 6, turning: 5, cruiseMph: 70, topMph: 150};
  assert.deepEqual(vehicleCondition(car, {}), {acceleration: 6, turning: 5, cruiseMph: 70, topMph: 150, maneuverErrorIncrease: 0, fuelHoursLost: 0, immobilized: false});
  const hurt = vehicleCondition(car, {controls: 1, engine: 2, traction: 1, lift: 1, fuelHours: 3});
  assert.equal(hurt.acceleration, 4);
  assert.equal(hurt.turning, 2);
  // Each engine result removes a quarter of what is left, rounded down: 70 → 53 → 40; 150 → 113 → 85.
  assert.equal(hurt.cruiseMph, 40);
  assert.equal(hurt.topMph, 85);
  assert.equal(hurt.maneuverErrorIncrease, 1);
  assert.equal(hurt.fuelHoursLost, 3);
  assert.equal(hurt.immobilized, false);
  assert.equal(vehicleCondition(car, {controls: 5}).immobilized, true);
  assert.equal(vehicleCondition(car, {flotation: 9}).acceleration, 0);
  // A rating that starts at 0 (a trailer, a towed barge) is not "immobilized by damage".
  assert.equal(vehicleCondition({acceleration: 0, turning: 2}, {}).immobilized, false);
  // Mounts list no ratings; they stay unknown rather than becoming 0.
  const mount = vehicleCondition({acceleration: null, turning: null, cruiseMph: 2, topMph: 10}, {engine: 1});
  assert.equal(mount.acceleration, null);
  assert.equal(mount.turning, null);
  assert.equal(mount.cruiseMph, 2);
  assert.throws(() => vehicleCondition(car, {engine: -1}));
  assert.throws(() => vehicleCondition(car, {engine: 1.5}));
});

test('vehicle Defense adds the driver while moving and any rating lead over the attacker', () => {
  assert.equal(vehicleDefense({defense: null}), null);
  assert.equal(vehicleDefense({defense: 9, driverDexMod: 3}).total, 9);
  assert.equal(vehicleDefense({defense: 9, moving: true, driverDexMod: 3}).total, 12);
  const chased = vehicleDefense({defense: 9, moving: true, driverDexMod: 3, acceleration: 6, turning: 5, attacker: {acceleration: 4, turning: 7}});
  assert.equal(chased.total, 14);
  assert.deepEqual(chased.rows.map(r => r.label), ['Base Defense', 'Driver Dexterity', 'Acceleration lead']);
  assert.equal(vehicleDefense({defense: 9, acceleration: 3, turning: 3, attacker: {acceleration: 6, turning: 6}}).total, 9);
});

test('occupancy labels and tyre save bonuses are read as numbers', () => {
  assert.deepEqual(occupancy('1+3'), {crew: 1, passengers: 3});
  assert.deepEqual(occupancy('155'), {crew: 155, passengers: 0});
  assert.deepEqual(occupancy('5,500+90'), {crew: 5500, passengers: 90});
  assert.deepEqual(occupancy('NPC'), {crew: null, passengers: null});
  assert.deepEqual(['S', 'M', 'L', 'H', 'C', 'V'].map(tractionSaveBonus), [0, 1, 2, 4, 6, 6]);
});

/* ---------------------------------------------------------------------- */
/*  Source data                                                            */
/* ---------------------------------------------------------------------- */

const ROMAN = new Set(['I', 'II', 'III', 'IV', 'V']);
const strings = value => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];

test('gear data covers every pick category with labelled table rows', () => {
  const expected = {electronics: ['E', 77], gadgets: ['G', 112], resources: ['R', 59], security: ['S', 32], tradecraft: ['T', 90]};
  for (const [list, [category, count]] of Object.entries(expected)) {
    assert.equal(gear[list].length, count, list);
    assert.ok(gear.categories[category].page > 0, category);
    for (const row of gear[list]) {
      assert.equal(row.category, category, row.name);
      assert.ok(row.name && row.name === row.name.trim(), `${list}: name`);
      assert.ok(row.caliber === '' || ROMAN.has(row.caliber), `${row.name}: caliber`);
      assert.ok(Number.isSafeInteger(row.sourcePage) && row.sourcePage >= 226 && row.sourcePage <= 235, `${row.name}: page`);
      assert.ok(row.bundleSize >= 1, `${row.name}: bundle`);
      assert.doesNotMatch(row.name, /[*†∆Ω↳]/, row.name);
      if (list !== 'resources') {
        assert.ok(row.damageSave === null || Number.isSafeInteger(row.damageSave), `${row.name}: save`);
        assert.ok(row.weight >= 0, `${row.name}: weight`);
        // A row without a Caliber is one bought with Reputation or Net Worth, and lists that cost.
        if (row.caliber === '') assert.notEqual(row.standingCost, '', `${row.name}: standing cost`);
        else assert.equal(row.standingCost, '', `${row.name}: caliber or standing`);
      }
    }
  }
  assert.equal(gear.housings.length, 12);
  assert.deepEqual(gear.housings.map(h => h.maxMechanisms), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
  assert.deepEqual(GEAR_RULES.damageSaves, gear.damageSaves);
});

test('vehicle data covers all twelve categories with usable statistics', () => {
  assert.equal(vehicles.vehicles.length, 213);
  const perClass = Object.groupBy(vehicles.vehicles, v => v.vehicleClass);
  assert.deepEqual(Object.keys(perClass).sort(), vehicles.classes.map(c => c.code).sort());
  for (const v of vehicles.vehicles) {
    assert.ok(v.name && !/[*†∆Ω↳]/.test(v.name), v.name);
    assert.ok(v.caliber === '' ? v.standingOnly : ROMAN.has(v.caliber), `${v.name}: caliber`);
    assert.ok(v.sourcePage >= 236 && v.sourcePage <= 244, `${v.name}: page`);
    if (v.optionOf) continue;
    assert.ok(v.size, `${v.name}: size`);
    // Mounts use their NPC statistics; every other vehicle has a Defense and a Damage save.
    if (v.defenseSave === 'NPC') assert.equal(v.vehicleClass, 'M/AD', v.name);
    else {
      assert.ok(Number.isSafeInteger(v.defense) && Number.isSafeInteger(v.damageSave), `${v.name}: D/S`);
      assert.equal(v.defenseSave, `${v.defense}/+${v.damageSave}`, v.name);
    }
    if (v.standingOnly) assert.match(v.standingCost, /^\d+ Reputation$/, v.name);
  }
  assert.equal(vehicles.upgrades.length, 33);
  assert.equal(vehicles.weapons.length, 168);
  for (const u of vehicles.upgrades) for (const kind of ['ground', 'air', 'water']) assert.ok(u[kind].streetValue && u[kind].complexity, `${u.name}: ${kind}`);
  for (const w of vehicles.weapons) assert.ok(w.name && w.sourcePage >= 246 && w.sourcePage <= 249, w.name);
  assert.deepEqual(VEHICLE_RULES.classes, vehicles.classes);
});

test('the new data files hold labels and numbers, not prose', () => {
  for (const [file, data] of [['gear', gear], ['vehicles', vehicles]]) {
    for (const [key, value] of Object.entries(data)) {
      if (key === '_note') continue;
      for (const text of strings(value)) {
        // Qualities lists are comma-separated codes and may run long; nothing else comes close to a sentence.
        const limit = /^[A-Z]{3}\b/.test(text) || text.includes('WPN (') ? 400 : 70;
        assert.ok(text.length <= limit, `${file}.${key}: "${text.slice(0, 80)}…"`);
        assert.doesNotMatch(text, /\b(see page|this (item|vehicle|pick)|may not|must be)\b/i, `${file}.${key}: ${text}`);
      }
    }
  }
});

/* ---------------------------------------------------------------------- */
/*  Play actions against stubbed Foundry documents                         */
/* ---------------------------------------------------------------------- */

const posts = [];
let nextRoll = 10, created = null;
globalThis.foundry = {utils: {escapeHTML: String, deepClone: structuredClone}, data: {fields: new Proxy({}, {get: () => class { constructor(options) { this.options = options; } }})}};
globalThis.ChatMessage = {getSpeaker: () => ({})};
globalThis.ui = {notifications: {warn: message => { posts.push({warning: message}); return null; }}};
globalThis.game = {user: {can: () => true}};
globalThis.Roll = class {
  constructor(formula, data = {}) { this.total = nextRoll + (data.bonus ?? 0); }
  async evaluate() { return this; }
  async toMessage(data) { posts.push(data); return data; }
};
globalThis.Actor = {implementation: {create: async data => { created = {...data, sheet: {render() {}}}; return created; }}};
const {rollObjectDamageSave, rollVehicleDamageResult, rollTyreSave, repairVehicle, deployVehicle, loadVehicleStats, objectSize} = await import('../module/apps/vehicle-play.mjs');

const document = (documentName, type, system) => ({
  documentName, type, name: 'Test', uuid: `${documentName}.test`, isOwner: true, img: 'icon.svg', system, parent: null,
  async update(changes) {
    for (const [path, value] of Object.entries(changes)) {
      const keys = path.split('.'), last = keys.pop();
      let target = this;
      for (const key of keys) target = target[key] ??= {};
      target[last] = value;
    }
    return this;
  }
});

test('a gear item records the Damage saves it fails and reports when it breaks', async () => {
  const bug = document('Item', 'gear', {damageSave: 2, sizeHands: 'F/1h', failedSaves: 0});
  assert.equal(objectSize(bug), 'F');
  nextRoll = 15; posts.length = 0;
  await rollObjectDamageSave(bug, {damage: 12});            // 17 against DC 16
  assert.equal(bug.system.failedSaves, 0);
  assert.match(posts[0].flavor, /DC 16/);
  assert.match(posts[0].flavor, /Saved\./);
  nextRoll = 5;
  await rollObjectDamageSave(bug, {damage: 12});            // 7 against DC 16
  assert.equal(bug.system.failedSaves, 1);
  assert.match(posts[1].flavor, /Now <strong>broken<\/strong>/);
  await rollObjectDamageSave(bug, {damage: 12});
  assert.match(posts[2].flavor, /Now <strong>destroyed<\/strong>/);
  posts.length = 0;
  assert.equal(await rollObjectDamageSave(document('Item', 'gear', {damageSave: null}), {damage: 5}), null);
  assert.match(posts[0].warning, /no Damage save bonus/);
});

test('a critical hit on a vehicle rolls a Vehicle Damage result once per failed save', async () => {
  const car = document('Actor', 'vehicle', {vehicleClass: 'SGV', size: 'L', damageSave: 8, failedSaves: 0, damage: {}});
  nextRoll = 6; posts.length = 0;                            // save 14 vs DC 30: fails 1, blast +1, critical ×2 = 4; then location 6 = Controls
  await rollObjectDamageSave(car, {damage: 40, blast: true, critical: true});
  assert.equal(car.system.failedSaves, 4);
  assert.equal(car.system.damage.controls, 4);
  assert.match(posts[0].flavor, /Failed 4 saves: 4 of 3 to break, 6 to destroy/);
  assert.match(posts[1].flavor, /Vehicle Damage result: <strong>Controls<\/strong> ×4/);

  nextRoll = 16; posts.length = 0;                           // location 16 on SGV = Traction: no counter until the tyre fails its own save
  await rollVehicleDamageResult(car, {failed: 1, damage: 40});
  assert.match(posts[0].flavor, /tyre must now make its own Damage save against 40 damage \(bonus \+2\)/);
  assert.equal(car.system.damage.traction, undefined);
  nextRoll = 3;
  await rollTyreSave(car, {damage: 40});                     // 5 vs DC 30
  assert.equal(car.system.damage.traction, 1);

  nextRoll = 12; posts.length = 0;                           // location 12 on SGV = Occupant: reported, not recorded
  await rollVehicleDamageResult(car, {failed: 2});
  assert.match(posts[0].flavor, /Occupant<\/strong> ×2/);
  assert.match(posts[0].flavor, /nothing is recorded automatically/);

  await repairVehicle(car);
  assert.equal(car.system.failedSaves, 0);
  assert.deepEqual(car.system.damage, {controls: 0, engine: 0, flotation: 0, fuelHours: 0, lift: 0, traction: 0});
});

test('a vehicle pick can be placed on a scene and can refresh an existing vehicle without touching its damage', async () => {
  const stats = {vehicleClass: 'PGV', size: 'M', sizeLabel: 'M (1×1)', acceleration: 6, turning: 9, defense: 10, damageSave: 7, caliber: 1, qualities: 'OPN (no cover)', quantity: 2, pick: 'V'};
  const pick = document('Item', 'vehicle', stats);
  pick.parent = {uuid: 'Actor.owner', ownership: {default: 0, player: 3}};
  const actor = await deployVehicle(pick);
  assert.equal(actor.type, 'vehicle');
  assert.equal(actor.system.sourceItem, 'Item.test');
  assert.equal(actor.system.driver, 'Actor.owner');
  assert.equal(actor.system.acceleration, 6);
  assert.deepEqual(actor.ownership, {default: 0, player: 3});
  // Inventory bookkeeping stays on the pick.
  assert.equal('quantity' in actor.system, false);
  assert.equal('pick' in actor.system, false);

  const onScene = document('Actor', 'vehicle', {acceleration: 1, failedSaves: 2, damage: {engine: 1}});
  await loadVehicleStats(onScene, pick);
  assert.equal(onScene.system.acceleration, 6);
  assert.equal(onScene.system.failedSaves, 2);
  assert.equal(onScene.system.damage.engine, 1);
  assert.equal(await deployVehicle(document('Item', 'gear', {})), null);
});
