/** p.27: a new character enters play with starting dice; this is not a repeat refill. */
export function startingDiceEntryPlan(system,creation,{session='initial',resetReceipt=null}={}){
 const reject=reason=>({blocked:true,reason});
 if(!creation||typeof creation.id!=='string'||!creation.id||creation.claimed!==false)return reject('This character has no unclaimed creation entry. Use the GC new-session control for existing characters.');
 if(typeof creation.session!=='string'||creation.session!==String(session))return reject('The creation session has ended. Use the GC new-session control.');
 if(resetReceipt?.session===String(session))return reject('Starting dice were already assigned for this session.');
 if(!Number.isSafeInteger(system.level)||system.level<1||system.level>20)return reject('Choose a valid first Career Level before entering play.');
 if(system.actionDice?.value!==0)return reject('Existing dice must be accounted for by the GC; this entry cannot overwrite a balance.');
 const value=system.actionDice?.max,die=system.actionDice?.die;if(!Number.isSafeInteger(value)||value<0||![4,6,8,10,12].includes(die))return reject('Review the starting action-die count and type.');
 if(system.actionDieAwardReview?.needsReview||system.missionXPReview?.needsReview||system.actionDiceSettlementReview?.needsReview)return reject('Resolve the interrupted resource history before entering play.');
 for(const record of Object.values(system.actionDieAwards??{}))if(record?.count>0&&(!Array.isArray(record.events)||record.events.some(e=>e.session===String(session))))return reject('This character already received awards in this session; the GC must review the initial pool.');
 return {blocked:false,value,die,session:String(session),creationId:creation.id};
}
