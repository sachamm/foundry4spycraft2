import {conditionSkillPenalty,conditionRollPenalties} from './attributes.mjs';
/** pp.87,340,342: change the skill bonus, keeping check penalties and synergy separate. */
export function skillBonusCondition(system,normal){
 if(!Number.isFinite(normal))throw new Error('Review the skill bonus before applying its condition.');
 const c=system.conditionContext??{},state=c.incompetent===true?'incompetent':c.baffled===true?'baffled':'',total=state==='incompetent'?0:state==='baffled'?(Math.ceil(normal/2)||0):normal;
 return {state,normal,total,adjustment:total-normal};
}
export const skillConditionEntries=(system,entries=[])=>system.conditionContext?.sickened===true?entries.filter(e=>!(e.source==='Sickened'&&e.value===-2)):entries;
export const skillConditionCheckPenalty=(system,ability)=>conditionRollPenalties(system).skill+conditionSkillPenalty(system,ability);
export function substituteConditionedBonus(source,result,normal,preservedSkill,preservedCheck){
 const state=result.skillBonusCondition?.state||source.skillBonusCondition?.state||'',context={conditionContext:{[state]:true}},condition=skillBonusCondition(context,normal+preservedSkill),bonus=skillBonusCondition(context,normal).total;
 return {bonus,condition,preservedBonus:condition.total-bonus+preservedCheck};
}
