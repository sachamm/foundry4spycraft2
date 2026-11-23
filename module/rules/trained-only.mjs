import { loc } from "../i18n.mjs";
import { stable } from "./equal.mjs";
/** Trained Only (TRO), p.302: untrained attack checks are impossible.
 * It does not add another penalty or independently prohibit damage calculations.
 */
export function trainedOnlyAttackPlan(weapon, { trained = false } = {}) {
  if (typeof trained !== "boolean")
    throw Error(loc`Review the actual operating proficiency before using a Trained Only weapon.`);
  const qualities = weapon?.qualities ?? "";
  if (typeof qualities !== "string") throw Error(loc`Review the actual weapon qualities before checking Trained Only.`);
  const trainedOnly = /\bTRO\b/.test(qualities),
    blocked = trainedOnly && !trained;
  return {
    evidence: { version: 1, trainedOnly, trained },
    blocked,
    blockedReason: blocked
      ? loc`Trained Only (TRO): an untrained attack check with this weapon is impossible (p.302).`
      : ""
  };
}
export function validateTrainedOnlyProof(weapon, proof, { checkKind, trained = false } = {}) {
  if (!proof) return;
  const p = trainedOnlyAttackPlan(weapon, { trained });
  if (checkKind !== "attack" || p.blocked || stable(p.evidence) !== stable(proof))
    throw Error(
      loc`The Trained Only weapon quality or actual operating proficiency changed or no longer permits this attack.`
    );
}
