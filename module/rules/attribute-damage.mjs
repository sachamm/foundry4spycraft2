import { rollPipeline } from "./roll-pipeline.mjs";
/** Attribute damage and mission-end recovery, p.17. Current scores may be negative. */
const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const clean = () => ({ version: 1, events: [], recoveries: [] });
const text = v => typeof v === "string" && v.trim() === v && v.length > 0 && v.length <= 2048;
const nonnegative = v => Number.isSafeInteger(v) && v >= 0;
const time = v => Number.isFinite(v) && v >= 0;
const total = () => Object.fromEntries(ABILITIES.map(k => [k, { temporary: 0, permanent: 0, total: 0 }]));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function validApplication(e) {
  return (
    e &&
    e.version === 1 &&
    text(e.id) &&
    ABILITIES.includes(e.ability) &&
    ["temporary", "permanent"].includes(e.kind) &&
    text(e.source) &&
    text(e.missionId) &&
    time(e.worldTime) &&
    Number.isSafeInteger(e.before) &&
    nonnegative(e.amount) &&
    Number.isSafeInteger(e.requested) &&
    e.requested > 0 &&
    (e.floor === null || Number.isSafeInteger(e.floor)) &&
    Number.isSafeInteger(e.before - e.amount) &&
    e.amount === (e.floor === null ? e.requested : Math.min(e.requested, Math.max(0, e.before - e.floor)))
  );
}
/** Saved totals are never authoritative; each allocation consumes an actual source event once. */
export function attributeDamageState(system) {
  const record = system.attributeDamage ?? clean(),
    byAbility = total(),
    bad = reason => ({ record: structuredClone(record), byAbility: total(), events: [], needsReview: true, reason });
  if (record.version !== 1 || !Array.isArray(record.events) || !Array.isArray(record.recoveries))
    return bad("Review the attribute-damage record format.");
  const events = new Map();
  for (const event of record.events) {
    if (!validApplication(event) || events.has(event.id))
      return bad("Review the attribute-damage sources, amounts or duplicate identifiers.");
    events.set(event.id, { ...structuredClone(event), healed: 0, remaining: event.amount });
  }
  const recoveries = new Set(),
    missions = new Set();
  for (const r of record.recoveries) {
    if (
      !r ||
      r.version !== 1 ||
      !text(r.id) ||
      recoveries.has(r.id) ||
      !["missionEnd", "correction"].includes(r.kind) ||
      !text(r.missionId) ||
      (r.kind === "missionEnd" && missions.has(r.missionId)) ||
      !time(r.worldTime) ||
      !Array.isArray(r.allocations)
    )
      return bad("Review the attribute-damage recovery history.");
    if (
      r.kind === "correction" &&
      (!text(r.reason) ||
        !events.has(r.eventId) ||
        r.worldTime < events.get(r.eventId).worldTime ||
        r.allocations.length > 1 ||
        r.allocations.some(a => a?.eventId !== r.eventId))
    )
      return bad("Review the attribute-damage correction source and reason.");
    recoveries.add(r.id);
    if (r.kind === "missionEnd") missions.add(r.missionId);
    const ids = new Set();
    for (const allocation of r.allocations) {
      const e = events.get(allocation?.eventId);
      if (
        !e ||
        ids.has(e.id) ||
        (r.kind === "missionEnd" && e.kind !== "temporary") ||
        !Number.isSafeInteger(allocation.amount) ||
        allocation.amount <= 0 ||
        allocation.amount > e.remaining ||
        r.worldTime < e.worldTime
      )
        return bad("Review the attribute-damage recovery allocations.");
      ids.add(e.id);
      e.healed += allocation.amount;
      e.remaining -= allocation.amount;
    }
  }
  for (const e of events.values()) {
    const b = byAbility[e.ability];
    b[e.kind] += e.remaining;
    b.total += e.remaining;
    if (!nonnegative(b.total) || !nonnegative(b[e.kind])) return bad("Review the accumulated attribute-damage total.");
  }
  return { record: structuredClone(record), byAbility, events: [...events.values()], needsReview: false, reason: "" };
}
function ready(system) {
  const s = attributeDamageState(system);
  if (s.needsReview) throw new Error(s.reason);
  return s;
}
function currentMission(system) {
  const id = system.usagePeriods?.mission ?? "initial";
  if (!text(id)) throw new Error("Review the current mission identifier.");
  return id;
}
/** Stable caller-supplied event ID makes replay independent of later healing, source loss or stat changes. */
export function attributeDamagePlan(
  system,
  { id, ability, kind = "temporary", amount, source, floor = null, confirmed = false, worldTime } = {}
) {
  const state = ready(system),
    missionId = currentMission(system),
    request = { id, ability, kind, requested: amount, source, floor, missionId };
  if (
    confirmed !== true ||
    !text(id) ||
    !ABILITIES.includes(ability) ||
    !["temporary", "permanent"].includes(kind) ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    !text(source) ||
    (floor !== null && !Number.isSafeInteger(floor)) ||
    !time(worldTime)
  )
    throw new Error("Confirm a named attribute-damage event, kind, amount and actual time with the GC.");
  const existing = state.record.events.find(e => e.id === id);
  if (existing) {
    const original = Object.fromEntries(Object.keys(request).map(k => [k, existing[k]]));
    if (!same(original, request))
      throw new Error("This attribute-damage identifier already belongs to a different event.");
    return { record: state.record, event: structuredClone(existing), alreadyApplied: true, changed: false };
  }
  if (state.record.recoveries.some(r => r.kind === "missionEnd" && r.missionId === missionId))
    throw new Error(
      "This mission’s attribute recovery is already settled. Begin the next mission before recording new damage."
    );
  const before = system.abilities?.[ability]?.value;
  if (!Number.isSafeInteger(before))
    throw new Error("Review the actual current attribute score before applying damage.");
  const applied = floor === null ? amount : Math.min(amount, Math.max(0, before - floor)),
    after = before - applied;
  if (!Number.isSafeInteger(after))
    throw new Error("The resulting attribute score is outside the supported integer range.");
  const event = { version: 1, ...request, worldTime, before, amount: applied },
    record = structuredClone(state.record);
  record.events.push(event);
  const result = attributeDamageState({ attributeDamage: record });
  if (result.needsReview) throw new Error(result.reason);
  return { record, event, after, alreadyApplied: false, changed: true };
}
/** Explicit mission end, never elapsed hours/days or a silently inferred new mission. Permanent damage stays. */
export function attributeMissionRecoveryPlan(system, { id, missionId, confirmed = false, worldTime } = {}) {
  const state = ready(system),
    current = currentMission(system);
  if (confirmed !== true || !text(id) || missionId !== current || !time(worldTime))
    throw new Error("Confirm the actual current mission has ended and review the recovery time.");
  const existing = state.record.recoveries.find(r => r.id === id);
  if (existing) {
    if (existing.missionId !== missionId) throw new Error("This recovery identifier belongs to a different mission.");
    return { record: state.record, recovery: structuredClone(existing), alreadyApplied: true, changed: false };
  }
  if (state.record.recoveries.some(r => r.kind === "missionEnd" && r.missionId === missionId))
    throw new Error("This mission already has an attribute-recovery receipt.");
  const allocations = state.events
    .filter(e => e.kind === "temporary" && e.remaining > 0)
    .map(e => ({ eventId: e.id, amount: e.remaining }));
  if (state.events.some(e => e.worldTime > worldTime))
    throw new Error("The recovery time precedes a recorded damage event.");
  const recovery = { version: 1, id, kind: "missionEnd", missionId, worldTime, allocations },
    record = structuredClone(state.record);
  record.recoveries.push(recovery);
  return { record, recovery, alreadyApplied: false, changed: true };
}

const CHECK_KINDS = ["skill", "knowledge", "attack", "ability", "save", "initiative", "gear", "request"];
/** Relevant current source amounts, excluding healed historical events and storage key order. */
export function attributeDamageEvidence(system, checkKind) {
  if (!CHECK_KINDS.includes(checkKind)) return null;
  const state = ready(system),
    events = state.events
      .filter(e => e.remaining > 0)
      .map(e => ({ id: e.id, ability: e.ability, kind: e.kind, source: e.source, remaining: e.remaining }))
      .sort((a, b) => a.id.localeCompare(b.id));
  return events.length ? { version: 1, events } : null;
}
export function validateAttributeDamageProof(system, proof, { checkKind } = {}) {
  if (!same(attributeDamageEvidence(system, checkKind), proof ?? null))
    throw new Error(
      "Attribute damage or its recovery changed before posting this check. Recalculate using the current attributes."
    );
}

/** GC correction removes only the still-active contribution of one erroneous source; its history remains. */
export function attributeDamageCorrectionPlan(system, { id, eventId, reason, confirmed = false, worldTime } = {}) {
  const state = ready(system),
    missionId = currentMission(system),
    event = state.events.find(e => e.id === eventId);
  if (
    confirmed !== true ||
    !text(id) ||
    !text(eventId) ||
    !event ||
    !text(reason) ||
    !time(worldTime) ||
    worldTime < event.worldTime
  )
    throw new Error("Confirm the actual erroneous attribute-damage source and explain its correction.");
  const existing = state.record.recoveries.find(r => r.id === id);
  if (existing) {
    if (existing.kind !== "correction" || existing.eventId !== eventId || existing.reason !== reason)
      throw new Error("This correction identifier belongs to a different decision.");
    return { record: state.record, recovery: structuredClone(existing), alreadyApplied: true, changed: false };
  }
  const recovery = {
      version: 1,
      id,
      kind: "correction",
      eventId,
      reason,
      missionId,
      worldTime,
      allocations: event.remaining ? [{ eventId, amount: event.remaining }] : []
    },
    record = structuredClone(state.record);
  record.recoveries.push(recovery);
  return { record, recovery, alreadyApplied: false, changed: true };
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "attributeDamage",
  order: 1220,
  validate: ({ actor, checkKind, attributeDamage }) =>
    validateAttributeDamageProof(actor.system, attributeDamage, { checkKind })
});
