import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {hasMasterThief,masterThiefPlan} from '../module/rules/class-checks.mjs';import {checkCandidates,adjudicateCheck} from '../module/rules/outcomes.mjs';import {actionDieBoostPlan} from '../module/rules/action-dice.mjs';import {computeAgent} from '../module/rules/engine.mjs';import {SPYCRAFT as cfg} from '../module/config.mjs';
const skills=cfg.classFeatures.intruder.classSkills;
const state=()=>({classOptionSelections:[{classId:'intruder',name:'Master Thief'}],skillTotals:Object.fromEntries(Object.keys(cfg.skills).map(key=>[key,{ranks:4,cap:30}])),actionDice:{value:0},resourceUses:{},limitedUses:[{id:'masterThief',name:'Master Thief',limit:1,period:'session',cost:0,workflow:'masterThief'}]});
const input={skillKey:'sneak',opponentResult:45,opposedConfirmed:true,opponentFinalConfirmed:true,declaredBeforeRolling:true};
test('RAW p.38 Master Thief checks every Intruder class skill, four-rank threshold and the actual selected source',()=>{
 const s=state();for(const skillKey of Object.keys(cfg.skills)){if(skills.includes(skillKey)){assert.equal(masterThiefPlan(s,cfg,{...input,skillKey}).total,46);s.skillTotals[skillKey].ranks=3;assert.throws(()=>masterThiefPlan(s,cfg,{...input,skillKey}),/four ranks/);s.skillTotals[skillKey].ranks=4;}else assert.throws(()=>masterThiefPlan(s,cfg,{...input,skillKey}),/Intruder class skill/);}
 assert.equal(hasMasterThief({classLevels:{intruder:20}}),false);s.classOptionSelections=[];assert.throws(()=>masterThiefPlan(s,cfg,input),/earned/);
});
test('user-confirmed class-description precedence sets opponent +1 above the cap; declarations require the final opposed result before rolling',()=>{
 const p=masterThiefPlan(state(),cfg,{...input,opponentResult:100});assert.equal(p.total,101);assert.equal(p.cap,null);assert.equal(p.cannotError,true);assert.equal(p.actionDiceAllowed,false);
 for(const patch of [{opposedConfirmed:false},{opponentFinalConfirmed:false},{declaredBeforeRolling:false},{opponentResult:''},{opponentResult:' '},{opponentResult:null},{opponentResult:false},{opponentResult:1.5},{opponentResult:Infinity},{opponentResult:Number.MAX_SAFE_INTEGER}])assert.throws(()=>masterThiefPlan(state(),cfg,{...input,...patch}));
 // Focuses have no separate ranks (p.98); the parent skill's four ranks govern this ability.
 assert.equal(masterThiefPlan(state(),cfg,{...input,skillKey:'science',focus:'A focus confirmed for this opposed check'}).total,46);
});
let session='s1',posts=[],failPost=false;
globalThis.Actor=class{constructor(){this.uuid='Actor.thief';this.type='agent';this.isOwner=true;this.system=state();}async update(data){for(const [path,value] of Object.entries(data)){const keys=path.replace(/^system\./,'').split('.');let target=this.system;for(const key of keys.slice(0,-1))target=target[key]??={};const key=keys.at(-1);if(key.startsWith('-='))delete target[key.slice(2)];else target[key]=structuredClone(value);}}};
globalThis.game={user:{isGM:true},settings:{get:()=>({session})}};globalThis.CONFIG={SPYCRAFT:cfg};globalThis.foundry={utils:{escapeHTML:s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;')}};globalThis.ChatMessage={getSpeaker:()=>({})};globalThis.ui={notifications:{warn:()=>null}};
globalThis.Roll=class{constructor(formula,data){this.total=data.total+(formula==='@total'?0:3);this.dice=formula==='@total'?[]:[{total:3}];}async evaluate(){return this;}async toMessage(data){if(failPost)throw Error('post failed');posts.push(data);return data;}};const {SpycraftActor}=await import('../module/documents/actor.mjs');
function reset(){session='s1';posts=[];failPost=false;game.user.isGM=true;}
test('recorded Master Thief result exceeds cap, has no die/threat/error or boost permission and spends only one session use',async()=>{
 reset();const a=new SpycraftActor(),m=await a.useMasterThief(input),c=m.flags.spycraft2;assert.equal(c.rawTotal,46);assert.equal(c.effectiveTotal,46);assert.equal(c.capped,false);assert.equal(c.naturalDie,null);assert.equal(c.checkMethod,'classAbility');assert.equal(c.opponentResult,45);assert.equal(c.resultSource,'masterThief');assert.equal(checkCandidates(c).error,false);assert.equal(checkCandidates(c).threat,false);assert.equal(actionDieBoostPlan({...a.system,actionDice:{value:3,die:4}},c).blocked,true);assert.equal(a.system.resourceUses.masterThief.used,1);assert.equal(a.system.actionDice.value,0);assert.match(m.flavor,/opponent’s final result 45/);
 assert.equal(await a.useMasterThief(input),null);assert.equal(posts.length,1);session='s2';assert.ok(await a.useMasterThief(input));assert.equal(posts.length,2);
});
test('Master Thief explicitly cannot error even with a negative fixed result, while ordinary negative skill results still error',async()=>{
 reset();const a=new SpycraftActor(),m=await a.useMasterThief({...input,opponentResult:-5}),c=m.flags.spycraft2;assert.equal(c.effectiveTotal,-4);assert.equal(checkCandidates(c).negative,false);assert.equal(adjudicateCheck(c,false).errorConfirmed,false);
 const normal=await a.rollCheck('1d20 + @total',{total:-20},{checkKind:'skill',threat:20,error:1});assert.equal(checkCandidates(normal.flags.spycraft2).negative,true);
});
test('failed posting refunds the use; concurrent declarations post once, and secret results require the GC',async()=>{
 reset();const a=new SpycraftActor();failPost=true;await assert.rejects(a.useMasterThief(input),/post failed/);assert.equal(Object.hasOwn(a.system.resourceUses,'masterThief'),false);failPost=false;await Promise.all([a.useMasterThief(input),a.useMasterThief(input)]);assert.equal(posts.length,1);
 const b=new SpycraftActor();game.user.isGM=false;await assert.rejects(b.useMasterThief({...input,secret:true}),/GC resolves/);assert.equal(Object.hasOwn(b.system.resourceUses,'masterThief'),false);game.user.isGM=true;const m=await b.useMasterThief({...input,secret:true});assert.equal(m.flags.spycraft2.checkMethod,'classAbility');b.isOwner=false;await assert.rejects(b.useMasterThief(input),/own the agent/);
});
test('engine registers Master Thief only for its earned menu choice and removes it immediately when deselected',()=>{
 const data=JSON.parse(readFileSync(new URL('../src/data/classes.json',import.meta.url))).find(c=>c.key==='intruder'),cls={id:'intruder',name:'Intruder',type:'class',system:{...structuredClone(data),identifier:'intruder',vitalityDie:8,choices:{}}};const list=cls.system.choiceLists.find(l=>l.options.some(o=>o.name==='Master Thief')),index=cls.system.choiceSchedule.findIndex(s=>s.list===list.key);cls.system.choices[index]=list.options.find(o=>o.name==='Master Thief').index;
 const s={abilities:Object.fromEntries(['str','dex','con','int','wis','cha'].map(k=>[k,{base:10}])),progression:Array.from({length:6},()=>({classId:'intruder',vitality:4,skills:{}})),misc:{}};computeAgent(s,[cls],cfg);const spec=s.limitedUses.find(s=>s.id==='masterThief');assert.equal(spec.limit,1);assert.equal(spec.period,'session');assert.equal(spec.cost,0);
 cls.system.choices[index]=null;computeAgent(s,[cls],cfg);assert.equal(s.limitedUses.some(s=>s.id==='masterThief'),false);
});
