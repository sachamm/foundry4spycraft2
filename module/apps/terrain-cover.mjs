import { loc } from "../i18n.mjs";
/** Shared declarations: input raw grades before the selected automatic quarter increases. */
export function terrainCoverContent(system = {}, values = {}) {
  const aquatic = system.activeFeatNames?.includes("Aquatic Training"),
    home = system.activeFeatNames?.includes("Home Turf");
  if (!aquatic && !home) return "";
  const checked = k => (values[k] === true ? " checked" : ""),
    selected = k => (values.homeTurfCoverSource === k ? " selected" : "");
  return `<fieldset><legend>${loc`Terrain cover improvements`}</legend><p>${loc`Enter cover grades before these selected increases. Other separately adjudicated grade changes still apply. Do not pre-add either automatic quarter.`}</p>${aquatic ? `<label><input name="partialSubmersionCover" type="checkbox"${checked("partialSubmersionCover")} /> ${loc`Aquatic Training: the scenery cover is supplied by being partially submerged`}</label>` : ""}${home ? `<label><input name="homeTurfCover" type="checkbox"${checked("homeTurfCover")} /> ${loc`Home Turf: I am within5blocks of my urban home or1mile of my wilderness home`}</label><label>${loc`Existing cover source Home Turf improves`} <select name="homeTurfCoverSource"><option value="scenery"${selected("scenery")}>${loc`Scenery`}</option><option value="personal"${selected("personal")}>${loc`Personal (including an actual human shield)`}</option></select></label>` : ""}<label><input name="terrainCoverConfirmed" type="checkbox"${checked("terrainCoverConfirmed")} /> ${loc`The GC confirms the actual cover sources and selected home/submersion circumstances`}</label></fieldset>`;
}
