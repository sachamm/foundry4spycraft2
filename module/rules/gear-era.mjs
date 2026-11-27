/**
 * Gear by era: which items exist in the campaign's year.
 *
 * Each gear, weapon, armor and vehicle entry carries `system.year`, the year or decade it was introduced, as a label
 * ("1911", "1960s", "1800s/1930s"). Most dates come from the Year column of the rulebook's gear tables (p.222); our
 * own dates fill the entries the book leaves undated (src/data/gear-years.json). An empty label means the item
 * predates any modern campaign. The year to compare against is the game clock's.
 */
import { campaignRules } from "./campaign-rules.mjs";
import { campaignYear } from "./period-money.mjs";
import { GEAR_YEARS } from "../data/gear-year-index.mjs";

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

/**
 * Historical (p.407): while the season quality is in force, an item not yet introduced by the campaign year can only
 * be had as a gadget Housing or effect, one Caliber above its own. Nothing goes past Caliber V, so such an item of
 * Caliber V cannot be had at all. Without the quality, or with no campaign year, every item keeps its own Caliber.
 * `system` is an item's system data (its `caliber` and `year`).
 * @returns {{caliber: number|null, base: number, gadget: boolean, available: boolean}}
 */
export function historicalCaliber(system, { effects = campaignRules(), year = campaignYear() } = {}) {
  const base = Number(system?.caliber);
  if (!effects?.historicalGear || !Number.isSafeInteger(base) || base < 1 || availableIn(system?.year, year))
    return { caliber: Number.isSafeInteger(base) ? base : null, base, gadget: false, available: true };
  if (base >= 5) return { caliber: null, base, gadget: true, available: false };
  return { caliber: base + 1, base, gadget: true, available: true };
}

/** The year label of a compendium entry with this exact name, of any dated type, or "" when none or when unsure. */
export function gearYearByName(name, index = GEAR_YEARS.byName) {
  const key = String(name ?? "")
    .trim()
    .toLowerCase();
  if (!key) return "";
  const labels = new Set(
    Object.entries(index)
      .filter(([typed]) => typed.slice(typed.indexOf("|") + 1).toLowerCase() === key)
      .map(([, label]) => label)
  );
  return labels.size === 1 ? [...labels][0] : "";
}
