import { weaponGrip, weaponUnavailable } from "./gear.mjs";
import { loc } from "../i18n.mjs";
import { stable } from "./equal.mjs";
/** Guard (GAR), p.301: actual appropriate proficiency and a physically held weapon.
 * Family labels and feat names do not create a weapon quality.
 */
export function readiedGuardWeapons(system, items = []) {
  const weapons = [],
    held = [];
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
      weaponUnavailable(w)
    )
      continue;
    const grip = weaponGrip(system, w);
    if (grip.blocked || ![1, 2].includes(grip.required) || ![1, 2].includes(grip.hands)) continue;
    held.push({ id, hands: grip.hands });
    if (
      (system.proficiencyTotals ?? system.proficiencies)?.[w.proficiency]?.proficient !== true ||
      !/\bGAR\b/.test(w.qualities ?? "")
    )
      continue;
    const matches = [...String(w.qualities).matchAll(/\bGAR\s*\(\s*\+?(\d+)\s*\)/g)],
      bonus = Number(matches[0]?.[1]);
    if (
      matches.length !== 1 ||
      String(w.qualities).match(/\bGAR\b/g).length !== 1 ||
      !Number.isSafeInteger(bonus) ||
      bonus < 0
    )
      return {
        version: 1,
        weapons: [],
        blockedReason: loc`Review the actual Guard (GAR) quality: record one nonnegative whole bonus for each readied weapon.`
      };
    weapons.push({
      id,
      uuid: item.uuid ?? null,
      name: item.name,
      proficiency: w.proficiency,
      trained: true,
      hands: grip.hands,
      requiredHands: grip.required,
      bonus
    });
  }
  if (
    weapons.length &&
    (held.reduce((n, w) => n + w.hands, 0) > 2 || new Set(held.map(w => w.id)).size !== held.length)
  )
    return {
      version: 1,
      weapons: [],
      blockedReason: loc`Review which weapons are actually held: Guard requires legal grips within the character’s two hands, not every equipped inventory entry.`
    };
  return { version: 1, weapons: weapons.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)), blockedReason: "" };
}
export function guardDefensePlan(system, { ranged = false } = {}) {
  if (typeof ranged !== "boolean")
    throw Error(loc`Declare whether the incoming attack is ranged before applying Guard.`);
  if (ranged) return { version: 1, ranged: true, weapons: [], bonus: 0 };
  const state = system.guardWeapons ?? { version: 1, weapons: [], blockedReason: "" };
  if (state.version !== 1 || typeof state.blockedReason !== "string" || state.blockedReason)
    throw Error(state.blockedReason || loc`Prepare the actual readied Guard weapons.`);
  if (
    !Array.isArray(state.weapons) ||
    state.weapons.length > 2 ||
    state.weapons.some(
      w =>
        !w ||
        typeof w.id !== "string" ||
        !w.id ||
        typeof w.name !== "string" ||
        typeof w.proficiency !== "string" ||
        !w.proficiency ||
        w.trained !== true ||
        ![1, 2].includes(w.hands) ||
        ![1, 2].includes(w.requiredHands) ||
        !Number.isSafeInteger(w.bonus) ||
        w.bonus < 0
    ) ||
    new Set(state.weapons.map(w => w.id)).size !== state.weapons.length ||
    state.weapons.reduce((n, w) => n + w.hands, 0) > 2
  )
    throw Error(loc`Review the current Guard weapon identity, proficiency, bonus and legal grip.`);
  const weapons = state.weapons.map(w => ({ ...w })).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    bonus = weapons.reduce((n, w) => n + w.bonus, 0);
  if (!Number.isSafeInteger(bonus)) throw Error(loc`Review the combined Guard weapon bonuses.`);
  return { version: 1, ranged: false, weapons, bonus };
}
export function validateGuardDefenseProof(system, proof, { ranged = false } = {}) {
  if (!proof) return;
  if (stable(guardDefensePlan(system, { ranged })) !== stable(proof))
    throw Error(loc`The readied Guard weapons, proficiency, quality or grip changed. Recheck this incoming attack.`);
}
