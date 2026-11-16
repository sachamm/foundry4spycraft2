import {attributeActionBlock} from './attributes.mjs';
import {restraintActionBlock} from './restraints.mjs';
/** p.198: additional cash, not a Spending Cash rank increase or a gear pick. */
export function wellFundedPlan(system,{atHome=false,home=''}={}){
 if(!system.activeFeatNames?.includes('Well-Funded'))throw new Error('An active Well-Funded feat is required.');
 const blocked=attributeActionBlock(system,{kind:'gear',ability:'wis'})||restraintActionBlock(system);if(blocked)throw new Error(blocked);
 if(atHome!==true||typeof home!=='string'||!home.trim()||home.length>200)throw new Error('Confirm that you are at your home and record that home.');
 const wealth=system.wealth?.total;if(!Number.isSafeInteger(wealth)||wealth<0||!Number.isSafeInteger(wealth*200))throw new Error('Review the total Wealth used for this cash grant.');
 return {version:1,source:'Well-Funded',epoch:String(system.usagePeriods?.mission??'initial'),wealth,amount:wealth*200,home:home.trim(),atHome:true};
}
export function wellFundedCashHistory(system){
 const grants=Object.entries(system.wellFundedGrants??{}).map(([id,data])=>({id,...data})),valid=grants.filter(r=>r.source==='Well-Funded'&&Number.isSafeInteger(r.wealth)&&r.wealth>=0&&Number.isSafeInteger(r.amount)&&r.amount===200*r.wealth);
 return {grants:valid,totalReceived:valid.reduce((n,r)=>n+r.amount,0),needsReview:valid.length!==grants.length};
}
