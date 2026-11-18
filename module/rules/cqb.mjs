import { loc } from "../i18n.mjs";
const rangedProficiencies = new Set([
  "guided",
  "handgun",
  "hurled",
  "exoticHurled",
  "indirectFire",
  "rifle",
  "shotgun",
  "submachineGun",
  "tactical",
  "vehicleWeapon"
]);
export const cqbRangedWeapon = weapon => rangedProficiencies.has(weapon.proficiency) && weapon.isMelee !== true;
/** CQB Basics/Mastery pp.180–181. Opponent-only threat requires an explicit declaration. */
export function cqbRangePlan(system, weapon, { distanceFeet, targetOpponentConfirmed = false } = {}, kind = "attack") {
  const basics = system.activeFeatNames?.includes("CQB Basics") === true,
    mastery = system.activeFeatNames?.includes("CQB Mastery") === true,
    ranged = cqbRangedWeapon(weapon),
    active = ranged && (basics || (kind === "attack" && mastery)),
    empty = {
      active: false,
      known: false,
      within: false,
      attackBonus: 0,
      damageBonus: 0,
      threatIncrease: 0,
      notes: []
    };
  if (!active) return empty;
  const range = system.cqbRange ?? 30;
  if (!Number.isFinite(range) || range < 0)
    throw new Error(loc`Resolve current CQB Range before using its feat benefits.`);
  const supplied =
      distanceFeet !== undefined &&
      distanceFeet !== null &&
      !(typeof distanceFeet === "string" && !distanceFeet.trim()),
    distance =
      typeof distanceFeet === "number"
        ? distanceFeet
        : typeof distanceFeet === "string" && distanceFeet.trim()
          ? Number(distanceFeet)
          : NaN;
  if (supplied && (!Number.isFinite(distance) || distance < 0))
    throw new Error(loc`Enter a finite nonnegative CQB target distance.`);
  if (typeof targetOpponentConfirmed !== "boolean")
    throw new Error(loc`Confirm whether this attack targets an opponent.`);
  const within = supplied && distance <= range,
    attackBonus = basics && within ? 1 : 0,
    damageBonus = attackBonus,
    threatIncrease = kind === "attack" && mastery && within && targetOpponentConfirmed ? 1 : 0;
  return {
    active: true,
    kind,
    known: supplied,
    distanceFeet: supplied ? distance : null,
    range,
    within,
    basics,
    mastery,
    targetOpponentConfirmed,
    attackBonus,
    damageBonus,
    threatIncrease,
    notes: [
      !supplied
        ? loc`CQB range not measured; resolve range-dependent benefits after confirming target distance.`
        : within
          ? loc`CQB Range: target ${distance} ft. within ${range} ft.${basics ? (kind === "damage" ? loc` CQB Basics: damage +1.` : loc` CQB Basics: attack +1, damage +1 when resolved.`) : ""}${threatIncrease ? loc` CQB Mastery: opponent threat range +1.` : mastery && kind === "attack" ? loc` Confirm an opponent target before applying CQB Mastery’s threat benefit.` : ""}`
          : loc`CQB Range: target ${distance} ft. beyond ${range} ft.; no CQB range bonus.`
    ]
  };
}

/** Ranged fire into/out of melee pp.327–328; independent penalties explicitly stack. */
export function meleeFirePlan(system, weapon, { firingOutOfMelee = false, firingIntoMelee = false } = {}) {
  const ranged = cqbRangedWeapon(weapon);
  if (!ranged) return { applies: false, attackPenalty: 0, errorIncrease: 0, notes: [] };
  if ([firingOutOfMelee, firingIntoMelee].some(v => typeof v !== "boolean"))
    throw new Error(loc`Declare into/out-of-melee firing with the actual checkboxes.`);
  const basics = system.activeFeatNames?.includes("CQB Basics") === true,
    mastery = system.activeFeatNames?.includes("CQB Mastery") === true,
    outPenalty = firingOutOfMelee && !basics,
    intoPenalty = firingIntoMelee && !mastery,
    count = Number(outPenalty) + Number(intoPenalty);
  return {
    applies: firingOutOfMelee || firingIntoMelee,
    firingOutOfMelee,
    firingIntoMelee,
    outWaived: firingOutOfMelee && basics,
    intoWaived: firingIntoMelee && mastery,
    attackPenalty: -4 * count,
    errorIncrease: 2 * count,
    notes: [
      ...(firingOutOfMelee
        ? [
            basics
              ? loc`CQB Basics waives firing out of melee’s −4 attack/+2 error.`
              : loc`Firing out of melee: attack −4; error range +2.`
          ]
        : []),
      ...(firingIntoMelee
        ? [
            mastery
              ? loc`CQB Mastery waives firing into melee’s −4 attack/+2 error.`
              : loc`Firing into melee: attack −4; error range +2.`
          ]
        : [])
    ]
  };
}
