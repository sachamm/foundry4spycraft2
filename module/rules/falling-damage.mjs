import { fallingStress } from "./damage-types.mjs";
import { loc } from "../i18n.mjs";

/** Resolve the saved fall distances, surface and Acrobatics outcome before armor or damage resistance. */
export function fallingDamagePlan(
  proof,
  { surface = "solid", diving = false, waterDepthFeet = 0, result, succeeded, dice = null } = {}
) {
  if (
    !proof ||
    proof.version !== 1 ||
    !Number.isFinite(proof.actualDistanceFeet) ||
    proof.actualDistanceFeet < 0 ||
    proof.actualDistanceFeet > Number.MAX_SAFE_INTEGER ||
    !Number.isFinite(proof.damageDistanceFeet) ||
    proof.damageDistanceFeet < 0 ||
    proof.damageDistanceFeet > proof.actualDistanceFeet ||
    !Number.isSafeInteger(proof.perDieReduction ?? 0) ||
    (proof.perDieReduction ?? 0) < 0
  )
    throw Error(loc`Review the recorded fall distances and per-die reductions.`);
  if (!["solid", "fluid"].includes(surface) || typeof diving !== "boolean" || !Number.isFinite(result))
    throw Error(loc`Choose a solid or fluid landing and a recorded Acrobatics result.`);
  if (
    diving &&
    (surface !== "fluid" || !Number.isFinite(waterDepthFeet) || waterDepthFeet < proof.actualDistanceFeet / 3)
  )
    throw Error(
      loc`A dive needs water at least 10 feet deep per 30 feet fallen. Otherwise resolve an ordinary fluid landing.`
    );
  const dc = diving ? 15 + 5 * Math.floor(proof.actualDistanceFeet / 25) : 20;
  if (succeeded != null && typeof succeeded !== "boolean") throw Error(loc`Review the confirmed Falling outcome.`);
  const success = succeeded ?? result >= dc,
    count = success && diving ? 0 : Math.min(20, Math.floor(proof.damageDistanceFeet / 10)),
    kind = surface === "fluid" ? "subdual" : "lethal";
  if (
    dice !== null &&
    (!Array.isArray(dice) || dice.length !== count || dice.some(n => !Number.isSafeInteger(n) || n < 1 || n > 6))
  )
    throw Error(loc`Record one d6 result from 1 to 6 for each falling damage die.`);
  const adjustedDice = dice?.map(n => Math.max(1, n - (proof.perDieReduction ?? 0))) ?? null,
    total = adjustedDice?.reduce((n, value) => n + value, 0) ?? null,
    checkReduction = success && !diving ? Math.max(0, Math.floor(result / 4)) : 0;
  return {
    version: 1,
    actualDistanceFeet: proof.actualDistanceFeet,
    damageDistanceFeet: proof.damageDistanceFeet,
    surface,
    diving,
    ...(diving ? { waterDepthFeet } : {}),
    result,
    dc,
    succeeded: success,
    diceCount: count,
    armorPiercing: Math.floor(proof.actualDistanceFeet / 10),
    kind,
    dice,
    adjustedDice,
    checkReduction,
    impact: total === null ? null : Math.max(count, total - checkReduction),
    stress: kind === "lethal" ? fallingStress(Math.floor(proof.actualDistanceFeet), count) : 0,
    sprawled: !success
  };
}
