import { improvedVisionRangePlan } from "./senses.mjs";
import { sniperWeapon, eagleEyeState } from "./sniper.mjs";
/** Weapon Basics Table 4.77, p.299; recoil table key, p.225. */
export const FIRE_MODES = { single: "Single-Shot", burst: "Burst", auto: "Full Auto" };
export const FIREARM_CATEGORIES = {
  backupPistol: { label: "Backup pistol", modes: ["single"], maxIncrements: 10 },
  holdoutPistol: { label: "Holdout pistol", modes: ["single"], maxIncrements: 5 },
  servicePistol: { label: "Service pistol", modes: ["single"], maxIncrements: 10 },
  backupRevolver: { label: "Backup revolver", modes: ["single"], maxIncrements: 5 },
  huntingRevolver: { label: "Hunting revolver", modes: ["single"], maxIncrements: 10 },
  serviceRevolver: { label: "Service revolver", modes: ["single"], maxIncrements: 10 },
  assaultRifle: { label: "Assault rifle", modes: ["single", "burst", "auto"], maxIncrements: 10 },
  boltActionRifle: { label: "Bolt-action rifle", modes: ["single"], maxIncrements: 10 },
  semiAutomaticRifle: { label: "Semi-automatic rifle", modes: ["single"], maxIncrements: 10 },
  breakActionShotgun: { label: "Break-action shotgun", modes: ["single"], maxIncrements: 5 },
  pumpActionShotgun: { label: "Pump-action shotgun", modes: ["single"], maxIncrements: 5 },
  semiAutomaticShotgun: { label: "Semi-automatic shotgun", modes: ["single"], maxIncrements: 5 },
  lightSMG: { label: "Light submachine gun", modes: ["single", "burst", "auto"], maxIncrements: 10 },
  heavySMG: { label: "Heavy submachine gun", modes: ["single", "burst", "auto"], maxIncrements: 10 },
  saw: { label: "Squad automatic weapon", modes: ["burst", "auto"], maxIncrements: 10 },
  gpmg: { label: "General purpose machine gun", modes: ["burst", "auto"], maxIncrements: 10 },
  hmg: { label: "Heavy machine gun", modes: ["burst", "auto"], maxIncrements: 10 },
  flamethrower: { label: "Flamethrower", modes: ["single", "burst", "auto"], maxIncrements: 5 },
  grenadeLauncher: { label: "Grenade launcher", modes: ["single"], maxIncrements: 10 },
  missileLauncher: { label: "Missile launcher", modes: ["single"], maxIncrements: 10, locked: true },
  mortar: { label: "Mortar", modes: ["single"], maxIncrements: 10, locked: true },
  rocketLauncher: { label: "Rocket launcher", modes: ["single"], maxIncrements: 10, locked: true }
};
const nfm = qualities =>
  String(qualities ?? "")
    .match(/\bNFM\s*\(([SBF/]+)\)/)?.[1]
    ?.split("/")
    .map(code => ({ S: "single", B: "burst", F: "auto" })[code]);
export function firearmDefaults(sourceTable = "", qualities = "") {
  const text = sourceTable.toLowerCase();
  const labels = [
    ["mortar", "mortar"],
    ["grenade launcher", "grenadeLauncher"],
    ["missile launcher", "missileLauncher"],
    ["rocket launcher", "rocketLauncher"],
    ["squad automatic weapon", "saw"],
    ["general purpose machine gun", "gpmg"],
    ["heavy machine gun", "hmg"],
    ["flamethrower", "flamethrower"],
    ["backup pistol", "backupPistol"],
    ["holdout pistol", "holdoutPistol"],
    ["service pistol", "servicePistol"],
    ["backup revolver", "backupRevolver"],
    ["hunting revolver", "huntingRevolver"],
    ["service revolver", "serviceRevolver"],
    ["assault rifle", "assaultRifle"],
    ["bolt-action rifle", "boltActionRifle"],
    ["semi-automatic rifle", "semiAutomaticRifle"],
    ["break-action shotgun", "breakActionShotgun"],
    ["pump-action shotgun", "pumpActionShotgun"],
    ["semi-automatic shotgun", "semiAutomaticShotgun"],
    ["light submachine gun", "lightSMG"],
    ["heavy submachine gun", "heavySMG"]
  ];
  const category = labels.find(([label]) => text.includes(label))?.[1] ?? "other",
    base = FIREARM_CATEGORIES[category];
  return { weaponCategory: category, fireModes: base ? (nfm(qualities) ?? [...base.modes]) : [] };
}
export function weaponFireModes(weapon, system = {}) {
  const base = FIREARM_CATEGORIES[weapon.weaponCategory];
  if (base?.locked) return ["single"];
  let modes = weapon.fireModes?.length
    ? [...weapon.fireModes]
    : (nfm(weapon.qualities) ??
      (base
        ? [...base.modes]
        : !weapon.weaponCategory &&
            ["handgun", "rifle", "shotgun", "submachineGun", "tactical", "guided", "indirectFire"].includes(
              weapon.proficiency
            )
          ? ["single"]
          : []));
  if (base && /Revolver$/.test(weapon.weaponCategory) && system.activeFeatNames?.includes("Revolver Basics"))
    modes.push("burst");
  return [...new Set(modes)];
}
export function firearmContext(system, weapon, { fireMode = weapon.fireMode, recoilStrengthIncrease = 0 } = {}) {
  const modes = weaponFireModes(weapon, system);
  if (!modes.length) return { firearm: false, recoilPenalty: 0, blocked: false, modes: [] };
  const mode = fireMode || modes[0],
    strength =
      Number(system.abilities?.str?.value ?? 10 + 2 * (system.abilities?.str?.mod ?? 0)) + recoilStrengthIncrease,
    recoil = Math.max(
      0,
      (Number(weapon.recoil) || 0) - (/\bCLS\b/.test(weapon.qualities ?? "") && weapon.stockExtended ? 2 : 0)
    ),
    gap = Math.max(0, recoil - strength);
  const blocked = !modes.includes(mode) || modes.some(m => !Object.hasOwn(FIRE_MODES, m));
  return {
    firearm: true,
    modes,
    fireMode: mode,
    fireModeLabel: FIRE_MODES[mode] ?? mode,
    recoil,
    recoilStrength: strength,
    recoilPenalty: gap ? (mode === "single" ? -1 : -gap) : 0,
    blocked,
    reason: blocked ? "Choose one of this weapon’s currently available fire modes." : "",
    legacyModeReview: !weapon.weaponCategory
  };
}

/** Exact distance penalties, pp.225,347. No distance means an unmeasured quick roll. */
export function rangedAttackContext(
  system,
  weapon,
  { distanceFeet = null, rangeIncrement = weapon.range, ...sensoryOptions } = {}
) {
  const category = FIREARM_CATEGORIES[weapon.weaponCategory],
    rangePenaltyPerIncrement = ["mortar", "rocketLauncher"].includes(weapon.weaponCategory) ? 3 : 2;
  if (distanceFeet === null || distanceFeet === undefined || distanceFeet === "")
    return { rangeKnown: false, rangePenalty: 0, rangePenaltyPerIncrement, rangeBlocked: false };
  const distance = Number(distanceFeet),
    increment = Number(rangeIncrement);
  if (!Number.isFinite(distance) || distance < 0 || !Number.isFinite(increment) || increment <= 0)
    return {
      rangeKnown: true,
      rangePenalty: 0,
      rangeBlocked: true,
      rangeReason: "Enter a nonnegative distance for a weapon with a positive range increment."
    };
  const base = Number(weapon.maxRangeIncrements) || category?.maxIncrements;
  if (!base)
    return {
      rangeKnown: true,
      rangePenalty: 0,
      rangeBlocked: true,
      rangeReason: "Set this weapon’s source category or base maximum range increments before measuring its attack."
    };
  const hurled = ["hurled", "exoticHurled"].includes(weapon.proficiency),
    maximum = hurled ? Math.min(10, base + Math.max(0, system.abilities?.str?.mod ?? 0)) : base;
  const used = Math.max(1, Math.ceil(distance / increment)),
    blocked = distance > increment * maximum;
  return {
    rangeKnown: true,
    rangePenaltyPerIncrement,
    distanceFeet: distance,
    rangeIncrement: increment,
    incrementsUsed: used,
    maxIncrements: maximum,
    maximumRange: increment * maximum,
    ...improvedVisionRangePlan(system, used > 1 ? -rangePenaltyPerIncrement * (used - 1) : 0, {
      ...sensoryOptions,
      distanceFeet
    }),
    rangeBlocked: blocked,
    rangeReason: blocked ? "The target is beyond this weapon’s maximum range." : ""
  };
}

/** Character range benefits, pp.180–182. Positive multipliers combine by p.329. */
export function weaponRangeEffects(system, weapon, { firearm = false, loadPenalty = 0 } = {}) {
  const feats = new Set(system.activeFeatNames ?? []),
    hurled = ["hurled", "exoticHurled"].includes(weapon.proficiency),
    factors = [],
    notes = [];
  const grenade = hurled && /grenade/i.test(weapon.name ?? ""),
    grenadeBonus = grenade && feats.has("Grenade Basics") ? 5 : 0,
    eagle = eagleEyeState(system);
  const eagleBonus = eagle.active && sniperWeapon(weapon) && Number(weapon.range) > 0 ? eagle.rangeIncrease : 0,
    flat = grenadeBonus + eagleBonus;
  let errorReduction = grenadeBonus ? 2 : 0,
    roundToFive = false;
  if (grenadeBonus) notes.push("Grenade Basics: range increment +5 ft.; error –2, minimum 1.");
  if (eagleBonus)
    notes.push(
      `Eagle Eye: range increment ${eagleBonus >= 0 ? "+" : ""}${eagleBonus} ft. for this scene, before range multipliers (p.80).`
    );
  if (feats.has("Marksmanship Supremacy")) {
    if (firearm) factors.push(2);
    else if (hurled) factors.push(3);
    if (firearm || hurled) notes.push("Marksmanship Supremacy replaces Mastery’s range benefit.");
  } else if (feats.has("Marksmanship Mastery")) {
    if (firearm) {
      factors.push(1.5);
      roundToFive = true;
    } else if (hurled) factors.push(2);
    if (firearm || hurled) notes.push("Marksmanship Mastery range benefit.");
  }
  if (weapon.proficiency === "indirectFire" && feats.has("Bombard")) {
    factors.push(2);
    errorReduction++;
    notes.push("Bombard: range increment doubled; error –1, minimum 1.");
  }
  if (weapon.proficiency === "guided" && feats.has("Guided Weapon Basics")) {
    factors.push(2);
    errorReduction++;
    notes.push("Guided Weapon Basics: range increment doubled; error –1, minimum 1.");
  }
  const multiplier = factors.length ? 1 + factors.reduce((n, f) => n + f - 1, 0) : 1;
  let increment = ((Number(weapon.range) || 0) + flat) * multiplier;
  if (roundToFive) increment = 5 * Math.ceil(increment / 5);
  // Fixed range benefits precede multipliers; carrying penalties reduce the resulting increment.
  increment = Math.max(0, increment + (hurled ? loadPenalty : 0));
  return {
    increment,
    multiplier,
    flat,
    errorReduction,
    notes,
    cqbRange: feats.has("Marksmanship Supremacy") ? 60 : 30
  };
}

/** Aim/Brace, p.354, and Marksmanship/Sharpshooter, p.182. Conditions are declared for this roll. */
export function aimBraceContext(
  system,
  weapon,
  {
    aimed = false,
    braced = false,
    stableSurface = false,
    attackAction = "other",
    trained = false,
    firearm = false,
    ranged = false
  } = {}
) {
  const feats = new Set(system.activeFeatNames ?? []),
    notes = [];
  const reject = reason => ({
    blocked: true,
    reason,
    aimBonus: 0,
    braceBonus: 0,
    recoilStrengthIncrease: 0,
    threatIncrease: 0,
    notes: []
  });
  if (!["standard", "autofire", "other"].includes(attackAction)) return reject("Choose a supported attack action.");
  if ((aimed || braced) && !ranged) return reject("Aim and Brace here apply to ranged attacks.");
  if (braced && !firearm)
    return reject(
      "This Brace workflow requires a firearm or heavy weapon; special hurled-weapon bracing remains for table resolution."
    );
  if (braced && !stableSurface && !feats.has("Marksmanship Basics"))
    return reject("Brace requires a stable surface or Marksmanship Basics.");
  const aimBonus = aimed && attackAction === "standard" ? (feats.has("Marksmanship Mastery") ? 2 : 1) : 0;
  const braceBonus = braced && ["standard", "autofire"].includes(attackAction) ? 1 : 0;
  let threatIncrease = 0;
  if (braced && feats.has("Sharpshooter Mastery")) threatIncrease++;
  if (aimed && feats.has("Sharpshooter Supremacy")) threatIncrease += 2;
  if (aimed && !trained)
    notes.push("Untrained Aim takes a full action (Proficiency tag, p.352); its time cannot be reduced.");
  if (aimed)
    notes.push(
      `Aim remains valid for this target (no movement over 5 ft.): attack +${aimBonus}; Initiative Count +1 when Aim was taken.`
    );
  if (braced)
    notes.push(
      `Brace remains valid: attacker has not moved and target is in the chosen 90-degree cone; recoil Strength +2; attack +${braceBonus}; Reflex ${bracedReflexPenalty(system)}; Initiative Count +1 when Brace was taken.`
    );
  if (braced && system.conditionContext?.prone === true)
    notes.push("Prone: Brace may be taken as a free action (p.342).");
  if (aimed && braced)
    notes.push(
      system.conditionContext?.prone === true
        ? "Prone permits free Brace; Aim uses its normal action."
        : feats.has("Marksmanship Basics")
          ? "Marksmanship Basics permits free Brace with Aim."
          : "Aim and Brace require separate actions."
    );
  return {
    blocked: false,
    braceAction: braced
      ? system.conditionContext?.prone === true || (aimed && feats.has("Marksmanship Basics"))
        ? "free"
        : "half"
      : null,
    aimed: !!aimed,
    braced: !!braced,
    attackAction,
    aimBonus,
    braceBonus,
    aimAction: aimed ? (trained ? "half" : "full") : null,
    recoilStrengthIncrease: braced ? 2 : 0,
    threatIncrease,
    notes
  };
}
export function bracedReflexPenalty(system) {
  return system.activeFeatNames?.includes("Marksmanship Basics") ? -1 : -4;
}

/** Grenade-launcher direct/indirect use, Table 4.77 p.299, and Table 4.57 mount footnotes p.270. */
export function launcherOperationPlan(
  weapon,
  { indirectFire = false, underbarrelMountConfirmed = false, usingIntegralTripod = false, vehicleMounted = false } = {}
) {
  if (weapon.weaponCategory !== "grenadeLauncher") return { applicable: false, blocked: false, notes: [] };
  const requirement = weapon.mountRequirement ?? "",
    underbarrel = underbarrelMountConfirmed === true,
    tripod = usingIntegralTripod === true,
    vehicle = vehicleMounted === true,
    indirect = indirectFire === true;
  let reason = "";
  if (!["", "underbarrel", "optionalUnderbarrel", "tripodOrVehicle"].includes(requirement))
    reason = "Review this launcher’s firing-mount requirement.";
  else if (underbarrel && !["underbarrel", "optionalUnderbarrel"].includes(requirement))
    reason = "This catalog entry does not provide an underbarrel version.";
  else if (tripod && requirement !== "tripodOrVehicle")
    reason = "This launcher does not provide the automatic launcher’s integral tripod.";
  else if (requirement === "underbarrel" && !underbarrel)
    reason = "This launcher may fire only while attached to a compatible rifle’s underbarrel upgrade location (p.270).";
  else if (requirement === "tripodOrVehicle" && !tripod && !vehicle)
    reason = "This automatic grenade launcher requires its integral tripod or attachment to a vehicle (p.270).";
  const proficiency = indirect ? "indirectFire" : "tactical",
    ability = indirect ? "int" : "dex",
    untrainedPenalty = indirect ? -10 : -6;
  return {
    applicable: true,
    blocked: !!reason,
    reason,
    mode: indirect ? "indirect" : "direct",
    proficiency,
    ability,
    untrainedPenalty,
    mountRequirement: requirement,
    underbarrelMountConfirmed: underbarrel,
    usingIntegralTripod: tripod,
    vehicleMounted: vehicle,
    notes: [
      `Grenade launcher: ${indirect ? "out-of-sight indirect fire, Indirect/INT, untrained −10" : "direct fire within line of sight, Tactical/DEX, untrained −6"} (p.299).`,
      ...(underbarrel
        ? ["Compatible rifle underbarrel attachment confirmed; apply the host rifle’s recoil reduction separately."]
        : []),
      ...(tripod ? ["Integral tripod in use."] : [])
    ]
  };
}

/** Mortar firing space and physical assembly, p.315; action completion is recorded at the table. */
export function mortarOperationPlan(weapon, { mortarSpaceConfirmed = false } = {}) {
  if (weapon.weaponCategory !== "mortar") return { applicable: false, blocked: false, notes: [] };
  const disassembled = weapon.disassembled === true,
    space = mortarSpaceConfirmed === true;
  const reason = disassembled
    ? "This mortar cannot fire while disassembled (p.315)."
    : !space
      ? "Confirm outdoor use or a very large indoor area suitable for the mortar’s high-arc trajectory (p.315)."
      : "";
  return {
    applicable: true,
    blocked: !!reason,
    reason,
    disassembled,
    mortarSpaceConfirmed: space,
    assemblyHalfActions: weapon.assemblyHalfActions ?? 0,
    notes: ["Mortar: indirect fire; outdoor or very large indoor firing space confirmed (p.315)."]
  };
}
