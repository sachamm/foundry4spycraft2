/**
 * Attacks underwater (p.349). Skill checks and Reflex saves take the same penalty in module/rules/environment.mjs.
 *
 *   unarmed     no penalty
 *   melee       –4 (–2 with 5+ Athletics ranks); error range +2; Strength-based damage is halved, rounded up
 *   explosives  the same penalty; error range +2 to set one; its blast increment doubles
 *   anything    else needs gear made for underwater use, and then takes the penalty
 *
 * The Aquatic quality (p.446) removes the penalty.
 */
import { rollPipeline } from "./roll-pipeline.mjs";
import { hasAquaticQuality } from "./environment.mjs";
import { loc } from "../i18n.mjs";

const MELEE = ["blunt", "exoticBlunt", "edged", "exoticEdged"];

/** p.349: halve the standard damage of a melee weapon that applies Strength, before separate bonus dice. */
export function underwaterMeleeDamage(formula, proficiency, { underwater = false, usesStrength = true } = {}) {
  const halved = underwater === true && usesStrength && MELEE.includes(proficiency);
  return { formula: halved ? `ceil((${formula}) / 2)` : formula, halved };
}

/**
 * @param {object} system
 * @param {object} weapon  the weapon as used ({proficiency})
 * @param {object} options {underwater, underwaterGear}
 * @returns {object|null} null when the attack is not underwater
 */
export function underwaterAttackPlan(system, weapon, { underwater = false, underwaterGear = false } = {}) {
  if (underwater !== true) return null;
  const proficiency = weapon?.proficiency ?? "",
    aquatic = hasAquaticQuality(system),
    ranks = system?.skillTotals?.athletics?.ranks ?? 0,
    base = aquatic ? 0 : ranks >= 5 ? -2 : -4;
  if (proficiency === "unarmed")
    return { penalty: 0, error: 0, notes: [loc`Underwater: unarmed attacks take no penalty (p.349).`] };
  if (MELEE.includes(proficiency))
    return {
      penalty: base,
      error: 2,
      notes: [
        loc`Underwater melee: attack ${base}, error range +2; damage from a weapon that adds Strength is halved, rounded up (p.349).`
      ]
    };
  if (proficiency === "explosives")
    return {
      penalty: base,
      error: 2,
      notes: [loc`Underwater explosive: attack ${base}, error range +2 to set it; its blast increment doubles (p.349).`]
    };
  if (underwaterGear !== true)
    return {
      blocked: loc`Underwater, only unarmed, melee and explosive attacks can be made without gear built for it (p.349).`
    };
  return {
    penalty: base,
    error: 0,
    notes: [loc`Underwater, with gear built for it: attack ${base} (p.349).`]
  };
}

rollPipeline.register({
  id: "underwaterAttackContent",
  dialogs: ["attack", "rangedAttack"],
  order: 77,
  dialog: () => [
    {
      at: 67,
      html: `<details><summary>${loc`Underwater (p.349)`}</summary><label><input type="checkbox" name="underwater" /> ${loc`This attack is made underwater`}</label><label><input type="checkbox" name="underwaterGear" /> ${loc`The weapon is built to work underwater`}</label></details>`
    }
  ],
  read: ({ entered }) =>
    entered?.underwater === true ? { underwater: true, underwaterGear: entered.underwaterGear === true } : null
});

/** The attack term; exported so tests can run it alone. */
export const UNDERWATER_ATTACK_TERM = {
  id: "underwaterAttackTerm",
  kinds: ["attack"],
  order: 9196,
  terms({ system, weapon, options }) {
    const plan = underwaterAttackPlan(system, weapon, options ?? {});
    if (!plan) return null;
    if (plan.blocked) return { blockAt: 202, blocked: plan.blocked };
    return {
      key: "underwaterAttack",
      plan: { version: 1, penalty: plan.penalty, error: plan.error },
      rowAt: 291,
      rows: plan.penalty ? [[loc`Underwater`, plan.penalty]] : [],
      error: plan.error,
      noteAt: 503,
      notes: plan.notes
    };
  }
};
rollPipeline.register(UNDERWATER_ATTACK_TERM);
