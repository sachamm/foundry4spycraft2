import {readiedMeleeFeatSource} from './readied-weapons.mjs';
/** Axe Basics p.176: gear +1 with melee Disarm attacks while holding a readied axe.
 * It need not be the attacking weapon. Ranged attacks get no bonus.
 */
export function axeDisarmPlan(system,{ranged=false}={}){
 if(ranged)return null;
 const source=readiedMeleeFeatSource(system,{name:'Axe Basics',family:'axe',bonus:1});
 return {version:1,gearBonus:source?1:0,source};
}
const stable=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
export function validateAxeDisarmProof(system,disarm,{checkKind,weaponProficiency}={}){
 if(!disarm?.axeBasics)return;
 if(checkKind!=='attack'||disarm.active!==true||!['unarmed','blunt','exoticBlunt','edged','exoticEdged'].includes(weaponProficiency)||stable(axeDisarmPlan(system))!==stable(disarm.axeBasics))throw Error('The readied axe, Axe Basics source or melee Disarm attack changed before posting.');
}
