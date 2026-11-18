import { BALANCE_SURFACES } from "../rules/balance.mjs";
export function balanceSurfaceContent(key) {
  if (key !== "acrobatics") return "";
  const esc = foundry.utils.escapeHTML;
  return `<details><summary>Balance surface and movement</summary><p>For Acrobatics/Balance only. Choose the actual Table2.10 row; the GC resolves the overlapping walkway rows at exactly3inches. Inclines above60° require Climb. Equilibrium’s qualified current benefits apply automatically on the relevant surfaces.</p><label><input name="balanceCircumstances" type="checkbox" /> Use these GC-confirmed Balance circumstances</label><label>Surface <select name="balanceSurface">${Object.entries(
    BALANCE_SURFACES
  )
    .map(([id, row]) => `<option value="${id}">${esc(row.label)}</option>`)
    .join(
      ""
    )}</select></label><label>Total counted movement for this Balance sequence (ft.) <input name="balanceDistanceFeet" type="number" min="0" step="any" value="0" /></label><label><input name="balanceBuckled" type="checkbox" /> Buckled, rolling or sagging surface</label><label><input name="balanceSlippery" type="checkbox" /> Slippery surface or knee-deep water</label><label><input name="balanceConfirmed" type="checkbox" /> The GC confirms this row, cumulative conditions and otherwise legal movement/actions</label><p>The receipt lists the DC and number of checks required. This rolls one check; resolve remaining checks, movement and outcomes separately. Other DC modifiers remain separate.</p></details>`;
}
