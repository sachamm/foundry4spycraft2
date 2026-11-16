import {readiedMeleeFeatSource} from './readied-weapons.mjs';
/** Polearm Basics p.179: +1 gear Defense while holding a readied polearm. */
export function polearmDefensePlan(system){
 const source=readiedMeleeFeatSource(system,{name:'Polearm Basics',family:'polearm',bonus:1});
 return {version:1,source,gearBonus:source?1:0};
}
