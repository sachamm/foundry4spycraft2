import { accumulatedDamagePlan } from "../rules/accumulated-damage.mjs";
import { loc } from "../i18n.mjs";
const whole = value => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && /^(0|[1-9]\d*)$/.test(value)) return Number(value);
  throw new Error(loc`Enter a nonnegative whole damage total.`);
};
export async function checkAccumulatedDamage(actor) {
  if (actor?.type !== "agent" || !actor.isOwner) return null;
  const input = await foundry.applications.api.DialogV2.input({
    window: { title: loc`Stress/subdual thresholds` },
    rejectClose: false,
    content: `<div class="spycraft2-roll-options"><p>${loc`Check one new damage event using the GC-confirmed existing total and damage remaining after all defenses. Stress ignores all DR; subdual doubles applicable DR. Apply resistance and other defenses separately before entering damage.`}</p><label>${loc`Type`} <select name="kind"><option value="stress">${loc`Stress (Will)`}</option><option value="subdual">${loc`Subdual (Fortitude)`}</option></select></label><label>${loc`Already accumulated damage`} <input name="currentDamage" type="number" min="0" step="1" required /></label><label>${loc`New damage after defenses`} <input name="newDamage" type="number" min="0" step="1" required /></label><label><input name="criticalHit" type="checkbox" /> ${loc`This event came from a critical hit`}</label><label><input name="confirmed" type="checkbox" /> ${loc`The GC confirmed both totals and resolved all defenses`}</label><p>${loc`This checks the calculation. It does not apply damage, roll or settle a save, change conditions or recover damage.`}</p></div>`
  });
  if (!input) return null;
  let plan;
  try {
    plan = accumulatedDamagePlan(actor.system, {
      kind: input.kind,
      currentDamage: whole(input.currentDamage),
      newDamage: whole(input.newDamage),
      criticalHit: input.criticalHit ?? false,
      confirmed: input.confirmed
    });
  } catch (error) {
    return ui.notifications.warn(error.message);
  }
  const esc = foundry.utils.escapeHTML,
    save = plan.saveKey === "will" ? "Will" : "Fortitude";
  await foundry.applications.api.DialogV2.input({
    window: { title: loc`Stress/subdual threshold result` },
    rejectClose: false,
    content: `<div class="spycraft2-roll-options"><p><b>${loc`${plan.kind === "stress" ? loc`Stress` : loc`Subdual`} total ${plan.currentDamage} + ${plan.newDamage} = ${plan.total}`}</b></p><p>${loc`Current threshold ${plan.threshold}. A band is exceeded only when total damage is strictly greater than its threshold.`}</p><p>${plan.saveRequired ? `<b>${loc`${save} save DC ${plan.dc}`}</b>${loc`${plan.criticalHit ? loc` (critical hit)` : ""}. Each new positive damage event requires its own save when a threshold is exceeded, even within the same band.`}` : loc`No save is required by this damage event.`}</p>${plan.failureOutcome ? `<p>${loc`On failure: ${esc(plan.failureOutcome)}.${plan.knockoutBase ? loc` Base knockout duration ${esc(plan.knockoutBase)} × half the difference between DC and save result.` : ""}${plan.tier === 5 && plan.kind === "stress" ? loc` The drained level persists below this damage threshold and can recover only at mission end.` : ""}`}</p>` : ""}${plan.needsOutcomeReview ? `<p>${loc`The GC determines the failure outcome for this below-threshold critical hit.`}</p>` : ""}<table><thead><tr><th>${loc`Damage exceeds`}</th><th>${loc`Ordinary DC`}</th><th>${loc`Failure outcome/base duration`}</th></tr></thead><tbody>${plan.rows.map(row => `<tr><td>${row.thresholdValue}</td><td>${row.dc}</td><td>${esc(plan.kind === "stress" ? row.stress : row.knockout)}</td></tr>`).join("")}</tbody></table><p>${loc`Damage accumulates separately from vitality/wounds, causes no critical injuries, and cannot be boosted with action dice. These saves may use ordinary eligible save benefits. Recovery and condition application require separate resolution.`}</p></div>`
  });
  return plan;
}
