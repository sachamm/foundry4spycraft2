import {validRecordedMeleeTrick} from './melee-tricks.mjs';
export function threadNeedleAttackFacts(check){
 const p=check?.attackContext?.meleeTrick,c=check?.attackContext;
 if(check?.checkKind!=='attack'||check.resolved!==true||check.successConfirmed!==true||check.criticalFailure||check.superseded||p?.key!=='threadNeedle'||!validRecordedMeleeTrick(p,c)||typeof check.actorUuid!=='string'||typeof check.weaponUuid!=='string'||!check.weaponUuid||typeof p.targetUuid!=='string'||!p.targetUuid||p.targetUuid.startsWith('manual:')||(c.targetActorUuid||c.characterTarget?.actorUuid)!==p.targetUuid)throw Error('Choose the finished successful Thread the Needle attack against its actual character target.');
 return {version:1,actorUuid:check.actorUuid,targetUuid:p.targetUuid,weaponUuid:check.weaponUuid,weaponId:p.weaponId,trick:structuredClone(p)};
}
export function threadNeedleEndPlan(input={}){
 if(input.confirmed!==true)throw Error('Confirm this source-specific hold actually ended.');
 if(input.reason==='escape'){if(typeof input.escapeMessage!=='string'||!input.escapeMessage)throw Error('Choose the target’s completed recorded grapple escape and required move.');return {reason:'escape',escapeMessage:input.escapeMessage};}
 if(input.reason==='release')return {reason:'release'};
 if(input.reason==='movedBeyond'){if(input.holderMovedConfirmed!==true||typeof input.separationFeet!=='number'||!Number.isFinite(input.separationFeet)||input.separationFeet<=5)throw Error('Confirm the holder actually moved farther than5ft from this target, using their resulting separation.');return {reason:'movedBeyond',separationFeet:input.separationFeet,holderMovedConfirmed:true};}
 throw Error('Choose the completed recorded escape, release or the holder’s completed movement beyond5ft.');
}
