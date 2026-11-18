import { rollPipeline } from "../rules/roll-pipeline.mjs";
export function fallDistanceContent(key) {
  if (key !== "acrobatics") return "";
  return '<details><summary>Falling damage distance</summary><p>For Acrobatics/Falling only. Record actual fall length; qualified Equilibrium Basics subtracts20feet for damage, and a soft or yielding landing subtracts another10feet (minimum0). This does not change this skill modifier or establish the landing outcome.</p><label><input name="fallDeclared" type="checkbox" /> Calculate this fall’s damage distance</label><label>Actual fall distance (ft.) <input name="fallDistanceFeet" type="number" min="0" step="any" /></label><label><input name="fallSoftSurface" type="checkbox" /> The landing surface is soft or yielding</label><label><input name="fallConfirmed" type="checkbox" /> The GC confirms this actual fall and landing surface</label><p>The receipt records actual and damage distances separately. Resolve falling damage, armor piercing, stress, diving, landing conditions and health settlement separately.</p></details>';
}

// Roll pipeline: this rule's section of the "skill" dialog.
rollPipeline.register({
  id: "fallDistanceContent:skill",
  dialogs: ["skill"],
  dialog: ({ key }) => [{ at: 320, html: fallDistanceContent(key) }]
});
