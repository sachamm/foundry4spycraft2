import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {SPYCRAFT as cfg} from '../module/config.mjs';import {computeAgent} from '../module/rules/engine.mjs';
import {classFeatSources,featAcquisition} from '../module/rules/feat-acquisition.mjs';import {checkPrerequisites} from '../module/rules/prerequisites.mjs';
const classes=JSON.parse(readFileSync(new URL('../src/data/classes.json',import.meta.url))),feats=JSON.parse(readFileSync(new URL('../src/data/feats.json',import.meta.url)));
function scientist(){const c=structuredClone(classes.find(c=>c.key==='scientist'));const item={id:'sci',name:c.name,type:'class',system:{...c,identifier:c.key,vitalityDie:c.vitality,choices:{}}};c.choiceSchedule.forEach((slot,index)=>{if(slot.list==='intenseStudy')item.system.choices[index]=slot.level===1?2:3;});return item;}
function feat(name,patch={}){const f=structuredClone(feats.find(f=>f.name===name));return {id:name,name,type:'feat',system:{...f,tree:f.tree[0].toLowerCase()+f.tree.slice(1).replaceAll(' ',''),acquiredAtLevel:1,...patch}};}
function compute(items,level){const system={abilities:Object.fromEntries(['str','dex','con','int','wis','cha'].map(k=>[k,{base:10}])),progression:Array.from({length:level},()=>({classId:'scientist',skills:{},vitality:1})),skills:{},focuses:{},misc:{}};return computeAgent(system,items,cfg);}

test('RAW p.42: all six Intense Study milestones produce unique, tree-specific sources at their actual career level',()=>{
 const item=scientist(),progression=Array.from({length:20},()=>({classId:'scientist'})),sources=classFeatSources([item],progression);
 assert.deepEqual(sources.map(s=>s.classLevel),[1,4,8,12,16,20]);assert.deepEqual(sources.map(s=>s.career),[1,4,8,12,16,20]);
 assert.equal(new Set(sources.map(s=>s.id)).size,6);assert.ok(sources.every(s=>s.levelAllowance===2));
 assert.deepEqual(sources.map(s=>s.tree),['basicSkill','advancedSkill','advancedSkill','advancedSkill','advancedSkill','advancedSkill']);
 const delayed=classFeatSources([item],[...Array(3).fill({classId:'soldier'}),...progression]);assert.equal(delayed[1].career,7);
});

test('RAW p.42: level-4 Scientist can acquire level-6 Advanced Skill Mastery only through Intense Study',()=>{
 const item=scientist(),actor=feat('Actor',{acquisitionSource:'sci:0:0'});
 const mastery=feat('Advanced Skill Mastery',{choice:'Actor',acquiredAtLevel:4,acquisitionSource:'sci:1:0'});
 const legal=compute([item,actor,mastery],4);
 assert.equal(legal.featStatus[mastery.id].ok,true);assert.equal(legal.skillTotals.bluff.bonus,3);
 assert.equal(compute([item,actor,{...mastery,system:{...mastery.system,acquisitionSource:''}}],4).featStatus[mastery.id].ok,false);
 assert.equal(compute([item,actor,{...mastery,system:{...mastery.system,acquiredAtLevel:3}}],4).featStatus[mastery.id].ok,false);
 assert.equal(compute([item,actor,{...mastery,system:{...mastery.system,acquiredAtLevel:4,prerequisites:{type:'all',of:[{type:'level',min:6},{type:'skill',key:'medicine',min:20}]}}}],4).featStatus[mastery.id].ok,false);
});

test('class bonus-feat source rejects duplicate claims, wrong trees, removed choices and acquisition before earning it',()=>{
 const item=scientist(),sources=classFeatSources([item],Array(4).fill({classId:'scientist'}));
 const make=(id,patch={})=>({id,type:'feat',system:{tree:'advancedSkill',acquiredAtLevel:4,acquisitionSource:sources[1].id,...patch}});
 const first=make('first'),second=make('second');
 assert.equal(featAcquisition(first,sources,[first,second]).ok,true);assert.equal(featAcquisition(second,sources,[first,second]).ok,false);
 assert.equal(featAcquisition(make('wrong',{tree:'gear'}),sources,[]).ok,false);
 assert.equal(featAcquisition(first,[],[]).ok,false);
 assert.equal(featAcquisition(make('early',{acquiredAtLevel:3}),sources,[]).ok,false);
 assert.equal(featAcquisition(make('__preview__'),sources,[first],{preview:true}).ok,false);
});

test('prerequisite allowance changes only minimum career level; acquisition-only equality remains literal',()=>{
 assert.equal(checkPrerequisites({type:'level',min:6},{level:4,prerequisiteLevel:6}).ok,true);
 assert.equal(checkPrerequisites({type:'level',eq:1},{level:1,acquisitionLevel:3,prerequisiteLevel:5}).ok,false);
 assert.equal(checkPrerequisites({type:'level',eq:1},{level:4,acquisitionLevel:1,prerequisiteLevel:6}).ok,true);
});
