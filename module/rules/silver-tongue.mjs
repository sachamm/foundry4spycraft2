import { attributeDamagePlan, attributeDamageState } from "./attribute-damage.mjs";
import { loc } from "../i18n.mjs";
const string = v => typeof v === "string" && v.trim() === v && v.length > 0 && v.length <= 200,
  actorId = v => typeof v === "string" && /^Actor\.[A-Za-z0-9_-]+$/.test(v);
export function silverVictoryKey(mission, conflictId) {
  if (!string(mission) || !string(conflictId))
    throw new Error(loc`Choose a stable named seduction Conflict identifier in the current mission.`);
  return "silver_" + encodeURIComponent(JSON.stringify([mission, conflictId])).replaceAll(".", "%2E");
}
export function silverVictoryRecordValid(record, key = record?.id) {
  if (
    !record ||
    record.version !== 1 ||
    !string(record.missionId) ||
    !string(record.conflictId) ||
    !actorId(record.sourceActorUuid) ||
    !actorId(record.targetActorUuid) ||
    !string(record.targetName) ||
    !["pending", "cancelling", "settled", "cancelled"].includes(record.status) ||
    typeof record.confirmedBy !== "string" ||
    !record.confirmedBy ||
    !Number.isFinite(record.at) ||
    record.at < 0
  )
    return false;
  try {
    if (key !== record.id || silverVictoryKey(record.missionId, record.conflictId) !== key) return false;
  } catch {
    return false;
  }
  const e = record.event;
  if (
    !e ||
    e.id !== `Silver Tongue:${record.sourceActorUuid}:${key}` ||
    e.ability !== "wis" ||
    e.kind !== "temporary" ||
    e.requested !== 1 ||
    e.floor !== 6 ||
    e.missionId !== record.missionId ||
    e.source !== `Silver Tongue: ${record.sourceActorUuid}; seduction Conflict ${record.conflictId}` ||
    e.worldTime !== record.at
  )
    return false;
  if (attributeDamageState({ attributeDamage: { version: 1, events: [e], recoveries: [] } }).needsReview) return false;
  if (typeof record.beforeRecord !== "string") return false;
  try {
    const b = JSON.parse(record.beforeRecord);
    if (attributeDamageState({ attributeDamage: b }).needsReview || b.events.some(row => row.id === e.id)) return false;
  } catch {
    return false;
  }
  if (
    ["cancelling", "cancelled"].includes(record.status) &&
    (!string(record.correctionReason) || !string(record.reviewedBy))
  )
    return false;
  return true;
}
export function silverVictoryPlan(
  sourceSystem,
  targetSystem,
  {
    sourceActorUuid,
    targetActorUuid,
    targetName,
    conflictId,
    victoryConfirmed = false,
    sourceAtVictoryConfirmed = false,
    confirmedBy,
    worldTime,
    records = {}
  } = {}
) {
  const missionId = sourceSystem.usagePeriods?.mission ?? "initial",
    id = silverVictoryKey(missionId, conflictId);
  if (
    !actorId(sourceActorUuid) ||
    !actorId(targetActorUuid) ||
    sourceActorUuid === targetActorUuid ||
    !string(targetName) ||
    victoryConfirmed !== true ||
    sourceAtVictoryConfirmed !== true ||
    typeof confirmedBy !== "string" ||
    !confirmedBy
  )
    throw new Error(
      loc`Confirm an actual opposing character, a won seduction Conflict, and Silver Tongue active at that victory.`
    );
  if (
    !records ||
    typeof records !== "object" ||
    Array.isArray(records) ||
    Object.entries(records).some(([key, r]) => !silverVictoryRecordValid(r, key))
  )
    throw new Error(loc`Review the saved Silver Tongue victory history.`);
  const existing = records[id];
  if (existing) {
    if (existing.sourceActorUuid !== sourceActorUuid || existing.targetActorUuid !== targetActorUuid)
      throw new Error(loc`This seduction Conflict already belongs to a different target.`);
    return { record: structuredClone(existing), alreadyRecorded: true };
  }
  if (Object.values(records).some(r => ["pending", "cancelling"].includes(r.status)))
    throw new Error(loc`Resolve the interrupted Silver Tongue victory before recording another.`);
  if (!sourceSystem.activeFeatNames?.includes("Silver Tongue"))
    throw new Error(loc`The character must currently have a qualified Silver Tongue source.`);
  if ((targetSystem.usagePeriods?.mission ?? "initial") !== missionId)
    throw new Error(loc`The source and target must share the actual current mission.`);
  const damage = attributeDamagePlan(targetSystem, {
    id: `Silver Tongue:${sourceActorUuid}:${id}`,
    ability: "wis",
    amount: 1,
    source: loc`Silver Tongue: ${sourceActorUuid}; seduction Conflict ${conflictId}`,
    floor: 6,
    confirmed: true,
    worldTime
  });
  const record = {
    version: 1,
    id,
    status: "pending",
    missionId,
    conflictId,
    sourceActorUuid,
    targetActorUuid,
    targetName,
    event: damage.event,
    beforeRecord: JSON.stringify(attributeDamageState(targetSystem).record),
    confirmedBy,
    at: worldTime
  };
  if (!silverVictoryRecordValid(record, id)) throw new Error(loc`Review the prepared Silver Tongue victory record.`);
  return { record, damage, alreadyRecorded: false };
}
