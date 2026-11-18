/** Unnerving, p.451. Additional stress requires damage actually inflicted by an unarmed/melee attack. */
export function unnervingGrade(system) {
  return Math.min(3, (system.originEffects ?? []).filter(effect => effect.qualityKey === "unnerving").length);
}
export function unnervingEligible(system, check) {
  return (
    unnervingGrade(system) > 0 &&
    check?.unnervingAvailableGrade === unnervingGrade(system) &&
    Number.isFinite(check.rawTotal) &&
    check.checkKind === "damage" &&
    !check.unnervingStress &&
    !check.unnerving &&
    !check.superseded &&
    (check.unarmed === true ||
      ["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged"].includes(check.weaponProficiency))
  );
}
export function unnervingPlan(system, check, { target = "", damageInflictedConfirmed = false } = {}) {
  if (!unnervingEligible(system, check))
    throw new Error("Unnerving requires an unspent unarmed/melee damage record and a currently selected quality.");
  if (typeof target !== "string" || !target.trim() || damageInflictedConfirmed !== true)
    throw new Error(
      "Name the target and confirm this attack actually inflicted at least one point of damage after defenses."
    );
  const grade = check.unnervingAvailableGrade;
  return { grade, formula: `${grade}d4`, damageType: "stress", target: target.trim(), damageInflictedConfirmed: true };
}
