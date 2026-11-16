import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {SPYCRAFT as cfg} from '../module/config.mjs';import {computeAgent} from '../module/rules/engine.mjs';import {purchasedSkillRanks} from '../module/rules/checks.mjs';
const feats=JSON.parse(readFileSync(new URL('../src/data/feats.json',import.meta.url)));
const feat=(name,patch={})=>({id:name,name,type:'feat',system:{...structuredClone(feats.find(f=>f.name===name)),granted:true,...patch}});
const cls={id:'test',name:'Test',type:'class',system:{identifier:'test',skillPoints:4,vitalityDie:6,classSkills:[],table:[]}};
function compute(items,levels){return computeAgent({abilities:Object.fromEntries(['str','dex','con','int','wis','cha'].map(k=>[k,{base:10}])),progression:levels.map(skills=>({classId:'test',skills,vitality:1})),skills:{},focuses:{},misc:{}},[cls,...items],cfg);}

test('RAW p.201: Well-Rounded buys the first three cross-class ranks for one point each, then two points per rank',()=>{
 assert.deepEqual(purchasedSkillRanks(3,false,{discountedRanks:3}),{ranks:3,valid:true});
 assert.deepEqual(purchasedSkillRanks(4,false,{discountedRanks:3}),{ranks:3,valid:false});
 assert.deepEqual(purchasedSkillRanks(5,false,{discountedRanks:3}),{ranks:4,valid:true});
 const sys=compute([feat('Well Rounded')],[{analysis:3},{analysis:2}]);assert.equal(sys.skillTotals.analysis.ranks,4);
 const late=compute([feat('Well Rounded',{acquiredAtLevel:2})],[{analysis:2},{analysis:2}]);assert.equal(late.skillTotals.analysis.ranks,3);
});

test('Well-Rounded increases only zero-rank caps by five',()=>{
 const sys=compute([feat('Well Rounded')],[{analysis:1}]);assert.equal(sys.skillTotals.analysis.cap,20);assert.equal(sys.skillTotals.bluff.cap,20);
 assert.equal(compute([],[{}]).skillTotals.bluff.cap,15);
});

test('RAW p.201: Unlocked Potential locks career+6 maximum and requires the chosen skill to reach it each level',()=>{
 const unlocked=feat('Unlocked Potential',{choice:'analysis'}),origin={id:'boost',name:'Other boost',type:'origin',system:{bonuses:[{target:'skills.analysis.maxRanks',value:'20'}]}};
 const sys=compute([unlocked,origin],[{analysis:7},{analysis:1}]);assert.equal(sys.skillTotals.analysis.maxRanks,8);assert.equal(sys.skillTotals.analysis.ranks,8);
 assert.ok(!sys.warnings.some(w=>w.includes('Unlocked Potential requires')));
 const short=compute([unlocked],[{analysis:1,bluff:2}]);assert.ok(short.warnings.some(w=>w.includes('Unlocked Potential requires')&&w.includes('(7)')));
});

test('free Talented ranks do not earn purchased-rank focus awards; Training purchases do',()=>{
 const talented=feat('Talented',{choice:'Speed Demon'}),sys=compute([talented],[{mechanics:4}]);
 assert.equal(sys.skillTotals.drive.ranks,4);assert.equal(sys.skillTotals.drive.purchasedRanks,0);assert.equal(sys.focusPicks.drive.baseAvailable,1);
 const bought=compute([feat('Training',{trainingSkills:{drive:4}})],[{}]);assert.equal(bought.skillTotals.drive.purchasedRanks,4);assert.equal(bought.focusPicks.drive.baseAvailable,2);
});

test('free Talented Networking ranks do not award contact grades',()=>{
 const talented=feat('Talented',{choice:'Diplomat'}),sys=compute([talented],[{senseMotive:4}]);
 assert.equal(sys.skillTotals.networking.ranks,4);assert.equal(sys.skillTotals.networking.purchasedRanks,0);assert.equal(sys.contactPicks.available,1);
 const bought=compute([feat('Training',{trainingSkills:{networking:4}})],[{}]);assert.equal(bought.contactPicks.available,2);
});


test("RAW Table 2.4 p.91: every rank 0–40 maps to its correct result-cap interval",()=>{
 for(let rank=0;rank<=40;rank++){
  const expected=rank===0?15:rank<=3?20:rank<=6?30:rank<=9?40:rank<=12?50:60;
  const sys=compute([feat('Training',{trainingSkills:{analysis:rank}})],[{}]);
  assert.equal(sys.skillTotals.analysis.cap,expected,`rank ${rank}`);
 }
});

test('historical ranks and maxima are level-local for all thirty skills; a legal current total does not erase an illegal early purchase',()=>{
 for(const key of Object.keys(cfg.skills)){
  const native={...cls,system:{...cls.system,classSkills:[key]}};
  const raw={abilities:Object.fromEntries(['str','dex','con','int','wis','cha'].map(k=>[k,{base:10}])),progression:Array.from({length:10},(_,i)=>({classId:'test',vitality:1,skills:i===0?{[key]:5}:{}}))};
  const before=structuredClone(raw.progression),s=computeAgent(raw,[native],cfg);
  assert.equal(s.skillTotals[key].ranks,5,key);assert.equal(s.skillTotals[key].maxRanks,13,key);
  assert.equal(s.skillPoints[0].skills[key].maxRanks,4,key);assert.equal(s.skillPoints[9].skills[key].maxRanks,13,key);
  assert.equal(s.skillPoints[0].skills[key].ranks,5,key);assert.ok(s.skillPurchaseIssues.some(issue=>issue.code==='rank-limit'&&issue.level===1&&issue.skill===key),key);
  assert.deepEqual(raw.progression,before);
 }
});
test('structured purchase issues distinguish invalid costs, malformed allocations and budgets without granting negative ranks or points',()=>{
 const s=compute([],[{analysis:3,bluff:-4,cultures:1.5,unknown:2}]);
 for(const code of ['allocation','point-cost'])assert.ok(s.skillPurchaseIssues.some(i=>i.code===code),code);
 assert.equal(s.skillTotals.bluff.ranks,0);assert.equal(s.skillTotals.cultures.ranks,0);assert.equal(s.skillPoints[0].spent,3);
 const native={...cls,system:{...cls.system,classSkills:Object.keys(cfg.skills)}},raw={abilities:Object.fromEntries(['str','dex','con','int','wis','cha'].map(k=>[k,{base:10}])),progression:[{classId:'test',vitality:1,skills:Object.fromEntries(Object.keys(cfg.skills).slice(0,5).map(k=>[k,4]))}]};
 const over=computeAgent(raw,[native],cfg);assert.equal(over.skillPoints[0].remaining,-4);assert.ok(over.skillPurchaseIssues.some(i=>i.code==='career-budget'));
 const training=compute([feat('Training',{trainingSkills:{analysis:6,unknown:1,bluff:'bad'}})],[{}]);
 for(const code of ['training-budget','training-rank-limit','training-allocation'])assert.ok(training.skillPurchaseIssues.some(i=>i.code===code),code);
});
test('historical maxima retain acquisition-time Unlocked Potential and class-skill changes instead of borrowing future benefits',()=>{
 const s=compute([feat('Unlocked Potential',{choice:'analysis',acquiredAtLevel:4})],[{analysis:2},{analysis:2},{analysis:2},{analysis:2}]);
 assert.equal(s.skillPoints[0].skills.analysis.maxRanks,4);assert.equal(s.skillPoints[2].skills.analysis.maxRanks,6);assert.equal(s.skillPoints[3].skills.analysis.maxRanks,10);
 assert.equal(s.skillPoints[0].skills.analysis.ranks,1);assert.equal(s.skillPoints[3].skills.analysis.ranks,5);
});

test('Training gives exactly one purchased rank per point for every skill independently of cross-class pricing and career budgets',()=>{
 assert.equal(Object.keys(cfg.skills).length,30);
 for(const key of Object.keys(cfg.skills)){
  const normal=compute([],[{},{},{}]),trained=compute([feat('Training',{acquiredAtLevel:3,trainingSkills:{[key]:5}})],[{},{},{}]);
  assert.equal(trained.skillTotals[key].ranks,5,key);assert.equal(trained.skillTotals[key].purchasedRanks,5,key);
  assert.deepEqual(trained.skillPoints.map(p=>p.remaining),normal.skillPoints.map(p=>p.remaining),key);
  assert.equal(trained.skillPoints[1].skills[key].ranks,0,key);assert.equal(trained.skillPoints[2].skills[key].ranks,5,key);
  assert.deepEqual(trained.skillPurchaseIssues,[],key);
 }
});
test('repeat Training selections keep separate five-point budgets and enforce the rank maximum at each acquisition',()=>{
 const first={...feat('Training',{acquiredAtLevel:3,trainingSkills:{analysis:5}}),id:'first'},second={...feat('Training',{acquiredAtLevel:6,trainingSkills:{bluff:5}}),id:'second'};
 let s=compute([first,second],Array.from({length:6},()=>({})));assert.equal(s.skillTotals.analysis.ranks,5);assert.equal(s.skillTotals.bluff.ranks,5);assert.deepEqual(s.skillPurchaseIssues,[]);
 second.system.trainingSkills={bluff:6};s=compute([first,second],Array.from({length:6},()=>({})));assert.ok(s.skillPurchaseIssues.some(i=>i.code==='training-budget'&&i.sourceId==='second'));assert.ok(!s.skillPurchaseIssues.some(i=>i.sourceId==='first'));
 second.system.trainingSkills={analysis:5};s=compute([first,second],Array.from({length:6},()=>({})));assert.ok(s.skillPurchaseIssues.some(i=>i.code==='training-rank-limit'&&i.sourceId==='second'&&i.level===6));
});
test('Training source eligibility and mission expiry remove its purchases without changing stored allocations',()=>{
 const f=feat('Training',{acquiredAtLevel:3,trainingSkills:{analysis:5},featKind:'temporary',temporaryGrant:{period:'mission',epoch:'qa',selfGranted:true,ability:'knowItAll',sourceActorUuid:'Actor.qa'}}),before=structuredClone(f);
 const run=mission=>computeAgent({actorUuid:'Actor.qa',usagePeriods:{mission},abilities:Object.fromEntries(['str','dex','con','int','wis','cha'].map(k=>[k,{base:10}])),progression:Array.from({length:3},()=>({classId:'test',skills:{},vitality:1}))},[cls,f],cfg);
 assert.equal(run('qa').skillTotals.analysis.ranks,5);assert.equal(run('next').skillTotals.analysis.ranks,0);assert.deepEqual(f,before);
 const failed=feat('Training',{acquiredAtLevel:3,granted:false,trainingSkills:{analysis:5},acquisitionCheck:{ok:false,level:3,unmet:['Recorded ineligible selection']}});assert.equal(compute([failed],[{},{},{}]).skillTotals.analysis.ranks,0);
});

test('Unlocked Potential locks every chosen skill to career plus six despite other rank-limit increases, with a separate maximum requirement at every level',()=>{
 for(const key of Object.keys(cfg.skills)){
  const f=feat('Unlocked Potential',{choice:key}),boost={id:'boost',name:'Other rank increase',type:'origin',system:{bonuses:[{target:`skills.${key}.maxRanks`,value:'20'}]}},s=compute([f,boost],[{[key]:7},{[key]:1}]);
  assert.equal(s.skillTotals[key].ranks,8,key);assert.equal(s.skillTotals[key].maxRanks,8,key);assert.equal(s.skillPoints[0].skills[key].classSkill,true,key);assert.equal(s.skillPoints[1].skills[key].classSkill,true,key);assert.deepEqual(s.skillPurchaseIssues,[],key);
  const missing=compute([f,boost],[{[key]:6},{[key]:2}]);assert.equal(missing.skillTotals[key].ranks,8,key);assert.ok(missing.skillPurchaseIssues.some(i=>i.code==='unlocked-potential'&&i.level===1&&i.skill===key),key);assert.ok(!missing.skillPurchaseIssues.some(i=>i.code==='unlocked-potential'&&i.level===2),key);
 }
});
