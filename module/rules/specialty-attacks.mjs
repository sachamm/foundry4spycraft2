/**
 * Specialty attack bonuses (p.25): Serviceman with Suppressive Fire, Soldier of Fortune with Autofire and Warrior with
 * Pummel. Each is +1, rising by 1 at Career Levels 5, 10, 15 and 20.
 */
const SPECIALTY_ACTIONS = Object.freeze({
  Serviceman: "suppressiveFire",
  "Soldier of Fortune": "autofire",
  Warrior: "pummel"
});

/** The attack bonus a specialty gives an attack made as part of `action`, or 0. */
export function specialtyAttackBonus(system, action) {
  const specialty = system?.specialtyName ?? "";
  if (!action || SPECIALTY_ACTIONS[specialty] !== action) return 0;
  const level = Number.isSafeInteger(system.level) ? system.level : 0;
  return 1 + Math.min(4, Math.floor(level / 5));
}

/** Which specialty action an attack is part of: the declared fire action, or a Pummel. */
export function specialtyAttackAction(fireAction, pummel) {
  if (pummel) return "pummel";
  if (fireAction === "autofire") return "autofire";
  // The attack checks of a Suppressive Fire action are the final attacks on whoever crosses the area (p.361).
  if (fireAction === "suppressiveFinal") return "suppressiveFire";
  return "";
}
