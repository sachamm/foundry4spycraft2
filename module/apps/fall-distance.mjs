import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
import { fallingDamageControls } from "./falling-damage.mjs";
export function fallDistanceContent(key) {
  if (key !== "acrobatics") return "";
  return `<details><summary>${loc`Falling damage distance`}</summary><p>${loc`For Acrobatics/Falling, record the actual distance. Equilibrium Basics reduces the damage distance by 20 feet; a soft or yielding landing reduces it by another 10 feet, to a minimum of zero.`}</p><label><input name="fallDeclared" type="checkbox" /> ${loc`Calculate this fall’s damage distance`}</label><label>${loc`Actual fall distance (ft.)`} <input name="fallDistanceFeet" type="number" min="0" step="any" /></label><label><input name="fallSoftSurface" type="checkbox" /> ${loc`The landing surface is soft or yielding`}</label><label><input name="fallConfirmed" type="checkbox" /> ${loc`The GC confirms this actual fall and landing surface`}</label><p>${loc`After the check, use Resolve falling damage to choose the surface or dive, record the landing condition, and post impact and stress cards. Apply each damage card through its normal controls.`}</p></details>`;
}

// Roll pipeline: this rule's section of the "skill" dialog.
rollPipeline.register({
  id: "fallDistanceContent:skill",
  dialogs: ["skill"],
  dialog: ({ key }) => [{ at: 320, html: fallDistanceContent(key) }]
});
rollPipeline.register({
  id: "fallingDamageControl",
  kinds: ["skill"],
  order: 9732,
  chatControls: fallingDamageControls
});
