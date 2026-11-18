import { loc } from "../i18n.mjs";
/** Sleeping p.342: wake only the sleep sources present at the triggering event. */
export const SLEEP_STATUS_IDS = ["sleep", "sleeping", "asleep"];
export function sleepingSourceSnapshot(actor) {
  const own = [...(actor.effects ?? [])],
    applied = actor.appliedEffects ?? own.filter(e => e.active ?? (!e.disabled && !e.isSuppressed));
  const sources = applied
    .filter(e => [...(e.statuses ?? [])].some(id => SLEEP_STATUS_IDS.includes(id)))
    .map(e => {
      const data = e.toObject?.() ?? e;
      return {
        id: e.uuid ?? e.id ?? data._id ?? null,
        statuses: [...(e.statuses ?? [])].filter(id => SLEEP_STATUS_IDS.includes(id)).sort(),
        origin: data.origin ?? "",
        duration: data.duration ?? null,
        operation: data.flags?.spycraft2?.conditionOperation ?? null
      };
    })
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const sleeping =
    sources.length > 0 ||
    actor.system?.conditionContext?.sleeping === true ||
    [...SLEEP_STATUS_IDS].some(id => actor.statuses?.has(id));
  if (!sleeping) return { state: "awake", signature: null };
  if (!sources.length || sources.some(s => !s.id) || new Set(sources.map(s => s.id)).size !== sources.length)
    return { state: "unknown", signature: null };
  return { state: "sleeping", signature: JSON.stringify(sources) };
}
export function sleepWakePlan(current, event, { cause, confirmed = false, check = null } = {}) {
  if (!["newTouch", "damage", "awareness"].includes(cause) || confirmed !== true)
    return { blocked: true, reason: loc`Confirm a new touch, damage, or successful Notice/Awareness event.` };
  if (
    cause === "awareness" &&
    !(
      check?.checkKind === "skill" &&
      check.skillKey === "notice" &&
      check.checkId === "awareness" &&
      check.successConfirmed === true &&
      !check.superseded
    )
  )
    return { blocked: true, reason: loc`Waking requires a confirmed successful Notice/Awareness check.` };
  if (event?.state !== "sleeping" || typeof event.signature !== "string" || !event.signature)
    return {
      blocked: true,
      reason: loc`The triggering event has no identifiable sleeping source. Review the current cause with the GC.`
    };
  if (current.state === "awake") return { blocked: false, changed: false };
  if (current.state !== "sleeping" || current.signature !== event.signature)
    return {
      blocked: true,
      reason: loc`The sleeping sources changed after this event. Review the current cause; this old event cannot wake a new sleep.`
    };
  return { blocked: false, changed: true };
}
