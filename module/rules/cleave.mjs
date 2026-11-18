import { finesseMeleeWeapon, finesseCriticalEligible } from "./finesse.mjs";
import { validCharacterTarget } from "./character-target.mjs";
import { loc } from "../i18n.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
export function cleaveAttackPlan(system, weapon, target) {
  const active = system.activeFeatNames?.includes("Cleave Mastery") === true && finesseMeleeWeapon(weapon);
  if (!active) return { active: false, threatIncrease: 0 };
  if (target && !validCharacterTarget(target))
    throw new Error(loc`Review the actual character target before applying Cleave Mastery.`);
  return { active: true, threatIncrease: target?.standard === true ? 1 : 0, target: target ?? null };
}
export function cleaveCriticalPlan(system, check, { legacyStandardTargetConfirmed = false } = {}) {
  if (!system.activeFeatNames?.includes("Cleave Supremacy") || !finesseCriticalEligible(check)) return { discount: 0 };
  const t = check.attackContext?.characterTarget;
  if (t && !validCharacterTarget(t))
    return {
      blocked: true,
      reason: loc`Review the recorded character target before activating a Cleave critical hit.`
    };
  return {
    discount: t?.standard === true || (!t && legacyStandardTargetConfirmed === true) ? 1 : 0,
    declared: !t && legacyStandardTargetConfirmed === true
  };
}

export const cleaveLegacyTargetEligible = (system, check) =>
  system.activeFeatNames?.includes("Cleave Supremacy") === true &&
  finesseCriticalEligible(check) &&
  !check.attackContext?.characterTarget;

// Cleave Mastery's part of an attack plan.
rollPipeline.register({
  id: "cleaveAttackTerm",
  kinds: ["attack"],
  order: 9070,
  terms({ system, weapon, options }) {
    const plan = cleaveAttackPlan(system, weapon, options.characterTarget);
    return {
      key: "cleave",
      plan,
      threat: plan.threatIncrease,
      noteAt: 160,
      notes: plan.threatIncrease
        ? [loc`Cleave Mastery: melee threat range +1 against this confirmed standard character (p.177).`]
        : []
    };
  }
});
