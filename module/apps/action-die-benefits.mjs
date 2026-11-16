import {shakenRules} from '../rules/shaken.mjs';
import {unrestrictedBonusPools} from '../rules/bonus-pools.mjs';
import {actionDieBenefitQuote} from '../rules/benefit-payments.mjs';
export function surchargeFundingControl(actor,{benefitCount=1,perBenefit=false}={}){
 const rules=shakenRules(actor.actionDiceFundingSystem);if(!rules.extraDice||rules.spendingForbidden)return '';
 const esc=foundry.utils.escapeHTML,pools=unrestrictedBonusPools(actor.actionDiceFundingSystem,actor.usagePeriods).filter(p=>p.available);return `<p>Shaken adds ${perBenefit?`${rules.extraDice} extra action dice for each distinct paid benefit selected here`:`${rules.extraDice*benefitCount} extra action dice to this activation`}. Surcharge dice do not increase its benefit.</p><label>Surcharge funding <select name="surchargeBonusPoolId"><option value="same">Same source as the benefit dice</option><option value="">Ordinary action dice</option>${unrestrictedBonusPools(actor.actionDiceFundingSystem,actor.usagePeriods).filter(p=>p.available).map(p=>`<option value="${esc(p.id)}">${esc(p.label)}: ${p.available} d${p.die}</option>`).join('')}</select></label>${splitSurchargeFundingControl(actor)}`;
}
/** Caller holds this actor's resource transaction; existing zero-fee workflows retain their settlement behavior. */
export async function payActionDieBenefitLocked(actor,baseCost,perform,{benefitCount=1,bonusPoolId='',surchargeBonusPoolId='same',purpose='Action-die benefit',benefit='actionDieBenefit',expectedShaken=null,message=null,details={},allocations,surchargeAllocations}={}){
 if(!actor.isOwner)throw new Error('You must own the character spending action dice.');
 if(expectedShaken!==null&&JSON.stringify(shakenRules(actor.actionDiceFundingSystem))!==expectedShaken)throw new Error('The Shaken condition changed. Confirm this activation and its current cost again.');
 const shakenSignature=JSON.stringify(shakenRules(actor.actionDiceFundingSystem));
 let quote;try{quote=actionDieBenefitQuote(actor,{baseCost,benefitCount,bonusPoolId,surchargeBonusPoolId,purpose,allocations,surchargeAllocations});}catch(error){return ui.notifications.warn(error.message);}
 if(!quote.cost)return perform(null);
 const run=payment=>perform({...payment,baseCost,benefitCount,surcharge:quote.surcharge,cost:quote.cost,shakenSignature});
 if(!quote.surcharge&&!allocations?.length)return actor.payActionDiceLocked(baseCost,run,{bonusPoolId});
 return actor.payMultipartActionDiceLocked(quote.allocations,run,{message,purpose,details:{...details,benefit,baseCost,benefitCount,surcharge:quote.surcharge,conditionGrade:quote.grade}});
}

/** Parse submitted wallet identifiers, never a fresh list that could omit a disappeared grant. */
export function surchargeFundingInput(input={}){
 const entries=Object.entries(input).filter(([key])=>key.startsWith('surchargePart__'));
 let surchargeAllocations=input.surchargeAllocations;
 if(entries.length){surchargeAllocations=entries.map(([key,value])=>({bonusPoolId:key==='surchargePart__ordinary'?'':key.startsWith('surchargePart__pool_')&&key.length>'surchargePart__pool_'.length?key.slice('surchargePart__pool_'.length):'invalid:source',count:typeof value==='number'?value:typeof value==='string'?Number(value.trim()):NaN})).filter(p=>p.count!==0);if(!surchargeAllocations.length)surchargeAllocations=undefined;}
 return {surchargeBonusPoolId:input.surchargeBonusPoolId??'same',surchargeAllocations};
}

/** Whole-cost contributions are only offered by workflows that roll no payment dice. */
export function unrolledPaymentFundingControl(actor){
 const pools=unrestrictedBonusPools(actor.actionDiceFundingSystem,actor.usagePeriods).filter(p=>p.available),esc=foundry.utils.escapeHTML;
 return `<details><summary>Split the full unrolled payment</summary><p>Optional: enter contributions totalling the full base cost plus Shaken surcharge for the benefits selected. These replace both funding selectors. Leave split-surcharge contributions at zero when using this option. Payment dice are not rolled.</p><label>Ordinary action dice (${actor.system.actionDice?.value??0}) <input type="number" name="unrolledPart__ordinary" min="0" step="1" value="0" /></label>${pools.map(p=>`<label>${esc(p.label)} (${p.available}) <input type="number" name="unrolledPart__pool_${esc(p.id)}" min="0" step="1" value="0" /></label>`).join('')}</details>`;
}
export function unrolledPaymentFundingInput(input={}){
 const entries=Object.entries(input).filter(([key])=>key.startsWith('unrolledPart__'));
 let allocations=input.allocations;
 if(entries.length){allocations=entries.map(([key,value])=>({bonusPoolId:key==='unrolledPart__ordinary'?'':key.startsWith('unrolledPart__pool_')&&key.length>'unrolledPart__pool_'.length?key.slice('unrolledPart__pool_'.length):'invalid:source',count:typeof value==='number'?value:typeof value==='string'?Number(value.trim()):NaN})).filter(p=>p.count!==0);if(!allocations.length)allocations=undefined;}
 return {allocations};
}

export function splitSurchargeFundingControl(actor){
 const pools=unrestrictedBonusPools(actor.actionDiceFundingSystem,actor.usagePeriods).filter(p=>p.available),esc=foundry.utils.escapeHTML;
 return `<details><summary>Split the surcharge across sources</summary><p>Optional: enter contributions totalling the surcharge. These replace the surcharge selector above; benefit dice still use their selected source.</p><label>Ordinary action dice (${actor.system.actionDice?.value??0}) <input type="number" name="surchargePart__ordinary" min="0" step="1" value="0" /></label>${pools.map(p=>`<label>${esc(p.label)} (${p.available}) <input type="number" name="surchargePart__pool_${esc(p.id)}" min="0" step="1" value="0" /></label>`).join('')}</details>`;
}
