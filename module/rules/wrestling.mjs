/**
 * Wrestling Basics, p.189.
 *
 * - +1 to Defense against adjacent opponents (the Incoming attack preview’s “adjacent” declaration).
 * - Open Stance: once per round, when an opponent within Reach misses the character, they may pull that opponent
 *   into their square and at once make a Grapple or Trip action against them as a free action. No Run actions in
 *   the stance. The miss card offers the reaction to the GC; the Grapple or Trip is resolved normally.
 * - Brush: an unarmed Standard Attack whose hit deals 1d6 subdual damage instead of standard damage, and lowers the
 *   target’s Initiative Count by the subdual damage dealt.
 */
import { combatStanceState } from "./combat-stance.mjs";
import { unarmedWeapon } from "./kick.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

export const wrestlingDefense = (system, { adjacent = false, ranged = false } = {}) =>
  adjacent === true && !ranged && system?.activeFeatNames?.includes("Wrestling Basics") ? 1 : 0;

export const inOpenStance = system => combatStanceState(system ?? {})?.key === "open";

export function openStanceSpec(system) {
  return system?.activeFeatNames?.includes("Wrestling Basics")
    ? {
        id: "openStance",
        name: loc`Open Stance: pull a missing opponent in and Grapple or Trip`,
        period: "round",
        limit: 1,
        workflow: "openStance",
        combatScoped: true,
        manualReviewable: true,
        hidden: true
      }
    : null;
}

export function brushPlan(system, weapon, { brush = false, attackAction = "standard" } = {}) {
  if (brush !== true) return null;
  if (!system?.activeFeatNames?.includes("Wrestling Basics"))
    return { blocked: true, reason: loc`Brush needs Wrestling Basics.` };
  if (!unarmedWeapon(weapon) || attackAction !== "standard")
    return { blocked: true, reason: loc`Brush is made with an unarmed Standard Attack.` };
  return {
    blocked: false,
    version: 1,
    note: loc`Brush: a hit deals 1d6 subdual damage instead of standard damage and lowers the target’s Initiative Count by that much; roll it from this card (p.189).`
  };
}

rollPipeline.register({
  id: "brushContent:attack",
  dialogs: ["attack"],
  order: 72,
  dialog: ({ item, actor }) => [
    {
      at: 62,
      html:
        unarmedWeapon(item?.system) && actor?.system?.activeFeatNames?.includes("Wrestling Basics")
          ? `<label><input type="checkbox" name="brush" /> ${loc`Brush: unarmed Standard Attack for 1d6 subdual that lowers the target’s Initiative Count (p.189)`}</label>`
          : ""
    }
  ],
  read: ({ entered }) => (entered?.brush === true ? { brush: true, attackAction: "standard" } : null)
});

rollPipeline.register({
  id: "wrestlingAttackTerm",
  kinds: ["attack"],
  order: 9182,
  terms({ system, weapon, options }) {
    const plan = brushPlan(system, weapon, {
      brush: options.brush === true,
      attackAction: options.attackAction ?? "standard"
    });
    return {
      key: "brush",
      plan: plan && !plan.blocked ? plan : null,
      blockAt: 199,
      blocked: plan?.blocked ? plan.reason : "",
      noteAt: 499,
      notes: plan && !plan.blocked ? [plan.note] : []
    };
  }
});
