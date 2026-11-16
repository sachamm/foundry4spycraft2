import {weaponGrip,weaponUnavailable} from './gear.mjs';
import {cqbRangedWeapon} from './cqb.mjs';
/** Gear represents a physically held/readied personal weapon with equipped+carried flags.
 * Ammunition and proficiency are not prerequisites for merely holding the weapon.
 */
export function readiedRangedWeapons(system,items=[]){
 const ready=[];
 for(const item of items){const w={...item.system,name:item.name},id=item.id??item._id;if(item.type!=='weapon'||typeof id!=='string'||!id||w.equipped!==true||w.carried===false||!Number.isSafeInteger(w.quantity??1)||(w.quantity??1)<1||!cqbRangedWeapon(w)||weaponUnavailable(w))continue;
  const grip=weaponGrip(system,w);if(grip.blocked||![1,2].includes(grip.required)||![1,2].includes(grip.hands))continue;
  ready.push({id,uuid:item.uuid??null,name:item.name,proficiency:w.proficiency,hands:grip.hands,requiredHands:grip.required});
 }
 return ready.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
}

/** Explicitly reviewed family, never guessed from an editable display name.
 * Only a physically held/readied, usable melee weapon can supply these benefits.
 * A held throwing axe can still be a readied axe; attack proficiency alone does not define its family.
 */
export const MELEE_SKILL_FAMILIES=['axe','spear','whip','staff','hammer','twoHandedSword','polearm'];
const familyProficiencies={polearm:['exoticEdged'],axe:['edged','exoticEdged','hurled','exoticHurled'],spear:['edged','exoticEdged','hurled','exoticHurled'],whip:['exoticBlunt'],staff:['blunt','exoticBlunt'],hammer:['blunt','exoticBlunt','hurled','exoticHurled'],twoHandedSword:['edged','exoticEdged']};
export const meleeFamilyProficiency=(family,proficiency)=>familyProficiencies[family]?.includes(proficiency)===true;
export function readiedMeleeWeapons(system,items=[]){
 const ready=[];
 for(const item of items){
  const w={...item.system,name:item.name},id=item.id??item._id;
  if(item.type!=='weapon'||typeof id!=='string'||!id||!MELEE_SKILL_FAMILIES.includes(w.meleeFamily)||!meleeFamilyProficiency(w.meleeFamily,w.proficiency)||w.equipped!==true||w.carried===false||!Number.isSafeInteger(w.quantity??1)||(w.quantity??1)<1||weaponUnavailable(w))continue;
  const grip=weaponGrip(system,w);
  if(grip.blocked||![1,2].includes(grip.required)||![1,2].includes(grip.hands)||w.meleeFamily==='twoHandedSword'&&grip.required!==2)continue;
  ready.push({id,uuid:item.uuid??null,name:item.name,family:w.meleeFamily,proficiency:w.proficiency,hands:grip.hands,requiredHands:grip.required});
 }
 return ready.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
}

/** Shared immutable source for a qualified feat requiring a physically readied family. */
export function readiedMeleeFeatSource(system,{name,family,bonus}){
 const names=system.activeFeatNames??[],weapons=system.readiedMeleeWeapons??[];
 if(!Array.isArray(names)||names.some(n=>typeof n!=='string')||!Array.isArray(weapons))throw Error('Review the current qualified melee feats and readied weapon families.');
 if(!names.includes(name))return null;
 const held=weapons.filter(w=>w?.family===family);
 if(held.some(w=>typeof w.id!=='string'||!w.id||typeof w.name!=='string'||!meleeFamilyProficiency(family,w.proficiency)||![1,2].includes(w.hands)||![1,2].includes(w.requiredHands)||family==='twoHandedSword'&&w.requiredHands!==2)||new Set(held.map(w=>w.id)).size!==held.length)throw Error('Review the actual held melee weapon identity and legal grip.');
 return held.length?{feat:name,family,bonus,weapons:held.map(w=>({id:w.id,uuid:w.uuid??null,name:w.name,proficiency:w.proficiency,hands:w.hands,requiredHands:w.requiredHands})).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)}:null;
}
