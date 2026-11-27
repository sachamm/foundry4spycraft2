import { classFeatureLevels } from "./class-features.mjs";
import { loc } from "../i18n.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";

/** Timing notes that the skill check shows through its own timing line; exported so they can be recognised exactly. */
export const intelligenceAnalysisNote = () =>
  loc`Intelligence Analysis: half standard time, rounded up, minimum 1 minute.`;
export const boobyTrapNote = () => loc`Booby Trap: half standard time, rounded down, minimum 1 half action.`;
/** Clever and Vigilant talents (pp.18, 21): +1 to checks that determine surprise, +1 more at Career Levels 4, 8, 12, 16, 20. */
export function talentSurpriseBonus(system) {
  if (!["Clever", "Vigilant"].includes(system?.talentName)) return 0;
  const level = Number.isSafeInteger(system.level) ? system.level : 0;
  return 1 + Math.min(5, Math.floor(level / 4));
}
/** Reviewed conditional class options, pp.36,38,42,46–48,52. */
export function classCheckEffects(
  system,
  skill,
  check,
  { gearCategory = "", usingComputer = false, installingTrap = false, surprise = false } = {}
) {
  const selections = new Set((system.classOptionSelections ?? []).map(entry => `${entry.classId}:${entry.name}`));
  const has = (classId, name) => selections.has(`${classId}:${name}`);
  const result = {
    timeChoices: [],
    bonuses: [],
    errorReductionZero: 0,
    timeMultiplier: 1,
    minimumTimeSeconds: 0,
    timeRounding: null,
    notes: []
  };
  if (["analysis", "investigation", "search"].includes(skill)) {
    const level = classFeatureLevels(system)?.fieldAnalyst ?? 0;
    if (level >= 3)
      result.timeChoices.push({
        id: "questionsI",
        name: loc`All the Right Questions I`,
        multiplier: 0.5,
        minimum: 6,
        rounding: "down",
        errorIncrease: 1,
        automatic: false
      });
    if (level >= 7)
      result.timeChoices.push({
        id: "questionsII",
        name: loc`All the Right Questions II`,
        multiplier: 0.25,
        minimum: 6,
        rounding: "down",
        errorIncrease: 2,
        automatic: false
      });
  }
  if (
    ["electronics", "mechanics"].includes(skill) &&
    check.id === "repair" &&
    (has("scientist", "Elbow Grease") || has("wheelman", "Elbow Grease"))
  ) {
    result.bonuses.push({ value: 4, type: "gear" });
    result.notes.push(loc`Elbow Grease: +4 gear bonus to repair.`);
  }
  if (
    (gearCategory === "E" && has("scientist", "No Worries")) ||
    (gearCategory === "T" && has("snoop", "No Worries"))
  ) {
    result.errorReductionZero = 2;
    result.notes.push(loc`No Worries: error range –2, minimum 0, for the gear being used.`);
  }
  if (
    skill === "investigation" &&
    check.id === "research" &&
    usingComputer &&
    (has("hacker", "Intelligence Analysis") || has("snoop", "Intelligence Analysis"))
  ) {
    result.timeMultiplier = 0.5;
    result.timeSource = "Intelligence Analysis";
    result.minimumTimeSeconds = 60;
    result.timeRounding = "up";
    result.notes.push(intelligenceAnalysisNote());
  }
  if (
    has("intruder", "Booby Trap") &&
    ((["electronics", "mechanics"].includes(skill) && check.id === "sabotage") ||
      (skill === "security" && check.id === "installation" && installingTrap))
  ) {
    result.timeMultiplier = 0.5;
    result.timeSource = "Booby Trap";
    result.minimumTimeSeconds = 3;
    result.timeRounding = "down";
    result.notes.push(boobyTrapNote());
  }
  if (surprise && has("sleuth", "Alertness")) {
    result.bonuses.push({ value: 4, type: "" });
    result.notes.push(loc`Alertness: +4 to determine surprise.`);
  }
  const talentSurprise = surprise ? talentSurpriseBonus(system) : 0;
  if (talentSurprise) {
    result.bonuses.push({ value: talentSurprise, type: "" });
    result.notes.push(loc`${system.talentName}: +${talentSurprise} to determine surprise.`);
  }
  return result;
}

/** Soldier 14, p.50: declare before an attack, Fortitude save or STR/CON skill roll. */
export function oneInAMillionEligible(
  system,
  { checkKind, checkId = "", ability = "", checkMethod = "roll", chooseTwice = false } = {}
) {
  return (
    (classFeatureLevels(system)?.soldier ?? 0) >= 14 &&
    checkMethod === "roll" &&
    !chooseTwice &&
    (checkKind === "attack" ||
      (checkKind === "save" && checkId === "fort") ||
      (checkKind === "skill" && ["str", "con"].includes(ability)))
  );
}

/** Master Thief, p.38. User decision: its fixed result overrides the general p.88 cap. */
export function hasMasterThief(system) {
  return (system.classOptionSelections ?? []).some(e => e.classId === "intruder" && e.name === "Master Thief");
}
export function masterThiefPlan(
  system,
  cfg,
  {
    skillKey = "",
    focus = "",
    opponentResult,
    opposedConfirmed = false,
    opponentFinalConfirmed = false,
    declaredBeforeRolling = false
  } = {}
) {
  if (!hasMasterThief(system)) throw new Error(loc`An earned Intruder Master Thief option is required.`);
  if (
    !(cfg.classFeatures?.intruder?.classSkills ?? []).includes(skillKey) ||
    (system.skillTotals?.[skillKey]?.ranks ?? 0) < 4
  )
    throw new Error(loc`Choose an Intruder class skill in which you possess at least four ranks.`);
  if (opposedConfirmed !== true || opponentFinalConfirmed !== true || declaredBeforeRolling !== true)
    throw new Error(
      loc`Declare Master Thief instead of rolling an opposed check and confirm the opponent’s final result.`
    );
  const opponent = Number(opponentResult),
    total = opponent + 1;
  if (
    !["number", "string"].includes(typeof opponentResult) ||
    String(opponentResult).trim() === "" ||
    !Number.isSafeInteger(opponent) ||
    !Number.isSafeInteger(total)
  )
    throw new Error(loc`Enter the opponent’s final whole-number result.`);
  return {
    skillKey,
    focus: String(focus).trim(),
    opponentResult: opponent,
    total,
    cap: null,
    threat: 0,
    error: 0,
    checkMethod: "classAbility",
    actionDiceAllowed: false,
    cannotError: true
  };
}

/** Same non-error fallback, pp.32,36,43–47; borrowing uses assumed levels, pp.40–41. */
export const AUTOMATIC_SKILL_SOURCES = [
  {
    id: "allOverWorld",
    classId: "explorer",
    name: "All Over the World",
    borrowed: "Explorer: All over the world",
    skills: ["athletics", "cultures"]
  },
  { id: "l337", classId: "hacker", name: "’L337", borrowed: "Hacker: ’L337", skills: ["computers", "falsify"] },
  { id: "stalker", classId: "scout", name: "Stalker", borrowed: "Scout: Stalker", skills: ["survival", "tactics"] },
  {
    id: "humanNature",
    classId: "sleuth",
    name: "Human Nature",
    borrowed: "Sleuth: Human nature",
    skills: ["investigation", "senseMotive"]
  },
  {
    id: "flawlessSearch",
    classId: "snoop",
    name: "Flawless Search",
    borrowed: "Snoop: Flawless search",
    skills: ["analysis", "search"]
  }
];
function automaticSkillLevel(system, source) {
  const native = classFeatureLevels(system)?.[source.classId] ?? 0;
  if (native > 0) return native;
  const classes = new Map();
  for (const entry of system.inheritedClassChoices ?? [])
    if (entry.name === source.borrowed) {
      const key = entry.ownerClass ?? entry.ownerId;
      if (key) classes.set(key, Math.max(classes.get(key) ?? 0, entry.assumedLevel ?? 1));
    }
  return [...classes.values()].reduce((a, b) => a + b, 0);
}
export function automaticSkillSuccessSources(system, check) {
  if (check?.checkKind !== "skill") return [];
  return AUTOMATIC_SKILL_SOURCES.filter(source => source.skills.includes(check.skillKey))
    .map(source => ({ ...source, level: automaticSkillLevel(system, source) }))
    .filter(source => source.level > 0);
}
export function automaticSkillSuccessPlan(system, check, { difficultyClass } = {}) {
  const sources = automaticSkillSuccessSources(system, check);
  if (
    !sources.length ||
    check.successConfirmed !== false ||
    check.errorConfirmed ||
    check.criticalFailure ||
    check.resolved ||
    check.superseded
  )
    return null;
  const dc = Number(difficultyClass);
  if (
    !["number", "string"].includes(typeof difficultyClass) ||
    String(difficultyClass).trim() === "" ||
    !Number.isSafeInteger(dc)
  )
    throw new Error(
      loc`Enter the GC-confirmed DC or final opposing result to check ${sources.map(s => s.name).join(" / ")}.`
    );
  const source = sources.sort((a, b) => b.level - a.level).find(s => dc <= s.level + 20);
  return source
    ? {
        id: source.id,
        name: source.name,
        level: source.level,
        threshold: source.level + 20,
        difficultyClass: dc,
        lowestPositiveGrade: true
      }
    : null;
}
/** Compatibility helpers for the previously introduced Snoop workflow. */
export const flawlessSearchLevel = system =>
  automaticSkillLevel(
    system,
    AUTOMATIC_SKILL_SOURCES.find(s => s.id === "flawlessSearch")
  );
export function flawlessSearchPlan(system, check, options = {}) {
  if (!automaticSkillSuccessSources(system, check).some(s => s.id === "flawlessSearch")) return null;
  return automaticSkillSuccessPlan(system, check, options);
}

/** Wheelman pp.50–51; the retry/physical half action is confirmed at the table. */
export function manualAdjustmentSource(system) {
  const native = classFeatureLevels(system)?.wheelman ?? 0;
  const owners = new Map();
  for (const entry of system.inheritedClassChoices ?? [])
    if (entry.name === "Wheelman: Manual adjustment I") {
      const key = entry.ownerClass ?? entry.ownerId;
      if (key) owners.set(key, Math.max(owners.get(key) ?? 0, entry.assumedLevel ?? 2));
    }
  const level = native >= 2 ? native : [...owners.values()].reduce((a, b) => a + b, 0);
  if (level < 2) return null;
  return {
    id: "manualAdjustment",
    name: loc`Manual Adjustment`,
    level,
    threshold: level + 20,
    skills: ["mechanics", ...(native >= 11 ? ["electronics"] : []), ...(native >= 19 ? ["security"] : [])],
    period: "session",
    limit: system.actionDice?.max ?? 0,
    cost: 0,
    workflow: "manualAdjustment"
  };
}
export function manualAdjustmentPlan(
  system,
  check,
  { difficultyClass, device = "", retryConfirmed = false, halfActionConfirmed = false, whackConfirmed = false } = {}
) {
  const source = manualAdjustmentSource(system);
  if (!source || check?.checkKind !== "skill" || !source.skills.includes(check.skillKey))
    throw new Error(loc`Manual Adjustment is not available for this skill.`);
  if (
    check.resolved ||
    check.superseded ||
    check.manualAdjustment ||
    check.criticalFailure ||
    check.criticalSuccess ||
    check.successConfirmed !== false
  )
    throw new Error(loc`Choose a confirmed failed check before any critical activation, resolution or replacement.`);
  if (!retryConfirmed || !halfActionConfirmed || !whackConfirmed || !String(device).trim())
    throw new Error(loc`Confirm the check may be retried, spend a half action, and identify the device being whacked.`);
  const dc = Number(difficultyClass);
  if (
    !["number", "string"].includes(typeof difficultyClass) ||
    String(difficultyClass).trim() === "" ||
    !Number.isSafeInteger(dc) ||
    dc > source.threshold
  )
    throw new Error(loc`The GC-confirmed DC must not exceed effective class level +20.`);
  return {
    name: source.name,
    level: source.level,
    threshold: source.threshold,
    difficultyClass: dc,
    device: String(device).trim(),
    lowestPositiveGrade: true
  };
}

/** Scientist 14, p.43: standalone rolled INT skill, declared before rolling. User decision: generic INT abilities include Knowledge checks. */
export function tenSecondSolutionEligible(
  system,
  {
    checkKind,
    ability,
    checkMethod = "roll",
    chooseTwice = false,
    standaloneCheckConfirmed = false,
    inComplexTask = false,
    inDramaticConflict = false
  } = {}
) {
  return (
    (classFeatureLevels(system)?.scientist ?? 0) >= 14 &&
    ["skill", "knowledge"].includes(checkKind) &&
    ability === "int" &&
    checkMethod === "roll" &&
    !chooseTwice &&
    standaloneCheckConfirmed === true &&
    !inComplexTask &&
    !inDramaticConflict
  );
}

/** Schemer 2/7, p.79; the prose's scene limits govern its conflicting table. */
export function cunningPlanEffect(system, error) {
  const reduction = system.abilities?.int?.mod;
  if ((classFeatureLevels(system)?.schemer ?? 0) < 2 || !Number.isSafeInteger(reduction) || reduction <= 0)
    throw new Error(loc`Cunning Plan requires Schemer 2 and a positive Intelligence modifier.`);
  if (!Number.isSafeInteger(error) || error <= 0)
    throw new Error(loc`This check has no positive error range to reduce.`);
  return { source: "Cunning Plan", reduction, originalError: error, error: Math.max(0, error - reduction) };
}
export function cunningPlanCheck(system, check) {
  if (
    !check ||
    check.checkMethod !== "roll" ||
    check.naturalDie == null ||
    check.resolved ||
    check.superseded ||
    check.criticalFailure ||
    check.criticalSuccess ||
    check.cannotError ||
    check.cunningPlan
  )
    throw new Error(loc`Cunning Plan cannot change this resolved, activated, replaced or already modified check.`);
  const effect = cunningPlanEffect(system, check.error);
  return { ...check, error: effect.error, cunningPlan: effect };
}

/** Scout Huntsman: Game Hunter, p.43; every attack against an animal. */
export function gameHunterAttack(system, { targetAnimal = false } = {}) {
  const earned = (system.classOptionSelections ?? []).some(s => s.classId === "scout" && s.name === "Game Hunter");
  return { earned, targetAnimal: targetAnimal === true, threatIncrease: earned && targetAnimal === true ? 3 : 0 };
}

/** Flanked p.341; Wolfpack p.176. The declaration means this attacker is a flanking opponent. */
export function flankingAttackEffects(
  system,
  weapon,
  { targetFlanked = false, distanceFeet = null, whirlingFlankingProof = null } = {}
) {
  const ranged =
    !["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged"].includes(weapon.proficiency) &&
    !/\bNKL\b/.test(weapon.qualities ?? "");
  if (targetFlanked !== true) return { declared: false, attackBonus: 0, threatIncrease: 0, blocked: false, notes: [] };
  if (whirlingFlankingProof?.prevented)
    return {
      declared: true,
      whirling: whirlingFlankingProof,
      attackBonus: 0,
      threatIncrease: 0,
      blocked: true,
      reason: loc`This lower-level attacker cannot flank the actual opponent in Whirling Stance (p.179).`,
      notes: []
    };
  const has = name =>
    (system.activeFeatNames ?? []).some(
      n => n.toLowerCase().replace(/\s/g, "") === name.toLowerCase().replace(/\s/g, "")
    );
  const distanceKnown =
      distanceFeet !== null &&
      distanceFeet !== undefined &&
      distanceFeet !== "" &&
      Number.isFinite(Number(distanceFeet)),
    blocked = ranged && distanceKnown && Number(distanceFeet) > (system.cqbRange ?? 30);
  const baseBonus = ranged ? 1 : 2,
    wolfpackBonus = has("Wolfpack Basics") ? 2 : 0,
    threatIncrease = has("Wolfpack Supremacy") ? 1 : 0;
  return {
    declared: true,
    ...(whirlingFlankingProof ? { whirling: whirlingFlankingProof } : {}),
    ranged,
    baseBonus,
    wolfpackBonus,
    wolfpackMastery: has("Wolfpack Mastery"),
    attackBonus: baseBonus + wolfpackBonus,
    threatIncrease,
    blocked,
    reason: blocked ? loc`A ranged flanking opponent must be within CQB range (p.341).` : "",
    geometryConfirmed: true,
    notes: [
      loc`Flanking: +${baseBonus + wolfpackBonus} attack (${ranged ? loc`ranged +1` : loc`unarmed/melee +2`}${wolfpackBonus ? loc`, Wolfpack Basics +2` : ""}). Confirm legal positioning, adjacency and ready-weapon conditions (pp.176,341).`,
      ...(has("Wolfpack Mastery")
        ? [loc`Wolfpack Mastery: any configuration qualifies when you and a teammate are adjacent to the opponent.`]
        : []),
      ...(threatIncrease ? [loc`Wolfpack Supremacy: threat range +1 against this flanked opponent.`] : [])
    ]
  };
}

// Flanking (and Wolfpack) and Game Hunter as parts of an attack plan.
rollPipeline.register({
  id: "flankingAttackTerm",
  kinds: ["attack"],
  order: 9100,
  terms({ system, weapon, options }) {
    const plan = flankingAttackEffects(system, weapon, options);
    return {
      key: "flanking",
      plan,
      rowAt: 300,
      rows: [[loc`Flanking`, plan.attackBonus]],
      threat: plan.threatIncrease,
      blockAt: 150,
      blocked: { blocked: !!plan.blocked, reason: plan.reason },
      noteAt: 360,
      notes: plan.notes
    };
  }
});
rollPipeline.register({
  id: "gameHunterAttackTerm",
  kinds: ["attack"],
  order: 9110,
  terms({ system, options }) {
    const plan = gameHunterAttack(system, options);
    return {
      key: "gameHunter",
      plan,
      threat: plan.threatIncrease,
      noteAt: 370,
      notes: plan.threatIncrease ? [loc`Game Hunter: threat range +3 against this animal (p.43).`] : []
    };
  }
});

// Recorded on the posted check as the roll was given them.
rollPipeline.register({ id: "classChecksRecord", order: 9635, record: ["attributeSubstitution"] });
