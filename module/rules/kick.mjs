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

/**
 * Kicking Moves, p.186: Back Flip (a Kick or unarmed Standard Attack; a hit lets the character move 5 ft. and gain
 * +1 dodge for a full round, a miss leaves them flat-footed), Guillotine Kick (a Kick at −4 with +1 threat range; a
 * hit forces a Fortitude save, DC 10 + damage, or the target reels) and Power Kick (a Kick with armor-piercing (2)
 * and takedown).
 */
export const KICK_TRICKS = Object.freeze({
  backFlip: Object.freeze({ name: "Back Flip", kickOnly: false, attack: 0, threat: 0 }),
  guillotine: Object.freeze({ name: "Guillotine Kick", kickOnly: true, attack: -4, threat: 1 }),
  powerKick: Object.freeze({ name: "Power Kick", kickOnly: true, attack: 0, threat: 0, qualities: "AP (2), TKD" })
});

export function kickTrickPlan(system, weapon, { trick = "", kick = false, attackAction = "standard" } = {}) {
  if (!trick) return null;
  const d = Object.hasOwn(KICK_TRICKS, trick) ? KICK_TRICKS[trick] : null;
  if (!d || !system?.activeFeatNames?.includes("Kicking Moves"))
    return { blocked: true, reason: loc`That trick needs Kicking Moves.` };
  if (!unarmedWeapon(weapon)) return { blocked: true, reason: loc`${d.name} is an unarmed attack.` };
  if (d.kickOnly ? kick !== true : kick !== true && attackAction !== "standard")
    return {
      blocked: true,
      reason: d.kickOnly
        ? loc`${d.name} is made with a Kick action.`
        : loc`${d.name} is made with a Kick or an unarmed Standard Attack.`
    };
  return { blocked: false, version: 1, key: trick, name: d.name, attackBonus: d.attack, threatIncrease: d.threat };
}

export function kickTrickNote(plan) {
  if (!plan || plan.blocked) return "";
  if (plan.key === "backFlip")
    return loc`Back Flip: on a hit, move 5 ft. and gain +1 dodge to Defense for 1 full round; on a miss you become flat-footed (p.186).`;
  if (plan.key === "guillotine")
    return loc`Guillotine Kick: −4 attack, threat range +1; on a hit the target makes a Fortitude save (DC 10 + damage) or is sent reeling (p.186).`;
  return loc`Power Kick: this Kick has armor-piercing (2) and takedown (p.186).`;
}

/** The weapon a Kick's damage roll sees: Power Kick adds its qualities. */
export function kickDamageWeapon(weapon, trick) {
  const q = KICK_TRICKS[trick]?.qualities;
  return q ? { ...weapon, qualities: [String(weapon.qualities ?? "").trim(), q].filter(Boolean).join(", ") } : weapon;
}

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
  dialog: ({ item, actor }) => [
    {
      at: 59,
      html: unarmedWeapon(item?.system)
        ? `<label><input type="checkbox" name="kick" /> ${loc`Kick: half-action unarmed attack, Strength modifier added to damage twice; lowers your Initiative Count by 2 unless you have Kicking Basics (p.358)`}</label>${
            actor?.system?.activeFeatNames?.includes("Kicking Moves")
              ? `<label>${loc`Kicking Moves trick`} <select name="kickTrick"><option value="">${loc`None`}</option>${Object.entries(
                  KICK_TRICKS
                )
                  .map(([key, d]) => `<option value="${key}">${d.name}</option>`)
                  .join("")}</select></label>`
              : ""
          }`
        : ""
    }
  ],
  read: ({ entered }) => ({
    ...(entered?.kick === true ? { kick: true, attackAction: "other" } : {}),
    ...(entered?.kickTrick ? { kickTrick: String(entered.kickTrick) } : {})
  })
});

rollPipeline.register({
  id: "kickAttackTerm",
  kinds: ["attack"],
  order: 9170,
  terms({ system, weapon, options, ranged }) {
    const plan = kickPlan(system, weapon, { kick: options.kick === true }),
      trick = kickTrickPlan(system, weapon, {
        trick: options.kickTrick ?? "",
        kick: options.kick === true,
        attackAction: options.attackAction ?? "standard"
      }),
      shifting = shiftingStanceNote(system, weapon, ranged),
      blocked = [plan, trick].find(p => p?.blocked);
    const kick = plan && !plan.blocked ? plan : null;
    return [
      { key: "kickTrick", plan: trick && !trick.blocked ? trick : null },
      {
        key: "kick",
        plan: kick,
        rowAt: 286,
        rows: trick?.attackBonus ? [[trick.name, trick.attackBonus]] : [],
        threat: trick && !trick.blocked ? trick.threatIncrease : 0,
        blockAt: 197,
        blocked: blocked?.reason ?? "",
        noteAt: 498,
        notes: [
          ...(kick ? kick.notes : []),
          ...(trick && !trick.blocked ? [kickTrickNote(trick)] : []),
          ...(shifting ? [shifting] : [])
        ]
      }
    ];
  }
});
