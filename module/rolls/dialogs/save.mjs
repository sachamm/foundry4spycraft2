/**
 * The "save" roll dialog as ordered parts. Each part is one piece of the form; a rule adds its own piece by
 * registering a `dialog` contributor for "save" with an `at` between the parts it belongs with.
 * SAVE_DIALOG.anchors gives the position just inside the end of each named section.
 */
import { rollPipeline } from "../../rules/roll-pipeline.mjs";
import { saveCoverContent } from "../../apps/save-cover.mjs";
import { evasionPlan, uncannyDodgePlan } from "../../rules/defense.mjs";

/** [position, render(context)] — context holds the acting character and the values the roll has worked out so far. */
const parts = [
  [10, () => `<div class="spycraft2-roll-options">`],
  [20, ({ stillStandingContent }) => stillStandingContent],
  [
    30,
    ({ actor }) =>
      actor.system.conditionContext?.baffled === true
        ? '<label><input type="checkbox" name="resistingBaffled" /> This save resists becoming Baffled (+8)</label>'
        : ""
  ],
  [
    40,
    ({ actor }) =>
      actor.system.mentalLeapState?.fatigueSaveBonus
        ? '<label>Fatigue-related save <select name="fatigueCondition"><option value="">Other save</option><option value="fatigue">Resists becoming fatigued</option><option value="exhaustion">Resists becoming exhausted</option></select></label>'
        : ""
  ],
  [50, ({ actor, key }) => (key === "ref" ? saveCoverContent(actor.system) : "")],
  [
    60,
    ({ key }) =>
      key === "ref"
        ? '<label><input type="checkbox" name="reflexReducesDamage" /> The source allows this Reflex save to reduce damage</label><label><input type="checkbox" name="flatFooted" /> I am flat-footed against this attack or event</label>'
        : ""
  ],
  [
    70,
    ({ actor, key }) =>
      key === "ref" && evasionPlan(actor.system).canTake10
        ? '<label>Method <select name="checkMethod"><option value="roll">Roll d20</option><option value="take10">Take 10 (Evasion III)</option></select></label>'
        : ""
  ],
  [
    80,
    ({ actor, key }) =>
      key === "ref" && uncannyDodgePlan(actor.system).securityBonus
        ? '<label><input type="checkbox" name="securityDevice" /> This Reflex save avoids a security device (Uncanny Dodge +4)</label>'
        : ""
  ],
  [
    90,
    ({ key }) =>
      key === "ref"
        ? '<label><input type="checkbox" name="braced" /> I am currently braced (apply the Brace Reflex penalty)</label><label><input type="checkbox" name="underwater" /> I am underwater</label>'
        : ""
  ],
  [
    100,
    ({ feats }) =>
      feats.has("Swamp Training") || feats.has("Poison Basics")
        ? '<label><input type="checkbox" name="poison" /> This save resists poison (owned Poison Basics / Swamp Training)</label>'
        : ""
  ],
  [
    110,
    ({ feats }) =>
      feats.has("Disease Basics")
        ? '<label><input type="checkbox" name="disease" /> This save resists disease (Disease Basics)</label>'
        : ""
  ],
  [
    120,
    ({ feats, key }) =>
      feats.has("Firefighter Training") && key === "ref"
        ? '<label><input type="checkbox" name="avoidCatchingFire" /> This Reflex save avoids catching fire (Firefighter Training)</label>'
        : ""
  ],
  [
    130,
    ({ feats, key }) =>
      feats.has("Firefighter Training") && key === "fort"
        ? '<label><input type="checkbox" name="smokeInhalation" /> This Fortitude save resists smoke inhalation (Firefighter Training)</label>'
        : ""
  ],
  [140, () => `</div>`]
];

export const SAVE_DIALOG = Object.freeze({ id: "save", anchors: Object.freeze({}) });

rollPipeline.register({
  id: "saveDialog",
  dialogs: ["save"],
  dialog: context => parts.map(([at, render]) => ({ at, html: render(context) }))
});
