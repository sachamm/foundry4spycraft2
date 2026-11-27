/*
 * Which natural ranges a check is still a candidate for (threat, error, triumph) and whether an error decision is open.
 * Kept apart from outcomes.mjs so the action-die rules can ask without importing the chat-card notes.
 */
import { triumphResult } from "./campaign-rules.mjs";
/** The result that makes this check a Triumph: the one in force when it was rolled (p.406). */
export const triumphAt = check => (Number.isFinite(check?.triumphAt) ? check.triumphAt : triumphResult());
const skillCheck = check => ["skill", "knowledge"].includes(check.checkKind);
export const triumphCheck = check => skillCheck(check) || check.checkKind === "attack";
/** A natural range is a candidate until success/failure is known, pp.96–97,329–330. */
export function checkCandidates(check) {
  const natural = check.naturalDie,
    rolled = (check.checkMethod ?? "roll") === "roll" && natural != null;
  const threat =
    rolled && check.threat > 0 && natural >= check.threat && (check.checkKind !== "save" || check.forcedThreat);
  const naturalError =
    !check.cannotError && rolled && check.checkKind !== "save" && check.error > 0 && natural <= check.error;
  const negative =
    !check.cannotError &&
    (skillCheck(check) || check.checkKind === "attack") &&
    Number.isFinite(check.effectiveTotal) &&
    check.effectiveTotal < 0;
  return {
    threat: !!threat,
    naturalError: !!naturalError,
    negative,
    error: !!naturalError || negative,
    triumph: triumphCheck(check) && check.effectiveTotal >= triumphAt(check)
  };
}
export function errorDecisionPending(check) {
  const candidates = checkCandidates(check);
  return (
    !(check.boostSpent > 0) &&
    !check.errorActivationDeclined &&
    (candidates.negative ||
      (candidates.naturalError && (check.successConfirmed !== true || check.allOrNothing === true)))
  );
}
