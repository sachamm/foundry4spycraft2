/** Claims survive removal of either chat result. Each ability owns its claim on a particular trigger. */
export const triggerClaimKey = (source, trigger) => encodeURIComponent(`${source}:${trigger}`).replaceAll(".", "%2E");
export function triggerClaimUsed(records, source, trigger, ownReservationId = null, actorUuid = null) {
  const key = triggerClaimKey(source, trigger);
  if (!records || !Object.hasOwn(records, key)) return false;
  const record = records[key];
  const valid =
    record?.version === 1 &&
    typeof record.id === "string" &&
    !!record.id &&
    record.source === source &&
    record.triggerMessageUuid === trigger;
  if (!valid) return true;
  if (actorUuid && record.actorUuid && record.actorUuid !== actorUuid) return false;
  if (record.state === "void") return false;
  return !(record.state === "reserved" && ownReservationId && record.id === ownReservationId);
}
