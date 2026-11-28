import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
export function bullRushDefenseContent(key) {
  if (key !== "athletics") return "";
  return `<details><summary>${loc`Resist Bull Rush (ordinary on-foot target)`}</summary><p>${loc`Choose Resist Bull Rush above: Athletics/STR, Armor Check Penalty and action error+0. The larger character gains +4 per Size category; earned Still Standing adds +4 unnamed. This response is for the chosen target with both characters on foot.`}</p><label>${loc`Actual rushing opponent`} <input name="bullRushOpponentName" maxlength="200" /></label><label>${loc`My Size categories minus the attacker’s`} <input name="bullRushSizeDifference" type="number" min="-11" max="1" step="1" value="0" /></label><label><input name="bullRushOnFootConfirmed" type="checkbox" /> ${loc`Both characters are on foot; this is the chosen target’s response`}</label><label><input name="bullRushContactConfirmed" type="checkbox" /> ${loc`The rushing character has legally entered my square`}</label><label><input name="bullRushIncomingConfirmed" type="checkbox" /> ${loc`The GC confirms this legal incoming Bull Rush, participants and actual Size difference`}</label><p>${loc`Mounted/vehicle and intervening-character checks use separate rules. Resolve the opposed result, pushing, obstructions, damage, conditions and final attacks separately.`}</p></details>`;
}

// Roll pipeline: this rule's section of the "skill" dialog.
rollPipeline.register({
  id: "bullRushDefenseContent:skill",
  dialogs: ["skill"],
  dialog: ({ key }) => [{ at: 270, html: bullRushDefenseContent(key) }]
});
