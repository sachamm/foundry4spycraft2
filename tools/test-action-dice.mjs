import test from 'node:test';import assert from 'node:assert/strict';
import {actionDieBoostPlan,actionDieBoostResult,generousBoostPlan,pointmanLevel,improvedFortuneBonus} from '../module/rules/action-dice.mjs';import {resolveSkillResult} from '../module/rules/checks.mjs';
const system=(cores=[])=>({coreClassIds:cores,abilities:{int:{mod:4}},actionDice:{value:5,die:6,bonus:2,explodeAt:5},activeFeatNames:[]});
const check={checkKind:'skill',ability:'int',skillKey:'analysis',checkId:'appraise',rawTotal:43,naturalDie:17,threat:20,error:1,cap:40,actionDiceAllowed:true};

test('RAW pp.61,88: action dice add to the cap, and Triumph is tested on the actual boosted result',()=>{
 assert.equal(resolveSkillResult(71,17,{cap:60,actionDieBonus:4}).total,64);
 assert.equal(resolveSkillResult(74,17,{cap:60,actionDieBonus:15}).total,75);
 assert.equal(resolveSkillResult(75,17,{cap:60,actionDieBonus:4}).total,79);
 const plan=actionDieBoostPlan(system(),check),result=actionDieBoostResult(check,plan,[3]);
 assert.equal(plan.formula,'1d6x>=5');assert.equal(result.added,5);assert.equal(result.effectiveTotal,45);assert.equal(result.boostSpent,1);
});

test('RAW p.29: all eligible doubled-die cores apply to their own contexts and never stack past two dice',()=>{
 for(const [core,context,options] of [['soldier',{checkKind:'attack'},{}],['intruder',{checkKind:'skill',ability:'dex'},{}],['sleuth',{checkKind:'skill',ability:'wis'},{}],['snoop',{checkKind:'skill',ability:'int'},{}],['wheelman',{checkKind:'skill',checkId:'maneuver'},{}],['wheelman',{checkKind:'skill',skillKey:'mechanics',checkId:'repair'},{}],['brawler',{checkKind:'damage',unarmed:true},{}],['brawler',{checkKind:'damage',improvised:true},{}],['counterterrorist',{checkKind:'save'},{openingRound:true}]]){
  const plan=actionDieBoostPlan(system([core]),{...check,...context},options);assert.equal(plan.rolls,2,core);
 }
 assert.equal(actionDieBoostPlan(system(['soldier','counterterrorist']),{...check,checkKind:'attack'},{openingRound:true}).rolls,2);
 assert.equal(actionDieBoostPlan(system(['intruder']),check).rolls,1);
 assert.equal(actionDieBoostPlan(system(['counterterrorist']),check).rolls,1);
 assert.equal(actionDieBoostPlan(system(['brawler']),{...check,checkKind:'damage'}).rolls,1);
});

test('damage may consume only one action die even when a core rolls two; fixed/resolved results and overspending are blocked',()=>{
 const damage={...check,checkKind:'damage',unarmed:true};
 assert.equal(actionDieBoostPlan(system(['brawler']),damage,{count:1}).rolls,2);
 assert.equal(actionDieBoostPlan(system(),damage,{count:2}).blocked,true);
 assert.equal(actionDieBoostPlan(system(),{...damage,boostSpent:1}).blocked,true);
 for(const patch of [{actionDiceAllowed:false},{resolved:true}])assert.equal(actionDieBoostPlan(system(),{...check,...patch}).blocked,true);
 assert.equal(actionDieBoostPlan(system(),check,{count:6}).blocked,true);assert.equal(actionDieBoostPlan(system(),check,{count:1.5}).blocked,true);
});

test('Calculating replaces one lowest raw action-die result before per-die modifiers',()=>{
 const plan=actionDieBoostPlan(system(['soldier','schemer']),{...check,checkKind:'attack'},{calculating:true});
 const result=actionDieBoostResult(check,plan,[2,6]);assert.equal(result.added,14);assert.equal(result.replaced,true);
 const high=actionDieBoostResult(check,plan,[5,6]);assert.equal(high.replaced,false);assert.equal(high.added,15);
});

test('Well Rounded raises the cap per boost transaction, up to sixty',()=>{
 const sys=system();sys.activeFeatNames=['Well Rounded'];
 const original={...check,cap:20,rawTotal:27};const plan=actionDieBoostPlan(sys,original);
 const first=actionDieBoostResult(original,plan,[2]);assert.equal(first.boostCap,30);assert.equal(first.effectiveTotal,31);
 const next=actionDieBoostResult({...original,...first},plan,[1]);assert.equal(next.boostCap,40);assert.equal(next.effectiveTotal,34);
 assert.equal(actionDieBoostResult({...original,cap:60},plan,[1]).boostCap,60);
});

globalThis.Actor=class {constructor(){this.uuid='Actor.test';this.isOwner=true;this.system=system();}async update(data){this.system.actionDice.value=data['system.actionDice.value'];}};
globalThis.game={i18n:{localize:s=>s,format:s=>s}};globalThis.ChatMessage={getSpeaker:()=>({})};globalThis.ui={notifications:{warn:()=>null}};
let rollResults=[3],posts=0;
globalThis.Roll=class {constructor(formula){this.formula=formula;this.dice=rollResults.map(total=>({total}));}async evaluate(){return this;}async toMessage(){posts++;return {};}};
const {SpycraftActor}=await import('../module/documents/actor.mjs');
function message(patch={}){return {flags:{spycraft2:{...check,actorUuid:'Actor.test',baseFlavor:'Analysis',...patch}},async update(data){this.flags.spycraft2=data['flags.spycraft2'];this.flavor=data.flavor;}};}

test('document boost spends actual dice, updates the effective result and retains the original total',async()=>{
 const actor=new SpycraftActor(),msg=message();const result=await actor.boostCheck(msg,{count:1});
 assert.equal(actor.system.actionDice.value,4);assert.equal(result.effectiveTotal,45);assert.equal(msg.flags.spycraft2.rawTotal,43);assert.equal(msg.flags.spycraft2.boostTotal,5);assert.ok(msg.flavor.includes('Effective result: 45'));
});

test('failed message update refunds the action die; queued double-clicks cannot overspend',async()=>{
 const actor=new SpycraftActor(),bad=message();bad.update=async()=>{throw new Error('test failure');};
 await assert.rejects(actor.boostCheck(bad,{count:1}),/test failure/);assert.equal(actor.system.actionDice.value,5);
 actor.system.actionDice.value=1;const msg=message();const results=await Promise.all([actor.boostCheck(msg,{count:1}),actor.boostCheck(msg,{count:1})]);
 assert.equal(actor.system.actionDice.value,0);assert.equal(results.filter(Boolean).length,1);
});


test('RAW p.62: opponents decide error activation before boosting; activated critical failures cannot be boosted',()=>{
 const error={...check,naturalDie:1,error:1};
 assert.equal(actionDieBoostPlan(system(),error).blocked,true);
 assert.equal(actionDieBoostPlan(system(),error,{errorDeclined:true}).blocked,false);
 assert.equal(actionDieBoostPlan(system(),{...error,criticalFailure:true},{errorDeclined:true}).blocked,true);
});


test('RAW p.39: Generous rolls one donor die with donor modifiers, requires a perceived teammate, and is limited once per result',()=>{
 const donor={coreClassIds:['pointman','soldier','schemer'],abilities:{int:{mod:5}},activeFeatNames:['Well Rounded'],actionDice:{value:3,die:8,explodeAt:7,bonus:2}};
 const check={checkKind:'attack',rawTotal:12,effectiveTotal:12,naturalDie:10,cap:null,actionDiceAllowed:true};
 const options={teammate:true,perceivedAtRoll:true,calculating:true};const plan=generousBoostPlan(donor,check,options);
 assert.equal(plan.rolls,1);assert.equal(plan.die,8);assert.equal(plan.formula,'1d8x>=7');assert.equal(plan.wellRounded,false);
 const result=actionDieBoostResult(check,plan,[2]);assert.equal(result.added,7);assert.equal(result.effectiveTotal,19);
 for(const patch of [{teammate:false},{perceivedAtRoll:false},{sameActor:true}])assert.equal(generousBoostPlan(donor,check,{...options,...patch}).blocked,true);
 for(const patch of [{generousBoost:{}},{actionDiceAllowed:false},{resolved:true}])assert.equal(generousBoostPlan(donor,{...check,...patch},options).blocked,true);
 assert.equal(generousBoostPlan({...donor,coreClassIds:[]},check,options).blocked,true);
});

test('Generous charges only the donor, cannot be repeated by another Pointman, and refunds failed message updates',async()=>{
 const target=new SpycraftActor(),donor=new SpycraftActor();target.uuid='Actor.target';donor.uuid='Actor.donor';target.type=donor.type='agent';
 target.system={actionDice:{value:4,die:4}};donor.system={coreClassIds:['pointman'],actionDice:{value:3,die:8,bonus:2}};
 const check={actorUuid:target.uuid,checkKind:'skill',rawTotal:12,effectiveTotal:12,naturalDie:10,cap:20,actionDiceAllowed:true,wellRoundedBoosts:0};
 const msg={flags:{spycraft2:check},async update(data){this.flags.spycraft2=data['flags.spycraft2'];}};
 const options={donor,teammate:true,perceivedAtRoll:true};
 await target.boostWithGenerous(msg,options);assert.equal(donor.system.actionDice.value,2);assert.equal(target.system.actionDice.value,4);assert.equal(msg.flags.spycraft2.generousBoost.donorUuid,donor.uuid);assert.equal(msg.flags.spycraft2.wellRoundedBoosts,0);
 await target.boostWithGenerous(msg,options);assert.equal(donor.system.actionDice.value,2);
 const bad={flags:{spycraft2:check},async update(){throw Error('message rejected');}};await assert.rejects(target.boostWithGenerous(bad,options),/message rejected/);assert.equal(donor.system.actionDice.value,2);
});

test('RAW p.41: Improved Fortune uses distinct sources, both milestones and the combined three-die team cap',()=>{
 const ally=(id,level)=>({id,name:id,level});assert.equal(improvedFortuneBonus(9,[]).value,0);assert.equal(improvedFortuneBonus(10,[]).value,1);assert.equal(improvedFortuneBonus(20,[]).value,2);
 assert.equal(improvedFortuneBonus(10,[ally('a',20)]).value,3);assert.equal(improvedFortuneBonus(20,[ally('a',20),ally('b',10)]).value,3);
 assert.equal(improvedFortuneBonus(0,[ally('a',10),ally('a',20)]).value,1);assert.equal(improvedFortuneBonus(0,[ally('a',9)]).value,0);
});
test('Improved Fortune sources require a real Pointman class item and Pointman levels, rather than total career level or claimed name',()=>{
 const actor={type:'agent',items:[{type:'class',system:{identifier:'pointman'}}],system:{progression:[...Array.from({length:10},()=>({classId:'pointman'})),...Array.from({length:10},()=>({classId:'soldier'}))]}};
 assert.equal(pointmanLevel(actor),10);assert.equal(pointmanLevel({...actor,items:[]}),0);assert.equal(pointmanLevel({...actor,type:'npc'}),0);assert.equal(pointmanLevel(null),0);
});

test('generic INT/WIS and opening-round core benefits include active Knowledge; passive Knowledge cannot spend dice',()=>{
 const k={...check,checkKind:'knowledge'};assert.equal(actionDieBoostPlan(system(['snoop']),k).rolls,2);assert.equal(actionDieBoostPlan(system(['counterterrorist']),k,{openingRound:true}).rolls,2);assert.equal(actionDieBoostPlan(system(['snoop','counterterrorist']),k,{openingRound:true}).rolls,2);assert.equal(actionDieBoostPlan(system(['snoop']),{...k,actionDiceAllowed:false}).blocked,true);assert.equal(actionDieBoostPlan(system(['wheelman']),{...k,skillKey:'mechanics',checkId:'repair'}).rolls,1);
});

test('Calculating includes explicitly typed ability checks and Generous uses the donor core without inventing doubled ability dice',()=>{
 const ability={...check,checkKind:'ability',ability:'wis',cap:null},sys=system(['schemer']),plan=actionDieBoostPlan(sys,ability,{count:2,calculating:true});assert.equal(plan.calculating,true);assert.equal(plan.rolls,2);const result=actionDieBoostResult(ability,plan,[1,3]);assert.equal(result.added,11);assert.equal(result.replaced,true);assert.equal(result.effectiveTotal,54);assert.equal(actionDieBoostPlan(system(),ability,{calculating:true}).calculating,false);assert.equal(actionDieBoostPlan(sys,ability,{calculating:false}).calculating,false);const donor=generousBoostPlan(system(['pointman','schemer']),ability,{teammate:true,perceivedAtRoll:true,calculating:true});assert.equal(donor.calculating,true);assert.equal(donor.rolls,1);assert.equal(actionDieBoostResult(ability,donor,[1]).added,6);
});
