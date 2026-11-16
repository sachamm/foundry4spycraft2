// These fixtures supply required gear unless a case explicitly overrides gearStatus; absence/kit boundaries are tested in test-skill-gear.mjs.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {classCheckEffects} from '../module/rules/class-checks.mjs';import {resolveSkillCheck} from '../module/rules/skills.mjs';import {computeAgent} from '../module/rules/engine.mjs';import {SPYCRAFT as cfg} from '../module/config.mjs';
const classes=JSON.parse(readFileSync(new URL('../src/data/classes.json',import.meta.url)));
const selected=(...pairs)=>({classOptionSelections:pairs.map(([classId,name])=>({classId,name}))});
const check={id:'repair',name:'Repair Check',attributes:['int'],mode:'Active',error:1,tags:'',time:'1 Hour (Take 10/Take 20)',page:123};
function sys(key='electronics',patch={}){return {...selected(),activeFeatNames:[],skillTotals:{[key]:{name:key,ranks:1,cap:20,threat:20,totals:[{ability:'int',total:8}],bonusEntries:[]}},...patch};}
test('RAW pp.42,52: both Elbow Grease sources apply only to repair and compete as gear bonuses',()=>{
 const system=sys('electronics',selected(['scientist','Elbow Grease'],['wheelman','Elbow Grease']));
 assert.equal(resolveSkillCheck(system,'electronics',check,{gearStatus:'available'}).total,12);
 assert.equal(resolveSkillCheck(system,'electronics',{...check,id:'modify'},{gearStatus:'available'}).total,8);
 system.skillTotals.electronics.bonusEntries=[{type:'gear',value:6}];system.skillTotals.electronics.totals[0].total=14;
 assert.equal(resolveSkillCheck(system,'electronics',check,{gearStatus:'available'}).total,14);
 assert.equal(classCheckEffects(system,'mechanics',check).bonuses[0].value,4);
 assert.equal(classCheckEffects(system,'security',check).bonuses.length,0);
});
test('RAW pp.42,48: No Worries uses the correct gear category and reduces errors to zero after other minimum-one reductions',()=>{
 for(const [classId,category,wrong] of [['scientist','E','T'],['snoop','T','E']]){
  const system=sys('electronics',selected([classId,'No Worries']));system.skillTotals.electronics.errorReduction=2;system.skillTotals.electronics.errorFloor=1;
  assert.equal(resolveSkillCheck(system,'electronics',check,{gearStatus:'available',gearCategory:category}).error,0);
  assert.equal(resolveSkillCheck(system,'electronics',check,{gearStatus:'available',gearCategory:wrong}).error,1);
  assert.equal(resolveSkillCheck(system,'electronics',check,{gearStatus:'available'}).error,1);
  system.skillTotals.electronics.ranks=0;assert.equal(resolveSkillCheck(system,'electronics',{...check,error:3},{gearStatus:'available',gearCategory:category}).error,1);
 }
});
test('RAW pp.36,48: Intelligence Analysis requires computer Research, halves time once, rounds up and retains its one-minute minimum',()=>{
 const system=sys('investigation',selected(['hacker','Intelligence Analysis'],['snoop','Intelligence Analysis']));const research={...check,id:'research'};
 assert.equal(resolveSkillCheck(system,'investigation',research,{gearStatus:'available'}).timeMultiplier,1);
 const result=resolveSkillCheck(system,'investigation',research,{gearStatus:'available',usingComputer:true});assert.equal(result.timeMultiplier,0.5);assert.equal(result.timeRounding,'up');assert.equal(result.minimumTime,'1 minute');
 assert.equal(resolveSkillCheck(system,'investigation',check,{gearStatus:'available',usingComputer:true}).timeMultiplier,1);
 system.skillFeatRules=[{name:'Mark of a Professional',skill:'investigation'}];const combined=resolveSkillCheck(system,'investigation',research,{gearStatus:'available',usingComputer:true,unopposed:true});assert.equal(combined.timeMultiplier,0.5);assert.equal(combined.minimumTimeSeconds,6);assert.equal(combined.timeReduction,'professional');
});
test('RAW p.38: Booby Trap changes sabotage or trap installation only, rounded down with a half-action minimum',()=>{
 const system=selected(['intruder','Booby Trap']);
 for(const skill of ['electronics','mechanics']){const result=classCheckEffects(system,skill,{id:'sabotage'});assert.equal(result.timeMultiplier,0.5);assert.equal(result.timeRounding,'down');assert.equal(result.minimumTimeSeconds,3);}
 assert.equal(classCheckEffects(system,'security',{id:'installation'}).timeMultiplier,1);
 assert.equal(classCheckEffects(system,'security',{id:'installation'},{installingTrap:true}).timeMultiplier,0.5);
 assert.equal(classCheckEffects(system,'security',{id:'disable'},{installingTrap:true}).timeMultiplier,1);
});
test('RAW p.46: Alertness adds four only to checks made to determine surprise',()=>{
 const system=sys('notice',selected(['sleuth','Alertness']));assert.equal(resolveSkillCheck(system,'notice',check,{gearStatus:'available'}).total,8);assert.equal(resolveSkillCheck(system,'notice',check,{gearStatus:'available',surprise:true}).total,12);
});
test('all eight class-option cases become active only at their earned, valid source choice',()=>{
 for(const [classId,name] of [['scientist','Elbow Grease'],['wheelman','Elbow Grease'],['scientist','No Worries'],['snoop','No Worries'],['hacker','Intelligence Analysis'],['snoop','Intelligence Analysis'],['intruder','Booby Trap'],['sleuth','Alertness']]){
  const c=classes.find(c=>c.key===classId),list=c.choiceLists.find(list=>list.kind==='option'&&list.options.some(o=>o.name===name));const slot=c.choiceSchedule.findIndex(slot=>slot.list===list.key),at=c.choiceSchedule[slot].level;
  const item={id:'class',type:'class',name:c.name,system:{...structuredClone(c),identifier:c.key,vitalityDie:c.vitality,choices:{[slot]:list.options.find(o=>o.name===name).index}}};
  const input=level=>({abilities:Object.fromEntries(['str','dex','con','int','wis','cha'].map(key=>[key,{base:10}])),progression:Array.from({length:level},()=>({classId,vitality:1,skills:{}})),misc:{}});
  assert.ok(!computeAgent(input(at-1),[item],cfg).classOptionSelections.some(e=>e.classId===classId&&e.name===name));
  assert.ok(computeAgent(input(at),[item],cfg).classOptionSelections.some(e=>e.classId===classId&&e.name===name),classId+':'+name);
 }
});
globalThis.Actor=class{};globalThis.CONFIG={SPYCRAFT:cfg};globalThis.game={settings:{get:()=>false},i18n:{localize:s=>s,format:s=>s}};globalThis.foundry={utils:{escapeHTML:s=>s}};globalThis.ChatMessage={getSpeaker:()=>({})};globalThis.ui={notifications:{warn:()=>null}};
globalThis.Roll=class{constructor(formula,data){this.total=5+data.total;this.dice=[{total:5}];}async evaluate(){return this;}async toMessage(data){return data;}};
const {SpycraftActor}=await import('../module/documents/actor.mjs');
test('document checks use the selected available inventory item category; a caller cannot claim No Worries merely by passing a category',async()=>{
 const actor=new SpycraftActor();actor.system=sys('electronics',selected(['scientist','No Worries']));
 actor.items=new Map([['item',{id:'item',name:'Computer',type:'gear',system:{gearCategory:'E'}}]]);
 const options={check:'repair',gearCategory:'E'};
 assert.equal((await actor.rollSkill('electronics','int',{gearStatus:'available',...(options)})).flags.spycraft2.error,1);
 assert.equal((await actor.rollSkill('electronics','int',{gearStatus:'available',...options,gearItem:'item'})).flags.spycraft2.error,0);
 actor.items.get('item').system.quantity=0;assert.equal(await actor.rollSkill('electronics','int',{gearStatus:'available',...options,gearItem:'item'}),null);actor.items.get('item').system.quantity=1;
 actor.items.get('item').system.reserve=true;assert.equal(await actor.rollSkill('electronics','int',{gearStatus:'available',...options,gearItem:'item'}),null);
});

test('skill chat snapshots Clean and Polished from the actual maintained personal gear, preserving its item provenance',async()=>{
 const actor=new SpycraftActor();actor.system=sys();actor.system.activeFeatNames=['Clean and Polished'];
 actor.items=new Map([['item',{id:'item',uuid:'Actor.test.Item.item',name:'Personal computer',type:'gear',system:{gearCategory:'E',possessionSource:'wealth',possessionApproved:true,cleanAndPolishedReady:true}}]]);
 const options={check:'repair',gearItem:'item'};let result=await actor.rollSkill('electronics','int',{gearStatus:'available',...(options)});assert.equal(result.flags.spycraft2.cleanAndPolished,true);assert.equal(result.flags.spycraft2.gearUuid,'Actor.test.Item.item');
 actor.items.get('item').system.cleanAndPolishedReady=false;result=await actor.rollSkill('electronics','int',{gearStatus:'available',...(options)});assert.equal(result.flags.spycraft2.cleanAndPolished,false);
 actor.items.get('item').system.possessionApproved=false;assert.equal(await actor.rollSkill('electronics','int',{gearStatus:'available',...(options)}),null);
});
