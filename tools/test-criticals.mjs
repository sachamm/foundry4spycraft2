import {SPYCRAFT as cfg} from '../module/config.mjs';import {skillFeatRules} from '../module/rules/limited-uses.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {criticalPlan} from '../module/rules/criticals.mjs';import {checkFlavor} from '../module/rules/outcomes.mjs';
const threat={checkKind:'attack',weaponProficiency:'rifle',threatConfirmed:true,errorConfirmed:false};
const success={baseCost:1,effect:'Apply damage to wounds',effectConfirmed:true,beforeDamage:true,available:4};
test('RAW pp.62,329: only a confirmed threat can be activated, by its own character and before damage',()=>{
 assert.equal(criticalPlan({},threat,success).cost,1);
 for(const patch of [{threatConfirmed:false},{resolved:true},{superseded:true},{criticalSuccess:true}])assert.equal(criticalPlan({},{...threat,...patch},success).blocked,true);
 for(const patch of [{samePayer:false},{beforeDamage:false},{effectConfirmed:false},{effect:''},{baseCost:0},{baseCost:5},{baseCost:1.5},{available:0}])assert.equal(criticalPlan({},threat,{...success,...patch}).blocked,true);
});
test('Most Deadly and Grunt Overkill reduce applicable critical-hit costs to zero, without changing other proficiencies',()=>{
 const sys={weaponSpecialist:{proficiencies:['rifle'],abilities:['Most Deadly']},classLevels:{grunt:8}};
 assert.equal(criticalPlan(sys,threat,{...success,available:0}).cost,0);
 for(const weaponProficiency of ['tactical','indirectFire'])assert.equal(criticalPlan(sys,{...threat,weaponProficiency},{...success,baseCost:2}).cost,1);
 assert.equal(criticalPlan(sys,{...threat,weaponProficiency:'handgun'},success).cost,1);
 assert.equal(criticalPlan({...sys,classLevels:{grunt:7}},{...threat,weaponProficiency:'tactical'},success).cost,1);
});
test('RAW pp.52,62,200: opponents pay for errors before boosting, within line of sight; Driven and Practice Makes Perfect increase the cost',()=>{
 const check={checkKind:'skill',skillKey:'mechanics',checkId:'repair',errorConfirmed:true,criticalFailureCostIncrease:1};
 const options={kind:'failure',baseCost:1,effect:'Repair goes wrong',effectConfirmed:true,samePayer:false,opponent:true,lineOfSight:true,available:4};
 assert.equal(criticalPlan({coreClassIds:['wheelman']},check,options).cost,3);
 for(const patch of [{samePayer:true},{opponent:false},{lineOfSight:false},{available:1}])assert.equal(criticalPlan({},check,{...options,...patch}).blocked,true);
 assert.equal(criticalPlan({}, {...check,boostSpent:1},options).blocked,true);
 assert.equal(criticalPlan({}, {...check,errorConfirmed:false},options).blocked,true);
});
test('activated critical results replace threat/error labels and escape the recorded effect text',()=>{
 const text=checkFlavor({...threat,criticalSuccess:true,criticalActivation:{cost:1,effect:'<img src=x onerror=bad()>',sources:[]}});
 assert.match(text,/Critical success/);assert.doesNotMatch(text,/<img/);assert.match(text,/&lt;img/);assert.doesNotMatch(text,/>Threat\./);
});

globalThis.Actor=class{constructor(){this.uuid='Actor.acting';this.type='agent';this.isOwner=true;this.system={actionDice:{value:4,die:4}};}async update(data){if(data['system.actionDice.value']!==undefined)this.system.actionDice.value=data['system.actionDice.value'];}};
globalThis.game={user:{isGM:true}};globalThis.ui={notifications:{warn:()=>null}};
const {SpycraftActor}=await import('../module/documents/actor.mjs');
function message(patch={}){return {uuid:'ChatMessage.critical',flags:{spycraft2:{...threat,actorUuid:'Actor.acting',...patch}},async update(data){this.flags.spycraft2=data['flags.spycraft2'];this.flavor=data.flavor;}};}
test('document activation pays actual dice once, records the effect and prevents repeated activation',async()=>{
 const actor=new SpycraftActor(),msg=message();await actor.activateCritical(msg,success);
 assert.equal(actor.system.actionDice.value,3);assert.equal(msg.flags.spycraft2.criticalSuccess,true);assert.equal(msg.flags.spycraft2.criticalActivation.cost,1);
 await actor.activateCritical(msg,success);assert.equal(actor.system.actionDice.value,3);
});
test('zero-cost Most Deadly activation works with an empty pool, and failed updates refund paid dice',async()=>{
 const actor=new SpycraftActor();actor.system.actionDice.value=0;actor.system.weaponSpecialist={proficiencies:['rifle'],abilities:['Most Deadly']};
 const msg=message();await actor.activateCritical(msg,success);assert.equal(msg.flags.spycraft2.criticalActivation.cost,0);assert.equal(actor.system.actionDice.value,0);
 const paid=new SpycraftActor(),bad=message();bad.update=async()=>{throw Error('message rejected');};await assert.rejects(paid.activateCritical(bad,success),/message rejected/);assert.equal(paid.system.actionDice.value,4);
});
test('opponent payment charges only that actor, rejects missing ownership, and serializes reciprocal payments without deadlock',async()=>{
 const a=new SpycraftActor(),b=new SpycraftActor();b.uuid='Actor.opponent';
 const options={kind:'failure',baseCost:1,effect:'Failed check effect',effectConfirmed:true,opponent:true,lineOfSight:true,payer:b};
 const msg=message({threatConfirmed:false,errorConfirmed:true,checkKind:'skill'});await a.activateCritical(msg,options);assert.equal(a.system.actionDice.value,4);assert.equal(b.system.actionDice.value,3);assert.equal(msg.flags.spycraft2.criticalFailure,true);
 const ma=message({threatConfirmed:false,errorConfirmed:true,checkKind:'skill'}),mb=message({actorUuid:b.uuid,threatConfirmed:false,errorConfirmed:true,checkKind:'skill'});
 await Promise.all([a.activateCritical(ma,options),b.activateCritical(mb,{...options,payer:a})]);assert.equal(a.system.actionDice.value,3);assert.equal(b.system.actionDice.value,2);
 b.isOwner=false;assert.equal(await a.activateCritical(message({errorConfirmed:true}),options),null);
});


test('RAW pp.301–302: Dependable raises error activation cost; Unreliable may make it free; mutually exclusive qualities cancel',()=>{
 const check={checkKind:'attack',errorConfirmed:true},options={kind:'failure',baseCost:1,effect:'Dud round',effectConfirmed:true,samePayer:false,opponent:true,lineOfSight:true,available:4};
 assert.equal(criticalPlan({}, {...check,weaponQualities:'DEP'},options).cost,2);
 assert.equal(criticalPlan({}, {...check,weaponQualities:'UNR'},{...options,available:0}).cost,0);
 assert.equal(criticalPlan({}, {...check,weaponQualities:'DEP, UNR'},options).cost,1);
 assert.equal(criticalPlan({}, {...check,weaponQualities:'UNR',criticalFailureCostIncrease:1},options).cost,1);
});
test('an opponent with no dice can activate an Unreliable error for zero without charging either character',async()=>{
 const actor=new SpycraftActor(),payer=new SpycraftActor();payer.uuid='Actor.opponent';payer.system.actionDice.value=0;
 const msg=message({checkKind:'attack',threatConfirmed:false,errorConfirmed:true,weaponQualities:'UNR'});
 await actor.activateCritical(msg,{kind:'failure',payer,baseCost:1,effect:'Dud round',effectConfirmed:true,opponent:true,lineOfSight:true});
 assert.equal(msg.flags.spycraft2.criticalFailure,true);assert.equal(msg.flags.spycraft2.criticalActivation.cost,0);assert.equal(actor.system.actionDice.value,4);assert.equal(payer.system.actionDice.value,0);
});

test('Sharpshooter Supremacy lowers only ranged critical-hit costs, stacks with Most Deadly, and permits a free activation',()=>{
 const sys={activeFeatNames:['Sharpshooter Supremacy'],weaponSpecialist:{proficiencies:['rifle'],abilities:['Most Deadly']}};
 assert.equal(criticalPlan(sys,threat,{...success,baseCost:2,available:0}).cost,0);
 assert.equal(criticalPlan(sys,{...threat,weaponProficiency:'edged'},success).cost,1);
 assert.equal(criticalPlan(sys,{...threat,weaponProficiency:'exoticHurled'}, {...success,available:0}).cost,0);
 assert.equal(criticalPlan(sys,{...threat,checkKind:'skill'},success).cost,1);
});

test('an adjudicated attack Triumph includes one die of critical effect; only higher table results spend additional dice',()=>{
 const triumph={...threat,triumphed:true,successConfirmed:true,effectiveTotal:75};
 assert.equal(criticalPlan({},triumph,{...success,available:0}).cost,0);assert.equal(criticalPlan({},triumph,{...success,baseCost:3}).cost,2);
 assert.equal(criticalPlan({}, {...triumph,triumphed:false}, success).cost,1);assert.equal(criticalPlan({}, {...triumph,effectiveTotal:74}, success).cost,1);
 const specialist={weaponSpecialist:{proficiencies:['rifle'],abilities:['Most Deadly']}};assert.equal(criticalPlan(specialist,triumph,{...success,baseCost:2,available:0}).cost,0);
});
test('the free attack-Triumph effect is recorded once and does not draw from an empty actor pool',async()=>{
 const actor=new SpycraftActor();actor.system.actionDice.value=0;const msg=message({triumphed:true,successConfirmed:true,effectiveTotal:75});
 await actor.activateCritical(msg,success);assert.equal(msg.flags.spycraft2.criticalSuccess,true);assert.equal(msg.flags.spycraft2.criticalActivation.cost,0);assert.equal(actor.system.actionDice.value,0);
 await actor.activateCritical(msg,success);assert.equal(actor.system.actionDice.value,0);
});

test('Clean and Polished increases only the recorded personal-gear error cost and stacks with Dependable/Unreliable and mastery modifiers',()=>{
 const check={checkKind:'skill',errorConfirmed:true,cleanAndPolished:true},options={kind:'failure',baseCost:1,effect:'Equipment malfunction',effectConfirmed:true,samePayer:false,opponent:true,lineOfSight:true,available:5};
 assert.equal(criticalPlan({},check,options).cost,2);assert.equal(criticalPlan({}, {...check,weaponQualities:'DEP',criticalFailureCostIncrease:1},options).cost,4);assert.equal(criticalPlan({}, {...check,weaponQualities:'UNR'},options).cost,1);
 assert.equal(criticalPlan({}, {...threat,cleanAndPolished:true},success).cost,1);
});


test('Grand Skill Mastery lowers covered skill critical-success costs to zero and respects selected skills/focuses, without affecting other check kinds or failures',()=>{
 const system={skillFeatRules:[{name:'Grand Skill Mastery',choice:'Techie',skill:'electronics'},{name:'Grand Skill Mastery',choice:'Field of Expertise',skill:'science',focuses:['Physics']}]};
 const skill={checkKind:'skill',skillKey:'electronics',threatConfirmed:true};assert.equal(criticalPlan(system,skill,{...success,available:0}).cost,0);assert.equal(criticalPlan(system,{...skill,skillKey:'science',focus:'Physics'},{...success,available:0}).cost,0);assert.equal(criticalPlan(system,{...skill,skillKey:'science',focus:'Chemistry'},success).cost,1);
 for(const checkKind of ['knowledge','attack'])assert.equal(criticalPlan(system,{...skill,checkKind},success).cost,1);assert.equal(criticalPlan(system,{...skill,skillKey:'notice'},success).cost,1);
 assert.equal(criticalPlan(system,{...skill,threatConfirmed:false,errorConfirmed:true},{kind:'failure',baseCost:1,effect:'Error effect',effectConfirmed:true,samePayer:false,opponent:true,lineOfSight:true,available:1}).cost,1);
});
test('distinct valid Grand Skill Mastery selections contribute their unnamed discounts, while duplicate rule rows for one selection count once',()=>{
 const skill={checkKind:'skill',skillKey:'electronics',threatConfirmed:true};const rule={name:'Grand Skill Mastery',choice:'Techie',skill:'electronics'};const system={skillFeatRules:[rule,{...rule,choice:'techie'}, {...rule,choice:'Field of Expertise'}]};const p=criticalPlan(system,skill,{...success,baseCost:3});assert.equal(p.cost,1);assert.equal(p.sources.length,2);assert.equal(criticalPlan(system,skill,{...success,baseCost:1,available:0}).cost,0);
 assert.equal(criticalPlan({skillFeatRules:[{...rule,choice:''},{...rule,name:'Advanced Skill Mastery'}]},skill,success).cost,1);
});
test('actual free skill activation records the mastery source with no dice paid and failed updates remain retryable',async()=>{
 const a=new SpycraftActor();a.system.actionDice.value=0;a.system.skillFeatRules=[{name:'Grand Skill Mastery',choice:'Techie',skill:'electronics'}];const m=message({checkKind:'skill',skillKey:'electronics'});await a.activateCritical(m,success);assert.equal(m.flags.spycraft2.criticalSuccess,true);assert.equal(m.flags.spycraft2.criticalActivation.cost,0);assert.match(m.flags.spycraft2.criticalActivation.sources[0],/Grand Skill Mastery/);assert.equal(a.system.actionDice.value,0);await a.activateCritical(m,success);assert.equal(a.system.actionDice.value,0);
 const failed=message({checkKind:'skill',skillKey:'electronics'});failed.update=async()=>{throw Error('mastery update failed');};await assert.rejects(a.activateCritical(failed,success),/mastery update failed/);assert.equal(a.system.actionDice.value,0);assert.notEqual(failed.flags.spycraft2.criticalSuccess,true);
});

test('every Basic Skill feat’s valid Grand mastery chain supplies only its mapped skills to the critical resolver, and missing prerequisites supply no discount',()=>{
 for(const [choice,covered] of Object.entries(cfg.tables.basicSkillFeats)){
  const items=[{id:'basic',type:'feat',name:choice,system:{}},{id:'advanced',type:'feat',name:'Advanced Skill Mastery',system:{choice}},{id:'grand',type:'feat',name:'Grand Skill Mastery',system:{choice}}];
  const status={featStatus:{basic:{ok:true},advanced:{ok:true},grand:{ok:true}}};const rules=skillFeatRules(status,items,cfg);
  for(const skillKey of Object.keys(cfg.skills)){const p=criticalPlan({skillFeatRules:rules},{checkKind:'skill',skillKey,threatConfirmed:true},success);assert.equal(p.cost,covered.includes(skillKey)?0:1,`${choice}: ${skillKey}`);}
  const missing=skillFeatRules({...status,featStatus:{advanced:{ok:true},grand:{ok:true}}},items.slice(1),cfg);assert.equal(missing.filter(r=>r.name==='Grand Skill Mastery').length,0);
 }
});

test('Most Lethal requires the earned Wheelman choice and actual vehicle-mount context; unrecorded platforms may be declared without overriding a recorded false',()=>{
 const system={classOptionSelections:[{classId:'wheelman',name:'Most Lethal'}]},mounted={...threat,attackContext:{vehicleMounted:true}};assert.equal(criticalPlan(system,mounted,{...success,available:0}).cost,0);assert.equal(criticalPlan({classLevels:{wheelman:20}},mounted,success).cost,1);assert.equal(criticalPlan(system,{...mounted,checkKind:'skill'},success).cost,1);
 const declared=criticalPlan(system,threat,{...success,vehicleMountedConfirmed:true,available:0});assert.equal(declared.cost,0);assert.equal(declared.vehicleMountDeclared,true);assert.equal(criticalPlan(system,{...mounted,attackContext:{vehicleMounted:false}},{...success,vehicleMountedConfirmed:true}).cost,1);
 const stacked={...system,weaponSpecialist:{proficiencies:['rifle'],abilities:['Most Deadly']},activeFeatNames:['Sharpshooter Supremacy']};assert.equal(criticalPlan(stacked,mounted,{...success,baseCost:3,available:0}).cost,0);
 assert.equal(criticalPlan(system,{...mounted,threatConfirmed:false,errorConfirmed:true},{kind:'failure',baseCost:1,effect:'Error effect',effectConfirmed:true,samePayer:false,opponent:true,lineOfSight:true,available:1}).cost,1);
});
test('free mounted-weapon activation records an explicit previously-unrecorded platform; known unmounted attacks still pay their normal cost',async()=>{
 const a=new SpycraftActor();a.system.actionDice.value=0;a.system.classOptionSelections=[{classId:'wheelman',name:'Most Lethal'}];const m=message();await a.activateCritical(m,{...success,vehicleMountedConfirmed:true});assert.equal(m.flags.spycraft2.criticalActivation.cost,0);assert.equal(m.flags.spycraft2.attackContext.vehicleMounted,true);assert.equal(m.flags.spycraft2.attackContext.vehicleMountDeclaredAtActivation,true);assert.equal(a.system.actionDice.value,0);
 a.system.actionDice.value=1;const unmounted=message({attackContext:{vehicleMounted:false}});await a.activateCritical(unmounted,{...success,vehicleMountedConfirmed:true});assert.equal(unmounted.flags.spycraft2.criticalActivation.cost,1);assert.equal(unmounted.flags.spycraft2.attackContext.vehicleMounted,false);assert.equal(unmounted.flags.spycraft2.attackContext.vehicleMountDeclaredAtActivation,undefined);assert.equal(a.system.actionDice.value,0);
});
