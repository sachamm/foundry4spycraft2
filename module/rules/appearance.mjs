/** Gorgeous / The Look p.203. Named check modifiers stay separate from the skill bonus. */
export function appearanceCheckPlan(system,key,check,{manhuntPrey=false}={}){
 const gorgeous=system.activeFeatNames?.includes('Gorgeous')===true,look=system.activeFeatNames?.includes('The Look')===true,irresistible=system.activeFeatNames?.includes('Simply Irresistible')===true;
 const positive=['impress','networking'].includes(key),penalized=key==='blend'&&(check?.id==='stealth'||manhuntPrey===true)||key==='falsify'&&check?.id==='disguise';
 const ugly=system.activeFeatNames?.includes('Too Ugly to Die')===true&&['blend','networking'].includes(key);
 const appearance=look&&['cultures','impress','networking','profession'].includes(key)?1:0;
 const appearanceApplicable=(gorgeous||look||irresistible)&&(positive||penalized||appearance);
 if(!appearanceApplicable&&!ugly)return {applicable:false,bonuses:[],errorIncrease:0,notes:[]};
 const source=!appearanceApplicable?'Too Ugly to Die':irresistible?'Simply Irresistible':look?'The Look':'Gorgeous',synergy=!appearanceApplicable?0:positive?(irresistible?6:look?4:2):penalized?(irresistible?-4:look?-2:-1):0,errorIncrease=(look||irresistible)&&penalized?1:0,criticalFailureDiscount=irresistible&&penalized?1:0;
 const evidence={version:1,source,skillKey:key,checkId:check.id,synergy,uglyPenalty:ugly?-4:0,errorIncrease,criticalFailureDiscount,appearanceBonus:appearance,manhuntPrey:key==='blend'&&manhuntPrey===true};
 return {applicable:true,evidence,timeChoices:irresistible&&positive?[{id:'irresistible',name:'Simply Irresistible',multiplier:0.5,minimum:6,rounding:'down'}]:[],criticalFailureDiscount,bonuses:[...(synergy?[{source,type:'synergy',value:synergy}]:[]),...(ugly?[{source:'Too Ugly to Die',type:'synergy',value:-4}]:[])],errorIncrease,notes:[...(ugly?['Too Ugly to Die: synergy penalty −4 with all Blend/Networking checks (p.205).']:[]),...(appearanceApplicable?[`${source}: ${synergy?`synergy ${synergy>0?'+':''}${synergy}`:'appearance +1 included in skill bonus'}${errorIncrease?'; error range +1':''}${irresistible?'; replaces The Look skill modifiers':look&&gorgeous?'; replaces Gorgeous skill modifiers':''}${criticalFailureDiscount?'; opponent error activation cost −1 (minimum1)':''} (p.${irresistible?205:203}).`]:[])]};
}

/** Bloodstain Resistant p.201; use the armor pipeline's selected/worn items. */
export function bloodstainDefensePlan(system,{appearance,wornArmor=[]}={}){
 const earned=system.activeFeatNames?.includes('Bloodstain Resistant')===true,dressed=system.wealthAllocation?.dressedForLifestyle===true;
 const result={earned,dressed,appearance:Number.isFinite(appearance)?appearance:null,bonus:0,obviousArmor:[],unknownArmor:[],reason:''};
 if(!earned)return result;
 if(!dressed)return {...result,reason:'Declare that you are dressed according to your Lifestyle.'};
 if(!Number.isFinite(appearance))return {...result,reason:'Review your Lifestyle Appearance modifier.'};
 for(const armor of wornArmor){const notice=String(armor.system?.notice??'').trim();if(/\bobvious\b/i.test(notice))result.obviousArmor.push(armor.name??armor.id);else if(!notice)result.unknownArmor.push(armor.name??armor.id);}
 if(result.obviousArmor.length)return {...result,reason:'Bloodstain Resistant is unavailable while wearing obvious armor (p.201).'};
 if(result.unknownArmor.length)return {...result,reason:'Review the Notice/Search DC of the worn armor before receiving Bloodstain Resistant.'};
 return {...result,bonus:Math.max(0,appearance),reason:appearance>0?'':'Your Appearance modifier is not positive.'};
}
