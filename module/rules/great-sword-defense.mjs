import { readiedMeleeFeatSource } from "./readied-weapons.mjs";
import { loc } from "../i18n.mjs";
import { stable } from "./equal.mjs";
/** Great Sword Basics p.179: gear +2 Defense only against melee attacks. */
export function greatSwordDefensePlan(system, { ranged = false } = {}) {
  if (typeof ranged !== "boolean") throw Error(loc`Declare whether the incoming attack is ranged.`);
  if (ranged) return { version: 1, ranged: true, source: null, listedBonus: 0, existingGearBonus: 0, increment: 0 };
  const source = readiedMeleeFeatSource(system, { name: "Great Sword Basics", family: "twoHandedSword", bonus: 2 });
  const entries = system.defenseBonusEntries === undefined ? [] : system.defenseBonusEntries;
  if (!Array.isArray(entries) || entries.some(e => !e || typeof e !== "object" || !Number.isFinite(e.value)))
    throw Error(loc`Prepare the current typed Defense bonuses before applying Great Sword Basics.`);
  const existingGearBonus = Math.max(0, ...entries.filter(e => e.type === "gear").map(e => e.value));
  return {
    version: 1,
    ranged: false,
    source,
    listedBonus: source ? 2 : 0,
    existingGearBonus,
    increment: source ? Math.max(0, 2 - existingGearBonus) : 0
  };
}
export function validateGreatSwordDefenseProof(system, proof, { ranged = false } = {}) {
  if (!proof) return;
  if (stable(greatSwordDefensePlan(system, { ranged })) !== stable(proof))
    throw Error(
      loc`The readied two-handed sword, Great Sword Basics or typed Defense bonuses changed. Recheck this incoming attack.`
    );
}
