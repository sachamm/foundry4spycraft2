/** Stress and subdual damage onto one character: an agent's ledger, or a special NPC's running totals. */
import { esc } from "../html.mjs";
import { drForAttack, nonLethalHitPlan } from "../rules/damage-application.mjs";
import { applyAccumulatedDamage } from "./damage-ledger.mjs";
import { loc } from "../i18n.mjs";

/** A special NPC's running stress and subdual totals; agents keep a ledger instead. */
export const nonLethalTotals = actor => ({
  stress: Math.max(0, Math.trunc(Number(actor.flags?.spycraft2?.nonLethal?.stress) || 0)),
  subdual: Math.max(0, Math.trunc(Number(actor.flags?.spycraft2?.nonLethal?.subdual) || 0))
});

/**
 * What an agent's ledger did with a stress or subdual hit: how much got past the agent's defenses, the running
 * total against the threshold, and whether a save is now waiting. `record` is the ledger's receipt.
 */
export function accumulatedDamageLines(name, kind, amount, record, system = {}) {
  if (!record || !Number.isSafeInteger(record.newDamage))
    return [
      loc`${name}: ${amount} ${kind} damage recorded before defenses. Any save it calls for is waiting on the sheet.`
    ];
  const threshold = system[kind + "Threshold"],
    against = Number.isSafeInteger(threshold) ? loc` (threshold ${threshold})` : "";
  const lines = [
    record.newDamage === amount
      ? loc`${name} takes ${amount} ${kind} damage: ${record.total} in all${against}.`
      : record.newDamage > 0
        ? loc`${name}: ${amount} ${kind} damage, ${record.newDamage} after damage reduction and resistance: ${record.total} in all${against}.`
        : loc`${name}: damage reduction and resistance stop all ${amount} ${kind} damage. The total stays at ${record.total}${against}.`
  ];
  lines.push(
    record.save
      ? loc`This calls for a save, DC ${record.save.dc}: it is waiting on the sheet, beside the ${kind} total.`
      : loc`No save is called for yet. Vitality and wounds do not change; the ${kind} total is shown beside them on the sheet.`
  );
  return lines;
}

/**
 * Stress or subdual damage. An agent's goes to the ledger, which works out its own save. A special NPC keeps two
 * running totals; when a threshold or a critical hit calls for a save, the report carries the button for it.
 * @returns {{lines: string[], pendingSave: object|null}}
 */
export async function nonLethalDamage(target, kind, amount, facts) {
  const { source, attackKind, armorPiercing = 0, armorPiercingAll = false, critical = false, proficiency = "" } = facts;
  if (target.type === "agent") {
    try {
      const record = await applyAccumulatedDamage(target, {
        source: `${source} [${foundry.utils.randomID(6)}]`,
        kind,
        newDamage: amount,
        criticalHit: critical === true,
        confirmed: true,
        ...(kind === "subdual"
          ? { damageMode: "subdualBeforeDefenses", attackKind, armorPiercing, armorPiercingAll, proficiency }
          : { damageMode: "stressBeforeResistance" })
      });
      return {
        lines: accumulatedDamageLines(esc(target.name), kind, amount, record, target.system),
        pendingSave: null
      };
    } catch (error) {
      return {
        lines: [
          loc`Not applied: ${esc(target.name)}'s ${amount} ${kind} damage could not be recorded (${esc(error.message)}). Record it by hand.`
        ],
        pendingSave: null,
        failed: true
      };
    }
  }
  const plan = nonLethalHitPlan(target.system, nonLethalTotals(target), {
    kind,
    damage: amount,
    dr: drForAttack(target.system, attackKind, { proficiency: facts.proficiency }),
    armorPiercing,
    armorPiercingAll,
    critical
  });
  if (plan.net) await target.update({ "flags.spycraft2.nonLethal": plan.totals });
  const lines = [
    plan.stopped
      ? loc`${esc(target.name)}: damage reduction stops all ${amount} ${kind} damage (it counts twice against subdual damage).`
      : loc`${esc(target.name)} takes ${plan.net} ${kind} damage: ${plan.total} in all, against a threshold of ${plan.threshold}.`
  ];
  if (!plan.saveRequired) return { lines, pendingSave: null };
  const saveName = plan.saveKey === "will" ? loc`Will` : loc`Fortitude`;
  lines.push(loc`This calls for a ${saveName} save, DC ${plan.dc}.`);
  return {
    lines,
    pendingSave: {
      kind: "thresholdSave",
      saveKey: plan.saveKey,
      dc: plan.dc,
      label: kind === "stress" ? loc`Stress damage` : loc`Subdual damage`,
      damageKind: kind,
      failureOutcome: plan.failureOutcome,
      knockoutBase: plan.knockoutBase
    }
  };
}
