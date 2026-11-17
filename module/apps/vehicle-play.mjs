/**
 * Play actions for gear and vehicles: Damage saves (p.224), Vehicle Damage results (p.290) and placing a
 * vehicle pick on a scene. The arithmetic lives in module/rules/vehicles.mjs.
 */
import {
  VEHICLE_DAMAGE_COUNTERS, breakState, criticalDiceForSize, damageSaveDC, failedDamageSaves, sizeCode,
  tractionSaveBonus, vehicleDamageLocation
} from '../rules/vehicles.mjs';
import {VEHICLE_RULES} from '../rules/tables.mjs';
import {VEHICLE_STAT_KEYS, vehicleStats} from '../data/vehicle-fields.mjs';

const esc = value => foundry.utils.escapeHTML(String(value ?? ''));
const speakerFor = doc => ChatMessage.getSpeaker({actor: doc.documentName === 'Actor' ? doc : doc.parent});

/** Vehicle Damage results this system records as a counter; the rest are resolved from the book. */
const COUNTER_BY_LOCATION = {Cont: 'controls', Eng: 'engine', Flot: 'flotation', Fuel: 'fuelHours', Lift: 'lift'};

/** Size letter of a gear item or vehicle. */
export function objectSize(doc) {
  const system = doc.system ?? {};
  return system.size || sizeCode(system.sizeLabel) || sizeCode(system.sizeHands) || '';
}

async function damageInput(title, {vehicle = false} = {}) {
  const input = await foundry.applications.api.DialogV2.input({
    window: {title},
    rejectClose: false,
    content: `<div class="spycraft2-roll-options">
      <label>Lethal damage suffered <input name="damage" type="number" min="1" step="1" required autofocus /></label>
      <label><input name="blast" type="checkbox" /> The damage has a blast increment</label>
      <label><input name="critical" type="checkbox" /> An activated critical hit${vehicle ? ' (also rolls a Vehicle Damage result)' : ''}</label>
    </div>`
  });
  if (!input) return null;
  const damage = Number(input.damage);
  if (!Number.isSafeInteger(damage) || damage < 1) {
    ui.notifications.warn('Enter the whole number of lethal damage points suffered.');
    return null;
  }
  return {damage, blast: input.blast === true, critical: input.critical === true};
}

/**
 * Roll a Damage save for a gear item, a vehicle pick or a vehicle on a scene, and record the saves it failed.
 * A Damage save has no error or threat range, so this does not go through the character check workflow.
 */
export async function rollObjectDamageSave(doc, options = {}) {
  const bonus = doc.system?.damageSave;
  if (!Number.isSafeInteger(bonus)) return ui.notifications.warn(`${doc.name} has no Damage save bonus recorded.`);
  const isVehicleActor = doc.documentName === 'Actor' && doc.type === 'vehicle';
  const input = Number.isSafeInteger(options.damage) ? {blast: false, critical: false, ...options} : await damageInput(`${doc.name}: Damage save`, {vehicle: isVehicleActor});
  if (!input) return null;

  const dc = damageSaveDC(input.damage), size = objectSize(doc);
  const roll = await new Roll('1d20 + @bonus', {bonus}).evaluate();
  const failed = failedDamageSaves({total: roll.total, dc, blast: input.blast, critical: input.critical});
  const before = doc.system.failedSaves ?? 0, after = before + failed, state = breakState(size, after);

  const lines = [`<strong>${esc(doc.name)}</strong> — Damage save, DC ${dc} (${input.damage} damage${input.blast ? ', blast' : ''}${input.critical ? ', critical hit' : ''})`];
  if (!failed) lines.push('Saved.');
  else lines.push(`Failed ${failed} save${failed === 1 ? '' : 's'}: ${after} of ${state.brokenAt} to break, ${state.destroyedAt} to destroy. Now <strong>${state.state}</strong>.`);
  if (input.critical) lines.push(`Activating this critical hit costs the attacker ${criticalDiceForSize(size)} action di${criticalDiceForSize(size) === 1 ? 'e' : 'ce'}.`);

  const message = await roll.toMessage({speaker: speakerFor(doc), flavor: lines.join('<br>'), flags: {spycraft2: {objectDamageSave: {uuid: doc.uuid, dc, damage: input.damage, failed, total: roll.total}}}});
  if (failed && doc.isOwner) await doc.update({'system.failedSaves': after});
  if (failed && input.critical && isVehicleActor) await rollVehicleDamageResult(doc, {failed, damage: input.damage});
  return message;
}

/**
 * Roll a Vehicle Damage result (Table 4.72) and record it once per failed save.
 * Results without a counter here (cargo, occupants, weapons, rotors, draft animals) are reported for the GC.
 */
export async function rollVehicleDamageResult(actor, {failed = 1, damage = null} = {}) {
  if (!actor.system.vehicleClass) return ui.notifications.warn('Choose this vehicle\'s category before rolling a Vehicle Damage result.');
  const roll = await new Roll('1d20').evaluate();
  const location = vehicleDamageLocation(actor.system.vehicleClass, roll.total);
  const counter = COUNTER_BY_LOCATION[location.code];
  const lines = [`<strong>${esc(actor.name)}</strong> — Vehicle Damage result: <strong>${esc(location.label)}</strong> ×${failed} (p.${VEHICLE_RULES.damagePage})`];
  if (counter) lines.push('Recorded on the vehicle; its current ratings are updated.');
  else if (location.code === 'Tract') lines.push(`A tyre must now make its own Damage save${damage ? ` against ${damage} damage` : ''} (bonus +${tractionSaveBonus(objectSize(actor))}). Use “Tyre save” on the vehicle sheet.`);
  else lines.push('Resolve this result from the page above; nothing is recorded automatically.');
  const message = await roll.toMessage({speaker: speakerFor(actor), flavor: lines.join('<br>')});
  if (counter && actor.isOwner) await actor.update({[`system.damage.${counter}`]: (actor.system.damage?.[counter] ?? 0) + failed});
  return message;
}

/** A tyre's Damage save after a Traction result; a failure records one punctured tyre. */
export async function rollTyreSave(actor, options = {}) {
  let damage = options.damage;
  if (!Number.isSafeInteger(damage)) {
    const input = await foundry.applications.api.DialogV2.input({
      window: {title: `${actor.name}: tyre Damage save`},
      rejectClose: false,
      content: '<div class="spycraft2-roll-options"><label>Damage of the attack that hit the tyre <input name="damage" type="number" min="1" step="1" required autofocus /></label></div>'
    });
    if (!input) return null;
    damage = Number(input.damage);
  }
  if (!Number.isSafeInteger(damage) || damage < 1) return ui.notifications.warn('Enter the whole number of damage points.');
  const bonus = tractionSaveBonus(objectSize(actor)), dc = damageSaveDC(damage);
  const roll = await new Roll('1d20 + @bonus', {bonus}).evaluate(), punctured = roll.total < dc;
  const message = await roll.toMessage({
    speaker: speakerFor(actor),
    flavor: `<strong>${esc(actor.name)}</strong> — tyre Damage save, DC ${dc}<br>${punctured ? 'Punctured: recorded on the vehicle.' : 'The tyre holds.'}`
  });
  if (punctured && actor.isOwner) await actor.update({'system.damage.traction': (actor.system.damage?.traction ?? 0) + 1});
  return message;
}

/** Clear failed saves and Vehicle Damage results after repairs. */
export function repairVehicle(actor) {
  return actor.update({'system.failedSaves': 0, ...Object.fromEntries(VEHICLE_DAMAGE_COUNTERS.map(key => [`system.damage.${key}`, 0]))});
}

/** Create a vehicle Actor carrying a vehicle pick's statistics, so it can have a token. */
export async function deployVehicle(item) {
  if (item.type !== 'vehicle') return null;
  if (!game.user.can('ACTOR_CREATE')) return ui.notifications.warn('You do not have permission to create actors; ask the GC to place this vehicle.');
  const actor = await Actor.implementation.create({
    name: item.name, type: 'vehicle', img: item.img,
    system: {...vehicleStats(item.system), sourceItem: item.uuid, driver: item.parent?.uuid ?? ''},
    ownership: item.parent ? foundry.utils.deepClone(item.parent.ownership) : undefined
  });
  actor?.sheet.render(true);
  return actor;
}

/** Copy a vehicle pick's statistics onto an existing vehicle Actor, leaving its recorded damage alone. */
export function loadVehicleStats(actor, item) {
  if (item.type !== 'vehicle') return null;
  const stats = vehicleStats(item.system);
  return actor.update({
    name: item.name, img: item.img, 'system.sourceItem': item.uuid,
    ...Object.fromEntries(VEHICLE_STAT_KEYS.filter(key => key in stats).map(key => [`system.${key}`, stats[key]]))
  });
}
