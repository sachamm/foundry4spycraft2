/**
 * Gear by era: which items exist in the campaign's year.
 *
 * Each gear, weapon, armor and vehicle entry carries `system.year`, the year or decade it was introduced, as a label
 * ("1911", "1960s", "1800s/1930s"). Most dates come from the Year column of the rulebook's gear tables (p.222); our
 * own dates fill the entries the book leaves undated (src/data/gear-years.json). An empty label means the item
 * predates any modern campaign. The year to compare against is the game clock's.
 */

/** The first year an item can be had, from its label, or null when it has no date (always available). */
export function introductionYear(label) {
  const match = /\d{3,4}/.exec(String(label ?? ""));
  return match ? Number(match[0]) : null;
}

/**
 * Is an item with this year label out yet in the given year? A decade counts from its first year, so "1950s" gear
 * is available in 1950. With no campaign year everything is available.
 */
export function availableIn(label, year) {
  if (!Number.isSafeInteger(year)) return true;
  const first = introductionYear(label);
  return first === null || first <= year;
}
