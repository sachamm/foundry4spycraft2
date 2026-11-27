import { SKILLS } from "./tables.mjs";
import { GC_DATA } from "./gc-tables.mjs";
import { dispositionCheckModifier, dispositionToward, DISPOSITIONS } from "./gc/disposition.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

const D = GC_DATA.core.disposition;
export function dispositionCheckName(key, check) {
  const skill = SKILLS.find(s => s.key === key),
    actual = skill?.checks.find(c => c.id === check?.id);
  return actual ? `${skill.name}/${actual.name.replace(/ Check$/, "")}` : "";
}
export function hasDispositionCheck(key) {
  return (
    SKILLS.find(s => s.key === key)?.checks.some(check => {
      const name = dispositionCheckName(key, check);
      return D.intimacyChecks.includes(name) || D.fondnessChecks.includes(name) || check.tags.includes("Disposition");
    }) ?? false
  );
}
export function dispositionSkillPlan(system, key, check, target = null) {
  const empty = {
    evidence: null,
    bonus: 0,
    penalty: 0,
    errorIncrease: 0,
    threatIncrease: 0,
    priority: 1,
    notes: [],
    blockedReason: ""
  };
  if (!target) return empty;
  if (target.combatPersuasion && (key !== "impress" || check?.id !== "persuasion"))
    return { ...empty, blockedReason: loc`The reserved combat attempt requires Impress/Persuasion.` };
  const name = dispositionCheckName(key, check),
    actual = SKILLS.find(s => s.key === key)?.checks.find(c => c.id === check?.id),
    applicable =
      D.intimacyChecks.includes(name) || D.fondnessChecks.includes(name) || actual?.tags.includes("Disposition");
  if (!applicable)
    return { ...empty, blockedReason: loc`Clear the selected disposition target for this unrelated skill use.` };
  if (
    target.confirmed !== true ||
    typeof target.actorUuid !== "string" ||
    !target.actorUuid ||
    typeof target.name !== "string" ||
    !target.name ||
    typeof target.actingActorId !== "string" ||
    !target.actingActorId ||
    typeof target.actingActorUuid !== "string" ||
    !target.actingActorUuid ||
    target.type !== "npc" ||
    target.npcType === "villain" ||
    target.sceneEffects === true
  )
    return {
      ...empty,
      blockedReason: loc`Confirm an actual NPC target and the acting character. PC/villain disposition shifts require their separate scene effects.`
    };
  const gradeId = dispositionToward(target.disposition, target.actingActorId),
    grade = DISPOSITIONS.find(g => g.id === gradeId);
  if (!grade) return { ...empty, blockedReason: loc`Review the target NPC's saved disposition grade.` };
  const effect = dispositionCheckModifier(gradeId, name),
    special =
      !system.npcType ||
      ["special", "villain"].includes(system.npcType) ||
      system.promoted === true ||
      system.promotion?.mission === String(system.usagePeriods?.mission ?? "initial"),
    diplomatic = special && effect.modifier > 0 ? (system.campaignEffects?.positiveDispositionBonus ?? 0) : 0;
  if (!Number.isSafeInteger(diplomatic) || diplomatic < 0)
    throw Error(loc`Review the campaign's favorable-disposition skill bonus.`);
  const modifier = effect.modifier + diplomatic,
    priority = actual.tags.includes("Disposition") ? (gradeId === "supportive" ? 1 / 3 : grade.priority) : 1,
    evidence = {
      version: 1,
      skillKey: key,
      checkId: check.id,
      targetActorUuid: target.actorUuid,
      targetName: target.name,
      actingActorId: target.actingActorId,
      actingActorUuid: target.actingActorUuid,
      targetConfirmed: true,
      grade: gradeId,
      kind: effect.kind,
      modifier: effect.modifier,
      diplomatic,
      errorIncrease: effect.error,
      threatIncrease: effect.threat,
      priority,
      ...(target.combatPersuasion ? { combatPersuasion: { ...target.combatPersuasion } } : {})
    };
  return {
    evidence,
    bonus: Math.max(0, modifier),
    penalty: Math.min(0, modifier),
    errorIncrease: effect.error,
    threatIncrease: effect.threat,
    priority,
    blockedReason: "",
    notes: [
      loc`${target.name}: ${grade.name} disposition; check modifier ${modifier}, error range +${effect.error}, threat range +${effect.threat}, required-time multiplier ${priority}.`
    ]
  };
}

rollPipeline.register({ id: "dispositionSkillsRecord", order: 9771.5, record: ["dispositionSkill"] });
