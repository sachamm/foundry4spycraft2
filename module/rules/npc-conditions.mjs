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
/** Each condition the rules read, with the status ids on a token that set it (pp.340–342). */
export const CONDITION_STATUSES = Object.freeze({
  nauseated: ["nauseated"],
  dazed: ["dazed"],
  stunned: ["stunned", "stun"],
  dead: ["dead"],
  paralyzed: ["paralyzed", "paralysis"],
  fatigued: ["fatigued"],
  exhausted: ["exhausted"],
  unconscious: ["unconscious"],
  helpless: ["helpless"],
  vulnerable: ["vulnerable"],
  sickened: ["sickened"],
  drunk: ["drunk"],
  crouched: ["crouched", "crouching"],
  mute: ["mute"],
  baffled: ["baffled"],
  incompetent: ["incompetent"],
  entangled: ["entangled"],
  bound: ["bound"],
  blinded: ["blinded", "blind"],
  deafened: ["deafened", "deaf"],
  flatFooted: ["flat-footed", "flatFooted"],
  sprawled: ["sprawled"],
  prone: ["prone"],
  held: ["held"],
  pinned: ["pinned"],
  sleeping: ["sleeping", "sleep", "asleep"]
});
/** The condition flags for a set of status ids. Agents and NPCs read the same map. */
export function conditionContextFromStatuses(statuses) {
  const has = id => statuses?.has?.(id) === true;
  return Object.fromEntries(Object.entries(CONDITION_STATUSES).map(([key, ids]) => [key, ids.some(has)]));
}
export { actorConditionContext as npcSkillConditionContext } from "./condition-context.mjs";
