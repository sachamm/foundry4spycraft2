import { TABLES } from './tables.mjs';
import { stepLookup } from './formula.mjs';
import { NPC_RULES } from './npc-tables.mjs';
export { NPC_RULES };
export const NPC_STATS = {initiative:'Initiative',attack:'Attack',defense:'Defense',resilience:'Resilience',health:'Damage save / vitality & wounds',competence:'Competence',wealth:'Wealth'};
export const NPC_CATEGORIES = ['weapons','gear','vehicles'];
export function defaultNpcProfile() {
 return {enabled:false,tier:3,group:false,grades:Object.fromEntries(Object.keys(NPC_STATS).map(k=>[k,1])),skills:[],equipment:{weapons:[1],gear:[1],vehicles:[1]},extraAmmoPairs:0,qualities:[]};
}
const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function npcTableValue(stat,grade,level,rules=NPC_RULES) {
 if(!integer(grade,1,10)||!integer(level,1,20)||!rules.tables[stat])return null;
 return rules.tables[stat][grade-1][level-1];
}
export function npcSkillBonus(profile,key,level,rules=NPC_RULES) {
 const competence=profile.type==='animal'?0:npcTableValue('competence',profile.grades.competence,level,rules)??0;
 const selected=profile.skills.find(s=>s.key===key);
 const listed=selected?npcTableValue('skill',selected.grade,level,rules):null;
 const bonus=Math.max(competence,listed??0);
 return {competence,listed,bonus,ranks:bonus,classSkill:!!selected,cap:stepLookup(TABLES.skillCap,bonus)};
}
/** Cost of ONE selected quality entry; units mean the unit named in its cost label. */
export function npcQualityCost(entry,catalog=NPC_RULES.qualities) {
 const rule=catalog.find(q=>q.id===entry.id);
 if(!rule)return null;
 const units=entry.units??1;
 if(!integer(units,1,100))return null;
 if(rule.mode==='caliber')return integer(entry.caliber,1,5)?rule.cost*entry.caliber*units:null;
 if(rule.mode==='dedicated')return null; // Skilled and attributes are priced in their dedicated controls.
 if(rule.mode==='classLevel')return integer(entry.level,1,20)?entry.level*units:null;
 if(rule.mode==='decision')return integer(entry.modifier,-5,5)?entry.modifier:null;
 if(rule.mode==='linked')return Number.isFinite(entry.linkedCost)&&entry.linkedCost>=0?Math.max(1,entry.linkedCost-1)*units:null;
 if(rule.mode==='movement')return (entry.limited?Math.sign(rule.cost):rule.cost)*units;
 return rule.cost*units;
}
/** Equipment is fixed at every TL; vehicle pick belongs to the group for standard NPCs. */
export function npcEquipmentCost(profile,type,rules=NPC_RULES) {
 const rows=[],warnings=[];let total=0;
 for(const category of NPC_CATEGORIES) {
  const picks=profile.equipment?.[category];
  if(!Array.isArray(picks)||picks.some(c=>!integer(c,1,5))) {warnings.push(`${category}: every pick needs a Caliber from I to V.`);continue;}
  if(type==='animal'&&picks.length)warnings.push('Animals gain equipment through Augmented, not ordinary picks.');
  const starting=rules.equipment.starting[type][category];
  const removed=Math.max(0,starting-picks.length);
  const added=Math.max(0,picks.length-starting);
  const upgrades=picks.reduce((sum,c)=>sum+c-1,0);
  const xp=removed*rules.equipment.removedStartingPickXP+added*rules.equipment.additionalPickXP+upgrades*rules.equipment.caliberRaiseXP;
  rows.push({label:category,xp});total+=xp;
 }
 if(!integer(profile.extraAmmoPairs??0,0,100))warnings.push('Additional ammunition must be entered in pairs of stockpiles.');
 else {total+=profile.extraAmmoPairs??0;rows.push({label:'Additional ammunition',xp:profile.extraAmmoPairs??0});}
 return {total,rows,warnings};
}
export function computeNpcProfile(profile,type='standard',threatLevel=1,abilities={},rules=NPC_RULES) {
 // Legacy villain selection maps to special; villain roles are qualities in new profiles.
 type=type==='villain'?'special':type;
 const warnings=[],manual=[],breakdown=[];
 if(!['standard','special','animal'].includes(type))return {warnings:['Unknown NPC type.'],complete:false,xp:null};
 if(!integer(threatLevel,1,20))warnings.push('Threat Level must be from 1 to 20.');
 if(!integer(profile.tier,1,5))warnings.push('NPC Tier must be from I to V.');
 const effectiveLevel=clamp((Number(threatLevel)||1)+((Number(profile.tier)||3)-3)*2,1,20);
 if(profile.tier!==3)manual.push('Tier III is the mission-design default; use other Tiers only when a rule specifies them (p.452).');
 const grades=profile.grades??{};
 for(const key of Object.keys(NPC_STATS)) {
  if(type==='animal'&&['competence','wealth'].includes(key))continue;
  if(key==='wealth'&&grades[key]===0)continue;
  if(!integer(grades[key],1,10))warnings.push(`${NPC_STATS[key]} needs a grade from I to X.`);
 }
 const baseXP=Object.entries(grades).filter(([key])=>Object.hasOwn(NPC_STATS,key)&&!(type==='animal'&&['competence','wealth'].includes(key))).reduce((n,[,g])=>n+(Number(g)||0),0);
 breakdown.push({label:'Statistic grades (including Wealth)',xp:baseXP});
 const equipment=npcEquipmentCost(profile,type,rules);warnings.push(...equipment.warnings);
 const skills=profile.skills??[];
 if(type!=='animal'&&skills.length>(type==='special'?5:3))warnings.push(`Skilled permits at most ${type==='special'?5:3} listed skills for this NPC type.`);
 const seen=new Set();
 const animalSkills=['acrobatics','athletics','blend','intimidate','notice','search','resolve','senseMotive','sneak','survival','tactics'];
 for(const s of skills) {
  if(!s.key||seen.has(s.key))warnings.push('Listed skills must be distinct and named.');
  if(type==='animal'&&!animalSkills.includes(s.key))warnings.push(`${s.key}: not an allowed animal skill (p.445).`);
  seen.add(s.key);
  if(!integer(s.grade,1,10))warnings.push(`${s.key}: invalid skill grade.`);
 }
 let qualityXP=skills.reduce((n,s)=>n+(Number(s.grade)||0),0);
 breakdown.push({label:'Skilled qualities',xp:qualityXP});
 // Attribute differences are quality purchases; do not also add a quality row.
 for(const [key,value] of Object.entries(abilities)) {
  const score=Number(value?.value??value),base=type==='animal'&&key==='int'?2:10;
  if(!integer(score,2,type==='animal'&&key==='int'?6:30))warnings.push(`${key.toUpperCase()}: attribute outside NPC quality limits.`);
  const delta=score-base;qualityXP+=delta; if(delta)breakdown.push({label:`${key.toUpperCase()} attribute quality`,xp:delta});
 }
 const selections=profile.qualities??[],counts=new Map();
 const ids=new Set(selections.map(q=>q.id));
 for(const entry of selections) {
  const q=rules.qualities.find(q=>q.id===entry.id),cost=npcQualityCost(entry,rules.qualities);
  if(!q||cost===null){warnings.push(`Unresolved quality cost: ${entry.id}.`);continue;}
  if(!q.types.includes(type))warnings.push(`${q.name} is not available to ${type} NPCs.`);
  if(q.requires&&!ids.has(q.requires))warnings.push(`${q.name} requires ${q.requires}.`);
  if(q.groupOnly&&!profile.group)warnings.push(`${q.name} requires an NPC group.`);
  const count=(counts.get(q.id)??0)+(entry.units??1);counts.set(q.id,count);
  let max=q.max??(q.repeatable?Infinity:1);
  if(q.id==='feat')max=ids.has('mastermind')?15:ids.has('henchman')||ids.has('foil')?10:5;
  if(q.id==='class-ability')max=type==='special'?10:5;
  if(count>max)warnings.push(`${q.name}: maximum ${max} application(s).`);
  if(q.id==='flight'&&(entry.units??1)>5)warnings.push('Flight is limited to 100 ft.');
  if(q.mode==='linked')manual.push('Removable Quality replaces the linked quality cost. Record its effect here; do not charge it a second time.');
  if(q.id==='class-ability')manual.push('Class Ability: GC must check ability eligibility and its lowest granting class level (p.446).');
  if(q.id==='feat')manual.push('Feat: GC must check feat prerequisites that require other feats (p.447).');
  manual.push(`${q.name}: apply its play effects from p.${q.page}${entry.details?` (${entry.details})`:''}.`);
  qualityXP+=cost;breakdown.push({label:q.name,xp:cost});
 }
 if(['minion','henchman','mastermind'].filter(id=>ids.has(id)).length>1)warnings.push('Minion, henchman and mastermind are mutually exclusive.');
 const floor=Math.ceil(baseXP*rules.qualityFloorFraction);
 const afterQualities=Math.max(floor,baseXP+qualityXP);
 breakdown.push({label:'Quality floor adjustment',xp:afterQualities-baseXP-qualityXP});
 breakdown.push(...equipment.rows);
 const reward=Math.max(0,afterQualities+equipment.total);
 const multiplier=type==='special'?rules.specialMultiplier:1;
 const stats=Object.fromEntries(['initiative','attack','defense','resilience'].map(key=>[key,npcTableValue(key,grades[key],effectiveLevel,rules)]));
 const health=npcTableValue(type==='special'?'health':'damageSave',grades.health,effectiveLevel,rules);
 if(type==='special'&&((grades.health===1&&effectiveLevel===12)||(grades.health===5&&effectiveLevel===9)))manual.push('This health cell is anomalous in both supplied PDFs (I/TL12: 26/14; V/TL9: 45/10). Value preserved as printed; GC ruling may be needed.');
 if(type==='animal')manual.push('Animal permitted actions, trained commands and skill-check restrictions require GC adjudication (p.445).');
 const attributes={str:10,dex:10,con:10,int:type==='animal'?2:10,wis:10,cha:10,...Object.fromEntries(Object.entries(abilities).map(([k,v])=>[k,Number(v?.value??v)]))};
 const skillTotals=skills.map(s=>({...s,...npcSkillBonus({...profile,type},s.key,effectiveLevel,rules)}));
 const complete=warnings.length===0;
 return {type,effectiveLevel,baseXP,qualityXP,qualityFloor:floor,equipmentXP:equipment.total,breakdown,complete,xp:complete?reward:null,missionXP:complete?reward*multiplier:null,multiplier,stats,health,attributes,competence:type==='animal'?0:npcTableValue('competence',grades.competence,effectiveLevel,rules),skills:skillTotals,warnings,manual:[...new Set(manual)],ammoPerWeapon:rules.equipment.ammo[type]};
}
