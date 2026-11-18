import { recoveryRatePlan } from "../rules/health.mjs";
import { loc } from "../i18n.mjs";
/** Read-only calculator; the table records rest, Treatment outcomes and actual healing. */
export async function calculateRecoveryRates(actor, options = {}) {
  let input = options;
  if (!Object.keys(input).length) {
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Recovery rate circumstances` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><label>${loc`Resolved Medicine/Treatment for the current day`} <select name="treatment"><option value="none">${loc`None`}</option><option value="success">${loc`Success (×2)`}</option><option value="threat">${loc`Threat (×3)`}</option><option value="criticalSuccess">${loc`Activated critical success (×5)`}</option><option value="error">${loc`Any Treatment error today: cannot heal naturally`}</option></select></label><label><input type="checkbox" name="interest" /> ${loc`At least one hour indulging in one or more Interests (stress recovery only)`}</label><label><input name="poorForaging" type="checkbox" /> ${loc`Failed Survival/Foraging for the current day (half-rate modifier, point values rounded down)`}</label><p>${loc`This calculates rates. Record the actual time, applicable damage threshold and healing separately.`}</p></div>`
    });
    if (!input) return null;
    input = {
      treatment: input.treatment,
      interest: input.interest === true,
      poorForaging: input.poorForaging === true
    };
  }
  let plan;
  try {
    plan = recoveryRatePlan(actor.system, input);
  } catch (error) {
    ui.notifications.warn(error.message);
    return null;
  }
  if (Object.keys(options).length) return plan;
  const esc = foundry.utils.escapeHTML,
    rows = plan.stress
      .map(
        (row, i) =>
          `<tr><td>${loc`${row.threshold}× score`}</td><td>${loc`${row.thresholdValue === null ? "Threshold stat unavailable" : `More than ${row.thresholdValue}`}: ${row.points} per ${esc(row.label)}`}</td><td>${loc`${plan.subdual[i].thresholdValue === null ? "Threshold stat unavailable" : `More than ${plan.subdual[i].thresholdValue}`}: ${plan.subdual[i].points} per ${esc(row.label)}`}</td></tr>`
      )
      .join("");
  await foundry.applications.api.DialogV2.input({
    window: { title: loc`Recovery rates` },
    rejectClose: false,
    content: `<div class="spycraft2-roll-options"><p>${loc`Natural recovery: ${plan.vitalityPoints} vitality per ${esc(plan.vitalityIntervalLabel)} of rest; ${plan.woundPoints} wounds per ${esc(plan.woundIntervalLabel)} of rest. Restrict activity to light activity, with no combat. Critical injuries do not prevent this recovery; they are not removed by it.`}</p><p>${loc`${plan.fastHealing ? loc`Fast Healing included. ` : ""}${plan.quickHealer ? loc`Quick Healer halves the modified recovery intervals (p.175). ` : ""}${plan.poorForaging ? loc`Failed Foraging included; point values rounded down. ` : ""}Combined natural multiplier ×${plan.naturalMultiplier}; stress ×${plan.stressMultiplier}; subdual ×${plan.subdualMultiplier}. Multiple multipliers add, subtracting one for each beyond the first (p.329).`}</p><table><thead><tr><th>${loc`Threshold exceeded`}</th><th>${loc`Stress`}</th><th>${loc`Subdual`}</th></tr></thead><tbody>${rows}</tbody></table><p>${loc`These are the printed threshold rows using current derived stress/subdual thresholds; use the applicable current damage state. Rates apply only during the qualifying rest, Treatment or Interest period. This calculator does not change damage, injuries, conditions, time or resources.`}</p></div>`
  });
  return plan;
}
