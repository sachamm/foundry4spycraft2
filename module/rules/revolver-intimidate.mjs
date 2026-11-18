/** Revolver Basics, p.182: +4 gear on Intimidate checks while holding a readied revolver loaded with only 1 shot. */
import { rollPipeline, skillPlanTerm } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

export function revolverIntimidatePlan(system, key, { revolverOneShot = false } = {}) {
  const empty = { evidence: null, bonuses: [], blockedReason: "", notes: [] };
  if (key !== "intimidate" || revolverOneShot !== true || !system?.activeFeatNames?.includes("Revolver Basics"))
    return empty;
  return {
    evidence: { version: 1, source: "Revolver Basics", bonus: 4 },
    bonuses: [{ source: "Revolver Basics (one shot left)", type: "gear", value: 4 }],
    blockedReason: "",
    notes: [loc`Revolver Basics: +4 gear with a readied revolver holding only 1 shot (p.182).`]
  };
}

rollPipeline.register({
  id: "revolverIntimidateContent:skill",
  dialogs: ["skill"],
  dialog: ({ key, actor }) => [
    {
      at: 208,
      html:
        key === "intimidate" && actor?.system?.activeFeatNames?.includes("Revolver Basics")
          ? `<label><input name="revolverOneShot" type="checkbox" /> ${loc`Revolver Basics: I hold a readied revolver with only 1 shot in it (+4)`}</label>`
          : ""
    }
  ]
});

rollPipeline.register({
  id: "revolverIntimidateSkillTerm",
  kinds: ["skill"],
  order: 9238,
  terms({ system, skillKey, input }) {
    return skillPlanTerm("revolverIntimidate", revolverIntimidatePlan(system, skillKey, input ?? {}), {
      noteAt: 48,
      bonusAt: 124
    });
  }
});
