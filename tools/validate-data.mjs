import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = name => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url)));
const core = read("core"), classes = read("classes"), origins = read("origins"),
  feats = read("feats"), equipment = read("equipment");
const allOrigins = [...origins.talents, ...origins.specialties];
const skills = new Set(core.skills.map(s => s.key));
const featNames = new Set(feats.map(f => f.name));
const featTrees = new Set(["basicCombat","meleeCombat","rangedCombat","unarmedCombat","chance","chase",
  "covert","gear","basicSkill","advancedSkill","style","terrain","tradecraft"]);
const typeNames = new Set(["all","any","feat","featTree","base","level","ability","skill",
  "proficiency","focus","lifestyle","keySkill","never","unknown"]);
const attributes = new Set(["str","dex","con","int","wis","cha"]);
const proficiencies = new Set(["unarmed","blunt","exoticBlunt","edged","exoticEdged",
  "explosives","guided","handgun","hurled","exoticHurled","indirectFire","rifle",
  "shotgun","submachineGun","tactical","vehicleWeapon"]);

function unique(items, name) {
  assert.equal(new Set(items).size,items.length,`duplicate ${name}`);
}
function checkReq(node, context) {
  if (!node) return;
  assert.ok(typeNames.has(node.type),`${context}: unsupported prerequisite ${node.type}`);
  if (["all","any"].includes(node.type)) {
    assert.ok(Array.isArray(node.of) && node.of.length > 0,`${context}: empty condition`);
    return node.of.forEach(n=>checkReq(n,context));
  }
  if (node.type==="feat") assert.ok(featNames.has(node.name),`${context}: unknown feat ${node.name}`);
  if (node.type==="featTree") assert.ok(featTrees.has(node.tree),`${context}: unknown feat tree ${node.tree}`);
  if (node.type==="skill") assert.ok(skills.has(node.key),`${context}: unknown skill ${node.key}`);
  if (node.type==="ability") assert.ok(attributes.has(node.key),`${context}: unknown ability ${node.key}`);
  if (node.type==="proficiency") assert.ok(proficiencies.has(node.key),`${context}: unknown proficiency ${node.key}`);
}
function checkBonus(b,context) {
  assert.equal(typeof b.target,"string",`${context}: bonus target`);
  assert.ok(/^(abilities\.(str|dex|con|int|wis|cha)|skills\.[a-zA-Z]+\.(misc|threat|cap|classSkill)|saves\.(fort|ref|will)|featSlots\.[a-zA-Z]+|focus\.[a-zA-Z]+|prof\.[a-zA-Z]+|actionDice\.(count|bonus)|[a-zA-Z]+)$/.test(b.target),`${context}: malformed bonus target ${b.target}`);
  assert.ok(typeof b.value === "string" || typeof b.value === "number",`${context}: bonus value`);
}

unique(classes.map(c=>c.key),"class ID");
unique(classes.map(c=>c.name),"class name");
unique(feats.map(f=>f.name),"feat name");
unique(allOrigins.map(o=>o.name),"origin name");
for (const cls of classes) {
  assert.ok(cls.table?.length,`${cls.name}: empty class table`);
  cls.table.forEach((r,i)=>assert.equal(r.level,i+1,`${cls.name}: class table skips level ${i+1}`));
  (cls.classSkills??[]).forEach(k=>assert.ok(skills.has(k),`${cls.name}: class skill ${k}`));
  (cls.bonuses??[]).forEach(b=>checkBonus(b,cls.name));
  checkReq(cls.requirements,`class ${cls.name}`);
  const choices=new Set((cls.choiceLists??[]).map(c=>c.key));
  for(const slot of cls.choiceSchedule??[])assert.ok(choices.has(slot.list),`${cls.name}: invalid choice list ${slot.list}`);
  for(const grant of cls.featGrants??[])assert.ok(featNames.has(grant.feat),`${cls.name}: unknown granted feat ${grant.feat}`);
}
for(const feat of feats) {
  checkReq(feat.prerequisites,`feat ${feat.name}`);
  (feat.bonuses??[]).forEach(b=>checkBonus(b,feat.name));
}
for(const origin of allOrigins) {
  for(const grant of origin.grants??[])assert.ok(featNames.has(grant.feat),`${origin.name}: unknown grant ${grant.feat}`);
  (origin.bonuses??[]).forEach(b=>checkBonus(b,origin.name));
}
assert.ok(equipment.weapons.length>0 && equipment.armor.length>0);
console.log(`Data integrity: ${classes.length} classes, ${feats.length} feats, ${allOrigins.length} origins, ${equipment.weapons.length} weapons, ${equipment.armor.length} armor.`);
