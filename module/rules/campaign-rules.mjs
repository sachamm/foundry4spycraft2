/**
 * Campaign qualities in play (pp.405–408): the numbers the qualities in force change during a session.
 *
 * The qualities are world state, so this module does not read them itself. The Foundry layer registers a source
 * (`setCampaignRulesSource`, from module/apps/gc/state.mjs) that returns the merged effects of the qualities in
 * force; with no source every function here gives the book's standard numbers. Tests pass effects directly.
 */
import { loc } from "../i18n.mjs";
import { rollPipeline, skillPlanTerm } from "./roll-pipeline.mjs";

let source = () => ({});

/** Register the function that returns the merged effects of the qualities in force (`campaignEffects().effects`). */
export function setCampaignRulesSource(fn) {
  source = typeof fn === "function" ? fn : () => ({});
}

/** The merged effects of the qualities in force, or {} when none are or the world is not ready. */
export function campaignRules() {
  try {
    const effects = source();
    return effects && typeof effects === "object" ? effects : {};
  } catch {
    return {};
  }
}

const number = (value, fallback) => (Number.isFinite(value) ? value : fallback);

/** The skill (and attack) result at which a Triumph occurs: 75, or 60 / 90 under the Spectacle qualities (p.406). */
export const triumphResult = (effects = campaignRules()) => number(effects.triumphResult, 75);

/**
 * Attack terms from Violent (threat range +2) and Subtle (−1 to every attack check), for any character (p.408).
 * @returns {{threat: number, modifier: number, rows: Array<[string, number]>, notes: string[]}}
 */
export function campaignAttackTerms(effects = campaignRules()) {
  const threat = Math.max(0, Math.trunc(number(effects.attackThreatIncrease, 0))),
    modifier = Math.trunc(number(effects.attackModifier, 0));
  return {
    threat,
    modifier,
    rows: modifier ? [[loc`Campaign quality`, modifier]] : [],
    notes: threat ? [loc`Campaign quality: threat range +${threat} on every attack (p.408).`] : []
  };
}

/** Range increments after Gunmen (doubled, p.407). */
export const campaignRangeIncrement = (increment, effects = campaignRules()) =>
  Number.isFinite(increment) ? increment * number(effects.rangeIncrementMultiplier, 1) : increment;

/** Blast increments after Blockbuster (tripled, p.406). */
export const campaignBlastIncrement = (increment, effects = campaignRules()) =>
  Number.isFinite(increment) ? increment * number(effects.blastIncrementMultiplier, 1) : increment;

/**
 * Critical injury damage bands after Bulletproof or Gritty (p.406). Standard: 25–49 calls for the save, 50 or more
 * also drops wounds to −9 (p.331).
 */
export function criticalInjuryBand(effects = campaignRules()) {
  const [min] = Array.isArray(effects.criticalInjuryRange) ? effects.criticalInjuryRange : [25];
  const massive = number(effects.massiveDamageThreshold, 50);
  return { min: number(min, 25), massive, changed: min !== 25 || massive !== 50 };
}

/** Extra action dice to activate a critical injury on a player or special character (Bulletproof +1, Gritty −1). */
export const criticalInjuryCostShift = (effects = campaignRules()) =>
  Math.trunc(number(effects.criticalInjuryActivationCost, 0));

/**
 * Stress damage after Tense (doubled) or Mellow (halved, rounded down, minimum 1) (pp.407–408).
 * @returns {{amount: number, multiplier: number}}
 */
export function campaignStress(amount, effects = campaignRules()) {
  const multiplier = number(effects.stressMultiplier, 1);
  if (!Number.isFinite(amount) || amount <= 0 || multiplier === 1) return { amount, multiplier: 1 };
  const scaled = multiplier < 1 ? Math.max(1, Math.floor(amount * multiplier)) : Math.floor(amount * multiplier);
  return { amount: scaled, multiplier };
}

/** Falling damage after Wire Fu (halved, rounded down) for player and special characters (p.408). */
export const campaignFallingDamage = (amount, { special = true } = {}, effects = campaignRules()) => {
  const multiplier = number(effects.fallingDamageMultiplier, 1);
  return special && multiplier !== 1 && Number.isFinite(amount) ? Math.floor(amount * multiplier) : amount;
};

/** Tense: nobody may take 10 (p.408). Returns the refusal, or "" when taking 10 is allowed. */
export const takeTenRefusal = (method, effects = campaignRules()) =>
  method === "take10" && effects.noTakeTen === true
    ? loc`Not done: the Tense campaign quality forbids taking 10. Roll the check instead (p.408).`
    : "";

/** Omni-Competent: skill checks have no result cap (p.408). */
export const skillCapsLifted = (effects = campaignRules()) => effects.noSkillResultCaps === true;

/** A skill DC after Cakewalk (−5, minimum 10) or Comedy of Errors (+5) (p.406). */
export function campaignSkillDC(dc, effects = campaignRules()) {
  if (!Number.isFinite(dc)) return dc;
  const shift = Math.trunc(number(effects.skillDC, 0));
  if (shift < 0) return Math.max(Math.min(dc, number(effects.skillDCMinimum, 10)), dc + shift);
  return dc + shift;
}

/** Bloodbath: a player or special character's threat on a successful attack becomes a critical hit for free. */
export const threatsAutoActivate = (effects = campaignRules()) => effects.autoActivateThreats === true;

/** Speed-Frame (+1) and Thriller (−1): the change to every Lead Advantage's effect in a Dramatic Conflict (p.408). */
export const leadAdvantageShift = (effects = campaignRules()) => Math.trunc(number(effects.leadAdvantageShift, 0));

/** Speed-Frame (−1, minimum 1) and Thriller (+1): Challenges needed to complete a Complex Task (p.408). */
export const complexTaskChallenges = (base, effects = campaignRules()) =>
  Number.isFinite(base) ? Math.max(1, base + Math.trunc(number(effects.complexTaskChallenges, 0))) : base;

/** Virtuous (×2) and Corrupt (×½, rounded down): the multiplier on honor-code exposure penalties (p.436). */
export const honorExposureMultiplier = (effects = campaignRules()) => number(effects.honorExposureMultiplier, 1);

/** Player character action dice: whether they explode on a natural 1 too, never explode, and the die-type step. */
export function campaignActionDice(effects = campaignRules()) {
  return {
    explodeLow: effects.actionDiceExplodeLow === true,
    noExplode: effects.actionDiceExplode === false,
    step: Math.trunc(number(effects.actionDieStep, 0))
  };
}

/**
 * Paranoid (p.408): +4 morale on Blend and Hide checks that decide a surprise round for player and special
 * characters, and −4 morale for everyone on checks made to shift a disposition or talk someone into acting.
 */
export function paranoidModifier({ surpriseCheck = false, dispositionCheck = false, special = true } = {}, effects) {
  effects ??= campaignRules();
  const rows = [];
  if (surpriseCheck && special && effects.surpriseHideBonus)
    rows.push({ label: loc`Paranoid campaign quality (surprise)`, value: Math.trunc(effects.surpriseHideBonus) });
  if (dispositionCheck && effects.dispositionCheckModifier)
    rows.push({
      label: loc`Paranoid campaign quality (persuasion)`,
      value: Math.trunc(effects.dispositionCheckModifier)
    });
  return rows;
}

/** One line per quality effect that this module applies, for the GC Console. */
export function campaignRuleLines(effects = campaignRules()) {
  const lines = [];
  const attack = campaignAttackTerms(effects);
  if (attack.threat) lines.push(loc`Every attack: threat range +${attack.threat}.`);
  if (attack.modifier)
    lines.push(loc`Every attack check: ${attack.modifier > 0 ? "+" : "−"}${Math.abs(attack.modifier)}.`);
  if (number(effects.rangeIncrementMultiplier, 1) !== 1)
    lines.push(loc`Range increments ×${effects.rangeIncrementMultiplier}.`);
  if (number(effects.blastIncrementMultiplier, 1) !== 1)
    lines.push(loc`Blast increments ×${effects.blastIncrementMultiplier}.`);
  if (triumphResult(effects) !== 75) lines.push(loc`Triumph at a result of ${triumphResult(effects)} or more.`);
  const band = criticalInjuryBand(effects);
  if (band.changed)
    lines.push(loc`Critical injury save from ${band.min} damage in one hit; wounds drop to −9 from ${band.massive}.`);
  if (criticalInjuryCostShift(effects))
    lines.push(
      loc`Critical injury on a player or special character: activation cost ${criticalInjuryCostShift(effects) > 0 ? "+" : "−"}${Math.abs(criticalInjuryCostShift(effects))}.`
    );
  if (number(effects.stressMultiplier, 1) !== 1) lines.push(loc`Stress damage ×${effects.stressMultiplier}.`);
  if (effects.noTakeTen) lines.push(loc`Nobody may take 10.`);
  if (skillCapsLifted(effects)) lines.push(loc`Skill checks have no result cap.`);
  if (Number.isFinite(effects.skillDC) && effects.skillDC)
    lines.push(loc`Skill DCs ${effects.skillDC > 0 ? "+" : "−"}${Math.abs(effects.skillDC)}.`);
  if (threatsAutoActivate(effects))
    lines.push(loc`Threats on hits by player and special characters are critical hits.`);
  if (leadAdvantageShift(effects))
    lines.push(
      loc`Dramatic Conflict Lead Advantages ${leadAdvantageShift(effects) > 0 ? "+" : "−"}${Math.abs(leadAdvantageShift(effects))}.`
    );
  return lines;
}

// Violent and Subtle as part of every attack plan, NPCs included (p.408).
rollPipeline.register({
  id: "campaignQualityAttackTerm",
  kinds: ["attack"],
  order: 9140,
  terms() {
    const attack = campaignAttackTerms();
    return { threat: attack.threat, rows: attack.rows, notes: attack.notes, at: 900 };
  }
});

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
  const special = !["standard", "animal"].includes(system?.npcType);
  const surpriseCheck = input.surprise === true && SURPRISE_CHECKS[skillKey] === check?.id;
  const dispositionCheck = input.paranoidPersuasion === true || input.shiftingDisposition === true;
  for (const row of paranoidModifier({ surpriseCheck, dispositionCheck, special }, effects)) {
    bonuses.push({ type: "morale", value: row.value, source: row.label });
    notes.push(loc`${row.label}: ${row.value > 0 ? "+" : "−"}${Math.abs(row.value)} morale (p.408).`);
  }
  const lowestIncrease = Math.trunc(number(effects.lowestAttributeErrorIncrease, 0));
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
  const shift = Math.trunc(number(effects.skillDC, 0));
  if (shift)
    notes.push(
      shift < 0
        ? loc`Cakewalk: the DC is ${Math.abs(shift)} lower, but never below ${number(effects.skillDCMinimum, 10)} (p.406).`
        : loc`Comedy of Errors: the DC is ${shift} higher (p.406).`
    );
  return { bonuses, notes, errorIncrease };
}

// Paranoid's declaration on the skill dialog, shown only while Paranoid is in force.
rollPipeline.register({
  id: "campaignQualityContent:skill",
  dialogs: ["skill"],
  order: 9745,
  dialog: () => [
    {
      at: 721,
      html: campaignRules().dispositionCheckModifier
        ? `<label><input type="checkbox" name="paranoidPersuasion" /> ${loc`This check shifts a disposition or talks someone into acting (Paranoid −4)`}</label>`
        : ""
    }
  ],
  read: ({ entered }, input) => ((entered ?? input)?.paranoidPersuasion === true ? { paranoidPersuasion: true } : null)
});

// Campaign-quality terms in a skill check's plan.
rollPipeline.register({
  id: "campaignQualitySkillTerm",
  kinds: ["skill"],
  order: 9320,
  terms({ system, skillKey, check, input }) {
    const plan = campaignSkillPlan(system, skillKey, check, input ?? {});
    return {
      ...skillPlanTerm("campaignQuality", plan, { noteAt: 990, bonusAt: 990 }),
      errorIncrease: plan.errorIncrease
    };
  }
});
