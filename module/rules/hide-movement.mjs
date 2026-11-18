import { stanceMovementRoutePlan } from "./stance-movement.mjs";
import { combatStanceState } from "./combat-stance.mjs";
import { attributeActionBlock } from "./attributes.mjs";
import { restraintActionBlock } from "./restraints.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
const GHOST = ["Ghost Basics", "Ghost Mastery", "Ghost Supremacy"];
const same = (a, b) =>
  JSON.stringify(a, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x
  ) ===
  JSON.stringify(b, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x
  );
/** Ground movement included in Sneak/Hide, pp.119,161,195. Other movement rows remain separate. */
export function hideMovementPlan(
  system,
  key,
  check,
  {
    method = "roll",
    hideMovement = false,
    hideDistanceFeet = 0,
    hideMovementMode = "ground",
    hideRouteConfirmed = false,
    hideActionConfirmed = false,
    hideAdjacentThreat = false,
    hidePassesThreat = false,
    stanceDistanceFeet = null,
    stanceCombat = null
  } = {}
) {
  const empty = { evidence: null, penalty: 0, errorIncrease: 0, blockedReason: "", notes: [] },
    reject = blockedReason => ({ ...empty, blockedReason });
  if (hideMovement === false) return empty;
  if (hideMovement !== true || key !== "sneak" || check?.id !== "hide" || method !== "roll")
    return reject("Declare included ground movement only for a rolled Sneak/Hide check.");
  if (hideMovementMode !== "ground")
    return reject(
      "This Hide movement entry covers ordinary ground travel; balancing, climbing, swimming and entering/leaving water require their own movement rows."
    );
  if (
    hideRouteConfirmed !== true ||
    hideActionConfirmed !== true ||
    typeof hideAdjacentThreat !== "boolean" ||
    typeof hidePassesThreat !== "boolean"
  )
    return reject(
      "Confirm the legal Hide action and actual ground route, counted distance, terrain costs and threatening opponents with the GC."
    );
  const speed = system.speed;
  if (!Number.isFinite(speed) || speed < 0 || system.conditionSpeedReview)
    return reject("Resolve the character’s actual current Speed before declaring Hide movement.");
  if (!Number.isFinite(hideDistanceFeet) || hideDistanceFeet < 0)
    return reject("Enter a nonnegative counted Hide movement distance in feet.");
  const sources = GHOST.filter(name => system.activeFeatNames?.includes(name)),
    basic = sources.includes("Ghost Basics"),
    mastery = sources.includes("Ghost Mastery"),
    supremacy = sources.includes("Ghost Supremacy"),
    maximumFeet = speed * (basic ? 2 : 1),
    halfSpeedMaximumFeet = Math.floor(speed / 2);
  if (!Number.isFinite(maximumFeet)) return reject("Review the maximum Hide movement distance.");
  if (hideDistanceFeet > maximumFeet)
    return reject(`The declared Hide movement exceeds the actual ${maximumFeet} ft. included allowance.`);
  if (hideDistanceFeet > 0) {
    const block = restraintActionBlock(system) || attributeActionBlock(system, { kind: "skill", ability: "dex" });
    if (block) return reject(block);
    if (
      system.wounds?.value < 0 ||
      system.postureMovement?.standardMove === false ||
      system.incapacitatedForMovement === true ||
      system.encumbrance?.immobile === true
    )
      return reject("The current condition or posture prevents this ground movement.");
    if (hideAdjacentThreat || hidePassesThreat)
      return reject(
        "Resolve threatening adjacency with Withdraw or an actual movement exception separately before declaring this Hide route."
      );
  }
  let stanceMovement;
  try {
    stanceMovement = stanceMovementRoutePlan(system, {
      combat: stanceCombat,
      distanceFeet: hideDistanceFeet === 0 ? 0 : stanceDistanceFeet
    });
  } catch (error) {
    return reject(error.message);
  }
  if (stanceMovement && hideDistanceFeet > 0 && stanceDistanceFeet <= 0)
    return reject("A moving Hide route must add a positive distance toward the stance limit.");
  const pace = hideDistanceFeet <= halfSpeedMaximumFeet ? "half" : hideDistanceFeet <= speed ? "full" : "faster";
  const penalty = pace === "half" ? 0 : pace === "full" ? (basic ? 0 : -4) : supremacy ? 0 : mastery ? -4 : -8;
  // User ruling: Ghost Basics waives the check penalty, retaining the separate +1 error increase.
  const errorIncrease = pace === "half" ? 0 : pace === "full" ? 1 : 3;
  const evidence = {
    ...(stanceMovement ? { stanceMovement } : {}),
    version: 1,
    skillKey: key,
    checkId: check.id,
    method,
    mode: "ground",
    distanceFeet: hideDistanceFeet,
    speed,
    maximumFeet,
    halfSpeedMaximumFeet,
    pace,
    sources,
    penalty,
    errorIncrease,
    routeConfirmed: true,
    actionConfirmed: true,
    adjacentThreat: hideAdjacentThreat,
    passesThreat: hidePassesThreat
  };
  return {
    evidence,
    penalty,
    errorIncrease,
    blockedReason: "",
    notes: [
      ...(stanceMovement
        ? [
            `Combat stance: this route adds ${stanceMovement.distanceFeet} ft. to ${stanceMovement.priorFeet} ft. already moved, total ${stanceMovement.totalFeet}/${stanceMovement.maximumRoundFeet} ft. this round. Record completed movement after the action.`
          ]
        : []),
      `Hide ground movement: ${hideDistanceFeet} / ${maximumFeet} counted ft.; current Speed ${speed} ft., half-Speed threshold ${halfSpeedMaximumFeet} ft.; check ${penalty}, error range +${errorIncrease} before normal reductions${pace === "full" && basic ? " (Ghost Basics waives only the check penalty)" : pace === "faster" && supremacy ? " (Ghost Supremacy)" : pace === "faster" && mastery ? " (Ghost Mastery)" : ""}. Resolve the actual action, movement and observers at the table.`
    ]
  };
}
export function validateHideMovementProof(
  system,
  proof,
  { checkKind, skillKey, checkId, checkMethod = "roll", actor, rerollOf, stanceCombat = null } = {}
) {
  if (!proof) return;
  let comparison = proof,
    validationSystem = system;
  if (rerollOf && (proof.stanceMovement || ["side", "stalking"].includes(combatStanceState(system)?.key))) {
    const origin =
        globalThis.fromUuidSync?.(rerollOf) ??
        [...(globalThis.game?.messages ?? [])].find(m => m.uuid === rerollOf || m.id === rerollOf),
      c = origin?.flags?.spycraft2;
    if (
      !actor ||
      c?.actorUuid !== actor.uuid ||
      c.checkKind !== "skill" ||
      c.resolved ||
      c.superseded ||
      !same(c.hideMovement, proof)
    )
      throw Error("Use the original owned Hide movement check for this replacement.");
    comparison = structuredClone(proof);
    delete comparison.stanceMovement;
    validationSystem = { ...system, combatStance: null };
  }
  const p = hideMovementPlan(
    validationSystem,
    skillKey,
    { id: checkId },
    {
      method: checkMethod,
      hideMovement: true,
      hideDistanceFeet: proof.distanceFeet,
      hideMovementMode: proof.mode,
      hideRouteConfirmed: proof.routeConfirmed,
      hideActionConfirmed: proof.actionConfirmed,
      hideAdjacentThreat: proof.adjacentThreat,
      hidePassesThreat: proof.passesThreat,
      stanceDistanceFeet: proof.stanceMovement?.distanceFeet ?? null,
      stanceCombat
    }
  );
  if (
    checkKind !== "skill" ||
    proof.skillKey !== skillKey ||
    proof.checkId !== checkId ||
    proof.method !== checkMethod ||
    p.blockedReason ||
    !same(p.evidence, comparison)
  )
    throw new Error(
      p.blockedReason || "The Hide route, current Speed, Ghost source or movement modifiers changed before posting."
    );
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "hideMovement",
  order: 1540,
  record: ["hideMovement"],
  validate: ({ actor, options, checkKind, checkId, checkMethod, skillKey }) =>
    validateHideMovementProof(actor.system, options.hideMovement, {
      checkKind,
      skillKey,
      checkId,
      checkMethod,
      actor,
      rerollOf: options.rerollOf,
      stanceCombat: actor.mentalLeapCombatContext()
    })
});
