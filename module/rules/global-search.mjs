/** Sleuth Global Search, p.46. The GC supplies the target's location; this computes the legal search effort. */
export function globalSearchSource(system) {
  const level = system.classLevels?.sleuth ?? 0;
  return level >= 10 ? { level, limit: level >= 20 ? 2 : 1, hoursPerLevel: level >= 20 ? 4 : 8 } : null;
}
export function globalSearchPlan(
  system,
  { target = "", targetLevel, hoursCompleted, specialCharacterConfirmed = false, onlyFreeActionsConfirmed = false } = {}
) {
  const source = globalSearchSource(system);
  if (!source) throw new Error("Global Search requires earned Sleuth level 10.");
  const level =
      ["number", "string"].includes(typeof targetLevel) && String(targetLevel).trim() ? Number(targetLevel) : NaN,
    hours =
      ["number", "string"].includes(typeof hoursCompleted) && String(hoursCompleted).trim()
        ? Number(hoursCompleted)
        : NaN;
  if (!String(target).trim() || specialCharacterConfirmed !== true || !Number.isSafeInteger(level) || level < 1)
    throw new Error("Name the special character and confirm the GC-supplied positive whole target level.");
  const requiredHours = level * source.hoursPerLevel;
  if (
    !Number.isSafeInteger(requiredHours) ||
    !Number.isFinite(hours) ||
    hours < requiredHours ||
    onlyFreeActionsConfirmed !== true
  )
    throw new Error(`Complete ${requiredHours} hours of search, taking no other non-free actions.`);
  return {
    target: String(target).trim(),
    targetLevel: level,
    requiredHours,
    hoursCompleted: hours,
    hoursPerLevel: source.hoursPerLevel,
    locationScope: "City or 20-mile × 20-mile area",
    onlyFreeActionsConfirmed: true
  };
}
