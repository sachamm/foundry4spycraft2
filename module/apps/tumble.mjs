import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
export function tumblePathContent(key) {
  if (key !== "acrobatics") return "";
  return `<details><summary>${loc`Tumble path and movement`}</summary><p>${loc`For a rolled Acrobatics/Tumble half action. Ordinary allowance is current Speed−10; qualified Equilibrium Mastery permits full current Speed. Count actual enemy-occupied squares, including squares targeted by enemy suppressive fire, rather than repeated adjacent path segments.`}</p><label><input name="tumbleCircumstances" type="checkbox" /> ${loc`Use this confirmed Tumble path`}</label><label>${loc`Total counted movement (ft.)`} <input name="tumbleDistanceFeet" type="number" min="0" step="any" value="0" /></label><label>${loc`Enemy-occupied squares adjacent to the path`} <input name="tumbleAdjacentEnemySquares" type="number" min="0" step="1" value="1" /></label><label>${loc`Enemy-occupied squares in the path`} <input name="tumbleOccupiedSquares" type="number" min="0" step="1" value="0" /></label><label><input name="tumbleRouteConfirmed" type="checkbox" /> ${loc`The GC confirms these counts, suppressive-fire squares, movement costs and an otherwise legal half action ending in an unoccupied square`}</label><p>${loc`The receipt lists DC, error increase and movement allowance. Threat/critical extra movement requires its actual outcome; token movement, failure conditions and final attacks are resolved separately. Other options permitting an occupied endpoint require their own adjudication.`}</p></details>`;
}

// Roll pipeline: this rule's section of the "skill" dialog.
rollPipeline.register({
  id: "tumblePathContent:skill",
  dialogs: ["skill"],
  dialog: ({ key }) => [{ at: 280, html: tumblePathContent(key) }]
});
