import { classFeatureLevels } from "./class-features.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
import { stable } from "./equal.mjs";

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
      loc`The GC must confirm the actual nonnegative fall distance and whether the landing surface is soft or yielding.`
    );
  const names = system?.activeFeatNames;
  if (!Array.isArray(names) || names.some(n => typeof n !== "string" || !n.trim()))
    throw Error(loc`Review the character’s current qualified falling-distance sources.`);
  const reductions = [
      ...(names.includes("Equilibrium Basics") ? [{ source: "Equilibrium Basics", feet: 20 }] : []),
      ...(fallSoftSurface ? [{ source: loc`Soft or yielding landing surface`, feet: 10 }] : [])
    ],
    reductionFeet = reductions.reduce((n, r) => n + r.feet, 0),
    damageDistanceFeet = Math.max(0, fallDistanceFeet - reductionFeet);
  // Spider Mastery, p.196: each die of falling damage is 1 lower, never below 1.
  const spider = names.includes("Spider Mastery");
  // Fall Guy (Stuntman 4th): each die of falling damage is 2 lower.
  const fallGuy = (classFeatureLevels(system)?.stuntman ?? 0) >= 4,
    perDieReduction = (spider ? 1 : 0) + (fallGuy ? 2 : 0);
  return {
    version: 1,
    context: { fallDeclared: true, fallDistanceFeet, fallSoftSurface, fallConfirmed: true },
    ...(perDieReduction ? { perDieReduction } : {}),
    actualDistanceFeet: fallDistanceFeet,
    reductions,
    reductionFeet,
    damageDistanceFeet,
    notes: [
      loc`Falling damage distance: ${fallDistanceFeet} ft. minus ${reductionFeet} ft. = ${damageDistanceFeet} ft. (minimum 0; pp.194,336).`,
      ...(spider ? [loc`Spider Mastery: each falling damage die is 1 lower (minimum 1 per die) (p.196).`] : []),
      ...(fallGuy ? [loc`Fall Guy: each falling damage die is 2 lower (minimum 1 per die).`] : []),
      loc`This is the distance used for falling damage. It does not shorten the physical fall, move the character, establish a landing/check outcome or settle damage, armor piercing, stress, diving or fall duration.`
    ]
  };
}
export function validateFallDistanceProof(system, proof, { checkKind, skillKey, checkId } = {}) {
  if (proof === null || proof === undefined) return;
  if (checkKind !== undefined && (checkKind !== "skill" || skillKey !== "acrobatics" || checkId !== "falling"))
    throw Error(loc`Falling-distance proof belongs only to Acrobatics/Falling.`);
  if (
    proof.version !== 1 ||
    !proof.context ||
    proof.context.fallDeclared !== true ||
    stable(fallDistancePlan(system, proof.context)) !== stable(proof)
  )
    throw Error(loc`The falling-distance declaration or qualified Equilibrium Basics source changed before posting.`);
}
export function fallDistanceSkillPlan(system, key, check, input = {}) {
  const empty = { evidence: null, blockedReason: "", notes: [] };
  if (input.fallDeclared === false || input.fallDeclared === undefined) return empty;
  if (key !== "acrobatics" || check?.id !== "falling")
    return { ...empty, blockedReason: loc`Declare falling damage distance only for Acrobatics/Falling.` };
  try {
    const evidence = fallDistancePlan(system, input);
    return { ...empty, evidence, notes: evidence?.notes ?? [] };
  } catch (error) {
    return { ...empty, blockedReason: error.message };
  }
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "fallDistance",
  order: 1510,
  record: ["fallDistance"],
  validate: ({ actor, options, checkKind, checkId, skillKey }) =>
    validateFallDistanceProof(actor.system, options.fallDistance, { checkKind, skillKey, checkId })
});
