import { mentalLeapState, mentalLeapFatigueEvent } from "./mental-leap.mjs";
import { loc } from "../i18n.mjs";
const kinds = ["fatigued", "exhausted"],
  beforeStates = ["none", ...kinds],
  afterStates = [...kinds, "unconscious"];
const time = n => Number.isFinite(n) && Math.abs(n) <= Number.MAX_SAFE_INTEGER;
export function fatigueApplicationHistory(system) {
  const rows = [],
    warnings = [],
    seen = new Set();
  for (const r of system.fatigueApplications ?? []) {
    const expectedAfter =
        r?.before === "exhausted"
          ? "unconscious"
          : r?.kind === "exhausted" || r?.before === "fatigued"
            ? "exhausted"
            : "fatigued",
      event = (system.mentalLeapFatigueEvents ?? []).find(e => e?.id === r?.eventId);
    const valid =
      r &&
      typeof r.id === "string" &&
      r.id &&
      !seen.has(r.id) &&
      kinds.includes(r.kind) &&
      typeof r.source === "string" &&
      r.source.trim() &&
      time(r.at) &&
      r.at <= system.worldTime &&
      beforeStates.includes(r.before) &&
      afterStates.includes(r.after) &&
      r.after === expectedAfter &&
      (r.after !== "unconscious" ||
        r.needsReview === true ||
        (event &&
          event.at === r.at &&
          event.reason === "Fatigued or exhausted again while already exhausted: unconscious.")) &&
      (r.after !== "unconscious" || (typeof r.eventId === "string" && r.eventId)) &&
      (r.needsReview === undefined || typeof r.needsReview === "boolean");
    if (!valid) {
      warnings.push(loc`Review malformed, duplicate or future fatigue-application history.`);
      continue;
    }
    seen.add(r.id);
    rows.push(r);
    if (r.needsReview) warnings.push(loc`A fatigue application needs GC review after incomplete restoration.`);
  }
  return { rows, warnings };
}
export function fatigueStateSignature(system) {
  const s = mentalLeapState(system);
  return JSON.stringify({
    fatigued: s.fatigued,
    exhausted: s.exhausted,
    unconscious: s.unconscious,
    events: system.mentalLeapFatigueEvents ?? [],
    applications: system.fatigueApplications ?? []
  });
}
export function fatigueApplicationPlan(system, { id, kind, source = "", confirmed = false, expectedState } = {}) {
  if (
    confirmed !== true ||
    !kinds.includes(kind) ||
    typeof source !== "string" ||
    !source.trim() ||
    typeof id !== "string" ||
    !id ||
    !time(system.worldTime)
  )
    throw new Error(loc`Confirm the incoming Fatigued/Exhausted application, its source and game clock.`);
  const history = fatigueApplicationHistory(system);
  if (history.warnings.length) throw new Error(history.warnings.join(" "));
  const existing = history.rows.find(r => r.id === id);
  if (existing) {
    if (existing.kind !== kind || existing.source !== source.trim())
      throw new Error(loc`This application identifier already belongs to a different incoming condition.`);
    return { duplicate: true, record: existing };
  }
  if (expectedState !== undefined && expectedState !== fatigueStateSignature(system))
    throw new Error(
      loc`The fatigue state changed while confirming this application. Review the new state before applying it.`
    );
  const state = mentalLeapState(system),
    before = state.exhausted ? "exhausted" : state.fatigued ? "fatigued" : "none";
  const after = state.exhausted ? "unconscious" : kind === "exhausted" || state.fatigued ? "exhausted" : "fatigued";
  const event =
    after === "unconscious" ? mentalLeapFatigueEvent(system, { id: "fatigue-" + id, confirmed: true }) : null;
  const record = {
    id,
    kind,
    source: source.trim(),
    at: system.worldTime,
    before,
    after,
    ...(event ? { eventId: event.id } : {})
  };
  return {
    duplicate: false,
    record,
    event,
    clearFatigued: after === "exhausted" && system.conditionContext?.fatigued === true,
    applyStatus: after === "unconscious" ? null : after
  };
}

const REST = {
  fatigued: { mode: "inactiveRest", requiredHours: 8 },
  exhausted: { mode: "sleep", requiredHours: 1 },
  drunk: { mode: "sleep", requiredHours: 4 }
};
const restConditions = kind => (kind === "drunk" ? ["drunk"] : kind === "fatigue" ? ["fatigued", "exhausted"] : []);
const sourceIds = ids =>
  Array.isArray(ids) && ids.every(id => typeof id === "string" && id) && new Set(ids).size === ids.length;
const sorted = ids => [...ids].sort();
function validRest(r, now, restKind) {
  return (
    r &&
    restConditions(restKind).includes(r.condition) &&
    r.mode === REST[r.condition].mode &&
    r.requiredHours === REST[r.condition].requiredHours &&
    r.ordinaryRuleConfirmed === true &&
    time(r.startedAt) &&
    r.startedAt <= now &&
    time(r.startedAt + r.requiredHours * 3600) &&
    sourceIds(r.sourceIds) &&
    r.sourceIds.length > 0 &&
    (r.needsReview === undefined || typeof r.needsReview === "boolean") &&
    (r.completedAt === null ||
      (time(r.completedAt) &&
        r.completedAt <= now &&
        r.completedAt >= r.startedAt + r.requiredHours * 3600 &&
        r.fullRecoveryConfirmed === true))
  );
}
export function fatigueRestStatus(system, { restKind = "fatigue" } = {}) {
  const r = system.fatigueRest;
  if (!r) return null;
  if (!time(system.worldTime) || !validRest(r, system.worldTime, restKind))
    return { needsReview: true, warning: loc`Review the condition rest record and game clock.` };
  if (r.needsReview)
    return {
      needsReview: true,
      warning: loc`The condition rest recovery needs GC review after incomplete restoration.`
    };
  const secondsRemaining = Math.max(0, r.startedAt + r.requiredHours * 3600 - system.worldTime);
  const minutes = Math.ceil(secondsRemaining / 60),
    hours = Math.floor(minutes / 60),
    remainingLabel = minutes
      ? `${hours ? hours + " h " : ""}${minutes % 60 ? (minutes % 60) + " min" : ""}`.trim()
      : loc`Time elapsed`;
  return {
    ...r,
    needsReview: false,
    pending: r.completedAt === null,
    secondsRemaining,
    remainingLabel,
    requiredLabel:
      r.condition === "drunk"
        ? "4 full hours asleep"
        : r.condition === "exhausted"
          ? "1 full hour asleep"
          : loc`8 hours of inactive rest`
  };
}
export function fatigueRestRecord(
  system,
  { condition, ids, confirmed = false, ordinaryRuleConfirmed = false, restart = false, restKind = "fatigue" } = {}
) {
  if (
    !restConditions(restKind).includes(condition) ||
    system.conditionContext?.[condition] !== true ||
    !sourceIds(ids) ||
    !ids.length
  )
    throw new Error(loc`Choose an existing condition in this recovery family and its current sources.`);
  if (condition === "fatigued" && system.conditionContext?.exhausted)
    throw new Error(loc`Review the overlapping fatigue sources before tracking Fatigued recovery.`);
  if (confirmed !== true || ordinaryRuleConfirmed !== true || typeof restart !== "boolean" || !time(system.worldTime))
    throw new Error(loc`Confirm the start of sleep/rest and that this condition uses its ordinary recovery rule.`);
  const previous = fatigueRestStatus(system, { restKind });
  if (previous?.needsReview) throw new Error(previous.warning);
  const canonical = sorted(ids);
  if (
    previous?.pending &&
    previous.condition === condition &&
    JSON.stringify(sorted(previous.sourceIds)) === JSON.stringify(canonical) &&
    !restart
  )
    return { record: system.fatigueRest, reused: true };
  const rule = REST[condition];
  if (!time(system.worldTime + rule.requiredHours * 3600))
    throw new Error(loc`The required rest exceeds the safe game clock.`);
  return {
    record: {
      condition,
      ...rule,
      startedAt: system.worldTime,
      sourceIds: canonical,
      ordinaryRuleConfirmed: true,
      completedAt: null,
      fullRecoveryConfirmed: false,
      needsReview: false
    },
    reused: false
  };
}
export function fatigueRestCompletionPlan(system, { ids, fullRecoveryConfirmed = false, restKind = "fatigue" } = {}) {
  const state = fatigueRestStatus(system, { restKind });
  if (!state) throw new Error(loc`Begin the required sleep/rest period first.`);
  if (state.needsReview) throw new Error(state.warning);
  if (!state.pending) return { record: system.fatigueRest, duplicate: true, alreadyAbsent: true };
  if (fullRecoveryConfirmed !== true)
    throw new Error(loc`The GC must confirm the full required period was actually spent asleep or in inactive rest.`);
  if (!sourceIds(ids)) throw new Error(loc`Review the current condition sources.`);
  if (state.secondsRemaining > 0)
    throw new Error(loc`The game clock has not reached the required sleep/rest duration.`);
  if (ids.length && JSON.stringify(sorted(ids)) !== JSON.stringify(sorted(state.sourceIds)))
    throw new Error(
      loc`The condition sources changed since this rest began. Review the new condition before recovering.`
    );
  if (!ids.length && system.conditionContext?.[state.condition])
    throw new Error(loc`The condition remains active from an unreviewed source.`);
  return {
    record: { ...system.fatigueRest, completedAt: system.worldTime, fullRecoveryConfirmed: true },
    duplicate: false,
    alreadyAbsent: !ids.length
  };
}
