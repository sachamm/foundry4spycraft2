/**
 * Team feats that need a 2-to-1 or greater advantage, which the GC confirms on the roll (pp.172–175).
 *
 * - Horde Basics: the character and teammates gain 1/4 personal cover at 2-to-1 and 1/2 at 3-to-1 (the Incoming
 *   attack preview raises the personal cover grade to that floor).
 * - Horde Supremacy: +2 morale damage on attacks within CQB Range (a damage-roll declaration); an opponent in sight
 *   gains only half of any Initiative Count increase (a reminder on the card).
 * - Tac-Squad Supremacy: opponents within CQB Range and sight count as flanked (a reminder beside the damage roll’s
 *   flanking declaration).
 * Fire-Team Supremacy’s free final attack is in module/apps/team-final-attack.mjs; the round actions of the other team
 * feats are in module/rules/feat-free-actions.mjs.
 */
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

export const HORDE_SUPREMACY_DAMAGE = 2;

/** Horde Basics’ personal cover floor: 1 (one quarter) at 2-to-1, 2 (one half) at 3-to-1 or more. */
export function hordeCoverFloor(advantage) {
  return advantage === "3" ? 2 : advantage === "2" ? 1 : 0;
}

export const hordeSupremacyDamage = (system, weapon) =>
  weapon?.hordeSupremacy === true && system?.activeFeatNames?.includes("Horde Supremacy") ? HORDE_SUPREMACY_DAMAGE : 0;

rollPipeline.register({
  id: "teamFeatContent:damage",
  dialogs: ["damage"],
  order: 34,
  dialog: ({ actor }) => {
    const feats = actor?.system?.activeFeatNames ?? [];
    return [
      {
        at: 48,
        html:
          (feats.includes("Horde Supremacy")
            ? `<label><input type="checkbox" name="hordeSupremacy" /> ${loc`Horde Supremacy: attack within CQB Range with a GC-confirmed 2-to-1 advantage (+2 morale damage; an opponent in sight gains only half of any Initiative Count increase)`}</label>`
            : "") +
          (feats.includes("Tac-Squad Supremacy")
            ? `<p>${loc`Tac-Squad Supremacy: with a 2-to-1 advantage, opponents within your CQB Range and sight count as flanked; tick the flanking declaration when that applies (p.175).`}</p>`
            : "")
      }
    ];
  },
  read: (context, input) => (input?.hordeSupremacy === true ? { hordeSupremacy: true } : null)
});

/** Fire-Team Supremacy, p.174: once per round, 1 final attack as a free action with a 2-to-1 advantage. */
export function fireTeamSupremacyPlan(system, combat, { advantageConfirmed = false, confirmed = false } = {}) {
  if (!system?.activeFeatNames?.includes("Fire-Team Supremacy"))
    throw new Error(loc`Fire-Team Supremacy has not been earned.`);
  if (!combat?.started || typeof combat.id !== "string") throw new Error(loc`Use this in a started combat.`);
  if (advantageConfirmed !== true)
    throw new Error(loc`The GC must confirm your side has a 2-to-1 or greater advantage.`);
  if (confirmed !== true) throw new Error(loc`Confirm this final attack is legal now.`);
  if (system.wounds?.value < 0 || system.mentalLeapState?.unconscious)
    throw new Error(loc`This character cannot take the final attack.`);
  return {
    source: "fireTeamSupremacy",
    combatId: combat.id,
    round: combat.round,
    combatantId: combat.combatantId,
    advantageConfirmed: true,
    attackAction: "standard",
    free: true
  };
}

export const fireTeamSupremacySpec = system =>
  system?.activeFeatNames?.includes("Fire-Team Supremacy")
    ? {
        id: "fireTeamSupremacy",
        name: loc`Fire-Team Supremacy (free final attack)`,
        period: "round",
        limit: 1,
        workflow: "fireTeamSupremacy",
        combatScoped: true,
        manualReviewable: true,
        hidden: true
      }
    : null;
