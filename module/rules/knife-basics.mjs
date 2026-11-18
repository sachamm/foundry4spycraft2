import { combatStanceState } from "./combat-stance.mjs";
import { weaponUnavailable } from "./gear.mjs";
import { meleeFamilyProficiency } from "./readied-weapons.mjs";
import { loc } from "../i18n.mjs";
/**
 * Knife Basics, p.179.
 *
 * Drawing a knife is a free action and any knife on the character's person is
 * always considered readied. "Considered readied" is distinct from physically
 * holding the knife: it occupies no hand, supplies no "holding a readied
 * weapon" benefit and never spends Quick Draw's separate two-use pool.
 */
export function knifeBasicsPlan(system, items = []) {
  const active = (system.activeFeatNames ?? []).includes("Knife Basics"),
    knives = [];
  if (active)
    for (const item of items) {
      const w = item.system ?? {},
        id = item.id ?? item._id;
      if (
        item.type !== "weapon" ||
        typeof id !== "string" ||
        !id ||
        w.meleeFamily !== "knife" ||
        !meleeFamilyProficiency("knife", w.proficiency) ||
        w.carried === false ||
        !Number.isSafeInteger(w.quantity ?? 1) ||
        (w.quantity ?? 1) < 1 ||
        weaponUnavailable({ ...w, name: item.name })
      )
        continue;
      knives.push({
        id,
        uuid: item.uuid ?? null,
        name: item.name ?? "",
        proficiency: w.proficiency,
        held: w.equipped === true,
        consideredReadied: true
      });
    }
  knives.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    version: 1,
    active,
    freeDraw: active,
    knives,
    notes: active
      ? [
          loc`Knife Basics: drawing a knife is a free action and any knife you carry counts as readied (p.179). This does not spend Quick Draw uses and does not place the knife in a hand; attacking still requires a free hand.`
        ]
      : []
  };
}

/**
 * Circling Stance, p.179: with at least 1 unoccupied square adjacent to the
 * attacker, the target's dodge bonus to Defense against the attacker's melee
 * attack decreases to 1/2 standard, rounded up.
 */
export function circlingDefensePlan({
  attackerSystem = null,
  ranged = false,
  unoccupiedAdjacentConfirmed = false,
  unarmedConfirmed = false,
  dodgeBonus = 0
} = {}) {
  if (!attackerSystem) return { active: false, dodgeReduction: 0 };
  // Shifting Stance (Kicking Basics, p.186): the same halving against the attacker's unarmed attacks.
  if (combatStanceState(attackerSystem)?.key === "shifting") {
    if (ranged) throw Error(loc`Shifting Stance applies only to the attacker’s unarmed attacks.`);
    if (!Number.isFinite(dodgeBonus))
      throw Error(loc`Prepare the target’s dodge bonus to Defense before applying Shifting Stance.`);
    const original = Math.max(0, dodgeBonus),
      retained = unarmedConfirmed === true ? Math.ceil(original / 2) : original;
    return {
      version: 1,
      shifting: true,
      active: retained < original,
      stance: true,
      unarmedConfirmed: unarmedConfirmed === true,
      originalDodgeBonus: original,
      retainedDodgeBonus: retained,
      dodgeReduction: original - retained
    };
  }
  if (typeof ranged !== "boolean" || typeof unoccupiedAdjacentConfirmed !== "boolean")
    throw Error(
      loc`Declare whether this is a ranged attack and whether a square adjacent to the Circling Stance attacker is unoccupied.`
    );
  if (combatStanceState(attackerSystem)?.key !== "circling")
    throw Error(loc`The selected attacker is not in Circling Stance.`);
  if (ranged) throw Error(loc`Circling Stance applies only to the attacker’s melee attacks.`);
  if (!Number.isFinite(dodgeBonus))
    throw Error(loc`Prepare the target’s dodge bonus to Defense before applying Circling Stance.`);
  if (!unoccupiedAdjacentConfirmed || dodgeBonus <= 0)
    return {
      version: 1,
      active: false,
      stance: true,
      unoccupiedAdjacentConfirmed,
      originalDodgeBonus: Math.max(0, dodgeBonus),
      retainedDodgeBonus: Math.max(0, dodgeBonus),
      dodgeReduction: 0
    };
  const retainedDodgeBonus = Math.ceil(dodgeBonus / 2);
  return {
    version: 1,
    active: true,
    stance: true,
    unoccupiedAdjacentConfirmed: true,
    originalDodgeBonus: dodgeBonus,
    retainedDodgeBonus,
    dodgeReduction: dodgeBonus - retainedDodgeBonus
  };
}
