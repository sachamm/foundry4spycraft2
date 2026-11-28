import { loc } from "../i18n.mjs";
import { periodMoney } from "./period-money.mjs";
/**
 * Reputation and Net Worth costs of standing-only gear picks. Pure functions: no Foundry access.
 *
 * Gear tables print the cost as "Reputation/$Net Worth" (for example "15/$750,000"). Vehicle tables print only the
 * Reputation cost; their Net Worth cost is the Reputation cost × $50,000 (Tables 4.22–4.27 footnote). Under the
 * Historical quality the Net Worth cost follows Table 7.4 for the campaign year (module/rules/period-money.mjs).
 */
export const VEHICLE_NET_WORTH_PER_REPUTATION = 50000;

/**
 * Negative standing (p.440), read from the standing the character's affiliation pays in (Reputation for a Faction
 * character, Net Worth for a Freelancer). Below 0 the character is burned: no mission gear or resources, only
 * personal Possessions. Below −20 Reputation or −$1,000,000 (scaled by Table 7.4 under Historical) the character is
 * also targeted for liquidation, with a roll at each mission's start.
 */
export function standingStatus(system, moneyOptions) {
  const currency = system?.affiliationType === "freelance" ? "netWorth" : "reputation",
    value = Number(system?.[currency]) || 0,
    floor = currency === "netWorth" ? periodMoney(-1000000, moneyOptions) : -20;
  // Burned below 0, and still burned at exactly 0 until the standing is back above it.
  return {
    currency,
    value,
    burned: value < 0 || (value === 0 && system?.standingBurned === true),
    liquidation: value < floor
  };
}

/**
 * The standingBurned flag an update leaves: set when the paying standing goes below 0, cleared when it goes above 0,
 * otherwise unchanged. Returns undefined when the flag does not change.
 */
export function standingBurnedAfter(system, changed = {}) {
  const next = { ...system, ...changed },
    { value } = standingStatus({ ...next, standingBurned: false }),
    was = system?.standingBurned === true;
  if (value < 0 && !was) return true;
  if (value > 0 && was) return false;
  return undefined;
}

/**
 * The liquidation roll at a mission's start (p.440): a Marked for Death event (p.399) on 1d20 ≤ 4 + the missions in
 * a row the character has been targeted, this one included.
 */
export function liquidationCheck(missions, total) {
  const target = 4 + Math.max(1, Math.trunc(Number(missions) || 1));
  return { target, marked: Number.isFinite(total) && total <= target };
}

/** {reputation, netWorth} from a printed cost label, or null when the label is not a cost. */
export function parseStandingCost(label) {
  const text = String(label ?? "").trim();
  const both = /^(\d+)\s*\/\s*\$([\d,]+)$/.exec(text);
  if (both) return { reputation: Number(both[1]), netWorth: periodMoney(Number(both[2].replaceAll(",", ""))) };
  const repOnly = /^(\d+)\s+Reputation$/i.exec(text);
  if (repOnly) {
    const reputation = Number(repOnly[1]);
    return { reputation, netWorth: periodMoney(reputation * VEHICLE_NET_WORTH_PER_REPUTATION) };
  }
  return null;
}

/**
 * Whether an actor can pay a cost in the chosen currency, and the balance afterwards.
 * Neither Reputation nor Net Worth may be spent below 0.
 */
export function standingPayment(system, cost, currency) {
  if (!cost || !["reputation", "netWorth"].includes(currency)) return { ok: false, reason: loc`No cost to pay.` };
  const balance = Number(system?.[currency] ?? 0),
    amount = cost[currency];
  if (!Number.isSafeInteger(amount) || amount <= 0) return { ok: false, reason: loc`No cost to pay.` };
  if (balance < amount)
    return {
      ok: false,
      reason: loc`Not enough ${currency === "reputation" ? loc`Reputation` : loc`Net Worth`}: ${balance} of ${amount}.`,
      amount,
      balance
    };
  return { ok: true, amount, balance, after: balance - amount };
}
