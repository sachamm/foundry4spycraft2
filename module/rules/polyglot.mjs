import { rollPipeline, skillPlanTerm } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
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
    blockedReason: valid ? "" : loc`Review Cultures ranks before applying Polyglot.`
  };
}

// Polyglot's Cultures synergy, in a skill check's plan.
rollPipeline.register({
  id: "polyglotSkillTerm",
  kinds: ["skill"],
  order: 9330,
  terms({ system, skillKey }) {
    const plan = polyglotSkillPlan(system, skillKey);
    return {
      ...skillPlanTerm("polyglot", plan ?? {}, { noteAt: 300, blockAt: 250, bonusAt: 80 }),
      segment: plan
        ? loc`Polyglot: +${plan.evidence.synergy} Cultures synergy, including targets outside owned regions. `
        : ""
    };
  }
});

// Recorded on the posted check as the roll was given them.
rollPipeline.register({ id: "polyglotRecord", order: 9715, record: ["polyglot"] });
