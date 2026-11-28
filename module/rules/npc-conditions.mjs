import { skillBonusCondition } from "./skill-conditions.mjs";
import { TABLES } from "./tables.mjs";
import { stepLookup } from "./formula.mjs";
/** NPC effective ranks equal their current skill/Competence bonus (p.452). */
export function conditionNpcSkillBonus(row, conditionContext = {}) {
  const normalBonus = row.normalBonus ?? row.bonus,
    normalCompetence = row.normalCompetence ?? row.competence,
    normalListed = row.normalListed ?? row.listed;
  const skillCondition = skillBonusCondition({ conditionContext }, normalBonus),
    competence = skillBonusCondition({ conditionContext }, normalCompetence).total,
    listed = normalListed === null ? null : skillBonusCondition({ conditionContext }, normalListed).total;
  return {
    ...row,
    normalBonus,
    normalCompetence,
    normalListed,
    skillCondition,
    competence,
    listed,
    bonus: skillCondition.total,
    ranks: skillCondition.total,
    cap: stepLookup(TABLES.skillCap, skillCondition.total)
  };
}
export function conditionNpcProfile(result, conditionContext = {}) {
  if (!Number.isFinite(result.competence)) return result;
  const normalCompetence = result.normalCompetence ?? result.competence,
    competenceCondition = skillBonusCondition({ conditionContext }, normalCompetence);
  return {
    ...result,
    normalCompetence,
    competence: competenceCondition.total,
    competenceCondition,
    skills: result.skills.map(row => conditionNpcSkillBonus(row, conditionContext))
  };
}
export { actorConditionContext as npcSkillConditionContext } from "./condition-context.mjs";
