import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import {
  armorTotals,
  loadTotals,
  weaponRanges,
  weaponAttack,
  weaponDamage,
  equipmentCategory,
  possessionBudget,
  cleanAndPolishedApplies,
  armorGrantPlan,
  armorGrantStatus
} from "../module/rules/gear.mjs";
import { agingEffects } from "../module/rules/bio.mjs";
const equipment = JSON.parse(readFileSync(new URL("../src/data/equipment.json", import.meta.url)));
const reference = JSON.parse(readFileSync(new URL("./fixtures/raw/gear-reference.json", import.meta.url)));
const number = text =>
  Number(
    String(text)
      .replace(/[–−]/g, "-")
      .replaceAll(",", "")
      .match(/[+-]?\d+(?:\.\d+)?/)?.[0] ?? 0
  );
function compute(items = [], patch = {}) {
  const cls = {
    id: "test",
    name: "Test",
    type: "class",
    system: { identifier: "test", table: [{ level: 1, gearW: 2 }], classSkills: [], skillPoints: 4, vitalityDie: 6 }
  };
  const system = {
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 10, misc: 0 }])),
    progression: [{ classId: "test", skills: {}, vitality: 6 }],
    skills: {},
    focuses: {},
    proficiencies: {},
    misc: {},
    ...patch
  };
  return computeAgent(system, [cls, ...items], cfg);
}
const armor = (id, patch = {}) => ({
  id,
  name: id,
  type: "armor",
  system: {
    equipped: true,
    carried: true,
    quantity: 1,
    weight: 0,
    armorType: "P",
    armorSlot: "body",
    damageReduction: 4,
    damageReductionSubdual: 2,
    armorCheck: -1,
    defensePenalty: -2,
    speedPenalty: 0,
    ...patch
  }
});

test("RAW pp.232–276: the original 394 weapons and 37 armor records retain their independent source statistics", () => {
  assert.equal(equipment.weapons.length, 458);
  assert.equal(equipment.armor.length, 37);
  for (const weapon of equipment.weapons.filter(w => !/^Table 4\.5[0-9]:/.test(w.sourceTable))) {
    const row = reference.weapons[weapon.legacyName ?? weapon.name];
    assert.ok(row, weapon.name);
    assert.equal(weapon.damage, row.cells[1], weapon.name);
    assert.equal(weapon.errorThreat, row.cells[2], weapon.name);
    assert.equal(weapon.ammo, row.cells[3], weapon.name);
    assert.equal(weapon.recoil, number(row.cells[4]), weapon.name);
    assert.equal(weapon.sizeHands, row.cells[6], weapon.name);
    assert.equal(weapon.qualities, row.cells[7], weapon.name);
    if (row.caliber) assert.equal(weapon.caliber, row.caliber, weapon.name);
    else {
      assert.equal(weapon.ammunitionOnly, true, weapon.name);
      assert.equal(weapon.caliber, "", weapon.name);
    }
    assert.equal(weapon.weight, number(row.cells[8]), weapon.name);
    assert.equal(weapon.range, number(row.cells[5]), weapon.name);
  }
  for (const item of equipment.armor) {
    const row = reference.armor[item.name];
    assert.ok(row, item.name);
    assert.equal(item.dr, row.cells[2].replace("**", ""), item.name);
    assert.equal(item.defensePenalty, number(row.cells[4]), item.name);
    assert.equal(item.acp, number(row.cells[5]), item.name);
    assert.equal(item.weight, number(row.cells[9]), item.name);
  }
  // Literal source anchors catch accidentally using the old imported DR columns.
  assert.equal(equipment.armor.find(i => i.name === "Corrections vest").dr, "4/2");
  assert.equal(equipment.armor.find(i => i.name === "Duty vest, Class IIA").dr, "1/3");
  assert.equal(equipment.weapons.find(i => i.name === "Brass knuckles").damage, "+1d4–1 (min. 0)");
});

test("RAW pp.233,284: body armor and one helmet stack; helmet ACP affects Vision, not ordinary ACP or Reflex", () => {
  const body = armor("body", { resistances: "FA4" }),
    helmet = armor("helmet", {
      armorSlot: "helmet",
      armorType: "—",
      damageReduction: 1,
      damageReductionSubdual: 2,
      armorCheck: -2,
      defensePenalty: 0,
      visionPenalty: true,
      resistances: "FA2, BN8"
    });
  const result = armorTotals([body, helmet], { checkBonus: 1, partialDefenseBonus: 2 });
  assert.equal(result.armor.dr, 5);
  assert.equal(result.armor.drRanged, 4);
  assert.equal(result.armor.defense, 0);
  assert.equal(result.armor.check, 0);
  assert.equal(result.armor.visionCheck, -2);
  assert.deepEqual(result.armor.resistances, { FA: 6, BN: 8 });
  assert.equal(armorTotals([body, armor("second"), helmet]).warnings.length, 1);
  assert.equal(armorTotals([armor("sealed", { sealed: true }), helmet]).warnings.length, 1);
  assert.equal(armorTotals([armor("moderate", { armorType: "M" })], { partialDefenseBonus: 3 }).armor.defense, -2);
});

test("RAW pp.217–218: all load boundaries include carried quantities and exclude reserves and stored items", () => {
  const carry = { light: 33, medium: 66, heavy: 100, extreme: 200 };
  for (const [weight, load, defense, check, speed] of [
    [33, "Light", 0, 0, 0],
    [34, "Medium", -1, -2, -5],
    [66, "Medium", -1, -2, -5],
    [67, "Heavy", -3, -4, -10],
    [100, "Heavy", -3, -4, -10],
    [101, "Extreme", -6, -6, -20],
    [200, "Extreme", -6, -6, -20],
    [201, "Overloaded", -10, -8, 0]
  ]) {
    const x = loadTotals([{ type: "gear", system: { weight: weight / 2, quantity: 2 } }], carry);
    assert.deepEqual([x.load, x.defense, x.check, x.speed], [load, defense, check, speed]);
  }
  assert.equal(
    loadTotals(
      [
        { type: "gear", system: { weight: 100, carried: false } },
        { type: "weapon", system: { weight: 100, reserve: true } }
      ],
      carry
    ).weight,
    0
  );
  const sys = compute([armor("vest"), { type: "gear", system: { weight: 101 } }], {
    abilities: Object.fromEntries(
      ["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: k === "dex" ? 14 : 10 }])
    )
  });
  assert.equal(sys.defense.total, 4);
  assert.equal(sys.saves.ref.total, -4);
  assert.equal(sys.speed, 10);
  assert.equal(compute([{ type: "gear", system: { weight: 201 } }]).speed, 0);
});

test("RAW pp.250,299: E/T uses the upper error bound and lower threat bound, including absent and relative ranges", () => {
  assert.deepEqual(weaponRanges({ errorThreat: "1–4/19–20" }), { error: 4, threat: 19 });
  assert.deepEqual(weaponRanges({ errorThreat: "1–2/—" }), { error: 2, threat: 0 });
  assert.deepEqual(weaponRanges({ errorThreat: "+1/—" }, { threat: 17 }), { error: 2, threat: 17 });
  const system = compute();
  assert.equal(
    weaponAttack(system, { proficiency: "handgun", untrainedPenalty: -6, errorThreat: "1–2/20" }, cfg).total,
    -6
  );
  assert.equal(
    weaponAttack(
      system,
      { proficiency: "blunt", untrainedPenalty: -2, errorThreat: "1–2/—", qualities: "INA (–2)" },
      cfg
    ).total,
    -4
  );
  const source = equipment.weapons.find(w => w.name === "Colt M16 5.56mm NATO");
  assert.equal(source.untrainedPenalty, -6);
});

test("RAW pp.302,329: melee and nonexplosive hurled damage add Strength; firearms and grenades do not", () => {
  const system = { abilities: { str: { mod: 3 } }, unarmed: { die: 6, extraDice: 1, damageBonus: 5, threat: 17 } };
  assert.equal(weaponDamage(system, { damage: "1d8+1", proficiency: "edged" }).formula, "max(1, 1d8+1 + (3))");
  assert.equal(weaponDamage(system, { damage: "1d6", proficiency: "hurled" }).bonus, 3);
  assert.equal(
    weaponDamage(system, { name: "Fragmentation grenade", damage: "4d10 explosive", proficiency: "hurled" }).bonus,
    0
  );
  assert.equal(weaponDamage(system, { damage: "1d12", proficiency: "handgun" }).bonus, 0);
  assert.equal(
    weaponDamage(system, { damage: "+1d4–1 (min 0)", proficiency: "blunt", qualities: "NKL, SUR" }).formula,
    "max(0, 2d6 + 1d4-1 + (5))"
  );
  assert.equal(weaponDamage(system, { damage: "special" }), null);
});

test("RAW pp.215–219: Wealth ranks stop at ten; Appearance applies to all four skills; Common Items round up", () => {
  for (const [rank, modifier] of [
    [1, -2],
    [2, -1],
    [3, 0],
    [5, 1],
    [7, 2],
    [9, 3],
    [10, 4]
  ]) {
    const sys = compute([], { wealthAllocation: { lifestyle: rank - 1 } });
    for (const key of ["cultures", "impress", "networking", "profession"])
      assert.equal(sys.skillTotals[key].bonus, modifier);
  }
  const capped = compute([], { wealthAllocation: { lifestyle: 20, possessions: 20, spendingCash: 20 } });
  assert.equal(capped.wealth.lifestyle.rank, 10);
  assert.equal(capped.wealth.spendingCash.amount, 10000);
  assert.equal(compute().commonItems.perMission, 4);
});

test("RAW p.219: negative Charisma removes chosen class picks and reserves share the positive Wisdom modifier", () => {
  const abilities = Object.fromEntries(
    ["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: k === "cha" ? 8 : k === "wis" ? 14 : 10 }])
  );
  const sys = compute(
    [{ id: "reserve", type: "gear", system: { reserve: true, common: true, quantity: 3, weight: 20 } }],
    { abilities, gearPickLosses: { W: 1 } }
  );
  assert.equal(sys.gearPicks.W.available, 1);
  assert.equal(sys.reserveCapacity, 2);
  assert.equal(sys.reserveUsed, 3);
  assert.ok(sys.warnings.some(w => w.startsWith("Reserve picks/items:")));
  assert.equal(sys.encumbrance.weight, 0);
});

test("RAW p.61: every age boundary applies noncumulative modifiers; children are Small", () => {
  for (const [age, category, str, int] of [
    [1, "Child", -3, -1],
    [11, "Child", -3, -1],
    [12, "Young Adult", -1, -1],
    [15, "Young Adult", -1, -1],
    [16, "Adult", 0, 0],
    [40, "Adult", 0, 0],
    [41, "Middle Age", -1, 1],
    [59, "Middle Age", -1, 1],
    [60, "Old", -2, 1],
    [79, "Old", -2, 1],
    [80, "Venerable", -3, 1],
    [110, "Venerable", -3, 1]
  ]) {
    const effect = agingEffects(age);
    assert.equal(effect.category, category);
    assert.equal(effect.modifiers.str, str);
    assert.equal(effect.modifiers.int, int);
    const sys = compute([], { details: { age: String(age) } });
    assert.equal(sys.abilities.str.value, 10 + str);
    assert.equal(sys.abilities.int.value, 10 + int);
  }
  const child = compute([], { details: { age: "11" } });
  assert.equal(child.size, "Small");
  assert.equal(child.sizeModifier, 1);
  assert.equal(child.wounds.max, 5);
  assert.equal(child.carry.heavy, 35);
  assert.ok(agingEffects("old").warning);
  assert.equal(agingEffects("").category, "Unspecified");
});

test("RAW p.201: each Training selection gives five one-for-one skill points outside class pools", () => {
  const feat = {
    id: "training",
    name: "Training",
    type: "feat",
    system: { granted: true, trainingSkills: { acrobatics: 3, athletics: 2 } }
  };
  const sys = compute([feat]);
  assert.equal(sys.skillTotals.acrobatics.ranks, 3);
  assert.equal(sys.skillTotals.athletics.ranks, 2);
  assert.equal(sys.skillPoints[0].spent, 0);
  assert.equal(sys.skillPoints[0].available, 16);
  const invalid = compute([{ ...feat, system: { ...feat.system, trainingSkills: { acrobatics: 6 } } }]);
  assert.ok(invalid.warnings.some(w => w.includes("Training: 1 of its 5")));
  assert.ok(invalid.warnings.some(w => w.includes("acquisition-level")));
});

test("RAW p.195: Extra Gear applies one pick in the chosen category", () => {
  const feat = { id: "extra", name: "Extra Gear", type: "feat", system: { granted: true, choice: "Electronics" } };
  assert.equal(compute([feat]).gearPicks.E.available, 1);
});

test("RAW p.284: shield cover remains a bonus when heavier encumbrance replaces body armor penalties", () => {
  const shield = armor("shield", {
    armorSlot: "shield",
    armorType: "—",
    defensePenalty: 3,
    damageReduction: 3,
    damageReductionSubdual: 3,
    armorCheck: -5
  });
  const sys = compute([armor("body"), shield, { type: "gear", system: { weight: 67 } }]);
  assert.equal(sys.armor.defensePenalty, -2);
  assert.equal(sys.armor.defenseBonus, 3);
  assert.equal(sys.defense.armor, 0);
});

test("RAW pp.42,86: Ph.D. choices use the selected class skills and replace smaller maximum-rank increases", () => {
  const classes = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url)));
  const scientist = classes.find(c => c.key === "scientist");
  const cls = {
    id: "scientist",
    type: "class",
    name: "Scientist",
    system: {
      ...scientist,
      identifier: "scientist",
      vitalityDie: scientist.vitality,
      phdSkill: "science",
      phdSkill1: "medicine",
      phdSkill2: "notice"
    }
  };
  for (const level of [1, 2, 10, 11, 18, 19, 20]) {
    const sys = compute([cls], {
      progression: Array.from({ length: level }, () => ({ classId: "scientist", skills: {}, vitality: 1 }))
    });
    assert.equal(sys.skillTotals.science.maxRanks, level + (level >= 2 ? 8 : 3));
    assert.equal(sys.skillTotals.medicine.maxRanks, level + (level >= 11 ? 8 : 3));
    assert.equal(sys.skillTotals.notice.maxRanks, level + (level >= 19 ? 8 : 3));
  }
});

test("RAW pp.189–190: Fortune Favors the Bold upgrades every career band and Lady Luck changes explosion threshold", () => {
  const bold = { id: "bold", name: "Fortune Favors the Bold", type: "feat", system: { granted: true } };
  const smile = { id: "smile", name: "Lady Luck's Smile", type: "feat", system: { granted: true } };
  for (const [level, die, count] of [
    [3, 6, 3],
    [6, 8, 4],
    [11, 10, 5],
    [16, 12, 6],
    [20, 12, 6]
  ]) {
    const sys = compute([bold, smile], {
      progression: Array.from({ length: level }, () => ({ classId: "test", skills: {}, vitality: 1 }))
    });
    assert.equal(sys.actionDice.die, die);
    assert.equal(sys.actionDice.max, count);
    assert.equal(sys.actionDice.explodeAt, die - 1);
  }
});

test("RAW p.48: Soldier Fortunes of War grants DR at exactly levels 2,11,19 and stacks with armor", () => {
  const cls = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))).find(
    c => c.key === "soldier"
  );
  const item = {
    id: "soldier",
    name: "Soldier",
    type: "class",
    system: { ...cls, identifier: "soldier", vitalityDie: cls.vitality }
  };
  for (const [level, dr] of [
    [1, 0],
    [2, 1],
    [10, 1],
    [11, 2],
    [18, 2],
    [19, 3],
    [20, 3]
  ]) {
    const sys = compute([item, armor("vest")], {
      progression: Array.from({ length: level }, () => ({ classId: "soldier", skills: {}, vitality: 1 }))
    });
    assert.equal(sys.naturalDR, dr);
    assert.equal(sys.dr.melee, 4 + dr);
    assert.equal(sys.dr.other, 2 + dr);
  }
});

test("RAW pp.218–219: actual gear categories survive blank legacy weapon and armor fields", () => {
  assert.equal(equipmentCategory({ type: "weapon", system: { gearCategory: "", pick: "CHA" } }), "W");
  assert.equal(equipmentCategory({ type: "armor", system: { pick: "CHA" } }), "S");
  assert.equal(equipmentCategory({ type: "gear", system: { gearCategory: " e " } }), "E");
  assert.equal(equipmentCategory({ type: "gear", system: { pick: "T" } }), "T");
  assert.equal(equipmentCategory({ type: "gear", system: { pick: "CHA" } }), "");
});
test("RAW p.219: all seven Charisma categories are checked for each affiliation, including unclassified imports", () => {
  const abilities = Object.fromEntries(
    ["str", "dex", "con", "int", "wis", "cha"].map(key => [key, { base: key === "cha" ? 14 : 10 }])
  );
  for (const [affiliationType, allowed] of [
    ["faction", ["G", "T", "V", "R"]],
    ["freelance", ["E", "S", "V", "W"]]
  ])
    for (const category of ["E", "G", "R", "S", "T", "V", "W"]) {
      const item = { id: "gear", name: "Category test", type: "gear", system: { pick: "CHA", gearCategory: category } };
      const result = compute([item], { abilities, affiliationType });
      assert.equal(
        result.warnings.some(w => w.includes("Category test: this category is not permitted")),
        !allowed.includes(category),
        affiliationType + ":" + category
      );
    }
  const unclassified = compute([{ id: "gear", name: "Unclassified", type: "gear", system: { pick: "CHA" } }], {
    abilities
  });
  assert.ok(unclassified.warnings.some(w => w.includes("Unclassified: choose a valid equipment category")));
});
test("legacy typed gear cannot bypass Charisma restrictions or spend a mismatched ordinary category pick", () => {
  const abilities = Object.fromEntries(
    ["str", "dex", "con", "int", "wis", "cha"].map(key => [key, { base: key === "cha" ? 14 : 10 }])
  );
  for (const type of ["weapon", "armor"]) {
    const item = { id: "legacy", name: "Legacy", type, system: { pick: "CHA", gearCategory: "" } };
    assert.ok(
      compute([item], { abilities, affiliationType: "faction" }).warnings.some(w =>
        w.includes("Legacy: this category is not permitted")
      )
    );
    assert.ok(
      !compute([item], { abilities, affiliationType: "freelance" }).warnings.some(w =>
        w.includes("Legacy: this category is not permitted")
      )
    );
  }
  assert.ok(
    compute([{ id: "legacy", name: "Weapon", type: "weapon", system: { pick: "E" } }]).warnings.some(w =>
      w.includes("Weapon: a E pick cannot buy W gear")
    )
  );
});

test("visual PDF anchors retain wrapped rows, correct model matches and AP damage annotations across 68 corrected records", () => {
  const corrections = JSON.parse(readFileSync(new URL("./fixtures/raw/gear-pdf-corrections.json", import.meta.url)));
  assert.equal(Object.keys(corrections.weapons).length, 68);
  for (const [name, patch] of Object.entries(corrections.weapons)) {
    const item = equipment.weapons.find(w => w.name === name);
    for (const [field, value] of Object.entries(patch)) assert.equal(item[field], value, `${name}: ${field}`);
  }
  assert.equal(equipment.weapons.find(w => w.name === "Colt M16A2/A4 5.56mm NATO").recoil, 10);
  assert.equal(equipment.weapons.find(w => w.name === "Chain, combo").damage, "1d4+1");
  assert.equal(
    new Set(equipment.weapons.map(w => w.sourceName)).size,
    equipment.weapons.length,
    "Different canonical entries must not accidentally select the same source row"
  );
  for (const item of equipment.weapons) {
    assert.doesNotMatch(item.ammo, /\bor\s*$/i, item.name);
    assert.doesNotMatch(item.qualities, /,\s*$/, item.name);
    assert.equal((item.qualities.match(/\(/g) ?? []).length, (item.qualities.match(/\)/g) ?? []).length, item.name);
    assert.doesNotMatch(item.errorThreat, /AP|subsonic/, item.name);
    assert.doesNotMatch(item.ammo, /AP \d/, item.name);
    assert.doesNotMatch(item.damage, /\b(?:NATO|Russian|ACP|BMG)\b|\dmm\b/i, item.name);
  }
});

test("RAW pp.274–275,319–320: arrow entries are ammunition stockpiles priced in upgrades/Common Items, not independent weapons or Caliber picks", () => {
  for (const [name, shots, upgrades, common] of [
    ["Standard arrow", 30, 1, 3],
    ["Explosive arrow", 4, 3, 9]
  ]) {
    const item = equipment.weapons.find(w => w.name === name);
    assert.equal(item.ammunitionOnly, true);
    assert.equal(item.caliber, "");
    assert.equal(item.stockpileSize, shots);
    assert.equal(item.upgradeCost, upgrades);
    assert.equal(item.commonItemCost, common);
  }
});

test("printed bundle counts survive all named source rows, and depleted inventory does not refund paid mission picks", () => {
  const bundled = equipment.weapons.filter(w => w.bundleSize > 1 && !/^Table 4\.5[0-9]:/.test(w.sourceTable));
  assert.equal(bundled.length, 15);
  for (const weapon of bundled) {
    const raw = reference.weapons[weapon.legacyName ?? weapon.name].cells[0],
      count = Number(raw.match(/\([×x]\s*(\d+)\)/)[1]);
    assert.equal(weapon.bundleSize, count, weapon.name);
  }
  assert.equal(equipment.weapons.find(w => w.name === "Smoke grenade").bundleSize, 5);
  assert.equal(equipment.weapons.find(w => w.name === "Bola").bundleSize, 3);
  const item = {
    id: "bundle",
    name: "Thrown knives",
    type: "weapon",
    system: { proficiency: "hurled", gearCategory: "W", pick: "W", pickCount: 2, bundleSize: 3, quantity: 6 }
  };
  let sys = compute([item]);
  assert.equal(sys.gearPicks.W.spent, 2);
  item.system.quantity = 0;
  sys = compute([item]);
  assert.equal(sys.gearPicks.W.spent, 2);
});

const possession = (id, caliber, patch = {}) => ({
  id,
  name: id,
  type: "gear",
  system: { possessionSource: "wealth", possessionApproved: true, caliber, pickCount: 1, ...patch }
});
test("RAW Table 4.2: all ten Wealth allowances accept exactly their listed picks and reject one extra without losing Caliber limits", () => {
  for (const row of cfg.tables.possessions) {
    const empty = possessionBudget([], row.picks),
      items = Object.entries(empty.available).flatMap(([caliber, count]) =>
        Array.from({ length: count }, (_, i) => possession(`${caliber}-${i}`, Number(caliber)))
      );
    const full = possessionBudget(items, row.picks);
    assert.equal(full.unfunded, 0, `rank ${row.rank}`);
    assert.equal(full.spent, full.total);
    assert.equal(
      Object.values(full.remaining).reduce((a, b) => a + b, 0),
      0
    );
    assert.equal(possessionBudget([...items, possession("extra", 1)], row.picks).unfunded, 1);
  }
});
test("personal picks consume the smallest eligible slots, reserving scarce higher-Caliber slots irrespective of inventory order", () => {
  const items = [possession("small", 1), possession("high", 3), possession("medium", 2)];
  const result = possessionBudget(items, "1/III, 2/II");
  assert.equal(result.unfunded, 0);
  assert.deepEqual(result.assignments.find(a => a.id === "high").slots, [{ caliber: 3, count: 1 }]);
  assert.equal(possessionBudget([possession("too-high", 3)], "5/II").unfunded, 1);
});
test("personal bundles charge paid picks independently of consumption; extra quantities and missing GC approval remain visible", () => {
  assert.equal(possessionBudget([possession("used", 1, { quantity: 0, pickCount: 2 })], "2/I").spent, 2);
  assert.match(
    possessionBudget([possession("excess", 1, { bundleSize: 3, quantity: 4 })], "1/I").warnings.join(" "),
    /exceeds/
  );
  assert.match(
    possessionBudget([possession("not-approved", 1, { possessionApproved: false })], "1/I").warnings.join(" "),
    /GC must approve/
  );
});
test("only explicitly marked Wealth Possessions consume slots; GC grants, unclassified gear and Common Items do not silently share that allowance", () => {
  const result = possessionBudget(
    [
      possession("grant", 5, { possessionSource: "gcGrant" }),
      possession("unknown", 1, { possessionSource: "" }),
      possession("common", 0, { common: true })
    ],
    "2/I"
  );
  assert.equal(result.spent, 0);
  assert.equal(result.unclassified, 1);
  assert.match(result.warnings.join(" "), /separate accounting/);
  const bad = possessionBudget([possession("conflict", 1, { pick: "W" })], "1/I");
  assert.match(bad.warnings.join(" "), /cannot also/);
});
test("the engine exposes personal allowance use and unfunded Caliber warnings on Gear", () => {
  const result = compute([possession("high", 5)]);
  assert.equal(result.wealth.possessions.budget.unfunded, 1);
  assert.ok(result.warnings.some(w => /Possessions pick/.test(w)));
  const weapon = { proficiency: "edged", damage: "1d6", possessionSource: "wealth", possessionApproved: false };
  assert.equal(weaponAttack(result, weapon, cfg).blocked, true);
  assert.equal(weaponDamage(result, weapon).blocked, true);
});

test("unapproved or conflicting Possessions cannot supply equipped armor benefits; approved personal armor works normally", () => {
  const item = {
    id: "personal",
    name: "Personal armor",
    type: "armor",
    system: {
      equipped: true,
      armorSlot: "body",
      damageReduction: 3,
      possessionSource: "wealth",
      possessionApproved: false
    }
  };
  let result = armorTotals([item]);
  assert.equal(result.armor, null);
  assert.match(result.warnings.join(" "), /GC must approve/);
  item.system.possessionApproved = true;
  assert.equal(armorTotals([item]).armor.dr, 3);
  item.system.pick = "S";
  assert.equal(armorTotals([item]).armor, null);
});

test("RAW p.197: Clean and Polished requires the active feat, an approved personal item and confirmed maintenance", () => {
  const system = { activeFeatNames: ["Clean and Polished"] },
    item = { possessionSource: "wealth", possessionApproved: true, cleanAndPolishedReady: true };
  assert.equal(cleanAndPolishedApplies(system, item), true);
  assert.equal(cleanAndPolishedApplies(system, { ...item, possessionSource: "gcGrant" }), true);
  for (const patch of [
    { possessionSource: "" },
    { possessionApproved: false },
    { cleanAndPolishedReady: false },
    { pick: "W" }
  ])
    assert.equal(cleanAndPolishedApplies(system, { ...item, ...patch }), false);
  assert.equal(cleanAndPolishedApplies({}, item), false);
  assert.equal(cleanAndPolishedApplies(system, null), false);
});

test("RAW p.49 Armor Use grants one piece at each of all five grade caps, independently of mission Caliber", () => {
  for (let grade = 1; grade <= 5; grade++) {
    const system = {
      legacyAbilities: { armorUse: { freeArmorCaliber: grade } },
      usagePeriods: { mission: "m.1" },
      missionReserves: { caliber: 1 }
    };
    for (let caliber = 1; caliber <= 5; caliber++) {
      const item = armor("vest", { caliber });
      if (caliber <= grade) {
        const plan = armorGrantPlan(system, [item], { itemId: "vest", intelConfirmed: true });
        assert.equal(plan.record.caliber, caliber);
        assert.equal(plan.record.grade, grade);
        assert.equal(plan.stamp.epoch, "m.1");
      } else
        assert.throws(() => armorGrantPlan(system, [item], { itemId: "vest", intelConfirmed: true }), /Choose owned/);
    }
  }
});
test("Armor Use requires earned grade, Intel confirmation, one piece and unassigned acquisition fields", () => {
  const system = { legacyAbilities: { armorUse: { freeArmorCaliber: 2 } } },
    item = armor("vest", { caliber: 1 });
  assert.throws(() => armorGrantPlan(system, [item], { itemId: "vest" }), /Intel Phase/);
  assert.throws(() => armorGrantPlan({}, [item], { itemId: "vest", intelConfirmed: true }), /earned/);
  for (const patch of [
    { pick: "S" },
    { possessionSource: "wealth" },
    { reserveAcquisition: {} },
    { common: true },
    { reserve: true },
    { quantity: 2 },
    { pickCount: 2 },
    { armorMissionGrant: { epoch: "initial" } },
    { caliber: 0 }
  ])
    assert.throws(() =>
      armorGrantPlan(system, [armor("vest", { caliber: 1, ...patch })], { itemId: "vest", intelConfirmed: true })
    );
  assert.throws(() => armorGrantPlan(system, [{ ...item, type: "gear" }], { itemId: "vest", intelConfirmed: true }));
});
test("Armor Use keeps a used selection after gear deletion or depletion and permits a fresh selection next mission", () => {
  const system = { legacyAbilities: { armorUse: { freeArmorCaliber: 2 } }, usagePeriods: { mission: "m1" } };
  const item = armor("vest", { caliber: 2 });
  const plan = armorGrantPlan(system, [item], { itemId: "vest", intelConfirmed: true });
  system.armorMissionGrant = plan.record;
  item.system.armorMissionGrant = plan.stamp;
  assert.equal(armorGrantStatus(system, [item]).warnings.length, 0);
  assert.equal(armorGrantStatus(system, []).used, true);
  assert.match(armorGrantStatus(system, []).warnings.join(""), /missing/);
  item.system.quantity = 0;
  assert.equal(armorGrantStatus(system, [item]).used, true);
  assert.throws(() => armorGrantPlan(system, [item], { itemId: "vest", intelConfirmed: true }), /already/);
  system.usagePeriods.mission = "m2";
  assert.equal(armorGrantStatus(system, [item]).used, false);
  assert.match(armorGrantStatus(system, [item]).warnings.join(""), /earlier mission/);
  item.system.quantity = 1;
  assert.equal(armorGrantPlan(system, [item], { itemId: "vest", intelConfirmed: true }).record.epoch, "m2");
});
test("Armor Use checks altered provenance, lost grades and conflicting paid acquisitions without charging an extra pick", () => {
  const item = armor("vest", { caliber: 1, armorMissionGrant: { epoch: "initial" } });
  const system = compute([item], { armorMissionGrant: { epoch: "initial", itemId: "vest" } });
  assert.equal(system.gearPicks.W.spent, 0);
  assert.equal(system.gearPicks.S.spent, 0);
  assert.ok(system.warnings.some(w => w.includes("Armor Use grant")));
  assert.ok(
    armorGrantStatus({ legacyAbilities: { armorUse: { freeArmorCaliber: 1 } } }, [item]).warnings.some(w =>
      w.includes("provenance")
    )
  );
});

test("complete charge/mine/raw-explosive catalogs retain every printed unit weight, bundle count, grade, upgrade allowance and fractional range", () => {
  const entries = equipment.weapons.filter(w => w.proficiency === "Explosives"),
    expected = {
      "Charge, breaching": [3, 1, "II", 0],
      "Mine, anti-personnel": [6, 2, "II", 0],
      "Mine, anti-tank": [30, 1, "II", 0],
      "Mine, Bouncing Betty": [8, 1, "II", 0],
      "Mine, directional": [3.5, 1, "II", 0],
      "Charge, satchel": [20, 1, "III", 0],
      "ANFO, 50 lbs.": [50, 2, "II", 1],
      "Black powder, 1 lb.": [1, 3, "II", 1],
      "Dynamite, 1 stick": [0.5, 4, "II", 1],
      "Dynamite (expired), 1 stick": [0.5, 4, "II", 1],
      "Nitroglycerine, 1/4 lb.": [0.25, 3, "II", 1],
      "Plastic explosive, 1/4 lb.": [0.25, 2, "II", 1],
      "Plastic explosive, 1-ft. strip": [0.5, 2, "II", 1],
      "Thermite, 1 lb.": [1, 4, "II", 1],
      "TNT, 1/4 lb.": [0.25, 2, "II", 1]
    };
  assert.equal(entries.length, 15);
  assert.deepEqual(entries.map(w => w.name).sort(), Object.keys(expected).sort());
  for (const w of entries) {
    const [weight, bundle, caliber, upgrades] = expected[w.name];
    assert.equal(w.weight, weight, w.name);
    assert.equal(w.bundleSize, bundle, w.name);
    assert.equal(w.caliber, caliber, w.name);
    assert.equal(w.upgradeAllowance, upgrades, w.name);
    assert.equal(w.sourcePage, w.sourceTable.includes("4.54") ? 268 : 269);
    assert.equal(w.untrainedPenalty, -8);
    assert.equal(w.noStrengthDamage, true);
  }
  assert.equal(entries.find(w => w.name === "Charge, breaching").range, 2.5);
  assert.equal(entries.find(w => w.name === "Thermite, 1 lb.").damage, "2d10 fire (AP 24)");
  assert.equal(entries.find(w => w.name === "Thermite, 1 lb.").errorThreat, "1–5/—");
  assert.match(
    entries.find(w => w.name === "Dynamite (expired), 1 stick").qualities,
    /SUS \(bang, collision, explosive, falling, lethal\)/
  );
  assert.equal(entries.find(w => w.name === "Mine, anti-tank").errorThreat, "1–3/19–20");
});
test("explosive picks use Intelligence and their actual untrained penalty, never add Strength damage, and charge one pick for the complete undepleted bundle", () => {
  const system = {
    bab: 1,
    abilities: { str: { mod: 8 }, dex: { mod: 1 }, int: { mod: 3 } },
    proficiencyTotals: { explosives: { proficient: true } },
    activeFeatNames: []
  };
  for (const entry of equipment.weapons.filter(w => w.proficiency === "Explosives")) {
    const w = { ...entry, proficiency: "explosives" },
      trained = weaponAttack(system, w, cfg);
    assert.equal(trained.ability, "int");
    assert.equal(trained.total, 4);
    system.proficiencyTotals.explosives.proficient = false;
    assert.equal(weaponAttack(system, w, cfg).total, -4);
    system.proficiencyTotals.explosives.proficient = true;
    const damage = weaponDamage(system, w);
    assert.equal(damage.strengthBonus ?? damage.bonus ?? 0, 0);
    assert.doesNotMatch(damage.formula, /\+ 8/);
    const i = {
        id: entry.name,
        name: entry.name,
        type: "weapon",
        system: { ...w, gearCategory: "W", pick: "W", pickCount: 1, quantity: entry.bundleSize, carried: true }
      },
      s = compute([i]);
    assert.equal(s.gearPicks.W.spent, 1);
    assert.equal(s.encumbrance.weight, entry.weight * entry.bundleSize);
    i.system.quantity = 0;
    assert.equal(compute([i]).gearPicks.W.spent, 1);
  }
});

test("RAW p.197: each Wealth feat grants exactly two ranks up to ten without consuming Wealth allocations or changing the other two statistics", () => {
  const defs = JSON.parse(readFileSync(new URL("../src/data/feats.json", import.meta.url))),
    cases = [
      ["Home Sweet Home", "lifestyle"],
      ["Pack Rat", "possessions"],
      ["Silver Spoon", "spendingCash"]
    ];
  for (const [name, key] of cases)
    for (let allocation = 0; allocation <= 9; allocation++) {
      const f = {
          id: name,
          name,
          type: "feat",
          system: { ...structuredClone(defs.find(f => f.name === name)), tree: "gear", acquiredAtLevel: 1 }
        },
        patch = { wealthAllocation: { lifestyle: 0, possessions: 0, spendingCash: 0, [key]: allocation } },
        base = compute([], structuredClone(patch)),
        s = compute([f], structuredClone(patch));
      assert.equal(s.featStatus[name].ok, true);
      assert.equal(s.wealth[key].rank, Math.min(10, base.wealth[key].rank + 2), name + "/" + allocation);
      assert.equal(s.wealth.allocated, base.wealth.allocated);
      assert.equal(s.wealth.total, base.wealth.total);
      assert.equal(s.wealth.remaining, base.wealth.remaining);
      for (const other of ["lifestyle", "possessions", "spendingCash"].filter(k => k !== key))
        assert.equal(s.wealth[other].rank, base.wealth[other].rank);
      assert.equal(s.wealth.spendingCash.amount, 100 * s.wealth.spendingCash.rank ** 2);
      const duplicate = { ...structuredClone(f), id: name + "duplicate" },
        d = compute([f, duplicate], structuredClone(patch));
      assert.equal(d.wealth[key].rank, s.wealth[key].rank);
      assert.equal(d.featStatus[duplicate.id].ok, false);
    }
});

// Printed p.190: a universal exploding-action-die modifier, not a change to skill dice.
import { actionDieBoostPlan, generousBoostPlan } from "../module/rules/action-dice.mjs";
import { healingPlan, defenseBoostPlan } from "../module/rules/health.mjs";
import { difficultSkillBonusPlan, checkBonusPool, checkBonusBoostPlan } from "../module/rules/bonus-pools.mjs";
test("Lady Luck’s Smile propagates both highest faces to ordinary boost, Generous, healing and Defense formulas for every die type", () => {
  for (const die of [4, 6, 8, 10, 12])
    for (const smile of [false, true]) {
      const threshold = die - Number(smile),
        s = {
          activeFeatNames: smile ? ["Lady Luck's Smile"] : [],
          coreClassIds: ["pointman"],
          actionDice: { value: 3, die, explodeAt: threshold, bonus: 0 },
          vitality: { value: 1, max: 20 },
          wounds: { value: 4, max: 12 }
        },
        check = { checkKind: "skill", skillKey: "athletics", ability: "str", actionDiceAllowed: true, error: 0 };
      for (const p of [
        actionDieBoostPlan(s, check),
        generousBoostPlan(s, check, { teammate: true, perceivedAtRoll: true }),
        healingPlan(s, { vitalityDice: 1 }),
        defenseBoostPlan(s, { started: true, id: "fight", round: 1 }, { atStartOfRound: true, combatant: true })
      ]) {
        assert.equal(p.blocked, false);
        assert.equal(p.formula, `1d${die}x>=${threshold}`);
      }
    }
});
test("Lady Luck’s Smile follows a fixed bonus pool’s actual die instead of the career die and does not change dice per payment", () => {
  for (const careerDie of [4, 6, 8, 10, 12])
    for (const bold of [false, true]) {
      const s = {
          level: 9,
          classLevels: { stuntman: 8 },
          activeFeatNames: ["Lady Luck's Smile", ...(bold ? ["Fortune Favors the Bold"] : [])],
          coreClassIds: [],
          actionDice: { value: 0, die: careerDie, explodeAt: careerDie - 1, bonus: 0 },
          usagePeriods: { session: "s", scene: "one", mission: "m" },
          bonusActionDice: {}
        },
        gain = difficultSkillBonusPlan(s, { method: "roll", ability: "str" }, { dc: 30 }),
        m = {
          uuid: "ChatMessage.smile",
          flags: {
            spycraft2: {
              checkKind: "skill",
              skillKey: "athletics",
              ability: "str",
              checkMethod: "roll",
              requiredBonusPoolId: "pool",
              actionDiceAllowed: true,
              error: 0
            }
          }
        };
      s.bonusActionDice.pool = checkBonusPool(s, gain, {
        id: "pool",
        messageUuid: m.uuid,
        skillKey: "athletics",
        ability: "str"
      });
      const p = checkBonusBoostPlan(s, m, { bonusPoolId: "pool" });
      assert.equal(p.blocked, false);
      assert.equal(p.die, bold ? 12 : 10);
      assert.equal(p.explodeAt, p.die - 1);
      assert.equal(p.formula, `1d${p.die}x>=${p.die - 1}`);
      assert.equal(p.count, 1);
      assert.equal(p.rolls, 1);
    }
});
test("canonical Lady Luck’s Smile acquisition requires career nine and Fortune Favors the Bold, applies once, and disappears with its source", () => {
  const defs = JSON.parse(readFileSync(new URL("../src/data/feats.json", import.meta.url))),
    feat = (name, at, id = name) => ({
      id,
      name,
      type: "feat",
      system: { ...structuredClone(defs.find(f => f.name === name)), acquiredAtLevel: at }
    }),
    chain = [feat("Fortunate", 1), feat("Fortune Favors the Bold", 3)],
    progression = Array.from({ length: 9 }, () => ({ classId: "test", skills: {}, vitality: 1 }));
  for (const [items, valid] of [
    [chain, false],
    [[...chain, feat("Lady Luck's Smile", 9)], true],
    [[...chain, feat("Lady Luck's Smile", 6)], false],
    [[feat("Fortunate", 1), feat("Lady Luck's Smile", 9)], false]
  ]) {
    const early = items.some(i => i.name === "Lady Luck's Smile" && i.system.acquiredAtLevel === 6),
      s = compute(items, { progression: early ? progression.slice(0, 6) : progression });
    assert.equal(s.actionDice.explodeAt, s.actionDice.die - Number(valid));
  }
  const one = compute([...chain, feat("Lady Luck's Smile", 9)], { progression }),
    two = compute([...chain, feat("Lady Luck's Smile", 9), feat("Lady Luck's Smile", 9, "copy")], { progression });
  assert.equal(one.actionDice.explodeAt, two.actionDice.explodeAt);
});
