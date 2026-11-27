/**
 * Historical money (p.407, Table 7.4). Under the Historical season quality every money value and actual cost is
 * multiplied by the modifier for the campaign year: ×0.1 in the 1950s, ×0.2 in the 1960s, ×0.3 in the 1970s and ×0.6
 * in the 1980s. The year is the game clock's; with no date set, or without the quality, money is unchanged.
 */
import { GC_DATA } from "./gc-tables.mjs";
import { campaignRules } from "./campaign-rules.mjs";

// Read when asked: the build imports this module before it regenerates gc-tables.mjs.
const rows = () => GC_DATA.tables.historicalMoney?.rows ?? [];
let yearSource = () => null;

/** Register the function that returns the campaign year (module/apps/game-clock.mjs). */
export function setCampaignYearSource(fn) {
  yearSource = typeof fn === "function" ? fn : () => null;
}

/** The campaign year, or null when none is set. */
export function campaignYear() {
  try {
    const year = yearSource();
    return Number.isSafeInteger(year) ? year : null;
  } catch {
    return null;
  }
}

/** Table 7.4's modifier for a year: 1 from 1990 on, and for years before the table starts or none at all. */
export function historicalMoneyModifier(year) {
  if (!Number.isSafeInteger(year)) return 1;
  return rows().find(row => year >= row.from && (row.to === null || year <= row.to))?.modifier ?? 1;
}

/** The modifier in force now: Table 7.4's for the campaign year while Historical is in force, otherwise 1. */
export function periodMoneyModifier({ effects = campaignRules(), year = campaignYear() } = {}) {
  return effects.historicalMoney ? historicalMoneyModifier(year) : 1;
}

/** A money value or actual cost after Table 7.4, rounded to the dollar (a nonzero amount never falls below $1). */
export function periodMoney(amount, options) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  const modifier = periodMoneyModifier(options);
  if (modifier === 1) return value;
  const scaled = Math.round(value * modifier);
  return value > 0 ? Math.max(1, scaled) : scaled;
}
