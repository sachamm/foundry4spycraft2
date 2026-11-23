import { BALANCE_SURFACES } from "../rules/balance.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
export function balanceSurfaceContent(key) {
  if (key !== "acrobatics") return "";
  const esc = foundry.utils.escapeHTML;
  return `<details><summary>${loc`Balance surface and movement`}</summary><p>${loc`For Acrobatics/Balance only. Choose the actual Table 2.10 row; the GC resolves the overlapping walkway rows at exactly3inches. Inclines above60° require Climb. Equilibrium’s qualified current benefits apply automatically on the relevant surfaces.`}</p><label><input name="balanceCircumstances" type="checkbox" /> ${loc`Use these GC-confirmed Balance circumstances`}</label><label>${loc`Surface`} <select name="balanceSurface">${Object.entries(
    BALANCE_SURFACES
  )
    .map(([id, row]) => `<option value="${id}">${esc(row.label)}</option>`)
    .join(
      ""
    )}</select></label><label>${loc`Total counted movement for this Balance sequence (ft.)`} <input name="balanceDistanceFeet" type="number" min="0" step="any" value="0" /></label><label><input name="balanceBuckled" type="checkbox" /> ${loc`Buckled, rolling or sagging surface`}</label><label><input name="balanceSlippery" type="checkbox" /> ${loc`Slippery surface or knee-deep water`}</label><label><input name="balanceConfirmed" type="checkbox" /> ${loc`The GC confirms this row, cumulative conditions and otherwise legal movement/actions`}</label><p>${loc`The receipt lists the DC and number of checks required. This rolls one check; resolve remaining checks, movement and outcomes separately. Other DC modifiers remain separate.`}</p></details>`;
}

// Roll pipeline: this rule's section of the "skill" dialog.
rollPipeline.register({
  id: "balanceSurfaceContent:skill",
  dialogs: ["skill"],
  dialog: ({ key }) => [{ at: 330, html: balanceSurfaceContent(key) }]
});
