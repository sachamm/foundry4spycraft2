import { attributeCollapsePlan, conditionRollPenalties } from "./attributes.mjs";

/** Shared current movement projection. Saved Speed and scores remain the source values. */
export function derivedMovementPlan(system, ordinarySpeed) {
  const collapse = system.attributeCollapse ?? attributeCollapsePlan(system),
    condition = system.conditionPenalties ?? conditionRollPenalties(system),
    manual = system.conditionContext ?? {},
    fatigue = system.mentalLeapState ?? {},
    immobile = system.encumbrance?.immobile === true,
    incapacitatedForMovement =
      collapse.immobile ||
      fatigue.unconscious === true ||
      ["dead", "dazed", "stunned", "paralyzed", "bound", "sleeping", "held", "pinned"].some(
        key => manual[key] === true
      ),
    speedHalves =
      Number(fatigue.exhausted === true) +
      Number(condition.entangled) +
      Number(manual.blinded === true) +
      Number(manual.crouched === true),
    conditionSpeedReview = speedHalves > 1 && !immobile && !incapacitatedForMovement,
    standingMove = !incapacitatedForMovement && !immobile && !condition.prone && !condition.sprawled;
  return {
    incapacitatedForMovement,
    conditionSpeedReview,
    speed:
      immobile || incapacitatedForMovement
        ? 0
        : conditionSpeedReview
          ? null
          : Math.floor(ordinarySpeed * (speedHalves ? 0.5 : 1)),
    canRun: fatigue.canRun !== false && standingMove && !condition.entangled,
    postureMovement: {
      prone: condition.prone,
      sprawled: condition.sprawled,
      standardMove: standingMove,
      bullRush: standingMove,
      withdraw: standingMove,
      bonusStep: !incapacitatedForMovement && !immobile && !condition.sprawled
    }
  };
}
