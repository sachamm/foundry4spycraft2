import {readiedDisarmWeapons} from './disarm-response.mjs';
import {finesseWeaponPlan} from './finesse.mjs';
import {weaponGrip,weaponUnavailable} from './gear.mjs';
import {checkCandidates} from './outcomes.mjs';
import {validOwnCountClock} from './own-count-duration.mjs';
import {readiedItemsForCheck} from './readied-replacement.mjs';
import {ownedWeaponTraining} from './weapon-training.mjs';
import {attributeActionBlock} from './attributes.mjs';
import {restraintActionBlock} from './restraints.mjs';
export const MISS_TRICKS={doubleTwirl:{name:'Double Twirl',feat:'Flail Basics',family:'flail'},remiss:{name:'Remiss',feat:'Fencing Basics',family:'oneHandedSword'}};
export function missTrickSources(system,weapon,{grip=weaponGrip(system,weapon),combat=null,ranged=false}={}){
 const available=!weaponUnavailable(weapon)&&weapon.equipped===true&&weapon.carried!==false&&!weapon.reserve&&Number.isSafeInteger(weapon.quantity??1)&&(weapon.quantity??1)>0&&!grip.blocked;
 const finesse=/\bFIN\b/.test(weapon.qualities??''),sources=[],relevant=weapon.meleeFamily==='flail'&&system.activeFeatNames?.includes('Flail Basics')||weapon.meleeFamily==='oneHandedSword'&&system.activeFeatNames?.includes('Fencing Basics'),ready=system.disarmWeapons,capacity=!!ready&&!ready.blockedReason&&ready.weapons.some(w=>w.id===weapon.id&&w.hands===grip.hands&&w.requiredHands===grip.required),held=relevant&&ready?ready.weapons.map(w=>({id:w.id,hands:w.hands,requiredHands:w.requiredHands})):null;
 if(available&&capacity&&!ranged&&typeof weapon.id==='string'&&weapon.id){if(system.activeFeatNames?.includes('Flail Basics')&&weapon.meleeFamily==='flail'&&weapon.proficiency==='exoticBlunt')sources.push('doubleTwirl');if(system.activeFeatNames?.includes('Fencing Basics')&&weapon.meleeFamily==='oneHandedSword'&&['edged','exoticEdged'].includes(weapon.proficiency)&&grip.required===1&&finesse)sources.push('remiss');}
 return {version:2,held,weaponId:weapon.id??null,family:weapon.meleeFamily??'',proficiency:weapon.proficiency,finesse,hands:grip.hands,requiredHands:grip.required,available,sources,combat:combat?structuredClone(combat):null};
}
function sourceVersion(original,current){if(original?.version===1&&current?.version===2){const p={...current,version:1};delete p.held;return p;}return current;}
const stable=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
export function validateMissTrickSources(actor,proof,{checkKind,weaponUuid,weaponProficiency,attackContext={},rerollOf,combat}={}){
 if(!proof)return;
 const trained=ownedWeaponTraining(actor,proof,{checkKind,weaponUuid,weaponProficiency,attackContext}),items=readiedItemsForCheck(actor,{rerollOf,disarm:attackContext.disarm,cheapShot:attackContext.cheapShot}),item=items.find(i=>(i.id??i._id)===proof.weaponId),weapon={...trained.weapon,...item?.system,id:proof.weaponId,proficiency:trained.operatingProficiency,qualities:finesseWeaponPlan(actor.system,{...trained.weapon,...item?.system}).effectiveQualities},fresh=missTrickSources({...actor.system,disarmWeapons:readiedDisarmWeapons(actor.system,items)},weapon,{grip:weaponGrip(actor.system,weapon,{hands:attackContext.hands}),ranged:!['unarmed','blunt','exoticBlunt','edged','exoticEdged'].includes(weaponProficiency),combat:proof.combat});
 const candidate=sourceVersion(proof,fresh);
 if(stable(proof)!==stable(candidate))throw Error('The readied miss-trick weapon, feat, FIN source, grip or Initiative Count changed before posting.');
}
export function missTrickPlan(system,combat,check,current,{trick,opponentUuid,immediateConfirmed=false,sameTargetConfirmed=false,attackLegalConfirmed=false,legacySourceConfirmed=false}={}){
 const original=check?.attackContext?.missTrickSources,standard=check?.attackContext?.attackAction==='standard'||!original&&legacySourceConfirmed===true&&[undefined,'other'].includes(check?.attackContext?.attackAction);
 const definition=MISS_TRICKS[trick];if(!definition||!system.activeFeatNames?.includes(definition.feat)||!current?.sources?.includes(trick))throw Error('Choose a qualified miss trick with its actual readied weapon.');
 if(!validOwnCountClock(combat)||!check||check.checkKind!=='attack'||(check.checkMethod??'roll')!=='roll'||check.resolved!==true||check.successConfirmed!==false||check.superseded||check.criticalSuccess||check.criticalFailure||check.errorConfirmed||!Number.isSafeInteger(check.naturalDie)||check.naturalDie<1||check.naturalDie>20||!Number.isFinite(check.error)||check.error<0||!Number.isFinite(check.effectiveTotal)||checkCandidates(check).error||checkCandidates(check).triumph||!standard||check.attackContext?.disarm?.active||check.rollCombat?.id!==combat.id||check.rollCombat?.round!==combat.round)throw Error('Choose this combat round’s resolved Standard Attack miss without an error.');
 if(typeof opponentUuid!=='string'||!opponentUuid||immediateConfirmed!==true||sameTargetConfirmed!==true||attackLegalConfirmed!==true)throw Error('Confirm the same actual opponent and immediate reaction to this miss.');
 const knownTarget=check.attackContext?.targetActorUuid||check.attackContext?.cheapShot?.targetUuid||check.attackContext?.characterTarget?.actorUuid||check.finalAttack?.opponentUuid||check.finalAttack?.targetUuid;
 if(knownTarget&&knownTarget!==opponentUuid)throw Error('This trick must attack the recorded original opponent.');
 if(check.attackContext?.meleeFeatTrick&&check.attackContext?.meleeFeatTrick!==trick)throw Error('Only one Melee/Unarmed Combat feat trick may apply to this action (p.177).');
 if(original){if(!original.sources.includes(trick)||stable(original)!==stable(sourceVersion(original,current))||stable(original.combat)!==stable(combat))throw Error('The weapon/feat did not qualify at the miss, or its source or immediate Initiative context changed.');}
 else if(legacySourceConfirmed!==true)throw Error('This older receipt needs GC confirmation of the qualified/readied weapon and feat at the original miss.');
 if(system.refreshAction?.state==='waiting'&&system.refreshAction.combatId===combat.id&&system.refreshAction.startRound===combat.round)throw Error('Refresh forfeited this round’s chance to act.');
 const block=restraintActionBlock(system,{free:true})||attributeActionBlock(system,{kind:'attack'});if(block||system.wounds?.value<0)throw Error(block||'This character cannot take the final attack.');
 return {version:1,source:'missTrick',trick,name:definition.name,feat:definition.feat,weaponId:current.weaponId,opponentUuid,combat:structuredClone(combat),originalSource:original??null,legacySourceConfirmed:!original,immediateConfirmed:true,sameTargetConfirmed:true,attackLegalConfirmed:true,attackAction:'standard',free:true};
}

/** Timing is historical roll evidence; immediate reactions validate it separately. */
export function missTrickSourceFacts(proof){if(!proof)return null;const {combat,...facts}=proof;return facts;}
