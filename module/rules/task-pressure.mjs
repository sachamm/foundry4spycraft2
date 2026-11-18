import { rollEvidence, errorDecisionPending } from "./outcomes.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
const whole = n => Number.isSafeInteger(n) && n >= 0;
export const TASK_PRESSURE_CHECK = {
  id: "task-pressure",
  name: "Task Pressure Check",
  attributes: ["con"],
  mode: "Active",
  tags: "",
  time: "Before a Challenge",
  error: 1,
  page: 100,
  synergies: []
};
export const pressureStressSource = uuid => `Complex task pressure: ${uuid}`;
/** Settled pressure attempts are separate from completed Challenges (p.100). */
export function taskPressureState(task) {
  if (
    !task ||
    typeof task.id !== "string" ||
    !whole(task.revision) ||
    !["active", "complete", "failed"].includes(task.status) ||
    (task.pressured !== undefined && typeof task.pressured !== "boolean") ||
    (task.pressureAttempts !== undefined && !Array.isArray(task.pressureAttempts))
  )
    throw new Error(loc`Review the task’s pressure history.`);
  const attempts = task.pressureAttempts ?? [];
  if (!task.pressured && attempts.length) throw new Error(loc`An unpressured task cannot contain pressure attempts.`);
  let immune = false,
    passedAt = null,
    passedDC = null,
    errorIncrease = 0,
    previousRevision = -1;
  const receipts = new Set(),
    damageEvents = new Set();
  for (const [i, e] of attempts.entries()) {
    if (
      !e ||
      e.index !== i ||
      e.taskId !== task.id ||
      !whole(e.challengeRevision) ||
      e.challengeRevision > task.revision ||
      e.challengeRevision < previousRevision ||
      immune ||
      passedAt === e.challengeRevision ||
      typeof e.messageUuid !== "string" ||
      !e.messageUuid ||
      receipts.has(e.messageUuid) ||
      typeof e.evidence !== "string" ||
      !Number.isSafeInteger(e.challengeDC) ||
      e.challengeDC < 0 ||
      typeof e.success !== "boolean" ||
      typeof e.criticalSuccess !== "boolean" ||
      typeof e.criticalFailure !== "boolean" ||
      (e.criticalSuccess && (!e.success || e.criticalFailure)) ||
      (e.criticalFailure && e.success)
    )
      throw new Error(loc`Review the task’s pressure attempts and their order.`);
    if (e.success) {
      if (e.stressRaw !== 0 || e.damageEventId !== null)
        throw new Error(loc`A successful pressure check cannot inflict failure stress.`);
      passedAt = e.challengeRevision;
      passedDC = e.challengeDC;
      if (e.criticalSuccess) immune = true;
    } else {
      if (
        !Number.isSafeInteger(e.stressRaw) ||
        e.stressRaw < 1 ||
        e.stressRaw > 6 ||
        typeof e.damageEventId !== "string" ||
        !e.damageEventId ||
        damageEvents.has(e.damageEventId)
      )
        throw new Error(loc`A failed pressure check needs its unique1d6stress event.`);
      damageEvents.add(e.damageEventId);
      if (e.criticalFailure)
        errorIncrease++; /* User ruling: full resistance does not negate this separate consequence. */
    }
    receipts.add(e.messageUuid);
    previousRevision = e.challengeRevision;
  }
  const enabled = task.pressured === true,
    passed = enabled && passedAt === task.revision,
    ready = enabled && (passed || immune);
  return {
    enabled,
    revision: attempts.length,
    passed,
    immune,
    errorIncrease,
    ready,
    challengeDC: passed ? passedDC : null,
    needsCheck: enabled && task.status === "active" && !ready
  };
}
export function taskPressureStressRollProof(task, check, stressMessage, { actorUuid, messageUuid } = {}) {
  const state = taskPressureState(task),
    c = stressMessage?.flags?.spycraft2,
    p = c?.taskPressureStress,
    roll = stressMessage?.rolls?.[0],
    die = roll?.dice?.[0],
    results = die?.results ?? [];
  if (
    typeof stressMessage?.uuid !== "string" ||
    !stressMessage.uuid ||
    check.resolved !== true ||
    check.taskPressurePreparation?.version !== 1 ||
    !check.taskPressurePreparation.id ||
    p?.preparationId !== check.taskPressurePreparation.id ||
    p?.version !== 1 ||
    p.taskId !== task.id ||
    p.challengeRevision !== task.revision ||
    p.pressureRevision !== state.revision ||
    p.parentMessageUuid !== messageUuid ||
    c.actorUuid !== actorUuid ||
    c.checkKind !== "damage" ||
    c.actionDiceAllowed !== false ||
    c.boostSpent ||
    String(roll?.formula ?? "").replace(/\s/g, "") !== "1d6" ||
    roll?.dice?.length !== 1 ||
    die?.faces !== 6 ||
    die?.number !== 1 ||
    results.length !== 1 ||
    results[0]?.active === false ||
    !Number.isSafeInteger(roll.total) ||
    roll.total < 1 ||
    roll.total > 6 ||
    results[0]?.result !== roll.total ||
    c.rawTotal !== roll.total ||
    c.effectiveTotal !== roll.total
  )
    throw new Error(loc`Use the locked pressure check’s actual unboosted1d6stress receipt.`);
  return { raw: roll.total, stressMessageUuid: stressMessage.uuid };
}
export function taskPressureStressProof(task, check, stressMessage, damageEvent, options = {}) {
  const result = taskPressureStressRollProof(task, check, stressMessage, options),
    roll = { total: result.raw },
    messageUuid = options.messageUuid;
  if (
    !damageEvent ||
    damageEvent.version !== 1 ||
    typeof damageEvent.id !== "string" ||
    !damageEvent.id ||
    damageEvent.source !== pressureStressSource(messageUuid) ||
    damageEvent.kind !== "stress" ||
    damageEvent.request?.kind !== "stress" ||
    damageEvent.request.newDamage !== roll.total ||
    damageEvent.request.damageMode !== "stressBeforeResistance" ||
    damageEvent.request.criticalHit !== false ||
    damageEvent.criticalHit !== false ||
    !whole(damageEvent.newDamage) ||
    damageEvent.newDamage > roll.total ||
    !whole(damageEvent.before) ||
    damageEvent.total !== damageEvent.before + damageEvent.newDamage ||
    damageEvent.defenseContext?.version !== 1 ||
    damageEvent.defenseContext?.kind !== "stress" ||
    damageEvent.defenseContext?.rawDamage !== roll.total ||
    damageEvent.defenseContext?.netDamage !== damageEvent.newDamage ||
    damageEvent.defenseContext?.resisted !== roll.total - damageEvent.newDamage ||
    damageEvent.defenseContext?.armorPiercing !== "all" ||
    damageEvent.defenseContext?.damageReductionApplied !== 0 ||
    !["recorded", "settled"].includes(damageEvent.state)
  )
    throw new Error(
      loc`Apply this exact stress event, including resistance and any required save, before settling pressure.`
    );
  return { raw: roll.total, damageEventId: damageEvent.id, stressMessageUuid: stressMessage.uuid };
}
/** No health or task mutation occurs here; the future controller must save the prepared consequence once. */
export function taskPressureResultPlan(
  task,
  check,
  { actorUuid, messageUuid, sourceEffectsResolved = false, stressMessage = null, damageEvent = null, at = 0 } = {}
) {
  const state = taskPressureState(task),
    binding = check?.analysisTask;
  if (task.status !== "active" || !state.needsCheck)
    throw new Error(loc`This task does not need another pressure check for its current Challenge.`);
  if (
    !actorUuid ||
    typeof messageUuid !== "string" ||
    !messageUuid ||
    task.pressureAttempts?.some(e => e.messageUuid === messageUuid) ||
    !check ||
    check.actorUuid !== actorUuid ||
    check.checkKind !== "skill" ||
    check.skillKey !== "resolve" ||
    check.checkMethod !== "roll" ||
    check.checkId !== "task-pressure" ||
    binding?.stage !== "pressure" ||
    binding.id !== task.id ||
    binding.revision !== task.revision ||
    binding.pressureRevision !== state.revision ||
    check.superseded ||
    check.analysisTaskSettlement
  )
    throw new Error(loc`Choose the current task’s actual Resolve pressure receipt.`);
  if (
    !Number.isSafeInteger(binding.challengeDC) ||
    binding.challengeDC < 0 ||
    !Number.isFinite(check.effectiveTotal) ||
    check.successConfirmed !== (check.effectiveTotal >= binding.challengeDC && !check.criticalFailure)
  )
    throw new Error(loc`The pressure outcome must match its final result and the GC-confirmed Challenge DC.`);
  if (
    sourceEffectsResolved !== true ||
    typeof check.successConfirmed !== "boolean" ||
    (!check.criticalFailure && errorDecisionPending(check))
  )
    throw new Error(loc`The GC must resolve success, activation decisions and other pressure-check effects first.`);
  if (
    (check.criticalSuccess && (!check.successConfirmed || check.criticalFailure)) ||
    (check.criticalFailure && check.successConfirmed)
  )
    throw new Error(loc`The pressure critical result contradicts its outcome.`);
  if (check.criticalSuccess || check.criticalFailure) {
    const a = check.criticalActivation;
    if (a?.kind !== (check.criticalSuccess ? "success" : "failure") || !whole(a.cost))
      throw new Error(loc`The pressure critical result needs its recorded actual activation.`);
  }
  if (
    task.timing &&
    (!Number.isFinite(binding.completedAt) ||
      binding.completedAt < task.timing.startedAt ||
      binding.completedAt >= task.timing.deadline ||
      binding.completedAt > at)
  )
    throw new Error(loc`The pressure check did not finish before the task deadline.`);
  return { state, binding };
}
export function taskPressureAttemptPlan(
  task,
  check,
  { actorUuid, messageUuid, sourceEffectsResolved = false, stressMessage = null, damageEvent = null, at = 0 } = {}
) {
  const { state, binding } = taskPressureResultPlan(task, check, { actorUuid, messageUuid, sourceEffectsResolved, at });
  const stress = check.successConfirmed
    ? { raw: 0, damageEventId: null, stressMessageUuid: null }
    : taskPressureStressProof(task, check, stressMessage, damageEvent, { actorUuid, messageUuid });
  const event = {
    index: state.revision,
    taskId: task.id,
    challengeRevision: task.revision,
    challengeDC: binding.challengeDC,
    messageUuid,
    evidence: JSON.stringify({
      roll: rollEvidence(check),
      success: check.successConfirmed,
      criticalSuccess: !!check.criticalSuccess,
      criticalFailure: !!check.criticalFailure,
      activation: check.criticalActivation ?? null,
      errorActivationDeclined: check.errorActivationDeclined === true
    }),
    success: check.successConfirmed,
    criticalSuccess: !!check.criticalSuccess,
    criticalFailure: !!check.criticalFailure,
    stressRaw: stress.raw,
    damageEventId: stress.damageEventId,
    stressMessageUuid: stress.stressMessageUuid,
    at
  };
  const next = { ...structuredClone(task), pressureAttempts: [...(task.pressureAttempts ?? []), event] },
    after = taskPressureState(next);
  return {
    task: next,
    event,
    state: after,
    challengeProgress: 0,
    stressDamage: stress.raw,
    errorIncrease: after.errorIncrease - state.errorIncrease
  };
}

export function taskPressureUseSpec(task) {
  const p = taskPressureState(task);
  return p.needsCheck
    ? {
        id: `taskPressure_${task.id}_${task.revision}_${p.revision}`,
        name: `Pressure check: ${task.title ?? task.id}`,
        period: "task",
        limit: 1,
        cost: 0,
        workflow: "taskPressure",
        hidden: true,
        manualReviewable: true
      }
    : null;
}
export function taskPressureSkillChecks(system, key, checks) {
  return key === "resolve" &&
    Object.values(system.analysisTasks ?? {}).some(t => {
      try {
        return taskPressureState(t).needsCheck;
      } catch {
        return false;
      }
    })
    ? [...checks, structuredClone(TASK_PRESSURE_CHECK)]
    : checks;
}
export function taskPressureUseProof(system, binding) {
  if (binding?.stage !== "pressure") return null;
  const use = system.resourceUses?.[binding.pressureUseId],
    epoch = String(system.usagePeriods?.task ?? "initial");
  if (
    !use ||
    use.epoch !== epoch ||
    use.used !== 1 ||
    (binding.pressureUse && JSON.stringify(binding.pressureUse) !== JSON.stringify(use))
  )
    throw new Error(loc`The reserved pressure-check attempt changed before posting.`);
  return structuredClone(use);
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "taskPressureChecks",
  order: 5040,
  kinds: ["skill"],
  skillChecks: ({ actor, skillKey }, checks) => taskPressureSkillChecks(actor.system, skillKey, checks)
});
