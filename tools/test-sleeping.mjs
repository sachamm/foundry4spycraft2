import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {conditionAbilityPenalty} from '../module/rules/attributes.mjs';import {computeAgent} from '../module/rules/engine.mjs';import {resolveSkillCheck} from '../module/rules/skills.mjs';import {resolveKnowledgeCheck} from '../module/rules/knowledge.mjs';import {weaponAttack,weaponDamage} from '../module/rules/gear.mjs';import {SPYCRAFT as cfg} from '../module/config.mjs';
const defs=JSON.parse(readFileSync(new URL('../src/data/classes.json',import.meta.url))),equipment=JSON.parse(readFileSync(new URL('../src/data/equipment.json',import.meta.url))),keys=['str','dex','con','int','wis','cha'],items=['soldier','schemer'].map(key=>{const c=defs.find(c=>c.key===key);return {id:key,name:c.name,type:'class',system:{...c,identifier:key,vitalityDie:c.vitality}};}),source=()=>({conditionContext:{},abilities:Object.fromEntries(keys.map(key=>[key,{base:14}])),progression:[...Array.from({length:4},()=>({classId:'soldier',vitality:6,skills:{}})),...Array.from({length:4},()=>({classId:'schemer',vitality:6,skills:{}}))],actionDice:{value:0},vitality:{value:4},wounds:{value:4}}),compute=(conditions={})=>computeAgent({...source(),conditionContext:conditions},structuredClone(items),cfg),opts={gearStatus:'available',synergySkill:'none',trackingSurface:'verySoft'};

import {attributeActionBlock} from '../module/rules/attributes.mjs';
import {incomingDefensePlan} from '../module/rules/defense.mjs';
import {sensoryTargetPlan,baseSensoryRanges} from '../module/rules/senses.mjs';
test('Sleeping allows passive actions only, with stronger incapacities and paralysis still enforced',()=>{
 const s=compute({sleeping:true});assert.match(attributeActionBlock(s),/Sleeping/);assert.equal(attributeActionBlock(s,{passiveAction:true}), '');
 for(const condition of ['dead','unconscious','stunned','dazed'])assert.match(attributeActionBlock({...s,conditionContext:{sleeping:true,[condition]:true}},{passiveAction:true}),/no actions/);
 assert.match(attributeActionBlock({...s,conditionContext:{sleeping:true,paralyzed:true}},{passiveAction:true,ability:'dex'}),/Paralyzed/);
 assert.equal(attributeActionBlock({...s,conditionContext:{sleeping:'true'}}),'');
});
test('every named skill and alternate attribute respects its final mode while asleep',()=>{
 const a=compute(),b=compute({sleeping:true});let passive=0,deliberate=0;
 for(const [key,skill]of Object.entries(cfg.skills))for(const check of skill.checks)for(const ability of check.attributes){
 const x=resolveSkillCheck(a,key,check,{...opts,ability}),y=resolveSkillCheck(b,key,check,{...opts,ability});
 if(check.mode.includes('Passive')){passive++;assert.ok(!y.blockedReason.includes('Sleeping:'),key+'/'+check.id);assert.equal(y.actionDiceAllowed,false);assert.equal(y.rollMode,'blindroll');}
 else {deliberate++;assert.ok(y.blockedReason.includes('Sleeping:'),key+'/'+check.id);}
 assert.equal(y.total,x.total-(check.tags.includes('Vision')?8:0),key+'/'+check.id);
 assert.equal(y.cap,x.cap===null?null:Math.max(0,x.cap-(check.tags.includes('Vision')?20:0)),key+'/'+check.id);
 }assert.ok(passive>=8);assert.ok(deliberate>80);
});
test('converting passive checks to active checks blocks them, with core Awareness explicitly pending',()=>{
 const s=compute({sleeping:true}),check=cfg.skills.notice.checks.find(c=>c.id==='awareness');
 assert.match(resolveSkillCheck(s,'notice',check,{...opts,hailMaryActive:true}).blockedReason,/Sleeping:/);
 for(const core of ['fieldAnalyst','guide']){const p=resolveSkillCheck({...s,coreClassIds:[core]},'notice',check,opts);assert.equal(p.sleepingCoreReview,true);assert.equal(p.mode,'Active');assert.match(p.blockedReason,/pending GC ruling/);}
 const passive=cfg.skills.resolve.checks.find(c=>c.mode==='Passive');assert.match(resolveSkillCheck(s,'resolve',passive,{...opts,cunningPlan:true}).blockedReason,/deliberate action/);
});
test('ordinary passive Knowledge remains available while Photographic Memory and separate deliberate options are blocked',()=>{
 const s=compute({sleeping:true});assert.equal(resolveKnowledgeCheck(s,{skill:'analysis'}).blocked,false);
 for(const options of [{active:true},{method:'take10',safeToTake:true},{method:'take20',safeToTake:true},{cunningPlan:true},{tenSecondSolution:true,standaloneCheckConfirmed:true}])assert.match(resolveKnowledgeCheck({...s,activeFeatNames:['Photographic Memory']},{skill:'analysis',...options}).blockedReason,/Sleeping:/);
});
test('Sleeping inherits blindness and helplessness without adding a persistent Blinded condition or changing resources',()=>{
 const a=compute(),s=compute({sleeping:true});assert.notEqual(s.conditionContext.blinded,true);assert.equal(baseSensoryRanges(s).blinded,true);assert.equal(sensoryTargetPlan(s).blinded,true);
 assert.equal(s.speed,0);assert.equal(s.canRun,false);assert.equal(s.conditionSpeedReview,false);assert.equal(s.defense.dexterity,0);
 const far=incomingDefensePlan(s),near=incomingDefensePlan(s,{withinMeleeRange:true});assert.equal(far.blindedAttackerBonus,2);assert.equal(far.helpless,true);assert.equal(far.helplessAttackerBonus,0);assert.equal(near.attackerBonus,6);
 for(const key of keys)assert.equal(s.abilities[key].value,a.abilities[key].value);assert.equal(s.actionDice.value,a.actionDice.value);assert.equal(s.vitality.value,a.vitality.value);assert.equal(s.wounds.value,a.wounds.value);
 const overlap=compute({sleeping:true,blinded:true,entangled:true});assert.equal(overlap.speed,0);assert.equal(overlap.conditionSpeedReview,false);
 const night={...s,activeFeatNames:['Night Training']};assert.equal(sensoryTargetPlan(night,{targetCharacter:true,distanceFeet:10}).blinded,false);assert.equal(sensoryTargetPlan({...night,conditionContext:{sleeping:true,deafened:true}},{targetCharacter:true,distanceFeet:10}).blinded,true);
});
test('all catalog attacks are blocked while sleeping without changing their damage calculation',()=>{
 const a=compute(),s=compute({sleeping:true});let count=0;for(const w of equipment.weapons){const p=weaponAttack(s,w,cfg,'agent');assert.equal(p.blocked,true,w.name);const x=weaponDamage(a,w),y=weaponDamage(s,w);if(x?.formula&&y?.formula)assert.equal(y.bonus,x.bonus,w.name);count++;}assert.equal(count,458);
});
