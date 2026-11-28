import {
  drainedApplicationPlan,
  drainedBuildSignature,
  drainedChoiceRows,
  drainedState,
  reviewDrainedPlan,
  beginDrainedRecovery,
  settleDrainedRecovery,
  reviewDrainedRecoveryPlan,
  DRAINED_RECOVERY_MODE,
  drainedRestorationReview
} from "../rules/drained.mjs";
import { npcDrainedBuildSignature } from "../rules/npc-drained.mjs";
import { rollNpcSkill } from "./gc/npc-play.mjs";
import { queueResources } from "../services/transactions.mjs";
import { sameValues } from "../rules/equal.mjs";
import { formDialog } from "./dialog-kit.mjs";
import { snapshot, undoEntry, postUndo } from "./undo.mjs";
import { loc } from "../i18n.mjs";

const recordOf = actor => actor.flags?.spycraft2?.drained ?? null;
const itemsOf = actor => [...actor.items];
const now = () => game.time.worldTime;
const missionOf = actor => String(actor.system.usagePeriods?.mission ?? "initial");
const own = actor => actor?.isOwner && actor.type === "agent";
const ownRecovery = actor => own(actor) || (actor?.isOwner && actor.type === "npc" && game.user.isGM);
function requireGC(actor, recovery = false) {
  if (!(recovery ? ownRecovery(actor) : own(actor)) || !game.user.isGM)
    throw Error(loc`An owning GC must review Drained character choices.`);
}
const proof = actor => ({
  record: structuredClone(recordOf(actor)),
  signature:
    actor.type === "npc" ? npcDrainedBuildSignature(actor) : drainedBuildSignature(actor.system, itemsOf(actor))
});
function unchanged(actor, expected) {
  if (!sameValues(proof(actor), expected))
    throw Error(loc`The owned build or Drained history changed. Reopen the review.`);
}
function narrowSnapshot(actor) {
  const value = snapshot(actor);
  value.data = Object.fromEntries(Object.entries(value.data).filter(([k]) => k.startsWith("flags.spycraft2.drained")));
  value.data.flags = {};
  value.data["flags.spycraft2"] = {};
  value.effects = new Map();
  value.combatants = [];
  return value;
}
async function write(actor, record, title, { undo = true } = {}) {
  const before = narrowSnapshot(actor);
  try {
    await actor.update({ "flags.spycraft2.==drained": record });
  } catch (error) {
    if (!sameValues(recordOf(actor), record)) throw error;
  }
  if (!sameValues(recordOf(actor), record)) throw Error(loc`Review the actual Drained receipt before retrying.`);
  if (undo) {
    const entry = undoEntry(actor, before, narrowSnapshot(actor));
    if (entry) await postUndo(title, [entry]);
  }
  return record;
}
async function retainedForm(actor, effectiveLevel, { source = "", levels = 1, review = false } = {}) {
  const record = recordOf(actor),
    rows = drainedChoiceRows(actor.system, itemsOf(actor), effectiveLevel),
    selection =
      record?.signature === drainedBuildSignature(actor.system, itemsOf(actor))
        ? record.builds?.[`l${effectiveLevel}`]
        : null,
    fields = [];
  if (!review)
    fields.push(
      { text: "source", label: loc`Drained source`, value: source },
      { note: loc`Apply ${levels} level(s), stopping at Career Level 1.` }
    );
  fields.push({
    note: loc`Retain only choices actually acquired by Career Level ${effectiveLevel}. Resolve unknown history with the GC; do not select later benefits. The complete owned build stays saved.`
  });
  rows.forEach((row, index) => {
    if (row.later) fields.push({ note: loc`${row.label}: suspended with a later level.` });
    else
      fields.push({ check: `keep${index}`, label: row.label, checked: selection?.retained.includes(row.id) ?? false });
  });
  for (const [key, label] of [
    ["lifestyle", loc`Retained Lifestyle allocation`],
    ["possessions", loc`Retained Possessions allocation`],
    ["spendingCash", loc`Retained Spending Cash allocation`]
  ])
    fields.push({
      number: key,
      label,
      min: 0,
      max: actor.system.wealthAllocation?.[key] ?? 0,
      step: 1,
      value: selection?.wealth[key] ?? 0,
      required: true
    });
  fields.push(
    { text: "note", label: loc`Acquisition history and other effect review`, maxlength: 1000 },
    {
      check: "confirmed",
      label: loc`The GC verified these retained options and separately resolved item effects, existing timed benefits and other character options affected by the lost levels`
    }
  );
  const input = await formDialog({
    title: review ? loc`GC: review Drained build` : loc`GC: apply Drained`,
    ok: review ? loc`Save retained build` : loc`Apply Drained`,
    intro: loc`Drained temporarily forfeits the newest career levels and their benefits (pp.340–341). This changes prepared totals, not the original advancement record. Equipment and current money are not removed.`,
    fields
  });
  return (
    input && {
      ...input,
      levels,
      retained: rows.flatMap((row, index) => (input[`keep${index}`] === true ? [row.id] : [])),
      wealth: Object.fromEntries(["lifestyle", "possessions", "spendingCash"].map(k => [k, Number(input[k])]))
    }
  );
}
export async function applyDrained(actor, options = {}) {
  requireGC(actor);
  const expected = proof(actor),
    state = drainedState(actor.system, itemsOf(actor), expected.record),
    levels = options.levels ?? 1,
    effectiveLevel = Math.max(1, state.effectiveLevel - levels);
  if (expected.record?.applications?.[options.id]) return expected.record;
  const input = options.confirmed === true ? options : await retainedForm(actor, effectiveLevel, options);
  if (!input) return null;
  return queueResources([actor], async () => {
    requireGC(actor);
    unchanged(actor, expected);
    await options.validateSource?.();
    const record = drainedApplicationPlan(actor.system, itemsOf(actor), recordOf(actor), {
      ...input,
      id: options.id ?? foundry.utils.randomID(),
      reviewer: game.user.id,
      at: now()
    });
    return write(actor, record, loc`Drained: ${actor.name}`);
  });
}
export async function reviewDrainedBuild(actor, options = {}) {
  requireGC(actor);
  const expected = proof(actor),
    record = expected.record;
  if (!record?.levels) return null;
  let correction = {};
  const maximum = Math.max(0, actor.system.progression.length - 1);
  if (record.version !== 1 || !Number.isSafeInteger(record.levels) || record.levels > maximum || record.levels < 0) {
    correction =
      options.levelCountVerified === true
        ? options
        : await formDialog({
            title: loc`GC: correct Drained level count`,
            ok: loc`Review retained options`,
            intro: loc`This imported record cannot define a safe temporary build. Verify the actual number of lost levels; the complete owned career remains saved.`,
            fields: [
              {
                number: "correctedLevels",
                label: loc`Actual Drained levels`,
                min: 0,
                max: maximum,
                step: 1,
                value: 0,
                required: true
              },
              { check: "levelCountVerified", label: loc`The GC verified the actual number of lost levels` },
              { text: "note", label: loc`Original history and correction reason` }
            ]
          });
    if (!correction) return null;
    correction = { ...correction, correctedLevels: Number(correction.correctedLevels) };
  }
  const levels = correction.correctedLevels ?? record.levels;
  let input =
    options.confirmed === true
      ? options
      : levels
        ? await retainedForm(actor, actor.system.progression.length - levels, { review: true })
        : { confirmed: correction.levelCountVerified, note: correction.note };
  if (!input) return null;
  input = { ...input, ...correction };
  return queueResources([actor], async () => {
    requireGC(actor);
    unchanged(actor, expected);
    const next = reviewDrainedPlan(actor.system, itemsOf(actor), record, {
      ...input,
      reviewer: game.user.id,
      at: now()
    });
    return write(actor, next, loc`Drained build review: ${actor.name}`);
  });
}
function recoveryMessage(actor, recovery) {
  if (!recovery) return null;
  return (
    [...(game.messages ?? [])].reverse().find(m => {
      const f = m.flags?.spycraft2;
      return f?.actorUuid === actor.uuid && f.drainedRecovery?.attempt === recovery.attempt && !f.superseded;
    }) ?? null
  );
}
export async function rollDrainedRecovery(actor, options = {}) {
  if (!ownRecovery(actor)) return null;
  if (DRAINED_RECOVERY_MODE === "Passive") requireGC(actor, true);
  if (game.settings.get("spycraft2", "mission")?.active)
    throw Error(loc`End the active mission before rolling Drained recovery.`);
  const mission = missionOf(actor),
    expected = proof(actor),
    old = expected.record?.recoveries?.[mission];
  if (old) {
    const message = recoveryMessage(actor, old);
    if (message) return message;
    throw Error(
      loc`This mission's recovery dice may already exist. The GC must review the original attempt; do not roll again.`
    );
  }
  const input =
    options.confirmed === true
      ? options
      : await formDialog({
          title: loc`Mission-end Drained recovery`,
          ok: loc`Roll recovery`,
          intro: loc`At the end of each mission, one Resolve (Wis) check can restore the newest lost level. Its DC is 15 + 5 per currently Drained level. This does not clear stress damage.`,
          fields: [
            {
              check: "confirmed",
              label: loc`The GC confirms this mission has actually ended and this is its recovery attempt`
            }
          ]
        });
  if (!input?.confirmed) return null;
  let recovery;
  const reserved = await queueResources([actor], async () => {
    if (!ownRecovery(actor) || missionOf(actor) !== mission) throw Error(loc`Ownership or the mission changed.`);
    unchanged(actor, expected);
    const next = beginDrainedRecovery(actor.system, itemsOf(actor), recordOf(actor), {
      mission,
      attempt: foundry.utils.randomID(),
      confirmed: true,
      at: now()
    });
    recovery = next.recoveries[mission];
    await write(actor, next, "", { undo: false });
  });
  // Resource contention may refuse without executing the callback. No claim means no permission to roll.
  if (!recovery) return reserved === false ? false : null;
  const saveReceipt = async (message, state) =>
    queueResources([actor], async () => {
      const record = recordOf(actor),
        actual = record?.recoveries?.[mission];
      if (actual?.attempt !== recovery.attempt || actual.state === "completed") return;
      await write(
        actor,
        {
          ...record,
          recoveries: {
            ...record.recoveries,
            [mission]: {
              ...actual,
              state,
              ...(message ? { messageUuid: message.uuid } : {})
            }
          }
        },
        "",
        { undo: false }
      );
    });
  try {
    let contextCancelled = false;
    const context = {
      askContext: true,
      initialCheck: "drained-recovery",
      difficultyClass: recovery.dc,
      onDrainedRecoveryContextCancelled: () => {
        contextCancelled = true;
      },
      drainedRecovery: {
        mission,
        attempt: recovery.attempt,
        levels: recovery.levels,
        dc: recovery.dc,
        mode: recovery.mode
      }
    };
    const message =
      actor.type === "npc"
        ? await rollNpcSkill(actor, null, context)
        : await actor.rollSkill("resolve", "wis", context);
    const original = recoveryMessage(actor, recovery) ?? message;
    if (!original && contextCancelled) {
      await queueResources([actor], async () => {
        const record = recordOf(actor),
          actual = record?.recoveries?.[mission];
        if (actual?.attempt !== recovery.attempt || actual.state !== "rolling" || recoveryMessage(actor, recovery))
          return;
        const recoveries = { ...record.recoveries };
        delete recoveries[mission];
        await write(actor, { ...record, recoveries }, "", { undo: false });
      });
      return null;
    }
    if (original)
      await saveReceipt(
        original,
        original.flags?.spycraft2?.drainedRecovery?.attempt === recovery.attempt ? "posted" : "needsReview"
      );
    else await saveReceipt(null, "needsReview");
    return original;
  } catch (error) {
    const original = recoveryMessage(actor, recovery);
    await saveReceipt(
      original,
      original?.flags?.spycraft2?.drainedRecovery?.attempt === recovery.attempt ? "posted" : "needsReview"
    );
    throw error;
  }
}
export async function settleDrainedRecoveryCheck(actor, options = {}) {
  requireGC(actor, true);
  const mission = options.mission ?? missionOf(actor);
  const expected = proof(actor);
  let review = options;
  if (
    drainedRestorationReview(actor.system, itemsOf(actor), recordOf(actor)) &&
    !options.restorationConfirmed &&
    recoveryMessage(actor, expected.record?.recoveries?.[mission])?.flags?.spycraft2?.successConfirmed === true
  ) {
    review = await formDialog({
      title: loc`GC: restore the newest NPC loss`,
      ok: loc`Settle original recovery`,
      intro: loc`On success, restore only the newest loss's manual statistics and exceptional class or Origin options. Automatic grades, qualities and feats return from their saved originals.`,
      fields: [
        {
          check: "restorationConfirmed",
          label: loc`The GC verified the newest loss and restored any manual benefits if the original check succeeded`
        },
        { text: "restorationNote", label: loc`Restored statistics or options and original source`, maxlength: 1000 }
      ]
    });
    if (!review) return null;
  }
  return queueResources([actor], async () => {
    requireGC(actor, true);
    unchanged(actor, expected);
    const record = recordOf(actor),
      recovery = record?.recoveries?.[mission];
    if (!recovery) throw Error(loc`Roll the original mission-end recovery check first.`);
    const message = recoveryMessage(actor, recovery);
    if (!message) throw Error(loc`The GC must review this interrupted recovery attempt's actual result.`);
    const next = settleDrainedRecovery(actor.system, itemsOf(actor), record, mission, message, now(), {
      ...review,
      reviewer: game.user.id
    });
    if (next === record) return record;
    return write(actor, next, loc`Drained recovery: ${actor.name}`);
  });
}
export async function reviewDrainedRecovery(actor, options = {}) {
  requireGC(actor, true);
  const mission = options.mission ?? missionOf(actor),
    expected = proof(actor),
    recovery = expected.record?.recoveries?.[mission];
  if (!recovery || recovery.state === "completed") return null;
  const input = options.mode
    ? options
    : await formDialog({
        title: loc`GC: review original Drained recovery`,
        ok: loc`Record recovery review`,
        intro: loc`Keep the original recovery dice. Record their verified outcome, or release an attempt only after verifying that no dice or restored level exist. No replacement dice are rolled by this review.`,
        fields: [
          { note: loc`Mission ${mission}; original DC ${recovery.dc}.` },
          {
            select: "mode",
            label: loc`Verified original outcome`,
            options: [
              ["failure", loc`Original check failed`],
              ["success", loc`Original check succeeded`],
              ["unused", loc`No dice or effects; release unused attempt`]
            ]
          },
          { check: "actualOutcomeConfirmed", label: loc`The GC verified the original dice and actual outcome` },
          { check: "noDiceConfirmed", label: loc`No recovery dice were rolled for this attempt` },
          { check: "noEffectsConfirmed", label: loc`No level was restored by this attempt` },
          { text: "note", label: loc`Original dice, source and review reason`, maxlength: 1000 },
          ...(drainedRestorationReview(actor.system, itemsOf(actor), recordOf(actor))
            ? [
                {
                  check: "restorationConfirmed",
                  label: loc`On success, the GC restored the newest loss's manual statistics and exceptional options`
                },
                {
                  text: "restorationNote",
                  label: loc`Restored statistics or options and original source`,
                  maxlength: 1000
                }
              ]
            : [])
        ]
      });
  if (!input) return null;
  return queueResources([actor], async () => {
    requireGC(actor, true);
    unchanged(actor, expected);
    const original =
        recoveryMessage(actor, recovery) ??
        (recovery.messageUuid ? await globalThis.fromUuid?.(recovery.messageUuid) : null),
      check = original?.flags?.spycraft2;
    if (input.mode === "unused" && original)
      throw Error(loc`The original recovery roll exists. Keep its dice instead of releasing this attempt.`);
    if (
      check?.resolved === true &&
      typeof check.successConfirmed === "boolean" &&
      input.mode !== "unused" &&
      (input.mode === "success") !== check.successConfirmed
    )
      throw Error(loc`This review disagrees with the finished original recovery result. Correct that result first.`);
    const next = reviewDrainedRecoveryPlan(actor.system, itemsOf(actor), recordOf(actor), mission, {
      ...input,
      reviewer: game.user.id,
      at: now()
    });
    return write(actor, next, loc`Drained recovery review: ${actor.name}`);
  });
}
export function drainedView(actor) {
  if (actor.type !== "agent") return null;
  if (
    !recordOf(actor)?.levels &&
    !(actor.isOwner && game.user.isGM) &&
    !Object.keys(recordOf(actor)?.recoveries ?? {}).length
  )
    return null;
  const record = recordOf(actor),
    state = actor.system.drainedState;
  return {
    ...drainedRecoveryView(actor),
    levels: record?.levels ?? 0,
    effectiveLevel: state?.effectiveLevel,
    needsReview: state?.needsReview ?? false,
    canApply: actor.isOwner && game.user.isGM,
    canReview: !!record?.levels && actor.isOwner && game.user.isGM
  };
}
export function drainedRecoveryView(actor) {
  const record = recordOf(actor),
    state = actor.system.drainedState,
    recovery = record?.recoveries?.[missionOf(actor)];
  return {
    canRoll:
      !!record?.levels &&
      !state?.needsReview &&
      !recovery &&
      ownRecovery(actor) &&
      (DRAINED_RECOVERY_MODE !== "Passive" || game.user.isGM) &&
      !Object.values(record?.recoveries ?? {}).some(r => r?.state !== "completed"),
    canSettle: !!recovery && recovery.state !== "completed" && actor.isOwner && game.user.isGM,
    recoveryState: recovery?.state ?? "",
    recoveryDC: recovery?.dc,
    pending:
      actor.isOwner && game.user.isGM
        ? Object.entries(record?.recoveries ?? {})
            .filter(([, r]) => r && r.state !== "completed")
            .map(([mission, r]) => ({ mission, dc: r.dc, state: r.state }))
        : []
  };
}
