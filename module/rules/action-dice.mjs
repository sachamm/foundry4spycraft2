import { rollPipeline } from "./roll-pipeline.mjs";
import { shakenRules } from "./shaken.mjs";
import { errorDecisionPending } from "./outcomes.mjs";
import { resolveSkillResult } from "./checks.mjs";
import { loc } from "../i18n.mjs";
/** Doubled-die abilities never exceed two dice per die spent (pp.29,62), including Card Shark p.202. */
export function actionDieBoostPlan(
  system,
  check,
  { count = 1, openingRound = false, calculating = false, errorDeclined = false } = {}
) {
  const shaken = shakenRules(system);
  if (shaken.needsReview || shaken.spendingForbidden)
    return {
      blocked: true,
      reason: shaken.needsReview
        ? loc`Review the paying character’s Shaken sources before boosting.`
        : loc`Shaken IV: no action dice may be spent at all (p.342).`
    };
  if (system.actionDieAwardReview?.needsReview)
    return { blocked: true, reason: loc`The GC must review the interrupted award before spending more action dice.` };
  if (system.actionDiceSettlementReview?.needsReview)
    return {
      blocked: true,
      reason: loc`The GC must review the interrupted action-die settlement before further spending.`
    };
  const core = new Set(system.coreClassIds ?? []),
    kind = check.checkKind ?? "check",
    skillLike = ["skill", "knowledge"].includes(kind);
  if (!Number.isSafeInteger(count) || count < 1)
    return { blocked: true, reason: loc`Spend a positive whole number of action dice.` };
  if (count > (system.actionDice?.value ?? 0)) return { blocked: true, reason: loc`Not enough action dice remain.` };
  if (check.criticalFailure)
    return { blocked: true, reason: loc`An activated critical failure cannot be boosted (p.62).` };
  if (errorDecisionPending(check) && !errorDeclined)
    return {
      blocked: true,
      reason: loc`Opponents must decide whether to activate the error before you boost it (p.62).`
    };
  if (check.actionDiceAllowed === false || check.resolved)
    return { blocked: true, reason: loc`This result cannot be boosted, or its outcome has already been resolved.` };
  if (kind === "damage" && count + (check.boostSpent ?? 0) > 1)
    return { blocked: true, reason: loc`Only one action die may be spent to boost each damage result (p.61).` };
  const doubled =
    (system.activeFeatNames?.includes("Card Shark") &&
      kind === "skill" &&
      check.skillKey === "streetwise" &&
      check.checkId === "gambling") ||
    (core.has("soldier") && kind === "attack") ||
    (core.has("intruder") && skillLike && check.ability === "dex") ||
    (core.has("sleuth") && skillLike && ["cha", "wis"].includes(check.ability)) ||
    (core.has("snoop") && skillLike && ["int", "wis"].includes(check.ability)) ||
    (core.has("wheelman") &&
      kind === "skill" &&
      (check.checkId === "maneuver" || (check.skillKey === "mechanics" && check.checkId === "repair"))) ||
    (core.has("brawler") && kind === "damage" && (check.unarmed || check.improvised)) ||
    (core.has("counterterrorist") && openingRound && ["attack", "skill", "knowledge", "damage", "save"].includes(kind));
  const rolls = count * (doubled ? 2 : 1),
    die = system.actionDice?.die ?? 4,
    explodeAt = system.actionDice?.explodeAt ?? die;
  return {
    blocked: false,
    count,
    rolls,
    die,
    explodeAt,
    bonusEach: system.actionDice?.bonus ?? 0,
    calculating:
      calculating &&
      core.has("schemer") &&
      (kind === "skill" ||
        kind === "attack" ||
        kind === "check" ||
        kind === "ability" ||
        kind === "knowledge" ||
        kind === "save" ||
        kind === "damage"),
    intelligence: system.abilities?.int?.mod ?? 0,
    formula: Array(rolls).fill(`1d${die}x>=${explodeAt}`).join(" + "),
    wellRounded: system.activeFeatNames?.some(name => name.replaceAll("-", " ") === "Well Rounded") && kind === "skill",
    // Better Luck Next Time, p.189: a single boosting die on a skill check or save that rolls a natural 1 comes back.
    betterLuck: system.activeFeatNames?.includes("Better Luck Next Time") === true && ["skill", "save"].includes(kind)
  };
}
export function actionDieBoostResult(check, plan, dieResults) {
  const values = dieResults.map(Number);
  if (values.length !== plan.rolls || values.some(value => !Number.isFinite(value)))
    throw new Error(loc`One result is required for each action die rolled.`);
  let replaced = false;
  if (plan.calculating) {
    const lowest = Math.min(...values);
    if (plan.intelligence > lowest) {
      values[values.indexOf(lowest)] = plan.intelligence;
      replaced = true;
    }
  }
  const added = values.reduce((sum, value) => sum + value + plan.bonusEach, 0),
    boostTotal = (check.boostTotal ?? 0) + added;
  const wellRoundedBoosts = (check.wellRoundedBoosts ?? 0) + (plan.wellRounded ? 1 : 0);
  const cap = check.cap == null ? null : Math.max(check.cap, Math.min(60, check.cap + 10 * wellRoundedBoosts));
  const resolved = resolveSkillResult(check.rawTotal, check.naturalDie, {
    cap,
    threat: check.threat ?? 0,
    actionDieBonus: boostTotal
  });
  const naturalOne = plan.betterLuck === true && plan.count === 1 && plan.rolls === 1 && Number(dieResults[0]) === 1;
  return {
    added,
    boostTotal,
    ...(naturalOne
      ? {
          betterLuckRefunds: [
            ...(check.betterLuckRefunds ?? []),
            { bonusPoolId: plan.bonusPoolId ?? "", die: plan.die }
          ]
        }
      : {}),
    boostSpent: (check.boostSpent ?? 0) + plan.count,
    wellRoundedBoosts,
    effectiveTotal: resolved.total,
    capped: resolved.limited,
    potentialTriumph: ["skill", "knowledge", "attack"].includes(check.checkKind) && resolved.triumph,
    triumphed: false,
    replaced,
    boostCap: cap
  };
}

/** Generous uses one donor die and donor modifiers, once per target roll (p.39). */
export function generousBoostPlan(
  donor,
  check,
  { teammate = false, perceivedAtRoll = false, errorDeclined = false, calculating = false, sameActor = false } = {}
) {
  if (!donor.coreClassIds?.includes("pointman"))
    return { blocked: true, reason: loc`The donor must possess the Generous core ability.` };
  if (sameActor || !teammate || !perceivedAtRoll)
    return { blocked: true, reason: loc`Choose a teammate who could see or hear the donor when this roll was made.` };
  if (check.generousBoost)
    return {
      blocked: true,
      reason: loc`This roll has already benefited from Generous, even if another Pointman offers a die.`
    };
  const plan = actionDieBoostPlan(donor, check, { count: 1, errorDeclined, calculating });
  if (plan.blocked) return plan;
  // Generous explicitly uses one donor die; other doubled-die cores do not multiply it.
  return { ...plan, rolls: 1, formula: `1d${plan.die}x>=${plan.explodeAt}`, wellRounded: false };
}

/** Pointman Improved Fortune, p.41: distinct teammates stack with self, maximum three starting dice. */
export function pointmanLevel(actor) {
  if (
    actor?.type !== "agent" ||
    !actor.items?.some?.(item => item.type === "class" && item.system.identifier === "pointman")
  )
    return 0;
  return (actor.system.progression ?? []).filter(level => level.classId === "pointman").length;
}
export function improvedFortuneBonus(ownLevel = 0, teammates = []) {
  const amount = level => (level >= 20 ? 2 : level >= 10 ? 1 : 0),
    seen = new Set(),
    sources = [];
  if (amount(ownLevel)) sources.push({ name: "Own Improved Fortune", value: amount(ownLevel) });
  for (const ally of teammates) {
    if (!ally.id || seen.has(ally.id)) continue;
    seen.add(ally.id);
    const value = amount(ally.level);
    if (value) sources.push({ id: ally.id, name: ally.name ?? "Teammate", value });
  }
  const uncapped = sources.reduce((n, s) => n + s.value, 0);
  return { value: Math.min(3, uncapped), uncapped, sources };
}

/** p.189: apply Fortune Favors the Bold once at the time dice are gained. */
export function actionDiceGain(system, baseDie, count = 1) {
  if (![4, 6, 8, 10, 12].includes(baseDie) || !Number.isSafeInteger(count) || count < 1)
    throw new Error(loc`Choose a valid action-die type and positive whole-number count.`);
  const bold = system.activeFeatNames?.includes("Fortune Favors the Bold"),
    die = bold ? (baseDie === 12 ? 6 : baseDie + 2) : baseDie,
    units = count * (bold && baseDie === 12 ? 2 : 1);
  if (!Number.isSafeInteger(units)) throw new Error(loc`The gained dice exceed a safe whole number.`);
  return { die, units };
}

/** Ordinary GC awards, pp.63,397–398. Explicit bonus dice from abilities use their own rules. */
export function actionDieAwardPlan(
  system,
  { count = 1, careerDie = 4, reason = "", mission = "initial", session = "initial", id = "", at = 0 } = {}
) {
  if (
    !Number.isSafeInteger(count) ||
    count < 1 ||
    ![4, 6, 8, 10, 12].includes(careerDie) ||
    !String(reason).trim() ||
    !id
  )
    throw new Error(loc`Enter a positive whole number of ordinary award dice and their reason.`);
  const { die, units } = actionDiceGain(system, careerDie, count);
  const value = (system.actionDice?.value ?? 0) + units;
  if (!Number.isSafeInteger(value)) throw new Error(loc`The awarded action-die balance exceeds a safe whole number.`);
  const key = encodeURIComponent(String(mission)).replaceAll(".", "%2E"),
    before = system.actionDieAwards?.[key];
  if (system.missionXPRewards?.[key])
    throw new Error(
      loc`This mission’s XP was already settled. Start the next mission before recording further awards.`
    );
  if (before && before.mission !== String(mission)) throw new Error(loc`The award ledger does not match this mission.`);
  const awarded = (before?.count ?? 0) + count;
  if (!Number.isSafeInteger(awarded)) throw new Error(loc`The award count exceeds a safe whole number.`);
  const event = {
    id,
    count,
    units,
    die,
    reason: String(reason).trim(),
    session: String(session),
    careerLevel: system.level ?? 0,
    at
  };
  return {
    key,
    value,
    die,
    units,
    gcGain: count,
    count,
    record: { ...(before ?? {}), mission: String(mission), count: awarded, events: [...(before?.events ?? []), event] }
  };
}
export function actionDieAwardSummary(system) {
  const key = encodeURIComponent(String(system.usagePeriods?.mission ?? "initial")).replaceAll(".", "%2E"),
    record = system.actionDieAwards?.[key];
  const reward = system.missionXPRewards?.[key],
    count = record?.count ?? 0;
  return {
    count,
    events: record?.events?.length ?? 0,
    baseXP: reward?.awardBaseBonus ?? 25 * Math.min(count, system.level ?? 0),
    settled: !!reward,
    totalXP: reward?.totalXP ?? 0
  };
}

/** User-confirmed precedence: p.440, rather than p.63's conflicting flat-XP examples. */
export function missionXPPlan(
  system,
  {
    baseXP = 0,
    threatLevel = 1,
    additionalXP = 0,
    modifierReason = "",
    missionCompleteConfirmed = false,
    mission = "initial",
    at = 0
  } = {}
) {
  const level = system.level ?? 0;
  if (!Number.isSafeInteger(level) || level < 1 || level > 20)
    throw new Error(loc`Complete a Career Level 1–20 character before settling mission XP.`);
  if (
    ![baseXP, additionalXP].every(n => Number.isSafeInteger(n) && n >= 0) ||
    !Number.isSafeInteger(threatLevel) ||
    threatLevel < 1
  )
    throw new Error(loc`Enter nonnegative whole-number XP and a positive whole-number Threat Level.`);
  if (!missionCompleteConfirmed)
    throw new Error(loc`Confirm the mission has ended and all post-multiplier XP modifiers were reviewed.`);
  if (additionalXP && !String(modifierReason).trim())
    throw new Error(loc`Record the source of additional post-multiplier XP.`);
  const key = encodeURIComponent(String(mission)).replaceAll(".", "%2E");
  if (system.missionXPRewards?.[key]) throw new Error(loc`This mission’s XP was already settled.`);
  const count = system.actionDieAwards?.[key]?.count ?? 0;
  if (!Number.isSafeInteger(count) || count < 0) throw new Error(loc`Review the mission’s action-die award ledger.`);
  const awardBaseBonus = 25 * Math.min(count, level),
    combinedBase = baseXP + awardBaseBonus,
    multiplier = Math.min(level, threatLevel),
    coreXP = combinedBase * multiplier,
    totalXP = coreXP + additionalXP,
    xp = (system.xp ?? 0) + totalXP;
  if (![combinedBase, coreXP, totalXP, xp].every(Number.isSafeInteger))
    throw new Error(loc`The mission reward exceeds a safe whole number.`);
  return {
    key,
    xp,
    record: {
      mission: String(mission),
      level,
      threatLevel,
      baseXP,
      awardedDice: count,
      awardBaseBonus,
      combinedBase,
      multiplier,
      coreXP,
      additionalXP,
      modifierReason: String(modifierReason).trim(),
      totalXP,
      at,
      source: "p.440 (user-confirmed)"
    }
  };
}

// Recorded on the posted check as the roll was given them.
rollPipeline.register({ id: "actionDiceRecord", order: 9605, record: ["hailMary"] });
