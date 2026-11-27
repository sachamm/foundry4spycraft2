import { classFeatureLevels } from "./class-features.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
/** Schemer pp.78–79, round durations p.346, exhaustion/unconsciousness pp.341–342. */
const time = n => Number.isFinite(n) && Math.abs(n) <= Number.MAX_SAFE_INTEGER;
export function mentalLeapSource(system) {
  const level = classFeatureLevels(system)?.schemer ?? 0;
  return Number.isSafeInteger(level) && level >= 1 && level <= 10
    ? { level, limit: 1 + (level >= 5 ? 1 : 0) + (level >= 9 ? 1 : 0) }
    : null;
}
function validRecord(r) {
  return (
    r &&
    typeof r.id === "string" &&
    r.id &&
    ["dex", "int", "wis"].includes(r.ability) &&
    Number.isSafeInteger(r.bonus) &&
    r.bonus > 0 &&
    Number.isSafeInteger(r.sourceLevel) &&
    r.sourceLevel >= 1 &&
    r.sourceLevel <= 10 &&
    typeof r.session === "string" &&
    time(r.startedAt) &&
    (!r.combatId ||
      (typeof r.combatId === "string" &&
        typeof r.combatantId === "string" &&
        Number.isSafeInteger(r.startRound) &&
        r.startRound >= 1)) &&
    (!r.detached || (time(r.detached.at) && Number.isFinite(r.detached.elapsed) && r.detached.elapsed >= 0)) &&
    (!r.ended ||
      (time(r.ended.at) &&
        r.ended.at >= r.startedAt &&
        Number.isFinite(r.ended.elapsed) &&
        r.ended.elapsed >= 0 &&
        r.ended.elapsed < 60 &&
        r.ended.rounds === Math.max(1, Math.ceil(r.ended.elapsed / 6)) &&
        r.ended.rounds <= 10))
  );
}
/** Match the character's initiative, not the start of a global combat round. */
export function mentalLeapElapsed(system, r) {
  const now = system.worldTime;
  if (!time(now) || !validRecord(r) || now < r.startedAt)
    throw new Error(loc`Review the Mental Leap record and game-time clock.`);
  if (r.detached) {
    if (now < r.detached.at) throw new Error(loc`The game clock precedes the saved combat handoff.`);
    return r.detached.elapsed + now - r.detached.at;
  }
  const c = r.combatId ? system.mentalLeapCombats?.[r.combatId] : null;
  if (
    c &&
    c.id === r.combatId &&
    c.combatantId === r.combatantId &&
    Number.isSafeInteger(c.round) &&
    c.round >= r.startRound &&
    Number.isSafeInteger(c.turn) &&
    Number.isSafeInteger(c.ownTurnIndex) &&
    c.ownTurnIndex >= 0
  ) {
    return Math.max(0, c.round - r.startRound - (c.turn < c.ownTurnIndex ? 1 : 0)) * 6;
  }
  return now - r.startedAt;
}
export function mentalLeapRecord(system, { id, ability, combat = null } = {}) {
  const source = mentalLeapSource(system);
  if (!source) throw new Error(loc`Mental Leap requires an earned Schemer level.`);
  if (!time(system.worldTime)) throw new Error(loc`A valid game-time clock is required.`);
  if (!["dex", "int", "wis"].includes(ability)) throw new Error(loc`Choose Dexterity, Intelligence or Wisdom.`);
  if (typeof id !== "string" || !id || (system.mentalLeaps ?? []).some(r => r.id === id))
    throw new Error(loc`Choose a new Mental Leap record identifier.`);
  const bonus = system.actionDice?.max;
  if (!Number.isSafeInteger(bonus) || bonus < 1) throw new Error(loc`Review starting action dice before Mental Leap.`);
  if (
    combat &&
    (!combat.started ||
      !combat.id ||
      !combat.combatantId ||
      !Number.isSafeInteger(combat.round) ||
      combat.round < 1 ||
      combat.turn !== combat.ownTurnIndex ||
      combat.ownTurnIndex < 0)
  )
    throw new Error(loc`Activate Mental Leap during this character’s initiative.`);
  return {
    id,
    ability,
    bonus,
    sourceLevel: source.level,
    session: String(system.usagePeriods?.session ?? "initial"),
    startedAt: system.worldTime,
    ...(combat ? { combatId: combat.id, combatantId: combat.combatantId, startRound: combat.round } : {})
  };
}
export function endMentalLeapPlan(system, r, { freeActionConfirmed = false, combat = null } = {}) {
  if (freeActionConfirmed !== true) throw new Error(loc`Declare the free action to end Mental Leap.`);
  if (combat?.started && (combat.turn !== combat.ownTurnIndex || !combat.combatantId))
    throw new Error(loc`End Mental Leap during this character’s initiative.`);
  const elapsed = mentalLeapElapsed(system, r);
  if (r.ended || elapsed >= 60) throw new Error(loc`This Mental Leap is no longer active.`);
  // User ruling: even activation/end in the same initiative counts as one active round.
  return { ...r, ended: { at: system.worldTime, elapsed, rounds: Math.max(1, Math.ceil(elapsed / 6)) } };
}
export function detachMentalLeapPlan(system, r, combat) {
  if (!r.combatId || r.combatId !== combat.id || r.detached) return r;
  const elapsed = mentalLeapElapsed(
    { ...system, mentalLeapCombats: { ...system.mentalLeapCombats, [combat.id]: combat } },
    r
  );
  return { ...r, detached: { at: system.worldTime, elapsed } };
}
export function mentalLeapState(system) {
  const rows = [],
    warnings = [],
    bonuses = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    ids = new Set();
  for (const r of system.mentalLeaps ?? []) {
    try {
      if (!validRecord(r) || ids.has(r.id)) throw new Error(loc`Invalid or duplicate Mental Leap history.`);
      ids.add(r.id);
      const elapsed = mentalLeapElapsed(system, r),
        end = r.ended?.elapsed ?? 60,
        rounds = r.ended?.rounds ?? 10,
        exhaustEnd = end + 12 * rounds;
      const phase = elapsed < end ? "boost" : elapsed < exhaustEnd ? "exhausted" : "finished";
      const onset =
        r.ended?.at ??
        (r.detached && r.detached.elapsed < 60 ? r.detached.at + 60 - r.detached.elapsed : r.startedAt + 60);
      const row = {
        ...r,
        elapsed,
        phase,
        activeRounds: rounds,
        exhaustionRounds: 2 * rounds,
        remainingSeconds: phase === "boost" ? end - elapsed : phase === "exhausted" ? exhaustEnd - elapsed : 0,
        exhaustionOnset: onset,
        exhaustionEnd: onset + 12 * rounds
      };
      rows.push(row);
      if (phase === "boost") bonuses[r.ability] += r.bonus;
    } catch (error) {
      warnings.push(loc`Mental Leap (${r?.id ?? "unknown"}): ${error.message}`);
    }
  }
  const recovery = system.mentalLeapRecovery,
    validRecovery =
      recovery?.confirmed === true &&
      time(recovery.at) &&
      recovery.at <= system.worldTime &&
      Number.isSafeInteger(recovery.requiredHours) &&
      recovery.requiredHours >= 2 &&
      recovery.requiredHours <= 8 &&
      Number.isFinite(recovery.completedHours) &&
      recovery.completedHours >= recovery.requiredHours &&
      (recovery.causeKeys === undefined ||
        (Array.isArray(recovery.causeKeys) &&
          recovery.causeKeys.length > 0 &&
          recovery.causeKeys.every(k => typeof k === "string" && k) &&
          new Set(recovery.causeKeys).size === recovery.causeKeys.length)) &&
      time(recovery.resolvedFrom) &&
      recovery.at - recovery.resolvedFrom >= recovery.requiredHours * 3600,
    clearedThrough = validRecovery ? recovery.at - recovery.requiredHours * 3600 : -Infinity;
  if (recovery && !validRecovery) warnings.push(loc`Mental Leap: review the recorded unconsciousness sleep recovery.`);
  const onsets = [],
    unconsciousCauses = [],
    covered = validRecovery && Array.isArray(recovery.causeKeys) ? new Set(recovery.causeKeys) : null;
  const addCause = (key, at, label) => {
    if (covered ? covered.has(key) : at <= clearedThrough) return;
    onsets.push(at);
    unconsciousCauses.push({ key, at, label });
  };
  const ended = rows.filter(r => r.phase !== "boost").sort((a, b) => a.exhaustionOnset - b.exhaustionOnset);
  for (let i = 0; i < ended.length; i++)
    if (ended.slice(0, i).some(previous => previous.exhaustionEnd > ended[i].exhaustionOnset))
      addCause(
        "mentalLeap:" + ended[i].id,
        ended[i].exhaustionOnset,
        loc`Mental Leap (${ended[i].ability.toUpperCase()}): another exhaustion while already exhausted`
      );
  const eventIds = new Set();
  for (const event of system.mentalLeapFatigueEvents ?? []) {
    if (
      !event ||
      typeof event.id !== "string" ||
      !event.id ||
      eventIds.has(event.id) ||
      !time(event.at) ||
      event.reason !== "Fatigued or exhausted again while already exhausted: unconscious."
    ) {
      warnings.push(loc`Mental Leap: review repeated-fatigue event history.`);
      continue;
    }
    eventIds.add(event.id);
    if (event.at <= system.worldTime) {
      const source = (system.fatigueApplications ?? []).find(r => r.eventId === event.id)?.source;
      addCause(
        "fatigue:" + event.id,
        event.at,
        source ? `Fatigue/exhaustion: ${source}` : loc`Another fatigue/exhaustion while already exhausted`
      );
    }
  }
  const exhausted = rows.some(r => r.phase === "exhausted") || system.conditionContext?.exhausted === true,
    unconscious = onsets.length > 0 || system.conditionContext?.unconscious === true;
  if (exhausted) {
    bonuses.str -= 6;
    bonuses.dex -= 6;
  }
  const fatigued = !exhausted && system.conditionContext?.fatigued === true,
    fatiguedPenaltiesIgnored = fatigued && system.activeFeatNames?.includes("Guts") === true;
  if (fatigued && !fatiguedPenaltiesIgnored) {
    bonuses.str -= 2;
    bonuses.dex -= 2;
  }
  return {
    rows,
    warnings,
    unconsciousCauses,
    sleepCauseReview: !!(
      onsets.length &&
      system.mentalLeapSleep &&
      (system.mentalLeapSleep.completedAt !== null ||
        !sameKeys(
          system.mentalLeapSleep.causeKeys,
          unconsciousCauses.map(c => c.key)
        ))
    ),
    bonuses,
    exhausted,
    fatigued,
    fatiguedPenaltiesIgnored,
    unconscious,
    unconsciousSince: onsets.length ? Math.min(...onsets) : null,
    latestUnconsciousAt: onsets.length ? Math.max(...onsets) : null,
    canRun: !exhausted && (!fatigued || fatiguedPenaltiesIgnored) && !unconscious,
    fatigueSaveBonus: exhausted || fatigued ? 6 : 0,
    exhaustionSaveBonus: exhausted ? 6 : 0,
    recoveryAvailable: onsets.length > 0
  };
}
export function mentalLeapFatigueEvent(system, { id, confirmed = false } = {}) {
  const state = mentalLeapState(system);
  if (!state.exhausted) throw new Error(loc`This escalation requires an exhausted character.`);
  if (
    confirmed !== true ||
    !id ||
    (system.mentalLeapFatigueEvents ?? []).some(e => e.id === id) ||
    !time(system.worldTime)
  )
    throw new Error(loc`Confirm another fatigue/exhaustion application and its game-time clock.`);
  // Stored on the character and compared when the history is reviewed: a fixed value, not translated text.
  return { id, at: system.worldTime, reason: "Fatigued or exhausted again while already exhausted: unconscious." };
}
/** GC verifies the rolled 2d4 hours of sleep; time alone never certifies sleep. */
export function mentalLeapRecoveryPlan(system, { requiredHours, completedHours, fullSleepConfirmed = false } = {}) {
  const state = mentalLeapState(system);
  if (!state.recoveryAvailable)
    throw new Error(loc`There is no unresolved recorded fatigue/exhaustion unconsciousness.`);
  if (
    !Number.isSafeInteger(requiredHours) ||
    requiredHours < 2 ||
    requiredHours > 8 ||
    !Number.isFinite(completedHours) ||
    completedHours < requiredHours ||
    fullSleepConfirmed !== true
  )
    throw new Error(loc`Confirm the full rolled 2d4 hours of sleep.`);
  if (!time(system.worldTime) || system.worldTime - state.latestUnconsciousAt < requiredHours * 3600)
    throw new Error(loc`The game clock has not yet reached the required sleep duration.`);
  return {
    confirmed: true,
    at: system.worldTime,
    requiredHours,
    completedHours,
    resolvedFrom: state.unconsciousSince,
    causeKeys: state.unconsciousCauses.map(c => c.key).sort()
  };
}

const keysValid = keys =>
  Array.isArray(keys) && keys.every(key => typeof key === "string" && key) && new Set(keys).size === keys.length;
const sameKeys = (a, b) =>
  keysValid(a) && keysValid(b) && JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const hoursValid = n => Number.isSafeInteger(n) && n >= 2 && n <= 8;
function sleepHistory(sleep, now) {
  if (!sleep) return { requirements: [], ignored: [], known: [], legacy: false, legacyReviewRequired: false };
  if (sleep.completedAt === undefined) throw new Error(loc`Review the incomplete sleep record.`);
  if (sleep.completedAt !== null) {
    if (
      !time(sleep.at) ||
      !hoursValid(sleep.requiredHours) ||
      !time(sleep.dueAt) ||
      !time(sleep.completedAt) ||
      sleep.completedAt < sleep.dueAt ||
      sleep.completedAt > now
    )
      throw new Error(loc`Review the prior completed sleep record.`);
    return { requirements: [], ignored: [], known: [], legacy: false, legacyReviewRequired: false };
  }
  if (sleep.previousDueAt !== null && sleep.previousDueAt !== undefined && !time(sleep.previousDueAt))
    throw new Error(loc`Review the earlier sleep deadline.`);
  if (
    !time(sleep.at) ||
    sleep.at > now ||
    !hoursValid(sleep.requiredHours) ||
    !time(sleep.dueAt) ||
    sleep.dueAt < sleep.at + sleep.requiredHours * 3600
  )
    throw new Error(loc`Review the existing sleep record and game clock.`);
  const legacy = !keysValid(sleep.causeKeys);
  let requirements = sleep.requirements;
  if (requirements === undefined && legacy)
    requirements = [
      {
        causeKey: "legacy:" + sleep.at + ":" + sleep.requiredHours,
        at: sleep.at,
        requiredHours: sleep.requiredHours,
        dueAt: sleep.at + sleep.requiredHours * 3600
      }
    ];
  if (
    !Array.isArray(requirements) ||
    !requirements.length ||
    new Set(requirements.map(r => r?.causeKey)).size !== requirements.length ||
    requirements.some(
      r =>
        !r ||
        typeof r.causeKey !== "string" ||
        !r.causeKey ||
        !time(r.at) ||
        r.at > now ||
        !hoursValid(r.requiredHours) ||
        !time(r.dueAt) ||
        r.dueAt !== r.at + r.requiredHours * 3600
    )
  )
    throw new Error(loc`Review the recorded per-cause sleep requirements.`);
  if (!legacy && sleep.dueAt !== Math.max(...requirements.map(r => r.dueAt), sleep.previousDueAt ?? -Infinity))
    throw new Error(loc`Review the retained sleep deadline.`);
  if (
    sleep.currentCauseKeys !== undefined &&
    (!keysValid(sleep.currentCauseKeys) ||
      !sleep.currentCauseKeys.length ||
      sleep.currentCauseKeys.some(k => !requirements.some(r => r.causeKey === k)))
  )
    throw new Error(loc`Review the current sleep period sources.`);
  const ignored = sleep.ignoredCauseKeys ?? [],
    legacyCovered = sleep.legacyCoveredCauseKeys ?? [];
  if (!keysValid(legacyCovered)) throw new Error(loc`Review the earlier covered sleep causes.`);
  if (
    !legacy &&
    (requirements.some(r => !r.causeKey.startsWith("legacy:") && !sleep.causeKeys.includes(r.causeKey)) ||
      ignored.some(k => !sleep.causeKeys.includes(k)) ||
      sleep.causeKeys.some(
        k => !requirements.some(r => r.causeKey === k) && !ignored.includes(k) && !legacyCovered.includes(k)
      ))
  )
    throw new Error(loc`A recorded cause is missing its sleep requirement or GC decision.`);
  if (!keysValid(ignored)) throw new Error(loc`Review the GC-adjudicated ignored unconsciousness causes.`);
  return {
    requirements: structuredClone(requirements),
    ignored: [...ignored],
    known: legacy ? [] : [...sleep.causeKeys],
    legacy,
    legacyReviewRequired:
      sleep.legacyReviewRequired === true || (legacy && sleep.dueAt > Math.max(...requirements.map(r => r.dueAt)))
  };
}
/** Freeze each GC-applicable new cause independently; a repeated confirmation never rerolls it. */
export function unconsciousSleepPlan(
  system,
  {
    confirmed = false,
    reviewLegacyNoNewCause = false,
    restart = false,
    ignoredCauseKeys = [],
    rollHoursByCause = {}
  } = {}
) {
  const state = mentalLeapState(system);
  if (
    !state.recoveryAvailable ||
    confirmed !== true ||
    !time(system.worldTime) ||
    typeof restart !== "boolean" ||
    typeof reviewLegacyNoNewCause !== "boolean" ||
    !keysValid(ignoredCauseKeys)
  )
    throw new Error(loc`Confirm current unconsciousness causes and the start of actual sleep.`);
  const previous = system.mentalLeapSleep,
    history = sleepHistory(previous, system.worldTime),
    causes = state.unconsciousCauses,
    keys = causes.map(c => c.key).sort();
  if (previous?.completedAt != null && keysValid(previous.causeKeys) && previous.causeKeys.some(k => keys.includes(k)))
    throw new Error(
      loc`Previously completed causes remain unresolved. Review their recovery receipt before tracking sleep again.`
    );
  if (history.known.some(k => !keys.includes(k)))
    throw new Error(loc`Previously tracked causes changed. Review the current unconsciousness history.`);
  const adopting = history.legacy && reviewLegacyNoNewCause;
  const newCauses = adopting ? [] : causes.filter(c => !history.known.includes(c.key));
  if (ignoredCauseKeys.some(k => !newCauses.some(c => c.key === k)))
    throw new Error(loc`Only a new cause may receive the GC’s repeated-condition susceptibility decision.`);
  const applicable = newCauses.filter(c => !ignoredCauseKeys.includes(c.key));
  if (!history.requirements.length && !applicable.length)
    throw new Error(loc`At least one unconsciousness cause requires its rolled sleep period.`);
  if (
    !rollHoursByCause ||
    typeof rollHoursByCause !== "object" ||
    Array.isArray(rollHoursByCause) ||
    Object.keys(rollHoursByCause).some(k => !applicable.some(c => c.key === k))
  )
    throw new Error(loc`Review the new sleep rolls and their causes.`);
  const missing = applicable.filter(c => !Object.hasOwn(rollHoursByCause, c.key));
  if (missing.length) return { needsRoll: missing, record: null };
  if (applicable.some(c => !hoursValid(rollHoursByCause[c.key])))
    throw new Error(loc`Each applicable new cause requires an actual 2d4-hour result.`);
  let requirements = history.requirements,
    at = previous?.completedAt === null ? previous.at : system.worldTime,
    requiredHours = previous?.completedAt === null ? previous.requiredHours : null,
    currentCauseKeys =
      previous?.currentCauseKeys ?? (history.requirements.length ? [history.requirements.at(-1).causeKey] : []);
  if (applicable.length) {
    currentCauseKeys = applicable.map(c => c.key);
    for (const cause of applicable)
      requirements.push({
        causeKey: cause.key,
        at: system.worldTime,
        requiredHours: rollHoursByCause[cause.key],
        dueAt: system.worldTime + rollHoursByCause[cause.key] * 3600
      });
    at = system.worldTime;
    requiredHours = Math.max(...applicable.map(c => rollHoursByCause[c.key]));
  } else if (restart) {
    requirements = requirements.map(r =>
      currentCauseKeys.includes(r.causeKey)
        ? { ...r, at: system.worldTime, dueAt: system.worldTime + r.requiredHours * 3600 }
        : r
    );
    at = system.worldTime;
    requiredHours = Math.max(
      ...requirements.filter(r => currentCauseKeys.includes(r.causeKey)).map(r => r.requiredHours)
    );
  }
  if (!time(at) || !hoursValid(requiredHours) || requirements.some(r => !time(r.dueAt)))
    throw new Error(loc`The sleep interval exceeds the safe game clock.`);
  const previousDueAt = previous?.completedAt === null ? previous.dueAt : null,
    dueAt = Math.max(...requirements.map(r => r.dueAt), previousDueAt ?? -Infinity);
  return {
    needsRoll: [],
    record: {
      at,
      requiredHours,
      previousDueAt,
      dueAt,
      latestOnset: state.latestUnconsciousAt,
      causeKeys: keys,
      currentCauseKeys,
      requirements,
      ignoredCauseKeys: [...new Set([...history.ignored, ...ignoredCauseKeys])],
      legacyCoveredCauseKeys: adopting
        ? keys
        : previous?.completedAt === null
          ? (previous.legacyCoveredCauseKeys ?? [])
          : [],
      legacyReviewRequired: history.legacyReviewRequired,
      reviewedLegacyNoNewCause:
        adopting || (previous?.completedAt === null && previous.reviewedLegacyNoNewCause === true),
      completedAt: null,
      fullSleepConfirmed: false
    }
  };
}
export function unconsciousSleepCompletionPlan(
  system,
  { fullSleepConfirmed = false, reviewLegacyNoNewCause = false, earlierRequirementsConfirmed = false } = {}
) {
  const state = mentalLeapState(system),
    sleep = system.mentalLeapSleep,
    history = sleepHistory(sleep, system.worldTime);
  if (!state.recoveryAvailable || !sleep || sleep.completedAt !== null || fullSleepConfirmed !== true)
    throw new Error(loc`Confirm every retained requirement’s full hours of actual sleep.`);
  const keys = state.unconsciousCauses.map(c => c.key).sort();
  if (history.legacy ? reviewLegacyNoNewCause !== true : !sameKeys(sleep.causeKeys, keys))
    throw new Error(loc`New or unreviewed unconsciousness causes require review before recovery.`);
  if (history.legacyReviewRequired && earlierRequirementsConfirmed !== true)
    throw new Error(loc`The GC must review and confirm all earlier retained sleep requirements.`);
  const dueAt = Math.max(...history.requirements.map(r => r.dueAt), sleep.previousDueAt ?? -Infinity);
  if (sleep.dueAt !== dueAt || system.worldTime < dueAt)
    throw new Error(loc`Complete a valid sleep interval after its due time.`);
  const record = {
    confirmed: true,
    at: system.worldTime,
    requiredHours: sleep.requiredHours,
    completedHours: (system.worldTime - sleep.at) / 3600,
    resolvedFrom: state.unconsciousSince,
    causeKeys: keys
  };
  const completedSleep = {
    ...sleep,
    causeKeys: keys,
    requirements: history.requirements,
    reviewedLegacyNoNewCause: history.legacy ? reviewLegacyNoNewCause : sleep.reviewedLegacyNoNewCause === true,
    earlierRequirementsConfirmed: history.legacyReviewRequired ? earlierRequirementsConfirmed : false,
    completedAt: system.worldTime,
    fullSleepConfirmed: true
  };
  return { record, completedSleep };
}

// Mental Leap's resistance to fatigue and exhaustion as part of a save plan.
rollPipeline.register({
  id: "fatigueResistanceSaveTerm",
  kinds: ["save"],
  order: 9460,
  terms({ system, input }) {
    const bonus =
      input.fatigueCondition === "fatigue"
        ? (system.mentalLeapState?.fatigueSaveBonus ?? 0)
        : input.fatigueCondition === "exhaustion"
          ? (system.mentalLeapState?.exhaustionSaveBonus ?? 0)
          : 0;
    return {
      rowAt: 70,
      rows: [[loc`Fatigue resistance`, bonus]],
      flavorAt: 80,
      flavor: bonus ? loc` — Fatigue/exhaustion resistance +${bonus}` : "",
      options: { fatigueBonus: bonus, fatigueCondition: input.fatigueCondition ?? "" }
    };
  }
});
