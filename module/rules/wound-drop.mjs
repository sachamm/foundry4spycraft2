/**
 * Feats that trigger when one of the character's attacks takes an opponent to 0 wound points or below. The owner (or
 * GC) confirms the drop from the hit's card; `system.woundDrops` counts them for the current combat.
 * - Stone Cold (p.205): +1 on Intimidate checks per drop until the combat ends (maximum +4).
 * - Glint of Madness (p.204): at once, a Threaten action as a free action. Its successful Threatens also add the
 *   Charisma modifier (if positive) to the stress damage, stated on the Threaten card.
 */
import { rollPipeline, skillPlanTerm } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

export const woundDropFeat = system =>
  ["Stone Cold", "Glint of Madness"].some(f => system?.activeFeatNames?.includes(f));

export const woundDropEligible = (system, check) =>
  woundDropFeat(system) &&
  check?.checkKind === "attack" &&
  check.resolved === true &&
  check.successConfirmed === true &&
  !check.superseded &&
  !check.woundDrop &&
  !!check.rollCombat?.id;

/** The count after one more confirmed drop in this combat. */
export function woundDropRecord(system, combatId) {
  const r = system?.woundDrops;
  return { version: 1, combatId, count: r?.combatId === combatId ? (r.count ?? 0) + 1 : 1 };
}

export function stoneColdIntimidateBonus(system) {
  const r = system?.woundDrops;
  if (!system?.activeFeatNames?.includes("Stone Cold") || !r || r.combatId !== system.currentCombatId) return 0;
  return Math.min(4, Math.max(0, r.count ?? 0));
}

rollPipeline.register({
  id: "stoneColdIntimidateTerm",
  kinds: ["skill"],
  order: 9239,
  terms({ system, skillKey }) {
    const bonus = skillKey === "intimidate" ? stoneColdIntimidateBonus(system) : 0;
    return skillPlanTerm(
      "stoneColdDrops",
      bonus
        ? {
            evidence: { version: 1, source: "Stone Cold", bonus },
            bonuses: [{ source: "Stone Cold (opponents dropped)", value: bonus }],
            notes: [loc`Stone Cold: +${bonus} for opponents your attacks dropped this combat (maximum +4) (p.205).`]
          }
        : { evidence: null, bonuses: [], notes: [] },
      { noteAt: 49, bonusAt: 125 }
    );
  }
});
