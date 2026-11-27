import { loc } from "../i18n.mjs";

export function skillPurchasePolicyRecord(
  careerLevel,
  effects,
  { reviewerId, note, source = "level-entry", at = 0 } = {}
) {
  if (
    !Number.isSafeInteger(careerLevel) ||
    careerLevel < 1 ||
    careerLevel > 20 ||
    ![undefined, 0, 1].includes(effects?.allSkillsClass) ||
    typeof reviewerId !== "string" ||
    !reviewerId ||
    typeof note !== "string" ||
    !note.trim() ||
    !["level-entry", "gc-review"].includes(source) ||
    !Number.isFinite(at)
  )
    throw Error(loc`Review the career level, skill-cost policy and its source.`);
  return {
    version: 1,
    careerLevel,
    allSkillsClass: effects?.allSkillsClass === 1,
    confirmed: true,
    reviewerId,
    note: note.trim(),
    source,
    at
  };
}

/** Purchase history stays fixed when a later season changes Jack-of-All-Trades. */
export function skillPurchasePolicy(entry, careerLevel, effects = {}) {
  const record = entry?.skillPolicy;
  if (record == null) return { allSkillsClass: false, recorded: false, needsReview: effects.allSkillsClass === 1 };
  const valid =
    record.version === 1 &&
    record.careerLevel === careerLevel &&
    record.confirmed === true &&
    typeof record.allSkillsClass === "boolean" &&
    typeof record.reviewerId === "string" &&
    !!record.reviewerId &&
    typeof record.note === "string" &&
    !!record.note.trim() &&
    ["level-entry", "gc-review"].includes(record.source) &&
    Number.isFinite(record.at);
  return { allSkillsClass: valid && record.allSkillsClass, recorded: valid, needsReview: !valid };
}
