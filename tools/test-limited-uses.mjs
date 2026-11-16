// These fixtures supply required gear unless a case explicitly overrides gearStatus; absence/kit boundaries are tested in test-skill-gear.mjs.
import test from 'node:test';import assert from 'node:assert/strict';
import {limitedUseAbilities,resourceStatus,resourceUsePlan,rerollEligibility,skillFeatRules} from '../module/rules/limited-uses.mjs';
import {resolveSkillCheck} from '../module/rules/skills.mjs';import {SPYCRAFT as cfg} from '../module/config.mjs';
const context={checkKind:'skill',checkMethod:'roll',naturalDie:8,skillKey:'analysis',focus:'',formula:'1d20 + @total',rollData:{total:5}};
const advanced={id:'advanced',workflow:'reroll',mastery:'Advanced Skill Mastery',skills:[{skill:'analysis'}]};
const perfect={id:'perfect',workflow:'reroll',mastery:'Perfect Skill Mastery'};
const meticulous={id:'meticulous',workflow:'reroll',skill:'science',focuses:['Physics']};
test('RAW pp.42,70: Bright Idea uses increase only at the source milestones; same-named class abilities keep independent pools',()=>{
 for(let level=0;level<=20;level++){
  const sys={classLevels:{scientist:level}};const entry=limitedUseAbilities(sys,[],cfg).find(e=>e.id==='brightIdeaScientist');
  assert.equal(entry?.limit??0,level<3?0:2+2*[7,11,15,19].filter(l=>l<=level).length,`Scientist ${level}`);
 }
 const both=limitedUseAbilities({classLevels:{fieldAnalyst:8,scientist:7}},[],cfg).filter(s=>s.workflow==='brightIdea');assert.equal(both.length,2);assert.deepEqual(both.map(s=>s.limit),[4,4]);
 assert.equal(limitedUseAbilities({inheritedClassChoices:[{name:'Scientist: Bright idea (1/session)',ownerClass:'pointman',assumedLevel:3}]},[],cfg)[0].limit,1);
});
test('scene/session/mission/round counters reset independently, not on navigation',()=>{
 const spec={id:'resource',period:'scene',limit:2,cost:1};
 const used={resource:{epoch:'scene-a',used:1}},periods={scene:'scene-a',session:'session-b'};
 assert.equal(resourceStatus(spec,used,periods).remaining,1);
 assert.equal(resourceStatus(spec,used,{...periods,session:'session-c'}).remaining,1);
 assert.equal(resourceStatus(spec,used,{...periods,scene:'scene-b'}).remaining,2);
 assert.equal(resourceUsePlan(spec,used,periods,0).blocked,true);
 assert.deepEqual(resourceUsePlan(spec,used,periods,1).record,{epoch:'scene-a',used:2});
 assert.equal(resourceUsePlan(spec,{resource:{epoch:'scene-a',used:2}},periods,9).blocked,true);
});
test('RAW pp.199–200: Advanced Skill Mastery is scoped; Perfect uses the literal general failed-check benefit and forbids repeat rerolls',()=>{
 assert.equal(rerollEligibility(advanced,context,{failed:true}),true);
 assert.equal(rerollEligibility(advanced,{...context,skillKey:'athletics'},{failed:true}),false);
 assert.equal(rerollEligibility(perfect,{...context,checkKind:'save'},{failed:true}),true);
 for(const patch of [{checkKind:'damage'},{checkMethod:'take10'},{resolved:true},{superseded:'x'},{rerollResources:['advanced']}])assert.equal(rerollEligibility(perfect,{...context,...patch},{failed:true}),false);
 for(const options of [{},{failed:true,criticalFailure:true}])assert.equal(rerollEligibility(advanced,context,options),false);
 // Advanced's once/session counter limits spending; only Perfect explicitly forbids rerolling the same check.
 assert.equal(rerollEligibility(advanced,{...context,rerollResources:['advanced']},{failed:true}),true);
});
test('RAW p.85: Meticulous may reroll an error but only for the selected key skill/focus',()=>{
 assert.equal(rerollEligibility(meticulous,{...context,naturalDie:1,skillKey:'science',focus:'Physics'}),true);
 assert.equal(rerollEligibility(meticulous,{...context,skillKey:'science',focus:'Chemistry'}),false);
 assert.equal(rerollEligibility(meticulous,context),false);
});
const use={name:'Test Check',id:'test',attributes:['int'],mode:'Active',tags:'',error:2,time:'1 Minute (Take 10/Take 20)',page:97};
function skillSystem(){return {skillTotals:{analysis:{name:'Analysis',ranks:4,cap:30,threat:20,totals:[{ability:'int',total:15}]}},activeFeatNames:[],skillFeatRules:[]};}
test('RAW p.200: Attention to Detail permits error 1–2 for take20 and lifts its cap, while all other restrictions remain',()=>{
 const sys=skillSystem();sys.activeFeatNames=['Attention to Detail'];
 const result=resolveSkillCheck(sys,'analysis',use,{gearStatus:'available',method:'take20',safeToTake:true});assert.equal(result.blocked,false);assert.equal(result.cap,null);assert.equal(result.crossCheck,true);
 assert.equal(resolveSkillCheck(sys,'analysis',use,{gearStatus:'available',method:'take10',safeToTake:true}).blocked,true);
 assert.equal(resolveSkillCheck(sys,'analysis',{...use,error:3},{gearStatus:'available',method:'take20',safeToTake:true}).blocked,true);
 assert.equal(resolveSkillCheck(sys,'analysis',{...use,tags:'Concentration'},{gearStatus:'available',method:'take20',safeToTake:true}).blocked,true);
 assert.equal(resolveSkillCheck(sys,'analysis',use,{gearStatus:'available',method:'take20'}).blocked,true);
});
test('RAW p.200: False Start and Mark of a Professional timing apply to covered skills and selected focuses',()=>{
 const sys=skillSystem();sys.skillFeatRules=[{name:'False Start',skill:'analysis'},{name:'Mark of a Professional',skill:'analysis'},{name:'Practice Makes Perfect',skill:'analysis'}];
 const check={...use,error:1};
 assert.equal(resolveSkillCheck(sys,'analysis',check,{gearStatus:'available',method:'take20',safeToTake:true}).timeMultiplier,15);
 const result=resolveSkillCheck(sys,'analysis',check,{gearStatus:'available',method:'take20',safeToTake:true,unopposed:true});assert.equal(result.timeMultiplier,10);assert.equal(result.minimumTime,'1 round');assert.equal(result.practiceMakesPerfect,true);assert.equal(result.criticalFailureCostIncrease,1);
 sys.skillFeatRules=[{name:'False Start',skill:'analysis',focuses:['Other']}];
 assert.equal(resolveSkillCheck(sys,'analysis',check,{gearStatus:'available',method:'take20',safeToTake:true}).timeMultiplier,20);
});

globalThis.Actor=class {constructor(){this.uuid='Actor.test';this.isOwner=true;this.system={resourceUses:{},actionDice:{value:1},limitedUses:[{...meticulous,name:'Meticulous',period:'scene',limit:1,cost:1}]};}async update(data){for(const [path,value] of Object.entries(data)){
  const keys=path.replace(/^system\./,'').split('.');let target=this.system;
  for(const key of keys.slice(0,-1))target=target[key]??={};
  const key=keys.at(-1);if(key.startsWith('-='))delete target[key.slice(2)];else target[key]=value;
 }}};
globalThis.game={settings:{get:()=>({scene:'a'})},i18n:{localize:s=>s,format:s=>s}};globalThis.CONFIG={SPYCRAFT:cfg};globalThis.ChatMessage={getSpeaker:()=>({})};globalThis.ui={notifications:{warn:()=>null}};globalThis.foundry={utils:{escapeHTML:s=>s},applications:{api:{DialogV2:{input:async()=>({chosen:1})}}}};
let outcomes=[4],posts=0;
globalThis.Roll=class {constructor(formula,data){this.dice=[{total:outcomes.shift()??4}];this.total=this.dice[0].total+(data.total??0);}async evaluate(){return this;}async toMessage(data,options){posts++;return {uuid:`ChatMessage.${posts}`,data,options};}};
const {SpycraftActor}=await import('../module/documents/actor.mjs');
test('document counters spend both the use and action die; failed execution restores both; repeated clicks cannot overspend',async()=>{
 const actor=new SpycraftActor();await assert.rejects(actor.useLimitedAbility('meticulous',async()=>{throw new Error('post failed');},{workflow:'reroll'}),/post failed/);
 assert.equal(actor.system.actionDice.value,1);assert.deepEqual(actor.system.resourceUses,{});
 const results=await Promise.all([actor.useLimitedAbility('meticulous',()=>true,{workflow:'reroll'}),actor.useLimitedAbility('meticulous',()=>true,{workflow:'reroll'})]);
 assert.equal(results.filter(Boolean).length,1);assert.equal(actor.system.actionDice.value,0);assert.equal(actor.system.resourceUses.meticulous.used,1);
});
test('document reroll supersedes its parent, carries the reroll history and starts with no old boost',async()=>{
 const actor=new SpycraftActor();const message={flags:{spycraft2:{...context,actorUuid:actor.uuid,skillKey:'science',focus:'Physics',cap:20,baseFlavor:'Science',boostTotal:5}},async update(data){for(const [path,v] of Object.entries(data))this.flags.spycraft2[path.slice('flags.spycraft2.'.length)]=v;}};
 outcomes=[9];const next=await actor.rerollCheck(message,{resource:'meticulous'});
 assert.equal(message.flags.spycraft2.resolved,true);assert.equal(message.flags.spycraft2.superseded,next.uuid);
 assert.deepEqual(next.data.flags.spycraft2.rerollResources,['meticulous']);assert.equal(next.data.flags.spycraft2.boostTotal,0);assert.equal(next.data.flags.spycraft2.naturalDie,9);
});
test('Bright Idea preserves both alternatives and the chosen natural die; Practice Makes Perfect retains the original die for error checks',async()=>{
 const actor=new SpycraftActor();outcomes=[19,3];const result=await actor.rollCheck('1d20 + @total',{total:5},{chooseTwice:true,practiceMakesPerfect:true,error:1,cap:30});
 assert.equal(result.data.flags.spycraft2.naturalDie,3);assert.equal(result.data.flags.spycraft2.rolledTotal,8);assert.equal(result.data.flags.spycraft2.rawTotal,15);assert.equal(result.data.flags.spycraft2.alternatives.length,2);
 outcomes=[1];const error=await actor.rollCheck('1d20 + @total',{total:5},{practiceMakesPerfect:true,error:1});assert.equal(error.data.flags.spycraft2.rawTotal,6);assert.equal(error.data.flags.spycraft2.minimumAdjustment,0);
});
test('RAW p.63: Hail Mary removes only the untrained error increase, lifts caps, and makes passive/secret checks active',()=>{
 const sys=skillSystem();sys.skillTotals.analysis.ranks=0;
 const check={...use,error:1,mode:'Passive'};
 const normal=resolveSkillCheck(sys,'analysis',check,{gearStatus:'available'});assert.equal(normal.error,3);assert.equal(normal.rollMode,'blindroll');
 const result=resolveSkillCheck(sys,'analysis',check,{gearStatus:'available',hailMaryUntrained:true,hailMaryUncap:true,hailMaryActive:true});
 assert.equal(result.error,1);assert.equal(result.cap,null);assert.equal(result.rollMode,undefined);assert.equal(result.actionDiceCost,8);
 assert.equal(resolveSkillCheck(sys,'analysis',check,{gearStatus:'available',method:'take20',safeToTake:true,hailMaryUntrained:true}).blocked,true);
 sys.skillTotals.analysis.ranks=1;assert.equal(resolveSkillCheck(sys,'analysis',check,{gearStatus:'available',hailMaryUntrained:true}).blocked,true);
 assert.equal(resolveSkillCheck(sys,'analysis',use,{gearStatus:'available',hailMaryActive:true}).blocked,true);
});
test('RAW p.101: Cross-Check triples time and changes secrecy only when the tag is available',()=>{
 const sys=skillSystem(),check={...use,error:1,mode:'Secret',tags:'Cross-Check'};
 const active=resolveSkillCheck(sys,'analysis',check,{gearStatus:'available',crossCheckActive:true});assert.equal(active.rollMode,undefined);assert.equal(active.timeMultiplier,3);
 assert.equal(resolveSkillCheck(sys,'analysis',{...check,tags:''},{gearStatus:'available',crossCheckActive:true}).blocked,true);
 sys.activeFeatNames=['Attention to Detail'];assert.equal(resolveSkillCheck(sys,'analysis',{...check,tags:''},{gearStatus:'available',crossCheckActive:true}).blocked,false);
 assert.equal(resolveSkillCheck(sys,'analysis',{...check,tags:''},{gearStatus:'available',crossCheckActive:true,method:'take20',safeToTake:true}).timeMultiplier,60);
});
test('source-derived targeted effects reject invalid mastery chains and retain both Field of Expertise Profession focuses',()=>{
 const techie={id:'basic',name:'Techie',type:'feat',system:{choice:'',tree:'basicSkill'}};
 const falseStart={id:'false',name:'False Start',type:'feat',system:{choice:'Techie',tree:'advancedSkill'}};
 const sys={classLevels:{},featStatus:{basic:{ok:true},false:{ok:true}}};
 assert.deepEqual(skillFeatRules(sys,[techie,falseStart],cfg).filter(r=>r.name==='False Start').map(r=>r.skill),['computers','electronics']);
 assert.equal(skillFeatRules({...sys,featStatus:{false:{ok:true}}},[techie,falseStart],cfg).length,0);
 const v={id:'v',type:'class',system:{identifier:'virtuoso',keySkill:'profession',keyFocus:'Artist',professionFocus:'Chef'}};
 const mastery={id:'mastery',name:'Advanced Skill Mastery',type:'feat',system:{choice:'Field of Expertise'}};
 for(const choice of ['Field of Expertise','field of expertise',' FIELD OF EXPERTISE ']){mastery.system.choice=choice;const rules=skillFeatRules({classLevels:{virtuoso:1},featStatus:{mastery:{ok:true}}},[v,mastery],cfg);assert.deepEqual(rules[0].focuses,['Artist','Chef']);assert.equal(rules[0].choice,'Field of Expertise');}
});
test('pre-roll spending cannot overspend and restores dice on a failed post',async()=>{
 const actor=new SpycraftActor();let calls=0;
 const results=await Promise.all([actor.spendActionDice(1,async()=>{calls++;return true;}),actor.spendActionDice(1,async()=>{calls++;return true;})]);
 assert.equal(calls,1);assert.equal(results.filter(Boolean).length,1);assert.equal(actor.system.actionDice.value,0);
 actor.system.actionDice.value=2;await assert.rejects(actor.spendActionDice(2,async()=>{throw new Error('failed');}),/failed/);assert.equal(actor.system.actionDice.value,2);
});


test('ability failure restores or deletes only its own usage entry and preserves unrelated changes',async()=>{
 const actor=new SpycraftActor();actor.system.resourceUses.other={epoch:'a',used:1};
 await assert.rejects(actor.useLimitedAbility('meticulous',async()=>{actor.system.resourceUses.other.used=2;throw Error('failed');},{workflow:'reroll'}),/failed/);
 assert.deepEqual(actor.system.resourceUses,{other:{epoch:'a',used:2}});assert.equal(actor.system.actionDice.value,1);
 actor.system.resourceUses.meticulous={epoch:'older-scene',used:1};
 await assert.rejects(actor.useLimitedAbility('meticulous',async()=>{throw Error('failed');},{workflow:'reroll'}),/failed/);
 assert.deepEqual(actor.system.resourceUses.meticulous,{epoch:'older-scene',used:1});
});

test('malformed current/unknown-period counters cannot silently refill or create fractional uses; expired records and legitimate over-limit history remain distinct',()=>{
 const spec={id:'resource',name:'Resource',period:'scene',limit:2,cost:0},periods={scene:'a'};
 for(const stored of [{epoch:'a',used:'1'},{epoch:'a',used:-1},{epoch:'a',used:0.5},{epoch:'a',used:NaN},{epoch:'a',used:Infinity},{epoch:'a',used:Number.MAX_SAFE_INTEGER+1},{epoch:'a'},{used:1},{epoch:42,used:1},'bad',1,[]]){const uses={resource:stored},before=structuredClone(uses);assert.equal(resourceStatus(spec,uses,periods).counterReview,true);assert.equal(resourceStatus(spec,uses,periods).remaining,0);assert.equal(resourceUsePlan(spec,uses,periods,0).blocked,true);assert.deepEqual(uses,before);}
 assert.equal(resourceStatus(spec,{resource:{epoch:'old',used:'bad'}},periods).remaining,2);assert.equal(resourceStatus(spec,{resource:{epoch:'a',used:4}},periods).counterReview,undefined);assert.equal(resourceStatus(spec,{resource:{epoch:'a',used:4}},periods).remaining,0);assert.equal(resourceStatus(spec,{},periods).remaining,2);
});
test('malformed limits, costs or action-die balances fail before any use record is planned',()=>{
 const spec={id:'r',name:'Resource',period:'scene',limit:2,cost:0};for(const limit of [-1,1.5,'2',NaN,Infinity])assert.equal(resourceUsePlan({...spec,limit},{},{},0).blocked,true);for(const cost of [-1,0.5,'0',NaN,Infinity])assert.equal(resourceUsePlan({...spec,cost},{},{},10).blocked,true);for(const balance of [-1,1.5,'3',NaN,Infinity])assert.equal(resourceUsePlan(spec,{},{},balance).blocked,true);
});

test('Practice Makes Perfect scopes both printed benefits and frozen source evidence to all15 Basic Skill choices and every named use',()=>{let matched=0;for(const[choice,skills]of Object.entries(cfg.tables.basicSkillFeats)){const rules=skills.map(skill=>({name:'Practice Makes Perfect',choice,skill,focuses:[]}));for(const skill of Object.values(cfg.skills))for(const check of skill.checks){const s={skillFeatRules:rules,skillTotals:{[skill.key]:{name:skill.name,ranks:6,cap:30,threat:20,bonusEntries:[],totals:check.attributes.map(ability=>({ability,total:7}))}}},p=resolveSkillCheck(s,skill.key,check,{gearStatus:'available'}),covered=skills.includes(skill.key);assert.equal(p.practiceMakesPerfect,covered,choice+':'+skill.key+':'+check.id);assert.equal(p.criticalFailureCostIncrease,covered?1:0);assert.equal(!!p.practiceFeat,covered);if(covered){matched++;assert.equal(p.practiceFeat.rules[0].choice,choice);assert.equal(p.practiceFeat.error,p.error);}}}assert.ok(matched>=90);});
test('Practice Makes Perfect preserves natural dice and errors for every d20 result and error range, applies normal caps and increases opponent error cost once',async()=>{const{criticalPlan}=await import('../module/rules/criticals.mjs');for(let error=0;error<=20;error++)for(let die=1;die<=20;die++){const a=new SpycraftActor();outcomes=[die];const r=await a.rollCheck('1d20 + @total',{total:5},{checkKind:'skill',checkMethod:'roll',practiceMakesPerfect:true,error,cap:12,threat:20,criticalFailureCostIncrease:1}),f=r.data.flags.spycraft2,adjust=die>error&&die<10?10-die:0;assert.equal(f.naturalDie,die);assert.equal(f.rolledTotal,die+5);assert.equal(f.rawTotal,die+5+adjust);assert.equal(f.minimumAdjustment,adjust);assert.equal(f.effectiveTotal,die===20?25:Math.min(12,die+5+adjust));if(die<=error){const p=criticalPlan({}, {...f,errorConfirmed:true},{kind:'failure',baseCost:1,effect:'Synthetic failed skill',effectConfirmed:true,opponent:true,lineOfSight:true,samePayer:false,available:2});assert.equal(p.cost,2);}}});
test('virtual focus restrictions exclude unrelated checks; changing the Practice source during RNG rejects the actual roll and altered evidence is rejected',async()=>{const{rollEvidence,rollEvidenceMatches}=await import('../module/rules/outcomes.mjs');const a=new SpycraftActor();a.items=new Map();a.system=skillSystem();a.system.skillFeatRules=[{name:'Practice Makes Perfect',choice:'Field of Expertise',skill:'analysis',focuses:['Authenticate']}];outcomes=[4];const opts={check:'authenticate',gearStatus:'available'},good=await a.rollSkill('analysis','int',opts),f=good.data.flags.spycraft2;assert.equal(f.practiceFeat.source,'Practice Makes Perfect');assert.equal(f.minimumAdjustment,6);const changed=structuredClone(f);changed.practiceFeat.rules[0].focuses=['Other'];assert.equal(rollEvidenceMatches(rollEvidence(f),changed),false);a.system.skillFeatRules[0].focuses=['Other'];outcomes=[4];const outside=await a.rollSkill('analysis','int',opts);assert.equal(outside.data.flags.spycraft2.practiceFeat,null);assert.equal(outside.data.flags.spycraft2.minimumAdjustment,0);a.system.skillFeatRules[0].focuses=['Authenticate'];const original=Roll.prototype.evaluate,before=posts;Roll.prototype.evaluate=async function(){a.system.skillFeatRules=[];return this;};try{await assert.rejects(a.rollSkill('analysis','int',opts),/changed/);assert.equal(posts,before);}finally{Roll.prototype.evaluate=original;}});

test('all15 Mastery choices get distinct session counters and exact Advanced/Perfect reroll scopes and limits',()=>{for(const[choice,skills]of Object.entries(cfg.tables.basicSkillFeats)){const system={skillFeatRules:['Advanced Skill Mastery','Perfect Skill Mastery'].flatMap(name=>skills.map(skill=>({name,choice,skill,focuses:[]})))},specs=limitedUseAbilities(system,[],cfg).filter(s=>s.workflow==='reroll');assert.equal(specs.length,2);assert.notEqual(specs[0].id,specs[1].id);for(const spec of specs){const perfect=spec.mastery==='Perfect Skill Mastery';assert.equal(spec.period,'session');assert.equal(spec.cost,0);assert.equal(spec.limit,perfect?3:1);for(const skillKey of Object.keys(cfg.skills)){for(const checkKind of ['skill','knowledge','save','attack','damage']){const check={...context,checkKind,skillKey};assert.equal(rerollEligibility(spec,check,{failed:true}),checkKind!=='damage'&&(perfect||['skill','knowledge'].includes(checkKind)&&skills.includes(skillKey)));}}for(const patch of [{successConfirmed:true},{criticalFailure:true},{checkMethod:'take20'},{naturalDie:null},{superseded:'new'},{resolved:true}])assert.equal(rerollEligibility(spec,{...context,...patch},{failed:true}),false);const full=resourceUsePlan(spec,{[spec.id]:{epoch:'s',used:spec.limit}},{session:'s'},0);assert.equal(full.blocked,true);assert.equal(resourceUsePlan(spec,{[spec.id]:{epoch:'s',used:spec.limit}},{session:'next'},0).blocked,false);}}});
test('reroll source, scope, period or parent changes during RNG stop posting and refund the reserved ability use',async()=>{const original=Roll.prototype.evaluate;for(const phase of ['source','scope','period','epoch','parent']){const getSettings=game.settings.get,a=new SpycraftActor();a.system.limitedUses=[{id:'advanced',name:'Advanced',period:'scene',cost:0,limit:1,workflow:'reroll',mastery:'Advanced Skill Mastery',skills:[{skill:'analysis'}]}];const m={uuid:'ChatMessage.parent',flags:{spycraft2:{...context,actorUuid:a.uuid,skillKey:'analysis',rollData:{total:2},baseFlavor:'Analysis'}},async update(){throw Error('Parent should not be written');}},before=posts;Roll.prototype.evaluate=async function(){if(phase==='source')a.system.limitedUses=[];if(phase==='scope')a.system.limitedUses[0].skills=[{skill:'survival'}];if(phase==='period')a.system.limitedUses[0].period='session';if(phase==='epoch')game.settings.get=()=>({scene:'changed'});if(phase==='parent')m.flags.spycraft2.effectiveTotal=99;return this;};await assert.rejects(a.rerollCheck(m,{resource:'advanced',failed:true}),/changed/);assert.equal(posts,before);assert.equal(a.system.resourceUses.advanced?.used??0,0);game.settings.get=getSettings;}Roll.prototype.evaluate=original;});

test('replacement source evidence cannot be silently changed while ordinary legacy receipts retain their original comparison',async()=>{const{rollEvidence,rollEvidenceMatches}=await import('../module/rules/outcomes.mjs');const a=new SpycraftActor(),m={uuid:'ChatMessage.parent-source',flags:{spycraft2:{...context,actorUuid:a.uuid,skillKey:'science',focus:'Physics'}},async update(patch){for(const[k,v]of Object.entries(patch))this.flags.spycraft2[k.slice(16)]=v;}};outcomes=[8];const r=await a.rerollCheck(m,{resource:'meticulous'}),f=r.data.flags.spycraft2;assert.equal(f.rerollSource.id,'meticulous');assert.equal(f.rerollSource.epoch,'a');const changed=structuredClone(f);changed.rerollSource.epoch='later';assert.equal(rollEvidenceMatches(rollEvidence(f),changed),false);const legacy={...context};assert.equal(rollEvidenceMatches(rollEvidence(legacy),legacy),true);});
