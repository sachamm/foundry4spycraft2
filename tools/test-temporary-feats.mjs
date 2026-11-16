import test from 'node:test';import assert from 'node:assert/strict';import {temporaryFeatActive,temporarySharePlan} from '../module/rules/temporary-feats.mjs';
import {computeAgent} from '../module/rules/engine.mjs';import {SPYCRAFT as cfg} from '../module/config.mjs';
const sourceFeat={id:'feat',name:'Techie',type:'feat',system:{tree:'basicSkill',featKind:'permanent',bonuses:[{target:'wounds',value:'2'}]}};
const source={coreClassIds:['scientist'],actionDice:{max:2},featStatus:{feat:{ok:true}}};
const options={epoch:'session-a',atSessionStart:true,sourceActorUuid:'Actor.source'};
test('Professor shares eligible permanent Basic Skill feats only, up to starting action dice, once at session start',()=>{
 const [copy]=temporarySharePlan(source,[sourceFeat],'professor',['feat'],options);
 assert.equal(copy.system.featKind,'temporary');assert.equal(copy.system.granted,true);assert.equal(copy.system.acquisitionCheck,null);assert.deepEqual(copy.system.temporaryGrant,{period:'session',epoch:'session-a',sourceActorUuid:'Actor.source',ability:'professor'});
 assert.equal(sourceFeat.system.featKind,'permanent');
 for(const system of [{...source,coreClassIds:[]},{...source,actionDice:{max:0}},{...source,featStatus:{}},{...source,temporaryShares:{professor:{epoch:'session-a'}}}])assert.throws(()=>temporarySharePlan(system,[sourceFeat],'professor',['feat'],options));
 for(const kind of ['temporary','virtual'])assert.throws(()=>temporarySharePlan(source,[{...sourceFeat,system:{...sourceFeat.system,featKind:kind}}],'professor',['feat'],options));
 assert.throws(()=>temporarySharePlan(source,[sourceFeat],'professor',['feat','feat'],options));
 assert.throws(()=>temporarySharePlan(source,[sourceFeat],'professor',['feat'],{...options,atSessionStart:false}));
});
test('Trailblazer uses Terrain feats and remains unavailable without its core class',()=>{
 const terrain={...sourceFeat,system:{...sourceFeat.system,tree:'terrain'}},scout={...source,coreClassIds:['scout']};
 assert.equal(temporarySharePlan(scout,[terrain],'trailblazer',['feat'],options).length,1);
 assert.throws(()=>temporarySharePlan(scout,[sourceFeat],'trailblazer',['feat'],options));
});
const cls={id:'test',type:'class',name:'Test',system:{identifier:'test',classSkills:[],table:[],vitalityDie:6,skillPoints:4}};
function sys(epoch='session-a'){return {usagePeriods:{session:epoch},abilities:Object.fromEntries(['str','dex','con','int','wis','cha'].map(key=>[key,{base:10}])),progression:[{classId:'test',vitality:1,skills:{}}],misc:{}};}
test('session expiry removes benefits without deleting player records; permanent and legacy temporary feats remain unaffected',()=>{
 const [feat]=temporarySharePlan(source,[sourceFeat],'professor',['feat'],options);feat.id='temp';
 assert.equal(temporaryFeatActive(sys(),feat),true);assert.equal(temporaryFeatActive(sys('session-b'),feat),false);
 const current=computeAgent(sys(),[cls,feat],cfg),expired=computeAgent(sys('session-b'),[cls,feat],cfg);
 assert.equal(current.wounds.max,12);assert.equal(expired.wounds.max,10);assert.equal(expired.featStatus.temp.ok,false);
 assert.equal(current.feats.any.spent,0);assert.equal(temporaryFeatActive(sys('session-b'),sourceFeat),true);
 assert.equal(temporaryFeatActive(sys(),{system:{featKind:'temporary'}}),true);
});
test('temporary sharing does not waive prerequisites and cannot qualify permanent feats',()=>{
 const [feat]=temporarySharePlan(source,[sourceFeat],'professor',['feat'],options);feat.id='temp';feat.system.prerequisites={type:'ability',key:'str',min:13};
 assert.equal(computeAgent(sys(),[cls,feat],cfg).featStatus.temp.ok,false);
});
globalThis.Actor=class {constructor(){this.id='source';this.uuid='Actor.source';this.type='agent';this.isOwner=true;this.items=[sourceFeat];this.system=structuredClone(source);}async update(data){this.system.temporaryShares=data['system.temporaryShares'];}};
globalThis.game={settings:{get:()=>({session:'session-a'})}};globalThis.ui={notifications:{warn:()=>null}};
const {SpycraftActor}=await import('../module/documents/actor.mjs');
test('sharing to several recipients rolls back created items if a later recipient fails',async()=>{
 const actor=new SpycraftActor();let removed=[];
 const first={uuid:'Actor.first',type:'agent',isOwner:true,async createEmbeddedDocuments(type,data){assert.equal(data[0].system.temporaryGrant.epoch,'session-a');return [{id:'created'}];},async deleteEmbeddedDocuments(type,ids){removed.push(...ids);}};
 const second={uuid:'Actor.second',type:'agent',isOwner:true,async createEmbeddedDocuments(){throw new Error('creation failed');}};
 await assert.rejects(actor.shareTemporaryFeats('professor',{featIds:['feat'],recipients:[first,second],atSessionStart:true}),/creation failed/);
 assert.deepEqual(removed,['created']);assert.equal(actor.system.temporaryShares,undefined);
});
test('successful sharing persists the selected source feats and blocks another selection in the session',async()=>{
 const actor=new SpycraftActor();let calls=0;const target={uuid:'Actor.target',type:'agent',isOwner:true,async createEmbeddedDocuments(){calls++;return [{id:'created'}];}};
 const input={featIds:['feat'],recipients:[target],atSessionStart:true};
 await actor.shareTemporaryFeats('professor',input);assert.equal(calls,1);assert.deepEqual(actor.system.temporaryShares.professor.featIds,['feat']);
 await assert.rejects(actor.shareTemporaryFeats('professor',input),/already been chosen/);assert.equal(calls,1);
 const other={...target,isOwner:false};await assert.rejects(new SpycraftActor().shareTemporaryFeats('professor',{...input,recipients:[other]}),/Choose teammates/);
});


test('temporary feat numerical bonuses cannot qualify permanent feats or expert class entry',()=>{
 const temporary={id:'temp',name:'Temporary strength',type:'feat',system:{featKind:'temporary',granted:true,bonuses:[{target:'abilities.str',value:'4'}]}};
 const permanent={id:'permanent',name:'Permanent feat',type:'feat',system:{prerequisites:{type:'ability',key:'str',min:13},bonuses:[{target:'wounds',value:'10'}]}};
 const result=computeAgent(sys(),[cls,temporary,permanent],cfg);assert.equal(result.abilities.str.value,14);assert.equal(result.featStatus.permanent.ok,false);assert.equal(result.wounds.max,10);
});


test('legacy expert-entry review excludes temporary and explicit virtual numeric bonuses',()=>{
 const expert={id:'expert',name:'Test Expert',type:'class',system:{identifier:'expert',expert:true,requirements:{type:'ability',key:'str',min:13},classSkills:[],table:[],skillPoints:4,vitalityDie:6}};
 for(const featKind of ['temporary','virtual']){
  const grant={id:'bonus',name:'Borrowed strength',type:'feat',system:{featKind,granted:featKind==='temporary',bonuses:[{target:'abilities.str',value:'4'}]}};
  const input=sys();input.progression.push({classId:'expert',vitality:1,skills:{}});
  const result=computeAgent(input,[cls,expert,grant],cfg);assert.equal(result.abilities.str.value,14);assert.ok(result.warnings.some(w=>w.includes('Test Expert: expert class requirements not met')),featKind);
 }
});
