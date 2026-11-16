import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {SPYCRAFT as cfg} from '../module/config.mjs';import {computeAgent} from '../module/rules/engine.mjs';import {classSkillSelections} from '../module/rules/class-skills.mjs';
const classes=JSON.parse(readFileSync(new URL('../src/data/classes.json',import.meta.url)));
const doc=key=>{const c=structuredClone(classes.find(c=>c.key===key));return {id:key,name:c.name,type:'class',system:{...c,identifier:key,vitalityDie:c.vitality,skillChoices:{}}};};
function compute(items,sequence,skills={}){return computeAgent({abilities:Object.fromEntries(['str','dex','con','int','wis','cha'].map(k=>[k,{base:10}])),progression:sequence.map((classId,index)=>({classId,vitality:1,skills:skills[index]??{}})),skills:{},focuses:{},misc:{}},items,cfg);}

test('RAW pp.39–40,86: Pointman and Virtuoso expose every Versatility milestone with class-specific picks',()=>{
 for(const [key,boundaries] of [['pointman',[[1,4],[4,4],[5,5],[9,5],[10,6],[14,6],[15,7],[19,7],[20,8]]],['virtuoso',[[1,0],[2,2],[6,2],[7,4],[10,4]]]]){
  const item=doc(key);
  for(const [level,count] of boundaries)assert.equal(classSkillSelections(item,level).filter(field=>field.versatility).length,count,`${key} ${level}`);
 }
});

test('Versatility changes only the granting class purchases, without Skill Mastery error/time benefits',()=>{
 const item=doc('pointman');item.system.skillChoices={versatility1_0:'acrobatics'};
 const sequence=['pointman','soldier','pointman'],sys=compute([item,doc('soldier')],sequence,{0:{acrobatics:1},1:{acrobatics:2},2:{acrobatics:1}});
 assert.equal(sys.skillTotals.acrobatics.ranks,3);assert.equal(sys.skillPoints[0].classSkills.includes('acrobatics'),true);assert.equal(sys.skillPoints[1].classSkills.includes('acrobatics'),false);assert.equal(sys.skillPoints[2].classSkills.includes('acrobatics'),true);
 assert.equal(sys.skillTotals.acrobatics.errorReduction,0);assert.equal(sys.skillTotals.acrobatics.take10TimeMultiplier,2);
 assert.equal(sys.classSkillPicks.available,0);
});

test('later Versatility picks do not rewrite earlier ranks; native skills and duplicate picks are rejected',()=>{
 const item=doc('pointman');item.system.skillChoices={versatility5_0:'acrobatics'};
 const sys=compute([item],Array(5).fill('pointman'),{0:{acrobatics:2},4:{acrobatics:1}});
 assert.equal(sys.skillTotals.acrobatics.ranks,2);assert.equal(sys.skillPoints[0].classSkills.includes('acrobatics'),false);assert.equal(sys.skillPoints[4].classSkills.includes('acrobatics'),true);
 item.system.skillChoices={versatility1_0:'acrobatics',versatility1_1:'acrobatics',versatility1_2:'notice'};
 const invalid=compute([item],['pointman']);assert.equal(invalid.classSkillRules.length,1);assert.ok(invalid.warnings.some(w=>w.includes('more than once')));assert.ok(invalid.warnings.some(w=>w.includes('must select a cross-class')));
});
