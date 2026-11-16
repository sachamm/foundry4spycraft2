import {jinxUseSpec,jinxUseProof} from '../rules/jinx.mjs';
import {resourceUsePlan} from '../rules/limited-uses.mjs';
import {getActionDieSettlementReview,setPendingActionDieReview} from '../rules/action-die-payments.mjs';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),state=a=>({...a.system,usagePeriods:a.usagePeriods});
/** The critical controller already holds both actor resource locks. Do not nest another queue. */
export async function withJinxReservation(payer,plan,message,perform,{validateCost=()=>{}}={}){
 if(getActionDieSettlementReview(payer).needsReview)throw new Error('Review the payer’s interrupted payment before using Jinx.');
 const spec=jinxUseSpec(state(payer)),use=spec&&resourceUsePlan(spec,payer.system.resourceUses,payer.usagePeriods,0);
 if(!spec||use.blocked)throw new Error(use?.reason??'Jinx is no longer available.');
 const before=structuredClone(payer.system.resourceUses?.jinx),reserved=structuredClone(use.record),row={id:'jinx',before:before??null,reserved},receipt=()=>message.flags?.spycraft2?.criticalActivation?.jinx;
 const committed=()=>receipt()?.payerUuid===payer.uuid&&same(receipt().use,reserved);
 const guard=()=>{jinxUseProof(state(payer),plan.jinx,reserved);validateCost();};
 let reservedAttempted=false;
 const holdReview=async()=>{const review=getActionDieSettlementReview(payer);if(!review.needsReview)return false;const next={...review,limitedUseSettlement:[...(review.limitedUseSettlement??[]).filter(r=>r.id!=='jinx'),row]};setPendingActionDieReview(payer,next);try{await payer.update(payer.actorRecordRestorePatch('flags.spycraft2.actionDiceSettlementReview',next));}catch{ui.notifications.warn('Jinx and the interrupted payment remain reserved for the same GC review.');}return true;};
 const refund=async()=>{if(!same(payer.system.resourceUses?.jinx,reserved)){if(!same(payer.system.resourceUses?.jinx,before))ui.notifications.warn('Jinx’s reserved counter changed; the GC must review its actual use before correcting it.');return;}try{await payer.update(payer.actorRecordRestorePatch('system.resourceUses.jinx',before));}catch(error){if(!same(payer.system.resourceUses?.jinx,before)){ui.notifications.warn('The unused Jinx allowance could not be restored. Review its saved count before retrying.');throw error;}}};
 try{
  reservedAttempted=true;try{await payer.update({'system.resourceUses.jinx':reserved});}catch(error){if(!same(payer.system.resourceUses?.jinx,reserved))throw error;}
  guard();const result=await perform({record:reserved,settlement:row,guard});if(!committed()&&!await holdReview())await refund();return result;
 }catch(error){if(committed())return plan;if(!await holdReview()&&reservedAttempted)try{await refund();}catch(rollback){throw new AggregateError([error,rollback],'The failed Jinx reservation needs GC counter review.');}throw error;}
}
