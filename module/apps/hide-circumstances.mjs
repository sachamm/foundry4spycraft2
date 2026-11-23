import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
export function hideCircumstanceContent(key) {
  if (key !== "sneak") return "";
  return `<details><summary>${loc`Hide area and hiding opportunity`}</summary><p>${loc`For Sneak/Hide only. Declaring these circumstances chooses the normal key attribute automatically: Dexterity below10people in the current30-ft. ×30-ft. area, Charisma at 10 or more. Any actual attribute substitution applies afterward. Ghost Supremacy permits hiding without an apparent place, but an observer who knows your location must still be distracted.`}</p><label><input name="hideCircumstances" type="checkbox" /> ${loc`Use these confirmed current Hide circumstances`}</label><label>${loc`People in the current30-ft. ×30-ft. area`} <input name="hideAreaPeople" type="number" min="0" step="1" /></label><label><input name="hideApparentPlace" type="checkbox" checked /> ${loc`There is an apparent place to hide`}</label><label><input name="hideLocationKnown" type="checkbox" /> ${loc`This observer already knows my location`}</label><label><input name="hideDistractionOpportunity" type="checkbox" /> ${loc`There is an actual opportunity to duck away while this observer is distracted`}</label><label><input name="hideCircumstancesConfirmed" type="checkbox" /> ${loc`The GC confirms these current circumstances and the actual area population`}</label><p>${loc`The opposed result, other observers and hidden-state duration are resolved separately.`}</p></details>`;
}

// Roll pipeline: this rule's section of the "skill" dialog.
rollPipeline.register({
  id: "hideCircumstanceContent:skill",
  dialogs: ["skill"],
  dialog: ({ key }) => [{ at: 340, html: hideCircumstanceContent(key) }]
});
