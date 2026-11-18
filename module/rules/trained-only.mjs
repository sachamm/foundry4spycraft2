/** Trained Only (TRO), p.302: untrained attack checks are impossible.
 * It does not add another penalty or independently prohibit damage calculations.
 */
export function trainedOnlyAttackPlan(weapon, { trained = false } = {}) {
  if (typeof trained !== "boolean")
    throw Error("Review the actual operating proficiency before using a Trained Only weapon.");
  const qualities = weapon?.qualities ?? "";
  if (typeof qualities !== "string") throw Error("Review the actual weapon qualities before checking Trained Only.");
  const trainedOnly = /\bTRO\b/.test(qualities),
    blocked = trainedOnly && !trained;
  return {
    evidence: { version: 1, trainedOnly, trained },
    blocked,
    blockedReason: blocked
      ? "Trained Only (TRO): an untrained attack check with this weapon is impossible (p.302)."
      : ""
  };
}
const stable = v =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map(k => [k, x[k]])
        )
      : x
  );
export function validateTrainedOnlyProof(weapon, proof, { checkKind, trained = false } = {}) {
  if (!proof) return;
  const p = trainedOnlyAttackPlan(weapon, { trained });
  if (checkKind !== "attack" || p.blocked || stable(p.evidence) !== stable(proof))
    throw Error(
      "The Trained Only weapon quality or actual operating proficiency changed or no longer permits this attack."
    );
}
