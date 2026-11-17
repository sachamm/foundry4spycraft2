import {fileURLToPath} from 'node:url';import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {ClassicLevel} from 'classic-level';import {firearmDefaults} from '../module/rules/firearms.mjs';
const source=JSON.parse(readFileSync(new URL('../src/data/equipment.json',import.meta.url)));
async function items(name){const db=new ClassicLevel(process.env.SPYCRAFT_PACKS_DIR?`${process.env.SPYCRAFT_PACKS_DIR}/${name}`:fileURLToPath(new URL(`../packs/${name}`,import.meta.url)),{valueEncoding:'json',createIfMissing:false});await db.open();try{const docs=[];for await(const [key,value] of db.iterator())if(key.startsWith('!items!'))docs.push(value);return docs;}finally{await db.close();}}
test('rebuilt weapon pack retains every source record, complete bundle/stockpile weights and firing metadata',async()=>{
 const docs=await items('weapons');assert.equal(docs.length,458);
 for(const item of source.weapons){const doc=docs.find(d=>d.name===item.name);assert.ok(doc,item.name);const s=doc.system,expected=firearmDefaults(item.sourceTable,item.qualities);
  assert.equal(s.assemblyHalfActions,item.assemblyHalfActions??0,item.name);assert.equal(s.ammoChamber,item.ammoChamber??"",item.name);assert.deepEqual(s.ammoCodeOptions,item.ammoCodeOptions??[],item.name);assert.equal(s.mountRequirement,item.mountRequirement??"",item.name);assert.equal(s.range,item.range,item.name);assert.equal(s.upgradeAllowance,item.upgradeAllowance??null,item.name);assert.equal(s.quantity,item.ammunitionOnly?1:item.bundleSize??1,item.name);assert.equal(s.bundleSize,item.bundleSize??1,item.name);assert.equal(s.pickCount,1,item.name);
  assert.equal(s.weight,item.weight*(item.ammunitionOnly?item.stockpileSize:1),item.name);assert.equal(s.maxRangeIncrements,item.maxRangeIncrements??0,item.name);assert.equal(s.weaponCategory,expected.weaponCategory,item.name);assert.deepEqual(s.fireModes,item.fireModes??expected.fireModes,item.name);
  if(item.ammunitionOnly){assert.equal(s.caliber,0);assert.equal(s.shotWeight,item.weight);assert.equal(s.stockpileSize,item.stockpileSize);assert.equal(s.upgradeCost,item.upgradeCost);assert.equal(s.commonItemCost,item.commonItemCost);}
 }
 assert.equal(docs.find(d=>d.name==='Colt M16A2/A4 5.56mm NATO')._id,'F0mAKS8BeVZITib7');assert.equal(docs.find(d=>d.name==='Chain, combo')._id,'UwK9H9znJ6FLfqIT');
});
test('rebuilt class pack contains the appended Intruder choice with stable earlier schedule indices',async()=>{
 const docs=await items('classes');assert.equal(docs.length,30);const intruder=docs.find(d=>d.system.identifier==='intruder');assert.equal(intruder.system.choiceSchedule[13].level,9);assert.equal(intruder.system.choiceSchedule[13].list,'criminalMind');
 assert.deepEqual(intruder.system.choiceSchedule.filter(s=>s.list==='criminalMind').map(s=>s.level).sort((a,b)=>a-b),[6,9,12,15,18]);
});

test('rebuilt feat pack enforces all five numeric sneak-dice prerequisites without the old manual waiver',async()=>{
 const docs=await items('feats'),expected={'Bludgeon':1,'Whack':3,'Deadly Precision':2,'Crippling Strike':3,'Executioner':1},leaves=n=>n.of?n.of.flatMap(leaves):[n];for(const [name,min] of Object.entries(expected)){const d=docs.find(d=>d.name===name);assert.ok(d,name);assert.equal(d.system.prerequisitesNotChecked,false);assert.ok(leaves(d.system.prerequisites).some(n=>n.type==='sneakAttack'&&n.min===min));assert.equal(leaves(d.system.prerequisites).some(n=>n.type==='manual'),false);}
});

test('rebuilt feat pack retains exact category/focus prerequisites for all seven former manual conditions',async()=>{
 const docs=await items('feats'),choices={'Electronic Warrior':'Electronics','Micro-miniaturized':'Gadgets','Trap Master':'Security'},focuses={'Firefighter Training':'Engineering','Cryptographer':'Mathematics','Disease Basics':'Genetics','Poison Basics':'Pharmacology'},leaves=n=>n.of?n.of.flatMap(leaves):[n];for(const [name,choice] of Object.entries(choices)){const d=docs.find(d=>d.name===name);assert.equal(d.system.prerequisitesNotChecked,false);assert.ok(leaves(d.system.prerequisites).some(n=>n.type==='featChoice'&&n.name==='Extra Gear'&&n.choice===choice));}for(const [name,focus] of Object.entries(focuses)){const d=docs.find(d=>d.name===name);assert.equal(d.system.prerequisitesNotChecked,false);assert.ok(leaves(d.system.prerequisites).some(n=>n.type==='focus'&&n.skill==='science'&&n.group===focus));}
});

test('rebuilt kit pack retains all forty-eight grades, source weight/size/location distinctions and minimum Calibers without a forced pick category',async()=>{
 const kits=JSON.parse(readFileSync(new URL('../src/data/kits.json',import.meta.url))),docs=await items('kits');assert.equal(docs.length,48);for(const kit of kits){const doc=docs.find(d=>d.name===kit.name);assert.ok(doc,kit.name);assert.equal(doc.type,'gear');const s=doc.system;assert.equal(s.kitType,kit.kitType);assert.equal(s.kitGrade,kit.grade);assert.equal(s.caliber,kit.grade);assert.equal(s.kitSize,kit.size);assert.equal(s.weight,kit.weight??0);assert.equal(s.kitNonPortable,kit.nonPortable);assert.equal(s.carried,!kit.nonPortable);assert.equal(s.pick,'');assert.equal(s.gearCategory,'');assert.match(s.source,new RegExp('p\\.'+kit.sourcePage));assert.ok(s.description.includes(kit.contents));}
 const expected={'Appraisal Kit':[5,20,null],'Architect’s Kit':[6,60,100],'Authentication Kit':[10,75,null],'Chemistry Kit':[30,75,null],'Cleaner Kit':[10,30,75],'Climbing Kit':[15,30,180],'Construction Kit':[50,500,2000],'Demolitions Kit':[5,40,60],'Disguise Kit':[20,35,50],'Electronics Kit':[20,200,null],'First Aid Kit':[5,20,80],'Forensics Kit':[10,20,50],'Forgery Kit':[15,30,400],'Lockpicking Kit':[1,25,150],'Mechanics Kit':[30,100,4000],'Surgery Kit':[15,25,200]};assert.deepEqual([...new Set(kits.map(k=>k.kitType))].sort(),Object.keys(expected).sort());for(const [type,weights] of Object.entries(expected))for(let grade=1;grade<=3;grade++){const k=kits.find(k=>k.kitType===type&&k.grade===grade);assert.equal(k.weight,weights[grade-1],type+' '+grade);assert.equal(k.size,type==='Lockpicking Kit'?['Tiny','Small','Medium'][grade-1]:['Small','Medium','Large'][grade-1]);}
});

test('rebuilt QKY weapons retain category base penalties, including COP holdout -6, for exactly one runtime adjustment',async()=>{
 const docs=await items('weapons'),quirky=docs.filter(d=>/\bQKY\b/.test(d.system.qualities)),bases={blunt:-2,edged:-4,exoticBlunt:-6,handgun:-6,shotgun:-4,submachineGun:-4};assert.equal(quirky.length,13);for(const d of quirky)assert.equal(d.system.untrainedPenalty,bases[d.system.proficiency],d.name);assert.equal(quirky.find(d=>d.name==='COP Inc. COP .357 Magnum').system.weaponCategory,'holdoutPistol');
});

test('rebuilt gear, vehicle and vehicle-upgrade packs hold every source row under its own name and id', async () => {
  const read = name => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url)));
  const gear = read('gear'), vehicles = read('vehicles'), upgrades = read('upgrades'), contagions = read('contagions');
  const expected = {
    'equipment-upgrades': upgrades.armor.length + upgrades.weapons.length + upgrades.detonators.length,
    contagions: contagions.contagions.length,
    gear: gear.electronics.length + gear.gadgets.length + gear.resources.length + gear.security.length + gear.tradecraft.length + gear.housings.length,
    vehicles: vehicles.vehicles.length,
    'vehicle-upgrades': vehicles.upgrades.length + vehicles.weapons.length
  };
  for (const [pack, count] of Object.entries(expected)) {
    const docs = await items(pack);
    assert.equal(docs.length, count, pack);
    assert.equal(new Set(docs.map(d => d._id)).size, count, `${pack}: ids`);
    assert.equal(new Set(docs.map(d => d.name)).size, count, `${pack}: names`);
    for (const doc of docs) {
      assert.equal(doc.type, pack === 'vehicles' ? 'vehicle' : 'gear', doc.name);
      assert.match(doc.system.source, /^Spycraft 2\.0 p\.\d+$/, doc.name);
      assert.match(doc.system.sourceTable, /^Table 4\.\d+$/, doc.name);
      assert.ok(doc.folder, doc.name);
    }
  }
  const gearDocs = await items('gear');
  assert.deepEqual([...new Set(gearDocs.map(d => d.system.gearCategory))].sort(), ['E', 'G', 'R', 'S', 'T']);
  const bug = gearDocs.find(d => d.name === 'Bug, audio (Caliber I)');
  assert.equal(bug.system.caliber, 1);
  assert.equal(bug.system.quantity, 4);
  assert.equal(bug.system.damageSave, 2);
  assert.equal(bug.system.sizeHands, 'F/1h');
  const car = (await items('vehicles')).find(d => d.name === 'Car, muscle (modern)');
  assert.equal(car.system.vehicleClass, 'SGV');
  assert.equal(car.system.gearCategory, 'V');
  assert.deepEqual([car.system.acceleration, car.system.turning, car.system.cruiseMph, car.system.topMph, car.system.defense, car.system.damageSave], [6, 5, 70, 150, 9, 8]);
});
