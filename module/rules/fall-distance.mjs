/** Equilibrium Basics p.194 and soft/ yielding landing p.336: damage-distance calculation only. */
export function fallDistancePlan(
  system,
  { fallDeclared = false, fallDistanceFeet = null, fallSoftSurface = false, fallConfirmed = false } = {}
) {
  if (fallDeclared === false) return null;
  if (
    fallDeclared !== true ||
    fallConfirmed !== true ||
    typeof fallSoftSurface !== "boolean" ||
    typeof fallDistanceFeet !== "number" ||
    !Number.isFinite(fallDistanceFeet) ||
    fallDistanceFeet < 0 ||
    fallDistanceFeet > Number.MAX_SAFE_INTEGER
  )
    throw Error(
      "The GC must confirm the actual nonnegative fall distance and whether the landing surface is soft or yielding."
    );
  const names = system?.activeFeatNames;
  if (!Array.isArray(names) || names.some(n => typeof n !== "string" || !n.trim()))
    throw Error("Review the character’s current qualified falling-distance sources.");
  const reductions = [
      ...(names.includes("Equilibrium Basics") ? [{ source: "Equilibrium Basics", feet: 20 }] : []),
      ...(fallSoftSurface ? [{ source: "Soft or yielding landing surface", feet: 10 }] : [])
    ],
    reductionFeet = reductions.reduce((n, r) => n + r.feet, 0),
    damageDistanceFeet = Math.max(0, fallDistanceFeet - reductionFeet);
  return {
    version: 1,
    context: { fallDeclared: true, fallDistanceFeet, fallSoftSurface, fallConfirmed: true },
    actualDistanceFeet: fallDistanceFeet,
    reductions,
    reductionFeet,
    damageDistanceFeet,
    notes: [
      `Falling damage distance: ${fallDistanceFeet} ft. minus ${reductionFeet} ft. = ${damageDistanceFeet} ft. (minimum0; pp.194,336).`,
      "This is the distance used for falling damage. It does not shorten the physical fall, move the character, establish a landing/check outcome or settle damage, armor piercing, stress, diving or fall duration."
    ]
  };
}
export function validateFallDistanceProof(system, proof, { checkKind, skillKey, checkId } = {}) {
  if (proof === null || proof === undefined) return;
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
  if (checkKind !== undefined && (checkKind !== "skill" || skillKey !== "acrobatics" || checkId !== "falling"))
    throw Error("Falling-distance proof belongs only to Acrobatics/Falling.");
  if (
    proof.version !== 1 ||
    !proof.context ||
    proof.context.fallDeclared !== true ||
    stable(fallDistancePlan(system, proof.context)) !== stable(proof)
  )
    throw Error("The falling-distance declaration or qualified Equilibrium Basics source changed before posting.");
}
export function fallDistanceSkillPlan(system, key, check, input = {}) {
  const empty = { evidence: null, blockedReason: "", notes: [] };
  if (input.fallDeclared === false || input.fallDeclared === undefined) return empty;
  if (key !== "acrobatics" || check?.id !== "falling")
    return { ...empty, blockedReason: "Declare falling damage distance only for Acrobatics/Falling." };
  try {
    const evidence = fallDistancePlan(system, input);
    return { ...empty, evidence, notes: evidence?.notes ?? [] };
  } catch (error) {
    return { ...empty, blockedReason: error.message };
  }
}
