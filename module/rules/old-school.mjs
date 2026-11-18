/** Old School, p.209: final Charisma basis, one shared class ability OR three shared feats. */
export const oldSchoolEligible = (system, { ability = "", checkKind = "", resultSource = "" } = {}) =>
  system.activeFeatNames?.includes("Old School") === true &&
  ability === "cha" &&
  checkKind !== "damage" &&
  resultSource !== "masterThief";
export function oldSchoolPlan(system, context, input = null) {
  if (input === null || input === false || input === undefined) return null;
  if (!oldSchoolEligible(system, context))
    throw new Error(
      "Old School requires its currently earned feat and a Charisma-based check targeting a character (p.209)."
    );
  const { target, targetLevel, missionThreatLevel, sharedClassAbility = "", sharedFeats = [], confirmed } = input;
  if (confirmed !== true || typeof target !== "string" || !target.trim() || target.length > 200)
    throw new Error("Confirm one named character and the actual shared abilities or feats for Old School.");
  if (
    ![targetLevel, missionThreatLevel].every(n => Number.isSafeInteger(n) && n >= 1) ||
    targetLevel > missionThreatLevel
  )
    throw new Error(
      "Old School requires the target’s Career/Threat Level to be no greater than the mission Threat Level."
    );
  if (
    typeof sharedClassAbility !== "string" ||
    sharedClassAbility.length > 200 ||
    !Array.isArray(sharedFeats) ||
    sharedFeats.some(n => typeof n !== "string" || !n.trim() || n.length > 200)
  )
    throw new Error("Record the shared class ability or the names of at least three shared feats.");
  const names = [...new Set(sharedFeats.map(n => n.trim()))].sort(),
    ability = sharedClassAbility.trim();
  if (!ability && names.length < 3)
    throw new Error("Old School requires at least one shared class ability or three distinct shared feats.");
  if (names.some(n => !system.activeFeatNames?.includes(n)))
    throw new Error("Every recorded shared feat must currently be earned by this character.");
  return {
    version: 1,
    source: "Old School",
    bonus: 4,
    target: target.trim(),
    targetLevel,
    missionThreatLevel,
    sharedClassAbility: ability,
    sharedFeats: names,
    confirmed: true
  };
}
