import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = name => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url)));
const core = read("core"),
  classes = read("classes"),
  origins = read("origins"),
  feats = read("feats"),
  equipment = read("equipment"),
  kits = read("kits");
const allOrigins = [...origins.talents, ...origins.specialties];
const skills = new Set(core.skills.map(s => s.key));
const featNames = new Set(feats.map(f => f.name));
const featTrees = new Set([
  "basicCombat",
  "meleeCombat",
  "rangedCombat",
  "unarmedCombat",
  "chance",
  "chase",
  "covert",
  "gear",
  "basicSkill",
  "advancedSkill",
  "style",
  "terrain",
  "tradecraft"
]);
const typeNames = new Set([
  "all",
  "any",
  "feat",
  "featChoice",
  "featTree",
  "base",
  "level",
  "ability",
  "skill",
  "proficiency",
  "focus",
  "lifestyle",
  "keySkill",
  "sneakAttack",
  "never",
  "unknown",
  "manual"
]);
const attributes = new Set(["str", "dex", "con", "int", "wis", "cha"]);
const proficiencies = new Set([
  "unarmed",
  "blunt",
  "exoticBlunt",
  "edged",
  "exoticEdged",
  "explosives",
  "guided",
  "handgun",
  "hurled",
  "exoticHurled",
  "indirectFire",
  "rifle",
  "shotgun",
  "submachineGun",
  "tactical",
  "vehicleWeapon"
]);

function unique(items, name) {
  assert.equal(new Set(items).size, items.length, `duplicate ${name}`);
}
function checkReq(node, context) {
  if (!node) return;
  assert.ok(typeNames.has(node.type), `${context}: unsupported prerequisite ${node.type}`);
  if (["all", "any"].includes(node.type)) {
    assert.ok(Array.isArray(node.of) && node.of.length > 0, `${context}: empty condition`);
    return node.of.forEach(n => checkReq(n, context));
  }
  if (node.type === "sneakAttack")
    assert.ok(Number.isSafeInteger(node.min) && node.min > 0, `${context}: invalid sneak attack dice prerequisite`);
  if (node.type === "featChoice")
    assert.ok(
      featNames.has(node.name) && typeof node.choice === "string" && node.choice.trim(),
      `${context}: invalid chosen-feat prerequisite`
    );
  if (node.type === "feat") assert.ok(featNames.has(node.name), `${context}: unknown feat ${node.name}`);
  if (node.type === "featTree") assert.ok(featTrees.has(node.tree), `${context}: unknown feat tree ${node.tree}`);
  if (node.type === "skill") assert.ok(skills.has(node.key), `${context}: unknown skill ${node.key}`);
  if (node.type === "ability") assert.ok(attributes.has(node.key), `${context}: unknown ability ${node.key}`);
  if (node.type === "proficiency")
    assert.ok(proficiencies.has(node.key), `${context}: unknown proficiency ${node.key}`);
}
function checkBonus(b, context) {
  assert.equal(typeof b.target, "string", `${context}: bonus target`);
  assert.ok(
    /^(abilities\.(str|dex|con|int|wis|cha)|skills\.[a-zA-Z]+\.(misc|threat|baseThreat|cap|classSkill|errorReduction|maxRanks)|(?:saves|baseSave)\.(fort|ref|will)|featSlots\.[a-zA-Z]+|(?:focus|focusForte)\.[a-zA-Z]+|prof\.[a-zA-Z]+|actionDice\.(count|bonus)|[a-zA-Z]+)$/.test(
      b.target
    ),
    `${context}: malformed bonus target ${b.target}`
  );
  assert.ok(typeof b.value === "string" || typeof b.value === "number", `${context}: bonus value`);
}

unique(
  classes.map(c => c.key),
  "class ID"
);
unique(
  classes.map(c => c.name),
  "class name"
);
unique(
  feats.map(f => f.name),
  "feat name"
);
unique(
  allOrigins.map(o => o.name),
  "origin name"
);
for (const cls of classes) {
  assert.ok(cls.table?.length, `${cls.name}: empty class table`);
  cls.table.forEach((r, i) => assert.equal(r.level, i + 1, `${cls.name}: class table skips level ${i + 1}`));
  (cls.classSkills ?? []).forEach(k => assert.ok(skills.has(k), `${cls.name}: class skill ${k}`));
  (cls.bonuses ?? []).forEach(b => checkBonus(b, cls.name));
  checkReq(cls.requirements, `class ${cls.name}`);
  const choices = new Set((cls.choiceLists ?? []).map(c => c.key));
  for (const slot of cls.choiceSchedule ?? [])
    assert.ok(choices.has(slot.list), `${cls.name}: invalid choice list ${slot.list}`);
  for (const grant of cls.featGrants ?? [])
    assert.ok(featNames.has(grant.feat), `${cls.name}: unknown granted feat ${grant.feat}`);
}
for (const feat of feats) {
  checkReq(feat.prerequisites, `feat ${feat.name}`);
  (feat.bonuses ?? []).forEach(b => checkBonus(b, feat.name));
}
for (const origin of allOrigins) {
  for (const grant of origin.grants ?? [])
    assert.ok(featNames.has(grant.feat), `${origin.name}: unknown grant ${grant.feat}`);
  (origin.bonuses ?? []).forEach(b => checkBonus(b, origin.name));
}
assert.ok(equipment.weapons.length > 0 && equipment.armor.length > 0);
console.log(
  `Data integrity: ${classes.length} classes, ${feats.length} feats, ${allOrigins.length} origins, ${equipment.weapons.length} weapons, ${equipment.armor.length} armor.`
);

unique(
  kits.map(k => k.name),
  "kits"
);
assert.equal(kits.length, 48);
for (const kit of kits) {
  assert.ok([1, 2, 3].includes(kit.grade));
  assert.equal(typeof kit.nonPortable, "boolean");
  assert.ok(kit.nonPortable ? kit.weight === null : Number.isFinite(kit.weight) && kit.weight > 0);
  assert.ok([213, 214, 215].includes(kit.sourcePage));
  assert.ok(kit.contents && kit.kitType);
}
console.log(
  `Kit integrity: ${kits.length} records, all three grades across ${new Set(kits.map(k => k.kitType)).size} kit types.`
);

const ammunition = read("ammunition");
assert.equal(ammunition.length, 63);
unique(
  ammunition.map(a => a.id),
  "ammunition IDs"
);
for (const a of ammunition) {
  assert.ok(["arrowBolt", "bullet", "shell", "grenade", "mortar", "rocket"].includes(a.family));
  assert.ok(Number.isFinite(a.unitWeight) && a.unitWeight > 0);
  assert.ok(Number.isSafeInteger(a.upgradeCost) && a.upgradeCost > 0);
  assert.ok(a.commonItemCost === null || (Number.isSafeInteger(a.commonItemCost) && a.commonItemCost > 0));
  assert.ok([274, 275].includes(a.sourcePage));
  assert.equal(typeof a.firstStockpile, "boolean");
  assert.ok(a.fixedStockpileSize === null || (Number.isSafeInteger(a.fixedStockpileSize) && a.fixedStockpileSize > 0));
}
console.log(`Ammunition reference integrity: ${ammunition.length} rows across six families.`);

// Gear pick tables other than weapons and armor, and vehicles. Detailed checks live in tools/test-vehicles.mjs.
const gear = read("gear"),
  vehicles = read("vehicles");
const gearLists = { electronics: "E", gadgets: "G", resources: "R", security: "S", tradecraft: "T" };
for (const [list, category] of Object.entries(gearLists)) {
  assert.ok(Array.isArray(gear[list]) && gear[list].length > 0, `gear.${list} is empty`);
  assert.ok(gear.categories[category], `gear category ${category} has no table reference`);
  for (const row of gear[list])
    assert.ok(
      row.name && row.category === category && Number.isSafeInteger(row.sourcePage),
      `gear.${list}: ${row.name}`
    );
}
const vehicleClasses = new Set(vehicles.classes.map(c => c.code));
assert.equal(vehicleClasses.size, 12);
for (const v of vehicles.vehicles)
  assert.ok(v.name && vehicleClasses.has(v.vehicleClass) && Number.isSafeInteger(v.sourcePage), `vehicle: ${v.name}`);
for (const c of vehicles.classes)
  for (const code of c.damageLocations) assert.ok(vehicles.damageLocations[code], `vehicle damage location ${code}`);
console.log(
  `Gear integrity: ${Object.keys(gearLists)
    .map(l => gear[l].length)
    .reduce((a, b) => a + b)} picks across five categories, ${gear.housings.length} gadget housings.`
);
console.log(
  `Vehicle integrity: ${vehicles.vehicles.length} vehicles in ${vehicleClasses.size} categories, ${vehicles.upgrades.length} upgrades, ${vehicles.weapons.length} vehicle weapon rows.`
);
