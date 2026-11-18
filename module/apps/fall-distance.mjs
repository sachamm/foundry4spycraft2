import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
export function fallDistanceContent(key) {
  if (key !== "acrobatics") return "";
  return `<details><summary>${loc`Falling damage distance`}</summary><p>${loc`For Acrobatics/Falling only. Record actual fall length; qualified Equilibrium Basics subtracts20feet for damage, and a soft or yielding landing subtracts another10feet (minimum0). This does not change this skill modifier or establish the landing outcome.`}</p><label><input name="fallDeclared" type="checkbox" /> ${loc`Calculate this fall’s damage distance`}</label><label>${loc`Actual fall distance (ft.)`} <input name="fallDistanceFeet" type="number" min="0" step="any" /></label><label><input name="fallSoftSurface" type="checkbox" /> ${loc`The landing surface is soft or yielding`}</label><label><input name="fallConfirmed" type="checkbox" /> ${loc`The GC confirms this actual fall and landing surface`}</label><p>${loc`The receipt records actual and damage distances separately. Resolve falling damage, armor piercing, stress, diving, landing conditions and health settlement separately.`}</p></details>`;
}

// Roll pipeline: this rule's section of the "skill" dialog.
rollPipeline.register({
  id: "fallDistanceContent:skill",
  dialogs: ["skill"],
  dialog: ({ key }) => [{ at: 320, html: fallDistanceContent(key) }]
});
