/**
 * The order a skill's checks are offered in: open checks a player rolls first, then passive ones, then secret ones
 * the GC usually rolls, and checks that need specific gear last. Within each group the data order stands.
 */
const MODE_RANK = { Active: 0, "Active or Secret": 0, Passive: 1, Secret: 2 };

/** Whether a check can only be made with particular gear in hand. */
export const needsGear = check => /\bGear Only\b/.test(check?.tags ?? "");

export function orderSkillChecks(checks = []) {
  const rank = check => (MODE_RANK[check.mode] ?? 0) + (needsGear(check) ? 4 : 0);
  return checks
    .map((check, index) => ({ check, index }))
    .sort((a, b) => rank(a.check) - rank(b.check) || a.index - b.index)
    .map(entry => entry.check);
}
