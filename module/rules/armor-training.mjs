/** Armor types and training feats, pp.172,225,284. Helmets and miscellaneous protective gear are separate. */
export const ARMOR_TYPES={P:'Partial',M:'Moderate',F:'Full'};
export function armorTypeChoice(value){const text=String(value??'').trim().toLowerCase();return Object.entries(ARMOR_TYPES).find(([key,label])=>key.toLowerCase()===text||label.toLowerCase()===text)?.[0]??null;}
export function armorTrainingRules(items,active){
 const find=name=>items.find(i=>i.type==='feat'&&i.name===name&&active.has(i.id)),basic=find('Armor Basics'),master=find('Armor Mastery'),supreme=find('Armor Supremacy'),types=supreme?Object.keys(ARMOR_TYPES):[...new Set([basic,master].map(f=>armorTypeChoice(f?.system.choice)).filter(Boolean))];
 return {basics:!!(basic||supreme),mastery:!!(master||supreme),supremacy:!!supreme,types,sourceIds:[basic,master,supreme].filter(Boolean).map(f=>f.id)};
}
const reducePenalty=(value,amount)=>{const n=Number(value)||0;return n<0?Math.min(0,n+amount):n;};
export function armorTrainingAdjustments(item,training={},slot='body'){
 const base=item.system??{},type=armorTypeChoice(base.armorType),armor=slot==='body'&&!!type,chosen=armor&&(training.types??[]).includes(type),basic=chosen&&training.basics,mastery=chosen&&training.mastery,supremacy=armor&&training.supremacy,system={...base};
 if(type)system.armorType=type;
 const benefits={meleeWeaponDR:0,rangedWeaponDR:0,meleeAttackDR:supremacy?1:0,rangedAttackDR:supremacy?1:0,defense:mastery?1:0,noticeDC:0,coupDeGraceRequiresHelpless:!!mastery,sneakAttackImmune:!!supremacy};
 if(basic){system.armorType=type;if(type==='P'){system.defensePenalty=reducePenalty(base.defensePenalty,2);system.armorCheck=reducePenalty(base.armorCheck,1);benefits.meleeWeaponDR=1;benefits.noticeDC=4;const notice=String(base.notice??'').match(/^(\d+)(D?)$/i);if(notice)system.notice=String(Number(notice[1])+4)+notice[2];}if(type==='M'){system.armorCheck=reducePenalty(base.armorCheck,2);system.speedPenalty=reducePenalty(base.speedPenalty,5);benefits.rangedWeaponDR=1;}if(type==='F'){system.armorCheck=reducePenalty(base.armorCheck,1);benefits.meleeWeaponDR=benefits.rangedWeaponDR=2;}}
 return {system,benefits,type,chosen:!!chosen,applies:!!(basic||mastery||supremacy)};
}
/** Listed DR before armor piercing, damage-type exceptions and resistance. Keep armor bonuses inside the quality maximum. */
export function armorTrainingDRForAttack(system,kind){
 if(!['unarmed','meleeWeapon','hurledWeapon','rangedWeapon','other'].includes(kind))throw new Error('Choose the incoming attack’s armor DR category.');
 if(!system.damageReductionComponents||!['natural','class','armorMelee','armorOther'].every(k=>Number.isFinite(system.damageReductionComponents[k])))throw new Error('Prepare the DR source components before applying armor training.');
 const first=['unarmed','meleeWeapon','hurledWeapon'].includes(kind),components=system.damageReductionComponents,rules=system.armorFeatRules??{},weapon=kind==='meleeWeapon'?(rules.meleeWeaponDR??0):['hurledWeapon','rangedWeapon'].includes(kind)?rules.rangedWeaponDR??0:0,attack=['unarmed','meleeWeapon'].includes(kind)?rules.meleeAttackDR??0:['hurledWeapon','rangedWeapon'].includes(kind)?rules.rangedAttackDR??0:0,armor=(first?components.armorMelee:components.armorOther)+weapon+attack;
 const feat=components.feat??0;if(!Number.isSafeInteger(feat)||feat<0)throw new Error("Review the independent feat DR component.");
 return Math.max(components.natural,armor+components.class)+feat;
}
