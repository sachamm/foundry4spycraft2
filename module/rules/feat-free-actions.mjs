import { validOwnCountClock } from "./own-count-duration.mjs";
import { attributeActionBlock } from "./attributes.mjs";
import { restraintActionBlock } from "./restraints.mjs";
import { loc } from "../i18n.mjs";
import { totalDefenseState } from "./total-defense.mjs";

/**
 * Feats that let an ordinary action be taken as a free (or half) action a set number of times per round. The action
 * itself is resolved at the table; the receipt records the conversion and spends the round use.
 * - Containment Mastery (Diversion or Taunt), Fire-Team Basics (Cover Fire), Fire-Team Mastery (Medicine/Stabilize)
 *   and Tac-Squad Mastery (Suppressive Fire as a half action) need a 2-to-1 or greater advantage (pp.172–175).
 * - Merciless: a Coup de Grace against a helpless character (p.195).
 * - Weather the Storm (Boxing Moves, p.185): twice per round while in Total Defense, a Tire action against an
 *   opponent who attacks, at any Initiative Count.
 */
export const ROUND_ACTION_FEATS = Object.freeze({
  containmentMastery: {
    feat: "Containment Mastery",
    actions: ["Diversion", "Taunt"],
    perRound: 1,
    cost: "free",
    advantage: true
  },
  fireTeamBasics: { feat: "Fire-Team Basics", actions: ["Cover Fire"], perRound: 1, cost: "free", advantage: true },
  fireTeamMastery: {
    feat: "Fire-Team Mastery",
    actions: ["Medicine/Stabilize check"],
    perRound: 1,
    cost: "free",
    advantage: true
  },
  tacSquadMastery: {
    feat: "Tac-Squad Mastery",
    actions: ["Suppressive Fire"],
    perRound: 1,
    cost: "half",
    advantage: true
  },
  merciless: { feat: "Merciless", actions: ["Coup de Grace against a helpless character"], perRound: 1, cost: "free" },
  weatherTheStorm: {
    feat: "Boxing Moves",
    label: "Weather the Storm",
    actions: ["Tire against an attacking opponent"],
    perRound: 2,
    cost: "free",
    totalDefense: true,
    anyCount: true
  }
});
export const FREE_ACTION_FEATS = {
  quickDraw: "Quick Draw",
  surgeOfSpeed: "Surge of Speed",
  ...Object.fromEntries(Object.entries(ROUND_ACTION_FEATS).map(([k, d]) => [k, d.label ?? d.feat]))
};

/** The per-round uses these feats give. */
export function roundActionSpecs(system) {
  return Object.entries(ROUND_ACTION_FEATS)
    .filter(([, d]) => system.activeFeatNames?.includes(d.feat))
    .map(([id, d]) => ({
      id,
      name: loc`${d.label ?? d.feat}: ${d.actions.join(" / ")} as a ${d.cost} action`,
      period: "round",
      limit: d.perRound,
      workflow: "featFreeAction",
      combatScoped: true,
      manualReviewable: true,
      hidden: true,
      roundAction: true
    }));
}

function roundActionPlan(
  system,
  combat,
  source,
  { action = "", description = "", confirmed = false, advantageConfirmed = false } = {}
) {
  const d = ROUND_ACTION_FEATS[source];
  if (!system.activeFeatNames?.includes(d.feat)) throw new Error(loc`${d.feat} has not been earned.`);
  if (!validOwnCountClock(combat) || (!d.anyCount && combat.turn !== combat.ownTurnIndex))
    throw new Error(
      d.anyCount
        ? loc`Use this in a started combat.`
        : loc`Use this free action during this character’s Initiative Count in a started combat.`
    );
  const blocked =
    restraintActionBlock(system, { free: d.cost === "free" }) || attributeActionBlock(system, { kind: "attack" });
  if (blocked) throw new Error(blocked);
  if (!d.actions.includes(action)) throw new Error(loc`Choose one of the actions this feat converts.`);
  if (d.advantage && advantageConfirmed !== true)
    throw new Error(loc`The GC must confirm your side has a 2-to-1 or greater advantage.`);
  if (d.totalDefense && !totalDefenseState(system).active)
    throw new Error(loc`Weather the Storm works while you benefit from Total Defense.`);
  if (confirmed !== true || typeof description !== "string" || !description.trim() || description.length > 1000)
    throw new Error(loc`Describe the actual legal action and confirm its circumstances with the GC.`);
  return {
    version: 1,
    source: d.label ?? d.feat,
    resourceId: source,
    action,
    description: description.trim(),
    actionCost: d.cost,
    combatId: combat.id,
    combatantId: combat.combatantId,
    round: combat.round,
    turn: combat.turn,
    ...(d.advantage ? { advantageConfirmed: true } : {}),
    confirmed: true
  };
}
export const QUICK_DRAW_ACTIONS = {
  draw: "Draw Weapon",
  holster: "Holster Weapon",
  pickUp: "Pick Up Weapon",
  reload: "Reload"
};
/** p.175: convert a confirmed legal action; never silently resolve gear, movement or a skill check. */
export function featFreeActionPlan(
  system,
  combat,
  {
    source = "",
    action = "",
    description = "",
    confirmed = false,
    nonAttackHalfActionConfirmed = false,
    purelyMentalConfirmed = false
  } = {}
) {
  if (Object.hasOwn(ROUND_ACTION_FEATS, source))
    return roundActionPlan(system, combat, source, {
      action,
      description,
      confirmed,
      advantageConfirmed: arguments[2]?.advantageConfirmed
    });
  const name = FREE_ACTION_FEATS[source];
  if (!name || !system.activeFeatNames?.includes(name))
    throw new Error(loc`Choose an earned Quick Draw or Surge of Speed feat.`);
  if (!validOwnCountClock(combat) || combat.turn !== combat.ownTurnIndex)
    throw new Error(loc`Use this free action during this character’s Initiative Count in a started combat.`);
  const mental = source === "surgeOfSpeed" && purelyMentalConfirmed === true;
  const blocked =
    restraintActionBlock(system, { free: true }) ||
    attributeActionBlock(system, { kind: mental ? "mentalAbility" : "skill", ability: mental ? "" : "dex" });
  if (blocked) throw new Error(blocked);
  if (system.conditionContext?.bound === true && source === "quickDraw")
    throw new Error(loc`Bound: weapon handling requires the use of your hands.`);
  if (
    system.refreshAction?.state === "waiting" &&
    system.refreshAction.combatId === combat.id &&
    system.refreshAction.startRound === combat.round
  )
    throw new Error(loc`Refresh forfeited this round’s chance to act.`);
  if (confirmed !== true || typeof description !== "string" || !description.trim() || description.length > 1000)
    throw new Error(loc`Describe the actual legal action and confirm its circumstances with the GC.`);
  if (source === "quickDraw" && !Object.hasOwn(QUICK_DRAW_ACTIONS, action))
    throw new Error(loc`Quick Draw permits only Draw Weapon, Holster Weapon, Pick Up Weapon or Reload.`);
  if (source === "surgeOfSpeed" && (action !== "nonAttackHalfAction" || nonAttackHalfActionConfirmed !== true))
    throw new Error(loc`Surge of Speed requires one non-attack half action.`);
  return {
    version: 1,
    source: name,
    resourceId: source,
    action: source === "quickDraw" ? QUICK_DRAW_ACTIONS[action] : loc`Non-attack half action`,
    description: description.trim(),
    actionCost: "free",
    combatId: combat.id,
    combatantId: combat.combatantId,
    round: combat.round,
    turn: combat.turn,
    nonAttackHalfActionConfirmed: source === "surgeOfSpeed",
    purelyMentalConfirmed: mental,
    confirmed: true
  };
}
