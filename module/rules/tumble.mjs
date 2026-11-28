import { attributeActionBlock } from "./attributes.mjs";
import { restraintActionBlock } from "./restraints.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
import { stable } from "./equal.mjs";
/** Tumble and Table2.13 p.109; Equilibrium Mastery p.194. Plans one rolled half action. */
export function tumblePathPlan(
  system,
  key,
  check,
  {
    method = "roll",
    tumbleCircumstances = false,
    tumbleDistanceFeet = 0,
    tumbleAdjacentEnemySquares = 0,
    tumbleOccupiedSquares = 0,
    tumbleRouteConfirmed = false
  } = {}
) {
  const empty = { evidence: null, dc: null, errorIncrease: 0, blockedReason: "", notes: [] },
    reject = blockedReason => ({ ...empty, blockedReason });
  if (tumbleCircumstances === false) return empty;
  if (tumbleCircumstances !== true || key !== "acrobatics" || check?.id !== "tumble")
    return reject(loc`Declare this movement path only for Acrobatics/Tumble.`);
  if (method !== "roll")
    return reject(loc`Use a rolled Tumble check for this path; this entry does not grant taking 10/20 (p.109).`);
  if (
    tumbleRouteConfirmed !== true ||
    typeof tumbleDistanceFeet !== "number" ||
    !Number.isFinite(tumbleDistanceFeet) ||
    tumbleDistanceFeet < 0 ||
    ![tumbleAdjacentEnemySquares, tumbleOccupiedSquares].every(n => Number.isSafeInteger(n) && n >= 0) ||
    tumbleAdjacentEnemySquares + tumbleOccupiedSquares === 0
  )
    return reject(
      loc`The GC must confirm counted movement, actual enemy-occupied squares adjacent to/in the path (including suppressive-fire squares) and an otherwise legal half action ending in an unoccupied square.`
    );
  if (!Array.isArray(system?.activeFeatNames) || system.activeFeatNames.some(n => typeof n !== "string" || !n.trim()))
    return reject(loc`Review the current qualified Tumble feat sources.`);
  const speed = system.speed;
  if (!Number.isFinite(speed) || speed < 0 || system.conditionSpeedReview)
    return reject(loc`Review the character’s actual current Speed before Tumble movement.`);
  if (system.conditionContext?.entangled || system.conditionContext?.bound)
    return reject(loc`Entangled/Bound prevents Tumble checks (p.341).`);
  const incapacity = restraintActionBlock(system) || attributeActionBlock(system, { kind: "skill", ability: "dex" });
  if (incapacity || system.incapacitatedForMovement === true || system.wounds?.value < 0)
    return reject(incapacity || loc`This character cannot make this Tumble movement now.`);
  const sources = system.activeFeatNames.includes("Equilibrium Mastery") ? ["Equilibrium Mastery"] : [],
    normalMaximumFeet = sources.length ? speed : Math.max(0, speed - 10),
    threatMaximumFeet = Math.max(normalMaximumFeet, Math.max(0, speed - 5)),
    criticalMaximumFeet = speed;
  if (tumbleDistanceFeet > normalMaximumFeet)
    return reject(
      loc`The declared Tumble distance exceeds the current ${normalMaximumFeet} ft. ordinary allowance; unconfirmed threat/critical outcomes do not grant extra movement in advance.`
    );
  const baseDC = tumbleOccupiedSquares ? 25 : 15,
    adjacentExtra = Math.max(0, tumbleAdjacentEnemySquares - 1),
    occupiedExtra = Math.max(0, tumbleOccupiedSquares - 1),
    adjacentDC = 5 * adjacentExtra,
    occupiedDC = 5 * occupiedExtra,
    dc = baseDC + adjacentDC + occupiedDC,
    errorIncrease = (tumbleOccupiedSquares ? 1 : 0) + Math.min(4, occupiedExtra);
  if (!Number.isSafeInteger(dc))
    return reject(loc`Review the path counts; its calculated Tumble DC exceeds supported exact integer arithmetic.`);
  const evidence = {
    version: 1,
    skillKey: key,
    checkId: check.id,
    method,
    distanceFeet: tumbleDistanceFeet,
    speed,
    normalMaximumFeet,
    threatMaximumFeet,
    criticalMaximumFeet,
    adjacentEnemySquares: tumbleAdjacentEnemySquares,
    occupiedSquares: tumbleOccupiedSquares,
    routeConfirmed: true,
    baseDC,
    adjacentDC,
    occupiedDC,
    dc,
    errorIncrease,
    sources
  };
  return {
    ...empty,
    evidence,
    dc,
    errorIncrease,
    notes: [
      loc`Tumble: ${tumbleDistanceFeet}/${normalMaximumFeet} counted ft.; DC ${dc} (${baseDC} base +${adjacentDC} additional adjacent squares +${occupiedDC} additional occupied path squares); separate error +${errorIncrease} (Table 2.13, p.109).`,
      ...(sources.length ? [loc`Equilibrium Mastery permits full current Speed instead of Speed−10 (p.194).`] : []),
      loc`Threat/critical movement allowances are ${threatMaximumFeet}/${criticalMaximumFeet} ft. only after their actual outcomes are resolved. Count enemy-occupied squares, not repeated adjacent path segments; enemy suppressive-fire squares count as occupied. The GC resolves token movement, outcomes and any lost Dexterity/sprawled/final attacks separately.`
    ]
  };
}
export function validateTumblePathProof(system, proof, { checkKind, skillKey, checkId, checkMethod = "roll" } = {}) {
  if (!proof) return;
  const p = tumblePathPlan(
    system,
    skillKey,
    { id: checkId },
    {
      method: checkMethod,
      tumbleCircumstances: true,
      tumbleDistanceFeet: proof.distanceFeet,
      tumbleAdjacentEnemySquares: proof.adjacentEnemySquares,
      tumbleOccupiedSquares: proof.occupiedSquares,
      tumbleRouteConfirmed: proof.routeConfirmed
    }
  );
  if (checkKind !== "skill" || p.blockedReason || !p.evidence || stable(p.evidence) !== stable(proof))
    throw Error(
      loc`The Tumble path, current Speed, movement condition or qualified Equilibrium source changed before posting.`
    );
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "tumblePath",
  order: 1440,
  record: ["tumblePath"],
  validate: ({ actor, options, checkKind, checkId, checkMethod, skillKey }) =>
    validateTumblePathProof(actor.system, options.tumblePath, { checkKind, skillKey, checkId, checkMethod })
});
