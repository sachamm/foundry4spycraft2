import { queueResources } from "../services/transactions.mjs";
import {
  restraintSourceSnapshot,
  restraintReleasePlan,
  getRestraintReleaseReview,
  getPendingRestraintMoves
} from "../rules/restraints.mjs";
import { rollEvidence, rollEvidenceMatches } from "../rules/outcomes.mjs";
import { loc } from "../i18n.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { same } from "../rules/equal.mjs";
const clone = structuredClone;
const effectById = (actor, id) => [...(actor.effects ?? [])].find(e => e.id === id),
  statuses = e => [...(e?.statuses ?? [])].sort();
const receiptFor = (actor, message) => actor.flags?.spycraft2?.restraintReleases?.[message.id];
const finalKey = id => "flags.spycraft2.restraintReleases." + id;
async function annotate(message, receipt) {
  try {
    await message.update({
      "flags.spycraft2.restraintRelease": {
        id: receipt.id,
        benefit: receipt.benefit,
        state: receipt.state,
        movement: receipt.movement
      }
    });
  } catch {
    ui.notifications.warn(
      loc`The grapple benefit is recorded on the character; its chat annotation needs refresh. Do not apply it again.`
    );
  }
}
async function cleanEmpty(actor, rows) {
  for (const row of rows) {
    const effect = effectById(actor, row.id);
    if (!effect || statuses(effect).length || (effect.changes ?? []).length || !same(effect.toObject(), row.afterData))
      continue;
    try {
      await actor.deleteEmbeddedDocuments("ActiveEffect", [effect.id]);
    } catch {
      if (effectById(actor, effect.id))
        ui.notifications.warn(loc`The grapple benefit is complete; an empty condition effect remains for GC cleanup.`);
    }
  }
}
async function restore(actor, rows) {
  const failures = [];
  for (const row of rows) {
    const effect = effectById(actor, row.id),
      now = statuses(effect);
    if (!effect) {
      failures.push(new Error(loc`A restraint source was removed meanwhile.`));
      continue;
    }
    if (same(now, row.before)) continue;
    if (!same(now, row.after)) {
      failures.push(new Error(loc`A restraint source changed again.`));
      continue;
    }
    try {
      await actor.updateEmbeddedDocuments("ActiveEffect", [{ _id: row.id, statuses: row.before }]);
    } catch (error) {
      if (!same(statuses(effectById(actor, row.id)), row.before)) failures.push(error);
    }
  }
  return failures;
}
async function hold(actor, review) {
  game.spycraft2 ??= {};
  game.spycraft2.pendingRestraintReviews ??= {};
  game.spycraft2.pendingRestraintReviews[actor.uuid] = review;
  actor.system.restraintReleaseReview = review;
  try {
    await actor.update({ "flags.spycraft2.restraintReleaseReview": review });
  } catch {}
}
function priorReceipt(actor, message) {
  const receipt = receiptFor(actor, message);
  if (!receipt) return null;
  if (
    receipt.messageUuid !== (message.uuid ?? message.id) ||
    receipt.actorUuid !== actor.uuid ||
    !rollEvidenceMatches(receipt.evidence, message.flags.spycraft2)
  )
    throw new Error(loc`The recorded grapple benefit or its roll changed. Ask the GC to review it.`);
  return receipt;
}
export async function applyRestraintEscape(actor, message, options = {}) {
  if (!actor.isOwner || message.flags?.spycraft2?.actorUuid !== actor.uuid) return null;
  if (message.blind && !game.user.isGM) throw new Error(loc`The GC resolves secret grapple results.`);
  const previous = priorReceipt(actor, message);
  if (previous) return previous;
  const expected = rollEvidence(message.flags.spycraft2),
    check = message.flags.spycraft2;
  let input = options;
  if (check.resolved !== true || check.successConfirmed !== true || check.superseded || check.criticalFailure)
    throw new Error(loc`Confirm the successful opposed result and finish the check first.`);
  if (!Object.keys(input).length) {
    input = await systemDialog.input({
      window: { title: loc`Apply grapple escape benefit` },
      rejectClose: false,
      content: `<p>${loc`The successful opposed check grants one benefit, or two with a critical success/opponent critical failure. Breaking a pin leaves the character Held. Escaping a hold requires an immediate Standard Move of at least 5 ft., up to Speed (p.357).`}</p><label>${loc`Benefit`} <select name="benefit">${check.restraintEscape?.condition === "pinned" ? `<option value="breakPin">${loc`Break Pin: remain Held`}</option><option value="breakPinAndEscapeHold">${loc`Break Pin and Escape Hold: requires two benefits`}</option>` : `<option value="escapeHold">${loc`Escape Hold`}</option>`}</select></label><label><input name="opponentCriticalFailureConfirmed" type="checkbox" /> ${loc`The GC confirms the opponent suffered a critical failure in this opposed check`}</label><label><input name="confirmed" type="checkbox" /> ${loc`The GC confirms the final opposed result and selected benefit`}</label>`
    });
    if (!input) return null;
  }
  return queueResources(
    [actor],
    async () => {
      if (!actor.isOwner || (message.blind && !game.user.isGM)) throw new Error(loc`The grapple authority changed.`);
      const previous = priorReceipt(actor, message);
      if (previous) return previous;
      if (getRestraintReleaseReview(actor).needsReview)
        throw new Error(loc`The GC must review the interrupted grapple release first.`);
      if (getPendingRestraintMoves(actor).length)
        throw new Error(loc`Complete the required movement from the previous Escape Hold first.`);
      if (rollEvidence(message.flags.spycraft2) !== expected)
        throw new Error(loc`The opposed result changed while choosing its benefit.`);
      const plan = restraintReleasePlan(actor, message, input),
        rows = plan.updates.map(row => ({
          ...row,
          beforeData: clone(effectById(actor, row.id).toObject()),
          afterData: null
        }));
      let record;
      try {
        try {
          await actor.updateEmbeddedDocuments(
            "ActiveEffect",
            rows.map(row => ({ _id: row.id, statuses: row.after }))
          );
        } catch (error) {
          if (!rows.every(row => same(statuses(effectById(actor, row.id)), row.after))) throw error;
        }
        if (!same({ held: actor.statuses.has("held"), pinned: actor.statuses.has("pinned") }, plan.after))
          throw new Error(loc`The current restraint sources changed during release.`);
        if (plan.requiredMove && Number.isFinite(actor.system.speed) && actor.system.speed < 5)
          throw new Error(
            loc`Escape Hold requires a legal Standard Move of at least 5 ft.; resolve the current immobility first.`
          );
        for (const row of rows) row.afterData = clone(effectById(actor, row.id).toObject());
        record = {
          id: message.id,
          actorUuid: actor.uuid,
          messageUuid: message.uuid ?? message.id,
          evidence: expected,
          benefit: plan.benefit,
          benefitsUsed: plan.benefitsUsed,
          source: plan.source,
          after: plan.after,
          state: "applied",
          at: game.time.worldTime,
          movement: plan.requiredMove
            ? {
                state: "required",
                minimum: 5,
                maximum: Number.isFinite(actor.system.speed) ? actor.system.speed : null
              }
            : null
        };
        await actor.update({ [finalKey(message.id)]: record });
      } catch (error) {
        if (record && same(receiptFor(actor, message), record)) {
          await cleanEmpty(actor, rows);
          await annotate(message, record);
          return record;
        }
        const failures = await restore(actor, rows);
        if (failures.length || !same(restraintSourceSnapshot(actor), plan.source)) {
          await hold(actor, {
            id: message.id,
            messageUuid: message.uuid ?? message.id,
            evidence: expected,
            plan: clone(plan),
            needsReview: true,
            reason: loc`The interrupted grapple release could not be fully restored. Review its actual condition sources and any required movement.`
          });
          throw new AggregateError(
            [error, ...failures],
            loc`The grapple release needs GC review before further actions.`
          );
        }
        throw error;
      }
      await cleanEmpty(actor, rows);
      await annotate(message, record);
      return record;
    },
    { messages: [message] }
  );
}
export async function reviewRestraintRelease(actor, message, options = {}) {
  if (!game.user.isGM || !actor.isOwner) throw new Error(loc`Only the GC can review the interrupted grapple release.`);
  const review = clone(getRestraintReleaseReview(actor));
  if (!review.needsReview) return null;
  if (message.id !== review.id || message.flags?.spycraft2?.actorUuid !== actor.uuid)
    throw new Error(loc`Choose the original grapple message.`);
  const expected = restraintSourceSnapshot(actor);
  let input = options;
  if (!Object.keys(input).length) {
    input = await systemDialog.input({
      window: { title: loc`Review grapple release` },
      rejectClose: false,
      content: `<p>${loc`Current Held: ${expected.held ? "yes" : "no"}; Pinned: ${expected.pinned ? "yes" : "no"}. Correct actual condition sources with Main's state controls first. Then record whether this benefit stands; this review does not change effects or move a token.`}</p><label>${loc`Disposition`} <select name="disposition"><option value="keep">${loc`Keep the reviewed benefit`}</option><option value="cancel">${loc`Cancel the benefit`}</option></select></label><label>${loc`GC explanation`} <input name="resolution" /></label><label><input name="movementResolvedConfirmed" type="checkbox" /> ${loc`I separately resolved any required Escape Hold movement`}</label><label><input name="confirmed" type="checkbox" /> ${loc`I confirm the actual sources and disposition`}</label>`
    });
    if (!input) return null;
  }
  if (
    input.confirmed !== true ||
    !["keep", "cancel"].includes(input.disposition) ||
    typeof input.resolution !== "string" ||
    !input.resolution.trim() ||
    (input.disposition === "keep" && review.plan.requiredMove && input.movementResolvedConfirmed !== true)
  )
    throw new Error(loc`Confirm the reviewed sources, movement and GC explanation.`);
  return queueResources(
    [actor],
    async () => {
      if (
        !game.user.isGM ||
        !actor.isOwner ||
        !same(getRestraintReleaseReview(actor), review) ||
        !same(restraintSourceSnapshot(actor), expected) ||
        !rollEvidenceMatches(review.evidence, message.flags.spycraft2)
      )
        throw new Error(loc`The grapple review or its sources changed. Open it again.`);
      const record = {
          id: message.id,
          actorUuid: actor.uuid,
          messageUuid: message.uuid ?? message.id,
          evidence: review.evidence,
          benefit: review.plan.benefit,
          benefitsUsed: review.plan.benefitsUsed,
          source: review.plan.source,
          after: { held: expected.held, pinned: expected.pinned },
          state: input.disposition === "keep" ? "reviewed" : "cancelled",
          resolution: input.resolution.trim(),
          reviewer: game.user.id,
          at: game.time.worldTime,
          movement: input.disposition === "keep" && review.plan.requiredMove ? { state: "gcResolved" } : null
        },
        completed = { ...review, needsReview: false, resolution: record.resolution };
      try {
        await actor.update({ [finalKey(message.id)]: record, "flags.spycraft2.restraintReleaseReview": completed });
      } catch (error) {
        if (
          !same(receiptFor(actor, message), record) ||
          !same(actor.flags?.spycraft2?.restraintReleaseReview, completed)
        )
          throw error;
      }
      delete game.spycraft2?.pendingRestraintReviews?.[actor.uuid];
      actor.system.restraintReleaseReview = completed;
      await annotate(message, record);
      return record;
    },
    { messages: [message] }
  );
}
export async function confirmRestraintEscapeMove(actor, message, options = {}) {
  if (!actor.isOwner || message.flags?.spycraft2?.actorUuid !== actor.uuid || (message.blind && !game.user.isGM))
    throw new Error(loc`Choose an owned grapple movement record; the GC handles secret results.`);
  const record = clone(priorReceipt(actor, message));
  if (record?.movement?.state !== "required") return record;
  let input = options;
  if (!Object.keys(input).length) {
    input = await systemDialog.input({
      window: { title: loc`Confirm Escape Hold movement` },
      rejectClose: false,
      content: `<p>${loc`Escape Hold requires an immediate Standard Move of 5 ft. or more, up to Speed. Confirm the actual move after resolving its path and hazards with the GC. This control does not move a token.`}</p><label>${loc`Actual distance (ft.)`} <input name="distance" type="number" min="5" value="5" /></label>${record.movement.maximum === null ? `<label>${loc`GC-reviewed maximum distance (ft.)`} <input name="approvedMaximum" type="number" min="5" /></label><label>${loc`Capacity review explanation`} <input name="resolution" /></label>` : `<p>${loc`Recorded maximum ${record.movement.maximum} ft.`}</p>`}<label><input name="confirmed" type="checkbox" /> ${loc`The GC confirms the immediate Standard Move actually occurred within the allowed distance`}</label>`
    });
    if (!input) return null;
    const number = value =>
      typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    input = { ...input, distance: number(input.distance), approvedMaximum: number(input.approvedMaximum) };
  }
  const maximum = record.movement.maximum === null ? input.approvedMaximum : record.movement.maximum;
  if (
    input.confirmed !== true ||
    !Number.isFinite(input.distance) ||
    input.distance < 5 ||
    !Number.isFinite(maximum) ||
    maximum < 5 ||
    input.distance > maximum ||
    (record.movement.maximum === null &&
      (!game.user.isGM || typeof input.resolution !== "string" || !input.resolution.trim()))
  )
    throw new Error(
      loc`Confirm the actual 5-ft.-or-longer move within the allowed Speed; unresolved capacity requires a GC explanation.`
    );
  return queueResources(
    [actor],
    async () => {
      const current = priorReceipt(actor, message);
      if (current?.movement?.state !== "required") return current;
      if (
        !actor.isOwner ||
        (message.blind && !game.user.isGM) ||
        !same(current, record) ||
        getRestraintReleaseReview(actor).needsReview ||
        (record.movement.maximum === null && !game.user.isGM)
      )
        throw new Error(loc`The grapple movement record or authority changed.`);
      const next = {
        ...record,
        movement: {
          ...record.movement,
          state: "completed",
          distance: input.distance,
          maximum,
          at: game.time.worldTime,
          ...(record.movement.maximum === null
            ? { capacityReview: input.resolution.trim(), reviewer: game.user.id }
            : {})
        }
      };
      try {
        await actor.update({ [finalKey(message.id)]: next });
      } catch (error) {
        if (!same(receiptFor(actor, message), next)) throw error;
      }
      await annotate(message, next);
      return next;
    },
    { messages: [message] }
  );
}
