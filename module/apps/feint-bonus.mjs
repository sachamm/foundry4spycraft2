import {attackCharacterTargetChoices} from './character-target.mjs';
import {feintBonusRows,feintBonusGrantPlan,assertFeintBonusPlan} from '../rules/feint-bonus.mjs';
import {queueRuleState} from './rule-resource-scope.mjs';
import {rollEvidence} from '../rules/outcomes.mjs';
const leases=new WeakMap(),activeAttempts=new Map(),stable=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const message=uuid=>globalThis.fromUuidSync?.(uuid)??[...(globalThis.game?.messages??[])].find(m=>m.uuid===uuid||m.id===uuid);
const targetOf=(c,finalAttack)=>c?.targetActorUuid||c?.characterTarget?.actorUuid||c?.cheapShot?.targetUuid||finalAttack?.opponentUuid||finalAttack?.targetUuid||null;
export async function grantFeintCriticalBonus(actor,settlement){
 if(settlement.criticalAttackBonus!==2)return null;
 return queueRuleState(actor,async()=>{const p=feintBonusGrantPlan(actor.system,settlement);if(!p.existing)await actor.update({'system.feintBonuses':[...feintBonusRows(actor.system),p.record]});return p.record;});
}
function validateSources(actor,proof){
 const rows=feintBonusRows(actor.system).filter(r=>proof.sourceMessages.includes(r.sourceMessage));if(rows.length!==proof.sourceMessages.length)throw Error('A recorded Feint bonus source was removed.');
 for(const r of rows){const a=message(r.sourceMessage)?.flags?.spycraft2,d=message(r.defenderMessage)?.flags?.spycraft2,s=a?.feintSettlement;
  if(!a||!d||a.superseded||d.superseded||a.resolved!==true||d.resolved!==true||s?.criticalBenefitVersion!==1||s.winnerUuid!==actor.uuid||s.loserUuid!==proof.targetUuid||s.criticalAttackBonus!==2||s.sourceMessage!==r.sourceMessage||s.defenderMessage!==r.defenderMessage||stable(s)!==stable(d.feintSettlement)||stable([rollEvidence(a),rollEvidence(d)])!==stable(r.sourceEvidence)||stable(s.sourceEvidence)!==stable(r.sourceEvidence))throw Error('The resolved critical Feint source changed before the attack.');
 }
 return rows;
}
function replacement(actor,proof,rerollOf){
 if(!rerollOf)return false;
 let original=message(rerollOf);const c=original?.flags?.spycraft2;if(!c||c.actorUuid!==actor.uuid||c.checkKind!=='attack'||c.resolved||c.superseded||stable(c.attackContext?.feintBonus)!==stable(proof))throw Error('Use the actual original attack to replace this recorded Feint benefit.');
 const rows=validateSources(actor,proof),wanted=new Set(rows.map(r=>r.receiptUuid)),seen=new Set();
 while(original&&!seen.has(original.uuid)){seen.add(original.uuid);if(wanted.has(original.uuid)){const origin=original.flags?.spycraft2;if(origin?.rollCombat?.id!==proof.combatId||origin.rollCombat?.round!==proof.attackRound)throw Error('The original Feint-benefit attack timing changed.');wanted.delete(original.uuid);if(!wanted.size)return true;}const previous=message(original.flags?.spycraft2?.rerollOf);if(!previous||previous.flags?.spycraft2?.actorUuid!==actor.uuid||stable(previous.flags.spycraft2.attackContext?.feintBonus)!==stable(proof))break;original=previous;}
 throw Error('The original attack does not own this spent Feint bonus.');
}
export function hasFeintBonusLease(actor,proof,lease){const p=lease&&leases.get(lease);return p?.actor===actor&&p.attemptId===proof?.attemptId;}
export function validateFeintAttackBonusProof(actor,proof,{checkKind,attackContext,lease,rerollOf,finalAttack}={}){
 if(!proof)return;
 if(checkKind!=='attack'||proof.targetUuid!==targetOf(attackContext,finalAttack))throw Error('The recorded Feint bonus must use its actual opposing character.');
 if(rerollOf){if(proof.attackBonus===2)replacement(actor,proof,rerollOf);else{const c=message(rerollOf)?.flags?.spycraft2;if(c?.actorUuid!==actor.uuid||c.checkKind!=='attack'||c.resolved||c.superseded||stable(c.attackContext?.feintBonus)!==stable(proof)||proof.attackBonus!==0)throw Error('Use the original recorded attack for this replacement.');}return;}
 assertFeintBonusPlan(actor.system,proof,{targetUuid:targetOf(attackContext,finalAttack),combat:actor.mentalLeapCombatContext(),defensive:attackContext?.disarm?.role==='defender'});
 if(proof.attackBonus===2){if(!attackCharacterTargetChoices().some(a=>a.uuid===proof.targetUuid))throw Error('The Feint bonus opponent is no longer an observed character.');if(!hasFeintBonusLease(actor,proof,lease))throw Error('Reserve this next-attack Feint bonus through its attack workflow.');const rows=validateSources(actor,proof);if(rows.some(r=>r.usedBy!==proof.attemptId))throw Error('This Feint bonus belongs to another attack.');}
}
export async function withFeintAttackBonus(actor,proof,perform){
 const lease={};
 await queueRuleState(actor,async()=>{assertFeintBonusPlan(actor.system,proof,{targetUuid:proof.targetUuid,combat:actor.mentalLeapCombatContext()});const rows=validateSources(actor,proof);if(rows.some(r=>r.usedBy!=null))throw Error('This Feint bonus was already used by another attack.');await actor.update({'system.feintBonuses':feintBonusRows(actor.system).map(r=>proof.sourceMessages.includes(r.sourceMessage)?{...r,usedBy:proof.attemptId}:r)});});
 leases.set(lease,{actor,attemptId:proof.attemptId});activeAttempts.set(actor.uuid+':'+proof.attemptId,lease);
 const posted=()=>[...(game.messages??[])].find(m=>m.flags?.spycraft2?.actorUuid===actor.uuid&&m.flags.spycraft2.checkKind==='attack'&&m.flags.spycraft2.attackContext?.feintBonus?.attemptId===proof.attemptId);
 const settle=receipt=>queueRuleState(actor,async()=>{const rows=feintBonusRows(actor.system);if(rows.filter(r=>proof.sourceMessages.includes(r.sourceMessage)).some(r=>r.usedBy!==proof.attemptId))throw Error('The reserved Feint benefit changed; ask the GC to review its attack.');await actor.update({'system.feintBonuses':rows.map(r=>proof.sourceMessages.includes(r.sourceMessage)?{...r,usedBy:receipt?proof.attemptId:null,receiptUuid:receipt?.uuid??null}:r)});});
 try{const result=await perform(lease),receipt=result?.flags?.spycraft2?.attackContext?.feintBonus?.attemptId===proof.attemptId&&result.uuid?result:posted();await settle(receipt);return receipt??result;}
 catch(error){const receipt=posted();try{await settle(receipt);}catch(cleanup){throw new AggregateError([error,cleanup],'The Feint next-attack benefit needs GC review; check the recorded attack before retrying.');}if(receipt)return receipt;throw error;}
 finally{leases.delete(lease);activeAttempts.delete(actor.uuid+':'+proof.attemptId);}
}

export async function reviewFeintBonuses(actor,input={}){
 if(!game.user.isGM||!actor.isOwner)throw Error('The GC must review an interrupted Feint attack benefit.');
 if(!Object.hasOwn(input,'attemptId')){const esc=foundry.utils.escapeHTML,ids=[...new Set(feintBonusRows(actor.system).filter(r=>r.usedBy&&!r.receiptUuid).map(r=>r.usedBy))];if(!ids.length)return ui.notifications.info('No interrupted Feint benefit is awaiting review.');input=await foundry.applications.api.DialogV2.input({window:{title:'Review interrupted Feint attack'},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>First recover any interrupted resource lock. Check the original Feint and attack receipts. A posted attack keeps its spent bonus. Only a confirmed missing attack releases the unused bonus, retaining its original opponent and expiry.</p><label>Interrupted attempt <select name="attemptId">${ids.map(id=>{const r=feintBonusRows(actor.system).find(r=>r.usedBy===id),name=attackCharacterTargetChoices().find(a=>a.uuid===r.targetUuid)?.name??'Recorded opponent';return `<option value="${esc(id)}">${esc(name)} · Feint round ${r.madeRound}</option>`;}).join('')}</select></label><label><input name="confirmed" type="checkbox" /> No client is still executing this attack; I reviewed its receipts and current resources</label></div>`});if(!input)return null;}
 if(input.confirmed!==true)throw Error('Confirm the interrupted attack is no longer executing and its receipts were reviewed.');
 if(activeAttempts.has(actor.uuid+':'+input.attemptId))throw Error('This client is still executing that attack.');
 return queueRuleState(actor,async()=>{const rows=feintBonusRows(actor.system),pending=rows.filter(r=>r.usedBy===input.attemptId&&!r.receiptUuid);if(!pending.length)return null;const posted=[...game.messages].filter(m=>m.flags?.spycraft2?.actorUuid===actor.uuid&&m.flags.spycraft2.checkKind==='attack'&&m.flags.spycraft2.attackContext?.feintBonus?.attemptId===input.attemptId);if(posted.length>1)throw Error('Multiple attack receipts need manual GC review.');const receipt=posted[0],bound=rows.filter(r=>r.usedBy===input.attemptId).map(r=>r.sourceMessage).sort();if(receipt&&stable(receipt.flags.spycraft2.attackContext.feintBonus.sourceMessages)!==stable(bound))throw Error('The recorded attack does not match this interrupted benefit.');await actor.update({'system.feintBonuses':rows.map(r=>r.usedBy===input.attemptId?{...r,usedBy:receipt?input.attemptId:null,receiptUuid:receipt?.uuid??null}:r)});return {version:1,attemptId:input.attemptId,receiptUuid:receipt?.uuid??null,released:!receipt};});
}
