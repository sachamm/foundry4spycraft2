/**
 * Campaign qualities in play (pp.405–408): the numbers the qualities in force change during a session.
 *
 * The qualities are world state, so this module does not read them itself. The Foundry layer registers a source
 * (`setCampaignRulesSource`, from module/apps/gc/state.mjs) that returns the merged effects of the qualities in
 * force; with no source every function here gives the book's standard numbers. Tests pass effects directly.
 */
import { loc } from "../i18n.mjs";

let source = () => ({});
// A character's data is prepared in one synchronous pass that asks for the rules many times; the answer is kept
// until that pass ends, so a quality changed between passes is always seen.
let cached = null;

/** Register the function that returns the merged effects of the qualities in force (`campaignEffects().effects`). */
export function setCampaignRulesSource(fn) {
  source = typeof fn === "function" ? fn : () => ({});
  cached = null;
}

/** The merged effects of the qualities in force, or {} when none are or the world is not ready. */
export function campaignRules() {
  if (cached) return cached;
  let effects;
  try {
    effects = source();
  } catch {
    effects = null;
  }
  cached = campaignEffectAliases(effects);
  queueMicrotask(() => (cached = null));
  return cached;
}

export function campaignEffectAliases(effects) {
  const base = effects && typeof effects === "object" ? effects : {};
  // Older rule helpers read these names; the captured campaign policies retain the canonical saved keys.
  const normalized = { ...base };
  for (const [key, canonical] of Object.entries({
    wealthBonus: "startingWealth",
    halfSaveResistsFully: "ignoreSuccessfulHalfSave",
    lowestAttributeErrorIncrease: "lowestAttributeSkillError",
    errorActivationDiceMaximum: "skillErrorActivationMaximum",
    take10TimeMultiplier: "take10Base",
    favorableDispositionBonus: "positiveDispositionBonus",
    levelsBetweenMissions: "betweenMissionLevels",
    fixedVitality: "fixedVitalityByDie",
    allClassSkills: "allSkillsClass",
    modularFeats: "modularCreation",
    noSkillResultCaps: "uncappedSkills",
    halveSkillPenalties: "skillPenaltyDivisor",
    allChecksActive: "activeSkillChecks",
    surpriseHideBonus: "surpriseStealthMorale",
    dispositionCheckModifier: "socialCheckMorale",
    noCrossroads: "forbidCrossroads",
    pointBuy: "creationPointBuy",
    subplotLimitBonus: "extraSubplots",
    noTakeTen: "forbidTake10"
  }))
    if (base[key] === undefined && base[canonical] !== undefined)
      normalized[key] = [
        "fixedVitality",
        "allClassSkills",
        "modularFeats",
        "noSkillResultCaps",
        "halveSkillPenalties",
        "allChecksActive"
      ].includes(key)
        ? !!base[canonical]
        : base[canonical];
  if (base.stressMultiplier === undefined && Array.isArray(base.stressDamageMultipliers))
    normalized.stressMultiplier = base.stressDamageMultipliers.reduce((n, v) => n * v, 1);
  if (base.fallingDamageMultiplier === undefined && base.fallingDamageDivisor)
    normalized.fallingDamageMultiplier = 1 / base.fallingDamageDivisor;
  const canonical = {
    startingWealth: "wealthBonus",
    ignoreSuccessfulHalfSave: "halfSaveResistsFully",
    lowestAttributeSkillError: "lowestAttributeErrorIncrease",
    skillErrorActivationMaximum: "errorActivationDiceMaximum",
    take10Base: "take10TimeMultiplier",
    positiveDispositionBonus: "favorableDispositionBonus",
    betweenMissionLevels: "levelsBetweenMissions",
    allSkillsClass: "allClassSkills",
    modularCreation: "modularFeats",
    uncappedSkills: "noSkillResultCaps",
    activeSkillChecks: "allChecksActive",
    socialCheckMorale: "dispositionCheckModifier",
    surpriseStealthMorale: "surpriseHideBonus",
    forbidCrossroads: "noCrossroads",
    creationPointBuy: "pointBuy",
    extraSubplots: "subplotLimitBonus",
    forbidTake10: "noTakeTen"
  };
  for (const [key, old] of Object.entries(canonical))
    if (base[key] === undefined && base[old] !== undefined)
      normalized[key] = ["allSkillsClass", "modularCreation", "uncappedSkills", "activeSkillChecks"].includes(key)
        ? Number(!!base[old])
        : base[old];
  if (base.fixedVitality && !base.fixedVitalityByDie) normalized.fixedVitalityByDie = { 8: 2, 10: 3, 12: 4 };
  if (base.halveSkillPenalties && base.skillPenaltyDivisor === undefined) normalized.skillPenaltyDivisor = 2;
  if (base.stressMultiplier !== undefined && !base.stressDamageMultipliers)
    normalized.stressDamageMultipliers = [base.stressMultiplier];
  if (base.stressMultiplier === 0.5 && base.stressDamageMinimum === undefined) normalized.stressDamageMinimum = 1;
  if (base.fallingDamageMultiplier !== undefined && !base.fallingDamageDivisor)
    normalized.fallingDamageDivisor = 1 / base.fallingDamageMultiplier;
  return normalized;
}

const number = (value, fallback) => (Number.isFinite(value) ? value : fallback);

/** The skill (and attack) result at which a Triumph occurs: 75, or 60 / 90 under the Spectacle qualities (p.406). */
export const triumphResult = (effects = campaignRules()) => number(campaignEffectAliases(effects).triumphResult, 75);

/**
 * Attack terms from Violent (threat range +2) and Subtle (−1 to every attack check), for any character (p.408).
 * @returns {{threat: number, modifier: number, rows: Array<[string, number]>, notes: string[]}}
 */
export function campaignAttackTerms(effects = campaignRules()) {
  const threat = Math.max(0, Math.trunc(number(campaignEffectAliases(effects).attackThreatIncrease, 0))),
    modifier = Math.trunc(number(campaignEffectAliases(effects).attackModifier, 0));
  return {
    threat,
    modifier,
    rows: modifier ? [[loc`Campaign quality`, modifier]] : [],
    notes: threat ? [loc`Campaign quality: threat range +${threat} on every attack (p.408).`] : []
  };
}

/** Range increments after Gunmen (doubled, p.407). */
export const campaignRangeIncrement = (increment, effects = campaignRules()) =>
  Number.isFinite(increment)
    ? increment * number(campaignEffectAliases(effects).rangeIncrementMultiplier, 1)
    : increment;

/** Blast increments after Blockbuster (tripled, p.406). */
export const campaignBlastIncrement = (increment, effects = campaignRules()) =>
  Number.isFinite(increment)
    ? increment * number(campaignEffectAliases(effects).blastIncrementMultiplier, 1)
    : increment;

/**
 * Critical injury damage bands after Bulletproof or Gritty (p.406). Standard: 25–49 calls for the save, 50 or more
 * also drops wounds to −9 (p.331).
 */
export function criticalInjuryBand(effects = campaignRules()) {
  const [min] = Array.isArray(campaignEffectAliases(effects).criticalInjuryRange)
    ? campaignEffectAliases(effects).criticalInjuryRange
    : [25];
  const massive = number(campaignEffectAliases(effects).massiveDamageThreshold, 50);
  return { min: number(min, 25), massive, changed: min !== 25 || massive !== 50 };
}

/** Extra action dice to activate a critical injury on a player or special character (Bulletproof +1, Gritty −1). */
export const criticalInjuryCostShift = (effects = campaignRules()) =>
  Math.trunc(number(campaignEffectAliases(effects).criticalInjuryActivationCost, 0));

/**
 * Stress damage after Tense (doubled) or Mellow (halved, rounded down, minimum 1) (pp.407–408).
 * @returns {{amount: number, multiplier: number}}
 */
export function campaignStress(amount, effects = campaignRules()) {
  const multiplier = number(campaignEffectAliases(effects).stressMultiplier, 1);
  if (!Number.isFinite(amount) || amount <= 0 || multiplier === 1) return { amount, multiplier: 1 };
  const scaled = multiplier < 1 ? Math.max(1, Math.floor(amount * multiplier)) : Math.floor(amount * multiplier);
  return { amount: scaled, multiplier };
}

/** Falling damage after Wire Fu (halved, rounded down) for player and special characters (p.408). */
export const campaignFallingDamage = (amount, { special = true } = {}, effects = campaignRules()) => {
  const multiplier = number(campaignEffectAliases(effects).fallingDamageMultiplier, 1);
  return special && multiplier !== 1 && Number.isFinite(amount) ? Math.floor(amount * multiplier) : amount;
};

/** Tense: nobody may take 10 (p.408). Returns the refusal, or "" when taking 10 is allowed. */
export const takeTenRefusal = (method, effects = campaignRules()) =>
  method === "take10" && campaignEffectAliases(effects).noTakeTen === true
    ? loc`Not done: the Tense campaign quality forbids taking 10. Roll the check instead (p.408).`
    : "";

/** Omni-Competent: skill checks have no result cap (p.408). */
export const skillCapsLifted = (effects = campaignRules()) => campaignEffectAliases(effects).noSkillResultCaps === true;

/** A skill DC after Cakewalk (−5, minimum 10) or Comedy of Errors (+5) (p.406). */
export function campaignSkillDC(dc, effects = campaignRules()) {
  if (!Number.isFinite(dc)) return dc;
  const shift = Math.trunc(number(campaignEffectAliases(effects).skillDC, 0));
  if (shift < 0) return Math.max(Math.min(dc, number(campaignEffectAliases(effects).skillDCMinimum, 10)), dc + shift);
  return dc + shift;
}

/**
 * Whether a character counts as a player or special character for a campaign quality: an agent, a special NPC or
 * villain, or a standard NPC promoted for this mission (p.398).
 */
export function isSpecialCharacter(system) {
  if (!["standard", "animal"].includes(system?.npcType)) return true;
  return !!system?.promotion && system.promotion.mission === String(system.usagePeriods?.mission ?? "initial");
}

/** A Medicine DC after Cakewalk or Comedy of Errors and after Gritty or Bulletproof (pp.406–407). */
export const campaignMedicineDC = (dc, effects = campaignRules()) =>
  campaignSkillDC(dc, effects) + Math.trunc(number(campaignEffectAliases(effects).medicineDC, 0));

/** Blockbuster (p.406): a player character's successful save that would halve damage resists it entirely. */
export const halfSaveResistsFully = (effects = campaignRules()) =>
  campaignEffectAliases(effects).halfSaveResistsFully === true;

/** Bloodbath: a player or special character's threat on a successful attack becomes a critical hit for free. */
export const threatsAutoActivate = (effects = campaignRules()) =>
  campaignEffectAliases(effects).autoActivateThreats === true;

/** Speed-Frame (+1) and Thriller (−1): the change to every Lead Advantage's effect in a Dramatic Conflict (p.408). */
export const leadAdvantageShift = (effects = campaignRules()) =>
  Math.trunc(number(campaignEffectAliases(effects).leadAdvantageShift, 0));

/** Speed-Frame (−1, minimum 1) and Thriller (+1): Challenges needed to complete a Complex Task (p.408). */
export const complexTaskChallenges = (base, effects = campaignRules()) =>
  Number.isFinite(base)
    ? Math.max(1, base + Math.trunc(number(campaignEffectAliases(effects).complexTaskChallenges, 0)))
    : base;

/** Virtuous (×2) and Corrupt (×½, rounded down): the multiplier on honor-code exposure penalties (p.436). */
export const honorExposureMultiplier = (effects = campaignRules()) =>
  number(campaignEffectAliases(effects).honorExposureMultiplier, 1);

/** Player character action dice: whether they explode on a natural 1 too, never explode, and the die-type step. */
export function campaignActionDice(effects = campaignRules()) {
  return {
    explodeLow: campaignEffectAliases(effects).actionDiceExplodeLow === true,
    noExplode: campaignEffectAliases(effects).actionDiceExplode === false,
    step: Math.trunc(number(campaignEffectAliases(effects).actionDieStep, 0))
  };
}

/**
 * Paranoid (p.408): +4 morale on Blend and Hide checks that decide a surprise round for player and special
 * characters, and −4 morale for everyone on checks made to shift a disposition or talk someone into acting.
 */
export function paranoidModifier({ surpriseCheck = false, dispositionCheck = false, special = true } = {}, effects) {
  effects ??= campaignRules();
  const rows = [];
  if (surpriseCheck && special && campaignEffectAliases(effects).surpriseHideBonus)
    rows.push({
      label: loc`Paranoid campaign quality (surprise)`,
      value: Math.trunc(campaignEffectAliases(effects).surpriseHideBonus)
    });
  if (dispositionCheck && campaignEffectAliases(effects).dispositionCheckModifier)
    rows.push({
      label: loc`Paranoid campaign quality (persuasion)`,
      value: Math.trunc(campaignEffectAliases(effects).dispositionCheckModifier)
    });
  return rows;
}

/** One line per quality effect that this module applies, for the GC Console. */
export function campaignRuleLines(effects = campaignRules(), { money = amount => amount } = {}) {
  const lines = [];
  const gear = Math.trunc(number(campaignEffectAliases(effects).gearCaliberShift, 0));
  if (gear)
    lines.push(
      gear > 0
        ? loc`Gear picks: +${gear} Caliber over the mission's (past V, an extra Caliber I item of that type).`
        : loc`Gear picks: ${gear} Caliber under the mission's (below I, the pick is lost).`
    );
  if (campaignEffectAliases(effects).historicalGear)
    lines.push(loc`Gear not yet introduced in the campaign year: a gadget at +1 Caliber, none past V (p.407).`);
  if (campaignWealthBonus(effects)) lines.push(loc`Starting Wealth +${campaignWealthBonus(effects)}.`);
  const growth = campaignGrowth(effects);
  if (growth.xpFraction !== 1) lines.push(loc`XP for each level ×${growth.xpFraction}.`);
  if (growth.attributeInterval !== 4)
    lines.push(loc`An attribute increase every ${growth.attributeInterval} career levels.`);
  if (growth.featInterval !== 3) lines.push(loc`A feat every ${growth.featInterval} career levels.`);
  if (growth.interestInterval !== 4) lines.push(loc`An Interest every ${growth.interestInterval} career levels.`);
  if (growth.proficiencyInterval !== 2)
    lines.push(
      growth.proficiencyInterval === 1
        ? loc`A proficiency every career level.`
        : loc`A proficiency every ${growth.proficiencyInterval} career levels.`
    );
  if (campaignEffectAliases(effects).pointBuy)
    lines.push(loc`Starting attributes: ${campaignEffectAliases(effects).pointBuy} points, none above 18.`);
  if (campaignEffectAliases(effects).fixedVitality)
    lines.push(loc`Vitality after Level 1: 2, 3 or 4 a level by vitality die.`);
  if (campaignEffectAliases(effects).allClassSkills) lines.push(loc`Every skill is a class skill.`);
  const attack = campaignAttackTerms(effects);
  if (attack.threat) lines.push(loc`Every attack: threat range +${attack.threat}.`);
  if (attack.modifier)
    lines.push(loc`Every attack check: ${attack.modifier > 0 ? "+" : "−"}${Math.abs(attack.modifier)}.`);
  if (number(campaignEffectAliases(effects).rangeIncrementMultiplier, 1) !== 1)
    lines.push(loc`Range increments ×${campaignEffectAliases(effects).rangeIncrementMultiplier}.`);
  if (number(campaignEffectAliases(effects).blastIncrementMultiplier, 1) !== 1)
    lines.push(loc`Blast increments ×${campaignEffectAliases(effects).blastIncrementMultiplier}.`);
  if (triumphResult(effects) !== 75) lines.push(loc`Triumph at a result of ${triumphResult(effects)} or more.`);
  const band = criticalInjuryBand(effects);
  if (band.changed)
    lines.push(loc`Critical injury save from ${band.min} damage in one hit; wounds drop to −9 from ${band.massive}.`);
  if (criticalInjuryCostShift(effects))
    lines.push(
      loc`Critical injury on a player or special character: activation cost ${criticalInjuryCostShift(effects) > 0 ? "+" : "−"}${Math.abs(criticalInjuryCostShift(effects))}.`
    );
  if (number(campaignEffectAliases(effects).stressMultiplier, 1) !== 1)
    lines.push(loc`Stress damage ×${campaignEffectAliases(effects).stressMultiplier}.`);
  if (campaignEffectAliases(effects).noTakeTen) lines.push(loc`Nobody may take 10.`);
  if (skillCapsLifted(effects)) lines.push(loc`Skill checks have no result cap.`);
  if (Number.isFinite(campaignEffectAliases(effects).medicineDC) && campaignEffectAliases(effects).medicineDC)
    lines.push(
      loc`Medicine DCs ${campaignEffectAliases(effects).medicineDC > 0 ? "+" : "−"}${Math.abs(campaignEffectAliases(effects).medicineDC)}.`
    );
  if (Number.isFinite(campaignEffectAliases(effects).medicineError) && campaignEffectAliases(effects).medicineError)
    lines.push(
      loc`Medicine error ranges ${campaignEffectAliases(effects).medicineError > 0 ? "+" : "−"}${Math.abs(campaignEffectAliases(effects).medicineError)}.`
    );
  if (Number.isFinite(campaignEffectAliases(effects).skillDC) && campaignEffectAliases(effects).skillDC)
    lines.push(
      loc`Skill DCs ${campaignEffectAliases(effects).skillDC > 0 ? "+" : "−"}${Math.abs(campaignEffectAliases(effects).skillDC)}.`
    );
  if (halfSaveResistsFully(effects))
    lines.push(loc`A player character's successful save that would halve damage avoids it entirely.`);
  if (threatsAutoActivate(effects))
    lines.push(loc`Threats on hits by player and special characters are critical hits.`);
  if (leadAdvantageShift(effects))
    lines.push(
      loc`Dramatic Conflict Lead Advantages ${leadAdvantageShift(effects) > 0 ? "+" : "−"}${Math.abs(leadAdvantageShift(effects))}.`
    );
  if (campaignEffectAliases(effects).bottomlessClip) lines.push(loc`Weapons that hold 5 or more shots never run out.`);
  if (campaignEffectAliases(effects).halveSkillPenalties)
    lines.push(loc`Skill check penalties are halved, rounding down, to −1 at least.`);
  if (campaignEffectAliases(effects).allChecksActive)
    lines.push(loc`Every check is active: none is rolled in secret or barred from action dice.`);
  if (campaignErrorActivationCap(effects))
    lines.push(loc`A skill error costs at most ${campaignErrorActivationCap(effects)} action dice to activate.`);
  if (campaignTake10Time(2, effects) > 2)
    lines.push(loc`Taking 10 takes ${campaignTake10Time(2, effects)} times as long.`);
  if (campaignTriumphXPPercent(10, effects) !== 10)
    lines.push(loc`A Triumph adds ${campaignTriumphXPPercent(10, effects)}% to the mission's XP.`);
  if (campaignCqbRange(false, effects) !== 30)
    lines.push(loc`CQB Range reaches ${campaignCqbRange(false, effects)} ft.`);
  if (campaignEffectAliases(effects).meleeFeatRangedDefense)
    lines.push(loc`Each Melee or Unarmed Combat feat gives +1 Defense against ranged attacks, NPCs included.`);
  if (campaignEffectAliases(effects).featPurchase)
    lines.push(loc`After a mission an agent may buy a feat for 1,000 XP per career level.`);
  if (campaignEffectAliases(effects).modularFeats)
    lines.push(loc`At creation a feat costs 2 attribute points, or gives 2 when given up.`);
  if (campaignEffectAliases(effects).noCrossroads) lines.push(loc`No Crossroads Subplots, so no Crossroads Titles.`);
  if (campaignDebtSubplot(effects)) lines.push(loc`Every agent starts with a Debt Subplot (p.55).`);
  if (campaignSubplotBonus(effects))
    lines.push(loc`Each agent may have ${campaignSubplotBonus(effects)} more Subplot(s) in play.`);
  if (campaignEffectAliases(effects).closedStandOffs) lines.push(loc`Nobody may interrupt or join a Stand Off.`);
  if (campaignEffectAliases(effects).catchPhrase)
    lines.push(
      loc`Catch Phrase: once per session, on a threat, a line said as a free action gives Defense and Resist morale.`
    );
  if (campaignEffectAliases(effects).goodAndEvil)
    lines.push(
      loc`Every character is Good or Evil: +2 against the other side at your call, and 1 action die for a fitting act.`
    );
  if (campaignEffectAliases(effects).revolvingDoor)
    lines.push(
      // The price is a money value, so Historical scales it by Table 7.4 (p.407): `money` does that.
      loc`An agent killed in a standard scene with the body whole may return next mission for 200 Reputation or $${money(10000000).toLocaleString("en-US")}.`
    );
  return lines;
}

/** The checks its surprise bonus covers: Blend/Stealth and Sneak/Hide (p.408). */
const SURPRISE_CHECKS = { blend: "stealth", sneak: "hide" };
const ATTRIBUTES = ["str", "dex", "con", "int", "wis", "cha"];

/**
 * A skill check's campaign-quality terms (pp.406–408): Paranoid's morale bonus or penalty, Comedy of Errors' +2 error
 * range on a check keyed to the character's lowest attribute, and a note of the DC shift under Cakewalk or Comedy of
 * Errors for the GC, who sets the DC.
 */
export function campaignSkillPlan(system, skillKey, check, input = {}, effects = campaignRules()) {
  const bonuses = [],
    notes = [];
  let errorIncrease = 0;
  const special = isSpecialCharacter(system);
  const surpriseCheck = input.surprise === true && SURPRISE_CHECKS[skillKey] === check?.id;
  const dispositionCheck = input.paranoidPersuasion === true || input.shiftingDisposition === true;
  for (const row of paranoidModifier({ surpriseCheck, dispositionCheck, special }, effects)) {
    bonuses.push({ type: "morale", value: row.value, source: row.label });
    notes.push(loc`${row.label}: ${row.value > 0 ? "+" : "−"}${Math.abs(row.value)} morale (p.408).`);
  }
  const lowestIncrease = Math.trunc(number(campaignEffectAliases(effects).lowestAttributeErrorIncrease, 0));
  if (lowestIncrease && check?.attributes?.length) {
    const scores = ATTRIBUTES.map(key => Number(system?.abilities?.[key]?.value)).filter(Number.isFinite);
    const lowest = Math.min(...scores),
      keyAttribute = Number(system?.abilities?.[input.ability ?? check.attributes[0]]?.value);
    if (scores.length === 6 && keyAttribute === lowest) {
      errorIncrease = lowestIncrease;
      notes.push(
        loc`Comedy of Errors: error range +${lowestIncrease}, as this check uses the lowest attribute (p.406).`
      );
    }
  }
  // Bulletproof and Gritty (pp.406–407): Medicine DCs and error ranges move with the setting's toughness.
  if (skillKey === "medicine") {
    const medicineError = Math.trunc(number(campaignEffectAliases(effects).medicineError, 0)),
      medicineDC = Math.trunc(number(campaignEffectAliases(effects).medicineDC, 0));
    if (medicineError) {
      errorIncrease += medicineError;
      notes.push(loc`Medicine error range ${medicineError > 0 ? "+" : "−"}${Math.abs(medicineError)} (pp.406–407).`);
    }
    if (medicineDC)
      notes.push(loc`Medicine: the DC is ${Math.abs(medicineDC)} ${medicineDC > 0 ? "higher" : "lower"} (pp.406–407).`);
  }
  const shift = Math.trunc(number(campaignEffectAliases(effects).skillDC, 0));
  if (shift)
    notes.push(
      shift < 0
        ? loc`Cakewalk: the DC is ${Math.abs(shift)} lower, but never below ${number(campaignEffectAliases(effects).skillDCMinimum, 10)} (p.406).`
        : loc`Comedy of Errors: the DC is ${shift} higher (p.406).`
    );
  return { bonuses, notes, errorIncrease };
}

/* -------------------------------------------- */
/*  Season qualities that change how characters are built and grow (pp.405–408)  */
/* -------------------------------------------- */

const interval = (value, fallback) => (Number.isSafeInteger(value) && value > 0 ? value : fallback);

/**
 * The growth schedule under the qualities in force: Fast and Slow Attributes, Feats, Interests and Proficiencies
 * change how often each comes; Fast and Slow Growth change the XP for each level.
 */
export function campaignGrowth(effects = campaignRules()) {
  return {
    attributeInterval: interval(campaignEffectAliases(effects).attributeInterval, 4),
    featInterval: interval(campaignEffectAliases(effects).featInterval, 3),
    interestInterval: interval(campaignEffectAliases(effects).interestInterval, 4),
    proficiencyInterval: interval(campaignEffectAliases(effects).proficiencyInterval, 2),
    xpFraction: number(campaignEffectAliases(effects).xpToLevelFraction, 1)
  };
}

/** The career levels that bring an attribute increase: every 4th, or every 3rd or 5th. */
export function abilityIncreaseLevels(effects = campaignRules()) {
  const every = campaignGrowth(effects).attributeInterval,
    levels = [];
  for (let level = every; level <= 20; level += every) levels.push(level);
  return levels;
}

/**
 * Table 1.3's row for a level, with the counts the growth qualities change. With no such quality the printed row is
 * returned as it is. Feats: 1 at Level 1 and one more every 3 levels; proficiencies: one every 2 levels from Level 3;
 * interests: one every 4 levels from Level 2; attribute increases: one every 4 levels.
 */
/** How many levels a character may gain between two missions: 1, or 2 under Fast Growth (pp.27, 407). */
export const levelsBetweenMissions = (effects = campaignRules()) =>
  Number.isSafeInteger(campaignEffectAliases(effects).levelsBetweenMissions) &&
  campaignEffectAliases(effects).levelsBetweenMissions > 0
    ? campaignEffectAliases(effects).levelsBetweenMissions
    : 1;

export function campaignLevelRow(row, effects = campaignRules()) {
  if (!row) return row;
  const growth = campaignGrowth(effects),
    level = row.level;
  const standard =
    growth.attributeInterval === 4 &&
    growth.featInterval === 3 &&
    growth.interestInterval === 4 &&
    growth.proficiencyInterval === 2 &&
    growth.xpFraction === 1;
  if (standard) return row;
  const interests = level >= 2 && (level - 2) % growth.interestInterval === 0 ? 1 : 0;
  return {
    ...row,
    xp: level > 1 ? Math.floor(row.xp * growth.xpFraction) : row.xp,
    feats: level >= 1 ? 1 + Math.floor(level / growth.featInterval) : 0,
    abilityIncreases: Math.floor(level / growth.attributeInterval),
    proficiencies: level >= 1 ? Math.floor((level - 1) / growth.proficiencyInterval) : 0,
    interests
  };
}

/** Interests known at a level: 2, and one more at Level 2 and every 4 levels after (every 3rd or 5th under the
 * Interests qualities). `printed` is Table 1.3's figure, kept when no such quality is in force. */
export function campaignInterestBase(level, printed, effects = campaignRules()) {
  const every = campaignGrowth(effects).interestInterval;
  if (every === 4) return printed;
  return 2 + (level >= 2 ? 1 + Math.floor((level - 2) / every) : 0);
}

/** Starting attribute points: 36, or 32 under Small Screen (p.408). */
export const campaignPointBuy = (standard = 36, effects = campaignRules()) =>
  Number.isSafeInteger(campaignEffectAliases(effects).pointBuy) ? campaignEffectAliases(effects).pointBuy : standard;

/** Fragile (p.406): the fixed vitality a level after the first gives, by vitality die; null when not in force. */
export function fragileVitality(die, effects = campaignRules()) {
  if (!campaignEffectAliases(effects).fixedVitality) return null;
  return { 8: 2, 10: 3, 12: 4 }[die] ?? null;
}

/** Jack-of-All-Trades (p.407): every skill is a class skill for every class. */
export const allClassSkills = (effects = campaignRules()) => campaignEffectAliases(effects).allClassSkills === true;

/** Extra starting Wealth (Big Budget +4, p.405). */
export const campaignWealthBonus = (effects = campaignRules()) =>
  Math.trunc(number(campaignEffectAliases(effects).wealthBonus, 0));

/** The feat trees a season quality opens: a feat from one may be taken in place of any other feat choice. */
export const campaignFeatTrees = (effects = campaignRules()) =>
  Array.isArray(campaignEffectAliases(effects).bonusFeatTrees) ? campaignEffectAliases(effects).bonusFeatTrees : [];

/**
 * Big Budget and Shoe-String Budget (pp.405, 408): every gear pick is 1 Caliber higher or lower than the mission
 * allows. Returns the Caliber a pick may reach, and whether the shift ran past V (an extra Caliber I item of the type)
 * or below I (the pick is lost).
 */
export function campaignGearCaliber(caliber, effects = campaignRules()) {
  const shift = Math.trunc(number(campaignEffectAliases(effects).gearCaliberShift, 0)),
    raw = caliber + shift;
  return { caliber: Math.max(1, Math.min(5, raw)), shift, pastV: raw > 5, lost: raw < 1 };
}

/** Omni-Competent (p.408): a function that halves a skill penalty (rounded down, never past −1), or leaves it. */
export function omniPenalty(effects = campaignRules()) {
  if (!campaignEffectAliases(effects).halveSkillPenalties) return value => value;
  return value => (value < 0 ? Math.min(-1, -Math.floor(-value / 2)) : value);
}

/** Comedy of Errors (p.406): the most action dice a skill error may cost to activate, or null. */
export function campaignErrorActivationCap(effects = campaignRules()) {
  const cap = campaignEffectAliases(effects).errorActivationDiceMaximum;
  return Number.isSafeInteger(cap) && cap > 0 ? cap : null;
}

/** Take 10's time: ×2 normally, ×4 under Comedy of Errors (p.406). `standard` is the skill's own multiplier. */
export function campaignTake10Time(standard = 2, effects = campaignRules()) {
  const multiplier = campaignEffectAliases(effects).take10TimeMultiplier;
  return Number.isFinite(multiplier) && multiplier > standard ? multiplier : standard;
}

/** The share of mission XP a Triumph adds (p.440): 10%, or 5% under Common Spectacle (p.406). */
export function campaignTriumphXPPercent(standard = 10, effects = campaignRules()) {
  return Number.isFinite(campaignEffectAliases(effects).triumphXPPercent)
    ? campaignEffectAliases(effects).triumphXPPercent
    : standard;
}

/**
 * CQB Range in feet (p.327): 30, or 60 with Marksmanship Supremacy or under Gunmen (p.407). Gladiators (p.407) sets
 * it to 20 for everyone without a 60 ft. source.
 */
export function campaignCqbRange(supremacy = false, effects = campaignRules()) {
  if (supremacy || number(campaignEffectAliases(effects).rangeIncrementMultiplier, 1) !== 1) return 60;
  return Number.isSafeInteger(campaignEffectAliases(effects).cqbRange) && campaignEffectAliases(effects).cqbRange > 0
    ? campaignEffectAliases(effects).cqbRange
    : 30;
}

const MELEE_TREES = new Set(["meleecombat", "unarmedcombat"]);

/**
 * Gladiators (p.407): +1 Defense against ranged attacks for each Melee or Unarmed Combat feat a character holds.
 * `system.activeFeatSelections` lists each feat with its tree, for agents and NPCs alike.
 */
export function gladiatorsDefense(system, ranged = true, effects = campaignRules()) {
  if (!ranged || !campaignEffectAliases(effects).meleeFeatRangedDefense) return 0;
  return (system?.activeFeatSelections ?? []).filter(feat =>
    MELEE_TREES.has(
      String(feat.tree ?? "")
        .toLowerCase()
        .replace(/[^a-z]/g, "")
    )
  ).length;
}

/**
 * Feat Purchase and Modular (pp.406–407): extra feat choices and the attribute points they cost or give. Trades the
 * qualities in force do not allow are reported and left out.
 */
export function campaignFeatTrades(trades = {}, effects = campaignRules()) {
  const purchased = Math.max(0, Math.trunc(Number(trades?.purchased) || 0)),
    modular = Math.trunc(Number(trades?.modular) || 0),
    problems = [];
  if (purchased && !campaignEffectAliases(effects).featPurchase)
    problems.push(loc`${purchased} feat(s) bought with XP, but Feat Purchase is not in force.`);
  if (modular && !campaignEffectAliases(effects).modularFeats)
    problems.push(loc`Feats traded for attribute points, but Modular is not in force.`);
  const feats =
      (campaignEffectAliases(effects).featPurchase ? purchased : 0) +
      (campaignEffectAliases(effects).modularFeats ? modular : 0),
    points = campaignEffectAliases(effects).modularFeats ? -2 * modular : 0;
  return { feats, points, purchased, modular, problems };
}

/** Whether the mission setting says a mission is under way (false before the settings are registered). */
export function missionUnderWay() {
  try {
    return globalThis.game?.settings?.get("spycraft2", "mission")?.active === true;
  } catch {
    return false;
  }
}

/**
 * Feat Purchase (p.407): the XP a feat costs at a career level, and whether the character can pay it. The trade is
 * made at the end of a mission, so it is refused while one is under way.
 */
export function featPurchasePlan(
  system,
  levelRow,
  effects = campaignRules(),
  { missionActive = missionUnderWay() } = {}
) {
  if (!campaignEffectAliases(effects).featPurchase)
    return { allowed: false, reason: loc`Feat Purchase is not in force this season.` };
  if (missionActive)
    return { allowed: false, reason: loc`A mission is under way. A feat is bought with XP when the mission ends.` };
  const level = Number(system?.level) || 0;
  if (level < 1) return { allowed: false, reason: loc`Finish Level 1 before buying a feat.` };
  const mission = String(system?.usagePeriods?.mission ?? "initial");
  if (system?.featTrades?.purchaseMission && system.featTrades.purchaseMission === mission)
    return {
      allowed: false,
      reason: loc`A feat has already been bought for this mission; one may be bought after each.`
    };
  const cost = 1000 * level,
    xp = Number(system?.xp) || 0,
    minimum = Number(levelRow?.xp) || 0;
  if (xp - cost < minimum)
    return {
      allowed: false,
      cost,
      reason: loc`A feat costs ${cost} XP at Level ${level}, which would take XP below ${minimum}, this level's minimum.`
    };
  return { allowed: true, cost, xp: xp - cost, mission };
}

/** Soap (p.408): extra Subplots each character may have in play. */
/** Shoe String Budget (p.408): every player character starts with a Debt Subplot (p.55). */
export const campaignDebtSubplot = (effects = campaignRules()) => campaignEffectAliases(effects).debtSubplot === true;

export const campaignSubplotBonus = (effects = campaignRules()) =>
  Number.isSafeInteger(campaignEffectAliases(effects).subplotLimitBonus)
    ? campaignEffectAliases(effects).subplotLimitBonus
    : 0;

/** Routine (p.408): no Crossroads Subplots, so no Crossroads Titles. */
export const crossroadsAllowed = (effects = campaignRules()) => !campaignEffectAliases(effects).noCrossroads;

/** Small Screen (p.408): the highest a starting attribute may be with its Origin, or null with no such limit. */
export const campaignStartingAttributeCap = (effects = campaignRules()) =>
  campaignEffectAliases(effects).pointBuy ? 18 : null;
