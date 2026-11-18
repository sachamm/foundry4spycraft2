/**
 * The Grapple action's opposed Athletics (Str) check as a named check (p.357), so grapple feats apply to it:
 * - Prone Stance (Submission Basics, p.188): +1 on skill checks made as part of a Grapple action.
 * - Horde Mastery (p.174): +1 morale on them, with a GC-confirmed 2-to-1 or greater advantage.
 * - Garrote Basics (p.178): threat range +2 while holding a readied garrote (declared); an opponent the character
 *   holds becomes mute.
 * The bonuses also apply to escaping a hold or breaking a pin. The opposed result is settled on the grapple card.
 */
import { rollPipeline, skillPlanTerm } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

export const GRAPPLE_CHECK = Object.freeze({
  id: "grapple",
  name: "Grapple (opposed)",
  attributes: ["str"],
  mode: "Active",
  tags: "Armor Check Penalty, Grasp",
  time: "1 Full Action",
  error: 1,
  page: 357,
  synergies: [],
  synergyText: ""
});

export function grappleSkillChecks(key, checks = []) {
  return key === "athletics" ? [...checks.filter(c => c.id !== "grapple"), { ...GRAPPLE_CHECK }] : checks;
}

export function grappleCheckPlan(
  system,
  key,
  check,
  { grappleAdvantageConfirmed = false, grappleGarrote = false, grappleJointLock = false } = {}
) {
  const empty = { evidence: null, bonuses: [], blockedReason: "", notes: [], threatIncrease: 0 };
  if (key !== "athletics" || !["grapple", "restraint-escape"].includes(check?.id)) return empty;
  const feats = system?.activeFeatNames ?? [],
    proneStance = system.combatStance?.key === "prone" && feats.includes("Submission Basics"),
    horde = feats.includes("Horde Mastery") && grappleAdvantageConfirmed === true,
    garrote = feats.includes("Garrote Basics") && grappleGarrote === true,
    // Joint Lock (Submission Moves, p.188): the grappler's trick gives −4 to this character's escape checks.
    jointLock = check.id === "restraint-escape" && grappleJointLock === true;
  const bonuses = [
      ...(proneStance ? [{ source: "Prone Stance (Grapple)", value: 1 }] : []),
      ...(horde ? [{ source: "Horde Mastery (Grapple)", type: "morale", value: 1 }] : []),
      ...(jointLock ? [{ source: "Joint Lock", value: -4 }] : [])
    ],
    notes = [
      ...(proneStance ? [loc`Prone Stance: +1 on this Grapple check (p.188).`] : []),
      ...(horde ? [loc`Horde Mastery: +1 morale with a 2-to-1 or greater advantage (p.174).`] : []),
      ...(garrote
        ? [loc`Garrote Basics: threat range +2 with the readied garrote; an opponent you hold becomes mute (p.178).`]
        : []),
      ...(jointLock ? [loc`Joint Lock: −4 on this escape check (p.188).`] : [])
    ];
  return {
    ...empty,
    evidence:
      bonuses.length || garrote ? { version: 1, proneStance, horde, garrote, jointLock, checkId: check.id } : null,
    bonuses,
    notes,
    threatIncrease: garrote ? 2 : 0
  };
}

rollPipeline.register({
  id: "grappleChecks",
  order: 5058,
  kinds: ["skill"],
  skillChecks: ({ skillKey }, checks) => grappleSkillChecks(skillKey, checks)
});

rollPipeline.register({
  id: "grappleContent:skill",
  dialogs: ["skill"],
  dialog: ({ key, actor }) => {
    const feats = actor?.system?.activeFeatNames ?? [];
    if (key !== "athletics") return [];
    return [
      {
        at: 207,
        html: `<details><summary>${loc`Grapple feats`}</summary><label><input name="grappleJointLock" type="checkbox" /> ${loc`Escaping: my grappler used Joint Lock on me (−4)`}</label>${feats.includes("Horde Mastery") ? `<label><input name="grappleAdvantageConfirmed" type="checkbox" /> ${loc`Horde Mastery: the GC confirms a 2-to-1 or greater advantage`}</label>` : ""}${feats.includes("Garrote Basics") ? `<label><input name="grappleGarrote" type="checkbox" /> ${loc`Garrote Basics: I hold a readied garrote`}</label>` : ""}</details>`
      }
    ];
  }
});

rollPipeline.register({
  id: "grappleSkillTerm",
  kinds: ["skill"],
  order: 9237,
  terms({ system, skillKey, check, input }) {
    const plan = grappleCheckPlan(system, skillKey, check, input ?? {});
    return {
      ...skillPlanTerm("grappleFeats", plan, { noteAt: 47, bonusAt: 123 }),
      threatIncrease: plan.threatIncrease
    };
  }
});
