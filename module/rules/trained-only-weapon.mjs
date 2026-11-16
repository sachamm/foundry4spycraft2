import {trainedOnlyAttackPlan} from './trained-only.mjs';
import {weaponSourceIdentity,ownedWeaponTraining} from './weapon-training.mjs';
export function trainedOnlyWeaponPlan(weapon,{trained=false,operatingProficiency=weapon?.proficiency??null}={}){
 const p=trainedOnlyAttackPlan(weapon,{trained});
 return {...p,evidence:{...p.evidence,...weaponSourceIdentity(weapon,{operatingProficiency})}};
}
const stable=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
export function validateTrainedOnlyWeaponProof(actor,proof,context={}){
 if(!proof)return;
 const {weapon,operatingProficiency,trained}=ownedWeaponTraining(actor,proof,context),current=trainedOnlyWeaponPlan(weapon,{trained,operatingProficiency});
 if(current.blocked||stable(current.evidence)!==stable(proof))throw Error('The Trained Only weapon quality or actual operating proficiency changed or no longer permits this attack.');
}
