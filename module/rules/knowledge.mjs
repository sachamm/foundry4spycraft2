import { rollPipeline } from "./roll-pipeline.mjs";
import { cardSharkKnowledgePlan } from "./card-shark.mjs";
import { dartingStyleState } from "./darting-state.mjs";
import { superiorCoverState } from "./superior-cover.mjs";
import { twoWeaponStyleState, twoWeaponSkillNote } from "./two-weapon-state.mjs";
import { combatExpertiseState } from "./combat-expertise.mjs";
import { shakenRules } from "./shaken.mjs";
import { restraintActionBlock } from "./restraints.mjs";
import {
  skillBonusCondition,
  skillConditionEntries,
  skillConditionCheckPenalty,
  skillConditionCheckPenaltyEntries
} from "./skill-conditions.mjs";
import { skillPenaltyEntries, intrinsicSkillPenaltyDelta, skillPenaltyNotes } from "./skill-penalties.mjs";
import { attributeActionBlock } from "./attributes.mjs";
import { underwaterCheckPlan } from "./environment.mjs";
import { tenSecondSolutionEligible, cunningPlanEffect } from "./class-checks.mjs";
import { loc } from "../i18n.mjs";
import { campaignSkillChecks } from "./campaign-skills.mjs";
const normal = value =>
  String(value ?? "")
    .trim()
    .toLowerCase();
export function stackedBonuses(entries) {
  let total = 0;
  const groups = new Map();
  for (const e of entries)
    if (!e.type || e.type === "unnamed" || e.type === "dodge") total += e.value;
    else {
      const group = groups.get(e.type) ?? [];
      group.push(e.value);
      groups.set(e.type, group);
    }
  for (const group of groups.values()) total += Math.max(0, ...group) + Math.min(0, ...group);
  return total;
}
/** Knowledge, p.99; Basic Skill/mastery feats, pp.199–200; Ph.D., pp.42,86. */
export function resolveKnowledgeCheck(
  system,
  {
    skill,
    focus = "",
    modifier = 0,
    method = "roll",
    active = false,
    safeToTake = false,
    tenSecondSolution = false,
    standaloneCheckConfirmed = false,
    inComplexTask = false,
    inDramaticConflict = false,
    cunningPlan = false,
    underwater = false,
    gamblingKnowledge = "",
    topic = ""
  } = {}
) {
  const related = system.skillTotals?.[skill];
  if (!related)
    return {
      blocked: true,
      blockedReason: loc`Choose the one skill the GC considers relevant to the Knowledge check.`
    };
  const cardShark = cardSharkKnowledgePlan(system, { gamblingKnowledge, topic });
  const campaignChecks = campaignSkillChecks(system, skill, { id: "knowledge" });
  active = campaignChecks.policy?.active || active === true || cardShark.active;
  const photo = system.activeFeatNames?.includes("Photographic Memory"),
    taking = method === "take10" || method === "take20";
  const reasons = [];
  if (cardShark.blockedReason) reasons.push(cardShark.blockedReason);
  if (dartingStyleState(system).needsReview) reasons.push(dartingStyleState(system).reason);
  if (twoWeaponStyleState(system).needsReview) reasons.push(twoWeaponStyleState(system).reason);
  if (shakenRules(system).fixedResultsForbidden && taking)
    reasons.push(loc`Shaken: taking 10 or 20 is unavailable (p.342).`);
  if (system.baffledApplicationReview?.needsReview)
    reasons.push(loc`The GC must review the interrupted Baffled event before Knowledge checks.`);
  const restraint = restraintActionBlock(system, {
    passive: !active && !taking && method === "roll" && !cunningPlan && !tenSecondSolution,
    free: !active && !taking && method === "roll" && cunningPlan && !tenSecondSolution
  });
  if (restraint) reasons.push(restraint);
  const incapacity = attributeActionBlock(system, {
    kind: "knowledge",
    passiveAction: !active && !taking && method === "roll" && !cunningPlan && !tenSecondSolution
  });
  if (incapacity) reasons.push(incapacity);
  if (!["roll", "take10", "take20"].includes(method)) reasons.push(loc`Unknown Knowledge check method.`);
  if ((taking || (active && !cardShark.active && !campaignChecks.policy?.active)) && !photo)
    reasons.push(loc`Active Knowledge checks and taking 10/20 require Photographic Memory.`);
  if (taking && !safeToTake) reasons.push(loc`Taking 10/20 requires being neither distracted nor endangered.`);
  if (
    tenSecondSolution &&
    !tenSecondSolutionEligible(system, {
      checkKind: "knowledge",
      ability: "int",
      checkMethod: method,
      standaloneCheckConfirmed,
      inComplexTask,
      inDramaticConflict
    })
  )
    reasons.push(
      loc`10-Second Solution requires Scientist 14, a rolled Knowledge check and confirmation it is outside Complex Tasks and Dramatic Conflicts.`
    );
  let cunning = null;
  if (cunningPlan)
    try {
      cunning = cunningPlanEffect(system, 1);
    } catch (e) {
      reasons.push(e.message);
    }
  const owned =
    !related.focus ||
    (system.focusTotals?.[skill] ?? system.focuses?.[skill] ?? []).some(value => normal(value) === normal(focus));
  const rankSynergy = owned ? Math.min(5, Math.floor(related.ranks / 5)) : 0;
  const phdSynergy = owned && system.knowledgePhdSkills?.includes(skill) ? Math.floor(related.ranks / 2) : 0;
  const synergy = Math.max(rankSynergy, phdSynergy);
  const effects = (system.knowledgeSkillEffects ?? []).filter(
    effect => effect.skill === skill && (!effect.focus || normal(effect.focus) === normal(focus))
  );
  const base = skillConditionEntries(system, system.knowledgeBonusEntries ?? []),
    skillBonusEntries = skillPenaltyEntries(system, [...base, ...effects.filter(effect => effect.kind === "misc")]),
    bonus =
      stackedBonuses(skillBonusEntries) -
      stackedBonuses(base) +
      intrinsicSkillPenaltyDelta(system, "int", system.misc?.knowledge ?? 0);
  const underwaterContext = underwaterCheckPlan(system, { underwater, kind: "knowledge" });
  const checkBonusEntries = [{ type: "synergy", value: synergy }],
    penaltyRows = [
      { label: loc`Situational modifier`, value: Number(modifier) || 0 },
      { label: loc`Underwater`, value: underwaterContext.penalty },
      ...skillConditionCheckPenaltyEntries(system, "int")
    ],
    checkAdjustment = skillPenaltyEntries(system, penaltyRows).reduce((n, row) => n + row.value, 0);
  const normalSkillBonus =
      (system.knowledgeStandardBonus ?? (system.knowledge ?? 0) - skillConditionCheckPenalty(system, "int")) + bonus,
    condition = skillBonusCondition(system, normalSkillBonus),
    skillBonus = condition.total,
    total =
      skillBonus +
      stackedBonuses([...skillBonusEntries, ...checkBonusEntries]) -
      stackedBonuses(skillBonusEntries) +
      checkAdjustment;
  const requiredTimeSeconds = tenSecondSolution ? 6 : method === "take10" ? 6 : method === "take20" ? 60 : 0;
  const photographicMemory = photo
    ? {
        version: 1,
        source: "Photographic Memory",
        mode: active ? "active" : "passive",
        method,
        requiredSeconds: requiredTimeSeconds
      }
    : null;
  const threat = Math.min(
    photo ? 19 : 20,
    ...effects.filter(effect => effect.kind === "baseThreat").map(effect => effect.value)
  );
  const result = {
    photographicMemory,
    requiredTimeSeconds,
    cardSharkKnowledge: cardShark.evidence ?? null,
    underwaterContext,
    normalSkillBonus,
    skillBonusCondition: condition,
    skillBonus,
    skillBonusEntries,
    checkBonusEntries,
    checkAdjustment,
    cunningPlan: cunning,
    blocked: reasons.length > 0,
    blockedReason: reasons.join(" "),
    method,
    fixedDie: method === "take10" ? 10 : method === "take20" ? 20 : null,
    total,
    synergy,
    threat: taking ? 0 : threat,
    error: taking ? 0 : (cunning?.error ?? 1),
    cap: null,
    timeMultiplier: tenSecondSolution ? 0.5 : 1,
    minimumTimeSeconds: requiredTimeSeconds,
    timeRounding: tenSecondSolution ? "down" : null,
    actionDiceAllowed: !taking && active,
    rollMode: active ? undefined : "blindroll",
    notes:
      skillPenaltyNotes(system, [
        ...penaltyRows,
        ...base.map(row => ({ label: row.source ?? loc`Knowledge modifier`, value: row.value })),
        { label: loc`Intelligence modifier`, value: system.abilities?.int?.mod ?? 0 },
        { label: loc`Knowledge misc.`, value: system.misc?.knowledge ?? 0 }
      ]) +
      loc`${cardShark.active ? loc`Card Shark: this confirmed gambling Knowledge question is active (pp.201–202). ` : ""}${dartingStyleState(system).active ? loc`Darting Weapon: attack/skill check penalty −${dartingStyleState(system).penalty}. ` : ""}${superiorCoverState(system).active ? loc`Superior Cover: attack/skill check penalty −2. ` : ""}${twoWeaponSkillNote(system)}${combatExpertiseState(system).active ? loc`Combat Expertise: skill check penalty −${combatExpertiseState(system).penalty}. ` : ""}${condition.state ? loc`${condition.state === "baffled" ? loc`Baffled` : loc`Incompetent`}: Knowledge bonus ${condition.normal} → ${condition.total}; synergy/check modifiers remain. ` : ""}${underwaterContext.notes.length ? underwaterContext.notes.join(" ") + " " : ""}${cunning ? loc`Cunning Plan: free action; error range 1 → ${cunning.error}. ` : ""}${tenSecondSolution ? loc`10-Second Solution: half standard time, rounded down, minimum 1 full action` : method === "take10" ? loc`1 round` : method === "take20" ? loc`1 minute` : loc`Free action`}. ${active ? loc`Active` : loc`Passive`}. Related skill: ${related.name ?? skill}; synergy +${synergy}${owned ? "" : loc`; no rank synergy without the applicable focus`}. Rules p.99.`
  };
  return {
    ...result,
    campaignSkillChecks: campaignChecks.evidence,
    notes: [...campaignChecks.notes, result.notes].join(" ")
  };
}

// Recorded on the posted check as the roll was given them.
rollPipeline.register({ id: "knowledgeRecord", order: 9705, record: ["photographicMemory"] });
