import { kickDamageBonus, unarmedWeapon } from "./kick.mjs";
import { inClosedStance, CLOSED_STANCE_DAMAGE, doubleJabFormula } from "./boxing.mjs";
import { unarmedTrickDamageBonus } from "./unarmed-tricks.mjs";
import { hordeSupremacyDamage } from "./team-feats.mjs";
import { intenseDamage } from "./intense-stance.mjs";
import { signatureBonus } from "./favored-gear.mjs";
import { markDamagePlan } from "./marks.mjs";
import { reachWeaponPlan } from "./reach-weapon.mjs";
import { meleeArmorPiercingPlan } from "./melee-armor-piercing.mjs";
import { grantedMeleeQuality } from "./melee-tricks.mjs";
import "./bullseye.mjs";
import "./melee-tradeoff.mjs";
import { combatStanceState } from "./combat-stance.mjs";
import "./side-stance.mjs";
import "./feint-bonus.mjs";
import { missTrickSources } from "./miss-tricks.mjs";
import "./cheap-shot.mjs";
import { disarmResponsePlan } from "./disarm-response.mjs";
import { quirkyWeaponPlan } from "./quirky-weapon.mjs";
import { superiorAccuracyWeaponPlan } from "./superior-accuracy-weapon.mjs";
import { weaponDamageExpression } from "./weapon-damage-expression.mjs";
import { trainedOnlyWeaponPlan } from "./trained-only-weapon.mjs";
import { accurizedWeaponPlan } from "./accurized-weapon.mjs";
import { managedClassGearGrant } from "./class-gear.mjs";
import "./cleave.mjs";
import { dartingStyleState } from "./darting-state.mjs";
import { finesseWeaponPlan, massiveWeaponPlan } from "./finesse.mjs";
import { cqbRangePlan, meleeFirePlan } from "./cqb.mjs";
import { disarmAttackPlan } from "./disarm.mjs";
import { twoWeaponStyleState, twoWeaponHandgunWaiver } from "./two-weapon-state.mjs";
import { armorTrainingAdjustments } from "./armor-training.mjs";
import { restraintActionBlock } from "./restraints.mjs";
import { attributeActionBlock, conditionRollPenalties, conditionAbilityPenalty } from "./attributes.mjs";
import { resistanceType } from "./resistances.mjs";
import "./class-checks.mjs";
import { ambientLightPlan, fogSmokePlan, sensoryAttackConditionPlan } from "./senses.mjs";
import "./sniper.mjs";
import {
  firearmContext,
  rangedAttackContext,
  weaponRangeEffects,
  aimBraceContext,
  launcherOperationPlan,
  mortarOperationPlan
} from "./firearms.mjs";
import { specialistApplies } from "./weapon-specialist.mjs";
import "./combat-actions.mjs";
import { planTerms, planTotal } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
/** Actual equipment category, separate from the pick used to acquire it. Legacy typed items have known categories. */
export function equipmentCategory(item) {
  const system = item?.system ?? {},
    explicit = String(system.gearCategory ?? "")
      .trim()
      .toUpperCase();
  if (explicit) return explicit;
  if (item?.type === "weapon") return "W";
  if (item?.type === "armor") return "S";
  return ["E", "G", "R", "S", "T", "V", "W"].includes(system.pick) ? system.pick : "";
}
/** Spycraft 2.0 pp.217–219,284,299,329. Pure equipment calculations. */
export function armorSlot(item) {
  const s = item.system ?? item;
  if (s.armorSlot) return s.armorSlot;
  const name = String(item.name ?? "").toLowerCase();
  return /helmet/.test(name) ? "helmet" : /shield/.test(name) ? "shield" : "body";
}
export function armorTotals(
  items,
  { checkBonus = 0, partialDefenseBonus = 0, armorDefenseBonus = 0, armorTraining = {} } = {}
) {
  const selected = [],
    warnings = [],
    slots = new Set();
  for (const item of items.filter(i => i.type === "armor" && i.system.equipped)) {
    const quantity = Number(item.system.quantity ?? 1),
      unusable = item.system.reserve
        ? loc`reserve armor must be acquired before wearing`
        : item.system.carried === false
          ? loc`armor is not carried`
          : item.system.destroyed
            ? "armor is destroyed"
            : !Number.isSafeInteger(quantity) || quantity < 1
              ? loc`no usable armor remains`
              : "";
    if (unusable) {
      warnings.push(`${item.name}: ${unusable}.`);
      continue;
    }
    const unavailable = possessionUnavailable(item.system);
    if (unavailable) {
      warnings.push(`${item.name}: ${unavailable}`);
      continue;
    }
    const slot = armorSlot(item);
    if (
      slots.has(slot) ||
      (slot === "helmet" && selected.some(i => i.system.sealed)) ||
      (item.system.sealed && slots.has("helmet"))
    ) {
      warnings.push(
        loc`${item.name}: another equipped item occupies its ${slot} slot (sealed suits include a helmet).`
      );
      continue;
    }
    slots.add(slot);
    selected.push(item);
  }
  if (!selected.length) return { armor: null, warnings };
  const adjustments = selected.map(i => armorTrainingAdjustments(i, armorTraining, armorSlot(i))),
    trained = selected.map((i, n) => ({ ...i, system: adjustments[n].system })),
    training = {};
  for (const key of ["meleeWeaponDR", "rangedWeaponDR", "meleeAttackDR", "rangedAttackDR", "defense"])
    training[key] = adjustments.reduce((n, row) => n + row.benefits[key], 0);
  for (const key of ["coupDeGraceRequiresHelpless", "sneakAttackImmune"])
    training[key] = adjustments.some(row => row.benefits[key]);
  const sum = key => trained.reduce((n, i) => n + (Number(i.system[key]) || 0), 0);
  const normalCheck = trained.filter(i => !i.system.visionPenalty).reduce((n, i) => n + (i.system.armorCheck || 0), 0);
  const resistances = {};
  for (const item of selected)
    for (const [, rawKey, value] of String(item.system.resistances ?? "").matchAll(/\b([A-Z]{2})\s*(\d+|\(all\))/gi)) {
      const key = resistanceType(rawKey) ?? rawKey.toUpperCase();
      resistances[key] =
        value.toLowerCase() === "(all)" || resistances[key] === "all" ? "all" : (resistances[key] || 0) + Number(value);
    }
  const defenseValues = trained.map(
    i => (i.system.defensePenalty || 0) + (i.system.armorType === "P" ? partialDefenseBonus : 0)
  );
  const defenseBonus = trained.some(i => ["P", "M", "F"].includes(i.system.armorType)) ? armorDefenseBonus : 0;
  return {
    armor: {
      name: selected.map(i => i.name).join(" + "),
      items: selected.map(i => i.id),
      dr: sum("damageReduction"),
      drRanged: sum("damageReductionSubdual"),
      defense: defenseValues.reduce((n, v) => n + v, 0) + defenseBonus + training.defense,
      defensePenalty: defenseValues.reduce((n, v) => n + Math.min(0, v), 0),
      defenseBonus: defenseValues.reduce((n, v) => n + Math.max(0, v), 0) + defenseBonus + training.defense,
      check: Math.min(0, normalCheck + checkBonus),
      visionCheck: trained.filter(i => i.system.visionPenalty).reduce((n, i) => n + (i.system.armorCheck || 0), 0),
      speed: sum("speedPenalty"),
      resistances,
      training,
      adjustments: selected.map((item, n) => ({
        id: item.id,
        name: item.name,
        slot: armorSlot(item),
        ...adjustments[n]
      }))
    },
    warnings
  };
}
export function loadTotals(items, carry) {
  const weight = items
    .filter(i => ["weapon", "armor", "gear"].includes(i.type) && i.system.carried !== false && !i.system.reserve)
    .reduce((n, i) => n + Math.max(0, Number(i.system.weight) || 0) * Math.max(0, i.system.quantity ?? 1), 0);
  const index =
    weight <= carry.light
      ? 0
      : weight <= carry.medium
        ? 1
        : weight <= carry.heavy
          ? 2
          : weight <= carry.extreme
            ? 3
            : 4;
  return {
    weight,
    load: ["Light", "Medium", "Heavy", "Extreme", "Overloaded"][index],
    defense: [0, -1, -3, -6, -10][index],
    check: [0, -2, -4, -6, -8][index],
    speed: [0, -5, -10, -20, 0][index],
    throwRange: [0, -5, -10, -20, 0][index],
    immobile: index === 4,
    condition: index === 4 ? "Helpless" : index === 3 ? "Vulnerable" : ""
  };
}
export function weaponRanges(weapon, unarmed = { threat: 20 }) {
  const parts = String(weapon.errorThreat ?? "")
    .replace(/[–−]/g, "-")
    .split("/");
  if (parts.length !== 2) return { error: weapon.error ?? 1, threat: weapon.threat ?? 20 };
  const range = (text, fallback, lower = false) => {
    const s = text.trim();
    if (!s || /^[-—]+$/.test(s)) return 0;
    if (/^[+]\d+$/.test(s)) return fallback + Number(s);
    const nums = s.match(/\d+/g);
    return nums ? Number(lower ? nums[0] : nums.at(-1)) : 0;
  };
  return {
    error: range(parts[0], 1),
    threat:
      /^\s*[+]\d+/.test(parts[0]) && /^\s*[—-]+\s*$/.test(parts[1])
        ? (unarmed.threat ?? 20)
        : range(parts[1], unarmed.threat ?? 20, true)
  };
}
/** Weapon grip, pp.347,349. Zero means use the weapon's normal required grip. */
export function weaponGrip(system, weapon, { hands = weapon.useHands ?? 0 } = {}) {
  const required = Number(String(weapon.sizeHands ?? "").match(/\/\s*([12])h/i)?.[1] ?? 0);
  const size = String(system.size ?? "Medium").split(/[ (]/)[0];
  const small = size === "Small" || system.aging?.small;
  const unarmed = weapon.proficiency === "unarmed";
  const actual = Number(hands) || (!unarmed && small && required === 1 ? 2 : required);
  let reason = weapon.destroyed ? loc`This weapon was destroyed and cannot be used.` : "";
  if (!unarmed && small && required === 2) reason = loc`A Small character cannot use a two-handed weapon (p.349).`;
  else if (!unarmed && small && required === 1 && actual !== 2)
    reason = loc`A Small character must use both hands with a one-handed weapon (p.349).`;
  const supported = ["Medium", "Large", "Huge", "Gargantuan", "Colossal", "Enormous", "Vast"].includes(size);
  if (!unarmed && required === 2 && actual === 1 && !supported)
    reason = loc`Using a two-handed weapon in one hand requires Medium or larger size (p.347).`;
  const grippingOneHand = !unarmed && required === 2 && actual === 1 && combatStanceState(system)?.key === "gripping";
  const rockOneHand =
    required === 2 &&
    actual === 1 &&
    system.activeFeatNames?.includes("Rock and Roll!") &&
    (weapon.proficiency === "rifle" || ["saw", "gpmg", "hmg"].includes(weapon.weaponCategory));
  if ((rockOneHand || grippingOneHand) && !weapon.destroyed) reason = "";
  const bracedGrip = !unarmed && required === 1 && actual === 2;
  return {
    required,
    hands: actual,
    blocked: !!reason,
    reason,
    attackPenalty: rockOneHand || grippingOneHand ? -2 : !unarmed && required === 2 && actual === 1 ? -4 : 0,
    strengthIncrease: bracedGrip ? 4 : 0,
    initiativeLoss: bracedGrip ? 2 : 0
  };
}
/** Arrows and bolts share statistics but are not interchangeable (pp.274–275,319). */
export function projectileContext(weapon, ammunition) {
  const kind = String(weapon.damage ?? "")
    .match(/as (arrow|bolt)/i)?.[1]
    ?.toLowerCase();
  if (!kind) return { error: 0, damage: null, explosive: false, reason: "" };
  if (!ammunition || !(ammunition.ammunitionOnly || ["Standard arrow", "Explosive arrow"].includes(ammunition.name)))
    return { error: 0, reason: loc`Choose an owned ${kind} ammunition stockpile for this launcher.` };
  const actual = ammunition.ammunitionKind || (/bolt/i.test(ammunition.name ?? "") ? "bolt" : "arrow");
  if (actual !== kind)
    return { error: 0, reason: loc`This launcher uses ${kind}s; ${actual}s are not interchangeable.` };
  if (ammunition.reserve || ammunition.destroyed || ammunition.quantity === 0)
    return { error: 0, reason: loc`The selected ammunition is unavailable.` };
  const error = Number(
    String(ammunition.errorThreat ?? "")
      .split("/")[0]
      .match(/[+-]\d+/)?.[0] ?? 0
  );
  return {
    error,
    damage: ammunition.damage,
    explosive: !!ammunition.explosiveAmmunition || /explosive/i.test(ammunition.name ?? ""),
    name: ammunition.name,
    reason: ""
  };
}
/** Legacy reference entries are recognized before their embedded documents are refreshed. */
export function weaponUnavailable(weapon) {
  const possessionReason = possessionUnavailable(weapon);
  if (possessionReason) return possessionReason;
  if (weapon.destroyed) return loc`A destroyed weapon cannot be used until it is replaced.`;
  if (weapon.reserve) return loc`Unassigned or reserved gear is not available for an attack.`;
  if (weapon.quantity === 0) return loc`No copies of this weapon remain.`;
  if (weapon.ammunitionOnly || ["Standard arrow", "Explosive arrow"].includes(weapon.name))
    return loc`This is ammunition. Use it with a matching bow or crossbow; it cannot make an independent attack.`;
  return "";
}
/** Wheelman Gunnery, p.51: only the firing operation, not Aim, Brace or reload. */
export function vehicleWeaponOperationPlan(system, { vehicleMounted = false, weaponOperationTime = "" } = {}) {
  const times = { half: "1 half action", full: "1 full action", twoHalf: "2 half actions" };
  if (!weaponOperationTime) return { blocked: false, baseTime: null, requiredTime: null, gunnery: false, notes: [] };
  if (!Object.hasOwn(times, weaponOperationTime))
    return { blocked: true, reason: loc`Choose the weapon’s normal firing operation time.`, notes: [] };
  if (!vehicleMounted)
    return {
      blocked: true,
      reason: loc`A vehicle-weapon operation time requires a vehicle-mounted weapon.`,
      notes: []
    };
  const gunnery =
    weaponOperationTime !== "half" &&
    (system.classOptionSelections ?? []).some(e => e.classId === "wheelman" && e.name === "Gunnery");
  const requiredTime = gunnery ? "1 half action" : times[weaponOperationTime];
  return {
    blocked: false,
    baseTime: times[weaponOperationTime],
    requiredTime,
    gunnery,
    notes: [
      gunnery
        ? loc`Gunnery: fire in 1 half action instead of ${times[weaponOperationTime]} (p.51).`
        : loc`Vehicle weapon firing operation: ${requiredTime}.`
    ]
  };
}
export function weaponAttack(system, weapon, cfg, type = "agent", options = {}) {
  const sourceWeapon = weapon;
  const finesseBasic = finesseWeaponPlan(system, weapon);
  weapon = { ...weapon, qualities: finesseBasic.effectiveQualities };
  const massive = massiveWeaponPlan(system, weapon);
  const mortarOperation = mortarOperationPlan(weapon, options);
  const launcherOperation = launcherOperationPlan(weapon, options);
  if (launcherOperation.applicable)
    weapon = {
      ...weapon,
      proficiency: launcherOperation.proficiency,
      attackAbility: launcherOperation.ability,
      untrainedPenalty: launcherOperation.untrainedPenalty
    };
  const ability = weapon.attackAbility || cfg.proficiencies[weapon.proficiency]?.ability || "dex";
  const p = (system.proficiencyTotals ?? system.proficiencies)?.[weapon.proficiency];
  const trained = type !== "agent" || !!p?.proficient,
    forte = p?.forte ? 1 : 0;
  const range = weaponRanges(weapon, system.unarmed),
    grip = weaponGrip(
      ["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged"].includes(weapon.proficiency)
        ? system
        : { ...system, combatStance: null },
      weapon,
      options
    );
  const meleeArmorPiercing = meleeArmorPiercingPlan(system, weapon, { grip });
  const twoWeaponWaiver = twoWeaponHandgunWaiver(system, weapon);
  const projectile = projectileContext(weapon, options.ammunition),
    unavailable =
      (dartingStyleState(system).needsReview ? dartingStyleState(system).reason : "") ||
      (twoWeaponStyleState(system).needsReview ? twoWeaponStyleState(system).reason : "") ||
      restraintActionBlock(system, { free: options.freeFinalAttack === true }) ||
      attributeActionBlock(system, { kind: "attack" }) ||
      weaponUnavailable(weapon) ||
      projectile.reason ||
      (system.encumbrance?.immobile && ["hurled", "exoticHurled"].includes(weapon.proficiency)
        ? loc`An overloaded character cannot make a hurled attack (p.218).`
        : "");
  const baseFiring = firearmContext(system, weapon, options);
  const operation = vehicleWeaponOperationPlan(system, options);
  const ranged = !["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged"].includes(weapon.proficiency);
  const stance = aimBraceContext(system, weapon, {
    ...options,
    stableSurface: options.stableSurface === true || launcherOperation.usingIntegralTripod === true,
    trained,
    firearm: baseFiring.firearm,
    ranged
  });
  let quirky,
    superiorAccuracy,
    accurized,
    trainedOnly,
    weaponQualityReview = "";
  try {
    quirky = quirkyWeaponPlan(sourceWeapon, {
      trained,
      operatingProficiency: weapon.proficiency,
      untrainedPenalty: weapon.untrainedPenalty ?? -4
    });
    superiorAccuracy = superiorAccuracyWeaponPlan(sourceWeapon, {
      trained,
      aimed: stance.aimed === true,
      braced: stance.braced === true,
      operatingProficiency: weapon.proficiency
    });
    accurized = accurizedWeaponPlan(sourceWeapon, {
      trained,
      aimed: stance.aimed === true,
      operatingProficiency: weapon.proficiency
    });
    trainedOnly = trainedOnlyWeaponPlan(sourceWeapon, { trained, operatingProficiency: weapon.proficiency });
  } catch (error) {
    weaponQualityReview = error.message;
  }
  let reach = null,
    reachReview = "";
  try {
    reach = reachWeaponPlan(system, sourceWeapon, {
      trained,
      ranged,
      operatingProficiency: weapon.proficiency,
      adjacent: options.reachAdjacent ?? null,
      geometryConfirmed: options.reachGeometryConfirmed ?? false,
      defensive: options.disarm?.role === "defender"
    });
  } catch (error) {
    reachReview = error.message;
  }
  const firing = firearmContext(system, weapon, { ...options, recoilStrengthIncrease: stance.recoilStrengthIncrease });
  const light = ambientLightPlan(system, options),
    fogSmoke = fogSmokePlan(system, options);
  const rangeEffects = weaponRangeEffects(system, weapon, {
    firearm: firing.firearm,
    loadPenalty: system.encumbrance?.throwRange ?? 0
  });
  const effectiveRange =
    system.encumbrance?.immobile && ["hurled", "exoticHurled"].includes(weapon.proficiency)
      ? 0
      : rangeEffects.increment;
  const meleeFire = meleeFirePlan(system, weapon, options);
  const disarm = (options.disarm?.role === "defender" ? disarmResponsePlan : disarmAttackPlan)(system, weapon, {
    grip,
    trained,
    ranged,
    action: stance.attackAction,
    context: options.disarm
  });
  // Feat and class parts of the plan come from the rules that own them (module/rules/roll-pipeline.mjs, planTerms).
  const terms = planTerms("attack", {
    system,
    weapon,
    sourceWeapon,
    options,
    actorType: type,
    ability,
    trained,
    ranged,
    grip,
    stance,
    firing,
    stableSurface: options.stableSurface === true || launcherOperation.usingIntegralTripod === true
  });
  const originalError =
      terms.sum("error") +
      meleeFire.errorIncrease +
      disarm.errorIncrease +
      range.error +
      projectile.error +
      (trained ? 0 : 2) +
      (weapon.improvised ? 1 : 0),
    reducedError = rangeEffects.errorReduction
      ? Math.max(Math.min(originalError, 1), originalError - rangeEffects.errorReduction)
      : originalError;
  const pinnedTargetBonus = options.targetPinnedAdjacent === true && !ranged ? 4 : 0;
  const targetPosturePenalty = ranged
    ? -(Number(options.targetCrouchedNonAdjacent === true) + 2 * Number(options.targetProneNonAdjacent === true))
    : 0;
  const distance = rangedAttackContext(system, weapon, { ...options, rangeIncrement: effectiveRange }),
    sensoryConditions = sensoryAttackConditionPlan(system, options);
  const inaccurate = Number(
    String(weapon.qualities ?? "")
      .replace(/[–−]/g, "-")
      .match(/INA\s*\(([+-]?\d+)\)/)?.[1] ?? 0
  );
  // Club Basics (p.177): an improvised weapon the GC classed as a club carries no improvised penalty.
  const improvisedPenalty =
    weapon.improvised &&
    !system.activeFeatNames?.includes("Improvised Weapon Basics") &&
    !(weapon.meleeFamily === "club" && system.activeFeatNames?.includes("Club Basics"))
      ? -2
      : 0;
  // Whether the attack can be made, and the first reason it cannot: the weapon's own checks and the terms', in order.
  const blocks = terms
    .merge("blocked", [
      [10, { blocked: !!reachReview, reason: reachReview }],
      [20, { blocked: !!reach?.blocked, reason: reach?.blockedReason }],
      [30, { blocked: !!meleeArmorPiercing.blockedReason, reason: meleeArmorPiercing.blockedReason }],
      [100, { blocked: !!weaponQualityReview, reason: weaponQualityReview }],
      [110, { blocked: !!trainedOnly?.blocked, reason: trainedOnly?.blockedReason }],
      [120, { blocked: !!disarm.blocked, reason: disarm.reason }],
      [130, { blocked: !!mortarOperation.blocked, reason: mortarOperation.reason }],
      [140, { blocked: !!launcherOperation.blocked, reason: launcherOperation.reason }],
      [160, { blocked: !!operation.blocked, reason: operation.reason }],
      [170, { blocked: !!unavailable, reason: unavailable }],
      [180, { blocked: !!grip.blocked, reason: grip.reason }],
      [190, { blocked: !!firing.blocked, reason: firing.reason }],
      [200, { blocked: !!distance.rangeBlocked, reason: distance.rangeReason }],
      [210, { blocked: !!stance.blocked, reason: stance.reason }]
    ])
    .map(item => (typeof item === "string" ? { blocked: true, reason: item } : item));
  const stanceKey = combatStanceState(system)?.key,
    attacking = !ranged && options.disarm?.role !== "defender";
  const notes = terms.merge("notes", [
    [10, reach?.notes ?? []],
    [20, meleeArmorPiercing.notes],
    [
      30,
      attacking && stanceKey === "menacing"
        ? loc`Menacing Stance: on a successful melee hit, record its separate fixed 2 stress component through Stance damage (p.176).`
        : ""
    ],
    [
      40,
      attacking && stanceKey === "circling"
        ? loc`Circling Stance: with an empty square next to you, this target’s dodge bonus to Defense is halved (rounded up) against this melee attack; select yourself in the target’s Incoming attack preview. Following this attack you automatically move into an unoccupied adjacent square of your choice (p.179).`
        : ""
    ],
    [
      80,
      stanceKey === "gripping" && !ranged && grip.required === 2 && grip.hands === 1
        ? loc`Gripping Stance: using this two-handed weapon with one hand; attack penalty −2 (p.179).`
        : ""
    ],
    [
      120,
      quirky?.quirky && !quirky.trained
        ? loc`Quirky (QKY): base untrained attack penalty ${quirky.baseUntrainedPenalty}, additional −4, total ${quirky.attackPenalty} (p.302).`
        : ""
    ],
    [
      130,
      superiorAccuracy?.threatIncrease
        ? loc`Superior Accuracy (SPA): trained, aimed and braced attack, threat range +1 (p.302).`
        : ""
    ],
    [
      140,
      trainedOnly?.evidence.trainedOnly
        ? loc`Trained Only (TRO): this attack requires its actual operating proficiency (p.302).`
        : ""
    ],
    [150, accurized?.threatIncrease ? loc`Accurized (ACC): trained and aimed attack, threat range +1 (p.301).` : ""],
    [
      170,
      dartingStyleState(system).active
        ? loc`Darting Weapon: attack/skill penalty −${dartingStyleState(system).penalty}.`
        : ""
    ],
    [180, massive.notes],
    [
      190,
      finesseBasic.granted
        ? loc`Finesse Basics: optional FIN quality granted; trained use may choose Dexterity damage (p.178).`
        : ""
    ],
    [210, meleeFire.notes],
    [230, disarm.notes],
    [
      240,
      twoWeaponStyleState(system).active
        ? loc`Two-weapon style: base attack penalty −${twoWeaponStyleState(system).penalty}.`
        : ""
    ],
    [250, twoWeaponWaiver ? loc`Both Guns Blazing: two-weapon handgun penalty −${twoWeaponWaiver} waived (p.84).` : ""],
    [260, pinnedTargetBonus ? loc`Pinned target: adjacent unarmed/melee attack +4 (p.342).` : ""],
    [270, conditionRollPenalties(system).sprawled ? "Sprawled: attack checks −2 (p.342)." : ""],
    [280, !ranged && conditionRollPenalties(system).prone ? "Prone: melee attack −2 (p.342)." : ""],
    [
      290,
      targetPosturePenalty
        ? loc`Posture target modifier: non-adjacent ranged attack ${targetPosturePenalty} (pp.340,342).`
        : ""
    ],
    [300, conditionAbilityPenalty(system, ability) ? loc`Drunk: Dexterity-/Wisdom-based attack check −2 (p.341).` : ""],
    [310, sensoryConditions.notes],
    [320, conditionRollPenalties(system).sickened ? "Sickened: attack checks −2." : ""],
    [
      330,
      distance.rangePenaltyPerIncrement === 3
        ? loc`Mortar/rocket launcher range penalty: −3 per increment beyond the first (p.315).`
        : ""
    ],
    [
      340,
      distance.improvedVisionReduction
        ? loc`Improved vision: range penalty ${distance.rangePenaltyBase} → ${distance.rangePenalty}, minimum 0 (p.448).`
        : ""
    ],
    [
      350,
      distance.sensoryTarget?.nightTrainingException
        ? loc`Night Training: not considered blinded when targeting this character within 10 ft. while able to hear.`
        : ""
    ],
    [380, mortarOperation.notes],
    [390, launcherOperation.notes],
    [400, light.notes],
    [410, fogSmoke.notes],
    [430, operation.notes],
    [440, rangeEffects.notes],
    [450, stance.notes],
    [
      460,
      /\bCLS\b/.test(weapon.qualities ?? "") && weapon.stockExtended
        ? loc`Stock extended: recoil –2; observers gain +2 Notice/Search to spot this weapon.`
        : ""
    ],
    [
      470,
      distance.rangeKnown
        ? loc`Distance ${distance.distanceFeet} ft.; increment ${distance.rangeIncrement} ft.; range penalty ${distance.rangePenalty}; maximum ${distance.maximumRange} ft.`
        : effectiveRange > 0
          ? loc`Range not measured; this quick roll has no distance modifier.`
          : ""
    ],
    [480, !trained ? loc`Untrained attack: Initiative Count –4; apply in combat.` : ""],
    [
      490,
      firing.firearm
        ? loc`${firing.fireModeLabel}; recoil ${firing.recoil} vs Strength ${firing.recoilStrength}: ${firing.recoilPenalty} attack.`
        : ""
    ],
    [500, firing.legacyModeReview ? loc`Review this imported weapon’s fire-mode category.` : ""],
    [
      510,
      projectile.name
        ? `Ammunition: ${projectile.name}; error modifier ${projectile.error >= 0 ? "+" : ""}${projectile.error}.`
        : ""
    ],
    [520, grip.initiativeLoss ? loc`Initiative Count –${grip.initiativeLoss} per attack; apply in combat.` : ""],
    [530, weapon.improvised ? loc`Any error destroys the improvised weapon.` : ""]
  ]);
  return {
    reach: reach?.evidence ?? null,
    meleeArmorPiercing,
    ...terms.plans,
    missTrickSources: missTrickSources(system, weapon, { grip, combat: options.cheapShotCombat, ranged }),
    quirky,
    superiorAccuracy,
    trainedOnly: trainedOnly?.evidence ?? null,
    accurized,
    finesseBasic,
    effectiveQualities: terms
      .all("grantedQuality")
      .reduce((qualities, quality) => grantedMeleeQuality(qualities, quality), meleeArmorPiercing.effectiveQualities),
    massive,
    meleeFire,
    disarm,
    twoWeaponWaiver,
    pinnedTargetBonus,
    targetPosturePenalty,
    sensoryConditions,
    mortarOperation,
    launcherOperation,
    proficiency: weapon.proficiency,
    ability,
    trained,
    forte,
    ...grip,
    ...firing,
    ...distance,
    initiativeLoss: grip.initiativeLoss + massive.initiativeLoss + (trained ? 0 : 4),
    initiativeLossComponents: {
      grip: grip.initiativeLoss,
      massive: massive.initiativeLoss,
      untrained: trained ? 0 : 4
    },
    stance,
    ranged,
    operation,
    ambientLight: light,
    fogSmoke,
    blocked: blocks.some(item => item.blocked),
    reason: blocks.map(item => item.reason).find(Boolean),
    grip,
    improvisedPenalty,
    conditionAttackPenalty:
      conditionRollPenalties(system).attack +
      twoWeaponWaiver +
      (!ranged ? conditionRollPenalties(system).meleeAttack : 0) +
      conditionAbilityPenalty(system, ability),
    // The attack bonus as labelled parts; the terms' rows sit among the weapon's own, and plan-stage roll
    // contributors add theirs (module/rules/roll-pipeline.mjs).
    ...planTotal(
      "attack",
      { system, weapon, options, actorType: type },
      terms.merge("rows", [
        [10, [loc`Reach weapon`, reach?.evidence.attackPenalty ?? 0]],
        [80, [loc`Firing in melee`, meleeFire.attackPenalty]],
        [100, [loc`Disarm`, disarm.attackBonus]],
        [110, [loc`Pinned target`, pinnedTargetBonus]],
        [120, [loc`Target posture`, targetPosturePenalty]],
        [130, [loc`Conditions and two-weapon fighting`, conditionRollPenalties(system).attack + twoWeaponWaiver]],
        [140, [loc`Conditions (melee)`, !ranged ? conditionRollPenalties(system).meleeAttack : 0]],
        [150, [loc`Condition ability penalty`, conditionAbilityPenalty(system, ability)]],
        [160, [loc`Base attack bonus`, system.bab ?? 0]],
        [170, [loc`Attribute`, system.abilities[ability]?.mod ?? 0]],
        [180, [loc`Forte`, forte]],
        [190, [loc`Size`, system.sizeModifier ?? 0]],
        [200, [loc`Quirky weapon`, quirky?.attackPenalty ?? 0]],
        [210, [loc`Inaccurate weapon`, inaccurate]],
        [220, [loc`Grip`, grip.attackPenalty]],
        [230, [loc`Massive weapon`, massive.attackPenalty]],
        [240, [loc`Improvised weapon`, improvisedPenalty]],
        [250, [loc`Recoil`, firing.recoilPenalty]],
        [260, [loc`Range`, distance.rangePenalty]],
        [270, [loc`Aim`, stance.aimBonus]],
        [280, [loc`Brace`, stance.braceBonus]]
      ])
    ),
    error: Math.max(0, reducedError - terms.sum("errorReduction")),
    threat: range.threat
      ? Math.max(
          1,
          range.threat -
            (superiorAccuracy?.threatIncrease ?? 0) -
            (accurized?.threatIncrease ?? 0) -
            stance.threatIncrease -
            terms.sum("threat")
        )
      : 0,
    notes: notes.join(" "),
    range: effectiveRange
  };
}
/** Whatever's Handy (Brawler 1st, 5th, 9th): the improvised weapon bonus at the character's Brawler level. */
export function whateversHandyBonus(system) {
  const level = system?.classLevels?.brawler ?? 0;
  return level >= 9 ? 3 : level >= 5 ? 2 : level >= 1 ? 1 : 0;
}

/** Dead to Rights (Grunt 2nd, 7th): extra d4s of damage with tactical weapons. */
export function deadToRightsDice(system, weapon) {
  const level = system?.classLevels?.grunt ?? 0;
  if (weapon?.proficiency !== "tactical") return 0;
  return level >= 7 ? 2 : level >= 2 ? 1 : 0;
}

export function weaponDamage(
  system,
  weapon,
  { finesse = weapon.useFinesse ?? false, ...options } = {},
  type = "agent"
) {
  const finesseBasic = finesseWeaponPlan(system, weapon);
  weapon = { ...weapon, qualities: finesseBasic.effectiveQualities };
  const mortarOperation = mortarOperationPlan(weapon, options);
  if (mortarOperation.blocked) return { blocked: true, blockedReason: mortarOperation.reason };
  const launcherOperation = launcherOperationPlan(weapon, options);
  if (launcherOperation.blocked) return { blocked: true, blockedReason: launcherOperation.reason };
  if (launcherOperation.applicable)
    weapon = {
      ...weapon,
      proficiency: launcherOperation.proficiency,
      attackAbility: launcherOperation.ability,
      untrainedPenalty: launcherOperation.untrainedPenalty
    };
  const projectile = projectileContext(weapon, options.ammunition),
    unavailable = weaponUnavailable(weapon) || projectile.reason;
  if (unavailable) return { blocked: true, blockedReason: unavailable };
  const text = String(projectile.damage ?? weapon.damage ?? "").replace(/[–−]/g, "-");
  const parsed = weaponDamageExpression(text);
  if (!parsed) return null;
  if (parsed.componentReview)
    return {
      blocked: true,
      blockedReason: loc`Resolve the separately listed damage components before rolling this weapon’s damage.`,
      damageText: text,
      expression: parsed.expression,
      componentReview: true
    };
  const expression = parsed.expression;
  const knuckle = /(?:^|[,\s])NKL(?:[,\s]|$)/.test(weapon.qualities ?? "");
  const melee = ["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged"].includes(weapon.proficiency);
  const hurled =
    ["hurled", "exoticHurled"].includes(weapon.proficiency) &&
    !projectile.explosive &&
    !/(?:^|[,\s])(?:EXP)(?:[,\s]|$)/.test(weapon.qualities ?? "") &&
    !/grenade|bomb|explosive/i.test(weapon.name ?? "") &&
    !weapon.noStrengthDamage &&
    !["Dart", "Shuriken"].includes(weapon.name);
  const grip = weaponGrip(system, weapon, options);
  const trained =
    type !== "agent" || !!(system.proficiencyTotals ?? system.proficiencies)?.[weapon.proficiency]?.proficient;
  const useFinesse = !!finesse && trained && /\bFIN\b/.test(weapon.qualities ?? "");
  const u = system.unarmed ?? { die: 3, extraDice: 0, damageBonus: system.abilities.str.mod };
  let base = knuckle ? `${1 + (u.extraDice ?? 0)}d${u.die} + ${expression}` : expression;
  const ranged = !melee;
  if (specialistApplies(system, weapon, "Killer Instinct") && (!ranged || options.withinCQB)) base += " + 1d4";
  const deadToRights = deadToRightsDice(system, weapon);
  if (deadToRights) base += ` + ${deadToRights}d4`;
  const strength = system.abilities.str.mod;
  let bonus = knuckle ? u.damageBonus : melee || hurled ? strength : 0;
  if (useFinesse && (melee || hurled)) bonus = system.abilities.dex?.mod ?? 0;
  else if (grip.strengthIncrease && (melee || hurled) && (!knuckle || u.usesStrength !== false))
    bonus += grip.strengthIncrease / 2;
  if (weapon.improvised) {
    if (!useFinesse && (melee || hurled))
      bonus -= Math.max(
        0,
        (knuckle ? (u.strengthComponent ?? strength) : strength) +
          (knuckle && u.usesStrength === false ? 0 : grip.strengthIncrease / 2)
      );
    if (!system.activeFeatNames?.includes("Improvised Weapon Basics")) bonus -= 2;
    // Whatever's Handy, Brawler 1st: +1 damage with improvised weapons, +2 at 5th and +3 at 9th.
    bonus += whateversHandyBonus(system);
  }
  const meleeArmorPiercing = meleeArmorPiercingPlan(system, weapon, { grip });
  if (meleeArmorPiercing.blockedReason) return { blocked: true, blockedReason: meleeArmorPiercing.blockedReason };
  const cqbRange = cqbRangePlan(system, weapon, options, "damage");
  const markDamage = markDamagePlan(system, weapon);
  const conditionDamagePenalty = conditionRollPenalties(system).damage;
  // Signature / Trademark Gear, p.197: +1 or +2 morale to damage with the item.
  const signatureDamage = signatureBonus(system, weapon.id),
    kickDamage = weapon.kick === true && unarmedWeapon(weapon) ? kickDamageBonus(system) : 0,
    closedDamage =
      weapon.closedStanceTarget === true && unarmedWeapon(weapon) && inClosedStance(system) ? CLOSED_STANCE_DAMAGE : 0,
    trickDamage = unarmedWeapon(weapon) ? unarmedTrickDamageBonus(weapon.unarmedTrick) : 0,
    hordeDamage = hordeSupremacyDamage(system, weapon) + intenseDamage(system, weapon);
  bonus +=
    conditionDamagePenalty +
    cqbRange.damageBonus +
    markDamage.bonus +
    signatureDamage +
    kickDamage +
    closedDamage +
    trickDamage +
    hordeDamage +
    (options.attackDamageBonus ?? 0);
  const min = parsed.minimum;
  return {
    markDamage,
    deadToRights,
    meleeArmorPiercing,
    expression,
    finesseBasic,
    effectiveQualities: meleeArmorPiercing.effectiveQualities,
    cqbRange,
    conditionDamagePenalty,
    mortarOperation,
    launcherOperation,
    formula: `max(${min}, ${weapon.doubleJab === true && unarmedWeapon(weapon) ? doubleJabFormula(base) : base} + (${bonus}))`,
    damageText: text,
    ammunition: projectile.name ?? "",
    explosive: projectile.explosive,
    bonus,
    knuckle,
    min,
    grip,
    finesse: useFinesse,
    blocked: grip.blocked,
    blockedReason: grip.reason
  };
}

/** Possessions, pp.216–217: each slot allows one pick of any category up to its Caliber. */
export function possessionBudget(items, allowance = "", system = {}) {
  const roman = { I: 1, II: 2, III: 3, IV: 4, V: 5 },
    available = Object.fromEntries([1, 2, 3, 4, 5].map(c => [c, 0]));
  for (const match of String(allowance).matchAll(/(\d+)\s*\/\s*(IV|III|II|V|I)\b/g))
    available[roman[match[2]]] += Number(match[1]);
  const remaining = { ...available },
    assignments = [],
    warnings = [];
  const gear = items.filter(i => ["weapon", "armor", "gear"].includes(i.type));
  const selected = gear
    .filter(i => i.system.possessionSource === "wealth")
    .sort((a, b) => (b.system.caliber ?? 0) - (a.system.caliber ?? 0));
  let spent = 0,
    unfunded = 0;
  for (const item of gear.filter(i => i.system.possessionSource)) {
    if (!item.system.possessionApproved)
      warnings.push(loc`${item.name}: the GC must approve this Possession before it enters play.`);
    if (item.system.pick || item.system.reserveAcquisition)
      warnings.push(loc`${item.name}: a Possession cannot also be charged as mission or field-acquired gear.`);
  }
  for (const item of selected) {
    const caliber = Number(item.system.caliber),
      count = Number(item.system.pickCount ?? 1);
    if (
      !Number.isSafeInteger(caliber) ||
      caliber < 1 ||
      caliber > 5 ||
      item.system.common ||
      item.system.ammunitionOnly
    ) {
      warnings.push(
        loc`${item.name}: choose an ordinary Caliber I–V gear pick; Common Items/ammunition require their separate accounting.`
      );
      continue;
    }
    if (!Number.isSafeInteger(count) || count < 1) {
      warnings.push(loc`${item.name}: choose a positive whole number of Possessions picks.`);
      continue;
    }
    spent += count;
    let need = count;
    const slots = [];
    for (let cap = caliber; cap <= 5 && need; cap++) {
      const used = Math.min(need, remaining[cap]);
      if (used) {
        remaining[cap] -= used;
        need -= used;
        slots.push({ caliber: cap, count: used });
      }
    }
    assignments.push({ id: item.id, name: item.name, caliber, count, slots, unfunded: need });
    unfunded += need;
    if (need)
      warnings.push(
        loc`${item.name}: ${need} Caliber-${caliber} Possessions pick(s) exceed the available Wealth allowance.`
      );
    if ((item.system.quantity ?? 1) > (item.system.bundleSize ?? 1) * count)
      warnings.push(loc`${item.name}: quantity exceeds its paid Possessions bundles.`);
  }
  return {
    available,
    remaining,
    assignments,
    spent,
    unfunded,
    total: Object.values(available).reduce((a, b) => a + b, 0),
    warnings,
    unclassified: gear.filter(
      i =>
        !i.system.possessionSource &&
        !i.system.pick &&
        !i.system.reserveAcquisition &&
        !i.system.common &&
        !i.system.ammunitionOnly &&
        !i.system.armorMissionGrant &&
        !managedClassGearGrant(system, i)
    ).length
  };
}

export function possessionUnavailable(gear) {
  if (gear.possessionSource && !gear.possessionApproved)
    return loc`The GC must approve this Possession before it enters play (p.216).`;
  if (gear.possessionSource && (gear.pick || gear.reserveAcquisition))
    return loc`Review this item’s conflicting personal and mission acquisition records.`;
  return "";
}

/** p.197: maintenance is explicitly confirmed; an absence over 24 hours requires one hour of cleaning. */
export function cleanAndPolishedApplies(system, gear) {
  return (
    !!gear &&
    [
      "wealth",
      "gcGrant",
      "favoredGear",
      "bugBasics",
      "diseaseBasics",
      "poisonBasics",
      "superiorDocumentation"
    ].includes(gear.possessionSource) &&
    !possessionUnavailable(gear) &&
    !!gear.cleanAndPolishedReady &&
    system.activeFeatNames?.includes("Clean and Polished") === true
  );
}

/** Armor Use, pp.49,70: one piece during Intel, with the combined legacy grade's cap. */
export function armorGrantStatus(system, items = []) {
  const epoch = String(system.usagePeriods?.mission ?? "initial");
  const cap = Math.max(0, Math.min(5, Number(system.legacyAbilities?.armorUse?.freeArmorCaliber) || 0));
  const record = system.armorMissionGrant?.epoch === epoch ? system.armorMissionGrant : null;
  const warnings = [];
  if (record) {
    const item = items.find(i => i.id === record.itemId);
    if (!item)
      warnings.push(
        loc`Armor Use: this mission’s armor was already selected, but the item is missing; review its disposition with the GC.`
      );
    else if (
      item.type !== "armor" ||
      !armorGrantMatches(system, item) ||
      !cap ||
      item.system.caliber > cap ||
      item.system.pick ||
      item.system.possessionSource ||
      item.system.reserveAcquisition ||
      item.system.common ||
      item.system.reserve ||
      (item.system.pickCount ?? 1) !== 1 ||
      (item.system.quantity ?? 1) > 1
    )
      warnings.push(
        loc`${item.name}: review its Armor Use grant, current grade, quantity and conflicting acquisition records.`
      );
  }
  for (const item of items.filter(i => i.system?.armorMissionGrant)) {
    if (item.system.armorMissionGrant.epoch !== epoch)
      warnings.push(
        loc`${item.name}: Armor Use gear from an earlier mission; review its disposition before using it this mission.`
      );
    else if (!armorGrantMatches(system, item))
      warnings.push(loc`${item.name}: Armor Use provenance does not match this mission’s recorded selection.`);
  }
  return { caliber: cap, used: !!record, itemId: record?.itemId ?? "", warnings };
}
export function armorGrantMatches(system, item) {
  const epoch = String(system.usagePeriods?.mission ?? "initial"),
    record = system.armorMissionGrant,
    stamp = item?.system?.armorMissionGrant;
  return !!record && record.epoch === epoch && record.itemId === item.id && stamp?.epoch === epoch;
}
export function armorGrantPlan(system, items, { itemId, intelConfirmed = false } = {}) {
  const status = armorGrantStatus(system, items);
  if (!intelConfirmed) throw new Error(loc`Confirm that this armor was selected during the Intel Phase.`);
  if (!status.caliber) throw new Error(loc`An earned Armor Use grade is required.`);
  if (status.used) throw new Error(loc`Armor Use armor has already been selected for this mission.`);
  const item = items.find(i => i.id === itemId),
    gear = item?.system;
  if (
    item?.type !== "armor" ||
    !Number.isSafeInteger(gear.caliber) ||
    gear.caliber < 1 ||
    gear.caliber > status.caliber
  )
    throw new Error(loc`Choose owned Caliber I–${status.caliber} armor.`);
  if (
    gear.pick ||
    gear.possessionSource ||
    gear.reserveAcquisition ||
    gear.common ||
    gear.reserve ||
    gear.missionCaliberGrant?.epoch === String(system.usagePeriods?.mission ?? "initial") ||
    gear.armorMissionGrant?.epoch === String(system.usagePeriods?.mission ?? "initial")
  )
    throw new Error(loc`Choose unassigned armor with no personal, mission, reserve or current grant record.`);
  if ((gear.quantity ?? 1) !== 1 || (gear.pickCount ?? 1) !== 1)
    throw new Error(loc`Armor Use grants exactly one piece of armor.`);
  const epoch = String(system.usagePeriods?.mission ?? "initial");
  return {
    record: { epoch, itemId, caliber: gear.caliber, grade: status.caliber },
    stamp: { epoch, source: "Armor Use" }
  };
}

/** p.49: Big Stick raises one covered Weapon pick's Caliber, not the number of picks. */
export function bigStickStatus(system, items = []) {
  const epoch = String(system.usagePeriods?.mission ?? "initial");
  const mission = system.missionReserves?.epoch === epoch ? system.missionReserves : null;
  const active = system.weaponSpecialist?.abilities?.includes("Big Stick") === true;
  const record = system.bigStickMissionPick?.epoch === epoch ? system.bigStickMissionPick : null;
  const warnings = [];
  if (record) {
    const item = items.find(i => i.id === record.itemId);
    if (!item) warnings.push(loc`Big Stick: the selected mission weapon is missing; its exception remains used.`);
    else if (
      !active ||
      !bigStickMatches(system, item) ||
      !system.weaponSpecialist?.proficiencies?.includes(item.system.proficiency) ||
      !mission ||
      mission.caliber !== record.missionCaliber ||
      item.system.caliber > record.missionCaliber + 1 ||
      !bigStickWeapon(system, item)
    )
      warnings.push(loc`${item.name}: review its Big Stick selection, proficiency, Caliber and paid mission pick.`);
  }
  for (const item of items.filter(i => i.system?.bigStickMissionPick)) {
    if (item.system.bigStickMissionPick.epoch !== epoch)
      warnings.push(
        loc`${item.name}: Big Stick selection belongs to an earlier mission; review this mission’s acquisition.`
      );
    else if (!bigStickMatches(system, item))
      warnings.push(loc`${item.name}: Big Stick provenance does not match the recorded selection.`);
  }
  return {
    active,
    caliber: mission?.caliber ?? 0,
    used: !!record,
    maximumCaliber: mission ? Math.min(5, mission.caliber + 1) : 0,
    upgradeAllowance: active && mission?.caliber === 5 ? (system.actionDice?.max ?? 0) : 0,
    warnings
  };
}
function bigStickWeapon(system, item) {
  const gear = item?.system;
  return (
    item?.type === "weapon" &&
    equipmentCategory(item) === "W" &&
    (gear.pick === "W" || (gear.pick === "CHA" && system.affiliationType === "freelance")) &&
    !gear.possessionSource &&
    !gear.reserveAcquisition &&
    !gear.reserve &&
    !gear.common &&
    !gear.ammunitionOnly &&
    !["Standard arrow", "Explosive arrow"].includes(item.name) &&
    (gear.pickCount ?? 1) === 1 &&
    Number.isSafeInteger(gear.caliber) &&
    gear.caliber >= 1
  );
}
export function bigStickMatches(system, item) {
  const epoch = String(system.usagePeriods?.mission ?? "initial"),
    record = system.bigStickMissionPick;
  return (
    !!record &&
    record.epoch === epoch &&
    record.itemId === item.id &&
    item?.system?.bigStickMissionPick?.epoch === epoch
  );
}
export function bigStickPlan(system, items, { itemId, intelConfirmed = false } = {}) {
  const status = bigStickStatus(system, items);
  if (!intelConfirmed) throw new Error(loc`Confirm that this weapon was chosen as mission gear during Intel.`);
  if (!status.active) throw new Error(loc`An earned Big Stick selection is required.`);
  if (!status.caliber)
    throw new Error(
      loc`Record this mission’s Caliber using the mission-reserve setup first; zero reserves are allowed.`
    );
  if (status.caliber === 5)
    throw new Error(
      loc`At Caliber V Big Stick grants starting-action-dice extra upgrades instead of raising a weapon’s Caliber. Upgrade purchasing is still adjudicated separately.`
    );
  if (status.used) throw new Error(loc`Big Stick’s higher-Caliber weapon has already been selected for this mission.`);
  const item = items.find(i => i.id === itemId);
  if (
    !bigStickWeapon(system, item) ||
    !system.weaponSpecialist?.proficiencies?.includes(item.system.proficiency) ||
    item.system.caliber > status.maximumCaliber
  )
    throw new Error(
      loc`Choose one paid mission Weapon pick covered by your specialist proficiencies, at most one Caliber above the mission.`
    );
  if ((item.system.quantity ?? 1) < 1 || (item.system.quantity ?? 1) > (item.system.bundleSize ?? 1))
    throw new Error(loc`Choose one available paid weapon bundle.`);
  const epoch = String(system.usagePeriods?.mission ?? "initial");
  if (item.system.bigStickMissionPick?.epoch === epoch || item.system.missionCaliberGrant?.epoch === epoch)
    throw new Error(loc`Review this item’s existing Big Stick provenance with the GC.`);
  return { record: { epoch, itemId, missionCaliber: status.caliber }, stamp: { epoch, source: "Big Stick" } };
}
