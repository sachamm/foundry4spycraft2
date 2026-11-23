import { loc } from "../i18n.mjs";
import { stable } from "./equal.mjs";
/** Accurized (ACC), p.301. Actual training and a currently valid aimed attack
 * are established by the enclosing weapon/action controller, not by feat names.
 */
export function accurizedAttackPlan(weapon, { trained = false, aimed = false } = {}) {
  if (typeof trained !== "boolean" || typeof aimed !== "boolean")
    throw Error(loc`Review the actual weapon proficiency and currently valid Aim before applying Accurized.`);
  const qualities = weapon?.qualities ?? "";
  if (typeof qualities !== "string") throw Error(loc`Review the actual weapon qualities before applying Accurized.`);
  const accurized = /\bACC\b/.test(qualities);
  if (accurized && /\b(?:INA|IMP)\b/.test(qualities))
    throw Error(
      loc`Review mutually exclusive Accurized and Inaccurate/Imprecise qualities: gaining the opposing quality loses both (p.301).`
    );
  return { version: 1, accurized, trained, aimed, threatIncrease: accurized && trained && aimed ? 1 : 0 };
}
export function validateAccurizedProof(weapon, proof, { checkKind, trained = false, aimed = false } = {}) {
  if (!proof) return;
  if (checkKind !== "attack" || stable(accurizedAttackPlan(weapon, { trained, aimed })) !== stable(proof))
    throw Error(loc`The Accurized weapon quality, actual proficiency or valid Aim changed before posting.`);
}
