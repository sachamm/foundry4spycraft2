import { loc } from "../i18n.mjs";
const validId = id =>
  typeof id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(id) && !["constructor", "prototype", "__proto__"].includes(id);
export function vitalitySource(actor, index, { allowInvalidValue = false } = {}) {
  if (!Number.isSafeInteger(index) || index < 1 || index >= (actor.system.progression?.length ?? 0))
    throw new Error(loc`Career Level 1 vitality is automatic maximum; choose an existing higher career level (p.60).`);
  const entry = actor.system.progression[index],
    cls = actor.items.find(i => i.type === "class" && (i.system.identifier || i.name) === entry.classId),
    die = cls?.system.vitalityDie;
  if (!cls || !Number.isSafeInteger(die) || die < 2)
    throw new Error(loc`Review this career level and its class vitality die.`);
  if (!allowInvalidValue && (!Number.isSafeInteger(entry.vitality) || entry.vitality < 0 || entry.vitality > die))
    throw new Error(
      loc`The saved vitality result is outside its class die. Use Review vitality to enter the confirmed result before rolling.`
    );
  const levelId = entry.vitalityRollId ?? "",
    reviewId = entry.vitalityReviewId ?? "";
  if ((levelId && !validId(levelId)) || (reviewId && !validId(reviewId)))
    throw new Error(loc`Review this career level’s vitality references.`);
  return {
    index,
    careerLevel: index + 1,
    classId: entry.classId,
    classItemId: cls.id,
    className: cls.name,
    die,
    value: entry.vitality,
    levelId,
    reviewId
  };
}
export const vitalitySourceEvidence = source => JSON.stringify(source);
export function vitalityRollRecord(actor, source, roll, at) {
  if (
    !validId(source.levelId) ||
    !Number.isSafeInteger(roll.total) ||
    roll.total < 1 ||
    roll.total > source.die ||
    roll.formula !== `1d${source.die}` ||
    !Number.isFinite(at)
  )
    throw new Error(loc`The actual raw vitality roll does not match its class die.`);
  return {
    version: 1,
    id: source.levelId,
    actorUuid: actor.uuid,
    index: source.index,
    careerLevel: source.careerLevel,
    classId: source.classId,
    classItemId: source.classItemId,
    className: source.className,
    die: source.die,
    value: roll.total,
    formula: roll.formula,
    rollData: structuredClone(roll.toJSON()),
    at,
    rollerId: globalThis.game?.user?.id ?? null,
    messageId: null,
    actionDiceAllowed: false
  };
}
export function vitalityMessageTag(record) {
  return {
    version: 1,
    actorUuid: record.actorUuid,
    levelId: record.id,
    careerLevel: record.careerLevel,
    classId: record.classId,
    die: record.die,
    value: record.value,
    at: record.at,
    actionDiceAllowed: false
  };
}
export function vitalityReviewRecord(actor, source, { value, note, confirmed } = {}, id, at) {
  if (
    confirmed !== true ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > source.die ||
    typeof note !== "string" ||
    !note.trim() ||
    note.length > 500 ||
    !validId(id) ||
    !validId(source.levelId) ||
    !Number.isFinite(at)
  )
    throw new Error(
      loc`Confirm the actual raw die result (1–${source.die}) and a bounded source/review note; Constitution and other bonuses apply separately.`
    );
  return {
    version: 1,
    id,
    actorUuid: actor.uuid,
    levelId: source.levelId,
    index: source.index,
    careerLevel: source.careerLevel,
    classId: source.classId,
    die: source.die,
    previousReviewId: source.reviewId || null,
    originalRollId: actor.flags?.spycraft2?.vitalityRolls?.[source.levelId]?.id ?? null,
    before: source.value,
    value,
    note: note.trim(),
    at,
    reviewer: globalThis.game?.user?.id ?? null
  };
}
