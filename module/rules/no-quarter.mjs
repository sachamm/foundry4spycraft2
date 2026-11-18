/**
 * No Quarter, p.195: before an attack that inflicts sneak attack damage, the character may give up 1 or more of its
 * sneak attack dice to raise the attack’s threat range by the number given up. The attack records the dice given up;
 * its damage roll (from the card) rolls that many fewer sneak attack dice.
 */
import { sneakAttackSources } from "./sneak-attack.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

/** The most sneak attack dice this weapon could earn, as the ceiling on dice given up. */
export const noQuarterCeiling = (system, weapon) =>
  sneakAttackSources(system, weapon ?? {}, { targetFlanked: true, braced: true }).reduce((n, s) => n + s.dice, 0);

export function noQuarterPlan(system, weapon, { dice = 0 } = {}) {
  if (!dice) return null;
  if (!system?.activeFeatNames?.includes("No Quarter"))
    return { blocked: true, reason: loc`No Quarter has not been earned.` };
  const most = noQuarterCeiling(system, weapon);
  if (!Number.isSafeInteger(dice) || dice < 1 || dice > most)
    return { blocked: true, reason: loc`Give up 1 to ${most} sneak attack dice.` };
  return {
    blocked: false,
    version: 1,
    dice,
    note: loc`No Quarter: ${dice} sneak attack dice given up for threat range +${dice}; roll this hit’s damage from the card (p.195).`
  };
}

rollPipeline.register({
  id: "noQuarterContent:attack",
  dialogs: ["attack"],
  order: 75,
  dialog: ({ actor, item }) => {
    const most = actor?.system?.activeFeatNames?.includes("No Quarter")
      ? noQuarterCeiling(actor.system, item?.system)
      : 0;
    return [
      {
        at: 65,
        html: most
          ? `<label>${loc`No Quarter: sneak attack dice to give up for threat range`} <input type="number" name="noQuarterDice" min="0" max="${most}" step="1" value="0" /></label>`
          : ""
      }
    ];
  },
  read: ({ entered }) => {
    const n = Number(entered?.noQuarterDice);
    return Number.isSafeInteger(n) && n > 0 ? { noQuarterDice: n } : null;
  }
});

rollPipeline.register({
  id: "noQuarterAttackTerm",
  kinds: ["attack"],
  order: 9191,
  terms({ system, weapon, options }) {
    const plan = noQuarterPlan(system, weapon, { dice: options.noQuarterDice ?? 0 });
    return {
      key: "noQuarter",
      plan: plan && !plan.blocked ? plan : null,
      threat: plan && !plan.blocked ? plan.dice : 0,
      blockAt: 201,
      blocked: plan?.blocked ? plan.reason : "",
      noteAt: 501,
      notes: plan && !plan.blocked ? [plan.note] : []
    };
  }
});
