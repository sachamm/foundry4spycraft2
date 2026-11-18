import { finesseWeaponPlan } from "./finesse.mjs";
import { weaponGrip, weaponUnavailable } from "./gear.mjs";
import { cqbRangedWeapon } from "./cqb.mjs";
import { loc } from "../i18n.mjs";
/** Gear represents a physically held/readied personal weapon with equipped+carried flags.
 * Ammunition and proficiency are not prerequisites for merely holding the weapon.
 */
export function readiedRangedWeapons(system, items = []) {
  const ready = [];
  for (const item of items) {
    const w = { ...item.system, name: item.name },
      id = item.id ?? item._id;
    if (
      item.type !== "weapon" ||
      typeof id !== "string" ||
      !id ||
      w.equipped !== true ||
      w.carried === false ||
      !Number.isSafeInteger(w.quantity ?? 1) ||
      (w.quantity ?? 1) < 1 ||
      !cqbRangedWeapon(w) ||
      weaponUnavailable(w)
    )
      continue;
    const grip = weaponGrip(system, w);
    if (grip.blocked || ![1, 2].includes(grip.required) || ![1, 2].includes(grip.hands)) continue;
    ready.push({
      id,
      uuid: item.uuid ?? null,
      name: item.name,
      proficiency: w.proficiency,
      hands: grip.hands,
      requiredHands: grip.required
    });
  }
  return ready.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Explicitly reviewed family, never guessed from an editable display name.
 * Only a physically held/readied, usable melee weapon can supply these benefits.
 * A held throwing axe can still be a readied axe; attack proficiency alone does not define its family.
 */
export const MELEE_SKILL_FAMILIES = [
  "axe",
  "spear",
  "whip",
  "staff",
  "hammer",
  "twoHandedSword",
  "oneHandedSword",
  "polearm",
  "flail",
  "knife",
  "club"
];
const familyProficiencies = {
  club: ["blunt", "exoticBlunt"],
  knife: ["edged", "exoticEdged", "hurled", "exoticHurled"],
  flail: ["exoticBlunt"],
  polearm: ["exoticEdged"],
  axe: ["edged", "exoticEdged", "hurled", "exoticHurled"],
  spear: ["edged", "exoticEdged", "hurled", "exoticHurled"],
  whip: ["exoticBlunt"],
  staff: ["blunt", "exoticBlunt"],
  hammer: ["blunt", "exoticBlunt", "hurled", "exoticHurled"],
  twoHandedSword: ["edged", "exoticEdged"],
  oneHandedSword: ["edged", "exoticEdged"]
};
export const meleeFamilyProficiency = (family, proficiency) =>
  familyProficiencies[family]?.includes(proficiency) === true;
export function readiedMeleeWeapons(system, items = []) {
  const ready = [];
  for (const item of items) {
    const w = { ...item.system, name: item.name },
      id = item.id ?? item._id;
    if (
      item.type !== "weapon" ||
      typeof id !== "string" ||
      !id ||
      !MELEE_SKILL_FAMILIES.includes(w.meleeFamily) ||
      !meleeFamilyProficiency(w.meleeFamily, w.proficiency) ||
      w.equipped !== true ||
      w.carried === false ||
      !Number.isSafeInteger(w.quantity ?? 1) ||
      (w.quantity ?? 1) < 1 ||
      weaponUnavailable(w)
    )
      continue;
    const grip = weaponGrip(system, w);
    if (
      grip.blocked ||
      ![1, 2].includes(grip.required) ||
      ![1, 2].includes(grip.hands) ||
      (w.meleeFamily === "twoHandedSword" && grip.required !== 2) ||
      (w.meleeFamily === "oneHandedSword" && grip.required !== 1)
    )
      continue;
    ready.push({
      id,
      uuid: item.uuid ?? null,
      name: item.name,
      family: w.meleeFamily,
      proficiency: w.proficiency,
      hands: grip.hands,
      requiredHands: grip.required,
      ...(w.meleeFamily === "oneHandedSword"
        ? { finesse: /\bFIN\b/.test(finesseWeaponPlan(system, w).effectiveQualities) }
        : {})
    });
  }
  return ready.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Shared immutable source for a qualified feat requiring a physically readied family. */
export function readiedMeleeFeatSource(system, { name, family, bonus }) {
  const names = system.activeFeatNames ?? [],
    weapons = system.readiedMeleeWeapons ?? [];
  if (!Array.isArray(names) || names.some(n => typeof n !== "string") || !Array.isArray(weapons))
    throw Error(loc`Review the current qualified melee feats and readied weapon families.`);
  if (!names.includes(name)) return null;
  const held = weapons.filter(w => w?.family === family);
  if (
    held.some(
      w =>
        typeof w.id !== "string" ||
        !w.id ||
        typeof w.name !== "string" ||
        !meleeFamilyProficiency(family, w.proficiency) ||
        ![1, 2].includes(w.hands) ||
        ![1, 2].includes(w.requiredHands) ||
        (family === "twoHandedSword" && w.requiredHands !== 2) ||
        (family === "oneHandedSword" && (w.requiredHands !== 1 || w.finesse !== true))
    ) ||
    new Set(held.map(w => w.id)).size !== held.length
  )
    throw Error(loc`Review the actual held melee weapon identity and legal grip.`);
  if (held.length) {
    const ready = system.disarmWeapons;
    if (
      ready !== undefined &&
      (ready?.version !== 1 || !Array.isArray(ready.weapons) || typeof ready.blockedReason !== "string")
    )
      throw Error(loc`Review the actual physically held weapon capacity.`);
    if (ready?.blockedReason) throw Error(ready.blockedReason);
    const physical = ready?.weapons ?? weapons;
    if (
      physical.some(w => !w || typeof w.id !== "string" || !w.id || ![1, 2].includes(w.hands)) ||
      new Set(physical.map(w => w.id)).size !== physical.length ||
      physical.reduce((n, w) => n + w.hands, 0) > 2
    )
      throw Error(
        loc`Review which weapons are actually held: melee feat benefits require legal grips within two hands.`
      );
    if (
      ready &&
      held.some(
        w =>
          !physical.some(
            r =>
              r.id === w.id &&
              r.hands === w.hands &&
              (r.requiredHands === undefined || r.requiredHands === w.requiredHands) &&
              (r.proficiency === undefined || r.proficiency === w.proficiency)
          )
      )
    )
      throw Error(loc`The melee feat weapon is not physically held with its recorded grip.`);
  }
  return held.length
    ? {
        feat: name,
        family,
        bonus,
        weapons: held
          .map(w => ({
            id: w.id,
            uuid: w.uuid ?? null,
            name: w.name,
            proficiency: w.proficiency,
            hands: w.hands,
            requiredHands: w.requiredHands,
            ...(family === "oneHandedSword" ? { finesse: w.finesse } : {})
          }))
          .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      }
    : null;
}
