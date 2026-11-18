import { silverVictoryPlan, silverVictoryRecordValid } from "../rules/silver-tongue.mjs";
import {
  attributeDamageState,
  attributeDamageCorrectionPlan,
  attributeMissionRecoveryPlan
} from "../rules/attribute-damage.mjs";
import { queueResources } from "../rules/transactions.mjs";
const actors = () =>
  Array.isArray(game.actors?.contents)
    ? game.actors.contents
    : typeof game.actors?.values === "function"
      ? [...game.actors.values()]
      : Array.isArray(game.actors)
        ? game.actors
        : [];
const state = a => ({ ...a.system, usagePeriods: a.usagePeriods ?? a.system.usagePeriods });
const stable = v =>
    JSON.stringify(v, (_k, x) =>
      x && typeof x === "object" && !Array.isArray(x)
        ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
        : x
    ),
  same = (a, b) => stable(a) === stable(b),
  now = () => game.time?.worldTime ?? 0;
function requireGC(...participants) {
  if (!game.user?.isGM || participants.some(a => !a || a.type !== "agent" || !a.isOwner))
    throw new Error("Only the owning GC can settle these agent attribute effects.");
}
function history(actor) {
  const records = actor.flags?.spycraft2?.silverTongueVictories ?? {};
  if (
    !records ||
    typeof records !== "object" ||
    Array.isArray(records) ||
    Object.entries(records).some(([key, r]) => !silverVictoryRecordValid(r, key) || r.sourceActorUuid !== actor.uuid)
  )
    throw new Error("Review the saved Silver Tongue victory history.");
  return records;
}
function getRecord(actor, id) {
  const r = history(actor)[id];
  if (!r) throw new Error("Choose a saved Silver Tongue victory.");
  return structuredClone(r);
}
function targetActor(uuid) {
  const target = actors().find(a => a.uuid === uuid);
  if (!target || target.type !== "agent")
    throw new Error("Choose an actual available agent target. Generic NPC profile damage remains separate.");
  return target;
}
async function saveRecord(actor, record) {
  requireGC(actor);
  const path = "flags.spycraft2.silverTongueVictories." + record.id;
  try {
    await actor.update({ [path]: record });
  } catch (error) {
    if (!same(history(actor)[record.id], record)) throw error;
  }
  if (!same(history(actor)[record.id], record)) throw new Error("The victory history was not saved as prepared.");
}
async function saveDamage(actor, record) {
  requireGC(actor);
  try {
    await actor.update({ "system.attributeDamage": record });
  } catch (error) {
    if (!same(attributeDamageState(actor.system).record, record)) throw error;
  }
  if (!same(attributeDamageState(actor.system).record, record))
    throw new Error("The target damage history changed during saving.");
}
function currentDamage(actor) {
  const d = attributeDamageState(actor.system);
  if (d.needsReview) throw new Error(d.reason);
  return d;
}
async function finishCancellation(source, target, record) {
  requireGC(source, target);
  if (!same(history(source)[record.id], record)) throw new Error("The correction changed before saving.");
  const damage = currentDamage(target),
    existing = damage.record.events.find(e => e.id === record.event.id);
  if (existing && !same(existing, record.event))
    throw new Error("The target’s recorded source differs from the accepted victory; review its actual history.");
  if (existing) {
    const correction = attributeDamageCorrectionPlan(state(target), {
      id: "Silver Tongue correction:" + record.event.id,
      eventId: record.event.id,
      reason: record.correctionReason,
      confirmed: true,
      worldTime: now()
    });
    await saveDamage(target, correction.record);
  }
  if (!same(history(source)[record.id], record)) throw new Error("The correction changed during saving.");
  const cancelled = { ...record, status: "cancelled", completedAt: now() };
  await saveRecord(source, cancelled);
  return cancelled;
}
async function finishPending(source, target, record) {
  requireGC(source, target);
  if (record.status === "cancelling") return finishCancellation(source, target, record);
  if (record.status !== "pending") return record;
  const damage = currentDamage(target),
    existing = damage.record.events.find(e => e.id === record.event.id);
  if (existing) {
    if (!same(existing, record.event))
      throw new Error("The target’s recorded source differs from the accepted victory; review its actual history.");
  } else {
    if (
      (state(target).usagePeriods?.mission ?? "initial") !== record.missionId ||
      !same(damage.record, JSON.parse(record.beforeRecord)) ||
      target.system.abilities?.wis?.value !== record.event.before
    )
      throw new Error(
        "The target’s Wisdom, mission or damage history changed before application. Review the pending victory; no damage was guessed."
      );
    const after = structuredClone(damage.record);
    after.events.push(structuredClone(record.event));
    if (attributeDamageState({ attributeDamage: after }).needsReview)
      throw new Error("The prepared target damage requires review.");
    await saveDamage(target, after);
    if (target.system.abilities?.wis?.value !== record.event.before - record.event.amount)
      throw new Error(
        "The target’s derived Wisdom changed during saving. Review the actual saved event before completing this victory."
      );
  }
  requireGC(source, target);
  if (!same(history(source)[record.id], record)) throw new Error("The pending victory changed during application.");
  const settled = { ...record, status: "settled", completedAt: now(), settledBy: game.user.id };
  await saveRecord(source, settled);
  return settled;
}
async function attempt(source, target, record) {
  try {
    return await finishPending(source, target, record);
  } catch (error) {
    ui.notifications.warn(`Silver Tongue settlement remains pending: ${error.message}`);
    return { ...record, needsReview: true, reason: error.message };
  }
}
export async function settleSilverTongueVictory(source, options = {}) {
  requireGC(source);
  let input = options;
  if (!Object.keys(input).length) {
    const esc = foundry.utils.escapeHTML,
      targets = actors().filter(a => a.type === "agent" && a.isOwner && a.uuid !== source.uuid);
    input = await foundry.applications.api.DialogV2.input({
      window: { title: "Silver Tongue — settle seduction victory" },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>After an actual won seduction Conflict, inflict one temporary Wisdom damage on its opponent, never reducing Wisdom below6(p.205). Reuse the same Conflict ID on retries. This does not resolve the Conflict itself.</p><label>Actual opponent <select name="targetActorUuid"><option value="">Choose the opponent</option>${targets.map(a => `<option value="${esc(a.uuid)}">${esc(a.name)}</option>`).join("")}</select></label><label>Stable seduction Conflict ID <input name="conflictId" maxlength="200" required /></label><label><input name="victoryConfirmed" type="checkbox" /> The GC confirms this character won that actual seduction Conflict against this opponent</label><label><input name="sourceAtVictoryConfirmed" type="checkbox" /> Silver Tongue was active at that victory</label></div>`
    });
    if (!input) return null;
  }
  const target = targetActor(input.targetActorUuid);
  requireGC(source, target);
  return queueResources([source, target], async () => {
    requireGC(source, target);
    const p = silverVictoryPlan(state(source), state(target), {
      sourceActorUuid: source.uuid,
      targetActorUuid: target.uuid,
      targetName: target.name,
      conflictId: input.conflictId,
      victoryConfirmed: input.victoryConfirmed,
      sourceAtVictoryConfirmed: input.sourceAtVictoryConfirmed,
      confirmedBy: game.user.id,
      worldTime: now(),
      records: history(source)
    });
    if (!p.alreadyRecorded) await saveRecord(source, p.record);
    if (["settled", "cancelled"].includes(p.record.status)) return p.record;
    return attempt(source, target, p.record);
  });
}
export async function resumeSilverTongueVictory(source, id) {
  requireGC(source);
  const original = getRecord(source, id);
  if (["settled", "cancelled"].includes(original.status)) return original;
  const target = targetActor(original.targetActorUuid);
  requireGC(source, target);
  return queueResources([source, target], async () => {
    requireGC(source, target);
    const record = getRecord(source, id);
    return attempt(source, target, record);
  });
}
export async function correctSilverTongueVictory(source, id, options = {}) {
  requireGC(source);
  const original = getRecord(source, id);
  if (original.status === "cancelled") return original;
  const target = targetActor(original.targetActorUuid);
  requireGC(source, target);
  let input = options;
  if (original.status === "cancelling") return resumeSilverTongueVictory(source, id);
  if (!Object.keys(input).length) {
    input = await foundry.applications.api.DialogV2.input({
      window: { title: "GC: correct Silver Tongue victory" },
      rejectClose: false,
      content:
        '<div class="spycraft2-roll-options"><p>Cancel this erroneous victory and remove only its remaining Wisdom damage. All original damage and recovery history remains recorded; unrelated sources stay intact.</p><label>Reason <input name="reason" maxlength="200" required /></label><label><input name="confirmed" type="checkbox" /> I confirm this victory or target was erroneous</label></div>'
    });
    if (!input) return null;
  }
  if (
    input.confirmed !== true ||
    typeof input.reason !== "string" ||
    !input.reason.trim() ||
    input.reason.trim().length > 200
  )
    throw new Error("Confirm and explain the erroneous victory.");
  return queueResources([source, target], async () => {
    requireGC(source, target);
    if (!same(getRecord(source, id), original)) throw new Error("The victory changed during correction.");
    const cancelling = {
      ...original,
      status: "cancelling",
      correctionReason: input.reason.trim(),
      reviewedBy: game.user.id,
      reviewedAt: now()
    };
    await saveRecord(source, cancelling);
    return attempt(source, target, cancelling);
  });
}
export async function recoverSilverTongueAtMissionEnd(actor, options = {}) {
  requireGC(actor);
  let input = options;
  const missionId = state(actor).usagePeriods?.mission ?? "initial";
  if (!Object.keys(input).length) {
    input = await foundry.applications.api.DialogV2.input({
      window: { title: "GC: mission-end attribute recovery" },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>End-of-mission recovery heals temporary Silver Tongue Wisdom damage (p.17). Permanent damage stays. Resolve pending victories first; this records recovery for the current mission and is separate from starting the next mission.</p><label><input name="confirmed" type="checkbox" /> The GC confirms the current mission has ended and outstanding seduction victories have been settled</label></div>`
    });
    if (!input) return null;
  }
  if (input.confirmed !== true) throw new Error("Confirm the actual end of the current mission.");
  const sources = actors().filter(
    a =>
      a.type === "agent" &&
      (a.system.activeFeatNames?.includes("Silver Tongue") ||
        Object.keys(a.flags?.spycraft2?.silverTongueVictories ?? {}).length)
  );
  requireGC(actor, ...sources);
  return queueResources([actor, ...sources], async () => {
    requireGC(actor, ...sources);
    if ((state(actor).usagePeriods?.mission ?? "initial") !== missionId)
      throw new Error("The mission changed during recovery.");
    for (const source of sources)
      if (
        Object.values(history(source)).some(
          r => r.targetActorUuid === actor.uuid && ["pending", "cancelling"].includes(r.status)
        )
      )
        throw new Error("Resolve the pending Silver Tongue victory before mission-end recovery.");
    const d = currentDamage(actor);
    if (
      d.events.some(
        e =>
          e.kind === "temporary" &&
          e.remaining > 0 &&
          (e.ability !== "wis" || !e.source.startsWith("Silver Tongue: Actor."))
      )
    )
      throw new Error("Other temporary attribute damage needs its own source-specific recovery review first.");
    const id = "attributeMissionEnd_" + encodeURIComponent(missionId).replaceAll(".", "%2E"),
      p = attributeMissionRecoveryPlan(state(actor), { id, missionId, confirmed: true, worldTime: now() });
    await saveDamage(actor, p.record);
    return p;
  });
}
export function silverVictoryRows(source) {
  const records = source.flags?.spycraft2?.silverTongueVictories ?? {};
  if (!records || typeof records !== "object" || Array.isArray(records)) return [{ needsReview: true }];
  return Object.entries(records).map(([key, r]) =>
    silverVictoryRecordValid(r, key)
      ? { ...r, pending: ["pending", "cancelling"].includes(r.status), correctable: r.status !== "cancelled" }
      : { id: key, needsReview: true }
  );
}
