import { loc } from "../i18n.mjs";
import { ruleName } from "./rule-name.mjs";

export const CREATION_ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];

const currentCreationScores = system =>
  Object.fromEntries(
    CREATION_ABILITIES.map(k => {
      const a = system.abilities?.[k];
      return [k, (a?.undamagedValue ?? a?.value) - (a?.temporaryBonus ?? 0)];
    })
  );

/** Later increases, damage, aging and temporary effects do not rewrite a character's recorded starting scores. */
export function startingAttributeSignature(system, items = []) {
  const first = system.progression?.[0];
  const cls = items.find(i => i.type === "class" && (i.system.identifier || i.name) === first?.classId);
  return JSON.stringify({
    base: CREATION_ABILITIES.map(k => system.abilities?.[k]?.base),
    firstClass: first ? [first.classId, first.careerEntryId ?? ""] : null,
    firstChoices: (cls?.system.choiceSchedule ?? []).flatMap((slot, i) =>
      slot.level === 1 ? [[i, cls.system.choices?.[i] ?? null]] : []
    ),
    origins: items
      .filter(i => i.type === "origin")
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .map(i => [
        i.id,
        ruleName(i),
        i.system.originType ?? "",
        i.system.bonuses ?? [],
        i.system.choices ?? {},
        i.system.choice ?? ""
      ]),
    feats: items
      .filter(
        i =>
          i.type === "feat" &&
          !["temporary", "virtual"].includes(i.system.featKind) &&
          (i.system.acquiredAtLevel || 1) <= 1
      )
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .map(i => [
        i.id,
        ruleName(i),
        !!i.system.granted,
        i.system.featKind ?? "permanent",
        i.system.bonuses ?? [],
        i.system.choice ?? ""
      ])
  });
}

export function startingAttributeReview(system, items, record, cap) {
  const signature = startingAttributeSignature(system, items);
  const numeric = scores => scores && CREATION_ABILITIES.every(k => Number.isSafeInteger(scores[k]) && scores[k] >= 1);
  const recorded =
    record?.version === 1 &&
    record.cap === cap &&
    record.signature === signature &&
    record.confirmed === true &&
    typeof record.note === "string" &&
    !!record.note.trim() &&
    numeric(record.scores);
  const scores = recorded
    ? { ...record.scores }
    : Array.isArray(system.progression) && (system.level ?? 0) <= 1
      ? currentCreationScores(system)
      : null;
  const needsReview = (!!record && !recorded) || !numeric(scores);
  const violations = numeric(scores)
    ? CREATION_ABILITIES.filter(k => scores[k] > cap).map(k => ({ ability: k, score: scores[k], cap }))
    : [];
  return { cap, recorded, needsReview, scores, violations, signature };
}

export function startingAttributeRecord(
  system,
  items,
  { scores, cap, confirmed = false, note = "", reviewedBy = "GC", at = 0, alreadyInPlay = false } = {}
) {
  if (confirmed !== true || typeof note !== "string" || !note.trim())
    throw new Error(loc`Confirm the original starting scores and record the source reviewed.`);
  if (
    !Number.isSafeInteger(cap) ||
    cap < 1 ||
    !CREATION_ABILITIES.every(k => Number.isSafeInteger(scores?.[k]) && scores[k] >= 1 && scores[k] <= cap)
  )
    throw new Error(
      loc`Enter all six starting attribute scores as whole numbers from 1 to ${cap}, including Origin benefits.`
    );
  const historical =
    !Array.isArray(system.progression) || (system.level ?? 0) > 1 || (system.level === 1 && alreadyInPlay === true);
  const current = currentCreationScores(system);
  if (!historical && CREATION_ABILITIES.some(k => scores[k] !== current[k]))
    throw new Error(
      loc`For a new character, correct the actual starting attributes before recording them. Use historical review only for a character already in play.`
    );
  return {
    version: 1,
    cap,
    scores: Object.fromEntries(CREATION_ABILITIES.map(k => [k, scores[k]])),
    confirmed: true,
    note: String(note).trim(),
    reviewedBy,
    historical,
    at,
    signature: startingAttributeSignature(system, items)
  };
}
