import { classFeatureLevels } from "./class-features.mjs";
import { loc } from "../i18n.mjs";
/** Sleuth Final Deduction, p.46. Tracks study; all information is supplied by the GC. */
export const hasFinalDeduction = system => (classFeatureLevels(system)?.sleuth ?? 0) >= 14;
export function finalDeductionStudy(stored, epoch) {
  if (stored == null) return null;
  if (typeof stored !== "object" || Array.isArray(stored) || typeof stored.epoch !== "string" || !stored.epoch)
    throw new Error(loc`The GC must review the saved Final Deduction study.`);
  if (stored.epoch !== epoch) return null;
  const fixedStage = ["attributes", "specialty", "talent", "classes"][stored.rounds - 1];
  if (
    typeof stored.target !== "string" ||
    !stored.target.trim() ||
    !Number.isSafeInteger(stored.rounds) ||
    stored.rounds < 1 ||
    !["attributes", "specialty", "talent", "classes", "skills", "remaining"].includes(stored.stage) ||
    (fixedStage ? stored.stage !== fixedStage : !["classes", "skills", "remaining"].includes(stored.stage))
  )
    throw new Error(loc`The GC must review the saved Final Deduction study.`);
  return stored;
}
export function finalDeductionPlan(system, stored, epoch, input = {}) {
  if (!hasFinalDeduction(system)) throw new Error(loc`Final Deduction requires earned Sleuth level 14.`);
  const study = finalDeductionStudy(stored, epoch),
    expected = input.expectedRound;
  if (input.expectedEpoch !== epoch || !Number.isSafeInteger(expected) || expected !== (study?.rounds ?? 0))
    throw new Error(loc`The study or session changed. Reopen Final Deduction before recording another round.`);
  const target = typeof input.target === "string" ? input.target.trim() : "";
  if (!target || input.fullRoundConfirmed !== true)
    throw new Error(loc`Name the target and confirm one completed full round of study.`);
  if (study && target !== study.target)
    throw new Error(loc`Final Deduction studies only one special character per session.`);
  if (!study && (input.specialCharacterConfirmed !== true || input.observedRoundConfirmed !== true))
    throw new Error(
      loc`Confirm a special character previously observed for at least one round in person, or by audio or visual recording.`
    );
  const rounds = (study?.rounds ?? 0) + 1;
  if (!Number.isSafeInteger(rounds)) throw new Error(loc`Review the saved round count.`);
  let stage, revelation;
  if (rounds === 1) {
    stage = "attributes";
    revelation = "All attribute scores";
  } else if (rounds === 2) {
    stage = "specialty";
    revelation = "Specialty";
  } else if (rounds === 3) {
    stage = "talent";
    revelation = loc`Talent and one Subplot of the GC’s choice (if any)`;
  } else if (rounds === 4) {
    stage = "classes";
    revelation = loc`Highest-level class name and level; GC decides ties`;
  } else {
    stage = input.stage;
    const previous = ["classes", "skills", "remaining"].indexOf(study.stage),
      next = ["classes", "skills", "remaining"].indexOf(stage);
    if (next < previous || next < 0)
      throw new Error(loc`Study continues through classes, then skills, then remaining Subplots and proficiencies.`);
    if (next >= 1 && input.allClassesKnownConfirmed !== true)
      throw new Error(loc`Confirm all class names and levels are already known before studying skills.`);
    if (next === 2 && input.allSkillsKnownConfirmed !== true)
      throw new Error(loc`Confirm all skill names and ranks are already known before the final stage.`);
    revelation =
      stage === "classes"
        ? loc`Next highest-level class name and level; GC decides ties`
        : stage === "skills"
          ? loc`Next highest-ranked skill name and ranks; GC decides ties`
          : loc`Remaining Subplots and proficiencies, in the order determined by the GC`;
  }
  return { epoch, target, rounds, stage, revelation, starting: !study };
}
