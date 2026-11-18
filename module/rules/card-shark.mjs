import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
/** Card Shark pp.201–202; normal rank synergy p.92, active Knowledge exception p.99. */
export function cardSharkProfessionPlan(system, key) {
  if (key !== "profession" || !system.activeFeatNames?.includes("Card Shark")) return null;
  const ranks = system.skillTotals?.streetwise?.ranks ?? 0;
  return { source: "Card Shark", streetwiseRanks: ranks, synergy: Math.min(5, Math.floor(ranks / 5)) };
}
export function cardSharkKnowledgePlan(system, { gamblingKnowledge = "", topic = "" } = {}) {
  if (!gamblingKnowledge) return { active: false, blockedReason: "" };
  if (!system.activeFeatNames?.includes("Card Shark"))
    return { active: false, blockedReason: loc`Gambling Knowledge requires Card Shark.` };
  if (
    !["rules", "people", "locations"].includes(gamblingKnowledge) ||
    typeof topic !== "string" ||
    !topic.trim() ||
    topic.length > 1000
  )
    return {
      active: false,
      blockedReason: loc`Choose a listed gambling Knowledge category and enter the specific question.`
    };
  return {
    active: true,
    blockedReason: "",
    evidence: { version: 1, source: "Card Shark", category: gamblingKnowledge, question: topic.trim() }
  };
}

// Card Shark's Streetwise synergy with Profession, in a skill check's plan.
rollPipeline.register({
  id: "cardSharkSkillTerm",
  kinds: ["skill"],
  order: 9350,
  terms({ system, skillKey }) {
    const plan = cardSharkProfessionPlan(system, skillKey);
    return {
      key: "cardSharkProfession",
      plan,
      bonusAt: 90,
      bonuses: plan ? [{ source: "Card Shark", type: "synergy", value: plan.synergy }] : [],
      noteAt: 420,
      segment: plan ? loc`Card Shark: Streetwise rank synergy +${plan.synergy} (pp.201–202). ` : ""
    };
  }
});

// Recorded on the posted check as the roll was given them.
rollPipeline.register({ id: "cardSharkRecord", order: 9630, record: ["cardSharkKnowledge", "cardSharkProfession"] });
