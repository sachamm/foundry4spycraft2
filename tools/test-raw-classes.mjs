import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
const classes=JSON.parse(readFileSync(new URL("../src/data/classes.json",import.meta.url)));
const reference=JSON.parse(readFileSync(new URL("./fixtures/raw/classes-reference.json",import.meta.url)));
const item = cls => ({id:cls.key,name:cls.name,type:"class",system:{...structuredClone(cls),identifier:cls.key,vitalityDie:cls.vitality,choices:{}}});
function compute(cls, level, choices={}) {
 const doc=item(cls);doc.system.choices=choices;
 const sys={abilities:Object.fromEntries(["str","dex","con","int","wis","cha"].map(k=>[k,{base:10,misc:0}])),progression:Array.from({length:level},()=>({classId:cls.key,vitality:1,skills:{}})),skills:{},focuses:{},proficiencies:{},misc:{}};
 return computeAgent(sys,[doc],cfg);
}

test("RAW Tables 1.4–1.15,1.19–1.36: all 420 class rows and their derived base totals",()=>{
 assert.equal(Object.keys(reference).length,30);
 assert.equal(classes.reduce((n,c)=>n+c.table.length,0),420);
 for(const cls of classes) {
  const source=reference[cls.name];
  assert.equal(source.table.length,cls.table.length,cls.name);
  for(const expected of source.table) {
   const {abilities,...row}=expected;
   assert.deepEqual(cls.table.find(r=>r.level===row.level),row,`${cls.name} L${row.level}, p.${source.page}`);
   const sys=compute(cls,row.level);
   for(const key of ["bab","fort","ref","will","defense","initiative","wealth"])assert.equal(sys.base[key],row[key],`${cls.name} ${key}`);
  }
 }
});

test("RAW class definitions: all 30 vitality/skill-point rates, class skill lists and 12 starting proficiency counts",()=>{
 for(const cls of classes) {
  const source=reference[cls.name];
  assert.equal(cls.vitality,source.vitality,cls.name);
  assert.equal(cls.skillPoints,source.skillPoints,cls.name);
  assert.deepEqual(cls.classSkills.map(key=>cfg.skills[key].name).sort(),source.classSkills.slice().sort(),cls.name);
  if(!cls.expert)assert.equal(cls.proficiencies,source.proficiencies,cls.name);
 }
});

test("RAW class milestone fixes apply exactly when earned",()=>{
 const sleuth=classes.find(c=>c.name==="Sleuth");
 assert.equal(compute(sleuth,17).abilities.wis.bonus,4);
 assert.equal(compute(sleuth,18).abilities.wis.bonus,5);
 const advocate=classes.find(c=>c.name==="Advocate");
 assert.equal(compute(advocate,5).stressThreshold,15);
 const brawler=classes.find(c=>c.name==="Brawler");
 assert.equal(compute(brawler,3).subdualThreshold,10);
 assert.equal(compute(brawler,4).subdualThreshold,14);
});

test("RAW unique class options cannot duplicate their permanent effects",()=>{
 const cls=classes.find(c=>c.name==="Advocate");
 const option=cls.choiceLists.find(l=>l.key==="smallSteps").options.find(o=>o.name==="Inner Drive");
 const slots=cls.choiceSchedule.map((s,index)=>({...s,index})).filter(s=>s.list==="smallSteps");
 const once=compute(cls,9,{[slots[0].index]:option.index});
 const twice=compute(cls,9,{[slots[0].index]:option.index,[slots[1].index]:option.index});
 assert.equal(twice.vitality.max,once.vitality.max);
 assert.ok(twice.warnings.some(w=>w.includes("Inner Drive") && w.includes("only 1")));
});

test("RAW p.39: Pointman and Schemer expose actual abilities, not class-only placeholders",()=>{
 for(const name of ["Pointman","Schemer"]) {
  const cls=classes.find(c=>c.name===name),list=cls.choiceLists.find(l=>l.kind==="crossClass");
  assert.equal(list.options.length,42);
  assert.ok(list.options.every(o=>o.name.includes(":")));
  assert.ok(list.options.some(o=>o.name==="Faceman: Masks"));
  assert.ok(!list.options.some(o=>o.name.includes("backup")));
  const rough=list.options.find(o=>o.name==="Scout: Rough living (+1)");
  const slot=cls.choiceSchedule.findIndex(s=>s.list===list.key);
  const level=cls.choiceSchedule[slot].level;
  assert.equal(compute(cls,level,{[slot]:rough.index}).defense.total,compute(cls,level).defense.total+1);
 }
});


test('RAW p.38: Intruder Criminal Mind is offered at all five prose milestones, without reindexing older saved choices',()=>{
 const intruder=classes.find(c=>c.key==='intruder');
 assert.deepEqual(intruder.choiceSchedule.filter(s=>s.list==='criminalMind').map(s=>s.level).sort((a,b)=>a-b),[6,9,12,15,18]);
 assert.equal(intruder.choiceSchedule.at(-1).level,9);assert.equal(intruder.choiceSchedule.at(-1).list,'criminalMind');
 const slot=intruder.choiceSchedule.length-1,option=intruder.choiceLists.find(l=>l.key==='criminalMind').options.find(o=>o.name==='Procure');
 assert.equal(compute(intruder,8,{[slot]:option.index}).classOptionSelections.some(o=>o.name==='Procure'),false);
 assert.equal(compute(intruder,9,{[slot]:option.index}).classOptionSelections.some(o=>o.name==='Procure'&&o.level===9),true);
});
test('all choice-list labels appearing in the independent printed progression fixture have a scheduled choice at that level',()=>{
 const norm=value=>String(value).toLowerCase().replace(/[^a-z0-9]/g,'');
 for(const cls of classes)for(const list of cls.choiceLists??[])for(const row of reference[cls.name].table){
  if(norm(row.abilities).includes(norm(list.name)))assert.ok(cls.choiceSchedule.some(slot=>slot.list===list.key&&slot.level===row.level),`${cls.name} ${list.name} at ${row.level}`);
 }
});
