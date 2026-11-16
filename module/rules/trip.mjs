import {stillStandingResistancePlan} from './still-standing.mjs';
import {attributeDefensePlan} from './attributes.mjs';
import {uncannyDodgePlan} from './defense.mjs';
export function responseOwnSize(system){
 const size=system?.size;
 if(size===undefined)return null;
 if(typeof size!=='string'||!size.trim()||size.trim().length>200)throw Error('Review the character’s actual current Size before this response.');
 return size.trim();
}
/** p.361 opposed response; p.352 action error +1 applies to every check in the action. */
export function tripDefenseSkillChecks(key,checks=[]){
 if(key!=='acrobatics')return checks;
 return [...checks.filter(c=>c.id!=='resist-trip'),{id:'resist-trip',name:'Resist Trip',attributes:['dex'],mode:'Active',tags:'Armor Check Penalty',error:2,time:'Opposed response',page:361,synergies:[],combatAction:'trip',role:'defender'}];
}
/** Ordinary Acrobatics response only; alternative character options and Trip outcomes remain separate. */
export function tripDefensePlan(system,key,check,{method='roll',tripOpponentName='',tripAdjacent=false,tripSizeDifference=null,tripIncomingConfirmed=false}={}){
 const empty={evidence:null,bonuses:[],sizeBonus:0,blockedReason:'',notes:[]},reject=blockedReason=>({...empty,blockedReason});
 if(key!=='acrobatics'||check?.id!=='resist-trip')return empty;
 if(method!=='roll')return reject('Trip is opposed and part of a combat action; taking10/20 is unavailable (pp.91,352).');
 if(typeof tripOpponentName!=='string'||!tripOpponentName.trim()||tripOpponentName.trim().length>200||tripAdjacent!==true||tripIncomingConfirmed!==true||!Number.isSafeInteger(tripSizeDifference)||Math.abs(tripSizeDifference)>11)return reject('Name the actual adjacent opponent and confirm a legal incoming Trip and your Size-category difference (your Size minus the attacker’s).');
 if(tripSizeDifference>1)return reject('An ordinary Trip cannot target a character more than one Size category larger than its attacker (p.361); review any actual exception separately.');
 const names=system?.activeFeatNames;
 if(!Array.isArray(names)||names.some(n=>typeof n!=='string'||!n.trim()))return reject('Review the current qualified Trip-defense feat sources.');
 let stillStanding,ownSize;try{stillStanding=stillStandingResistancePlan(system,'trip');ownSize=responseOwnSize(system);}catch(error){return reject(error.message);}
 const mastery=names.includes('Equilibrium Mastery');let covertFeats=[],vulnerable=null;
 if(mastery){
  if(!Array.isArray(system.activeFeatSelections)||system.activeFeatSelections.some(f=>!f||typeof f!=='object'))return reject('Review the current Covert feat selections for Equilibrium Mastery.');
  covertFeats=system.activeFeatSelections.filter(f=>f.tree==='covert').map(f=>({name:f.name,choice:f.choice??''})).sort((a,b)=>String(a.name).localeCompare(String(b.name))||String(a.choice).localeCompare(String(b.choice)));
  if(!covertFeats.some(f=>f.name==='Equilibrium Mastery')||covertFeats.some(f=>typeof f.name!=='string'||!f.name.trim()||typeof f.choice!=='string'))return reject('Review the qualified Equilibrium Mastery and Covert feat selections.');
  vulnerable=attributeDefensePlan({...system,uncannyDodge:uncannyDodgePlan(system)}).vulnerable;
 }
 const normalDodge=covertFeats.length,dodgeBonus=mastery&&!vulnerable?normalDodge:0,sizeBonus=4*Math.max(0,tripSizeDifference),evidence={version:2,skillKey:key,checkId:check.id,ownSize,opponentName:tripOpponentName.trim(),adjacent:true,incomingConfirmed:true,sizeDifference:tripSizeDifference,sizeBonus,mastery,covertFeats,vulnerable,normalDodge,dodgeBonus,...(stillStanding.source?{stillStanding}:{})};
 return {...empty,evidence,bonuses:[...(dodgeBonus?[{source:'Equilibrium Mastery (resist Trip)',type:'dodge',value:dodgeBonus}]:[]),...(stillStanding.bonus?[{source:'Still Standing',type:'',value:stillStanding.bonus}]:[])],sizeBonus,notes:[`Resist Trip: opposed Acrobatics(DEX), Armor Check Penalty; action error modifier+1; larger participant +4 per Size category (pp.352,361). Your Size bonus +${sizeBonus}.`,...(mastery?[`Equilibrium Mastery: ${normalDodge} current Covert feats; dodge bonus +${dodgeBonus}${vulnerable?' (lost while vulnerable, p.328)':''}. Dodge bonuses stack; this is not a general Defense bonus (p.194).`]:[]),...(stillStanding.source?['Still Standing: +4 unnamed bonus to this skill check resisting Trip (p.66); this is not a dodge bonus.']:[]),'The GC resolves the opposed result, sprawled/flat-footed conditions, critical effects, final attacks and permitted counter-Trip sequence separately.']};
}
export function validateTripDefenseProof(system,proof,{checkKind,skillKey,checkId,checkMethod='roll',ability,attributeSubstitution}={}){
 if(!proof)return;
 const p=tripDefensePlan(system,skillKey,{id:checkId},{method:checkMethod,tripOpponentName:proof.opponentName,tripAdjacent:proof.adjacent,tripSizeDifference:proof.sizeDifference,tripIncomingConfirmed:proof.incomingConfirmed});
 const stable=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
 const substituted=attributeSubstitution?.source==='All According to Plan'&&attributeSubstitution.originalAbility==='dex'&&attributeSubstitution.ability==='int'&&(system.classLevels?.schemer??0)>=4;
 if(ability!==undefined&&ability!==(substituted?'int':'dex'))throw Error('The Trip response key attribute or actual substitution source changed before posting.');
 const candidate=proof.version===1&&p.evidence?{...p.evidence,version:1}:p.evidence;if(proof.version===1&&candidate)delete candidate.ownSize;
 if(checkKind!=='skill'||p.blockedReason||!p.evidence||stable(candidate)!==stable(proof))throw Error('The Trip-defense circumstances, vulnerability or qualified Covert feat sources changed before posting.');
}
