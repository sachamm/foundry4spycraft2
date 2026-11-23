/** NPC disposition (pp.457–458, Table 7.14). */
import { GC_DATA } from "../gc-tables.mjs";
import { loc } from "../../i18n.mjs";

const D = GC_DATA.core.disposition;
export const DISPOSITIONS = D.grades;
const index = id => D.grades.findIndex(grade => grade.id === id);
export const dispositionGrade = id => D.grades[index(id)] ?? D.grades[index(D.default)];

/** An NPC's disposition toward one character or group; anything not recorded is Neutral. */
export function dispositionToward(record, targetId) {
  return record?.toward?.[targetId]?.grade ?? record?.base ?? D.default;
}

/**
 * Shift by whole grades toward Helpful (+) or Adversarial (−).
 * No NPC may move more than 2 grades either way during one mission, and only one ability per
 * mission may shift it automatically. Villains ignore disposition altogether.
 */
export function shiftDisposition(
  record,
  targetId,
  steps,
  { mission = "initial", automatic = false, villain = false } = {}
) {
  if (villain) throw new Error(loc`Villains are immune to disposition effects (p.457).`);
  if (!Number.isSafeInteger(steps) || steps === 0) throw new Error(loc`Enter a whole number of grades to shift.`);
  const current = record?.toward?.[targetId] ?? {};
  const sameMission = current.mission === mission;
  const shifted = sameMission ? (current.shifted ?? 0) : 0;
  if (automatic && sameMission && current.automatic)
    throw new Error(loc`Only one ability per mission may automatically shift this NPC’s disposition.`);
  // Higher on the table is friendlier, so a positive shift lowers the index.
  const allowed = Math.max(-D.maxShiftPerMission - shifted, Math.min(D.maxShiftPerMission - shifted, steps));
  const from = index(dispositionToward(record, targetId));
  const to = Math.max(0, Math.min(D.grades.length - 1, from - allowed));
  const applied = from - to;
  return {
    grade: D.grades[to].id,
    applied,
    limited: applied !== steps,
    entry: {
      grade: D.grades[to].id,
      mission,
      shifted: shifted + applied,
      automatic: automatic || (sameMission && !!current.automatic)
    }
  };
}

const matches = (list, check) => list.some(name => name.toLowerCase() === String(check ?? "").toLowerCase());

/** Modifiers to a skill check that targets the NPC. `check` is "Skill/Use" as printed. */
export function dispositionCheckModifier(gradeId, check, { villain = false } = {}) {
  const none = { kind: null, modifier: 0, error: 0, threat: 0 };
  if (villain) return none;
  const grade = dispositionGrade(gradeId);
  if (matches(D.intimacyChecks, check))
    return { kind: "intimacy", modifier: grade.intimacy, error: grade.intimacyError, threat: 0 };
  if (matches(D.fondnessChecks, check))
    return { kind: "fondness", modifier: grade.fondness, error: grade.fondnessError, threat: grade.fondnessThreat };
  return none;
}

/**
 * Loyalty outside combat: check each candidate from strongest to weakest feeling; the NPC sides
 * with the first whose d20 is at or under the Loyalty number, and settles for the last otherwise.
 * `foil` is the −5…+5 foil quality modifier to the die.
 */
export function loyaltyDecision(candidates, rolls, { foil = 0 } = {}) {
  const ordered = [...candidates].sort((a, b) => strength(b.grade) - strength(a.grade));
  const steps = [];
  for (let i = 0; i < ordered.length; i++) {
    const last = i === ordered.length - 1 && ordered.length > 2;
    if (last) {
      steps.push({ ...ordered[i], settled: true });
      return { sides: ordered[i].id, against: false, steps };
    }
    const roll = rolls[i];
    if (!Number.isSafeInteger(roll) || roll < 1 || roll > 20)
      throw new Error(loc`Enter a d20 result for each loyalty check.`);
    const target = dispositionGrade(ordered[i].grade).loyalty,
      total = roll + foil,
      success = total <= target;
    steps.push({ ...ordered[i], roll, total, target, success });
    if (success) return { sides: ordered[i].id, against: false, steps };
    if (ordered.length <= 2) return { sides: ordered[1 - i]?.id ?? null, against: true, steps };
  }
  return { sides: null, against: true, steps };
}
/** The printed example checks the friendliest disposition first (Friendly, then Neutral, then Aloof). */
const strength = gradeId => -index(gradeId);

/** When a fight starts in sight or hearing: the NPC joins the side it feels strongest about on a d20 at or under the number. */
export function joinsCombat(gradeId, roll, { foil = 0 } = {}) {
  if (!Number.isSafeInteger(roll) || roll < 1 || roll > 20) throw new Error(loc`Enter a d20 result.`);
  const grade = dispositionGrade(gradeId),
    total = roll + foil;
  return {
    joins: total <= grade.joinRoll,
    target: grade.joinRoll,
    total,
    friendly: index(gradeId) < index("neutral"),
    hostile: index(gradeId) > index("neutral")
  };
}

/** Once per combat a side may talk the NPC over with Impress/Persuasion; Adversarial needs a Triumph. */
export function persuadeToJoin(gradeId, result, { triumph = false } = {}) {
  const grade = dispositionGrade(gradeId);
  if (grade.joinDC === null) return { dc: null, success: !!triumph, needsTriumph: true };
  return { dc: grade.joinDC, success: Number.isFinite(result) && result >= grade.joinDC, needsTriumph: false };
}
