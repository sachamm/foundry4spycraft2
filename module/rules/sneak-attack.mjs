import { sniperWeapon } from "./sniper.mjs";
const has = (system, name) =>
  (system.activeFeatNames ?? []).some(
    n => n.toLowerCase().replace(/\s/g, "") === name.toLowerCase().replace(/\s/g, "")
  );
const unarmed = weapon => weapon.proficiency === "unarmed" || /\bNKL\b/.test(weapon.qualities ?? "");
const melee = weapon =>
  unarmed(weapon) || ["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged"].includes(weapon.proficiency);
/** Derived dice only. Temporary Snake Strike grants and No Quarter trades need their own history. */
export function sneakAttackSources(
  system,
  weapon,
  { targetFlanked = false, braced = false, sideStanceDie = false, trickSneak = null } = {}
) {
  const sources = [],
    add = (source, dice) => {
      if (dice > 0) sources.push({ source, dice });
    };
  const scout = Math.floor(Math.min(20, system.classLevels?.scout ?? 0) / 4),
    borrowed = (system.inheritedClassChoices ?? []).some(s => s.name === "Scout: Sneak attack (1 die)");
  add("Scout Sneak Attack", Math.max(scout, borrowed ? 1 : 0));
  if (sideStanceDie === true) add("Side Stance", 1);
  if (trickSneak) {
    if (trickSneak.source !== "Between the Ribs" || trickSneak.dice !== 1 || unarmed(weapon) || !melee(weapon))
      throw new Error("Review the recorded melee trick sneak attack die.");
    add(trickSneak.source, trickSneak.dice);
  }
  for (const name of ["Ambush Basics", "Ambush Supremacy"]) if (has(system, name)) add(name, 1);
  if (unarmed(weapon))
    for (const name of ["Dirty Fighting Supremacy", "Vital Points Supremacy"]) if (has(system, name)) add(name, 1);
  if (targetFlanked === true)
    for (const name of ["Wolfpack Mastery", "Wolfpack Supremacy"]) if (has(system, name)) add(name, 1);
  const sniper = system.classLevels?.sniper ?? 0;
  if (sniper >= 4 && sniperWeapon(weapon) && braced === true) add("Sniper Ranged Sneak Attack", sniper >= 8 ? 3 : 1);
  return sources;
}
export function hasSneakAttackSource(system, weapon) {
  return sneakAttackSources(system, weapon, { targetFlanked: true, braced: true }).length > 0;
}
/** pp.80,193–196,339. Context is confirmed for this successful Standard Attack. */
export function sneakAttackDamagePlan(
  system,
  weapon,
  {
    includeSneakAttack = false,
    successfulStandardAttack = false,
    targetCharacter = false,
    targetFlanked = false,
    targetHelpless = false,
    targetVulnerable = false,
    targetVitalsConfirmed = false,
    damageConversion = "none",
    damageType = "lethal",
    distanceFeet = null,
    braced = false,
    targetSystem = null,
    targetSneakAttackImmune = false,
    sideStanceDie = false,
    trickSneak = null,
    whirlingFlankingProof = null
  } = {}
) {
  if (
    typeof includeSneakAttack !== "boolean" ||
    typeof targetSneakAttackImmune !== "boolean" ||
    typeof sideStanceDie !== "boolean"
  )
    throw new Error("Confirm whether sneak attack damage and target immunity apply.");
  if (!includeSneakAttack) return { active: false, dice: 0 };
  if (whirlingFlankingProof?.prevented) targetFlanked = false;
  if (targetSneakAttackImmune || knownSneakAttackImmunity(targetSystem ?? {}).immune)
    throw new Error("The target is immune to sneak attack damage.");
  if (successfulStandardAttack !== true) throw new Error("Sneak attack damage requires a successful Standard Attack.");
  if (targetCharacter !== true) throw new Error("Sneak attack damage affects characters, not objects.");
  if (![targetFlanked, targetHelpless, targetVulnerable].some(v => v === true))
    throw new Error("Confirm this target is flanked, helpless or vulnerable.");
  if (targetVitalsConfirmed !== true)
    throw new Error(
      "Confirm the target is not immune to critical hits, is not hidden to you and has reachable vitals."
    );
  if (
    !["none", "lethalToSubdual", "subdualToLethal"].includes(damageConversion) ||
    !["lethal", "subdual"].includes(damageType)
  )
    throw new Error("Review the damage type and conversion.");
  if (
    damageConversion !== "none" &&
    !(damageConversion === "lethalToSubdual" && has(system, "Bludgeon") && damageType === "subdual")
  )
    throw new Error("Converted damage cannot include sneak attack damage, except lethal to subdual with Bludgeon.");
  const sources = sneakAttackSources(system, weapon, { targetFlanked, braced, sideStanceDie, trickSneak }),
    dice = sources.reduce((n, s) => n + s.dice, 0);
  if (!dice) throw new Error("This weapon and declared circumstances have no earned sneak attack dice.");
  let rangeLimit = null,
    extendedRange = false;
  if (!melee(weapon)) {
    const distance = typeof distanceFeet === "number" ? distanceFeet : Number(distanceFeet),
      increment = Number(weapon.range),
      sniper = system.classLevels?.sniper ?? 0;
    if (
      !["number", "string"].includes(typeof distanceFeet) ||
      distanceFeet === "" ||
      !Number.isFinite(distance) ||
      distance < 0
    )
      throw new Error("Enter the target distance for ranged sneak attack damage.");
    rangeLimit = system.cqbRange ?? 30;
    if (targetFlanked === true && distance > rangeLimit)
      throw new Error(
        "A ranged flanking opponent must be within CQB; Sniper range does not extend flanking positions (p.341)."
      );
    if (sniper >= 4 && sniperWeapon(weapon) && Number.isFinite(increment) && increment > 0) {
      rangeLimit = Math.max(rangeLimit, sniper * increment);
      extendedRange = distance > (system.cqbRange ?? 30);
    }
    if (distance > rangeLimit) throw new Error("This target is beyond your sneak attack range.");
  }
  const bonusPerDie =
      (has(system, "Deadly Precision") ? 1 : 0) + (damageType === "subdual" && has(system, "Whack") ? 1 : 0),
    bonus = dice * bonusPerDie;
  return {
    active: true,
    ...(whirlingFlankingProof ? { whirling: whirlingFlankingProof } : {}),
    dice,
    sources,
    bonusPerDie,
    bonus,
    formula: `${dice}d6${bonus ? ` + ${bonus}` : ""}`,
    stress: 1,
    damageType,
    damageConversion,
    rangeLimit,
    extendedRange,
    braced: braced === true,
    targetFlanked: targetFlanked === true,
    targetHelpless: targetHelpless === true,
    targetVulnerable: targetVulnerable === true,
    targetCharacter: true,
    targetVitalsConfirmed: true,
    successfulStandardAttack: true,
    notes: `Sneak attack: +${dice}d6${bonus ? ` + ${bonus}` : ""} ${damageType} damage, combined with the attack; apply 1 stress damage to the target. Action dice may boost only the base attack damage, never these sneak attack dice. ${extendedRange ? "Sniper extended sneak attack range applies. " : ""}Known target immunity is checked when a target sheet is supplied; confirm other immunities, damage resistance, damage conversion and health application at the table (pp.80,193–196,339).`
  };
}

/** Ability prerequisites count an achievable combination, not mutually exclusive weapon contexts together. */
export function sneakAttackCapacity(system, featNames = system.activeFeatNames ?? []) {
  const s = { ...system, activeFeatNames: [...featNames] },
    context = { targetFlanked: true, braced: true },
    sum = w => sneakAttackSources(s, w, context).reduce((n, row) => n + row.dice, 0);
  const unarmed = sum({ proficiency: "unarmed" }),
    ranged = sum({ proficiency: "rifle", sizeHands: "S/2h" });
  return Math.max(unarmed, ranged) + (has(s, "Snake Strike") ? 1 : 0);
}

/** Known target protections supplement the GC's other immunity/vitals confirmations. */
export function knownSneakAttackImmunity(system = {}) {
  const sources = [];
  if (system.armorFeatRules?.sneakAttackImmune === true) sources.push("Armor Supremacy");
  if (
    system.npcProfile?.enabled &&
    Array.isArray(system.npcProfile.qualities) &&
    system.npcProfile.qualities.some(q => q.id === "construct")
  )
    sources.push("Construct");
  return { immune: sources.length > 0, sources };
}
