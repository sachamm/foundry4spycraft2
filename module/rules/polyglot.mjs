/** Polyglot p.204: automatic Cultures synergy, including targets outside owned regions. */
export function polyglotSkillPlan(system, key) {
  if (!["impress", "networking"].includes(key) || !system.activeFeatNames?.includes("Polyglot")) return null;
  const ranks = system.skillTotals?.cultures?.ranks;
  const valid = Number.isSafeInteger(ranks) && ranks >= 0,
    synergy = valid ? Math.min(5, Math.floor(ranks / 5)) : 0;
  return {
    evidence: { version: 1, source: "Polyglot", culturesRanks: ranks, synergy, focusException: true },
    bonuses: [{ source: "Polyglot", type: "synergy", value: synergy }],
    synergies: [{ skill: "cultures", focusSkill: false, focus: "", condition: "" }],
    blockedReason: valid ? "" : "Review Cultures ranks before applying Polyglot."
  };
}
