import test from 'node:test';import assert from 'node:assert/strict';
import {oneInAMillionEligible} from '../module/rules/class-checks.mjs';import {limitedUseAbilities,rerollEligibility} from '../module/rules/limited-uses.mjs';import {checkCandidates,adjudicateCheck} from '../module/rules/outcomes.mjs';import {criticalPlan} from '../module/rules/criticals.mjs';import {SPYCRAFT as cfg} from '../module/config.mjs';
const source={classLevels:{soldier:14}};
test('RAW p.50 One in a Million requires Soldier 14 and precisely the permitted rolled check types',()=>{
 for(const ability of ['str','con','dex','int','wis','cha'])assert.equal(oneInAMillionEligible(source,{checkKind:'skill',ability}),['str','con'].includes(ability));
 for(const ability of ['str','dex','int'])assert.equal(oneInAMillionEligible(source,{checkKind:'attack',ability}),true);
 for(const checkId of ['fort','ref','will'])assert.equal(oneInAMillionEligible(source,{checkKind:'save',checkId}),checkId==='fort');
 for(const checkKind of ['damage','knowledge','check'])assert.equal(oneInAMillionEligible(source,{checkKind,ability:'str'}),false);
 assert.equal(oneInAMillionEligible({classLevels:{soldier:13}},{checkKind:'attack'}),false);
 for(const patch of [{checkMethod:'take10'},{checkMethod:'take20'},{chooseTwice:true}])assert.equal(oneInAMillionEligible(source,{checkKind:'attack',...patch}),false);
 assert.equal(limitedUseAbilities(source,[],cfg).find(s=>s.id==='oneInAMillion').limit,1);
});
let epoch='s1',posts=[],failPost=false;const clone=structuredClone;
globalThis.Actor=class{constructor(){this.uuid='Actor.million';this.name='Soldier';this.type='agent';this.isOwner=true;this.items=new Map();this.system={classLevels:{soldier:14},actionDice:{value:2},resourceUses:{},limitedUses:[{id:'oneInAMillion',name:'One in a Million',limit:1,cost:0,period:'session',workflow:'oneInAMillion'},{id:'perfect',name:'Perfect',limit:3,cost:0,period:'session',workflow:'reroll',mastery:'Perfect Skill Mastery'}]};}async update(data){for(const [path,value] of Object.entries(data)){const keys=path.replace(/^system\./,'').split('.');let target=this.system;for(const key of keys.slice(0,-1))target=target[key]??={};const key=keys.at(-1);if(key.startsWith('-='))delete target[key.slice(2)];else target[key]=clone(value);}}};
globalThis.game={user:{isGM:true},settings:{get:()=>({session:epoch})},i18n:{localize:s=>s}};globalThis.CONFIG={SPYCRAFT:cfg};globalThis.ui={notifications:{warn:()=>null}};globalThis.foundry={utils:{escapeHTML:s=>s}};globalThis.ChatMessage={getSpeaker:()=>({})};
globalThis.Roll=class{constructor(formula,data){const die=formula.startsWith('20')?20:7;this.total=die+data.total;this.dice=formula.startsWith('20')?[]:[{total:die}];}async evaluate(){return this;}async toMessage(data){if(failPost)throw Error('post failed');posts.push(data);return {...data,id:'message',async update(patch){for(const [path,value] of Object.entries(patch)){if(path.startsWith('flags.spycraft2.'))this.flags.spycraft2[path.slice(16)]=value;}}};}};
const {SpycraftActor}=await import('../module/documents/actor.mjs');
function reset(){epoch='s1';posts=[];failPost=false;game.user.isGM=true;}
const opts={checkKind:'attack',threat:0,error:1,oneInAMillion:true};
test('declared attack records natural 20 even without a normal threat range; consumes one session use and no action die',async()=>{
 reset();const a=new SpycraftActor(),m=await a.rollCheck('1d20 + @total',{total:3},opts),c=m.flags.spycraft2;
 assert.equal(c.naturalDie,20);assert.equal(c.rawTotal,23);assert.equal(c.formula,'1d20 + @total');assert.equal(c.forcedThreat,true);assert.equal(c.noForcedReroll,true);assert.equal(checkCandidates(c).threat,true);assert.equal(a.system.actionDice.value,2);assert.equal(a.system.resourceUses.oneInAMillion.used,1);assert.match(m.flavor,/cannot be forcibly rerolled/);
 assert.equal(await a.rollCheck('1d20 + @total',{total:3},opts),null);assert.equal(posts.length,1);
 epoch='s2';assert.ok(await a.rollCheck('1d20 + @total',{total:3},opts));assert.equal(posts.length,2);
});
test('Fortitude uses its explicit threat exception and can pay for a GC-confirmed critical success',async()=>{
 reset();const a=new SpycraftActor();a.system.saves={fort:{total:5}};const m=await a.rollSave('fort',{oneInAMillion:true}),c=m.flags.spycraft2;
 assert.equal(c.rawTotal,25);assert.equal(c.checkId,'fort');assert.equal(c.normalThreat,0);assert.equal(checkCandidates(c).threat,true);Object.assign(c,adjudicateCheck(c,true));
 assert.equal(criticalPlan(a.system,c,{baseCost:1,effect:'GC-confirmed Fortitude critical',effectConfirmed:true,available:2}).blocked,false);
 const normal=await a.rollSave('fort');assert.equal(normal.flags.spycraft2.naturalDie,7);assert.equal(checkCandidates(normal.flags.spycraft2).threat,false);
});
test('eligible skill natural 20 lifts its cap and prepays any declared additional action-die cost in the same queue',async()=>{
 reset();const a=new SpycraftActor(),m=await a.rollCheck('1d20 + @total',{total:14},{...opts,checkKind:'skill',ability:'con',cap:10,additionalCost:1});assert.equal(m.flags.spycraft2.effectiveTotal,34);assert.equal(m.flags.spycraft2.capped,false);assert.equal(a.system.actionDice.value,1);
});
test('invalid declarations spend nothing; a technical post failure restores the use and any additional payment',async()=>{
 reset();const a=new SpycraftActor();await assert.rejects(a.rollCheck('1d20 + @total',{total:0},{...opts,checkKind:'skill',ability:'int'}),/requires/);assert.equal(posts.length,0);assert.equal(Object.hasOwn(a.system.resourceUses,'oneInAMillion'),false);
 failPost=true;await assert.rejects(a.rollCheck('1d20 + @total',{total:0},{...opts,additionalCost:1}),/post failed/);assert.equal(a.system.actionDice.value,2);assert.equal(Object.hasOwn(a.system.resourceUses,'oneInAMillion'),false);
 failPost=false;assert.ok(await a.rollCheck('1d20 + @total',{total:0},opts));
});
test('a forced reroll is blocked; a voluntary eligible reroll rolls normally and clears the special threat/protection',async()=>{
 reset();const a=new SpycraftActor(),m=await a.rollSave('fort',{oneInAMillion:true});Object.assign(m.flags.spycraft2,{successConfirmed:false});const spec=a.system.limitedUses.find(s=>s.id==='perfect');
 assert.equal(rerollEligibility(spec,m.flags.spycraft2,{failed:true,forced:true}),false);await assert.rejects(a.rerollCheck(m,{resource:'perfect',failed:true,forced:true}),/cannot reroll/);assert.equal(Object.hasOwn(a.system.resourceUses,'perfect'),false);
 const next=await a.rerollCheck(m,{resource:'perfect',failed:true});assert.equal(next.flags.spycraft2.naturalDie,7);assert.equal(next.flags.spycraft2.oneInAMillion,false);assert.equal(next.flags.spycraft2.noForcedReroll,false);assert.equal(next.flags.spycraft2.threat,0);assert.equal(checkCandidates(next.flags.spycraft2).threat,false);
});
test('simultaneous local declarations post once and secret declarations require the GC',async()=>{
 reset();const a=new SpycraftActor();await Promise.all([a.rollCheck('1d20 + @total',{total:0},opts),a.rollCheck('1d20 + @total',{total:0},opts)]);assert.equal(posts.length,1);
 const b=new SpycraftActor();game.user.isGM=false;await assert.rejects(b.rollCheck('1d20 + @total',{total:0},{...opts,rollMode:'blindroll'}),/GC resolves/);assert.equal(Object.hasOwn(b.system.resourceUses,'oneInAMillion'),false);
});
