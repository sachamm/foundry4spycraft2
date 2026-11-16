import {axeDisarmPlan} from './axe-disarm.mjs';
/** Disarm pp.352,356 and Expert Disarm p.174. Opposed results and weapon landing are adjudicated at the table. */
export const DISARM_SIZES=['Nuisance','Fine','Diminutive','Tiny','Small','Medium','Large','Huge','Gargantuan','Colossal','Enormous','Vast'];
const codes=['N','F','D','T','S','M','L','H','G','C','E','V'];
export function disarmWeaponSize(system,weapon){
 if(weapon.proficiency==='unarmed'){const index=DISARM_SIZES.indexOf(String(system.size??'Medium').split(/[ (]/)[0]);return index<0?null:index-2;}
 const code=String(weapon.sizeHands??'').split('/')[0].trim();const i=codes.indexOf(code);return i<0?null:i;
}
export function disarmAttackPlan(system,weapon,{grip,trained=true,ranged=false,action='standard',context}={}){
 if(!context)return {active:false,attackBonus:0,errorIncrease:0,notes:[]};
 const reject=reason=>({active:true,blocked:true,reason,attackBonus:0,errorIncrease:0,notes:[]});
 if(action!=='standard')return reject('Disarm uses an opposed Standard Attack check.');
 if(context.confirmed!==true||context.lineOfSightConfirmed!==true||context.rangeConfirmed!==true||context.opponentArmedConfirmed!==true)return reject('The GC must confirm the armed opponent, line of sight, and Reach/CQB range for this Disarm.');
 const opponentSize=DISARM_SIZES.indexOf(context.opponentWeaponSize),ownSize=disarmWeaponSize(system,weapon);
 if(opponentSize<0||ownSize===null)return reject('Confirm both actual weapon Sizes before making the Disarm check.');
 let axeBasics;try{axeBasics=axeDisarmPlan(system,{ranged});}catch(error){return reject(error.message);}
 const expert=system.activeFeatNames?.includes('Expert Disarm')===true,twoHandBonus=weapon.proficiency!=='unarmed'&&grip?.hands===2?4:0,sizeBonus=ranged?0:4*Math.max(0,ownSize-opponentSize),expertBonus=expert?2:0,errorIncrease=2+(trained?0:2);
 return {active:true,...(axeBasics?{axeBasics}:{}),expert,expertBonus,twoHandBonus,sizeBonus,ownSize,opponentWeaponSize:context.opponentWeaponSize,opponentLabel:String(context.opponentLabel??'').slice(0,160),attackBonus:expertBonus+twoHandBonus+sizeBonus+(axeBasics?.gearBonus??0),errorIncrease,actionCost:trained?'1 half action':'1 full action; Proficiency time cannot be reduced',shots:1,requiresOpposedStandardAttack:true,loseFlatFooted:!expert,loseBonusDisarm:!expert,loseFinalAttackStillPossible:true,notes:[...(axeBasics?.gearBonus?['Axe Basics: +1 gear with this melee Disarm attack while holding a readied axe (p.176).']:[]),`Disarm: opposed Standard Attack; +${twoHandBonus} two-hand grip, +${sizeBonus} melee weapon Size, +${expertBonus} Expert Disarm; error range +${errorIncrease}.`,trained?'Disarm costs 1 half action and 1 shot for ammunition weapons.':'Untrained Proficiency: 1 full action, time cannot be reduced; error increase includes the additional +2 (p.352).',...(expert?['Expert Disarm: losing this check does not make you flat-footed or grant the opponent a bonus Disarm. A loss with critical success/failure may still grant the opponent a final attack.']:[]),'GC resolves the opposed check, landing/deviation, critical effects, weapon transfer and any final attack at the table.']};
}
