/**
 * Sword Basics, p.180.
 *
 * - After a hit with a one-handed sword without the finesse quality, the character may move at once to the square
 *   on the opposite side of that opponent if it is unoccupied. Token movement stays at the table: the attack card
 *   carries the reminder.
 * - Unbeatable Stance: +1 morale bonus to attack checks against an opponent already damaged by one of the
 *   character's melee weapons during this combat. The player declares it and the GC confirms it.
 * - Impale (module/rules/melee-tricks.mjs): a Standard Attack with such a sword deals +1 damage per 2 points by
 *   which the attack result beats the target's Defense, using the Defense the GC confirms when damage is rolled.
 * - While any weapon the character wields has the finesse quality, none of these benefits applies.
 */
import { combatStanceState } from "./combat-stance.mjs";
import { finesseWeaponPlan } from "./finesse.mjs";
import { weaponUnavailable } from "./weapon-use.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

export const SWORD_BASICS = "Sword Basics";

/** Whether the feat's benefits apply now, and the wielded finesse weapons that switch them off. */
export function swordBasicsPlan(system, items = []) {
  const earned = (system.activeFeatNames ?? []).includes(SWORD_BASICS),
    finesseWeapons = [];
  if (earned)
    for (const item of items) {
      const w = item.system ?? {};
      if (
        item.type !== "weapon" ||
        w.equipped !== true ||
        w.carried === false ||
        !Number.isSafeInteger(w.quantity ?? 1) ||
        (w.quantity ?? 1) < 1 ||
        weaponUnavailable({ ...w, name: item.name })
      )
        continue;
      if (/\bFIN\b/.test(finesseWeaponPlan(system, w).effectiveQualities)) finesseWeapons.push(item.name ?? "");
    }
  return {
    version: 1,
    earned,
    active: earned && !finesseWeapons.length,
    finesseWeapons: finesseWeapons.sort()
  };
}

export const swordBasicsActive = system => system.swordBasics?.active === true;

/** The reason Sword Basics is switched off, for a blocked declaration. */
export function swordBasicsInactiveReason(system) {
  const p = system.swordBasics;
  if (!p?.earned) return loc`Sword Basics has not been earned.`;
  return loc`Sword Basics is lost while you wield a weapon with the finesse quality (${p.finesseWeapons.join(", ")}) (p.180).`;
}

/** Impale: +1 damage per 2 points by which the attack result beats the GC-confirmed Defense. */
export function impaleDamageBonus(attackResult, defense) {
  if (!Number.isSafeInteger(attackResult)) throw Error(loc`Impale needs the recorded attack result.`);
  if (!Number.isSafeInteger(defense) || defense < 0)
    throw Error(loc`Enter the target’s whole-number Defense against the Impale attack.`);
  if (defense > attackResult) throw Error(loc`That Defense is higher than the attack result, so this was not a hit.`);
  return Math.floor((attackResult - defense) / 2);
}

/** A one-handed sword without the finesse quality, as the feat's own trick and move require. */
function plainOneHandedSword(system, weapon) {
  return (
    weapon?.meleeFamily === "oneHandedSword" &&
    !/\bFIN\b/.test(finesseWeaponPlan(system, weapon).effectiveQualities ?? "")
  );
}

export function unbeatableStancePlan(system, { ranged = false, targetDamaged = false } = {}) {
  if (ranged || combatStanceState(system)?.key !== "unbeatable" || !swordBasicsActive(system)) return null;
  return targetDamaged === true ? { version: 1, attackBonus: 1 } : { version: 1, attackBonus: 0 };
}

// The attack dialog asks the question only while the character is in the stance.
rollPipeline.register({
  id: "unbeatableStanceContent:attack",
  dialogs: ["attack"],
  order: 67,
  dialog: ({ actor }) => [
    {
      at: 57,
      html:
        combatStanceState(actor?.system ?? {})?.key === "unbeatable" && swordBasicsActive(actor.system)
          ? `<label><input type="checkbox" name="unbeatableTargetDamaged" /> ${loc`Unbeatable Stance: one of my melee weapons has already damaged this opponent during this combat (GC confirms; +1 morale)`}</label>`
          : ""
    }
  ],
  read: ({ entered }) => (entered?.unbeatableTargetDamaged === true ? { unbeatableTargetDamaged: true } : null)
});

rollPipeline.register({
  id: "swordBasicsAttackTerm",
  kinds: ["attack"],
  order: 9160,
  terms({ system, weapon, options, ranged }) {
    const stance = unbeatableStancePlan(system, { ranged, targetDamaged: options.unbeatableTargetDamaged === true }),
      move = !ranged && swordBasicsActive(system) && plainOneHandedSword(system, weapon);
    return {
      key: "unbeatableStance",
      plan: stance?.attackBonus ? stance : null,
      rowAt: 285,
      rows: stance?.attackBonus ? [[loc`Unbeatable Stance (morale)`, stance.attackBonus]] : [],
      noteAt: 497,
      notes: [
        ...(stance?.attackBonus
          ? [
              loc`Unbeatable Stance: +1 morale against an opponent your melee weapons have already damaged this combat (p.180).`
            ]
          : []),
        ...(move
          ? [
              loc`Sword Basics: after a hit you may move at once to the square on the opposite side of this opponent, if it is unoccupied (p.180).`
            ]
          : [])
      ]
    };
  }
});
