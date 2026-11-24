/**
 * The name the rules know an item by.
 *
 * Feats are recognised by their English compendium names ("Guts", "Training", …). An item keeps that name in
 * `flags.spycraft2.ruleName` (set when the packs are built), and the Babele module keeps it in
 * `flags.babele.originalName` when it translates a compendium. Either lets the item show a translated or renamed
 * name while the rules still find it. An item with neither is known by the name it shows.
 */
export function ruleName(item) {
  return item?.flags?.spycraft2?.ruleName || item?.flags?.babele?.originalName || item?.name || "";
}

/**
 * Origins whose names were corrected to the book's Table 1.2 (p.22). Items made before the correction keep the old
 * name until the GC refreshes them from the compendium, so the rules accept either.
 */
export const LEGACY_ORIGIN_NAMES = Object.freeze({
  Mercenary: "Soldier of Fortune",
  Recruit: "Serviceman",
  "Thrill Seeker": "Thrill-Seeker"
});

/** The name the rules know an origin (talent or specialty) by. */
export function originRuleName(item) {
  const name = ruleName(item);
  return item?.type === "origin" && Object.hasOwn(LEGACY_ORIGIN_NAMES, name) ? LEGACY_ORIGIN_NAMES[name] : name;
}
