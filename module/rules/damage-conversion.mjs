/**
 * Damage conversion (p.345): an unarmed, melee or hurled attack may deal subdual damage instead of lethal, or
 * lethal instead of subdual, at −4 to the attack check.
 *
 * Bludgeon (p.193) removes the penalty for any such attack. Club Basics (p.177) removes it while the attack is made
 * with the character's actual readied club.
 */
import { readiedMeleeFeatSource } from "./readied-weapons.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

export const DAMAGE_CONVERSION_PENALTY = -4;

const MELEE = ["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged"],
  HURLED = ["hurled", "exoticHurled"];

/** Whether this weapon's attacks may convert their damage type at all. */
export function conversionEligible(weapon = {}) {
  return MELEE.includes(weapon.proficiency) || HURLED.includes(weapon.proficiency);
}

/** The weapon's own damage type, read from its damage entry ("1d4 subdual" and the like). */
export function normalDamageType(weapon = {}) {
  return /\bsubdual\b/i.test(String(weapon.damage ?? "")) ? "subdual" : "lethal";
}

/** The Club Basics waiver: the attacking weapon is one of the readied reviewed clubs the feat recognises. */
function readiedClubWaiver(system, sourceWeapon) {
  let source = null;
  try {
    source = readiedMeleeFeatSource(system, { name: "Club Basics", family: "club", bonus: 0 });
  } catch {
    return null;
  }
  const id = sourceWeapon?.id ?? sourceWeapon?._id;
  return source?.weapons.some(w => w.id === id) ? "Club Basics" : null;
}

/**
 * The declared conversion as part of an attack plan, or null when none was declared.
 * @param {object} system         the attacker's prepared system data
 * @param {object} weapon         the attacking weapon's system data (proficiency, damage)
 * @param {object} sourceWeapon   the attacking weapon with its id
 * @param {object} options        { convert: boolean }
 */
export function damageConversionPlan(system, weapon, sourceWeapon, { convert = false } = {}) {
  if (convert !== true) return null;
  if (!conversionEligible(weapon))
    return {
      blocked: true,
      reason: loc`Only unarmed, melee and hurled attacks can convert their damage type (p.345).`
    };
  const from = normalDamageType(weapon),
    to = from === "lethal" ? "subdual" : "lethal",
    names = system.activeFeatNames ?? [],
    waivedBy = names.includes("Bludgeon") ? "Bludgeon" : readiedClubWaiver(system, sourceWeapon);
  return {
    blocked: false,
    version: 1,
    from,
    to,
    attackPenalty: waivedBy ? 0 : DAMAGE_CONVERSION_PENALTY,
    waivedBy
  };
}

export function damageConversionNote(plan) {
  if (!plan || plan.blocked) return "";
  const what =
    plan.to === "subdual"
      ? loc`This hit deals subdual damage instead of lethal`
      : loc`This hit deals lethal damage instead of subdual`;
  return plan.waivedBy
    ? loc`${what}; ${plan.waivedBy} removes the −4 conversion penalty (p.345).`
    : loc`${what}, at −4 to the attack (p.345).`;
}

function conversionContent(item, { hurledOnly = false } = {}) {
  const w = item?.system ?? {};
  if (!conversionEligible(w) || (hurledOnly && !HURLED.includes(w.proficiency))) return "";
  const label =
    normalDamageType(w) === "lethal"
      ? loc`Deal subdual damage instead of lethal (−4 attack unless a feat removes it; p.345)`
      : loc`Deal lethal damage instead of subdual (−4 attack unless a feat removes it; p.345)`;
  return `<label><input type="checkbox" name="damageConversion" /> ${label}</label>`;
}

const read = ({ entered }, input) => {
  const value = (entered ?? input)?.damageConversion;
  return value === true || value === "on" || value === "true" ? { damageConversion: true } : null;
};

rollPipeline.register({
  id: "damageConversionContent:attack",
  dialogs: ["attack"],
  order: 66,
  dialog: ({ item }) => [{ at: 56, html: conversionContent(item) }],
  read
});
rollPipeline.register({
  id: "damageConversionContent:rangedAttack",
  dialogs: ["rangedAttack"],
  order: 9741,
  dialog: ({ item }) => [{ at: 176, html: conversionContent(item, { hurledOnly: true }) }],
  read
});

// The declared conversion as a term of the attack plan.
rollPipeline.register({
  id: "damageConversionAttackTerm",
  kinds: ["attack"],
  order: 9150,
  terms({ system, weapon, sourceWeapon, options }) {
    const plan = damageConversionPlan(system, weapon, sourceWeapon, { convert: options.damageConversion === true });
    return {
      key: "damageConversion",
      plan: plan && !plan.blocked ? plan : null,
      rowAt: 245,
      rows: plan && !plan.blocked ? [[loc`Damage conversion`, plan.attackPenalty]] : [],
      blockAt: 196,
      blocked: plan?.blocked ? plan.reason : "",
      noteAt: 496,
      notes: plan && !plan.blocked ? [damageConversionNote(plan)] : []
    };
  }
});
