/** Aquatic Training/Home Turf pp.206–207 improve actual partial cover, never create cover. */
export function terrainCoverPlan(
  system,
  {
    personalCover = 0,
    sceneryCover = 0,
    homeTurfCover = false,
    homeTurfCoverSource = "scenery",
    partialSubmersionCover = false,
    terrainCoverConfirmed = false
  } = {}
) {
  if (![personalCover, sceneryCover].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 4))
    throw new Error("Choose actual personal/scenery cover grades from0through4 before terrain feat adjustments.");
  if ([homeTurfCover, partialSubmersionCover, terrainCoverConfirmed].some(v => typeof v !== "boolean"))
    throw new Error("Declare the terrain cover circumstances with explicit boolean choices.");
  if (!homeTurfCover && !partialSubmersionCover) return null;
  if (terrainCoverConfirmed !== true)
    throw new Error("The GC must confirm actual cover and the declared home-turf/submersion circumstances.");
  if (homeTurfCover && !["personal", "scenery"].includes(homeTurfCoverSource))
    throw new Error("Choose which actual cover source Home Turf improves.");
  if (homeTurfCover && !system.activeFeatNames?.includes("Home Turf"))
    throw new Error("Home Turf must be currently available.");
  if (partialSubmersionCover && !system.activeFeatNames?.includes("Aquatic Training"))
    throw new Error("Aquatic Training must be currently available.");
  if (homeTurfCover && (homeTurfCoverSource === "personal" ? personalCover : sceneryCover) === 0)
    throw new Error("Home Turf improves an existing cover source; it cannot create cover.");
  if (partialSubmersionCover && sceneryCover === 0)
    throw new Error("Partially submerged cover requires an actual scenery cover source supplied by the water.");
  const context = {
      personalCover,
      sceneryCover,
      homeTurfCover,
      homeTurfCoverSource,
      partialSubmersionCover,
      terrainCoverConfirmed: true
    },
    beforeGrade = Math.min(4, personalCover + sceneryCover),
    sources = [];
  let personal = personalCover,
    scenery = sceneryCover;
  const apply = (source, kind) => {
    const before = Math.min(4, personal + scenery),
      listed = kind === "personal" ? personal : scenery,
      applied = before > 0 && before < 4 && listed > 0 && listed < 4;
    if (applied) {
      if (kind === "personal") personal++;
      else scenery++;
    }
    sources.push({
      source,
      kind,
      beforeGrade: before,
      afterGrade: Math.min(4, personal + scenery),
      increase: applied ? 1 : 0
    });
  };
  if (partialSubmersionCover) apply("Aquatic Training", "scenery");
  if (homeTurfCover) apply("Home Turf", homeTurfCoverSource);
  return {
    version: 1,
    context,
    sources,
    personalCover: personal,
    sceneryCover: scenery,
    beforeGrade,
    grade: Math.min(4, personal + scenery),
    increase: Math.min(4, personal + scenery) - beforeGrade
  };
}
/** The optional proof records raw grades so saved/replacement calculations never apply a quarter twice. */
export function validateTerrainCoverProof(system, proof) {
  if (!proof) return;
  const current = terrainCoverPlan(system, proof.context);
  if (proof.version !== 1 || !current || JSON.stringify(current) !== JSON.stringify(proof))
    throw new Error("The terrain cover source, grades or circumstances changed.");
}
