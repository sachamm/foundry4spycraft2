import { stanceMovementRoutePlan } from "./stance-movement.mjs";
import { combatStanceState } from "./combat-stance.mjs";
import { attributeActionBlock } from "./attributes.mjs";
import { restraintActionBlock } from "./restraints.mjs";
import { loc } from "../i18n.mjs";
/** Movement actions pp.326,348,359,361; Combat Mobility/Mobile Defense pp.172,175. */
export function combatMovementRules(system) {
  const mobility = system.activeFeatNames?.includes("Combat Mobility") === true,
    mobileDefense = system.activeFeatNames?.includes("Mobile Defense") === true;
  const fullArmor = (system.armor?.adjustments ?? []).some(row => row.slot === "body" && row.type === "F");
  const speed = Number.isFinite(system.speed) && system.speed >= 0 ? system.speed : null;
  // Dash, p.192: a Run covers up to Speed × 5 instead of × 4 (full body armor still limits it to × 3).
  const run = fullArmor ? 3 : system.activeFeatNames?.includes("Dash") ? 5 : 4;
  return {
    mobility,
    mobileDefense,
    fullArmor,
    speed,
    standardMoveFeet: speed,
    totalDefenseMoveFeet: speed === null ? null : speed * (mobility ? 2 : 1),
    runMultiplier: run,
    runFeet: speed === null ? null : speed * run,
    maximumRunTurns: mobility ? Math.max(1, system.abilities?.dex?.mod ?? 0) : 0,
    maximumRunTurnDegrees: mobility ? 90 : 0,
    runFlatFooted: !mobileDefense && system.uncannyDodge?.cannotBeFlatFooted !== true
  };
}
export function combatMovementPlan(
  system,
  {
    action = "standardMove",
    distanceFeet,
    turnDegrees = [],
    adjacentThreateningOpponent = false,
    passesThreateningAdjacency = false,
    routeConfirmed = false,
    stanceDistanceFeet = null,
    stanceCombat = null
  } = {}
) {
  if (!["standardMove", "run", "totalDefense"].includes(action))
    throw new Error(loc`Choose Standard Move, Run or Total Defense.`);
  if ([adjacentThreateningOpponent, passesThreateningAdjacency, routeConfirmed].some(v => typeof v !== "boolean"))
    throw new Error(loc`Confirm each movement circumstance.`);
  // Standing still has no route to confirm (Total Defense in place, for one).
  if (routeConfirmed !== true && !(Number(distanceFeet) === 0))
    throw new Error(
      loc`The GC must confirm the route, counted distance, terrain and threatening-opponent circumstances.`
    );
  const block = restraintActionBlock(system) || attributeActionBlock(system, { kind: "skill", ability: "dex" });
  if (block || system.wounds?.value < 0) throw new Error(block || loc`This character cannot take a movement action.`);
  const rules = combatMovementRules(system);
  const stanceKey = combatStanceState(system)?.key;
  if (action === "run" && stanceKey === "open") throw new Error(loc`Open Stance allows no Run actions (p.189).`);
  if (stanceKey === "rooted" && distanceFeet > 0)
    throw new Error(loc`Rooted Stance: you may not leave your current square (p.187).`);
  if (stanceKey === "forward" && distanceFeet > 0)
    throw new Error(loc`Forward Stance: move only with Acrobatics/Jump checks or your bonus 5-ft. step (p.187).`);
  if (rules.speed === null || system.conditionSpeedReview)
    throw new Error(loc`Resolve the character’s current Speed before checking movement.`);
  if (!Number.isFinite(distanceFeet) || distanceFeet < 0)
    throw new Error(loc`Enter a nonnegative counted movement distance in feet.`);
  if (!Array.isArray(turnDegrees) || turnDegrees.some(d => !Number.isFinite(d) || d < 0 || d > 180))
    throw new Error(loc`Enter each actual direction change as an angle from 0 to 180 degrees.`);
  if (adjacentThreateningOpponent && !(action === "standardMove" && rules.mobility))
    throw new Error(
      loc`While adjacent to a threatening opponent, use Withdraw or an actual movement exception (p.326). Combat Mobility permits Standard Move away.`
    );
  if (passesThreateningAdjacency)
    throw new Error(
      loc`Stop upon entering adjacency with a threatening opponent (p.326); Combat Mobility does not remove this stopping rule.`
    );
  if (action === "run" && system.canRun !== true)
    throw new Error(loc`This character cannot Run in the current condition.`);
  if (
    (action === "standardMove" || (distanceFeet > 0 && action === "totalDefense")) &&
    system.postureMovement?.standardMove === false
  )
    throw new Error(loc`The current posture or immobility prevents Standard Move movement.`);
  const stanceMovement = stanceMovementRoutePlan(system, { combat: stanceCombat, distanceFeet: stanceDistanceFeet });
  if (stanceMovement && distanceFeet > 0 && stanceDistanceFeet <= 0)
    throw Error(loc`A moving route must add a positive distance toward the stance limit.`);
  const maximumFeet =
    action === "run" ? rules.runFeet : action === "totalDefense" ? rules.totalDefenseMoveFeet : rules.standardMoveFeet;
  if (distanceFeet > maximumFeet)
    throw new Error(loc`The declared counted distance exceeds this action’s ${maximumFeet} ft. allowance.`);
  const turns = turnDegrees.filter(d => d > 0);
  if (action === "run" && (turns.length > rules.maximumRunTurns || turns.some(d => d > rules.maximumRunTurnDegrees)))
    throw new Error(
      loc`Run permits ` +
        rules.maximumRunTurns +
        loc` direction change(s), each at most ` +
        rules.maximumRunTurnDegrees +
        " degrees."
    );
  return {
    ...rules,
    ...(stanceMovement ? { stanceMovement } : {}),
    action,
    distanceFeet,
    turnDegrees: [...turnDegrees],
    maximumFeet,
    actionCost: action === "standardMove" ? "1 half action" : "1 full action",
    errorIncrease: action === "run" ? 1 : 0,
    becomesFlatFooted: action === "run" && rules.runFlatFooted,
    dodgeBonus: action === "totalDefense" ? 4 : 0,
    routeConfirmed,
    notes: [
      ...(stanceMovement
        ? [
            loc`Combat stance: ${stanceMovement.priorFeet} ft. already moved +${stanceMovement.distanceFeet} ft. for this route =${stanceMovement.totalFeet} /${stanceMovement.maximumRoundFeet} ft. this round. Record the completed round total after moving.`
          ]
        : []),
      loc`Count every other diagonal square as 10 ft.; include terrain and other movement costs in the declared distance (pp.325–326).`,
      loc`Threatening adjacency excludes bound, flat-footed, helpless, hidden, invisible, stunned, unconscious and dead opponents (p.326).`,
      ...(action === "totalDefense"
        ? [
            loc`Total Defense grants +4 dodge Defense for 1 full round and one Standard Move; Combat Mobility doubles only that movement allowance.`
          ]
        : []),
      ...(action === "run"
        ? [loc`Run is a full action with error range +1; full armor reduces its distance multiplier to 3.`]
        : []),
      loc`This checks the declared route and action allowance. Move the token, spend the action and resolve its condition/Defense effects at the table.`
    ]
  };
}
