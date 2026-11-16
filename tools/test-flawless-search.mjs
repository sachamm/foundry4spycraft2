import {SPYCRAFT as cfg} from '../module/config.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {flawlessSearchLevel,flawlessSearchPlan,AUTOMATIC_SKILL_SOURCES,automaticSkillSuccessSources,automaticSkillSuccessPlan} from '../module/rules/class-checks.mjs';import {checkCandidates} from '../module/rules/outcomes.mjs';
const s=()=>({classLevels:{snoop:1},actionDice:{value:0},resourceUses:{}}),c=()=>({checkKind:'skill',skillKey:'search',successConfirmed:false,effectiveTotal:5,errorConfirmed:false});
test('all native Snoop levels and validated borrowed sources use class level +20; repeated same-class copies do not multiply assumed levels',()=>{
 for(let level=1;level<=20;level++){const system={classLevels:{snoop:level}};assert.ok(flawlessSearchPlan(system,c(),{difficultyClass:level+20}));assert.equal(flawlessSearchPlan(system,c(),{difficultyClass:level+21}),null);}
 const inheritedClassChoices=[{name:'Snoop: Flawless search',ownerClass:'pointman',assumedLevel:1},{name:'Snoop: Flawless search',ownerClass:'pointman',assumedLevel:1},{name:'Snoop: Flawless search',ownerClass:'other',assumedLevel:1}];assert.equal(flawlessSearchLevel({inheritedClassChoices}),2);assert.equal(flawlessSearchLevel({classLevels:{snoop:3},inheritedClassChoices}),3);assert.equal(flawlessSearchLevel({inheritedClassChoices:[{name:'Flawless search',ownerClass:'pointman'}]}),0);
});
test('only failed non-error Analysis/Search checks qualify, including fixed checks; final DC is required and above-threshold failures stay failed',()=>{
 for(const skillKey of ['analysis','search'])for(const checkMethod of ['roll','take10','take20'])assert.ok(flawlessSearchPlan(s(),{...c(),skillKey,checkMethod},{difficultyClass:21}));
 for(const patch of [{skillKey:'notice'},{checkKind:'knowledge'},{checkKind:'attack'},{successConfirmed:true},{successConfirmed:null},{errorConfirmed:true},{criticalFailure:true},{resolved:true},{superseded:'other'}])assert.equal(flawlessSearchPlan(s(),{...c(),...patch},{difficultyClass:21}),null);
 for(const difficultyClass of ['',null,false,Infinity,21.5,undefined])assert.throws(()=>flawlessSearchPlan(s(),c(),{difficultyClass}),/GC-confirmed/);assert.equal(flawlessSearchPlan(s(),c(),{difficultyClass:22}),null);
});
let failUpdate=false,dialog=null;
globalThis.Actor=class{constructor(){this.isOwner=true;this.uuid='Actor.snoop';this.system=s();}};globalThis.game={user:{isGM:true},settings:{get:()=>({})}};globalThis.foundry={applications:{api:{DialogV2:{input:async opts=>dialog?.(opts)}}}};globalThis.ui={notifications:{warn:()=>null}};
const {SpycraftActor}=await import('../module/documents/actor.mjs');
function message(patch={}){return {uuid:'ChatMessage.search',id:'search',flags:{spycraft2:{actorUuid:'Actor.snoop',rawTotal:5,effectiveTotal:5,naturalDie:5,threat:20,error:1,checkKind:'skill',skillKey:'search',checkMethod:'roll',cap:20,boostTotal:0,boostSpent:0,...patch}},async update(data){if(failUpdate)throw Error('message write failed');for(const [k,v] of Object.entries(data)){if(k==='flags.spycraft2')this.flags.spycraft2=structuredClone(v);else if(k==='flags.spycraft2.resolved')this.flags.spycraft2.resolved=v;else this[k]=v;}return this;}};}
test('document fallback records automatic lowest-grade success without inventing a new total or spending resources',async()=>{
 const a=new SpycraftActor(),m=message();const result=await a.confirmCheckOutcome(m,{succeeded:false,difficultyClass:21});assert.equal(result.successConfirmed,true);assert.equal(result.flawlessSearch.threshold,21);assert.equal(result.flawlessSearch.lowestPositiveGrade,true);assert.equal(result.effectiveTotal,5);assert.equal(result.rawTotal,5);assert.equal(result.naturalDie,5);assert.equal(result.errorConfirmed,false);assert.equal(a.system.actionDice.value,0);assert.match(m.flavor,/lowest positive grade/);
 const failed=message();assert.equal((await a.confirmCheckOutcome(failed,{succeeded:false,difficultyClass:22})).successConfirmed,false);assert.equal(failed.flags.spycraft2.flawlessSearch,null);
});
test('natural/negative errors remain failures and cannot trigger Flawless Search; a successful natural threat retains ordinary threat rules',async()=>{
 const a=new SpycraftActor();for(const patch of [{naturalDie:1},{rawTotal:-1,effectiveTotal:-1}]){const m=message(patch),r=await a.confirmCheckOutcome(m,{succeeded:false});assert.equal(r.successConfirmed,false);assert.equal(r.errorConfirmed,true);assert.equal(r.flawlessSearch,null);}
 const m=message({naturalDie:20});const r=await a.confirmCheckOutcome(m,{succeeded:false,difficultyClass:21});assert.equal(r.threatConfirmed,true);assert.equal(checkCandidates(r).threat,true);
});
test('finish routes eligible ordinary checks through adjudication; GC dialog collects the opposing result and failures leave the record unchanged',async()=>{
 const a=new SpycraftActor(),m=message();await assert.rejects(a.confirmCheckOutcome(m,{succeeded:false}),/GC-confirmed/);assert.equal(m.flags.spycraft2.successConfirmed,undefined);
 dialog=opts=>{assert.match(opts.content,/name="difficultyClass"/);return {outcome:'failure',difficultyClass:'21'};};await a.finishCheck(m);assert.equal(m.flags.spycraft2.successConfirmed,true);assert.equal(m.flags.spycraft2.resolved,true);assert.ok(m.flags.spycraft2.flawlessSearch);
 const b=message();failUpdate=true;await assert.rejects(a.confirmCheckOutcome(b,{succeeded:false,difficultyClass:21}),/message write failed/);failUpdate=false;assert.equal(b.flags.spycraft2.flawlessSearch,undefined);assert.equal(a.system.actionDice.value,0);
});
test('losing the source clears the fallback on renewed adjudication; secret checks stay GC-only and replaced checks cannot change',async()=>{
 const a=new SpycraftActor(),m=message();await a.confirmCheckOutcome(m,{succeeded:false,difficultyClass:21});a.system.classLevels={};await a.confirmCheckOutcome(m,{succeeded:false});assert.equal(m.flags.spycraft2.successConfirmed,false);assert.equal(m.flags.spycraft2.flawlessSearch,null);
 const secret=message();secret.blind=true;game.user.isGM=false;assert.equal(await a.confirmCheckOutcome(secret,{succeeded:true}),null);game.user.isGM=true;const replaced=message({superseded:'new'});assert.equal(await a.confirmCheckOutcome(replaced,{succeeded:true}),null);
});

test('all five non-error success abilities check every skill and native level boundary without leaking to other skills',()=>{
 const skills=Object.keys(cfg.skills);
 for(const source of AUTOMATIC_SKILL_SOURCES)for(let level=1;level<=20;level++)for(const skillKey of skills){const system={classLevels:{[source.classId]:level}},check={...c(),skillKey},match=source.skills.includes(skillKey);assert.equal(automaticSkillSuccessSources(system,check).length,match?1:0);const plan=automaticSkillSuccessPlan(system,check,{difficultyClass:level+20});assert.equal(plan?.id??null,match?source.id:null);assert.equal(automaticSkillSuccessPlan(system,check,{difficultyClass:level+21}),null);}
});
test('every borrowed source uses assumed levels, de-duplicates its owner class and yields to actual emulated progression',()=>{
 for(const source of AUTOMATIC_SKILL_SOURCES){const check={...c(),skillKey:source.skills[0]},entries=[{name:source.borrowed,ownerClass:'pointman',assumedLevel:1},{name:source.borrowed,ownerClass:'pointman',assumedLevel:1},{name:source.borrowed,ownerClass:'other',assumedLevel:1}];const system={inheritedClassChoices:entries};assert.equal(automaticSkillSuccessPlan(system,check,{difficultyClass:22}).level,2);system.classLevels={[source.classId]:4};assert.equal(automaticSkillSuccessPlan(system,check,{difficultyClass:24}).level,4);assert.equal(automaticSkillSuccessPlan(system,{...check,errorConfirmed:true},{difficultyClass:20}),null);}
});
test('document adjudication preserves named receipts for every equivalent ability and uses the same finish/DC/rollback behavior',async()=>{
 for(const source of AUTOMATIC_SKILL_SOURCES){const a=new SpycraftActor();a.system.classLevels={[source.classId]:2};const m=message({skillKey:source.skills[1]});const r=await a.confirmCheckOutcome(m,{succeeded:false,difficultyClass:22});assert.equal(r.successConfirmed,true);assert.equal(r.automaticSkillSuccess.id,source.id);assert.equal(r.automaticSkillSuccess.name,source.name);assert.equal(r.effectiveTotal,5);assert.ok(m.flavor.includes(source.name));assert.equal(!!r.flawlessSearch,source.id==='flawlessSearch');assert.equal(a.system.actionDice.value,0);}
});
