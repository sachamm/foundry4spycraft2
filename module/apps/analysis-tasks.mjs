import {
  taskPressureAttemptPlan,
  taskPressureResultPlan,
  taskPressureStressRollProof,
  pressureStressSource
} from "../rules/task-pressure.mjs";
import { validateDamageLedger } from "../rules/accumulated-damage.mjs";
import { applyAccumulatedDamage } from "./damage-ledger.mjs";
import {
  validateAnalysisTaskReceipt,
  analysisTaskValid,
  createAnalysisTaskPlan,
  expireAnalysisTaskPlan,
  analysisTaskSettlementDecision,
  settleAnalysisTaskPlan
} from "../rules/analysis-tasks.mjs";
import { queueResources } from "../services/transactions.mjs";
import { loc } from "../i18n.mjs";
import { same } from "../rules/equal.mjs";
const copy = v => structuredClone(v),
  esc = v => foundry.utils.escapeHTML(String(v ?? ""));
const gc = a => {
  if (!game.user?.isGM || !a.isOwner || a.type !== "agent")
    throw new Error(loc`Only an owning GC may manage Complex Analysis Tasks.`);
};
const current = (a, id) => a.system.analysisTasks?.[id] ?? null;
export function analysisTaskReview(a) {
  return a.flags?.spycraft2?.analysisTaskReview ?? game.spycraft2?.pendingAnalysisTasks?.[a.uuid] ?? null;
}
function clearForWork(a) {
  if (analysisTaskReview(a)) throw new Error(loc`Review the interrupted task update before continuing.`);
}
async function hold(a, transaction, error) {
  const review = { version: 1, actorUuid: a.uuid, transaction: copy(transaction), reason: error.message };
  game.spycraft2 ??= {};
  game.spycraft2.pendingAnalysisTasks ??= {};
  game.spycraft2.pendingAnalysisTasks[a.uuid] = review;
  try {
    await a.update({ "flags.spycraft2.analysisTaskReview": review });
  } catch {
    ui.notifications.warn(
      loc`The task review could not be saved. Keep this actor open and finish the GC review before reloading.`
    );
  }
  ui.notifications.warn(loc`The task update needs GC review before another Challenge can be settled.`);
  return { needsReview: true };
}
async function writeTask(a, id, value) {
  const patch =
    value === null ? { ["system.analysisTasks.-=" + id]: null } : { ["system.analysisTasks." + id]: copy(value) };
  try {
    await a.update(patch);
  } catch (e) {
    if (!same(current(a, id), value)) throw e;
  }
  if (!same(current(a, id), value)) throw new Error(loc`The saved task does not match the intended progress.`);
}
async function writeCheck(m, value) {
  try {
    await m.update({ "flags.spycraft2": copy(value) });
  } catch (e) {
    if (!same(m.flags?.spycraft2, value)) throw e;
  }
  if (!same(m.flags?.spycraft2, value)) throw new Error(loc`The Challenge receipt could not be saved completely.`);
}
export async function createAnalysisTask(a, options = {}) {
  gc(a);
  clearForWork(a);
  let input = options;
  const source = JSON.stringify(
    ["Forensic Genius", "Tracking Mastery"].map(n => a.system.activeFeatNames?.includes(n) === true)
  );
  if (!Object.keys(input).length) return manageAnalysisTasks(a);
  return queueResources([a], async () => {
    gc(a);
    clearForWork(a);
    if (input.pressuredConfirmed === true) validateDamageLedger(a.system.accumulatedDamage);
    if (
      source !==
      JSON.stringify(["Forensic Genius", "Tracking Mastery"].map(n => a.system.activeFeatNames?.includes(n) === true))
    )
      throw new Error(loc`The task source changed while preparing it.`);
    const id = "task_" + foundry.utils.randomID(),
      record = createAnalysisTaskPlan(a.system, { ...input, id, at: game.time?.worldTime ?? 0 }),
      transaction = { kind: "create", id, before: null, after: record, messageUuid: null };
    try {
      await writeTask(a, id, record);
    } catch (error) {
      if (current(a, id) === null) throw error;
      return hold(a, transaction, error);
    }
    return record;
  });
}
export async function settleAnalysisTask(a, id, message, options = {}) {
  gc(a);
  clearForWork(a);
  if (!message?.uuid) throw new Error(loc`Choose the actual recorded Challenge message.`);
  const expectedTask = copy(current(a, id)),
    expectedCheck = copy(message.flags?.spycraft2);
  return queueResources([a], async () => {
    gc(a);
    clearForWork(a);
    if (!same(current(a, id), expectedTask) || !same(message.flags?.spycraft2, expectedCheck))
      throw new Error(loc`The task or Challenge receipt changed before settlement.`);
    const decision = analysisTaskSettlementDecision(expectedCheck, options),
      after = await taskAfter(a, id, decision, message, options, game.time?.worldTime ?? 0),
      key = foundry.utils.randomID(),
      marker = {
        version: 1,
        id: key,
        taskId: id,
        revision: after.revision,
        state: "reserved",
        errorDeclinedByGC: decision.errorActivationDeclined === true && expectedCheck.errorActivationDeclined !== true
      },
      reserved = { ...decision, resolved: true, analysisTaskSettlement: marker },
      settled = { ...reserved, analysisTaskSettlement: { ...marker, state: "settled" } },
      transaction = {
        kind: "settle",
        id,
        before: expectedTask,
        after,
        messageUuid: message.uuid,
        original: expectedCheck,
        reserved,
        settled
      };
    try {
      await writeCheck(message, reserved);
    } catch (error) {
      if (same(message.flags?.spycraft2, expectedCheck)) throw error;
      return hold(a, transaction, error);
    }
    try {
      gc(a);
      if (!same(current(a, id), expectedTask) || !same(message.flags?.spycraft2, reserved))
        throw new Error(loc`The task or reserved Challenge changed during settlement.`);
      const live = await taskAfter(
        a,
        id,
        decision,
        message,
        options,
        decision.analysisTask?.stage === "pressure" ? after.pressureAttempts.at(-1).at : after.events.at(-1).at
      );
      if (!same(live, after)) throw new Error(loc`The task source or outcome changed during settlement.`);
      await writeTask(a, id, after);
    } catch (error) {
      if (same(current(a, id), expectedTask)) {
        try {
          await writeCheck(message, expectedCheck);
        } catch (rollback) {
          return hold(
            a,
            transaction,
            new AggregateError([error, rollback], loc`The unused Challenge settlement could not be restored.`)
          );
        }
        throw error;
      }
      return hold(a, transaction, error);
    }
    try {
      gc(a);
      if (!same(message.flags?.spycraft2, reserved) || !same(current(a, id), after))
        throw new Error(loc`The saved task or reserved Challenge changed before finalizing.`);
      await writeCheck(message, settled);
    } catch (error) {
      return hold(a, transaction, error);
    }
    return after;
  });
}
export async function reviewAnalysisTaskSettlement(a, { keep, reason = "", confirmed = false } = {}) {
  gc(a);
  const review = copy(analysisTaskReview(a));
  if (
    !review ||
    review.version !== 1 ||
    review.actorUuid !== a.uuid ||
    !["create", "settle", "expire", "pressurePreparation"].includes(review.transaction?.kind) ||
    !analysisTaskValid(review.transaction.after)
  )
    throw new Error(loc`There is no valid interrupted task update to review.`);
  if (typeof keep !== "boolean" || confirmed !== true || typeof reason !== "string" || !reason.trim())
    throw new Error(loc`Confirm the final task result and explain the correction.`);
  return queueResources([a], async () => {
    gc(a);
    if (!same(analysisTaskReview(a), review)) throw new Error(loc`The pending review changed.`);
    const t = review.transaction;
    if (
      !keep &&
      t.kind === "pressurePreparation" &&
      (t.hasRolled ||
        game.messages?.contents?.some(m => m.flags?.spycraft2?.taskPressureStress?.preparationId === t.preparationId))
    )
      throw new Error(loc`The pressure stress die was already rolled; retain that result and finish its consequence.`);
    const m = t.messageUuid ? await fromUuid(t.messageUuid) : null;
    if (t.messageUuid && (!m || ![t.original, t.reserved, t.settled].some(c => same(c, m.flags?.spycraft2))))
      throw new Error(loc`The Challenge receipt changed outside this interrupted update; review it before continuing.`);
    try {
      await writeTask(a, t.id, keep ? t.after : t.before);
      if (m) await writeCheck(m, keep ? t.settled : t.original);
      const history = [
        ...(a.flags?.spycraft2?.analysisTaskReviews ?? []),
        { taskId: t.id, messageUuid: t.messageUuid, keep, reason: reason.trim(), at: game.time?.worldTime ?? 0 }
      ];
      await a.update({ "flags.spycraft2.analysisTaskReviews": history, "flags.spycraft2.-=analysisTaskReview": null });
      if (a.flags?.spycraft2?.analysisTaskReview) throw new Error(loc`The review could not be cleared.`);
      delete game.spycraft2?.pendingAnalysisTasks?.[a.uuid];
      return { reviewed: true, kept: keep };
    } catch (error) {
      return hold(a, t, error);
    }
  });
}
export async function manageAnalysisTasks(a, options = {}) {
  gc(a);
  const tasks = Object.entries(a.system.analysisTasks ?? {}),
    messages =
      game.messages?.contents?.filter(
        m =>
          m.flags?.spycraft2?.actorUuid === a.uuid &&
          m.flags.spycraft2.analysisTask &&
          !m.flags.spycraft2.analysisTaskSettlement &&
          !m.flags.spycraft2.superseded
      ) ?? [],
    review = analysisTaskReview(a),
    expected = {
      tasks: copy(a.system.analysisTasks ?? {}),
      source: ["Forensic Genius", "Tracking Mastery"].map(n => a.system.activeFeatNames?.includes(n) === true),
      review: copy(review)
    },
    receiptSnapshots = Object.fromEntries(messages.map(m => [m.uuid, copy(m.flags.spycraft2)]));
  let input = options;
  if (!Object.keys(input).length) {
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Complex Analysis Tasks` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`Analysis tasks. Pressure requires Resolve(Con) before each Challenge; initialize accumulated damage in Health first. Deadlines use the GC’s game clock; a timely check may be settled later. Other skills and shared multi-actor tasks are resolved separately.`}</p><ul>${tasks.map(([id, t]) => `<li>${esc(t.title || id)}: ${analysisTaskValid(t) ? `${esc(t.completed)}/${esc(t.requiredChallenges)} — ${esc(t.status)}${t.timing ? loc` · ${esc(t.timing.limitSeconds)}s limit; deadline at game time ${esc(t.timing.deadline)}s` : ""}` : "needs review"}</li>`).join("") || `<li>${loc`No recorded tasks`}</li>`}</ul><label>${loc`Action`}<select name="action"><option value="create">${loc`Create task`}</option><option value="settle">${loc`Settle a recorded Challenge`}</option><option value="expire">${loc`Fail a task whose deadline elapsed`}</option><option value="pressureRollStress">${loc`Finalize failed pressure and roll its stress`}</option><option value="pressureApplyStress">${loc`Apply the recorded pressure stress`}</option>${review ? `<option value="reviewKeep">${loc`Review: keep the interrupted result`}</option>${review.transaction?.kind === "pressurePreparation" && review.transaction?.hasRolled ? "" : `<option value="reviewUndo">${loc`Review: undo the interrupted result`}</option>`}` : ""}</select></label><fieldset><legend>${loc`Create task`}</legend><label>${loc`Task name`}<input name="title" maxlength="160" /></label><label>${loc`Unmodified Challenges (at least 2 before feat reductions)`}<input name="baseChallenges" type="number" min="2" step="1" /></label><label><input name="unpressuredConfirmed" type="checkbox" /> ${loc`The GC confirms this task is unpressured`}</label><label>${loc`Time limit in seconds (empty means no deadline)`}<input name="timeLimitSeconds" type="number" min="0" step="any" /></label><label><input name="pressuredConfirmed" type="checkbox" /> ${loc`The GC confirms this task is under pressure (choose one pressure condition)`}</label><label><input name="forensicsOnlyConfirmed" type="checkbox" /> ${loc`This is an Analysis/Forensics task: every recorded Challenge uses Forensics`}</label><p>${loc`Forensic Genius reduces the count by 2; Tracking Mastery reduces an explicitly Forensics task by 1. Apply both reductions before the minimum 1.`}</p></fieldset><fieldset><legend>${loc`Settle Challenge or fail an expired task`}</legend><label><input name="deadlineElapsedConfirmed" type="checkbox" /> ${loc`The GC confirms the deadline elapsed and no timely Challenge remains to settle`}</label><label>${loc`Task`}<select name="taskId">${tasks
        .filter(([, t]) => t.status === "active")
        .map(([id, t]) => `<option value="${esc(id)}">${esc(t.title)}</option>`)
        .join(
          ""
        )}</select></label><label>${loc`Recorded check`}<select name="messageUuid">${messages.map(m => `<option value="${esc(m.uuid)}">${esc(m.flags.spycraft2.checkId)} — ${esc(m.flags.spycraft2.effectiveTotal)} (${esc(m.id)})</option>`).join("")}</select></label><label><input name="errorActivationDeclinedConfirmed" type="checkbox" /> ${loc`The GC confirms opponents declined to activate this error (only when no critical failure was activated)`}</label><label><input name="sourceEffectsResolved" type="checkbox" /> ${loc`The GC finished activation decisions and all other Challenge effects`}</label></fieldset>${review ? `<fieldset><legend>${loc`Interrupted update`}</legend><p>${loc`${esc(review.transaction?.after?.title)}: completed Challenges ${esc(review.transaction?.before?.completed ?? 0)} → ${esc(review.transaction?.after?.completed ?? 0)}.`}</p>${review.transaction?.kind === "pressurePreparation" ? `<p>${loc`Frozen stress die: ${esc(review.transaction?.settled?.taskPressurePreparation?.raw ?? loc`not yet rolled`)}. ${review.transaction?.hasRolled ? loc`Keep resumes this exact die; it cannot be rerolled.` : loc`No stress die has been retained yet.`} Stress is applied through Health separately.`}</p>` : ""}<label>${loc`Reason`}<input name="reason" /></label><label><input name="confirmed" type="checkbox" /> ${loc`I checked the receipt and confirmed the final task progress`}</label></fieldset>` : ""}</div>`
    });
    if (!input) return null;
  }
  if (
    !same(a.system.analysisTasks ?? {}, expected.tasks) ||
    (input.action === "create" &&
      !same(
        expected.source,
        ["Forensic Genius", "Tracking Mastery"].map(n => a.system.activeFeatNames?.includes(n) === true)
      )) ||
    !same(analysisTaskReview(a), expected.review)
  )
    throw new Error(loc`The tasks, source or pending review changed while choosing this action.`);
  if (
    ["settle", "pressureRollStress", "pressureApplyStress"].includes(input.action) &&
    !same((await fromUuid(input.messageUuid))?.flags?.spycraft2, receiptSnapshots[input.messageUuid])
  )
    throw new Error(loc`The selected Challenge receipt changed while choosing it.`);
  if (input.action === "create")
    return createAnalysisTask(a, {
      ...input,
      baseChallenges:
        typeof input.baseChallenges === "string" && input.baseChallenges.trim()
          ? Number(input.baseChallenges)
          : input.baseChallenges,
      timeLimitSeconds:
        input.timeLimitSeconds == null || input.timeLimitSeconds === ""
          ? null
          : typeof input.timeLimitSeconds === "string"
            ? Number(input.timeLimitSeconds)
            : input.timeLimitSeconds
    });
  if (input.action === "pressureRollStress")
    return prepareAnalysisTaskPressure(a, input.taskId, await fromUuid(input.messageUuid), input);
  if (input.action === "pressureApplyStress")
    return applyAnalysisTaskPressureStress(a, input.taskId, await fromUuid(input.messageUuid), input);
  if (input.action === "expire")
    return expireAnalysisTask(a, input.taskId, { confirmed: input.deadlineElapsedConfirmed });
  if (input.action === "settle") return settleAnalysisTask(a, input.taskId, await fromUuid(input.messageUuid), input);
  if (["reviewKeep", "reviewUndo"].includes(input.action))
    return reviewAnalysisTaskSettlement(a, { ...input, keep: input.action === "reviewKeep" });
  throw new Error(loc`Choose a supported task action.`);
}

export async function expireAnalysisTask(a, id, { confirmed = false } = {}) {
  gc(a);
  clearForWork(a);
  const before = copy(current(a, id));
  return queueResources([a], async () => {
    gc(a);
    clearForWork(a);
    if (!same(current(a, id), before)) throw new Error(loc`The task changed while preparing its deadline result.`);
    const after = expireAnalysisTaskPlan(a.system, id, { at: game.time?.worldTime ?? null, confirmed });
    const pending = game.messages?.contents?.some(m => {
      const c = m.flags?.spycraft2;
      return (
        c?.actorUuid === a.uuid &&
        (!c.resolved || (c.taskPressurePreparation && !c.analysisTaskSettlement)) &&
        !c.superseded &&
        c.analysisTask?.id === id &&
        c.analysisTask.revision === before.revision &&
        Number.isFinite(c.analysisTask.completedAt) &&
        c.analysisTask.completedAt < before.timing.deadline
      );
    });
    if (pending) throw new Error(loc`Settle the timely recorded Challenge before failing this task for its deadline.`);
    const transaction = { kind: "expire", id, before, after, messageUuid: null };
    try {
      await writeTask(a, id, after);
    } catch (error) {
      if (same(current(a, id), before)) throw error;
      return hold(a, transaction, error);
    }
    return after;
  });
}

function pressureStressMessages(a, check) {
  const id = check.taskPressurePreparation?.id;
  return id
    ? (game.messages?.contents?.filter(
        m => m.flags?.spycraft2?.actorUuid === a.uuid && m.flags.spycraft2.taskPressureStress?.preparationId === id
      ) ?? [])
    : [];
}
async function taskAfter(a, id, check, message, options, at) {
  if (check.analysisTask?.stage !== "pressure")
    return settleAnalysisTaskPlan(a.system, id, check, {
      ...options,
      actorUuid: a.uuid,
      messageUuid: message.uuid,
      at
    });
  validateAnalysisTaskReceipt(a.system, check.analysisTask, {
    now: check.analysisTask.completedAt ?? at,
    checkKind: check.checkKind,
    skillKey: check.skillKey,
    checkId: check.checkId
  });
  const candidates = pressureStressMessages(a, check),
    stressMessage = candidates[0] ?? null;
  if (candidates.some(m => m.flags.spycraft2.rawTotal !== stressMessage.flags.spycraft2.rawTotal))
    throw new Error(loc`The pressure stress receipts disagree; review their actual roll.`);
  const damageEvent = Object.values(a.flags?.spycraft2?.damageEvents ?? {}).find(
    e => e?.source === pressureStressSource(message.uuid)
  );
  const result = taskPressureAttemptPlan(current(a, id), check, {
    ...options,
    actorUuid: a.uuid,
    messageUuid: message.uuid,
    stressMessage,
    damageEvent,
    at
  });
  if (!analysisTaskValid(result.task)) throw new Error(loc`The pressure result needs a task-history review.`);
  return result.task;
}
function pressureParent(a, id, message, options) {
  const check = analysisTaskSettlementDecision(message?.flags?.spycraft2, options),
    task = current(a, id);
  if (!check || check.successConfirmed !== false) throw new Error(loc`Choose the task’s failed pressure check.`);
  validateAnalysisTaskReceipt(a.system, check.analysisTask, {
    now: check.analysisTask?.completedAt ?? game.time?.worldTime ?? null,
    checkKind: check.checkKind,
    skillKey: check.skillKey,
    checkId: check.checkId
  });
  taskPressureResultPlan(task, check, {
    ...options,
    actorUuid: a.uuid,
    messageUuid: message.uuid,
    at: game.time?.worldTime ?? 0
  });
  return { check, task };
}
export async function prepareAnalysisTaskPressure(a, id, message, options = {}) {
  gc(a);
  clearForWork(a);
  if (!message?.uuid) throw new Error(loc`Choose the actual failed pressure receipt.`);
  if (
    message.flags?.spycraft2?.analysisTaskSettlement?.state === "settled" &&
    current(a, id)?.pressureAttempts?.some(e => e.messageUuid === message.uuid)
  ) {
    const previous = pressureStressMessages(a, message.flags.spycraft2)[0];
    if (previous) return previous;
  }
  const expectedTask = copy(current(a, id)),
    expectedCheck = copy(message.flags?.spycraft2);
  return queueResources(
    [a],
    async () => {
      gc(a);
      clearForWork(a);
      if (!same(current(a, id), expectedTask) || !same(message.flags?.spycraft2, expectedCheck))
        throw new Error(loc`The pressure check or task changed before preparation.`);
      const { check, task } = pressureParent(a, id, message, options),
        prior = copy(message.flags.spycraft2),
        existing = check.taskPressurePreparation,
        prep = existing ?? {
          version: 1,
          id: foundry.utils.randomID(),
          taskId: id,
          challengeRevision: task.revision,
          pressureRevision: task.pressureAttempts?.length ?? 0,
          state: "pendingRoll"
        };
      if (
        prep.version !== 1 ||
        prep.taskId !== id ||
        prep.challengeRevision !== task.revision ||
        prep.pressureRevision !== (task.pressureAttempts?.length ?? 0)
      )
        throw new Error(loc`Review the existing pressure preparation before continuing.`);
      let locked = { ...check, resolved: true, taskPressurePreparation: copy(prep) };
      const transaction = {
        kind: "pressurePreparation",
        id,
        before: copy(task),
        after: copy(task),
        messageUuid: message.uuid,
        original: prior,
        reserved: copy(locked),
        settled: copy(locked),
        preparationId: prep.id,
        hasRolled: !!prep.rollJSON
      };
      if (!existing) {
        try {
          await writeCheck(message, locked);
        } catch (error) {
          if (same(message.flags.spycraft2, prior)) throw error;
          return hold(a, transaction, error);
        }
      }
      let roll;
      if (prep.rollJSON) {
        roll = Roll.fromJSON(prep.rollJSON);
      } else {
        const beforeRollCheck = copy(locked);
        roll = await new Roll("1d6").evaluate();
        locked = {
          ...locked,
          taskPressurePreparation: {
            ...locked.taskPressurePreparation,
            state: "rolled",
            raw: roll.total,
            rollJSON: JSON.stringify(roll.toJSON())
          }
        };
        transaction.hasRolled = true;
        transaction.reserved = beforeRollCheck;
        transaction.settled = copy(locked);
        if (!same(current(a, id), task) || !same(message.flags.spycraft2, beforeRollCheck))
          return hold(a, transaction, new Error(loc`The pressure result changed while rolling stress.`));
        try {
          await writeCheck(message, locked);
        } catch (error) {
          return hold(a, transaction, error);
        }
      }
      if (
        roll._evaluated !== true ||
        String(roll.formula).replace(/\s/g, "") !== "1d6" ||
        !Number.isSafeInteger(roll.total) ||
        roll.total < 1 ||
        roll.total > 6 ||
        locked.taskPressurePreparation.raw !== roll.total
      )
        throw new Error(loc`Review the frozen pressure stress roll before posting it.`);
      let candidates = pressureStressMessages(a, locked);
      if (candidates.some(m => m.flags.spycraft2.rawTotal !== roll.total))
        throw new Error(loc`The pressure stress receipts disagree with the frozen die.`);
      let stress = candidates[0];
      if (!stress) {
        const marker = {
          version: 1,
          preparationId: prep.id,
          taskId: id,
          challengeRevision: task.revision,
          pressureRevision: task.pressureAttempts?.length ?? 0,
          parentMessageUuid: message.uuid
        };
        try {
          stress = await roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: a }),
            flavor: loc`Task pressure:1d6stress before resistance. Apply the recorded stress through the task manager, then resolve any required Health save.`,
            flags: {
              spycraft2: {
                actorUuid: a.uuid,
                checkKind: "damage",
                formula: "1d6",
                rawTotal: roll.total,
                effectiveTotal: roll.total,
                actionDiceAllowed: false,
                taskPressureStress: marker
              }
            }
          });
        } catch (error) {
          stress = pressureStressMessages(a, locked)[0];
          if (!stress) throw error;
        }
      }
      taskPressureStressRollProof(task, locked, stress, { actorUuid: a.uuid, messageUuid: message.uuid });
      const final = {
        ...locked,
        taskPressurePreparation: { ...locked.taskPressurePreparation, state: "posted", stressMessageUuid: stress.uuid }
      };
      transaction.reserved = copy(locked);
      transaction.settled = copy(final);
      transaction.hasRolled = true;
      try {
        await writeCheck(message, final);
      } catch (error) {
        return hold(a, transaction, error);
      }
      return stress;
    },
    { messages: [message] }
  );
}
export async function applyAnalysisTaskPressureStress(a, id, message, options = {}) {
  gc(a);
  clearForWork(a);
  if (message?.flags?.spycraft2?.analysisTaskSettlement?.state === "settled") {
    const event = current(a, id)?.pressureAttempts?.find(e => e.messageUuid === message.uuid),
      previous = event && a.flags?.spycraft2?.damageEvents?.[event.damageEventId];
    if (previous?.source === pressureStressSource(message.uuid) && previous.request?.newDamage === event.stressRaw)
      return previous;
  }
  const { check, task } = pressureParent(a, id, message, options),
    stress = pressureStressMessages(a, check)[0];
  const proof = taskPressureStressRollProof(task, check, stress, { actorUuid: a.uuid, messageUuid: message.uuid });
  const result = await applyAccumulatedDamage(a, {
    source: pressureStressSource(message.uuid),
    kind: "stress",
    newDamage: proof.raw,
    criticalHit: false,
    damageMode: "stressBeforeResistance",
    confirmed: true
  });
  if (result?.state === "pending")
    ui.notifications.warn(
      loc`Resolve the recorded pressure stress save in Health before settling this pressure check.`
    );
  return result;
}
