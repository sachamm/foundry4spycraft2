import {combatStanceState} from './combat-stance.mjs';
import {validOwnCountClock} from './own-count-duration.mjs';
/** The p.179 bonus applies to Sneak checks, not the underlying skill bonus. */
export function stalkingStancePlan(system,key,check,{combat=null}={}){
 const empty={evidence:null,bonuses:[],notes:[]};if(key!=='sneak')return empty;
 const stance=combatStanceState(system),active=stance?.key==='stalking'&&validOwnCountClock(combat),bonus=active?3:0;
 const evidence={version:1,skillKey:key,checkId:check?.id??'',bonus,stance:active?stance:null,combat:active?{id:combat.id,round:combat.round,combatantId:combat.combatantId}:null};
 return {evidence,bonuses:active?[{source:'Stalking Stance',type:'unnamed',value:3}]:[],notes:active?['Stalking Stance: +3 with this Sneak check made in combat (p.179).']:[]};
}
const stable=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
export function validateStalkingStanceProof(actor,proof,{checkKind,skillKey,checkId,rerollOf}={}){
 if(!proof)return;
 if(rerollOf){const origin=globalThis.fromUuidSync?.(rerollOf)??[...(globalThis.game?.messages??[])].find(m=>m.uuid===rerollOf||m.id===rerollOf),c=origin?.flags?.spycraft2;if(checkKind!=='skill'||skillKey!=='sneak'||c?.actorUuid!==actor.uuid||c.checkKind!=='skill'||c.skillKey!==skillKey||c.checkId!==checkId||c.resolved||c.superseded||stable(c.stalkingStance)!==stable(proof)||proof.bonus===3&&!actor.system.activeFeatNames?.includes('Garrote Basics'))throw Error('Use the original owned Sneak check and its qualified Stalking Stance source for this replacement.');return;}
 const p=stalkingStancePlan(actor.system,skillKey,{id:checkId},{combat:actor.mentalLeapCombatContext?.()??null});if(checkKind!=='skill'||!p.evidence||stable(p.evidence)!==stable(proof))throw Error('The Stalking Stance, qualified source or actual combat participation changed before posting.');
}
