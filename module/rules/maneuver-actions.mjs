import { validOwnCountClock } from "./own-count-duration.mjs";
export const MANEUVER_SKILLS = ["acrobatics", "athletics", "drive", "survival", "tactics"];
export function oneHandManeuverSource(system) {
  return system.activeFeatNames?.includes("One Hand on the Wheel")
    ? {
        limit: (system.activeFeatSelections ?? []).filter(f => f.tree === "chase").length,
        scene: String(system.usagePeriods?.scene ?? "initial")
      }
    : null;
}
/** p.193: convert one otherwise legal Maneuver to a free action; do not grant a new conflict strategy. */
export function oneHandManeuverPlan(
  system,
  key,
  check,
  {
    wheelFreeManeuver = false,
    wheelFreeActionConfirmed = false,
    maneuverCombat = null,
    timingReduction = "auto",
    tenSecondSolution = false
  } = {}
) {
  const reject = blockedReason => ({
    selected: wheelFreeManeuver === true,
    blockedReason,
    evidence: null,
    timeChoice: null,
    notes: ""
  });
  if (typeof wheelFreeManeuver !== "boolean")
    return reject("Choose whether to use the One Hand on the Wheel free Maneuver.");
  if (!wheelFreeManeuver) return { selected: false, blockedReason: "", evidence: null, timeChoice: null, notes: "" };
  const source = oneHandManeuverSource(system);
  if (!source || source.limit < 1)
    return reject("An active One Hand on the Wheel feat and Chase feat allowance are required.");
  if (check.id !== "maneuver" || !MANEUVER_SKILLS.includes(key))
    return reject("One Hand on the Wheel converts only a named Maneuver check.");
  if (wheelFreeActionConfirmed !== true)
    return reject("Confirm this is a legal Maneuver and a free action you may take now.");
  if (
    maneuverCombat !== null &&
    (!validOwnCountClock(maneuverCombat) || maneuverCombat.turn !== maneuverCombat.ownTurnIndex)
  )
    return reject("Take this free Maneuver during this character’s Initiative Count in a started combat.");
  if (
    maneuverCombat &&
    system.refreshAction?.state === "waiting" &&
    system.refreshAction.combatId === maneuverCombat.id &&
    system.refreshAction.startRound === maneuverCombat.round
  )
    return reject("Refresh forfeited this round’s chance to act.");
  if (tenSecondSolution || !["auto", "oneHandManeuver"].includes(timingReduction))
    return reject(
      "Choose the free Maneuver as the single time reduction; it cannot be combined with another selected timing option."
    );
  return {
    selected: true,
    blockedReason: "",
    evidence: {
      scene: source.scene,
      limit: source.limit,
      clock: maneuverCombat ? structuredClone(maneuverCombat) : null
    },
    timeChoice: {
      id: "oneHandManeuver",
      name: "One Hand on the Wheel",
      multiplier: 0,
      minimum: 0,
      rounding: null,
      automatic: false
    },
    notes: "One Hand on the Wheel: this legal Maneuver is a free action; one scene use is spent (p.193)."
  };
}
/** Lazily capture after all class/feat reservations, including declared-natural-20 wrappers. */
export function oneHandManeuverUseProof(system, evidence, previous = null) {
  const use = system.resourceUses?.oneHandManeuver;
  if (
    !use ||
    use.epoch !== evidence.scene ||
    !Number.isSafeInteger(use.used) ||
    use.used < 1 ||
    use.used > evidence.limit ||
    (previous && JSON.stringify(previous) !== JSON.stringify(use))
  )
    throw new Error("The reserved free Maneuver use changed before posting.");
  return structuredClone(use);
}
