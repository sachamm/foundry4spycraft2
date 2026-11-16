import test from 'node:test';import assert from 'node:assert/strict';
import {rollCareerVitality,reviewCareerVitality} from '../module/apps/vitality.mjs';
import {vitalitySource,vitalityRollRecord,vitalityMessageTag} from '../module/rules/vitality.mjs';
import {actionDieBoostPlan} from '../module/rules/action-dice.mjs';
let serial=0,rng=0,raw=4,postFailure='',commitFailure='',bindFailure='',duringRoll=null,responses=[],dialogs=[],warnings=[];
globalThis.Actor=class{};
globalThis.Roll=class{
 constructor(formula){this.formula=formula;this._evaluated=false;this.total=null;}
 async evaluate(){rng++;this.total=raw;this._evaluated=true;duringRoll?.();return this;}
 toJSON(){return {formula:this.formula,total:this.total,evaluated:this._evaluated};}
 static fromJSON(text){const data=JSON.parse(text),r=new this(data.formula);r.total=data.total;r._evaluated=data.evaluated;return r;}
 async toMessage(data){if(!this._evaluated)await this.evaluate();if(postFailure==='before')throw Error('Post failed');const m={...data,id:'message'+(++serial),rolls:[this]};game.messages.push(m);if(postFailure==='after')throw Error('Post response lost');return m;}
};
globalThis.ChatMessage={getSpeaker:()=>({})};
const {SpycraftActor}=await import('../module/documents/actor.mjs');
function actor(){serial=0;rng=0;raw=4;postFailure='';commitFailure='';bindFailure='';duringRoll=null;responses=[];dialogs=[];warnings=[];globalThis.game={ready:false,user:{id:'gc',isGM:true},time:{worldTime:0},settings:{get:()=>({})},spycraft2:{},messages:[]};globalThis.foundry={utils:{randomID:()=>`id${++serial}`,escapeHTML:String},applications:{api:{DialogV2:{input:async o=>{dialogs.push(o);return responses.shift()??null;}}}}};globalThis.ui={notifications:{warn:m=>warnings.push(m)}};
 const a={type:'agent',isOwner:true,uuid:'Actor.vitality',items:[{id:'soldier',name:'Soldier',type:'class',system:{identifier:'soldier',vitalityDie:12}}],system:{progression:[{classId:'soldier',vitality:0,skills:{}},{classId:'soldier',vitality:0,skills:{athletics:1}}],vitality:{value:4,max:20},wounds:{value:4},actionDice:{value:2}},flags:{},async update(patch){const commit=Object.keys(patch).some(k=>/^flags\.spycraft2\.vitalityRolls\.[^.]+$/.test(k)),binding=Object.keys(patch).some(k=>k.endsWith('.messageId'));if(commit&&commitFailure==='before'||binding&&bindFailure==='before')throw Error('Update failed');for(const[path,value]of Object.entries(patch)){const keys=path.split('.');let o=this;for(const k of keys.slice(0,-1))o=o[k]??={};o[keys.at(-1)]=structuredClone(value);}if(commit&&commitFailure==='after'||binding&&bindFailure==='after')throw Error('Update response lost');return this;}};return a;
}
const review={value:4,note:'GC checked the actual raw result',confirmed:true};
test('actual Actor dispatch records one raw class die result before chat and preserves health, skills and dice',async()=>{
 const a=actor(),r=await SpycraftActor.prototype.rollVitality.call(a,1);assert.equal(r.total,4);assert.equal(rng,1);assert.equal(a.system.progression[1].vitality,4);assert.deepEqual(a.system.progression[1].skills,{athletics:1});assert.equal(a.system.vitality.value,4);assert.equal(a.system.wounds.value,4);assert.equal(a.system.actionDice.value,2);const id=a.system.progression[1].vitalityRollId,record=a.flags.spycraft2.vitalityRolls[id];assert.equal(record.value,4);assert.equal(record.messageId,game.messages[0].id);assert.equal(game.messages[0].flags.spycraft2.actorUuid,undefined);assert.equal(actionDieBoostPlan(a.system,game.messages[0].flags.spycraft2.vitalityRoll).blocked,true);
 const again=await rollCareerVitality(a,1);assert.equal(again.total,4);assert.equal(again.recorded,true);assert.equal(rng,1);assert.equal(game.messages.length,1);
});
test('first career maximum, invalid indices, unowned actors and NPCs never roll or post',async()=>{
 for(const index of [0,-1,2,1.5,'1']){const a=actor();assert.equal(await rollCareerVitality(a,index),null);assert.equal(await reviewCareerVitality(a,index,review),null);assert.equal(rng,0);assert.equal(game.messages.length,0);}
 for(const patch of [{isOwner:false},{type:'npc'}]){const a=Object.assign(actor(),patch);assert.equal(await rollCareerVitality(a,1),null);assert.equal(await reviewCareerVitality(a,1,review),null);assert.equal(rng,0);}
});
test('an already recorded legacy value is respected without a new roll or an invented receipt',async()=>{
 const a=actor();a.system.progression[1].vitality=8;const r=await rollCareerVitality(a,1);assert.equal(r.total,8);assert.equal(r.legacy,true);assert.equal(rng,0);assert.equal(a.flags.spycraft2,undefined);assert.equal(game.messages.length,0);
});
test('a later first level in another class uses its actual die, rather than first-career maximum',async()=>{
 const a=actor();a.items.push({id:'other',name:'Other class',type:'class',system:{identifier:'other',vitalityDie:6}});a.system.progression[1].classId='other';raw=2;await rollCareerVitality(a,1);assert.equal(rng,1);assert.equal(a.system.progression[1].vitality,2);const r=Object.values(a.flags.spycraft2.vitalityRolls)[0];assert.equal(r.formula,'1d6');assert.equal(r.die,6);
});
test('concurrent requests commit one vitality result and preserve exactly one original chat receipt',async()=>{
 const a=actor(),[one,two]=await Promise.all([rollCareerVitality(a,1),rollCareerVitality(a,1)]);assert.equal(one.total,4);assert.equal(two.total,4);assert.equal(rng,1);assert.equal(game.messages.length,1);assert.equal(Object.keys(a.flags.spycraft2.vitalityRolls).length,1);
});
test('class/level source or ownership changes during RNG cannot bind an incorrect gain',async()=>{
 for(const change of [a=>a.items[0].system.vitalityDie=10,a=>a.system.progression[1].classId='missing',a=>a.isOwner=false]){const a=actor();duringRoll=()=>change(a);await assert.rejects(rollCareerVitality(a,1),/source changed|Review this career level/);assert.equal(a.system.progression[1].vitality,0);assert.equal(game.messages.length,0);}
});
test('an unpublished commit failure retries the retained local raw result; lost commit responses prove the same recorded value',async()=>{
 let a=actor();commitFailure='before';await assert.rejects(rollCareerVitality(a,1),/Update failed/);assert.equal(rng,1);assert.equal(game.messages.length,0);assert.equal(a.system.progression[1].vitality,0);commitFailure='';raw=11;await rollCareerVitality(a,1);assert.equal(rng,1);assert.equal(a.system.progression[1].vitality,4);
 a=actor();commitFailure='after';await rollCareerVitality(a,1);assert.equal(rng,1);assert.equal(a.system.progression[1].vitality,4);
});
test('post failures retain the authoritative gain and retry stored roll data without evaluating new dice',async()=>{
 let a=actor();postFailure='before';await rollCareerVitality(a,1);assert.equal(a.system.progression[1].vitality,4);assert.equal(game.messages.length,0);postFailure='';raw=12;await rollCareerVitality(a,1);assert.equal(rng,1);assert.equal(game.messages[0].rolls[0].total,4);
 a=actor();postFailure='after';await rollCareerVitality(a,1);assert.equal(rng,1);assert.equal(game.messages.length,1);assert.equal(Object.values(a.flags.spycraft2.vitalityRolls)[0].messageId,game.messages[0].id);
 a=actor();bindFailure='before';await rollCareerVitality(a,1);assert.equal(rng,1);assert.equal(game.messages.length,1);bindFailure='';await rollCareerVitality(a,1);assert.equal(rng,1);assert.equal(game.messages.length,1);
});
test('manual/external results and corrections have bounded source audits and never reroll or heal',async()=>{
 const a=actor();const first=await reviewCareerVitality(a,1,{...review,value:5});assert.equal(rng,0);assert.equal(a.system.progression[1].vitality,5);assert.equal(a.system.vitality.value,4);assert.equal(first.before,0);assert.equal(first.originalRollId,null);const second=await reviewCareerVitality(a,1,{...review,value:6});assert.equal(second.previousReviewId,first.id);assert.equal(second.before,5);assert.equal(a.system.progression[1].vitality,6);assert.equal((await rollCareerVitality(a,1)).total,6);assert.equal(rng,0);
});
test('review keeps original roll evidence and a later correction cannot be overwritten by opening the roll control',async()=>{
 const a=actor();await rollCareerVitality(a,1);const id=a.system.progression[1].vitalityRollId,r=await reviewCareerVitality(a,1,{...review,value:3});assert.equal(r.originalRollId,id);assert.equal(a.flags.spycraft2.vitalityRolls[id].value,4);assert.equal((await rollCareerVitality(a,1)).total,3);assert.equal(a.system.progression[1].vitality,3);assert.equal(rng,1);
});
test('review cancellation, invalid raw values and stale context do not alter legacy data',async()=>{
 let a=actor();assert.equal(await reviewCareerVitality(a,1),null);assert.equal(a.system.progression[1].vitalityRollId,undefined);
 for(const value of [0,13,1.5,' 4','4.0',null]){a=actor();await assert.rejects(reviewCareerVitality(a,1,{...review,value}));assert.equal(a.system.progression[1].vitality,0);assert.equal(a.system.progression[1].vitalityRollId,undefined);}
 a=actor();foundry.applications.api.DialogV2.input=async()=>{a.items[0].system.vitalityDie=10;return review;};await assert.rejects(reviewCareerVitality(a,1),/source changed/);assert.equal(rng,0);
});
test('removed/replaced career entries get a new identity and cannot reuse an older gain at the same index',async()=>{
 const a=actor();await rollCareerVitality(a,1);const first=a.system.progression[1].vitalityRollId;a.system.progression[1]={classId:'soldier',vitality:0,skills:{}};raw=7;await rollCareerVitality(a,1);assert.notEqual(a.system.progression[1].vitalityRollId,first);assert.equal(a.system.progression[1].vitality,7);assert.equal(rng,2);assert.equal(Object.keys(a.flags.spycraft2.vitalityRolls).length,2);
});
test('conflicting or corrupt vitality evidence requires review and never triggers a replacement RNG result',async()=>{
 let a=actor();await rollCareerVitality(a,1);const id=a.system.progression[1].vitalityRollId;a.system.progression[1].vitality=0;await assert.rejects(rollCareerVitality(a,1),/recorded history/);assert.equal(rng,1);
 a=actor();postFailure='before';await rollCareerVitality(a,1);postFailure='';Object.values(a.flags.spycraft2.vitalityRolls)[0].rollData.evaluated=false;await rollCareerVitality(a,1);assert.equal(rng,1);assert.match(warnings.at(-1),/stored vitality roll data/);
 a=actor();a.system.progression[1].vitalityRollId='constructor';assert.throws(()=>vitalitySource(a,1),/references/);
});
test('normalizing a wrong roll result cannot fabricate a class gain',async()=>{
 const a=actor();for(const value of [0,13,1.5]){raw=value;await assert.rejects(rollCareerVitality(a,1),/actual raw vitality/);assert.equal(a.system.progression[1].vitality,0);}assert.equal(game.messages.length,0);
});
