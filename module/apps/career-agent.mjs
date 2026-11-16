import {careerAgentRewardSource,careerAgentRewardPlan,careerAgentMissionKey,getCareerAgentReview,careerAgentReviewPlan} from '../rules/career-agent.mjs';
import {queueResources} from '../rules/transactions.mjs';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const numberInput=value=>typeof value==='number'?value:typeof value==='string'&&value.trim()?Number(value):NaN;
function requireGC(actor){if(!game.user?.isGM||!actor.isOwner||actor.type!=='agent')throw new Error('Only an owning GC may settle or correct this mission reward.');}
const state=actor=>({...actor.system,usagePeriods:actor.usagePeriods});
async function holdReview(actor,transaction,error){
 const review={needsReview:true,id:transaction.record.id,transaction,reason:error.message,at:game.time?.worldTime??0};game.spycraft2??={};game.spycraft2.pendingCareerAgentRewards??={};game.spycraft2.pendingCareerAgentRewards[actor.uuid]=review;
 try{await actor.update({'flags.spycraft2.careerAgentRewardReview':review});}catch{ui.notifications.warn('The reward review could not be saved. Keep this actor open and verify the balances with the GC before reloading.');}
 ui.notifications.warn('The Career Agent reward needs GC review. Check the actual resource balances and mission receipt before retrying.');return {needsReview:true,id:review.id};
}
export async function useCareerAgentReward(actor,options={}){
 requireGC(actor);if(getCareerAgentReview(actor).needsReview)throw new Error('Review the interrupted Career Agent reward before granting another.');
 const context=()=>{const s=state(actor),source=careerAgentRewardSource(s),key=careerAgentMissionKey(s);return JSON.stringify({source,key,balance:s[source.field],reward:s.careerAgentRewards?.[key]??null});},expected=context(),source=careerAgentRewardSource(state(actor));let input=options;
 if(!Object.keys(input).length){input=await foundry.applications.api.DialogV2.input({window:{title:'Career Agent: mission-end reward'},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>Additional mission reward: ${source.field==='reputation'?'+1 Reputation':'+$50,000 Net Worth'}, determined by this character’s affiliation. This does not grant the ordinary mission reward or XP.</p><label><input name="missionCompleteConfirmed" type="checkbox" /> The mission has ended</label><label><input name="activeAtMissionEndConfirmed" type="checkbox" /> Career Agent was active when the mission ended</label></div>`});if(!input)return null;}
 return queueResources([actor],async()=>{
  requireGC(actor);if(getCareerAgentReview(actor).needsReview)throw new Error('Review the interrupted Career Agent reward first.');if(context()!==expected)throw new Error('The affiliation, mission, source or balance changed while preparing this reward.');
  const transaction=careerAgentRewardPlan(state(actor),{...input,id:foundry.utils.randomID(),at:game.time?.worldTime??0}),{key,field,before,after,record}=transaction,current=()=>actor.system.careerAgentRewards?.[key]??null;
  try{await actor.update({['system.'+field]:after,['system.careerAgentRewards.'+key]:record});}
  catch(error){if(!same(current(),record)||actor.system[field]!==after){if(current()===null&&actor.system[field]===before)throw error;return holdReview(actor,transaction,error);}}
  if(!same(current(),record)||actor.system[field]!==after)return holdReview(actor,transaction,new Error('The saved Career Agent grant is incomplete.'));
  try{return await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),content:`Career Agent: additional ${field==='reputation'?'+1 Reputation':'+$50,000 Net Worth'} for the completed mission. ${field==='reputation'?'Reputation':'Net Worth'}: ${before} → ${after}.`,flags:{spycraft2:{actorUuid:actor.uuid,checkKind:'careerAgentReward',careerAgentReward:record,actionDiceAllowed:false}}});}
  catch(error){const posted=game.messages?.find?.(m=>m.flags?.spycraft2?.actorUuid===actor.uuid&&m.flags.spycraft2.careerAgentReward?.id===record.id);if(posted)return posted;
   if(!same(current(),record)||actor.system[field]!==after)return holdReview(actor,transaction,error);
   try{await actor.update({['system.'+field]:before,['system.careerAgentRewards.-='+key]:null});}catch(rollback){if(actor.system[field]!==before||current()!==null)return holdReview(actor,transaction,new AggregateError([error,rollback],'The Career Agent reward could not be safely restored.'));}throw error;
  }
 });
}
export async function reviewCareerAgentReward(actor,options={}){
 requireGC(actor);const saved=getCareerAgentReview(actor);if(!saved.needsReview)return null;
 const snapshot=()=>JSON.stringify({review:getCareerAgentReview(actor),reputation:actor.system.reputation,netWorth:actor.system.netWorth,rewards:actor.system.careerAgentRewards}),expected=snapshot(),esc=foundry.utils.escapeHTML;let input=options;
 if(!Object.keys(input).length){input=await foundry.applications.api.DialogV2.input({window:{title:'Review Career Agent reward'},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>${esc(saved.reason)}</p><p>Review the actual balances and any posted receipt. Enter final balances; this control does not add the reward again.</p><label>Reputation <input name="reputation" type="number" step="1" value="${actor.system.reputation}" /></label><label>Net Worth <input name="netWorth" type="number" step="1" value="${actor.system.netWorth}" /></label><label>Mission reward <select name="retainReward"><option value="retain">Keep recorded: prevent another claim</option><option value="clear">Clear: allow a later claim</option></select></label><label>Resolution / source <input name="reason" maxlength="1000" required /></label><label><input name="confirmed" type="checkbox" /> I confirmed both actual balances and the mission reward disposition</label></div>`});if(!input)return null;input={...input,reputation:numberInput(input.reputation),netWorth:numberInput(input.netWorth),retainReward:input.retainReward==='retain'?true:input.retainReward==='clear'?false:null};}
 return queueResources([actor],async()=>{requireGC(actor);if(snapshot()!==expected)throw new Error('The resource balances or reward history changed during review.');const plan=careerAgentReviewPlan(getCareerAgentReview(actor),input),reviewed={...saved,needsReview:false,resolution:plan.reason,reviewedBy:game.user.id,reviewedAt:game.time?.worldTime??0};
  const patch={'system.reputation':plan.reputation,'system.netWorth':plan.netWorth,'flags.spycraft2.careerAgentRewardReview':reviewed,...(plan.record?{['system.careerAgentRewards.'+plan.key]:{...plan.record,reviewedBy:game.user.id,reviewedAt:game.time?.worldTime??0}}:{['system.careerAgentRewards.-='+plan.key]:null})};
  const committed=()=>actor.system.reputation===plan.reputation&&actor.system.netWorth===plan.netWorth&&same(actor.flags?.spycraft2?.careerAgentRewardReview,reviewed)&&(plan.record?same(actor.system.careerAgentRewards?.[plan.key],patch['system.careerAgentRewards.'+plan.key]):!actor.system.careerAgentRewards?.[plan.key]);
  try{await actor.update(patch);}catch(error){if(!committed()){await holdReview(actor,saved.transaction,error);throw error;}}
  if(!committed()){const error=new Error('The Career Agent review did not save all final balances and reward history.');await holdReview(actor,saved.transaction,error);throw error;}
  if(game.spycraft2?.pendingCareerAgentRewards)delete game.spycraft2.pendingCareerAgentRewards[actor.uuid];return reviewed;
 });
}
