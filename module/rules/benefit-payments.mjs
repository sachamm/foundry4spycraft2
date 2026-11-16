import {shakenActionDieCost} from './shaken.mjs';
import {multipartActionDicePlan} from './action-die-payments.mjs';
/** Quote after waivers. Explicit split allocations are for unrolled benefits; rolled benefits retain one primary die source. */
export function actionDieBenefitQuote(actor,{baseCost,benefitCount=1,bonusPoolId='',surchargeBonusPoolId='same',purpose='Action-die benefit',allocations,surchargeAllocations}={}){
 if(!Number.isSafeInteger(baseCost)||baseCost<0)throw new Error('Choose a whole nonnegative base action-die cost.');
 const system=actor.actionDiceFundingSystem;if(system.actionDieAwardReview?.needsReview||system.actionDiceSettlementReview?.needsReview)throw new Error('Resolve the interrupted action-die records before another benefit.');const cost=shakenActionDieCost(system,{baseCost,benefitCount});if(cost.blocked)throw new Error(cost.reason);
 if(allocations!==undefined&&!Array.isArray(allocations))throw new Error('Choose a valid split action-die payment.');
 if(surchargeAllocations!==undefined&&!Array.isArray(surchargeAllocations))throw new Error('Choose valid split surcharge contributions.');
 if(surchargeAllocations?.length){if(surchargeAllocations.length>32||surchargeAllocations.some(p=>!Number.isSafeInteger(p?.count)||p.count<1))throw new Error('Choose whole positive surcharge contributions.');const total=surchargeAllocations.reduce((n,p)=>n+(p?.count??NaN),0);if(!Number.isSafeInteger(total)||total!==cost.surcharge)throw new Error(`Surcharge contributions must total the ${cost.surcharge}-die fee.`);if(allocations?.length)throw new Error('Choose either a full split payment or split surcharge contributions.');}
 if(allocations?.length){if(allocations.length>32||allocations.some(p=>!Number.isSafeInteger(p?.count)||p.count<1))throw new Error('Choose whole positive payment contributions.');const total=allocations.reduce((n,p)=>n+(p?.count??NaN),0);if(!Number.isSafeInteger(total)||total!==cost.cost)throw new Error(`Split contributions must total the final ${cost.cost}-die cost.`);const parts=allocations.map(p=>({bonusPoolId:p.bonusPoolId??'',count:p.count,scope:'general'})),payment=multipartActionDicePlan(system,parts,{id:'benefitQuote',actorUuid:actor.uuid,periods:actor.usagePeriods,purpose});return {...cost,allocations:parts,payments:payment.payments};}
 if(!cost.cost)return {...cost,allocations:[],payments:[]};
 const feeSource=surchargeBonusPoolId==='same'||surchargeBonusPoolId===undefined?bonusPoolId:surchargeBonusPoolId;
 const selected=[...(baseCost?[{bonusPoolId,count:baseCost,scope:'general'}]:[]),...(surchargeAllocations?.length?surchargeAllocations.map(p=>({bonusPoolId:p.bonusPoolId??'',count:p.count,scope:'surcharge'})):cost.surcharge?[{bonusPoolId:feeSource,count:cost.surcharge,scope:'surcharge'}]:[])];
 const payment=multipartActionDicePlan(system,selected,{id:'benefitQuote',actorUuid:actor.uuid,periods:actor.usagePeriods,purpose});return {...cost,allocations:selected,payments:payment.payments};
}
