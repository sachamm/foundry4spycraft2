/**
 * The Kick action, p.358: a half-action unarmed attack (not a Standard Attack) against one opponent in Reach. The
 * character voluntarily lowers their Initiative Count by 2; a hit deals standard unarmed damage with a positive
 * Strength modifier applied twice. It can be taken with hands full or tied.
 *
 * Kicking Basics, p.186: the Kick costs no Initiative Count. Its Shifting Stance halves (rounded up) the dodge
 * bonus of the target of the character's unarmed attacks (module/rules/knife-basics.mjs, circlingDefensePlan), and
 * a threat or critical hit lets them move to the far side of the opponent.
 */
import { combatStanceState } from "./combat-stance.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

export const unarmedWeapon = weapon => weapon?.proficiency === "unarmed" || /\bNKL\b/.test(weapon?.qualities ?? "");
export const kickCountCost = system => (system?.activeFeatNames?.includes("Kicking Basics") ? 0 : 2);

export function kickPlan(system, weapon, { kick = false } = {}) {
  if (kick !== true) return null;
  if (!unarmedWeapon(weapon)) return { blocked: true, reason: loc`A Kick is an unarmed attack.` };
  const countCost = kickCountCost(system);
  return {
    blocked: false,
    version: 1,
    countCost,
    notes: [
      countCost
        ? loc`Kick: half action, not a Standard Attack; lower your Initiative Count by 2. A hit adds your Strength modifier to damage twice (p.358).`
        : loc`Kick: half action, not a Standard Attack; Kicking Basics spares the Initiative Count. A hit adds your Strength modifier to damage twice (pp.186,358).`
    ]
  };
}

/** The extra damage a Kick adds: a positive Strength modifier once more. */
export const kickDamageBonus = system => Math.max(0, system?.abilities?.str?.mod ?? 0);

/** Shifting Stance's reminder on an unarmed attack made in it. */
export function shiftingStanceNote(system, weapon, ranged) {
  return !ranged && unarmedWeapon(weapon) && combatStanceState(system)?.key === "shifting"
    ? loc`Shifting Stance: the target’s dodge bonus to Defense is halved, rounded up (select this attacker in the target’s Incoming attack preview). On a threat or critical hit you may move to the opposite side of the opponent, if that square is unoccupied (p.186).`
    : "";
}

rollPipeline.register({
  id: "kickContent:attack",
  dialogs: ["attack"],
  order: 69,
  dialog: ({ item }) => [
    {
      at: 59,
      html: unarmedWeapon(item?.system)
        ? `<label><input type="checkbox" name="kick" /> ${loc`Kick: half-action unarmed attack, Strength modifier added to damage twice; lowers your Initiative Count by 2 unless you have Kicking Basics (p.358)`}</label>`
        : ""
    }
  ],
  read: ({ entered }) => (entered?.kick === true ? { kick: true, attackAction: "other" } : null)
});

rollPipeline.register({
  id: "kickAttackTerm",
  kinds: ["attack"],
  order: 9170,
  terms({ system, weapon, options, ranged }) {
    const plan = kickPlan(system, weapon, { kick: options.kick === true }),
      shifting = shiftingStanceNote(system, weapon, ranged);
    return {
      key: "kick",
      plan: plan && !plan.blocked ? plan : null,
      blockAt: 197,
      blocked: plan?.blocked ? plan.reason : "",
      noteAt: 498,
      notes: [...(plan && !plan.blocked ? plan.notes : []), ...(shifting ? [shifting] : [])]
    };
  }
});
