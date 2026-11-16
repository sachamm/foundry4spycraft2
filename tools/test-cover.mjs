import test from 'node:test';
import assert from 'node:assert/strict';
import {coverPlan} from '../module/rules/cover.mjs';
import {incomingDefensePlan} from '../module/rules/defense.mjs';
import {checkIncomingDefense} from '../module/apps/incoming-defense.mjs';
const source={activeFeatNames:['CQB Supremacy'],cqbRange:30},gun={proficiency:'handgun'};
const options={attackerSystem:source,attackerWeapon:gun,ranged:true,distanceFeet:30,opponentConfirmed:true};
const system={defense:{total:15,dodgeBonuses:2,dexterity:3},abilities:{dex:{mod:3}},classLevels:{}};
test('Table 5.10 combines best personal and scenery grades once, caps at total, and keeps total-cover penetration explicit',()=>{
 for(let personalCover=0;personalCover<=4;personalCover++)for(let sceneryCover=0;sceneryCover<=4;sceneryCover++){
  const p=coverPlan({personalCover,sceneryCover}),g=Math.min(4,personalCover+sceneryCover);
  assert.equal(p.grade,g);assert.equal(p.defenseBonus,g*2);assert.equal(p.reflexBonus,g);assert.equal(p.requiresPenetration,g===4);
 }
 assert.equal(coverPlan({personalCover:2,sceneryCover:1}).defenseBonus,6);
});
test('CQB Supremacy removes one quarter from partial combined cover at the exact range boundary, leaving total cover and ordinary Reflex unchanged',()=>{
 for(let personalCover=0;personalCover<=4;personalCover++)for(let sceneryCover=0;sceneryCover<=4;sceneryCover++){
  const p=coverPlan({...options,personalCover,sceneryCover}),g=Math.min(4,personalCover+sceneryCover),reduced=g>0&&g<4;
  assert.equal(p.grade,g-Number(reduced));assert.equal(p.supremacyReduction,Number(reduced));assert.equal(p.reflexBonus,g);
 }
 const p=coverPlan({...options,personalCover:2,sceneryCover:1});assert.equal(p.defenseBonus,4);assert.equal(p.reflexBonus,3);
});
test('no CQB cover benefit leaks beyond range, onto nonopponents, from inactive feats, or onto melee, placement and unknown weapon types',()=>{
 for(const patch of [{distanceFeet:30.01},{opponentConfirmed:false},{attackerSystem:{activeFeatNames:['CQB Mastery'],cqbRange:30}}])assert.equal(coverPlan({...options,personalCover:2,...patch}).defenseBonus,4);
 assert.equal(coverPlan({...options,personalCover:2,attackerSystem:{...source,cqbRange:60},distanceFeet:60}).defenseBonus,2);
 for(const proficiency of ['unarmed','edged','blunt','explosives','unknown',undefined])assert.throws(()=>coverPlan({...options,attackerWeapon:{proficiency},personalCover:2}),/ranged weapon/);
 assert.throws(()=>coverPlan({...options,ranged:false}),/ranged weapon/);
});
test('cover declarations reject fractional, coerced, unsafe or missing CQB facts rather than grant an assumed benefit',()=>{
 for(const value of [-1,5,1.5,'2',null,false,NaN,Infinity])for(const key of ['personalCover','sceneryCover'])assert.throws(()=>coverPlan({[key]:value}),/cover grade/);
 for(const distanceFeet of [undefined,null,'30',false,NaN,Infinity,-1])assert.throws(()=>coverPlan({...options,distanceFeet}),/distance/);
 for(const patch of [{opponentConfirmed:'true'},{ranged:1},{attackerSystem:{...source,cqbRange:-1}}])assert.throws(()=>coverPlan({...options,...patch}));
});
test('incoming Defense adds only the per-attack cover bonus and preserves vulnerability, class context and the underlying actor',()=>{
 const before=structuredClone(system),p=incomingDefensePlan(system,{ranged:true,cover:{...options,personalCover:2,sceneryCover:1}});
 assert.equal(p.total,19);assert.equal(p.cover.defenseBonus,4);assert.equal(p.cover.reflexBonus,3);assert.deepEqual(system,before);
 const vulnerable=incomingDefensePlan(system,{flatFooted:true,cover:{personalCover:2}});assert.equal(vulnerable.total,14);assert.equal(vulnerable.dodgeLost,2);
 assert.equal(incomingDefensePlan(system,{cover:{personalCover:4}}).total,23);
});
let responses=[],dialogs=[],warnings=[],hook=null;
const attacker={id:'shooter',name:'CQB shooter',visible:true,system:structuredClone(source),items:new Map()},weapon={id:'gun',name:'Pistol',type:'weapon',system:{...gun,quantity:1}};
const target={id:'target',type:'agent',isOwner:true,system:structuredClone(system)};
function setup(input){attacker.system=structuredClone(source);attacker.items=new Map([['gun',structuredClone(weapon)]]);attacker.items[Symbol.iterator]=function*(){yield* this.values();};responses=[input,null];dialogs=[];warnings=[];hook=null;const actors=new Map([['shooter',attacker],['target',target]]);actors[Symbol.iterator]=function*(){yield* this.values();};globalThis.game={actors,user:{isGM:true}};globalThis.ui={notifications:{warn:m=>{warnings.push(m);return null;}}};globalThis.foundry={utils:{escapeHTML:s=>String(s).replaceAll('<','&lt;')},applications:{api:{DialogV2:{input:async o=>{dialogs.push(o);if(hook){const f=hook;hook=null;f();}return responses.shift();}}}}};}
const input={ranged:true,personalCover:'2',sceneryCover:'1',coverAttacker:'shooter:gun',coverDistance:'30',coverOpponent:true};
test('the real incoming preview reads an actual attacker and weapon, presents exact Defense/Reflex context and performs no document mutation',async()=>{
 setup(input);const before=structuredClone(target.system),p=await checkIncomingDefense(target);assert.equal(p.total,19);assert.equal(p.cover.grade,2);assert.equal(dialogs.length,2);assert.match(dialogs[1].content,/Defense 19/);assert.match(dialogs[1].content,/Reflex bonus \+3/);assert.match(dialogs[0].content,/CQB shooter — Pistol/);assert.deepEqual(target.system,before);
 setup(null);assert.equal(await checkIncomingDefense(target),null);assert.equal(dialogs.length,1);
});
test('preview source deletion, weapon deletion, destruction and feat loss during the dialog cannot retain a stale CQB benefit',async()=>{
 for(const change of [()=>game.actors.delete('shooter'),()=>attacker.items.delete('gun'),()=>attacker.items.get('gun').system.destroyed=true,()=>attacker.system.activeFeatNames=[]]){setup(input);hook=change;assert.equal(await checkIncomingDefense(target),null);assert.match(warnings[0],/changed/);assert.equal(dialogs.length,1);}
 setup(input);attacker.items.get('gun').system.ammunitionOnly=true;assert.equal(await checkIncomingDefense(target),null);assert.doesNotMatch(dialogs[0].content,/CQB shooter — Pistol/);assert.match(warnings[0],/listed/);
});
test('ordinary preview cover needs no CQB source, while missing or malformed selected-source facts stop the calculation',async()=>{
 setup({personalCover:'2',sceneryCover:'1'});assert.equal((await checkIncomingDefense(target)).total,21);
 for(const patch of [{coverDistance:''},{personalCover:'1.5'},{ranged:false},{coverAttacker:'invented:weapon'}]){setup({...input,...patch});assert.equal(await checkIncomingDefense(target),null);assert.equal(warnings.length,1);assert.equal(dialogs.length,1);}
});

test('ordinary Reflex cover uses the unreduced combined grade only for effects beyond the cover',async()=>{
 const {saveCoverPlan}=await import('../module/rules/cover.mjs');
 for(let personalCover=0;personalCover<=4;personalCover++)for(let sceneryCover=0;sceneryCover<=4;sceneryCover++)for(const effectBeyondCover of [false,true]){
  const p=saveCoverPlan('ref',{personalCover,sceneryCover,effectBeyondCover,attackerSystem:source,attackerWeapon:gun,distanceFeet:30});
  assert.equal(p.grade,Math.min(4,personalCover+sceneryCover));assert.equal(p.bonus,effectBeyondCover?p.grade:0);
 }
 assert.equal(saveCoverPlan('ref'),null);assert.equal(saveCoverPlan('ref',{personalCover:'2',sceneryCover:'1',effectBeyondCover:true}).bonus,3);
});
test('cover save parsing never grants other saves a cover bonus and rejects malformed Reflex circumstances',async()=>{
 const {saveCoverPlan}=await import('../module/rules/cover.mjs');
 for(const key of ['fort','will'])assert.equal(saveCoverPlan(key,{personalCover:4,sceneryCover:4,effectBeyondCover:true}),null);
 for(const value of [null,false,1.5,-1,5,' 2','2.0','',Infinity,{},[]])assert.throws(()=>saveCoverPlan('ref',{personalCover:value}),/cover grade/);
 assert.throws(()=>saveCoverPlan('ref',{effectBeyondCover:'true'}),/originates beyond/);
});

test('Precision Takedown uses every Counter-Terrorist level and reduces only an opponent’s partial cover, for every attack type and range',async()=>{
 const {precisionTakedownGrade}=await import('../module/rules/cover.mjs');
 for(let level=0;level<=10;level++)for(let personalCover=0;personalCover<=4;personalCover++)for(let sceneryCover=0;sceneryCover<=4;sceneryCover++)for(const ranged of [false,true])for(const opponentConfirmed of [false,true]){
  const precisionAttackerSystem={classLevels:{counterterrorist:level}},p=coverPlan({precisionAttackerSystem,personalCover,sceneryCover,ranged,opponentConfirmed,distanceFeet:1000}),base=Math.min(4,personalCover+sceneryCover),grade=level>=7?2:level>=2?1:0;
  assert.equal(precisionTakedownGrade(precisionAttackerSystem),grade);assert.equal(p.grade,base-(opponentConfirmed&&base<4?Math.min(base,grade):0));assert.equal(p.reflexBonus,base);
 }
 for(const value of [-1,11,1.5,'7',Infinity])assert.throws(()=>precisionTakedownGrade({classLevels:{counterterrorist:value}}),/class level/);
 assert.equal(precisionTakedownGrade({classLevels:{soldier:20},name:'Precision Takedown II'}),0);
});
test('Precision Takedown II replaces grade I and stacks with ranged CQB Supremacy without reducing total cover or going below none',()=>{
 for(const level of [2,7])for(let personalCover=0;personalCover<=4;personalCover++)for(const distanceFeet of [30,31]){
  const p=coverPlan({...options,attackerSystem:{...source,classLevels:{counterterrorist:level}},personalCover,distanceFeet}),base=personalCover,precision=level===7?2:1;
  assert.equal(p.grade,base===4?4:Math.max(0,base-precision-(distanceFeet<=30?1:0)));assert.equal(p.reflexBonus,base);
 }
});
test('actual preview selects a current Precision Takedown owner for melee or ranged attacks and automatically includes it for the selected CQB owner',async()=>{
 for(const level of [2,7])for(const ranged of [false,true]){setup({personalCover:'2',sceneryCover:'1',precisionAttacker:'shooter',coverOpponent:true,ranged});attacker.system.classLevels={counterterrorist:level};const p=await checkIncomingDefense(target);assert.equal(p.total,15+2*(3-(level===7?2:1)));assert.match(dialogs[0].content,/Counter-Terrorist attacker/);assert.equal(p.cover.reflexBonus,3);}
 setup(input);attacker.system.classLevels={counterterrorist:7};const p=await checkIncomingDefense(target);assert.equal(p.total,15);assert.equal(p.cover.precisionReduction,2);assert.equal(p.cover.supremacyReduction,1);
});
test('precision owner deletion, level loss and mixing two attackers stop the preview without retaining a benefit',async()=>{
 for(const change of [()=>game.actors.delete('shooter'),()=>attacker.system.classLevels.counterterrorist=1]){setup({personalCover:'2',precisionAttacker:'shooter',coverOpponent:true});attacker.system.classLevels={counterterrorist:2};hook=change;assert.equal(await checkIncomingDefense(target),null);assert.match(warnings[0],/source changed/);}
 setup({...input,precisionAttacker:'second'});game.actors.set('second',{id:'second',name:'Other source',visible:true,system:{classLevels:{counterterrorist:7}},items:[]});assert.equal(await checkIncomingDefense(target),null);assert.match(warnings[0],/same actual attacker/);
});

test('cover selectors require ownership or Observer access and reject permission loss while the dialog is open',async()=>{
 setup(input);game.user.isGM=false;assert.equal(await checkIncomingDefense(target),null);assert.doesNotMatch(dialogs[0].content,/CQB shooter — Pistol/);
 setup(input);game.user.isGM=false;attacker.testUserPermission=(_,level)=>level==='OBSERVER';assert.equal((await checkIncomingDefense(target)).cover.supremacyReduction,1);
 setup(input);game.user.isGM=false;attacker.testUserPermission=()=>true;hook=()=>{attacker.testUserPermission=()=>false;};assert.equal(await checkIncomingDefense(target),null);assert.match(warnings[0],/changed/);
 delete attacker.testUserPermission;
});

test('Safe Attack starts at Counter-Terrorist4 and halves only the actual shield component, rounding down for all amounts and retaining total-cover penetration',()=>{
 for(let level=0;level<=10;level++)for(let humanShieldDefense=0;humanShieldDefense<=8;humanShieldDefense++){
  const p=coverPlan({precisionAttackerSystem:{classLevels:{counterterrorist:level}},personalCover:4,humanShieldDefense,humanShieldConfirmed:true});
  assert.equal(p.humanShieldEffective,level>=4?Math.floor(humanShieldDefense/2):humanShieldDefense);assert.equal(p.defenseBonus,8-humanShieldDefense+p.humanShieldEffective);assert.equal(p.grade,4);assert.equal(p.reflexBonus,4);assert.equal(p.requiresPenetration,true);
 }
});
test('Safe Attack follows declared remaining shield Defense after grade reductions, preserving scenery and ordinary Reflex without requiring an opponent',()=>{
 const base={precisionAttackerSystem:{classLevels:{counterterrorist:4}},personalCover:2,sceneryCover:1,opponentConfirmed:true,humanShieldConfirmed:true};
 let p=coverPlan({...base,humanShieldDefense:2});assert.equal(p.grade,2);assert.equal(p.listedDefenseBonus,4);assert.equal(p.defenseBonus,3);assert.equal(p.reflexBonus,3);
 p=coverPlan({...base,humanShieldDefense:4});assert.equal(p.defenseBonus,2);
 p=coverPlan({...base,opponentConfirmed:false,humanShieldDefense:4});assert.equal(p.grade,3);assert.equal(p.defenseBonus,4);assert.equal(p.precisionReduction,0);
 p=coverPlan({...options,attackerSystem:{...source,classLevels:{counterterrorist:7}},personalCover:2,sceneryCover:1,humanShieldDefense:0});assert.equal(p.grade,0);assert.equal(p.defenseBonus,0);
});
test('unconfirmed, malformed or impossible human-shield components cannot invent cover or remove more Defense than remains',()=>{
 const base={precisionAttackerSystem:{classLevels:{counterterrorist:4}},personalCover:2,sceneryCover:1,opponentConfirmed:true,humanShieldConfirmed:true};
 for(const value of [-1,5,1.5,'2',null,Infinity])assert.throws(()=>coverPlan({...base,humanShieldDefense:value}),/remaining human-shield/);
 assert.throws(()=>coverPlan({...base,humanShieldDefense:2,humanShieldConfirmed:false}),/GC must confirm/);
 assert.throws(()=>coverPlan({...base,humanShieldDefense:2,personalCover:0}),/remaining human-shield/);
 assert.throws(()=>coverPlan({...options,attackerSystem:{...source,classLevels:{counterterrorist:7}},personalCover:2,sceneryCover:1,humanShieldDefense:2,humanShieldConfirmed:true}),/remaining human-shield/);
});
test('actual preview uses the selected current Safe Attack source and records the GC component without changing the target',async()=>{
 const request={personalCover:'2',sceneryCover:'1',precisionAttacker:'shooter',coverOpponent:true,humanShieldDefense:'2',humanShieldConfirmed:true};
 setup(request);attacker.system.classLevels={counterterrorist:4};const before=structuredClone(target.system),p=await checkIncomingDefense(target);assert.equal(p.total,18);assert.equal(p.cover.safeAttackReduction,1);assert.match(dialogs[1].content,/Safe Attack:/);assert.deepEqual(target.system,before);
 setup(request);attacker.system.classLevels={counterterrorist:4};hook=()=>{attacker.system.classLevels.counterterrorist=3;};const lost=await checkIncomingDefense(target);assert.equal(lost.total,19);assert.equal(lost.cover.safeAttackReduction,0);
 for(const patch of [{humanShieldDefense:'5'},{humanShieldDefense:'2.5'},{humanShieldConfirmed:false}]){setup({...request,...patch});attacker.system.classLevels={counterterrorist:4};assert.equal(await checkIncomingDefense(target),null);assert.equal(warnings.length,1);}
});
