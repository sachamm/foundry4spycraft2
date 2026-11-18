/**
 * Play actions for gear and vehicles: Damage saves (p.224), Vehicle Damage results (p.290), tyres, fuel, occupants,
 * control checks, mounted weapons and placing a vehicle pick on a scene. The arithmetic lives in
 * module/rules/vehicles.mjs and module/rules/vehicle-play-rules.mjs.
 */
import {
  VEHICLE_DAMAGE_COUNTERS,
  breakState,
  criticalDiceForSize,
  damageSaveDC,
  failedDamageSaves,
  sizeCode,
  tractionSaveBonus,
  vehicleDamageLocation
} from "../rules/vehicles.mjs";
import {
  bailOut,
  controlCheckPlan,
  hasQuality,
  heavyArmorDice,
  secondaryDamage,
  skeletonCrew,
  travelFuel
} from "../rules/vehicle-play-rules.mjs";
import { gadgetDamage, gadgetState } from "../rules/gear-play-rules.mjs";
import { VEHICLE_RULES } from "../rules/tables.mjs";
import { explosionPlan } from "../rules/vehicle-environment.mjs";
import { VEHICLE_STAT_KEYS, vehicleStats } from "../data/vehicle-fields.mjs";
import { loc } from "../i18n.mjs";

const esc = value => foundry.utils.escapeHTML(String(value ?? ""));
const speakerFor = doc => ChatMessage.getSpeaker({ actor: doc.documentName === "Actor" ? doc : doc.parent });
const isVehicleActor = doc => doc?.documentName === "Actor" && doc.type === "vehicle";
const ask = (title, content) =>
  foundry.applications.api.DialogV2.input({
    window: { title },
    rejectClose: false,
    content: `<div class="spycraft2-roll-options">${content}</div>`
  });

/** Vehicle Damage results this system records as a counter; the rest are resolved here or reported. */
const COUNTER_BY_LOCATION = { Cont: "controls", Eng: "engine", Flot: "flotation", Fuel: "fuelHours", Lift: "lift" };

/** Size letter of a gear item or vehicle. */
export function objectSize(doc) {
  const system = doc.system ?? {};
  return system.size || sizeCode(system.sizeLabel) || sizeCode(system.sizeHands) || "";
}

/** The Damage save bonus a document rolls with: a vehicle on a scene includes upgrades, Rugged and a linked mount. */
const saveBonusOf = doc => {
  if (isVehicleActor(doc)) return doc.system.damageSaveNow ?? doc.system.damageSave;
  const gadget = doc.system?.gadget;
  if (gadget?.mechanisms?.length) {
    const state = gadgetState(gadget, { itemDamageSave: doc.system.damageSave });
    if (state.valid) return state.damageSave;
  }
  return doc.system?.damageSave;
};

async function damageInput(title, { vehicle = false, flammable = false } = {}) {
  const input = await ask(
    title,
    `
      <label>${loc`Lethal damage suffered`} <input name="damage" type="number" min="1" step="1" required autofocus /></label>
      <label>${loc`Armor-piercing`} <input name="armorPiercing" type="number" min="0" step="1" value="0" /></label>
      <label><input name="blast" type="checkbox" /> ${loc`The damage has a blast increment`}</label>
      <label><input name="fire" type="checkbox" /> ${loc`Fire damage${flammable ? loc` (Flammable: −5 to the save, damage doubled)` : ""}`}</label>
      <label><input name="critical" type="checkbox" /> ${loc`An activated critical hit${vehicle ? loc` (also rolls a Vehicle Damage result)` : ""}`}</label>`
  );
  if (!input) return null;
  const damage = Number(input.damage);
  if (!Number.isSafeInteger(damage) || damage < 1) {
    ui.notifications.warn(loc`Enter the whole number of lethal damage points suffered.`);
    return null;
  }
  return {
    damage,
    armorPiercing: Math.max(0, Number(input.armorPiercing) || 0),
    blast: input.blast === true,
    fire: input.fire === true,
    critical: input.critical === true
  };
}

/**
 * Roll a Damage save for a gear item, a vehicle pick or a vehicle on a scene, and record the saves it failed.
 * A Damage save has no error or threat range, so this does not go through the character check workflow.
 */
export async function rollObjectDamageSave(doc, options = {}) {
  const bonus0 = saveBonusOf(doc);
  if (!Number.isSafeInteger(bonus0)) return ui.notifications.warn(loc`${doc.name} has no Damage save bonus recorded.`);
  const vehicle = isVehicleActor(doc),
    qualities = vehicle ? doc.system.qualitiesNow : "";
  const flammable = vehicle && hasQuality(qualities, "FLM");
  const input = Number.isSafeInteger(options.damage)
    ? { blast: false, critical: false, fire: false, armorPiercing: 0, ...options }
    : await damageInput(`${doc.name}: Damage save`, { vehicle, flammable });
  if (!input) return null;

  // Flammable vehicles take double fire damage and save at −5 against it (p.293); armor-piercing lowers the bonus (p.224).
  const fireDoubled = input.fire && flammable,
    damage = fireDoubled ? input.damage * 2 : input.damage;
  const bonus = bonus0 - (input.fire && flammable ? 5 : 0) - Math.max(0, input.armorPiercing || 0);
  const dc = damageSaveDC(damage),
    size = objectSize(doc);
  const roll = await new Roll("1d20 + @bonus", { bonus }).evaluate();
  const failed = failedDamageSaves({ total: roll.total, dc, blast: input.blast, critical: input.critical });
  const before = doc.system.failedSaves ?? 0,
    after = before + failed,
    state = breakState(size, after);

  const lines = [
    `<strong>${esc(doc.name)}</strong> ${loc`— Damage save, DC ${dc} (${damage} damage${fireDoubled ? ", fire doubled" : ""}${input.blast ? ", blast" : ""}${input.critical ? ", critical hit" : ""})`}`
  ];
  if (vehicle && bonus !== doc.system.damageSave)
    lines.push(
      loc`Save bonus +${bonus}${hasQuality(qualities, "RGD") ? loc` (Rugged included)` : ""}${doc.system?.crewSave?.notes?.length ? ` (${doc.system.crewSave.notes.join(", ")})` : ""}${input.fire && flammable ? loc` (Flammable −5)` : ""}.`
    );
  if (!failed) lines.push(loc`Saved.`);
  else
    lines.push(
      `${loc`Failed ${failed} save${failed === 1 ? "" : "s"}: ${after} of ${state.brokenAt} to break, ${state.destroyedAt} to destroy. Now`} <strong>${state.state}</strong>.`
    );
  if (input.critical) {
    const dice = criticalDiceForSize(size) + (vehicle ? heavyArmorDice(qualities) : 0);
    lines.push(
      loc`Activating this critical hit costs the attacker ${dice} action di${dice === 1 ? "e" : "ce"}${vehicle && heavyArmorDice(qualities) ? loc` (Heavy Armor included)` : ""}.`
    );
  }

  // A gadget loses one random mechanism per failed save instead of breaking; the housing goes with the last (p.278).
  const mechanisms = doc.system.gadget?.mechanisms ?? [];
  if (failed && mechanisms.length) {
    const result = gadgetDamage({ mechanisms }, failed);
    lines[lines.length - (input.critical ? 2 : 1)] =
      `Failed ${failed} save${failed === 1 ? "" : "s"}: loses ${result.lost.map(m => esc(m.name)).join(", ")}.${result.destroyed ? ` ${loc`Its last mechanism is gone: the housing is`} <strong>${loc`destroyed`}</strong>.` : ""}`;
    const message = await roll.toMessage({
      speaker: speakerFor(doc),
      flavor: lines.join("<br>"),
      flags: { spycraft2: { objectDamageSave: { uuid: doc.uuid, dc, damage, failed, total: roll.total } } }
    });
    if (doc.isOwner)
      await doc.update({
        "system.gadget.mechanisms": result.mechanisms,
        ...(result.destroyed ? { "system.failedSaves": state.destroyedAt } : {})
      });
    return message;
  }
  const message = await roll.toMessage({
    speaker: speakerFor(doc),
    flavor: lines.join("<br>"),
    flags: { spycraft2: { objectDamageSave: { uuid: doc.uuid, dc, damage, failed, total: roll.total } } }
  });
  if (failed && doc.isOwner) await doc.update({ "system.failedSaves": after });
  if (failed && input.critical && vehicle)
    await rollVehicleDamageResult(doc, { failed, damage, armorPiercing: input.armorPiercing, fire: input.fire });
  return message;
}

/** Whether a Vehicle Damage result has something to act on; results that cannot apply are rolled again (p.289). */
function locationApplies(actor, code) {
  const s = actor.system;
  // Draft animals pull drawn vehicles; a ridden mount (statistics "NPC") has none.
  if (code === "Animal") return s.vehicleClass === "M/AD" && s.defenseSave !== "NPC";
  if (code === "Occ") return (s.crew ?? 0) + (s.passengers ?? 0) > 0 || occupantsOf(actor).length > 0;
  return true;
}

/** Everyone aboard: the driver and listed occupants, as resolved actors. */
function occupantsOf(actor) {
  const uuids = [actor.system.driver, ...(actor.system.occupants ?? []).map(o => o.uuid)].filter(Boolean);
  return [...new Set(uuids)].map(uuid => globalThis.fromUuidSync?.(uuid)).filter(Boolean);
}

/**
 * Roll a Vehicle Damage result (Table 4.72) and apply it once per failed save. Counters update the vehicle's ratings;
 * cargo, occupant, weapon or gear and draft-animal results report the damage passed on; rotors make their own save.
 * A Fuel result on a burning vehicle, or from fire damage, sets off its remaining fuel (Table 4.73).
 */
export async function rollVehicleDamageResult(
  actor,
  { failed = 1, damage = null, armorPiercing = 0, fire = false } = {}
) {
  if (!actor.system.vehicleClass)
    return ui.notifications.warn(loc`Choose this vehicle's category before rolling a Vehicle Damage result.`);
  let roll,
    location,
    rerolls = 0;
  do {
    roll = await new Roll("1d20").evaluate();
    location = vehicleDamageLocation(actor.system.vehicleClass, roll.total);
  } while (!locationApplies(actor, location.code) && ++rerolls < 10);
  const counter = COUNTER_BY_LOCATION[location.code];
  const saveBonus = actor.system.damageSaveNow ?? actor.system.damageSave ?? 0;
  const lines = [
    `<strong>${esc(actor.name)}</strong> ${loc`— Vehicle Damage result:`} <strong>${esc(location.label)}</strong> ${loc`×${failed} (p.${VEHICLE_RULES.damagePage})${rerolls ? ` after ${rerolls} reroll${rerolls === 1 ? "" : "s"}` : ""}`}`
  ];
  const passOn = (min = 1) =>
    Number.isSafeInteger(damage) ? secondaryDamage({ damage, saveBonus, armorPiercing, minimum: min }) : null;
  if (counter) lines.push(loc`Recorded on the vehicle; its current ratings are updated.`);
  else if (location.code === "Tract") {
    const half = hasQuality(actor.system.qualitiesNow, "TRK");
    lines.push(
      loc`A tyre${half ? loc` (tracks: against half damage)` : ""} must make its own Damage save${damage ? loc` against ${half ? Math.floor(damage / 2) : damage} damage` : ""} (bonus +${tractionSaveBonus(objectSize(actor))}). Use “Tyre save” on the vehicle sheet.`
    );
  } else if (["Cargo", "W/G", "Occ", "Animal"].includes(location.code)) {
    const amount = passOn(location.code === "Animal" ? 0 : 1);
    const what = {
      Cargo: loc`One random cargo item`,
      "W/G": loc`One random weapon or piece of vehicle gear`,
      Occ: loc`One random occupant`,
      Animal: loc`One random draft animal`
    }[location.code];
    if (location.code === "Occ") {
      const aboard = occupantsOf(actor),
        victim = aboard.length ? aboard[Math.floor(Math.random() * aboard.length)] : null;
      lines.push(
        loc`${victim ? `<strong>${esc(victim.name)}</strong>` : what} takes ${amount ?? loc`the attack's damage minus the vehicle's Damage save bonus`}${amount !== null ? " damage" : ""}${victim ? "" : loc` (no occupants listed on the vehicle)`}.`
      );
    } else
      lines.push(
        loc`${what} takes ${amount ?? loc`the attack's damage minus the vehicle's Damage save bonus`}${amount !== null ? " damage" : ""}.`
      );
  } else if (location.code === "Rotors") {
    const amount = passOn(1);
    if (amount === null)
      lines.push(
        loc`The rotors make a Damage save against the attack's damage minus the vehicle's Damage save bonus; failure crashes the aircraft (p.365).`
      );
    else {
      const dc = damageSaveDC(amount),
        save = await new Roll("1d20 + @bonus", { bonus: saveBonus }).evaluate();
      lines.push(
        loc`Rotor Damage save against ${amount}: ${save.total} vs DC ${dc} — ${save.total >= dc ? loc`the rotors hold` : `<strong>${loc`the rotors shatter and the aircraft crashes`}</strong> (p.365)`}.`
      );
    }
  } else lines.push(loc`Resolve this result from the page above; nothing is recorded automatically.`);
  for (const [code, label] of [
    ["HOT", loc`Hot`],
    ["LUX", loc`Luxury`]
  ])
    if (hasQuality(actor.system.qualitiesNow, code))
      lines.push(loc`${label} may be lost to this critical hit (p.294); restore it with a Mechanics/Repair check.`);
  const burning = location.code === "Fuel" && (fire || actor.system.onFire);
  if (burning)
    lines.push(
      loc`The vehicle ${actor.system.onFire ? "is" : "catches"} on fire: its remaining fuel explodes (Table ${VEHICLE_RULES.explosions.table}).`
    );
  const message = await roll.toMessage({ speaker: speakerFor(actor), flavor: lines.join("<br>") });
  if (counter && actor.isOwner)
    await actor.update({
      [`system.damage.${counter}`]: (actor.system.damage?.[counter] ?? 0) + failed,
      ...(burning ? { "system.onFire": true } : {})
    });
  if (burning) await rollFuelExplosion(actor);
  return message;
}

/**
 * A burning vehicle's fuel explodes (Table 4.73, p.291): explosive fire damage by Size and fuel, multiplied by the
 * hours of fuel left (at least 1, even when the hit used up the last hour), with a blast increment in 5-ft. squares.
 */
export async function rollFuelExplosion(actor) {
  const s = actor.system,
    plan = explosionPlan({ size: objectSize(actor), fuel: s.fuel?.fuel ?? "", remainingHours: s.fuel?.remaining ?? 0 });
  if (!plan.explodes)
    return ChatMessage.create({
      speaker: speakerFor(actor),
      content: `<strong>${esc(actor.name)}</strong> ${loc`— no fuel explosion. ${esc(plan.reason)}`}`
    });
  const roll = await new Roll(plan.formula).evaluate();
  return roll.toMessage({
    speaker: speakerFor(actor),
    flavor: `<strong>${esc(actor.name)}</strong> ${loc`— fuel explosion (Table ${VEHICLE_RULES.explosions.table}, p.${plan.page}): ${plan.dice} explosive fire × ${plan.multiplier} hour${plan.multiplier === 1 ? "" : "s"} of fuel, blast increment ${plan.blast} square${plan.blast === 1 ? "" : "s"}, AP ${plan.ap}.${plan.houseRule ? ` ${esc(plan.houseRule)}` : ""}`}`,
    flags: {
      spycraft2: { fuelExplosion: { uuid: actor.uuid, total: roll.total, blast: plan.blast, armorPiercing: plan.ap } }
    }
  });
}

/** A tyre's Damage save after a Traction result; a failure records one punctured tyre. Tracks save against half. */
export async function rollTyreSave(actor, options = {}) {
  let damage = options.damage;
  if (!Number.isSafeInteger(damage)) {
    const input = await ask(
      loc`${actor.name}: tyre Damage save`,
      `<label>${loc`Damage of the attack that hit the tyre`} <input name="damage" type="number" min="1" step="1" required autofocus /></label>`
    );
    if (!input) return null;
    damage = Number(input.damage);
  }
  if (!Number.isSafeInteger(damage) || damage < 1)
    return ui.notifications.warn(loc`Enter the whole number of damage points.`);
  const tracked = hasQuality(actor.system.qualitiesNow ?? actor.system.qualities, "TRK"),
    against = tracked ? Math.max(1, Math.floor(damage / 2)) : damage;
  const size = sizeCode(objectSize(actor)),
    bonus = tractionSaveBonus(size),
    dc = damageSaveDC(against);
  const houseRule = VEHICLE_RULES.tractionSaveBonusHouseRule?.[size];
  const roll = await new Roll("1d20 + @bonus", { bonus }).evaluate(),
    punctured = roll.total < dc;
  const message = await roll.toMessage({
    speaker: speakerFor(actor),
    flavor: `<strong>${esc(actor.name)}</strong> ${loc`— tyre Damage save, DC ${dc}${tracked ? loc` (tracks: half damage)` : ""} (bonus +${bonus}${houseRule ? loc`, house rule` : ""})`}<br>${punctured ? loc`Punctured: recorded on the vehicle.` : loc`The tyre holds.`}`
  });
  if (punctured && actor.isOwner)
    await actor.update({ "system.damage.traction": (actor.system.damage?.traction ?? 0) + 1 });
  return message;
}

/** Clear failed saves and Vehicle Damage results after repairs. */
export function repairVehicle(actor) {
  return actor.update({
    "system.failedSaves": 0,
    ...Object.fromEntries(VEHICLE_DAMAGE_COUNTERS.map(key => [`system.damage.${key}`, 0]))
  });
}

/* ---------------------------------------------------------------------- */
/*  Fuel                                                                   */
/* ---------------------------------------------------------------------- */

/** Record hours of travel (double above cruising speed) or combat/chase rounds (a minute each). */
export async function spendFuel(actor, { hours = null, rounds = 0, aboveCruising = false } = {}) {
  if (!actor.system.fuel) return ui.notifications.warn(loc`${actor.name} has no fuel range to track.`);
  if (hours === null && !rounds) {
    const input = await ask(
      loc`${actor.name}: fuel used`,
      `
      <label>${loc`Hours of travel`} <input name="hours" type="number" min="0" step="any" value="1" /></label>
      <label><input name="aboveCruising" type="checkbox"${actor.system.aboveCruising ? " checked" : ""} /> ${loc`Above cruising speed (uses fuel twice as fast)`}</label>
      <label>${loc`Combat or chase rounds (a minute each)`} <input name="rounds" type="number" min="0" step="1" value="0" /></label>`
    );
    if (!input) return null;
    ({ hours, rounds, aboveCruising } = {
      hours: Number(input.hours) || 0,
      rounds: Number(input.rounds) || 0,
      aboveCruising: input.aboveCruising === true
    });
  }
  const used = travelFuel(hours ?? 0, { aboveCruising }) + Math.max(0, rounds) / 60;
  if (!used) return null;
  await actor.update({ "system.fuelUsed": Math.round(((actor.system.fuelUsed ?? 0) + used) * 1000) / 1000 });
  const left = actor.system.fuel;
  if (left?.empty)
    await ChatMessage.create({
      speaker: speakerFor(actor),
      content: `<strong>${esc(actor.name)}</strong> ${loc`is out of fuel.${actor.system.vehicleClass && ["PSA", "PFA", "SVA", "RWA"].includes(actor.system.vehicleClass) && actor.system.moving ? loc` A moving aircraft out of fuel needs a Maneuver check to land (p.291).` : ""}`}`
    });
  return used;
}

export const refuel = actor => actor.update({ "system.fuelUsed": 0, "system.damage.fuelHours": 0 });

/* ---------------------------------------------------------------------- */
/*  Occupants and crew                                                     */
/* ---------------------------------------------------------------------- */

/** Put a character aboard: at the controls when nobody drives, otherwise as crew or passenger. */
export async function boardVehicle(actor, character, { role = null } = {}) {
  if (!character?.uuid || character.type === "vehicle") return null;
  const s = actor.system,
    aboard = s.occupants.some(o => o.uuid === character.uuid) || s.driver === character.uuid;
  if (aboard) return ui.notifications.info(loc`${character.name} is already aboard.`);
  // A mount whose statistics say "NPC" takes the dropped NPC as its animal when none is linked yet.
  if (!role && character.type === "npc" && s.vehicleClass === "M/AD" && !s.mountNpc && s.defenseSave === "NPC")
    return actor.update({ "system.mountNpc": character.uuid });
  if (!role && !s.driver) return actor.update({ "system.driver": character.uuid });
  const crewSlots = Math.max(0, (s.crew ?? 0) - 1),
    crewAboard = s.occupants.filter(o => o.role === "crew").length;
  const finalRole = role ?? (crewAboard < crewSlots ? "crew" : "passenger");
  return actor.update({ "system.occupants": [...s.occupants, { uuid: character.uuid, role: finalRole }] });
}

export const leaveVehicle = (actor, index) =>
  actor.update({ "system.occupants": actor.system.occupants.filter((_, i) => i !== index) });
export const setOccupantRole = (actor, index, role) =>
  actor.update({ "system.occupants": actor.system.occupants.map((o, i) => (i === index ? { ...o, role } : o)) });

/** Reflex save to bail out (DC 15, ejection seats +6 for crew): rolled by the occupant, reported with the DC. */
export async function bailOutOf(actor, uuid) {
  const occupant = fromUuidSync(uuid);
  if (!occupant) return ui.notifications.warn(loc`That occupant no longer exists.`);
  if (!occupant.isOwner) return ui.notifications.warn(loc`Only ${occupant.name}'s owner or the GC can roll this save.`);
  const role =
    uuid === actor.system.driver ? "crew" : (actor.system.occupants.find(o => o.uuid === uuid)?.role ?? "passenger");
  const plan = bailOut(actor.system, { role });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: occupant }),
    content: `<strong>${esc(occupant.name)}</strong> ${loc`bails out of ${esc(actor.name)}: Reflex save DC ${plan.dc}${plan.bonus ? loc`, +${plan.bonus} from the ejection seat` : ""}. Pass or fail, it uses the next bonus 5-ft. step.`}`
  });
  return occupant.rollSave?.("ref", { askContext: true });
}

/** The skeleton crew that comes with the vehicle, from how it was acquired (p.289). */
export function skeletonCrewFor(actor, teamSize) {
  const s = actor.system;
  if (!s.acquiredAs) return null;
  return skeletonCrew(s.crew ?? 0, { source: s.acquiredAs, teamSize: Math.max(1, teamSize || 0) });
}

/* ---------------------------------------------------------------------- */
/*  Control checks                                                         */
/* ---------------------------------------------------------------------- */

/** The driver makes a Maneuver check with the vehicle's skill, Drive focus, untrained penalty and error increases. */
export async function rollControlCheck(actor, { modifier = null, topMphBonus = false } = {}) {
  const driver = actor.system.driver ? fromUuidSync(actor.system.driver) : null;
  if (!driver) return ui.notifications.warn(loc`Drop a character on the vehicle sheet to set the driver first.`);
  if (!driver.isOwner) return ui.notifications.warn(loc`Only ${driver.name}'s owner or the GC can roll this check.`);
  if (typeof driver.rollSkill !== "function")
    return ui.notifications.warn(loc`${driver.name} cannot make skill checks here.`);
  const hazards = actor.system.hazardEffect ?? null;
  const plan = controlCheckPlan(actor.system, driver.system, { hazards });
  if (plan.blocked) return ui.notifications.warn(plan.blocked);
  const hazardNote = hazards?.rows?.length ? actor.system.hazardSummary : "";
  if (modifier === null) {
    const input = await ask(
      loc`${actor.name}: control check (${plan.skillName}/Maneuver)`,
      `
      <p>${esc(plan.note)}</p>${hazardNote ? `<p>${esc(hazardNote)}</p>` : ""}
      <label>${loc`Other modifier (Strategy, situation)`} <input name="modifier" type="number" step="1" value="0" /></label>
      <label><input name="topMphBonus" type="checkbox" /> ${loc`Chase: this vehicle has the fastest top MPH (Maneuvering Room bonus)`}</label>
      <label>${loc`Chase Maneuvering Room`} <select name="room"><option value="0">—</option><option value="6">${loc`Open +6`}</option><option value="4">${loc`Close +4`}</option><option value="2">${loc`Crowded +2`}</option><option value="0">${loc`Tight +0`}</option></select></label>`
    );
    if (!input) return null;
    modifier = (Number(input.modifier) || 0) + (input.topMphBonus ? Number(input.room) || 0 : 0);
    topMphBonus = !!input.topMphBonus;
  }
  return driver.rollSkill(plan.skillKey, null, {
    check: "maneuver",
    modifier: (plan.penalty || 0) + modifier,
    focus: plan.focus,
    gearStatus: "available",
    synergySkill: "auto",
    vehicleErrorIncrease: plan.errorIncrease,
    vehicleControl: {
      vehicleUuid: actor.uuid,
      note: `${plan.note}${hazardNote ? ` ${hazardNote}` : ""}${topMphBonus ? loc` Fastest vehicle in the chase.` : ""}`
    }
  });
}

/* ---------------------------------------------------------------------- */
/*  Mounted weapons                                                        */
/* ---------------------------------------------------------------------- */

/** A gunner fires one of the vehicle's mounted weapons: they get a vehicle-mounted copy to attack with. */
export async function fireMountedWeapon(actor, itemId, gunnerUuid = null) {
  const weapon = actor.items.get(itemId);
  if (!weapon || weapon.type !== "weapon")
    return ui.notifications.warn(loc`That is not a weapon installed on this vehicle.`);
  const aboard = occupantsOf(actor);
  let gunner = gunnerUuid ? fromUuidSync(gunnerUuid) : aboard.length === 1 ? aboard[0] : null;
  if (!gunner) {
    if (!aboard.length) return ui.notifications.warn(loc`Nobody is aboard to fire this weapon.`);
    const input = await ask(
      loc`${weapon.name}: gunner`,
      `<label>${loc`Gunner`} <select name="gunner">${aboard.map(a => `<option value="${a.uuid}">${esc(a.name)}</option>`).join("")}</select></label>`
    );
    if (!input) return null;
    gunner = fromUuidSync(input.gunner);
  }
  if (!gunner?.isOwner) return ui.notifications.warn(loc`Only the gunner's owner or the GC can fire this weapon.`);
  let copy = gunner.items.find(i => i.getFlag("spycraft2", "mountedOn")?.itemUuid === weapon.uuid);
  if (!copy) {
    const data = weapon.toObject();
    delete data._id;
    Object.assign(data.system, { pick: "", carried: false, equipped: true });
    foundry.utils.setProperty(data, "flags.spycraft2.mountedOn", { vehicleUuid: actor.uuid, itemUuid: weapon.uuid });
    [copy] = await gunner.createEmbeddedDocuments("Item", [data]);
  }
  return gunner.rollAttack(copy, { vehicleMounted: true });
}

/* ---------------------------------------------------------------------- */
/*  Combat: driver's initiative and fuel per round                         */
/* ---------------------------------------------------------------------- */

/** The initiative a vehicle combatant should share: its driver's, when the driver is in the same combat. */
export function driverInitiative(combat, vehicleCombatant) {
  const driverUuid = vehicleCombatant?.actor?.system?.driver;
  if (!driverUuid) return null;
  const driver = combat.combatants.find(c => c.actor?.uuid === driverUuid && c !== vehicleCombatant);
  return Number.isFinite(driver?.initiative) ? driver.initiative : null;
}

/**
 * Vehicles act on their driver's Initiative Count (p.289): a vehicle combatant copies its driver's result whenever
 * either is rolled. Each combat round uses a minute of fuel for every moving vehicle in the fight (p.225).
 */
export function installVehicleCombatHooks(hooks = globalThis.Hooks) {
  if (!hooks?.on) return;
  hooks.on("updateCombatant", async (combatant, changes) => {
    if (!game.user.isGM || !("initiative" in changes)) return;
    const combat = combatant.combat;
    if (combatant.actor?.type === "vehicle") {
      const shared = driverInitiative(combat, combatant);
      if (shared !== null && shared !== combatant.initiative) await combatant.update({ initiative: shared });
      return;
    }
    for (const other of combat.combatants) {
      if (
        other.actor?.type === "vehicle" &&
        other.actor.system.driver === combatant.actor?.uuid &&
        other.initiative !== combatant.initiative
      )
        await other.update({ initiative: combatant.initiative });
    }
  });
  hooks.on("updateCombat", async (combat, changes) => {
    if (!game.user.isGM || !("round" in changes) || !(changes.round > 1)) return;
    for (const c of combat.combatants) {
      const vehicle = c.actor;
      if (vehicle?.type !== "vehicle" || !vehicle.system.moving) continue;
      if (vehicle.system.fuel) await spendFuel(vehicle, { hours: 0, rounds: 1 });
      // Broken ground damages an off-road or tracked vehicle each round it goes faster than half its cruising speed (Table 4.76).
      if (vehicle.system.hazardEffect?.damagePerRound)
        await ChatMessage.create({
          speaker: speakerFor(vehicle),
          whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id),
          content: `<strong>${esc(vehicle.name)}</strong>${loc`: if it is going faster than half its cruising MPH over this ground, roll one Vehicle Damage result this round.`}`
        });
    }
  });
}
installVehicleCombatHooks();

/* ---------------------------------------------------------------------- */
/*  Placing and loading vehicles                                           */
/* ---------------------------------------------------------------------- */

/** Create a vehicle Actor carrying a vehicle pick's statistics, so it can have a token. */
export async function deployVehicle(item) {
  if (item.type !== "vehicle") return null;
  if (!game.user.can("ACTOR_CREATE"))
    return ui.notifications.warn(loc`You do not have permission to create actors; ask the GC to place this vehicle.`);
  const actor = await Actor.implementation.create({
    name: item.name,
    type: "vehicle",
    img: item.img,
    system: {
      ...vehicleStats(item.system),
      sourceItem: item.uuid,
      driver: item.parent?.uuid ?? "",
      acquiredAs: item.system.pick ? "mission" : item.system.possessionSource ? "possession" : ""
    },
    ownership: item.parent ? foundry.utils.deepClone(item.parent.ownership) : undefined
  });
  actor?.sheet.render(true);
  return actor;
}

/** Copy a vehicle pick's statistics onto an existing vehicle Actor, leaving its recorded damage alone. */
export function loadVehicleStats(actor, item) {
  if (item.type !== "vehicle") return null;
  const stats = vehicleStats(item.system);
  return actor.update({
    name: item.name,
    img: item.img,
    "system.sourceItem": item.uuid,
    ...Object.fromEntries(VEHICLE_STAT_KEYS.filter(key => key in stats).map(key => [`system.${key}`, stats[key]]))
  });
}
