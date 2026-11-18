/**
 * Mingling Basics, Mastery and Supremacy, p.195, on Blend/Stealth checks.
 *
 * - Basics: in public, a synergy bonus equal to the crowd's Size Rating (p.102; the dialog asks for it).
 *   Failing the check does not leave the character flat-footed. (Blend/Stealth already offers Dexterity.)
 * - Mastery: balancing, moving and speaking penalties halved; no Disposition tag; in a crowd of 500+ a success makes
 *   the character invisible rather than hidden.
 * - Supremacy: no balancing, moving or speaking penalties; team and sparse/barren terrain penalties halved; the
 *   invisible threshold falls to a crowd of 50+.
 * Penalties the dialog does not itemise stay with the GC; the card states which apply.
 */
import { rollPipeline, skillPlanTerm } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

const blendStealth = (key, check) => key === "blend" && check?.id === "stealth";

export function minglingPlan(system, key, check, input = {}) {
  const empty = { evidence: null, blockedReason: "", notes: [], bonuses: [] };
  const feats = system?.activeFeatNames ?? [];
  if (!blendStealth(key, check) || !feats.includes("Mingling Basics")) return empty;
  const raw = input.minglingCrowdRating,
    rating = raw === undefined || raw === null || raw === "" ? 0 : Number(raw);
  if (!Number.isSafeInteger(rating) || rating < 0 || rating > 10)
    return { ...empty, blockedReason: loc`Enter the crowd’s Size Rating as a whole number from 0 to 10.` };
  const supremacy = feats.includes("Mingling Supremacy"),
    mastery = supremacy || feats.includes("Mingling Mastery");
  const notes = [
    loc`Mingling Basics: a failed Stealth check does not leave you flat-footed (p.195).`,
    ...(mastery && !supremacy
      ? [
          loc`Mingling Mastery: balancing, moving and speaking penalties are halved, rounded down; no Disposition tag; with success in a crowd of 500 or more you are invisible rather than hidden.`
        ]
      : []),
    ...(supremacy
      ? [
          loc`Mingling Supremacy: no balancing, moving or speaking penalties; team and sparse or barren terrain penalties halved, rounded down; no Disposition tag; with success in a crowd of 50 or more you are invisible rather than hidden.`
        ]
      : [])
  ];
  return {
    evidence: rating ? { version: 1, source: "Mingling Basics", crowdRating: rating } : null,
    blockedReason: "",
    notes,
    bonuses: rating ? [{ source: "Mingling Basics (crowd)", type: "synergy", value: rating }] : []
  };
}

rollPipeline.register({
  id: "minglingContent:skill",
  dialogs: ["skill"],
  dialog: ({ key, actor }) => [
    {
      at: 335,
      html:
        key === "blend" && actor?.system?.activeFeatNames?.includes("Mingling Basics")
          ? `<label>${loc`Mingling: the public crowd’s Size Rating (0 when not in public; p.102)`} <input name="minglingCrowdRating" type="number" min="0" max="10" step="1" value="0" /></label>`
          : ""
    }
  ]
});

rollPipeline.register({
  id: "minglingSkillTerm",
  kinds: ["skill"],
  order: 9231,
  terms({ system, skillKey, check, input }) {
    return skillPlanTerm("mingling", minglingPlan(system, skillKey, check, input ?? {}), {
      noteAt: 41,
      blockAt: 21,
      bonusAt: 121
    });
  }
});
