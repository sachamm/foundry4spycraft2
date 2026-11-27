import { loc } from "../i18n.mjs";

export const removedVitalityKey = (careerLevel, classId, die) =>
  encodeURIComponent(`${careerLevel}:${classId}:d${die}`).replaceAll(".", "%2E");

export function removedVitalityRecord(entry, careerLevel, die, id, at) {
  if (
    !Number.isSafeInteger(careerLevel) ||
    careerLevel < 1 ||
    careerLevel > 20 ||
    !Number.isSafeInteger(die) ||
    die < 2 ||
    !Number.isSafeInteger(entry.vitality) ||
    entry.vitality < 0 ||
    entry.vitality > die ||
    !entry.classId
  )
    throw Error(loc`Review the class and raw vitality before removing this career level.`);
  return {
    version: 1,
    id,
    careerLevel,
    classId: entry.classId,
    die,
    vitality: entry.vitality,
    careerEntryId: entry.careerEntryId ?? "",
    vitalityRollId: entry.vitalityRollId ?? "",
    vitalityReviewId: entry.vitalityReviewId ?? "",
    vitalityHistoryId: entry.vitalityHistoryId ?? "",
    intelligenceModifier: entry.intelligenceModifier ?? null,
    ...(Object.hasOwn(entry, "skillPolicy") ? { skillPolicy: structuredClone(entry.skillPolicy) } : {}),
    at
  };
}

/** A rebuilt career slot keeps its original roll; changing its class/die needs an explicit raw-result review. */
export function retainedVitality(records, careerLevel, classId, die) {
  if (!records) return null;
  const key = removedVitalityKey(careerLevel, classId, die),
    matching = records[key];
  if (matching) {
    if (
      matching.version !== 1 ||
      matching.classId !== classId ||
      matching.die !== die ||
      matching.careerLevel !== careerLevel ||
      !Number.isSafeInteger(matching.vitality) ||
      matching.vitality < 0 ||
      matching.vitality > die
    )
      throw Error(loc`The retained vitality source is invalid. The GC must review its history.`);
    return {
      vitality: matching.vitality,
      careerEntryId: matching.careerEntryId ?? "",
      vitalityRollId: matching.vitalityRollId ?? "",
      vitalityReviewId: matching.vitalityReviewId ?? "",
      vitalityHistoryId: matching.vitalityHistoryId ?? "",
      intelligenceModifier: matching.intelligenceModifier ?? null,
      ...(Object.hasOwn(matching, "skillPolicy") ? { skillPolicy: structuredClone(matching.skillPolicy) } : {})
    };
  }
  const prior = Object.values(records).find(
    r =>
      r?.careerLevel === careerLevel &&
      (r.vitality > 0 || r.vitalityRollId || r.vitalityReviewId || r.vitalityHistoryId)
  );
  if (prior && (prior.version !== 1 || typeof prior.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(prior.id)))
    throw Error(loc`The retained vitality history is invalid. The GC must review it.`);
  return careerLevel > 1 && prior ? { vitality: 0, vitalityHistoryId: prior.id } : null;
}
