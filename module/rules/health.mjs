import { classFeatureLevels } from "./class-features.mjs";
import { shakenRules } from "./shaken.mjs";
import { restraintActionBlock } from "./restraints.mjs";
import { attributeCollapsePlan, attributeActionBlock } from "./attributes.mjs";
import { loc } from "../i18n.mjs";
/** Player/special character thresholds, p.331 and Table 5.13, p.349. Death is based on –10, not Constitution. */
export function deathThreshold(size = "Medium") {
  return size === "Small" ? -7 : String(size).startsWith("Large") ? -15 : -10;
}
export function healingPlan(system, { vitalityDice = 0, woundDice = 0, inCombat = false, dead = false } = {}) {
  const cost = vitalityDice + woundDice;
  if (![vitalityDice, woundDice].every(value => Number.isSafeInteger(value) && value >= 0) || cost < 1)
    return { blocked: true, reason: loc`Choose a positive whole number of dice to heal vitality and/or wounds.` };
  if (inCombat) return { blocked: true, reason: loc`Use the Refresh action to heal during combat (p.359).` };
  if (
    dead ||
    attributeCollapsePlan(system).dead ||
    (system.wounds?.value ?? 0) <= (system.deathThreshold ?? deathThreshold(system.size))
  )
    return { blocked: true, reason: loc`A dead character must be saved from death before this healing can be used.` };
  if (cost > (system.actionDice?.value ?? 0)) return { blocked: true, reason: loc`Not enough action dice remain.` };
  if (
    (!vitalityDice || (system.vitality?.value ?? 0) >= (system.vitality?.max ?? 0)) &&
    (!woundDice || (system.wounds?.value ?? 0) >= (system.wounds?.max ?? 0))
  )
    return { blocked: true, reason: loc`The selected health resources are already full.` };
  const die = system.actionDice?.die ?? 4,
    explodeAt = system.actionDice?.explodeAt ?? die,
    bonus = system.actionDice?.bonus ?? 0;
  return {
    blocked: false,
    cost,
    vitalityDice,
    woundDice,
    bonus,
    formula: vitalityDice
      ? Array(vitalityDice)
          .fill(`1d${die}x>=${explodeAt}${bonus ? ` + (${bonus})` : ""}`)
          .join(" + ")
      : null
  };
}
export function healingResult(system, plan, dieResults = []) {
  if (dieResults.length !== plan.vitalityDice || dieResults.some(value => !Number.isFinite(value)))
    throw new Error(loc`One result is required for each vitality healing die.`);
  const bonuses = plan.vitalityBonuses;
  if (
    bonuses !== undefined &&
    (!Array.isArray(bonuses) || bonuses.length !== dieResults.length || bonuses.some(n => !Number.isFinite(n)))
  )
    throw new Error(loc`One modifier is required for each selected vitality healing die.`);
  const vitalityGain = Math.max(
      0,
      dieResults.reduce((sum, value, i) => sum + value + (bonuses?.[i] ?? plan.bonus), 0)
    ),
    woundGain = 2 * plan.woundDice;
  const vitality = Math.max(system.vitality.value, Math.min(system.vitality.max, system.vitality.value + vitalityGain)),
    wounds = Math.max(system.wounds.value, Math.min(system.wounds.max, system.wounds.value + woundGain));
  return {
    vitality,
    wounds,
    healedVitality: Math.max(0, vitality - system.vitality.value),
    healedWounds: Math.max(0, wounds - system.wounds.value),
    cost: plan.cost
  };
}
/** The first affected round counts toward the rolled duration; another combat never inherits it. */
export function activeDefenseBoost(system) {
  const boost = system.defenseBoost,
    combat = system.combatContext;
  return boost &&
    combat?.started &&
    combat.id === boost.combatId &&
    combat.round >= boost.startRound &&
    combat.round < boost.expiresAtRound
    ? { ...boost, bonus: 2, lastRound: boost.expiresAtRound - 1 }
    : null;
}
export function defenseBoostPlan(
  system,
  combat,
  { atStartOfRound = false, replaceExisting = false, combatant = false } = {}
) {
  const inability =
    restraintActionBlock(system, { free: true }) || attributeActionBlock(system, { kind: "mentalAbility" });
  if (inability || system.conditionContext?.sleeping || system.wounds?.value < 0)
    return { blocked: true, reason: inability || loc`This character cannot take the free action to boost Defense.` };
  if (
    system.refreshAction?.state === "waiting" &&
    system.refreshAction.combatId === combat?.id &&
    system.refreshAction.startRound === combat?.round
  )
    return {
      blocked: true,
      reason: loc`Refresh forfeited this round’s chance to act; a Defense free action is unavailable.`
    };
  if (!combat?.started || combat.round < 1 || !combatant)
    return { blocked: true, reason: loc`Defense may be boosted during a combat in which this character participates.` };
  if (!atStartOfRound)
    return { blocked: true, reason: loc`A Defense boost must be declared at the start of a combat round (p.62).` };
  if (activeDefenseBoost({ ...system, combatContext: combat }) && !replaceExisting)
    return {
      blocked: true,
      reason: loc`An action-die Defense boost is already active. Replace it rather than stack another.`
    };
  if ((system.actionDice?.value ?? 0) < 1) return { blocked: true, reason: loc`Not enough action dice remain.` };
  const die = system.actionDice?.die ?? 4,
    explodeAt = system.actionDice?.explodeAt ?? die,
    bonus = system.actionDice?.bonus ?? 0;
  return { blocked: false, cost: 1, formula: `1d${die}x>=${explodeAt}${bonus ? ` + (${bonus})` : ""}` };
}

/** Refresh's specific initiative action (p.359) takes precedence over the p.62 summary. */
export function refreshPlan(
  system,
  combat,
  {
    phase = "start",
    combatantId = "",
    currentCombatantId = "",
    conditions = [],
    forfeitActions = false,
    notTargeted = false,
    atStartOfInitiative = false,
    resource = "vitality",
    dead = false
  } = {}
) {
  const collapse = attributeCollapsePlan(system);
  if (dead || collapse.dead) return { blocked: true, reason: loc`A dead character cannot use Refresh.` };
  conditions = [
    ...conditions,
    ...(system.conditionContext?.entangled || system.conditionContext?.bound ? ["Entangled/Bound"] : []),
    ...collapse.conditions,
    ...(collapse.wisdomEpisode ? ["Wisdom-collapse episode"] : []),
    ...(system.mentalLeapState?.exhausted ? ["Exhausted"] : system.mentalLeapState?.fatigued ? ["Fatigued"] : []),
    ...(system.mentalLeapState?.unconscious ? ["Unconscious"] : [])
  ];
  if (!combat?.started || combat.round < 1 || !combatantId || currentCombatantId !== combatantId)
    return {
      blocked: true,
      reason: loc`Refresh must be declared or completed at this character’s initiative in a started combat.`
    };
  const record = system.refreshAction;
  if (phase === "start") {
    const shaken = shakenRules(system);
    if (shaken.needsReview)
      return { blocked: true, reason: loc`Review the current Shaken sources before beginning Refresh.` };
    if (shaken.grade > 0) conditions.push(shaken.label);
    if (conditions.length)
      return { blocked: true, reason: loc`A character suffering from any condition cannot begin Refresh (p.359).` };
    if (!forfeitActions) return { blocked: true, reason: loc`Refresh forfeits this round’s chance to act.` };
    if (record?.combatId === combat.id && record.startRound === combat.round)
      return { blocked: true, reason: loc`This round’s Refresh has already been declared.` };
    return {
      blocked: false,
      record: {
        combatId: combat.id,
        combatantId,
        startRound: combat.round,
        dueRound: combat.round + 1,
        state: "waiting",
        targeted: false
      }
    };
  }
  if (
    phase !== "complete" ||
    !record ||
    record.combatId !== combat.id ||
    record.combatantId !== combatantId ||
    record.state !== "waiting"
  )
    return { blocked: true, reason: loc`There is no pending Refresh for this combatant.` };
  if (combat.round !== record.dueRound)
    return {
      blocked: true,
      reason:
        combat.round < record.dueRound
          ? loc`Wait until the start of this character’s next initiative.`
          : loc`The opportunity to complete this Refresh has passed.`
    };
  if (!atStartOfInitiative)
    return { blocked: true, reason: loc`Complete Refresh at the start of this character’s next initiative.` };
  if (record.targeted || !notTargeted)
    return {
      blocked: true,
      reason: loc`Refresh permits healing only if no attack targeted the character during the entire wait, including attacks that missed.`
    };
  if (!["vitality", "wounds"].includes(resource)) return { blocked: true, reason: loc`Choose vitality or wounds.` };
  const healing = healingPlan(system, {
    vitalityDice: resource === "vitality" ? 1 : 0,
    woundDice: resource === "wounds" ? 1 : 0,
    dead
  });
  return healing.blocked ? healing : { ...healing, record: { ...record, state: "completed" } };
}

/** Fortunes of War doubles only its own DR through the start of the actor's next initiative (pp.49,346). */
export function activeFortunesOfWar(system) {
  const record = system.fortunesOfWarBoost,
    combat = system.fortunesCombatContext,
    grade = system.legacyAbilities?.fortunesOfWar?.grade ?? 0;
  if (
    !record ||
    !Number.isSafeInteger(record.startRound) ||
    record.startRound < 1 ||
    record.dueRound !== record.startRound + 1 ||
    !grade ||
    !combat?.started ||
    combat.ownTurnIndex < 0 ||
    combat.id !== record.combatId ||
    combat.combatantId !== record.combatantId ||
    record.session !== String(system.usagePeriods?.session ?? "initial") ||
    combat.round < record.startRound ||
    combat.round > record.dueRound
  )
    return null;
  if (
    combat.round === record.dueRound &&
    (combat.ownTurnIndex < 0 || combat.turn == null || combat.turn >= combat.ownTurnIndex)
  )
    return null;
  return { bonus: grade, dueRound: record.dueRound, combatantId: record.combatantId };
}
export function fortunesOfWarPlan(system, combat) {
  if (!(system.legacyAbilities?.fortunesOfWar?.grade > 0))
    return { blocked: true, reason: loc`Fortunes of War has not been earned.` };
  if (!combat?.started || combat.round < 1 || !combat.combatantId || combat.ownTurnIndex < 0)
    return {
      blocked: true,
      reason: loc`Use the tracked Fortunes of War boost in a started combat containing this character.`
    };
  if (activeFortunesOfWar({ ...system, fortunesCombatContext: combat }))
    return { blocked: true, reason: loc`Fortunes of War is already doubled; additional uses cannot stack.` };
  return {
    blocked: false,
    record: {
      combatId: combat.id,
      combatantId: combat.combatantId,
      startRound: combat.round,
      dueRound: combat.round + 1,
      session: String(system.usagePeriods?.session ?? "initial")
    }
  };
}

/** No Fear II, p.81: once per session; duration measured from own initiative (p.346). */
export function noFearSource(system) {
  const level = classFeatureLevels(system)?.stuntman ?? 0;
  return Number.isSafeInteger(level) && level >= 7 && level <= 10
    ? { resistance: level, rounds: Math.max(1, (system.abilities?.wis?.mod ?? 0) + 1) }
    : null;
}
export function activeNoFear(system) {
  const r = system.noFearBoost,
    c = system.noFearCombatContext,
    source = noFearSource(system);
  if (
    !source ||
    !r ||
    r.resistance !== source.resistance ||
    !Number.isSafeInteger(r.rounds) ||
    r.rounds < 1 ||
    !Number.isSafeInteger(r.startRound) ||
    r.startRound < 1 ||
    r.dueRound !== r.startRound + r.rounds ||
    r.session !== String(system.usagePeriods?.session ?? "initial") ||
    !c?.started ||
    !r.combatId ||
    c.id !== r.combatId ||
    !r.combatantId ||
    c.combatantId !== r.combatantId ||
    !Number.isSafeInteger(c.ownTurnIndex) ||
    c.ownTurnIndex < 0 ||
    !Number.isSafeInteger(c.turn) ||
    c.turn < 0 ||
    !Number.isSafeInteger(c.round) ||
    !Number.isSafeInteger(r.dueRound) ||
    c.round < r.startRound ||
    c.round > r.dueRound
  )
    return null;
  if ((c.round === r.startRound && c.turn < c.ownTurnIndex) || (c.round === r.dueRound && c.turn >= c.ownTurnIndex))
    return null;
  return { resistance: r.resistance, rounds: r.rounds, dueRound: r.dueRound };
}
export function noFearPlan(system, combat) {
  const source = noFearSource(system);
  if (!source) return { blocked: true, reason: loc`No Fear II requires Stuntman level 7.` };
  if (
    !Number.isSafeInteger(source.rounds) ||
    !combat?.started ||
    !Number.isSafeInteger(combat.round) ||
    combat.round < 1 ||
    !combat.id ||
    !combat.combatantId ||
    !Number.isSafeInteger(combat.ownTurnIndex) ||
    combat.ownTurnIndex < 0 ||
    !Number.isSafeInteger(combat.turn) ||
    combat.turn !== combat.ownTurnIndex
  )
    return { blocked: true, reason: loc`Activate No Fear II during this character’s initiative in a started combat.` };
  if (activeNoFear({ ...system, noFearCombatContext: combat }))
    return { blocked: true, reason: loc`No Fear II is already active.` };
  return {
    blocked: false,
    record: {
      ...source,
      combatId: combat.id,
      combatantId: combat.combatantId,
      startRound: combat.round,
      dueRound: combat.round + source.rounds,
      session: String(system.usagePeriods?.session ?? "initial")
    }
  };
}

/** Recovery rates pp.53,143,166,175,329,333,339,447. This is a rate calculation, not a healing settlement. */
export function recoveryRatePlan(system, { treatment = "none", interest = false, poorForaging = false } = {}) {
  const treatmentRates = { none: 1, success: 2, threat: 3, criticalSuccess: 5, error: 0 };
  if (typeof treatment !== "string" || !Object.hasOwn(treatmentRates, treatment))
    throw new Error(loc`Choose a resolved Treatment outcome for the current day.`);
  if (interest !== true && interest !== false)
    throw new Error(loc`Confirm whether at least one hour is spent indulging in Interests.`);
  if (poorForaging !== true && poorForaging !== false)
    throw new Error(loc`Confirm the current day’s failed Foraging outcome.`);
  const quickHealer = system.activeFeatNames?.includes("Quick Healer") === true,
    timeMultiplier = quickHealer ? 0.5 : 1;
  const level = system.level ?? 0;
  if (!Number.isSafeInteger(level) || level < 0 || level > 20)
    throw new Error(loc`Review the character’s Career Level before calculating recovery rates.`);
  const fastHealing = (system.originEffects ?? []).some(e => e.qualityKey === "fastHealing");
  const naturalMultiplier =
      treatment === "error" ? 0 : treatmentRates[treatment] + (fastHealing ? 1 : 0) - (poorForaging ? 0.5 : 0),
    stressMultiplier = 1 + (fastHealing ? 1 : 0) + (interest ? 1 : 0) - (poorForaging ? 0.5 : 0),
    subdualMultiplier = 1 + (fastHealing ? 1 : 0) - (poorForaging ? 0.5 : 0);
  const stressBase = system.stressThreshold ?? system.abilities?.wis?.value ?? null,
    subdualBase = system.subdualThreshold ?? system.abilities?.con?.value ?? null;
  const intervals = [
    { threshold: 1, label: "minute", seconds: 60 },
    { threshold: 2, label: loc`10 minutes`, seconds: 600 },
    { threshold: 3, label: "hour", seconds: 3600 },
    { threshold: 4, label: "day", seconds: 86400 },
    { threshold: 5, label: "week", seconds: 604800 }
  ];
  const label = seconds =>
    seconds === 604800
      ? "week"
      : seconds === 86400
        ? "day"
        : seconds >= 86400
          ? `${Math.floor(seconds / 86400)} ${Math.floor(seconds / 86400) === 1 ? "day" : "days"}${seconds % 86400 ? ` ${(seconds % 86400) / 3600} hours` : ""}`
          : seconds % 3600 === 0
            ? seconds === 3600
              ? "hour"
              : `${seconds / 3600} hours`
            : seconds % 60 === 0
              ? seconds === 60
                ? "minute"
                : `${seconds / 60} minutes`
              : `${seconds} seconds`;
  const vitalityPoints = Math.floor(level * naturalMultiplier),
    woundPoints = Math.floor(naturalMultiplier),
    vitalityIntervalSeconds = Math.floor(3600 * timeMultiplier),
    woundIntervalSeconds = Math.floor(86400 * timeMultiplier);
  const rates = (base, points) =>
    intervals.map(row => {
      const seconds = Math.floor(row.seconds * timeMultiplier);
      return {
        ...row,
        baseSeconds: row.seconds,
        seconds,
        label: label(seconds),
        thresholdValue: Number.isFinite(base) ? base * row.threshold : null,
        points: Math.floor(points)
      };
    });
  return {
    quickHealer,
    timeMultiplier,
    level,
    fastHealing,
    treatment,
    interest,
    poorForaging,
    naturalMultiplier,
    stressMultiplier,
    subdualMultiplier,
    vitalityPoints,
    woundPoints,
    vitalityIntervalSeconds,
    woundIntervalSeconds,
    vitalityIntervalLabel: label(vitalityIntervalSeconds),
    woundIntervalLabel: label(woundIntervalSeconds),
    vitalityPerHour: (vitalityPoints * 3600) / vitalityIntervalSeconds,
    woundsPerDay: (woundPoints * 86400) / woundIntervalSeconds,
    stress: rates(stressBase, stressMultiplier),
    subdual: rates(subdualBase, subdualMultiplier)
  };
}
