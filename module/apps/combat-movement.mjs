import { refuse } from "../error-notices.mjs";
import { stanceMovementSummary, stanceMovementSystem } from "./stance-movement.mjs";
import { combatMovementPlan, combatMovementRules } from "../rules/combat-movement.mjs";
import { loc } from "../i18n.mjs";
import { currentCampaignRules } from "../rules/gc/campaign.mjs";
import { campaignFallingDamageDivisor } from "../rules/campaign-combat.mjs";
import { trackFall } from "./falling-time.mjs";
export async function checkCombatMovement(actor, input = {}) {
  if (actor.type !== "agent" || !actor.isOwner) return null;
  const wireFu = campaignFallingDamageDivisor(actor, currentCampaignRules().effects) === 2;
  const wireFields = wireFu
    ? `<p>${loc`Wire Fu is active: this character can move through the air or along vertical surfaces.`}</p><label>${loc`Route direction`} <select name="routeDirection"><option value="ground">${loc`Ground`}</option><option value="air">${loc`Through the air`}</option><option value="vertical">${loc`Along a vertical surface`}</option></select></label><label><input name="endsOnStableSurface" type="checkbox" checked /> ${loc`The movement ends on a stable surface`}</label>`
    : "";
  const rules = combatMovementRules(actor.system),
    stance = stanceMovementSummary(actor);
  if (!Object.hasOwn(input, "action"))
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Check combat movement` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options">${wireFields}<p>${loc`Check a declared route against current Speed and movement feats. This does not move a token or take the action.`}</p><label>${loc`Action`} <select name="action"><option value="standardMove">${loc`Standard Move`}</option><option value="run">${loc`Run`}</option><option value="totalDefense">${loc`Total Defense`}</option></select></label><label>${loc`Counted distance, including diagonal/terrain costs (ft.)`} <input name="distanceFeet" type="number" min="0" step="any" value="0" /></label>${stance.cappedActive ? `<label>${loc`Distance this route adds toward ${stance.stanceName}’s round limit (ft.)`} <input name="stanceDistanceFeet" type="number" min="0" max="${stance.remainingFeet}" step="any" required /></label><p>${loc`Already moved ${stance.feet} /${stance.limitFeet} ft. this round; ${stance.remainingFeet} ft. remains. Enter distance toward the stance limit separately from terrain/diagonal movement costs above.`}</p>` : ""}<label>${loc`Run turns in degrees, comma separated`} <input name="turnDegrees" placeholder="90, 45" /></label><label><input name="adjacentThreateningOpponent" type="checkbox" /> ${loc`Starting adjacent to a threatening opponent`}</label><label><input name="passesThreateningAdjacency" type="checkbox" /> ${loc`The route continues after entering adjacency with a threatening opponent`}</label><label><input name="routeConfirmed" type="checkbox" /> ${loc`The GC confirms the route, counted distance, terrain and threatening opponents`}</label><p>${loc`Current Standard Move ${rules.standardMoveFeet ?? "unresolved"} ft.; Total Defense movement ${rules.totalDefenseMoveFeet ?? "unresolved"} ft.; Run ${rules.runFeet ?? "unresolved"} ft. Run turns: ${rules.maximumRunTurns}, at most ${rules.maximumRunTurnDegrees}° each.`}</p></div>`
    });
  if (!input) return null;
  if (!actor.isOwner) throw new Error(loc`You must own the character.`);
  if (wireFu !== (campaignFallingDamageDivisor(actor, currentCampaignRules().effects) === 2))
    throw Error(loc`The Wire Fu campaign quality changed. Review the movement route again.`);
  const distanceFeet =
    typeof input.distanceFeet === "string" && input.distanceFeet.trim()
      ? Number(input.distanceFeet)
      : input.distanceFeet;
  const text = String(input.turnDegrees ?? "").trim(),
    turnDegrees = text ? text.split(",").map(x => (x.trim() ? Number(x) : NaN)) : [];
  let plan;
  try {
    plan = combatMovementPlan(stanceMovementSystem(actor), {
      stanceCombat: actor.mentalLeapCombatContext?.() ?? null,
      stanceDistanceFeet:
        typeof input.stanceDistanceFeet === "string" && input.stanceDistanceFeet.trim()
          ? Number(input.stanceDistanceFeet)
          : input.stanceDistanceFeet,
      action: input.action,
      distanceFeet,
      turnDegrees,
      adjacentThreateningOpponent: input.adjacentThreateningOpponent === true,
      passesThreateningAdjacency: input.passesThreateningAdjacency === true,
      routeConfirmed: input.routeConfirmed === true,
      wireFu,
      routeDirection: input.routeDirection ?? "ground",
      endsOnStableSurface: wireFu ? input.endsOnStableSurface !== false : true
    });
  } catch (error) {
    return refuse(error.message);
  }
  const esc = foundry.utils.escapeHTML;
  const completed = await foundry.applications.api.DialogV2.input({
    window: { title: loc`Combat movement — result` },
    rejectClose: false,
    content: `<div class="spycraft2-roll-options"><p>${loc`${esc({ standardMove: "Standard Move", run: "Run", totalDefense: "Total Defense" }[plan.action])}: ${plan.distanceFeet} / ${plan.maximumFeet} counted ft.; ${plan.actionCost}; error range increase +${plan.errorIncrease}.`}</p><p>${loc`Becomes flat-footed from this Run: ${plan.becomesFlatFooted ? "yes" : "no"}. Dodge bonus from this action: +${plan.dodgeBonus}.`}</p>${plan.notes.map(n => `<p>${esc(n)}</p>`).join("")}${plan.startsFall ? `<label><input name="trackFallAfterMovement" type="checkbox" /> ${loc`The movement is finished; record the fall now`}</label>` : ""}</div>`
  });
  if (plan.startsFall && completed?.trackFallAfterMovement === true) await trackFall(actor);
  return plan;
}
