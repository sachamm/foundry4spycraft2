import {weaponGrip} from './gear.mjs';
import {combatStanceState} from './combat-stance.mjs';
import {readiedItemsForCheck} from './readied-replacement.mjs';
/** Record the physical grip only when the new stance affects this melee attack. */
export function grippingAttackProof(system,weapon,{ranged=false,hands=weapon.useHands??0}={}){const stance=combatStanceState(system),grip=weaponGrip(system,weapon,{hands});if(ranged||stance?.key!=='gripping'||grip.required!==2||grip.hands!==1)return null;return {version:1,stance,weaponId:weapon.id??null,weaponGrip:{useHands:weapon.useHands??0,sizeHands:weapon.sizeHands??null,proficiency:weapon.proficiency},hands:grip.hands,required:grip.required,attackPenalty:grip.attackPenalty};}
const stable=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
export function validateGrippingAttackProof(actor,proof,{checkKind,weaponUuid,attackContext={},rerollOf}={}){
 if(!proof)return;
 if(checkKind!=='attack'||attackContext.ranged!==false||!actor.system.activeFeatNames?.includes('Spear Basics'))throw Error('The qualified Gripping Stance melee attack changed.');
 let system=actor.system,items=[...(actor.items??[])];
 if(rerollOf){const origin=globalThis.fromUuidSync?.(rerollOf),c=origin?.flags?.spycraft2;if(c?.actorUuid!==actor.uuid||c.checkKind!=='attack'||c.weaponUuid!==weaponUuid||c.resolved||c.superseded||stable(c.attackContext?.grippingStance)!==stable(proof))throw Error('Use the original owned Gripping Stance attack for this replacement.');system={...system,combatStance:{...proof.stance}};items=readiedItemsForCheck(actor,{rerollOf,disarm:c.attackContext?.disarm});}
 const item=items.find(i=>(i.id??i._id)===proof.weaponId);if(!item||item.type!=='weapon'||weaponUuid&&item.uuid!==weaponUuid)throw Error('The actual Gripping Stance weapon changed.');
 const current=grippingAttackProof(system,{...item.system,id:item.id??item._id},{ranged:false,hands:attackContext.hands??item.system.useHands??0});if(stable(current)!==stable(proof))throw Error('The actual grip, qualified Gripping Stance or weapon changed before posting.');
}
