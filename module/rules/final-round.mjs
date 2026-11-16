/** Nauseated p.342: the one-final-attack allowance is shared across sources. */
export const FINAL_ATTACK_WORKFLOWS=new Set(['twoWeaponFinalAttack','dartingFinalAttack','mobileOffense','contempt','combatInstincts']);
export function finalAttackRoundSpec(system){
 const nauseated=system.conditionContext?.nauseated===true,stored=system.resourceUses?.finalAttackRound,known=stored!==null&&typeof stored==='object'&&!Array.isArray(stored)&&typeof stored.epoch==='string'&&!!stored.epoch&&Number.isSafeInteger(stored.used)&&stored.used>=0;
 return {id:'finalAttackRound',name:'All final attacks this round'+(nauseated?' (Nauseated maximum1)':''),cost:0,period:'round',limit:nauseated?1:Number.MAX_SAFE_INTEGER,limitLabel:nauseated?'1 while Nauseated':'No Nauseated cap while the condition is absent',workflow:'finalAttackRound',combatScoped:true,manualReviewable:true,hidden:true,requiresEpochReceipt:nauseated&&!known};
}
export function validateFinalRoundReservation(actor,reservation){
 if(!actor.isOwner||!reservation||typeof reservation.nauseated!=='boolean'||!Number.isSafeInteger(reservation.record?.used)||reservation.record.used<1)throw new Error('Use the final-attack control to reserve the shared round allowance.');
 const current=actor.system.resourceUses?.finalAttackRound,epoch=String(actor.usagePeriods?.round??'initial');
 if(reservation.nauseated!==(actor.system.conditionContext?.nauseated===true)||epoch!==reservation.record.epoch||current?.epoch!==reservation.record.epoch||current.used!==reservation.record.used||reservation.nauseated&&current.used>1)throw new Error('The shared final-attack count, round or Nauseated condition changed. Review the current round before retrying.');
}
export async function withFinalRoundReservation(actor,reservation,perform){
 if(!reservation)return perform();validateFinalRoundReservation(actor,reservation);const previous=actor._finalAttackReservation;actor._finalAttackReservation=reservation;
 try{return await perform();}finally{if(previous===undefined)delete actor._finalAttackReservation;else actor._finalAttackReservation=previous;}
}
