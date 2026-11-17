import {sideStanceRows,sideStanceGrantPlan,assertSideStancePlan} from '../rules/side-stance.mjs';
import {queueRuleState} from './rule-resource-scope.mjs';
import {rollEvidence} from '../rules/outcomes.mjs';
import {attackCharacterTargetChoices} from './character-target.mjs';
const leases=new WeakMap(),active=new Map(),stable=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const message=id=>globalThis.fromUuidSync?.(id)??[...(globalThis.game?.messages??[])].find(m=>m.uuid===id||m.id===id);
const targetOf=(c,finalAttack)=>c?.targetActorUuid||c?.characterTarget?.actorUuid||c?.cheapShot?.targetUuid||finalAttack?.opponentUuid||finalAttack?.targetUuid||null;
export async function grantSideStanceFeint(actor,settlement,feint){
 if(feint?.combatStance?.stance?.key!=='side'||!settlement.attackerWon)return null;
 return queueRuleState(actor,async()=>{const p=sideStanceGrantPlan(actor.system,settlement,feint);if(p&&!p.existing)await actor.update({'system.sideStanceFeints':[...sideStanceRows(actor.system),p.record]});return p?.record??null;});
}
export function validateSideStanceSources(actor,proof){
 const rows=sideStanceRows(actor.system).filter(r=>proof.sourceMessages.includes(r.sourceMessage));if(rows.length!==proof.sourceMessages.length||!rows.some(r=>r.targetUuid===proof.targetUuid))throw Error('The recorded Side Stance Feint sources changed.');
 for(const r of rows){const a=message(r.sourceMessage)?.flags?.spycraft2,d=message(r.defenderMessage)?.flags?.spycraft2,s=a?.feintSettlement,p=a?.feint?.combatStance?.stance;
  if(!a||!d||a.actorUuid!==actor.uuid||d.actorUuid!==r.targetUuid||a.superseded||d.superseded||a.resolved!==true||d.resolved!==true||s?.sideBenefitVersion!==1||s.attackerWon!==true||s.winnerUuid!==actor.uuid||s.defenderUuid!==r.targetUuid||s.sourceMessage!==r.sourceMessage||s.defenderMessage!==r.defenderMessage||p?.key!=='side'||p.id!==r.stanceId||p.id!==proof.stanceId||p.feat!=='Fencing Basics'||stable(s)!==stable(d.feintSettlement)||stable([rollEvidence(a),rollEvidence(d)])!==stable(r.sourceEvidence)||stable(s.sourceEvidence)!==stable(r.sourceEvidence))throw Error('The successful Feint made in Side Stance changed before the attack.');
 }
 return rows;
}
/** Authenticate the original attack, including a legal chain of replacement receipts. */
export function sideStanceAttackRoot(actor,proof,receipt,{replacing=false}={}){
 const first=receipt?.flags?.spycraft2;if(first?.actorUuid!==actor.uuid||first.checkKind!=='attack'||replacing&&(first.resolved||first.superseded)||stable(first.attackContext?.sideStance)!==stable(proof))throw Error('Use the actual original Side Stance attack.');
 const rows=validateSideStanceSources(actor,proof),wanted=new Set(rows.map(r=>r.receiptUuid)),seen=new Set();let current=receipt;
 while(current&&!seen.has(current.uuid)){seen.add(current.uuid);if(wanted.has(current.uuid)){wanted.delete(current.uuid);if(!wanted.size)return current.uuid;}const previous=message(current.flags?.spycraft2?.rerollOf);if(!previous||previous.flags?.spycraft2?.actorUuid!==actor.uuid||stable(previous.flags.spycraft2.attackContext?.sideStance)!==stable(proof))break;current=previous;}
 throw Error('The recorded Side Stance benefit does not belong to this attack.');
}
export function hasSideStanceLease(actor,proof,lease){const p=lease&&leases.get(lease);return p?.actor===actor&&p.attemptId===proof?.attemptId;}
export function validateSideStanceAttackProof(actor,proof,{checkKind,attackContext,lease,rerollOf,finalAttack}={}){
 if(!proof)return;if(checkKind!=='attack'||proof.targetUuid!==targetOf(attackContext,finalAttack))throw Error('The Side Stance die must use its recorded opposing character.');
 if(rerollOf){const origin=message(rerollOf);if(proof.dice===1)sideStanceAttackRoot(actor,proof,origin,{replacing:true});else{const c=origin?.flags?.spycraft2;if(c?.actorUuid!==actor.uuid||c.checkKind!=='attack'||c.resolved||c.superseded||proof.dice!==0||stable(c.attackContext?.sideStance)!==stable(proof))throw Error('Use the original attack for this Side Stance replacement.');}return;}
 assertSideStancePlan(actor.system,proof,{targetUuid:targetOf(attackContext,finalAttack),defensive:attackContext?.disarm?.role==='defender',ranged:attackContext?.ranged===true});
 if(proof.dice===1){if(!attackCharacterTargetChoices().some(a=>a.uuid===proof.targetUuid)||!hasSideStanceLease(actor,proof,lease))throw Error('Reserve the Side Stance die for the actual observed opponent through its attack.');const rows=validateSideStanceSources(actor,proof);if(rows.some(r=>r.usedBy!==proof.attemptId))throw Error('This Side Stance die belongs to another attack.');}
}
export async function withSideStanceAttack(actor,proof,perform){
 const lease={};await queueRuleState(actor,async()=>{assertSideStancePlan(actor.system,proof,{targetUuid:proof.targetUuid});const rows=validateSideStanceSources(actor,proof);if(rows.some(r=>r.usedBy!=null))throw Error('The pending Side Stance die was already consumed.');await actor.update({'system.sideStanceFeints':sideStanceRows(actor.system).map(r=>proof.sourceMessages.includes(r.sourceMessage)?{...r,usedBy:proof.attemptId}:r)});});leases.set(lease,{actor,attemptId:proof.attemptId});active.set(actor.uuid+':'+proof.attemptId,lease);
 const posted=()=>[...(game.messages??[])].find(m=>m.flags?.spycraft2?.actorUuid===actor.uuid&&m.flags.spycraft2.checkKind==='attack'&&m.flags.spycraft2.attackContext?.sideStance?.attemptId===proof.attemptId),settle=receipt=>queueRuleState(actor,async()=>{const rows=sideStanceRows(actor.system);if(rows.filter(r=>proof.sourceMessages.includes(r.sourceMessage)).some(r=>r.usedBy!==proof.attemptId))throw Error('The reserved Side Stance die changed; ask the GC to review it.');await actor.update({'system.sideStanceFeints':rows.map(r=>proof.sourceMessages.includes(r.sourceMessage)?{...r,usedBy:receipt?proof.attemptId:null,receiptUuid:receipt?.uuid??null}:r)});});
 try{const result=await perform(lease),receipt=result?.flags?.spycraft2?.attackContext?.sideStance?.attemptId===proof.attemptId&&result.uuid?result:posted();await settle(receipt);return receipt??result;}catch(error){const receipt=posted();try{await settle(receipt);}catch(cleanup){throw new AggregateError([error,cleanup],'The Side Stance attack needs GC review; inspect its receipt before retrying.');}if(receipt)return receipt;throw error;}finally{leases.delete(lease);active.delete(actor.uuid+':'+proof.attemptId);}
}
export async function reviewSideStanceAttack(actor,{attemptId,confirmed=false}={}){
 if(!game.user.isGM||!actor.isOwner||confirmed!==true)throw Error('The GC must confirm the interrupted Side Stance attack was reviewed.');if(active.has(actor.uuid+':'+attemptId))throw Error('This client is still executing that Side Stance attack.');
 return queueRuleState(actor,async()=>{const rows=sideStanceRows(actor.system),pending=rows.filter(r=>r.usedBy===attemptId&&!r.receiptUuid);if(!pending.length)return null;const posted=[...game.messages].filter(m=>m.flags?.spycraft2?.actorUuid===actor.uuid&&m.flags.spycraft2.checkKind==='attack'&&m.flags.spycraft2.attackContext?.sideStance?.attemptId===attemptId);if(posted.length>1)throw Error('Multiple Side Stance attack receipts require manual GC review.');const receipt=posted[0],bound=rows.filter(r=>r.usedBy===attemptId).map(r=>r.sourceMessage).sort();if(receipt&&stable(receipt.flags.spycraft2.attackContext.sideStance.sourceMessages)!==stable(bound))throw Error('The Side Stance attack does not match this interrupted die.');await actor.update({'system.sideStanceFeints':rows.map(r=>r.usedBy===attemptId?{...r,usedBy:receipt?attemptId:null,receiptUuid:receipt?.uuid??null}:r)});return {version:1,attemptId,receiptUuid:receipt?.uuid??null,released:!receipt};});
}
