/**
 * Disposition on rolls (pp.457–458, Table 7.14): a check that targets an NPC takes the Intimacy or Fondness
 * modifiers for the NPC's disposition toward the character. Villains are immune. Under Diplomatic (p.406) player and
 * special characters add 1 more to a bonus from a favorable disposition.
 *
 * The disposition is chosen on the skill dialog (module/rolls/disposition-target.mjs fills it from the targeted NPC
 * when this client can read it); this module turns it into the check's terms.
 */
import { SKILLS } from "./tables.mjs";
import { campaignRules } from "./campaign-rules.mjs";
import { dispositionCheckModifier, dispositionGrade } from "./gc/disposition.mjs";
import { rollPipeline, skillPlanTerm } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

/** "Skill/Check" as Table 7.14's lists print it, e.g. "Impress/Persuasion". */
export function dispositionCheckLabel(skillKey, check) {
  const skill = SKILLS.find(entry => entry.key === skillKey);
  if (!skill || !check?.name) return "";
  return `${skill.name}/${String(check.name).replace(/\s+Check$/i, "")}`;
}

/** Whether a skill has a check that disposition modifies, so the dialog asks about the target. */
export const dispositionSkill = skillKey =>
  (SKILLS.find(entry => entry.key === skillKey)?.checks ?? []).some(
    check => dispositionCheckModifier("helpful", dispositionCheckLabel(skillKey, check)).kind
  );

export function dispositionSkillPlan(system, skillKey, check, input = {}, effects = campaignRules()) {
  const empty = { bonuses: [], notes: [], errorIncrease: 0, threatIncrease: 0 };
  const gradeId = input.targetDisposition;
  if (!gradeId) return empty;
  const label = dispositionCheckLabel(skillKey, check);
  const villain = input.targetVillain === true;
  const effect = dispositionCheckModifier(gradeId, label, { villain });
  if (villain && dispositionCheckModifier(gradeId, label).kind)
    return { ...empty, notes: [loc`The target is a villain: disposition does not apply (p.457).`] };
  if (!effect.kind) return empty;
  const grade = dispositionGrade(gradeId),
    kind = effect.kind === "intimacy" ? loc`Intimacy` : loc`Fondness`,
    who = input.targetName ? String(input.targetName) : loc`the target`;
  const bonuses = [],
    notes = [];
  if (effect.modifier)
    bonuses.push({ type: "", value: effect.modifier, source: loc`${grade.name} disposition (${kind})` });
  const special = !["standard", "animal"].includes(system?.npcType);
  const diplomatic = Math.trunc(Number(effects.favorableDispositionBonus) || 0);
  if (diplomatic && special && effect.modifier > 0)
    bonuses.push({ type: "", value: diplomatic, source: loc`Diplomatic` });
  const parts = [
    effect.modifier ? `${effect.modifier > 0 ? "+" : "−"}${Math.abs(effect.modifier)}` : "",
    effect.threat ? loc`threat range +${effect.threat}` : "",
    effect.error ? loc`error range +${effect.error}` : "",
    diplomatic && special && effect.modifier > 0 ? loc`+${diplomatic} Diplomatic` : ""
  ].filter(Boolean);
  if (parts.length)
    notes.push(loc`${who} is ${grade.name} toward you: ${kind} check ${parts.join(", ")} (Table 7.14, p.458).`);
  return { bonuses, notes, errorIncrease: effect.error, threatIncrease: effect.threat };
}

rollPipeline.register({
  id: "dispositionSkillTerm",
  kinds: ["skill"],
  order: 9325,
  terms({ system, skillKey, check, input }) {
    const plan = dispositionSkillPlan(system, skillKey, check, input ?? {});
    return {
      ...skillPlanTerm("disposition", plan, { noteAt: 991, bonusAt: 991 }),
      errorIncrease: plan.errorIncrease,
      threatIncrease: plan.threatIncrease
    };
  }
});

// Recorded on the posted check as the roll was given them.
rollPipeline.register({
  id: "dispositionRecord",
  order: 9735,
  record: ["targetDisposition", "targetVillain", "targetName"]
});
