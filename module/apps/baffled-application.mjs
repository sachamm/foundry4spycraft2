import { baffledSourceSnapshot, baffledApplicationPlan, getBaffledReview } from "../rules/baffled.mjs";
import { setConditionStatus } from "../rules/condition-status.mjs";
import { queueResources } from "../rules/transactions.mjs";
import { loc } from "../i18n.mjs";
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b),
  clone = structuredClone;
const effectById = (actor, id) => [...(actor.effects ?? [])].find(e => e.id === id);
const statusList = e => [...e.statuses].sort();
function hold(actor, review) {
  game.spycraft2 ??= {};
  game.spycraft2.pendingBaffledReviews ??= {};
  game.spycraft2.pendingBaffledReviews[actor.uuid] = review;
  actor.system.baffledApplicationReview = review;
}
async function restoreSources(actor, before) {
  const errors = [];
  for (const data of before) {
    const current = effectById(actor, data._id),
      original = [...data.statuses].sort(),
      after = original.filter(s => s !== "baffled");
    if (current) {
      if (same(statusList(current), original)) continue;
      if (!same(statusList(current), after)) {
        errors.push(new Error(loc`An original source changed again.`));
        continue;
      }
      try {
        await actor.updateEmbeddedDocuments("ActiveEffect", [{ _id: data._id, statuses: data.statuses }]);
      } catch (e) {
        if (!same(statusList(effectById(actor, data._id) ?? { statuses: [] }), original)) errors.push(e);
      }
    } else {
      try {
        await actor.createEmbeddedDocuments("ActiveEffect", [data], { keepId: true });
      } catch (e) {
        const restored = effectById(actor, data._id);
        if (!restored || !same(restored.toObject(), data)) errors.push(e);
      }
    }
  }
  return errors;
}
export async function applyBaffled(actor, options = {}) {
  if (!["agent", "npc"].includes(actor.type) || !actor.isOwner) return null;
  const expected = baffledSourceSnapshot(actor);
  let input = options;
  if (!Object.keys(input).length) {
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Apply new Baffled effect` },
      rejectClose: false,
      content: `<p>${loc`A second application replaces Baffled with Incompetent (p.340). Use the state controls to correct or end an existing condition.`}</p><label>${loc`Event reference`} <input name="id" type="text" /></label><label>${loc`Source`} <input name="source" type="text" /></label><label><input name="confirmed" type="checkbox" /> ${loc`The GC confirms this new Baffled effect applies after any resistance save`}</label>`
    });
    if (!input) return null;
  }
  if (input.confirmed !== true) return null;
  return queueResources([actor], async () => {
    if (!actor.isOwner) throw new Error(loc`Ownership changed.`);
    if (getBaffledReview(actor).needsReview)
      throw new Error(loc`The GC must review the interrupted Baffled event first.`);
    const plan = baffledApplicationPlan(
      baffledSourceSnapshot(actor),
      expected,
      input,
      actor.flags?.spycraft2?.baffledApplications,
      game.time.worldTime
    );
    if (plan.duplicate) return plan.record;
    const { record } = plan,
      operation = "baffled-" + record.id,
      before = [...(actor.effects ?? [])]
        .filter(e => (e.active ?? (!e.disabled && !e.isSuppressed)) && e.statuses.has("baffled"))
        .map(e => clone(e.toObject()));
    let created = null;
    try {
      if (record.before.baffled) await setConditionStatus(actor, "baffled", false, { label: loc`Baffled` });
      const target = record.before.baffled ? "incompetent" : "baffled";
      const result = await setConditionStatus(actor, target, true, {
        label: target === "baffled" ? loc`Baffled` : loc`Incompetent`,
        operationId: operation
      });
      if (result.effectId) created = clone(effectById(actor, result.effectId).toObject());
      if (
        !same({ baffled: actor.statuses.has("baffled"), incompetent: actor.statuses.has("incompetent") }, record.after)
      )
        throw new Error(loc`Condition sources changed during the event.`);
      await actor.update({ ["flags.spycraft2.baffledApplications." + record.id]: record });
      return record;
    } catch (error) {
      if (same(actor.flags?.spycraft2?.baffledApplications?.[record.id], record)) return record;
      const failures = [];
      // Only remove the exact new effect; preserve independent edits or replacement sources.
      const tagged = [...(actor.effects ?? [])].filter(e => e.flags?.spycraft2?.conditionOperation === operation);
      for (const effect of tagged) {
        if (!created || !same(effect.toObject(), created)) {
          failures.push(new Error(loc`The new condition source needs review.`));
          continue;
        }
        try {
          await actor.deleteEmbeddedDocuments("ActiveEffect", [effect.id]);
        } catch (e) {
          if (effectById(actor, effect.id)) failures.push(e);
        }
      }
      failures.push(...(await restoreSources(actor, before)));
      const now = baffledSourceSnapshot(actor);
      if (failures.length || !same(now, expected)) {
        const review = {
          id: record.id,
          source: record.source,
          record,
          needsReview: true,
          reason: loc`The interrupted event could not be fully restored. Review current effects before resolving it.`
        };
        hold(actor, review);
        try {
          await actor.update({ "flags.spycraft2.baffledApplicationReview": review });
        } catch {}
        throw new AggregateError(
          [error, ...failures],
          loc`Baffled event needs GC review before further skill checks or applications.`
        );
      }
      throw error;
    }
  });
}
export async function reviewBaffledApplication(actor, options = {}) {
  if (!game.user.isGM || !actor.isOwner) throw new Error(loc`Only the GC can resolve an interrupted Baffled event.`);
  const review = clone(getBaffledReview(actor)),
    expected = baffledSourceSnapshot(actor);
  if (!review.needsReview) return null;
  let input = options;
  if (!Object.keys(input).length) {
    const esc = foundry.utils.escapeHTML;
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Review interrupted Baffled effect` },
      rejectClose: false,
      content: `<p>${loc`${esc(review.source)}. Current Baffled: ${expected.baffled ? "yes" : "no"}; Incompetent: ${expected.incompetent ? "yes" : "no"}. Correct the current effects using the state controls first, if needed.`}</p><label>${loc`Resolution`} <select name="disposition"><option value="keep">${loc`Keep the event as resolved`}</option><option value="cancel">${loc`Cancel the event`}</option></select></label><label>${loc`GC explanation`} <input name="resolution" type="text" /></label><label><input name="confirmed" type="checkbox" /> ${loc`I reviewed the actual sources and confirm the current condition states`}</label>`
    });
    if (!input) return null;
  }
  if (
    input.confirmed !== true ||
    !["keep", "cancel"].includes(input.disposition) ||
    typeof input.resolution !== "string" ||
    !input.resolution.trim()
  )
    throw new Error(loc`Confirm the reviewed sources and explain the resolution.`);
  return queueResources([actor], async () => {
    if (
      !game.user.isGM ||
      !actor.isOwner ||
      !same(getBaffledReview(actor), review) ||
      !same(baffledSourceSnapshot(actor), expected)
    )
      throw new Error(loc`The review or its sources changed. Open the review again.`);
    const record = {
        ...review.record,
        state: input.disposition === "cancel" ? "cancelled" : "reviewed",
        after: { baffled: expected.baffled, incompetent: expected.incompetent },
        resolution: input.resolution.trim(),
        reviewer: game.user.id
      },
      completed = { ...review, needsReview: false, record };
    try {
      await actor.update({
        ["flags.spycraft2.baffledApplications." + review.id]: record,
        "flags.spycraft2.baffledApplicationReview": completed
      });
    } catch (error) {
      if (
        !same(actor.flags?.spycraft2?.baffledApplications?.[review.id], record) ||
        !same(actor.flags?.spycraft2?.baffledApplicationReview, completed)
      )
        throw error;
    }
    delete game.spycraft2?.pendingBaffledReviews?.[actor.uuid];
    actor.system.baffledApplicationReview = completed;
    return record;
  });
}
