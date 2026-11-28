import { campaignRules } from "./campaign-rules.mjs";
import { analysisChallengeCount } from "./forensic-genius.mjs";
import { taskPressureState, taskPressureUseSpec, taskPressureUseProof } from "./task-pressure.mjs";
import { rollEvidence, errorDecisionPending } from "./outcomes.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
import { same } from "./equal.mjs";
const whole = n => Number.isSafeInteger(n) && n >= 0;
export const forensicTaskSource = s => s.activeFeatNames?.includes("Forensic Genius") === true;
const validTiming = t =>
  t == null ||
  (t &&
    Number.isFinite(t.startedAt) &&
    Number.isFinite(t.limitSeconds) &&
    t.limitSeconds > 0 &&
    Number.isFinite(t.deadline) &&
    t.deadline === t.startedAt + t.limitSeconds);
const untimedContext = c => {
  const { completedAt, pressureUse, pressureRollId, ...rest } = c ?? {};
  return rest;
};
export function analysisTaskValid(t) {
  if (
    !t ||
    !validTiming(t.timing) ||
    t.version !== 1 ||
    typeof t.id !== "string" ||
    !t.id.startsWith("task_") ||
    typeof t.title !== "string" ||
    !t.title.trim() ||
    !Number.isSafeInteger(t.baseChallenges) ||
    t.baseChallenges < 2 ||
    typeof t.forensicGenius !== "boolean" ||
    (t.forensicsOnly !== undefined && typeof t.forensicsOnly !== "boolean") ||
    (t.forensicsOnly === true && typeof t.trackingMastery !== "boolean") ||
    (t.forensicsOnly !== true && t.trackingMastery !== undefined) ||
    (t.campaignChallenges !== undefined && !Number.isSafeInteger(t.campaignChallenges)) ||
    t.requiredChallenges !==
      Math.max(
        1,
        Math.max(1, t.baseChallenges - (t.forensicGenius ? 2 : 0) - (t.trackingMastery ? 1 : 0)) +
          (t.campaignChallenges ?? 0)
      ) ||
    !whole(t.revision) ||
    !Array.isArray(t.events) ||
    t.revision !== t.events.length
  )
    return false;
  try {
    taskPressureState(t);
  } catch {
    return false;
  }
  let progress = 0;
  const seen = new Set();
  for (const e of t.events) {
    if (
      !e ||
      typeof e.messageUuid !== "string" ||
      seen.has(e.messageUuid) ||
      !Number.isSafeInteger(e.change) ||
      e.before !== progress ||
      !Number.isSafeInteger(e.after) ||
      e.after !== e.before + e.change ||
      typeof e.evidence !== "string" ||
      typeof e.success !== "boolean" ||
      typeof e.criticalSuccess !== "boolean" ||
      typeof e.criticalFailure !== "boolean" ||
      !whole(e.activationCount) ||
      progress < 0 ||
      progress >= t.requiredChallenges ||
      (e.criticalSuccess && (!e.success || e.criticalFailure)) ||
      (e.criticalFailure && e.success)
    )
      return false;
    if (t.pressured) {
      if (!whole(e.pressureRevision) || e.pressureRevision > (t.pressureAttempts ?? []).length) return false;
      try {
        const p = taskPressureState({
          ...t,
          revision: seen.size,
          pressureAttempts: (t.pressureAttempts ?? []).slice(0, e.pressureRevision)
        });
        if (!p.ready) return false;
      } catch {
        return false;
      }
    }
    const after = e.criticalFailure
      ? progress - e.activationCount
      : Math.min(t.requiredChallenges, progress + (e.criticalSuccess ? 2 : e.success ? 1 : 0));
    if (e.after !== after) return false;
    if (
      t.timing &&
      (!Number.isFinite(e.completedAt) || e.completedAt < t.timing.startedAt || e.completedAt >= t.timing.deadline)
    )
      return false;
    seen.add(e.messageUuid);
    progress = e.after;
  }
  if (t.timedOutAt !== undefined)
    return (
      !!t.timing &&
      Number.isFinite(t.timedOutAt) &&
      t.timedOutAt >= t.timing.deadline &&
      progress === t.completed &&
      progress >= 0 &&
      progress < t.requiredChallenges &&
      t.status === "failed"
    );
  return (
    progress === t.completed &&
    progress <= t.requiredChallenges &&
    t.status === (progress < 0 ? "failed" : progress >= t.requiredChallenges ? "complete" : "active")
  );
}
export function createAnalysisTaskPlan(
  system,
  {
    id,
    title,
    baseChallenges,
    unpressuredUntimedConfirmed = false,
    unpressuredConfirmed = false,
    pressuredConfirmed = false,
    forensicsOnlyConfirmed = false,
    timeLimitSeconds = null,
    at = 0
  } = {}
) {
  if (
    [unpressuredUntimedConfirmed, unpressuredConfirmed, pressuredConfirmed, forensicsOnlyConfirmed].some(
      v => typeof v !== "boolean"
    )
  )
    throw new Error(loc`Confirm the task’s pressure condition with explicit boolean choices.`);
  if (pressuredConfirmed === true && (unpressuredConfirmed === true || unpressuredUntimedConfirmed === true))
    throw new Error(loc`Choose one pressure condition for this task.`);
  if (
    pressuredConfirmed !== true &&
    unpressuredConfirmed !== true &&
    !(unpressuredUntimedConfirmed === true && timeLimitSeconds === null)
  )
    throw new Error(loc`The GC must confirm this Complex Analysis Task is unpressured.`);
  if (
    (timeLimitSeconds !== null && (!Number.isFinite(timeLimitSeconds) || timeLimitSeconds <= 0)) ||
    !Number.isFinite(at) ||
    (timeLimitSeconds !== null && !Number.isFinite(at + timeLimitSeconds))
  )
    throw new Error(loc`Enter a positive finite time limit in seconds, or leave it empty for no deadline.`);
  if (typeof id !== "string" || !/^task_[A-Za-z0-9]+$/.test(id) || system.analysisTasks?.[id])
    throw new Error(loc`Choose a new task identifier.`);
  if (typeof title !== "string" || !title.trim() || title.trim().length > 160)
    throw new Error(loc`Enter a task name of 1–160 characters.`);
  if (!Number.isSafeInteger(baseChallenges) || baseChallenges < 2)
    throw new Error(
      loc`Enter a whole unmodified Challenge count of at least 2 (pp.99–100); apply feat reductions afterward.`
    );
  const forensicGenius = forensicTaskSource(system),
    counts = analysisChallengeCount(system, baseChallenges, { forensics: forensicsOnlyConfirmed }),
    campaignShift = Math.trunc(Number(campaignRules().complexTaskChallenges) || 0);
  return {
    version: 1,
    id,
    title: title.trim(),
    baseChallenges,
    // Speed-Frame needs 1 Challenge fewer and Thriller 1 more (p.408), fixed when the task begins.
    requiredChallenges: Math.max(1, counts.required + campaignShift),
    ...(campaignShift ? { campaignChallenges: campaignShift } : {}),
    forensicGenius,
    ...(forensicsOnlyConfirmed ? { forensicsOnly: true, trackingMastery: counts.trackingMastery } : {}),
    ...(pressuredConfirmed === true ? { pressured: true, pressureAttempts: [] } : {}),
    ...(timeLimitSeconds !== null
      ? { timing: { startedAt: at, limitSeconds: timeLimitSeconds, deadline: at + timeLimitSeconds } }
      : {}),
    createdAt: at,
    completed: 0,
    status: "active",
    revision: 0,
    events: []
  };
}
export function analysisTaskCheckPlan(
  system,
  key,
  check,
  {
    analysisTaskId = "",
    inCombat = false,
    taskPressure = false,
    taskWorldTime = null,
    taskChallengeDC = null,
    taskChallengeDCConfirmed = false
  } = {}
) {
  if (!analysisTaskId) return { context: null, blockedReason: "", notes: [] };
  const reject = blockedReason => ({ context: null, blockedReason, notes: [] }),
    t = system.analysisTasks?.[analysisTaskId];
  if (!t?.pressured && (inCombat === true || taskPressure === true))
    return reject(loc`Resolve combat or pressure through its separate task workflow before attempting this Challenge.`);
  const pressureCheck = t?.pressured === true && key === "resolve" && check.id === "task-pressure";
  if (key !== "analysis" && !pressureCheck)
    return reject(loc`Choose an Analysis Challenge or the task’s Resolve pressure check.`);
  if (!analysisTaskValid(t) || t.id !== analysisTaskId) return reject(loc`The selected task record needs GC review.`);
  if (
    t.timing &&
    (!Number.isFinite(taskWorldTime) || taskWorldTime >= t.timing.deadline || taskWorldTime < t.timing.startedAt)
  )
    return reject(loc`This task’s deadline has elapsed, or the current game clock needs review.`);
  if (t.forensicsOnly === true && !pressureCheck && check.id !== "forensics")
    return reject(loc`This task requires an Analysis/Forensics check for every Challenge.`);
  if (t.forensicsOnly === true && t.trackingMastery !== (system.activeFeatNames?.includes("Tracking Mastery") === true))
    return reject(loc`Tracking Mastery eligibility changed; the GC must review the Forensics task before continuing.`);
  if (t.status !== "active") return reject(loc`This Complex Analysis Task has already ended.`);
  if (t.pressured && system.accumulatedDamage?.pending?.length)
    return reject(loc`Resolve pending damage saves in Health before continuing this task.`);
  if (t.forensicGenius !== forensicTaskSource(system))
    return reject(loc`Forensic Genius eligibility changed; the GC must review the task before continuing.`);
  const p = taskPressureState(t);
  if (t.pressured && (pressureCheck ? !p.needsCheck : !p.ready))
    return reject(
      pressureCheck
        ? loc`Pressure is already cleared for this Challenge.`
        : loc`Complete this Challenge’s Resolve(Con) pressure check first.`
    );
  const dc = typeof taskChallengeDC === "string" && taskChallengeDC.trim() ? Number(taskChallengeDC) : taskChallengeDC;
  if (pressureCheck && (!Number.isSafeInteger(dc) || dc < 0 || taskChallengeDCConfirmed !== true))
    return reject(loc`Confirm the upcoming Challenge’s actual whole DC before its Resolve pressure check.`);
  const spec = pressureCheck ? taskPressureUseSpec(t) : null;
  return {
    context: {
      version: 1,
      id: t.id,
      revision: t.revision,
      completed: t.completed,
      baseChallenges: t.baseChallenges,
      requiredChallenges: t.requiredChallenges,
      forensicGenius: t.forensicGenius,
      ...(t.forensicsOnly ? { forensicsOnly: true, trackingMastery: t.trackingMastery } : {}),
      ...(t.pressured
        ? {
            stage: pressureCheck ? "pressure" : "challenge",
            pressureRevision: p.revision,
            pressureImmune: p.immune,
            pressureErrorIncrease: pressureCheck ? 0 : p.errorIncrease,
            ...(pressureCheck ? { challengeDC: dc } : p.passed ? { challengeDC: p.challengeDC } : {}),
            ...(spec ? { pressureUseId: spec.id } : {})
          }
        : {}),
      ...(t.timing ? { timing: structuredClone(t.timing) } : {}),
      skillKey: key,
      checkId: check.id
    },
    blockedReason: "",
    notes: [
      loc`Complex Analysis Task “${t.title}”: ${t.completed}/${t.requiredChallenges} Challenges completed.${t.timing ? loc` Deadline: game time ${t.timing.deadline} seconds.` : ""} The GC settles this recorded Challenge after its outcome and other effects are resolved (pp.99–100).`
    ]
  };
}
/** The owning GC may record the opponents’ decision without requiring a boost or a payment. */
export function analysisTaskSettlementDecision(check, { errorActivationDeclinedConfirmed = false } = {}) {
  if (!check || check.criticalFailure || !errorDecisionPending(check)) return structuredClone(check);
  if (errorActivationDeclinedConfirmed !== true)
    throw new Error(
      loc`The GC must confirm opponents declined error activation, or finish activating the critical failure first.`
    );
  return { ...structuredClone(check), errorActivationDeclined: true };
}
export function analysisTaskOutcomeEvidence(check) {
  return JSON.stringify({
    roll: rollEvidence(check),
    success: check.successConfirmed,
    criticalSuccess: !!check.criticalSuccess,
    criticalFailure: !!check.criticalFailure,
    errorActivationDeclined: check.errorActivationDeclined === true,
    activation: check.criticalActivation ?? null
  });
}
export function settleAnalysisTaskPlan(
  system,
  id,
  check,
  { actorUuid, messageUuid, sourceEffectsResolved = false, at = 0 } = {}
) {
  if (sourceEffectsResolved !== true)
    throw new Error(loc`The GC must finish critical activation decisions and all other Challenge effects first.`);
  const t = system.analysisTasks?.[id],
    plan = analysisTaskCheckPlan(
      analysisTaskReceiptSystem(system, t),
      "analysis",
      { id: check?.checkId },
      { analysisTaskId: id, taskWorldTime: check?.analysisTask?.completedAt ?? null }
    );
  if (plan.blockedReason) throw new Error(plan.blockedReason);
  if (
    !check ||
    check.checkKind !== "skill" ||
    check.skillKey !== "analysis" ||
    check.actorUuid !== actorUuid ||
    !same(untimedContext(check.analysisTask), plan.context) ||
    check.superseded ||
    check.analysisTaskSettlement
  )
    throw new Error(loc`Choose an unsettled Analysis receipt bound to this task’s current Challenge.`);
  if (typeof messageUuid !== "string" || !messageUuid || t.events.some(e => e.messageUuid === messageUuid))
    throw new Error(loc`This receipt is missing or has already been settled.`);
  if (typeof check.successConfirmed !== "boolean" || (!check.criticalFailure && errorDecisionPending(check)))
    throw new Error(loc`Resolve this check’s success and error decision before settling the Challenge.`);
  if (
    (check.criticalSuccess && (!check.successConfirmed || check.criticalFailure)) ||
    (check.criticalFailure && check.successConfirmed)
  )
    throw new Error(loc`The critical result contradicts the recorded outcome.`);
  if (t.timing && (!Number.isFinite(check.analysisTask.completedAt) || check.analysisTask.completedAt > at))
    throw new Error(loc`The task receipt needs its actual completion time, no later than the GC settlement.`);
  let change = check.successConfirmed ? 1 : 0,
    activationCount = 0;
  if (check.criticalSuccess) {
    if (check.criticalActivation?.kind !== "success" || !whole(check.criticalActivation.cost))
      throw new Error(loc`The critical success needs its recorded activation.`);
    change = 2;
  }
  if (check.criticalFailure) {
    const a = check.criticalActivation;
    if (a?.kind !== "failure" || !whole(a.cost))
      throw new Error(loc`The critical failure needs its recorded actual activation-die cost.`);
    activationCount = a.cost;
    change = -activationCount;
  }
  const completed = check.criticalFailure ? t.completed + change : Math.min(t.requiredChallenges, t.completed + change);
  if (!Number.isSafeInteger(completed))
    throw new Error(loc`The resulting progress is outside the supported whole-number range.`);
  const event = {
    ...(t.pressured ? { pressureRevision: plan.context.pressureRevision } : {}),
    messageUuid,
    evidence: analysisTaskOutcomeEvidence(check),
    before: t.completed,
    after: completed,
    change: completed - t.completed,
    success: check.successConfirmed,
    criticalSuccess: !!check.criticalSuccess,
    criticalFailure: !!check.criticalFailure,
    activationCount,
    errorActivationDeclined: check.errorActivationDeclined === true,
    ...(t.timing ? { completedAt: check.analysisTask.completedAt } : {}),
    at
  };
  return {
    ...structuredClone(t),
    completed,
    status: completed < 0 ? "failed" : completed >= t.requiredChallenges ? "complete" : "active",
    revision: t.revision + 1,
    events: [...t.events, event]
  };
}

/** Revalidate the live task and clock even for direct checks or replacement rolls. */
export function validateAnalysisTaskRoll(
  system,
  context,
  { now = null, checkKind = "skill", skillKey = "analysis", checkId = context?.checkId, inCombat = false } = {}
) {
  if (!context) return;
  taskPressureUseProof(system, context);
  const p = analysisTaskCheckPlan(
    system,
    skillKey,
    { id: checkId },
    {
      analysisTaskId: context.id,
      taskWorldTime: now,
      inCombat,
      taskChallengeDC: context.challengeDC,
      taskChallengeDCConfirmed: true
    }
  );
  if (checkKind !== "skill" || p.blockedReason || !same(untimedContext(context), p.context))
    throw new Error(p.blockedReason || loc`The task or its current Challenge changed before the check completed.`);
}
export function expireAnalysisTaskPlan(system, id, { at, confirmed = false } = {}) {
  const t = system.analysisTasks?.[id];
  if (!analysisTaskValid(t) || t.id !== id || t.status !== "active" || !t.timing)
    throw new Error(loc`Choose an active task with a deadline.`);
  if (confirmed !== true || !Number.isFinite(at) || at < t.timing.deadline)
    throw new Error(loc`The GC must confirm the task’s time limit has elapsed.`);
  return { ...structuredClone(t), status: "failed", timedOutAt: at };
}

/** Accepted receipts already passed live source validation when rolled. Later GC logging uses that frozen task scope. */
export function analysisTaskReceiptSystem(system, task) {
  const active = (system.activeFeatNames ?? []).filter(n => n !== "Forensic Genius" && n !== "Tracking Mastery");
  if (task?.forensicGenius === true) active.push("Forensic Genius");
  if (task?.forensicsOnly === true && task?.trackingMastery === true) active.push("Tracking Mastery");
  return { ...system, activeFeatNames: active };
}
export function validateAnalysisTaskReceipt(system, context, options = {}) {
  return validateAnalysisTaskRoll(
    analysisTaskReceiptSystem(system, system.analysisTasks?.[context?.id]),
    context,
    options
  );
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "analysisTaskRoll",
  order: 1210,
  validate: ({ actor, options, checkKind, checkId, skillKey }) =>
    validateAnalysisTaskRoll(actor.system, options.analysisTask, {
      now: game.time?.worldTime ?? null,
      checkKind,
      skillKey,
      checkId,
      inCombat: !!actor.participatingCombat
    })
});
