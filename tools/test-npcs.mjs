import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NPC_RULES,defaultNpcProfile,npcTableValue,npcSkillBonus,npcQualityCost,npcEquipmentCost,computeNpcProfile} from '../module/rules/npcs.mjs';
const profile=()=>({...defaultNpcProfile(),enabled:true});
const example=()=>({...profile(),grades:{initiative:4,attack:3,defense:4,resilience:8,health:6,competence:9,wealth:3}});
test('all eight tables have ten independent grades and twenty threat levels',()=>{
 assert.equal(Object.keys(NPC_RULES.tables).length,8);
 for(const [key,rows] of Object.entries(NPC_RULES.tables)) {
  assert.equal(rows.length,10,key);
  for(const row of rows) {assert.equal(row.length,20,key);for(const cell of row)assert.ok(key==='health'?cell.length===2&&cell.every(Number.isFinite):Number.isFinite(cell));}
 }
 assert.equal(npcTableValue('initiative',10,20),27);
 assert.equal(npcTableValue('attack',1,1),-1);
 assert.equal(npcTableValue('defense',10,11),13);
 assert.equal(npcTableValue('resilience',8,20),13);
 assert.equal(npcTableValue('damageSave',6,10),10);
 assert.equal(npcTableValue('competence',10,20),14);
 assert.equal(npcTableValue('skill',10,20),32);
 assert.deepEqual(npcTableValue('health',10,20),[150,30]);
 assert.equal(npcTableValue('skill',0,1),null);
});
test('generated NPC data matches its editable source',()=>{
 assert.deepEqual(NPC_RULES,JSON.parse(readFileSync(new URL('../src/data/npcs.json',import.meta.url))));
});
test('p.452 worked examples produce 37 and 41 XP',()=>{
 const p=example();assert.equal(computeNpcProfile(p).xp,37);
 p.equipment.weapons.push(2);p.qualities.push({id:'minion',units:1});
 assert.equal(computeNpcProfile(p).xp,41);
});
test('special reward applies x4 once and never per individual',()=>{
 const p=example();p.group=true;
 const result=computeNpcProfile(p,'special',8);
 assert.equal(result.xp,37);assert.equal(result.missionXP,148);
 assert.deepEqual(result.health,[44,20]);
});
test('Tier offsets clamp to 1–20 without a fabricated XP surcharge',()=>{
 for(let tier=1;tier<=5;tier++) {
  const p={...example(),tier};
  for(let tl=1;tl<=20;tl++) {
   const r=computeNpcProfile(p,'standard',tl);
   assert.equal(r.effectiveLevel,Math.max(1,Math.min(20,tl+(tier-3)*2)));
   assert.equal(r.xp,37);
  }
 }
});
test('skills use max of Competence and Skilled; effective rank drives cap',()=>{
 const p=profile();p.grades.competence=10;p.skills=[{key:'science',grade:1}];
 assert.deepEqual(npcSkillBonus(p,'science',20),{competence:14,listed:10,bonus:14,ranks:14,classSkill:true,cap:60});
 assert.equal(npcSkillBonus(p,'notice',20).bonus,14);
 p.grades.competence=1;p.skills[0].grade=10;
 assert.equal(npcSkillBonus(p,'science',1).bonus,6);
 assert.equal(npcSkillBonus(p,'science',1).cap,30);
 p.skills=Array.from({length:4},(_,i)=>({key:`skill${i}`,grade:1}));
 assert.equal(computeNpcProfile(p).xp,null);
 assert.ok(computeNpcProfile(p).warnings.some(w=>w.includes('at most 3')));
});
test('equipment removal, extra picks, upgrades and ammo have distinct costs',()=>{
 const p=profile();assert.equal(npcEquipmentCost(p,'standard').total,0);
 p.equipment.weapons=[];assert.equal(npcEquipmentCost(p,'standard').total,-2);
 p.equipment.weapons=[3,2];p.extraAmmoPairs=2;
 assert.equal(npcEquipmentCost(p,'special').total,6); // +2, +1 extra pick, +1 upgrade, +2 ammo
 assert.equal(computeNpcProfile(p,'standard',1).equipmentXP,computeNpcProfile(p,'standard',20).equipmentXP);
});
test('quality cost parameters and restrictions are enforced',()=>{
 assert.equal(npcQualityCost({id:'damage-reduction',units:3}),9);
 assert.equal(npcQualityCost({id:'natural-attack',units:1,caliber:5}),10);
 assert.equal(npcQualityCost({id:'class-ability',level:7,units:2}),14);
 assert.equal(npcQualityCost({id:'foil',modifier:-3}),-3);
 assert.equal(npcQualityCost({id:'removable-quality',linkedCost:1}),1);
 assert.equal(npcQualityCost({id:'fleet',units:2,limited:true}),2);
 const p=profile();p.qualities=[{id:'henchman',units:1}];
 assert.equal(computeNpcProfile(p,'standard').xp,null);
 p.qualities=[{id:'tough',units:6}];assert.equal(computeNpcProfile(p).xp,null);
 p.qualities=[{id:'horde',units:1}];assert.ok(computeNpcProfile(p).warnings.some(w=>w.includes('requires minion')));
 p.qualities=[{id:'unknown'}];assert.equal(computeNpcProfile(p).xp,null);
});
test('negative qualities respect half-statistic floor; equipment may reduce reward to zero',()=>{
 const p=profile();p.qualities=[{id:'all-thumbs',units:1},{id:'clumsy',units:1},{id:'non-combatant',units:1}];
 assert.equal(computeNpcProfile(p).xp,4);
 p.equipment={weapons:[],gear:[],vehicles:[]};assert.equal(computeNpcProfile(p).xp,0);
});
test('attributes are priced once and invalid build inputs do not produce final XP',()=>{
 const p=profile();assert.equal(computeNpcProfile(p,'standard',1,{str:{value:16}}).qualityXP,6);
 assert.equal(computeNpcProfile(p,'standard',0).xp,null);
 assert.equal(computeNpcProfile(p,'standard',1,{str:{value:31}}).xp,null);
 p.grades.attack=11;assert.equal(computeNpcProfile(p).xp,null);
});
test('printed health anomalies remain explicit and visible',()=>{
 const p=profile();p.grades.health=1;
 let r=computeNpcProfile(p,'special',12);assert.deepEqual(r.health,[26,14]);assert.ok(r.manual.some(n=>n.includes('anomalous')));
 p.grades.health=5;r=computeNpcProfile(p,'special',9);assert.deepEqual(r.health,[45,10]);
});
test('legacy manual mode is the default; villain resolves as a special role',()=>{
 assert.equal(defaultNpcProfile().enabled,false);
 assert.equal(computeNpcProfile(example(),'villain',1).multiplier,4);
});
