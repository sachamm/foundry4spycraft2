/** Shared declarations: input raw grades before the selected automatic quarter increases. */
export function terrainCoverContent(system = {}, values = {}) {
  const aquatic = system.activeFeatNames?.includes("Aquatic Training"),
    home = system.activeFeatNames?.includes("Home Turf");
  if (!aquatic && !home) return "";
  const checked = k => (values[k] === true ? " checked" : ""),
    selected = k => (values.homeTurfCoverSource === k ? " selected" : "");
  return `<fieldset><legend>Terrain cover improvements</legend><p>Enter cover grades before these selected increases. Other separately adjudicated grade changes still apply. Do not pre-add either automatic quarter.</p>${aquatic ? `<label><input name="partialSubmersionCover" type="checkbox"${checked("partialSubmersionCover")} /> Aquatic Training: the scenery cover is supplied by being partially submerged</label>` : ""}${home ? `<label><input name="homeTurfCover" type="checkbox"${checked("homeTurfCover")} /> Home Turf: I am within5blocks of my urban home or1mile of my wilderness home</label><label>Existing cover source Home Turf improves <select name="homeTurfCoverSource"><option value="scenery"${selected("scenery")}>Scenery</option><option value="personal"${selected("personal")}>Personal (including an actual human shield)</option></select></label>` : ""}<label><input name="terrainCoverConfirmed" type="checkbox"${checked("terrainCoverConfirmed")} /> The GC confirms the actual cover sources and selected home/submersion circumstances</label></fieldset>`;
}
