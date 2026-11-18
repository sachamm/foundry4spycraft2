import { CONVEYANCE_BULL_RUSH_PROFILES, CONVEYANCE_BULL_RUSH_SIZES } from "../rules/conveyance-bull-rush.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
export function conveyanceBullRushContent(key) {
  const profile = CONVEYANCE_BULL_RUSH_PROFILES[key];
  if (!profile) return "";
  const esc = foundry.utils.escapeHTML,
    sizeOptions = CONVEYANCE_BULL_RUSH_SIZES.map(
      s => `<option value="${esc(s)}"${s === "Medium" ? " selected" : ""}>${esc(s)}</option>`
    ).join("");
  return `<details><summary>${loc`Bull Rush with ${esc(profile.label)}`}</summary><p>${loc`Choose Bull Rush (conveyance) above. Use ${key.toUpperCase()}/${profile.ability.toUpperCase()} for this ${esc(profile.label)}. Armor Check Penalty is ignored. This is a full-action Bull Rush, with no Maneuver-only synergies, bonuses or free-action benefits.${profile.focusRequired ? loc` Choose the actual vehicle’s Drive focus in the common Focus field above; unowned-focus rules still apply.` : ""}`}</p><label>${loc`Actual conveyance or mount`} <input name="conveyanceBullRushName" maxlength="200" /></label><label>${loc`Actual target`} <input name="conveyanceBullRushTargetName" maxlength="200" /></label><label>${loc`Rushing conveyance/mount Size`} <select name="conveyanceBullRushSize">${sizeOptions}</select></label><label>${loc`Target Size`} <select name="conveyanceBullRushTargetSize">${sizeOptions}</select></label><label>${loc`Current full-action conveyance movement allowance (ft.)`} <input name="conveyanceBullRushAllowanceFeet" type="number" min="0" step="any" /></label><label>${loc`Counted direct movement (ft.)`} <input name="conveyanceBullRushDistanceFeet" type="number" min="0" step="any" /></label><label><input name="conveyanceBullRushTargetThreatening" type="checkbox" /> ${loc`The chosen target is threatening (its adjacency does not stop this Bull Rush)`}</label><label><input name="conveyanceBullRushOtherThreatAdjacency" type="checkbox" /> ${loc`Starting adjacent to another threatening opponent`}</label><label><input name="conveyanceBullRushPassesOtherThreat" type="checkbox" /> ${loc`Continuing past another threatening opponent’s adjacency`}</label><label><input name="conveyanceBullRushControlConfirmed" type="checkbox" /> ${loc`The GC confirms actual control of this ${esc(profile.label)} with the appropriate skill/focus`}</label><label><input name="conveyanceBullRushStatsConfirmed" type="checkbox" /> ${loc`The GC confirms current conveyance/target Sizes and the full-action movement allowance in feet`}</label><label><input name="conveyanceBullRushRouteConfirmed" type="checkbox" /> ${loc`The GC confirms this direct route, counted movement costs and no other threatening adjacency`}</label><label><input name="conveyanceBullRushContactConfirmed" type="checkbox" /> ${loc`This movement legally reaches the chosen target’s square`}</label><label><input name="conveyanceBullRushFullActionConfirmed" type="checkbox" /> ${loc`This full action is available now on my Initiative Count`}</label><p>${loc`Use the conveyance’s applicable allowance, not your foot Speed. The GC supplies these current facts and resolves movement, opposed outcome, pushing, damage and other consequences separately.`}</p></details>`;
}

// Roll pipeline: this rule's section of the "skill" dialog.
rollPipeline.register({
  id: "conveyanceBullRushContent:skill",
  dialogs: ["skill"],
  dialog: ({ key }) => [{ at: 250, html: conveyanceBullRushContent(key) }]
});
