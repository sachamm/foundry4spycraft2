/**
 * Reputation and Net Worth costs of standing-only gear picks. Pure functions: no Foundry access.
 *
 * Gear tables print the cost as "Reputation/$Net Worth" (for example "15/$750,000"). Vehicle tables print only the
 * Reputation cost; their Net Worth cost is the Reputation cost × $50,000 (Tables 4.22–4.27 footnote).
 */
export const VEHICLE_NET_WORTH_PER_REPUTATION = 50000;

/** {reputation, netWorth} from a printed cost label, or null when the label is not a cost. */
export function parseStandingCost(label) {
  const text = String(label ?? '').trim();
  const both = /^(\d+)\s*\/\s*\$([\d,]+)$/.exec(text);
  if (both) return {reputation: Number(both[1]), netWorth: Number(both[2].replaceAll(',', ''))};
  const repOnly = /^(\d+)\s+Reputation$/i.exec(text);
  if (repOnly) { const reputation = Number(repOnly[1]); return {reputation, netWorth: reputation * VEHICLE_NET_WORTH_PER_REPUTATION}; }
  return null;
}

/**
 * Whether an actor can pay a cost in the chosen currency, and the balance afterwards.
 * Neither Reputation nor Net Worth may be spent below 0.
 */
export function standingPayment(system, cost, currency) {
  if (!cost || !['reputation', 'netWorth'].includes(currency)) return {ok: false, reason: 'No cost to pay.'};
  const balance = Number(system?.[currency] ?? 0), amount = cost[currency];
  if (!Number.isSafeInteger(amount) || amount <= 0) return {ok: false, reason: 'No cost to pay.'};
  if (balance < amount) return {ok: false, reason: `Not enough ${currency === 'reputation' ? 'Reputation' : 'Net Worth'}: ${balance} of ${amount}.`, amount, balance};
  return {ok: true, amount, balance, after: balance - amount};
}
