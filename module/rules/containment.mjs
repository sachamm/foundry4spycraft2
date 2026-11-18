/**
 * Containment Basics, p.172: with a 2-to-1 or greater advantage, when the character or a teammate benefits from a
 * successful Ambush check, its benefits last through the surprise round and the first 3 rounds of combat. The
 * Tactics/Ambush card states this for the GC, who confirms the advantage when combat starts.
 */
import { rollPipeline, skillPlanTerm } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

export function containmentAmbushPlan(system, key, check) {
  const empty = { evidence: null, bonuses: [], blockedReason: "", notes: [] };
  if (key !== "tactics" || check?.id !== "ambush" || !system?.activeFeatNames?.includes("Containment Basics"))
    return empty;
  return {
    ...empty,
    notes: [
      loc`Containment Basics: with a 2-to-1 or greater advantage, this Ambush’s benefits last through the surprise round and the first 3 rounds of combat (p.172).`
    ]
  };
}

rollPipeline.register({
  id: "containmentSkillTerm",
  kinds: ["skill"],
  order: 9235,
  terms({ system, skillKey, check }) {
    return skillPlanTerm("containment", containmentAmbushPlan(system, skillKey, check), { noteAt: 45 });
  }
});
