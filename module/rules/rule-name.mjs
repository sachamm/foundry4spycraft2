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
