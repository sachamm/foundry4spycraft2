import { ANIMAL_PARTNER, PERSONAL_LIEUTENANT, companionLoss } from "./companions.mjs";
import { loc } from "../i18n.mjs";

export const companionLossKey = uuid => encodeURIComponent(uuid).replaceAll(".", "%2E");
export const companionMission = periods => String(periods?.mission ?? "initial");
const feats = [ANIMAL_PARTNER, PERSONAL_LIEUTENANT];

/** The owner's durable record keeps the lost character linked, including when its actor is later deleted. */
export function companionLossStatus(record, mission) {
  if (!record || record.state === "cancelled") return { lost: false, needsReview: false, replacementAvailable: false };
  const valid =
    record.version === 1 &&
    feats.includes(record.feat) &&
    typeof record.mission === "string" &&
    record.mission.length > 0;
  const needsReview = !valid || record.state !== "charged" || record.replacement?.state === "pending";
  const replacementRecorded = record.replacement?.state === "created";
  return {
    lost: true,
    needsReview,
    replacementAvailable: !needsReview && (replacementRecorded || record.mission !== mission),
    replacementRecorded
  };
}

/** Capture the cost before writing either the balance or the result. The two are settled in one owner update. */
export function companionLossPlan(system, link, { id, ownerUuid, companionUuid, companionName, mission, at } = {}) {
  if (!id || !ownerUuid || !companionUuid || link?.ownerUuid !== ownerUuid || !feats.includes(link?.feat))
    throw Error(loc`Verify this companion's actual owner and feat before recording a loss.`);
  if (
    !Number.isSafeInteger(system.level) ||
    system.level < 0 ||
    typeof mission !== "string" ||
    !mission ||
    !Number.isFinite(at)
  )
    throw Error(loc`Verify the owner's Career Level and current mission before recording a loss.`);
  const resource = system.affiliationType === "freelance" ? "netWorth" : "reputation",
    before = system[resource] ?? 0,
    amount = companionLoss(system)[resource];
  if (!Number.isSafeInteger(before) || !Number.isSafeInteger(amount))
    throw Error(loc`Review the owner's actual balance before recording this loss.`);
  return {
    version: 1,
    id,
    ownerUuid,
    companionUuid,
    companionName: String(companionName ?? companionUuid),
    feat: link.feat,
    ownerLevel: system.level,
    mission,
    resource,
    before,
    after: before - amount,
    amount,
    at,
    state: "pending"
  };
}

/** A GC correction states the actual present balance; it never assumes an uncertain debit should be replayed. */
export function reviewCompanionLossPlan(record, { outcome, balance, note, reviewer, at } = {}) {
  if (
    !record ||
    record.version !== 1 ||
    !["reputation", "netWorth"].includes(record.resource) ||
    !["charged", "cancelled"].includes(outcome) ||
    !Number.isSafeInteger(balance) ||
    !String(note ?? "").trim() ||
    !reviewer ||
    !Number.isFinite(at)
  )
    throw Error(loc`Verify the loss outcome, actual present balance and reason for this correction.`);
  return {
    record: {
      ...record,
      state: outcome,
      review: { reviewer, at, note: String(note).trim(), previousState: record.state, balance }
    },
    balance
  };
}

/** Sparse Undo: restore only the charged resource and this companion's record. */
export function companionLossUndoEntry(
  owner,
  record,
  { previous = null, beforeBalance = record.before, afterBalance = record.after } = {}
) {
  const path = `flags.spycraft2.companionLosses.${companionLossKey(record.companionUuid)}`,
    balancePath = `system.${record.resource}`;
  return {
    uuid: owner.uuid,
    name: owner.name,
    restore: [[balancePath, beforeBalance], ...(previous ? [[path, previous]] : [])],
    unset: previous ? [] : [path],
    expect: [
      [balancePath, afterBalance],
      [path, record]
    ],
    whole: previous ? [path] : [],
    created: [],
    removed: [],
    combatants: []
  };
}
