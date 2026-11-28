import { attributeActionBlock } from "./attributes.mjs";
import { restraintActionBlock, restraintSkillContext } from "./restraints.mjs";
import { skillConditionCheckPenaltyEntries } from "./skill-conditions.mjs";
import { campaignSkillPolicy } from "./campaign-skills.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
import { skillTimingPlan } from "./timing.mjs";
import { skillTagPlan } from "./skill-tags.mjs";
import { sensorySkillConditionPlan } from "./senses.mjs";

/** NPC named checks keep their actual category, legal action and shared check penalties. */
export function npcSkillActionPlan(system, key, check, ability, input = {}, { preserveMode = false } = {}) {
  const restraint = restraintSkillContext(system, key, check, input),
    named = { ...check, id: check?.id ?? "", tags: check?.tags ?? "" },
    tags = skillTagPlan(system, key, named, input),
    senses = sensorySkillConditionPlan(system, named, input),
    mode = !preserveMode && campaignSkillPolicy(system)?.active ? "Active" : (check?.mode ?? "Active"),
    passive = mode.includes("Passive"),
    blockedReason =
      restraint.blockedReason ||
      tags.blockedReason ||
      senses.blockedReason ||
      restraintActionBlock(system, {
        passive,
        free: /free action/i.test(restraint.check?.time ?? ""),
        escape: restraint.escape && ability === "str",
        grapple:
          key === "athletics" &&
          named.id === "grapple" &&
          ability === "str" &&
          input.grappleParticipantConfirmed === true
      }) ||
      attributeActionBlock(system, {
        kind: "skill",
        ability,
        passiveAction: passive,
        purelyMentalConfirmed: input.purelyMentalConfirmed === true
      }) ||
      (system.baffledApplicationReview?.needsReview
        ? loc`The GC must review the interrupted Baffled event before skill checks.`
        : "") ||
      ((system.conditionContext?.entangled || system.conditionContext?.bound) &&
      key === "acrobatics" &&
      ["jump", "tumble"].includes(check?.id)
        ? loc`Entangled/Bound: Jump and Tumble checks are unavailable.`
        : "");
  return {
    mode,
    passive,
    blockedReason,
    restraint,
    tags,
    senses,
    capAdjustment: tags.capAdjustment + senses.capAdjustment,
    ...(restraint.escape ? { skillTiming: skillTimingPlan({ method: "roll", time: restraint.check.time }) } : {}),
    actionDiceAllowed: !passive,
    ...(passive || mode === "Secret" || (mode.includes("Secret") && input.secret === true)
      ? { rollMode: "blindroll" }
      : {}),
    penalties: [
      ...skillConditionCheckPenaltyEntries(system, ability).filter(row => row.key !== "shaken"),
      { label: loc`One-handed Hands-On check`, value: tags.handPenalty },
      { label: loc`Sight/hearing condition`, value: senses.skillModifier }
    ],
    evidence: {
      version: 1,
      skillKey: key,
      checkId: check?.id ?? "",
      ability,
      mode,
      tags,
      senses,
      conditions: structuredClone(system.conditionContext ?? {}),
      abilityModifier: system.abilities?.[ability]?.mod ?? 0,
      restraint: {
        state: restraint.state,
        escape: restraint.escape,
        sizeDifference: restraint.sizeDifference ?? null,
        proficient: restraint.proficient ?? null
      },
      pendingMoves: (system.pendingRestraintMoves ?? []).map(row => row.id),
      purelyMentalConfirmed: input.purelyMentalConfirmed === true
    }
  };
}
rollPipeline.register({ id: "npcSkillContextRecord", order: 9736, record: ["npcSkillContext"] });
