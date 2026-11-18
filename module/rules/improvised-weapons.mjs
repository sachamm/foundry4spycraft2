import { rollPipeline } from "./roll-pipeline.mjs";
import { gearCheckPlan } from "./gear-checks.mjs";
import { attributeActionBlock } from "./attributes.mjs";
import { restraintActionBlock } from "./restraints.mjs";
import { loc } from "../i18n.mjs";
/** Table5.12 p.347. A player may choose a listed weapon from this row or any lower row. */
export const IMPROVISED_WEAPON_ROWS = [
  { minimum: 1, weapons: ["light club", "knife"] },
  { minimum: 5, weapons: ["tool hammer", "hook"] },
  { minimum: 9, weapons: ["heavy club", "stiletto"] },
  { minimum: 13, weapons: ["machete", "pick"] },
  { minimum: 17, weapons: ["massive club", "light chainsaw"] }
];
export function improvisedWeaponOptions(result) {
  if (typeof result !== "number" || !Number.isSafeInteger(result))
    throw new Error(loc`Review the final whole-number Gear check result.`);
  return IMPROVISED_WEAPON_ROWS.filter(row => row.minimum <= result).flatMap(row => row.weapons);
}
/** A separate durable allowance for each combat prevents switching encounters from refreshing an old use. */
export function improvisedMasterySpec(system, combatId) {
  if (
    !system.activeFeatNames?.includes("Improvised Weapon Basics") ||
    !system.activeFeatNames.includes("Improvised Weapon Mastery") ||
    typeof combatId !== "string" ||
    !/^[A-Za-z0-9_-]{1,64}$/.test(combatId)
  )
    return null;
  return {
    id: "improvisedWeaponMastery_" + combatId,
    name: loc`Improvised Weapon Mastery (waive one search payment)`,
    period: "combat",
    limit: 1,
    cost: 0,
    workflow: "improvisedSearch",
    combatScoped: true,
    manualReviewable: true,
    hidden: true
  };
}
export function improvisedSearchPlan(
  system,
  { nonBarrenConfirmed = false, useMastery = false, combatId = "", atHome = false } = {}
) {
  const blocked = attributeActionBlock(system, { kind: "gear", ability: "wis" }) || restraintActionBlock(system);
  if (blocked) throw new Error(blocked);
  if (nonBarrenConfirmed !== true)
    throw new Error(loc`Confirm that this location is not barren before searching for an improvised weapon.`);
  if (!Number.isSafeInteger(system.gearCheck)) throw new Error(loc`Review the character’s Gear check bonus.`);
  if (typeof useMastery !== "boolean") throw new Error(loc`Choose whether to use the Mastery payment waiver.`);
  const gearCheckContext = gearCheckPlan(system, { atHome });
  const basics = system.activeFeatNames?.includes("Improvised Weapon Basics") === true,
    mastery = basics && system.activeFeatNames?.includes("Improvised Weapon Mastery") === true,
    bonus = gearCheckContext.bonus + (basics ? 3 : 0);
  if (useMastery && !improvisedMasterySpec(system, combatId))
    throw new Error(loc`The Mastery waiver requires an active feat and a participating combat.`);
  if (!Number.isSafeInteger(bonus)) throw new Error(loc`Review the improvised-weapon Gear check bonus.`);
  return {
    version: 3,
    nonBarrenConfirmed: true,
    baseGearBonus: system.gearCheck,
    homeGearBonus: gearCheckContext.personalStashBonus,
    gearCheckContext,
    basics,
    mastery,
    featBonus: basics ? 3 : 0,
    bonus,
    maximumSquares: mastery ? 1 : 4,
    baseCost: useMastery ? 0 : 1,
    useMastery,
    combatId: useMastery ? combatId : null,
    waiverId: useMastery ? improvisedMasterySpec(system, combatId).id : null,
    table: "Table5.12, p.347"
  };
}

// Recorded on the posted check as the roll was given them.
rollPipeline.register({ id: "improvisedWeaponsRecord", order: 9700, record: ["improvisedSearch"] });
