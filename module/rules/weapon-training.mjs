import {launcherOperationPlan} from './firearms.mjs';
/** Immutable owned source, distinct from a substituted operating proficiency. */
export function weaponSourceIdentity(weapon,{operatingProficiency=weapon?.proficiency??null}={}){
 return {weaponId:weapon?.id??weapon?._id??null,sourceProficiency:weapon?.proficiency??null,sourceCategory:weapon?.weaponCategory??'',operatingProficiency};
}
/** Scope is identity/training. Do not reject provisional destruction caused by an
 * original error that a legal replacement roll is currently correcting.
 */
export function ownedWeaponTraining(actor,proof,{checkKind,weaponProficiency,weaponUuid,attackContext={}}={}){
 const item=actor.items?.get?.(proof.weaponId)??actor.items?.find?.(i=>(i.id??i._id)===proof.weaponId);
 if(checkKind!=='attack'||typeof proof.weaponId!=='string'||!proof.weaponId||item?.type!=='weapon'||weaponUuid&&item.uuid!==weaponUuid)throw Error('The owned attack weapon changed or is no longer present.');
 const weapon={...item.system,id:item.id??item._id},context=attackContext.launcherOperation,launcher=launcherOperationPlan(weapon,{indirectFire:context?.mode==='indirect',underbarrelMountConfirmed:context?.underbarrelMountConfirmed===true,usingIntegralTripod:context?.usingIntegralTripod===true,vehicleMounted:attackContext.vehicleMounted===true}),operatingProficiency=launcher.applicable?launcher.proficiency:weapon.proficiency;
 if(launcher.blocked||operatingProficiency!==weaponProficiency)throw Error('The actual operating proficiency or launcher context changed before posting.');
 const trained=actor.type!=='agent'||(actor.system.proficiencyTotals??actor.system.proficiencies)?.[operatingProficiency]?.proficient===true;
 return {weapon,operatingProficiency,trained};
}
