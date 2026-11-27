import { loc } from "../i18n.mjs";

/** Campaign affiliation constrains gear rules and the currency used for standing (p.407). */
export function campaignAffiliationProblem(system = {}, effects = {}) {
  const rules = effects.gearRules;
  if (!["faction", "freelance", "hybrid"].includes(rules)) return null;
  if (!["faction", "freelance"].includes(system.affiliationType))
    return loc`Choose Faction or Freelance affiliation before using campaign gear and standing.`;
  if (rules !== "hybrid" && system.affiliationType !== rules)
    return loc`This campaign requires ${rules === "faction" ? "Faction" : "Freelance"} affiliation; review the character's selection.`;
  return null;
}

export function campaignStandingCurrency(system, effects = {}, fallback = "reputation") {
  const problem = campaignAffiliationProblem(system, effects);
  if (problem) throw new Error(problem);
  if (["faction", "freelance", "hybrid"].includes(effects.gearRules))
    return system.affiliationType === "freelance" ? "netWorth" : "reputation";
  if (!["reputation", "netWorth"].includes(fallback)) throw new Error(loc`Choose Reputation or Net Worth.`);
  return fallback;
}
