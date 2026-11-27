import { drForAttack, nonLethalHitPlan } from "../rules/damage-application.mjs";
import { applyAccumulatedDamage } from "./damage-ledger.mjs";
import { esc } from "../html.mjs";
import { loc } from "../i18n.mjs";

/** Hazard damage uses the same running totals and executable saves as a weapon hit. */
export async function postNonLethalDamage(actor, kind, amount, source, options = {}) {
  const result = await nonLethalDamage(actor, kind, amount, { source, attackKind: "other", ...options });
  if (result.failed) throw Error(loc`The hazard damage was not recorded; review the actual total before continuing.`);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="spycraft2 chat-note">${result.lines.map(line => `<p>${line}</p>`).join("")}</div>`,
    ...(result.pendingSave
      ? { flags: { spycraft2: { checkKind: "note", actorUuid: actor.uuid, pendingSave: result.pendingSave } } }
      : {})
  });
  return result;
}

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
  const {
    source,
    attackKind,
    weaponProficiency = "",
    armorPiercing = 0,
    armorPiercingAll = false,
    critical = false,
    campaignStressAdjusted = false
  } = facts;
  if (target.type === "agent") {
    try {
      const record = await applyAccumulatedDamage(target, {
        source: `${source} [${foundry.utils.randomID(6)}]`,
        kind,
        newDamage: amount,
        criticalHit: critical === true,
        confirmed: true,
        ...(campaignStressAdjusted ? { campaignStressAdjusted } : {}),
        ...(kind === "subdual"
          ? { damageMode: "subdualBeforeDefenses", attackKind, weaponProficiency, armorPiercing, armorPiercingAll }
          : { damageMode: "stressBeforeResistance" })
      });
      return {
        lines: accumulatedDamageLines(esc(target.name), kind, amount, record, target.system),
        net: record?.newDamage ?? amount,
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
    dr: drForAttack(target.system, attackKind, weaponProficiency),
    armorPiercing,
    armorPiercingAll,
    critical,
    campaignStressAdjusted
  });
  if (plan.net) await target.update({ "flags.spycraft2.nonLethal": plan.totals });
  const lines = [
    plan.stopped
      ? loc`${esc(target.name)}: damage reduction and resistance prevent the ${kind} damage.`
      : loc`${esc(target.name)} takes ${plan.net} ${kind} damage: ${plan.total} in all, against a threshold of ${plan.threshold}.`
  ];
  if (!plan.saveRequired) return { lines, pendingSave: null, net: plan.net };
  const saveName = plan.saveKey === "will" ? loc`Will` : loc`Fortitude`;
  lines.push(loc`This calls for a ${saveName} save, DC ${plan.dc}.`);
  return {
    lines,
    net: plan.net,
    pendingSave: {
      kind: "thresholdSave",
      saveKey: plan.saveKey,
      dc: plan.dc,
      label: kind === "stress" ? loc`Stress damage` : loc`Subdual damage`,
      damageKind: kind,
      failureOutcome: plan.failureOutcome,
      eventId: foundry.utils.randomID(),
      stressGrade: kind === "stress" && plan.tier >= 1 && plan.tier <= 4 ? plan.tier : null,
      knockoutBase: plan.knockoutBase
    }
  };
}
