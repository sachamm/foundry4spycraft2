/**
 * Spider Basics and Supremacy on Athletics/Climb, p.196.
 * - Basics: no penalty from the Hands-On or Vision tags, nor for climbing without a kit. The check is planned without
 *   those tags and without the missing-gear penalty.
 * - Supremacy: with a climbing kit, the Climb DC is 5 lower (+5 to the result here) and the error range 1 lower.
 * Climbing speeds, the Initiative and surprise benefits and falling catches stay with the GC.
 */
import { rollPipeline, skillPlanTerm } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

const climb = (key, check) => key === "athletics" && check?.id === "climb";

/** The Climb check as Spider Basics plans it. */
export function spiderClimbCheck(system, key, check) {
  if (!climb(key, check) || !system?.activeFeatNames?.includes("Spider Basics"))
    return { check, waiveMissingGear: false };
  const tags = String(check.tags ?? "")
    .split(",")
    .map(t => t.trim())
    .filter(t => t && t !== "Hands-On" && t !== "Vision")
    .join(", ");
  return { check: { ...check, tags }, waiveMissingGear: true };
}

export function spiderClimbPlan(system, key, check, input = {}) {
  const empty = { evidence: null, bonuses: [], blockedReason: "", notes: [] };
  const feats = system?.activeFeatNames ?? [];
  if (!climb(key, check) || !feats.includes("Spider Basics")) return empty;
  const kit = feats.includes("Spider Supremacy") && input.spiderClimbingKit === true;
  return {
    ...empty,
    evidence: kit ? { version: 1, source: "Spider Supremacy", climbingKit: true } : null,
    sizeBonus: kit ? 5 : 0,
    errorReduction: kit ? 1 : 0,
    notes: [
      loc`Spider Basics: no Hands-On or Vision penalty and no penalty for climbing without a kit (p.196).`,
      ...(kit
        ? [loc`Spider Supremacy: with a climbing kit, Climb DC −5 (applied as +5 here) and error range −1 (p.196).`]
        : [])
    ]
  };
}

rollPipeline.register({
  id: "spiderContent:skill",
  dialogs: ["skill"],
  dialog: ({ key, actor }) => [
    {
      at: 337,
      html:
        key === "athletics" && actor?.system?.activeFeatNames?.includes("Spider Supremacy")
          ? `<label><input name="spiderClimbingKit" type="checkbox" /> ${loc`Climb: using a climbing kit (Spider Supremacy: DC −5, error −1)`}</label>`
          : ""
    }
  ]
});

rollPipeline.register({
  id: "spiderSkillTerm",
  kinds: ["skill"],
  order: 9234,
  terms({ system, skillKey, check, input }) {
    const plan = spiderClimbPlan(system, skillKey, check, input ?? {});
    return { ...skillPlanTerm("spider", plan, { noteAt: 44 }), errorReduction: plan.errorReduction ?? 0 };
  }
});
