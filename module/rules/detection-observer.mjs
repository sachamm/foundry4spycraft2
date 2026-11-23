import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
/** Table2.25 p.119 observer distraction; Ghost Mastery p.195 adds a separate check penalty. */
const DISTRACTION = {
  minor: { penalty: -2, errorIncrease: 0 },
  moderate: { penalty: -4, errorIncrease: 1 },
  major: { penalty: -8, errorIncrease: 3 }
};
export function detectionObserverPlan(
  targetSystem,
  key,
  check,
  { actorUuid = "", actorName = "", severity = "", confirmed = false, method = "roll" } = {}
) {
  const empty = { evidence: null, penalty: 0, errorIncrease: 0, blockedReason: "", notes: [] },
    reject = blockedReason => ({ ...empty, blockedReason });
  if (severity === "") return empty;
  if (!((key === "notice" && check?.id === "awareness") || (key === "search" && check?.id === "perception")))
    return reject(loc`Character-detection distraction applies only to Notice/Awareness or Search/Perception.`);
  if (typeof severity !== "string" || !Object.hasOwn(DISTRACTION, severity))
    return reject(loc`Choose the actual minor, moderate or major distraction.`);
  if (method !== "roll")
    return reject(
      loc`Taking10/20 is unavailable while distracted (pp.97–98); use a rolled detection check for this entry.`
    );
  if (
    typeof actorUuid !== "string" ||
    !/^Actor\.[A-Za-z0-9_-]+$/.test(actorUuid) ||
    typeof actorName !== "string" ||
    !actorName.trim() ||
    actorName.trim().length > 200 ||
    confirmed !== true
  )
    return reject(
      loc`Choose the actual covert character and confirm this detection check and distraction with the GC.`
    );
  if (
    !targetSystem ||
    typeof targetSystem !== "object" ||
    Array.isArray(targetSystem) ||
    (targetSystem.activeFeatNames !== undefined &&
      (!Array.isArray(targetSystem.activeFeatNames) ||
        targetSystem.activeFeatNames.some(n => typeof n !== "string" || !n.trim())))
  )
    return reject(loc`Review the actual target character’s current feat sources.`);
  const row = DISTRACTION[severity],
    sources = targetSystem.activeFeatNames?.includes("Ghost Mastery") ? ["Ghost Mastery"] : [],
    additionalPenalty = sources.length ? -4 : 0,
    penalty = row.penalty + additionalPenalty,
    errorIncrease = row.errorIncrease;
  const evidence = {
    version: 1,
    skillKey: key,
    checkId: check.id,
    method,
    targetActorUuid: actorUuid,
    targetName: actorName.trim(),
    severity,
    confirmed: true,
    basePenalty: row.penalty,
    additionalPenalty,
    penalty,
    errorIncrease,
    sources
  };
  return {
    evidence,
    penalty,
    errorIncrease,
    blockedReason: "",
    notes: [
      loc`Character-detection distraction (${severity}) against ${actorName.trim()}: check ${row.penalty}, error range +${errorIncrease} before ordinary reductions${sources.length ? loc`; Ghost Mastery additional check −4` : ""}. Total distraction check modifier ${penalty} (Table 2.25, p.119; p.195).`
    ]
  };
}

// Recorded on the posted check as the roll was given them.
rollPipeline.register({ id: "detectionObserverRecord", order: 9660, record: ["detectionObserver"] });
