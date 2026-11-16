// These fixtures supply required gear unless a case explicitly overrides gearStatus; absence/kit boundaries are tested in test-skill-gear.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SPYCRAFT as cfg} from '../module/config.mjs';
import {computeAgent} from '../module/rules/engine.mjs';
import {classSkillSelections} from '../module/rules/class-skills.mjs';
import {resolveSkillCheck} from '../module/rules/skills.mjs';
const classes=JSON.parse(readFileSync(new URL('../src/data/classes.json',import.meta.url)));
const doc=key=>{const c=structuredClone(classes.find(c=>c.key===key));return {id:key,name:c.name,type:'class',system:{...c,identifier:key,vitalityDie:c.vitality}};};
function compute(items,sequence,skills={}){
 const sys={abilities:Object.fromEntries(['str','dex','con','int','wis','cha'].map(k=>[k,{base:10}])),progression:sequence.map((classId,index)=>({classId,vitality:1,skills:skills[index]??{}})),skills:{},focuses:{},proficiencies:{},misc:{}};
 return computeAgent(sys,items,cfg);
}
function chooseMastery(item){
 const list=item.system.choiceLists.find(list=>list.options.some(o=>o.name==='Skill Mastery'));
 const index=item.system.choiceSchedule.findIndex(slot=>slot.list===list.key);
 item.system.choices={[index]:list.options.find(o=>o.name==='Skill Mastery').index};
 return {index,level:item.system.choiceSchedule[index].level,key:`choice${index}`};
}

test('RAW pp.35–52: all eight Skill Mastery class options require a target and apply their error minimum/time rule',()=>{
 for(const key of ['faceman','hacker','intruder','scientist','scout','sleuth','snoop','wheelman']){
  const item=doc(key),selection=chooseMastery(item),sequence=Array(selection.level).fill(key);
  const empty=compute([item],sequence);
  assert.ok(empty.todo.some(row=>row.text.includes('Skill Mastery')&&row.text.includes('choose a skill')),key);
  const skill=item.system.classSkills[0];
  item.system.skillChoices={[selection.key]:skill};
  const sys=compute([item],sequence,{0:{[skill]:1}}),derived=sys.skillTotals[skill];
  assert.equal(derived.errorReduction,2,key);assert.equal(derived.errorFloor,1,key);assert.equal(derived.take10TimeMultiplier,1,key);
  const check=cfg.skills[skill].checks[0],roll=resolveSkillCheck(sys,skill,check,{gearStatus:'available'});
  assert.equal(roll.error,Math.max(Math.min(check.error,1),check.error-2),key);assert.equal(roll.take10TimeMultiplier,1,key);
  assert.ok(!sys.todo.some(row=>row.text.includes('choose a skill for Skill Mastery')),key);
 }
});

test('RAW p.31/64: By Any Means class skills start at acquisition and apply only to Advocate level purchases',()=>{
 const advocate=doc('advocate');advocate.system.skillChoices={byAnyMeans4:'acrobatics'};
 const sequence=['advocate','advocate','advocate','soldier','advocate','soldier'];
 const sys=compute([advocate,doc('soldier')],sequence,{0:{acrobatics:2},3:{acrobatics:2},4:{acrobatics:1},5:{acrobatics:2}});
 assert.equal(sys.skillTotals.acrobatics.ranks,4);
 assert.equal(sys.skillPoints[0].classSkills.includes('acrobatics'),false);
 assert.equal(sys.skillPoints[3].classSkills.includes('acrobatics'),false);
 assert.equal(sys.skillPoints[4].classSkills.includes('acrobatics'),true);
 assert.equal(sys.skillPoints[5].classSkills.includes('acrobatics'),false);
 assert.equal(sys.classSkillRules[0].career,5);
 const before=compute([advocate],Array(3).fill('advocate'));
 assert.equal(before.classSkillRules.length,0);assert.equal(before.skillTotals.acrobatics.errorReduction,0);
});

test('RAW p.31: all five By Any Means milestones require distinct skills; future and invalid selections have no effect',()=>{
 const advocate=doc('advocate');
 assert.deepEqual(classSkillSelections(advocate,20).map(row=>row.level),[4,8,12,16,20]);
 advocate.system.skillChoices={byAnyMeans4:'acrobatics',byAnyMeans8:'acrobatics',byAnyMeans12:'missing'};
 const sys=compute([advocate],Array(12).fill('advocate'));
 assert.equal(sys.classSkillRules.length,1);
 assert.ok(sys.warnings.some(w=>w.includes('cannot select')&&w.includes('more than once')));
 assert.ok(sys.warnings.some(w=>w.includes('unknown skill')));
});

test('RAW p.29: same-named Skill Mastery benefits from two classes do not stack',()=>{
 const a=doc('faceman'),b=doc('hacker'),as=chooseMastery(a),bs=chooseMastery(b);
 const skill=a.system.classSkills.find(key=>b.system.classSkills.includes(key));assert.ok(skill);
 a.system.skillChoices={[as.key]:skill};b.system.skillChoices={[bs.key]:skill};
 const sys=compute([a,b],[...Array(as.level).fill('faceman'),...Array(bs.level).fill('hacker')]);
 assert.equal(sys.classSkillRules.length,2);assert.equal(sys.skillTotals[skill].errorReduction,2);assert.equal(sys.skillTotals[skill].errorFloor,1);
});

test('Skill Mastery rejects a skill belonging only to another class',()=>{
 const item=doc('faceman'),selection=chooseMastery(item);
 const invalid=Object.keys(cfg.skills).find(key=>!item.system.classSkills.includes(key));
 item.system.skillChoices={[selection.key]:invalid};
 const sys=compute([item,doc('soldier')],['soldier',...Array(selection.level).fill('faceman')]);
 assert.equal(sys.classSkillRules.length,0);assert.ok(sys.warnings.some(w=>w.includes("requires one of that class's skills")));
});


test("Skill Mastery accepts universal class skills only when available at acquisition",()=>{
 const item=doc('faceman'),selection=chooseMastery(item);
 const key=Object.keys(cfg.skills).find(key=>!item.system.classSkills.includes(key));
 item.system.skillChoices={[selection.key]:key};
 const bonus={target:`skills.${key}.classSkill`,value:'1'};
 const early={id:'early',name:'Early Training',type:'feat',system:{granted:true,acquiredAtLevel:1,bonuses:[bonus]}};
 const sequence=Array(selection.level+1).fill('faceman');
 assert.equal(compute([item,early],sequence).classSkillRules.length,1);
 const late={...early,id:'late',system:{...early.system,acquiredAtLevel:selection.level+1}};
 const invalid=compute([item,late],sequence);
 assert.equal(invalid.classSkillRules.length,0);
 assert.ok(invalid.warnings.some(w=>w.includes("requires one of that class's skills at acquisition")));
});


test('restored out-of-array-order milestones keep their saved index but earlier Skill Mastery wins duplicate selection',()=>{
 const intruder=classes.find(c=>c.key==='intruder');
 const mastery=intruder.choiceLists.find(l=>l.key==='criminalMind').options.find(o=>o.name==='Skill Mastery');
 const early=intruder.choiceSchedule.findIndex(s=>s.list==='criminalMind'&&s.level===9),later=intruder.choiceSchedule.findIndex(s=>s.list==='criminalMind'&&s.level===12);
 const doc={id:'intruder',type:'class',name:'Intruder',system:{...intruder,identifier:'intruder',choices:{[early]:mastery.index,[later]:mastery.index}}};
 const fields=classSkillSelections(doc,12).filter(f=>f.name==='Skill Mastery');assert.equal(fields.length,1);assert.equal(fields[0].level,9);assert.equal(fields[0].key,`choice${early}`);
});
