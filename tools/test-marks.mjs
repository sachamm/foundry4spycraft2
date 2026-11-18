import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  MARKS,
  MARK_PREREQUISITE_BONUS,
  markDamageCategory,
  markDamagePlan,
  markPrerequisiteBonus,
  markDrawback
} from "../module/rules/marks.mjs";
import { weaponDamage } from "../module/rules/gear.mjs";
import { computeAgent, prerequisiteContext } from "../module/rules/engine.mjs";
import { checkPrerequisites } from "../module/rules/prerequisites.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const definitions = JSON.parse(await readFile(new URL("../src/data/classes.json", import.meta.url), "utf8")),
  catalog = JSON.parse(await readFile(new URL("../src/data/feats.json", import.meta.url), "utf8"));
const TREES = { rangedCombat: "Mark of Conflict", unarmedCombat: "Mark of Strife", meleeCombat: "Mark of Turmoil" };
const sys = (feats = []) => ({
  activeFeatNames: feats,
  cqbRange: 30,
  bab: 6,
  abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 10, mod: 0 }])),
  conditionContext: {},
  proficiencyTotals: Object.fromEntries(Object.keys(cfg.proficiencies).map(k => [k, { proficient: true }])),
  classLevels: {},
  classOptionSelections: [],
  unarmed: { die: 3, extraDice: 0, damageBonus: 0 }
});
const weapon = (proficiency, extra = {}) => ({
  name: "QA weapon",
  proficiency,
  weaponCategory: "servicePistol",
  sizeHands: "D/1h",
  range: 50,
  fireModes: ["single"],
  fireMode: "single",
  recoil: 0,
  errorThreat: "1/20",
  damage: "1d6",
  qualities: "",
  ...extra
});
const soldier = () => ({
  id: "soldier",
  name: "soldier",
  type: "class",
  system: { ...definitions.find(c => c.key === "soldier"), identifier: "soldier", vitalityDie: 12 }
});
const mark = name => ({
  id: name,
  name,
  type: "feat",
  system: { tree: "chance", acquiredAtLevel: 1, prerequisites: null }
});
function native(level, extra = []) {
  const system = {
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 15 }])),
    progression: Array.from({ length: level }, () => ({ classId: "soldier", vitality: 6, skills: {} })),
    misc: {}
  };
  return computeAgent(system, [soldier(), ...extra], cfg);
}

test("catalog: the three Marks are Chance feats restricted to career level 1 and map to the three combat trees", () => {
  assert.deepEqual(Object.keys(MARKS).sort(), Object.values(TREES).sort());
  assert.equal(MARK_PREREQUISITE_BONUS, 3);
  for (const [tree, name] of Object.entries(TREES)) {
    const row = catalog.find(f => f.name === name);
    assert.ok(row, name);
    assert.equal(row.tree, "Chance");
    assert.deepEqual(row.prerequisites, { type: "level", eq: 1 });
    assert.equal(MARKS[name].tree, tree);
    assert.ok(cfg.featTrees[tree]);
    assert.match(markDrawback(name), new RegExp(`2 or more ${cfg.featTrees[tree]} feats worsens by 2 grades`));
  }
  assert.equal(markDrawback("Lucky Break"), "");
});
test("damage category: every proficiency is unarmed, melee or ranged; knuckle weapons count as unarmed", () => {
  for (const key of Object.keys(cfg.proficiencies)) {
    const expected =
      key === "unarmed"
        ? "unarmed"
        : ["blunt", "exoticBlunt", "edged", "exoticEdged"].includes(key)
          ? "melee"
          : "ranged";
    assert.equal(markDamageCategory({ proficiency: key }), expected, key);
  }
  assert.equal(markDamageCategory({ proficiency: "blunt", qualities: "NKL" }), "unarmed");
  assert.equal(markDamageCategory({ proficiency: "blunt", qualities: "AP (2), NKL, FIN" }), "unarmed");
  assert.equal(markDamageCategory({ proficiency: "blunt", qualities: "KNL" }), "melee");
});
test("each Mark adds exactly 1 to its own category of weapon damage and nothing to the other two, across every proficiency", () => {
  for (const name of Object.keys(MARKS))
    for (const key of Object.keys(cfg.proficiencies)) {
      const w = weapon(key),
        with_ = weaponDamage(sys([name]), w),
        without = weaponDamage(sys(), w);
      if (!with_ || !without || with_.blocked || without.blocked) {
        assert.equal(!!with_?.blocked, !!without?.blocked, key);
        continue;
      }
      const applies = MARKS[name].category === markDamageCategory(w);
      assert.equal(with_.bonus - without.bonus, applies ? 1 : 0, name + "/" + key);
      assert.equal(with_.markDamage.active, applies);
      assert.equal(with_.markDamage.source, applies ? name : null);
      assert.equal(without.markDamage.bonus, 0);
      if (applies) {
        assert.match(with_.formula, /\+ \(1\)\)$/);
        assert.match(with_.markDamage.note, /\+1/);
      }
    }
});
test("all three Marks together still give one +1 per damage roll; a knuckle weapon uses Strife, not Turmoil; no feat means no change", () => {
  const all = Object.keys(MARKS);
  for (const key of ["handgun", "edged", "unarmed", "hurled"]) {
    const d = weaponDamage(sys(all), weapon(key)),
      b = weaponDamage(sys(), weapon(key));
    assert.equal(d.bonus - b.bonus, 1, key);
  }
  const knuckle = weapon("blunt", { qualities: "NKL", damage: "1" });
  assert.equal(weaponDamage(sys(["Mark of Turmoil"]), knuckle).bonus, weaponDamage(sys(), knuckle).bonus);
  assert.equal(weaponDamage(sys(["Mark of Strife"]), knuckle).bonus, weaponDamage(sys(), knuckle).bonus + 1);
  assert.equal(markDamagePlan({}, weapon("rifle")).bonus, 0);
  assert.equal(markDamagePlan({ activeFeatNames: ["  mark of conflict "] }, weapon("rifle")).bonus, 1);
});
test("the damage bonus combines once with CQB Basics and a recorded attack bonus before minimum damage", () => {
  const s = sys(["Mark of Conflict", "CQB Basics"]),
    d = weaponDamage(s, weapon("handgun"), { distanceFeet: 10, attackDamageBonus: 4 });
  assert.equal(d.bonus, 6);
  assert.equal(
    weaponDamage(sys(["Mark of Conflict"]), weapon("handgun", { damage: "1d4-3" })).min,
    weaponDamage(sys(), weapon("handgun", { damage: "1d4-3" })).min
  );
});
test("prerequisite bonus: +3 BAB and +3 career level only for the matching combat tree", () => {
  for (const [tree, name] of Object.entries(TREES))
    for (const other of ["", ...Object.keys(cfg.featTrees)]) {
      assert.equal(
        markPrerequisiteBonus(n => n === name, other),
        other === tree ? 3 : 0,
        name + "/" + other
      );
      assert.equal(
        markPrerequisiteBonus(() => false, other),
        0
      );
    }
  for (let level = 1; level <= 6; level++) {
    const s = native(level),
      bab = s.base.bab;
    for (const [tree, name] of Object.entries(TREES)) {
      const names = new Set([name.toLowerCase()]),
        own = prerequisiteContext(s, names, {}, {}, { featTree: tree }),
        plain = prerequisiteContext(s, names, {}, {}),
        none = prerequisiteContext(s, new Set(), {}, {}, { featTree: tree });
      assert.equal(own.base.bab, bab + 3);
      assert.equal(own.levelBonus, 3);
      assert.equal(own.level, level);
      assert.equal(plain.base.bab, bab);
      assert.equal(plain.levelBonus, 0);
      assert.equal(none.base.bab, bab);
      assert.equal(checkPrerequisites({ type: "level", min: level + 3 }, own).ok, true);
      assert.equal(checkPrerequisites({ type: "level", min: level + 4 }, own).ok, false);
      assert.equal(checkPrerequisites({ type: "level", min: level + 1 }, plain).ok, false);
      assert.equal(checkPrerequisites({ type: "base", key: "bab", min: bab + 3 }, own).ok, true);
      assert.equal(checkPrerequisites({ type: "base", key: "bab", min: bab + 4 }, own).ok, false);
      assert.equal(checkPrerequisites({ type: "base", key: "bab", min: bab + 1 }, none).ok, false);
      for (const otherTree of Object.keys(TREES).filter(t => t !== tree))
        assert.equal(prerequisiteContext(s, names, {}, {}, { featTree: otherTree }).base.bab, bab);
    }
  }
});
test('"career level N only" requirements and base Defense are never shifted by a Mark', () => {
  const s = native(2),
    own = prerequisiteContext(s, new Set(["mark of turmoil"]), {}, {}, { featTree: "meleeCombat" });
  assert.equal(checkPrerequisites({ type: "level", eq: 2 }, { ...own, acquisitionLevel: 2 }).ok, true);
  assert.equal(checkPrerequisites({ type: "level", eq: 5 }, { ...own, acquisitionLevel: 2 }).ok, false);
  assert.equal(checkPrerequisites({ type: "level", eq: 1 }, own).ok, false);
  assert.equal(own.base.defense, s.base.defense);
});
test("actual feat evaluation: a possessed Mark qualifies matching-tree BAB and level prerequisites, never other trees, and never Main BAB", () => {
  const level = 2,
    plainBab = native(level).base.bab;
  for (const [tree, name] of Object.entries(TREES)) {
    const bab = {
        id: "bab",
        name: "QA BAB prerequisite",
        type: "feat",
        system: { tree, acquiredAtLevel: level, prerequisites: { type: "base", key: "bab", min: plainBab + 3 } }
      },
      lvl = {
        id: "lvl",
        name: "QA level prerequisite",
        type: "feat",
        system: { tree, acquiredAtLevel: level, prerequisites: { type: "level", min: level + 3 } }
      };
    const s = native(level, [mark(name), bab, lvl]);
    assert.equal(s.featStatus.bab.ok, true, name);
    assert.equal(s.featStatus.lvl.ok, true, name);
    assert.equal(s.base.bab, plainBab);
    assert.equal(s.bab, native(level).bab);
    const without = native(level, [bab, lvl]);
    assert.equal(without.featStatus.bab.ok, false);
    assert.equal(without.featStatus.lvl.ok, false);
    const tooHigh = native(level, [
      mark(name),
      { ...bab, system: { ...bab.system, prerequisites: { type: "base", key: "bab", min: plainBab + 4 } } },
      { ...lvl, system: { ...lvl.system, prerequisites: { type: "level", min: level + 4 } } }
    ]);
    assert.equal(tooHigh.featStatus.bab.ok, false);
    assert.equal(tooHigh.featStatus.lvl.ok, false);
    const wrong = Object.keys(TREES).find(t => t !== tree),
      cross = native(level, [
        mark(name),
        { ...bab, system: { ...bab.system, tree: wrong } },
        { ...lvl, system: { ...lvl.system, tree: "basicCombat" } }
      ]);
    assert.equal(cross.featStatus.bab.ok, false);
    assert.equal(cross.featStatus.lvl.ok, false);
  }
});
test("a real catalog chain benefits: Mark of Turmoil lets a BAB+3 character meet Cleave Mastery (BAB+6) once Cleave Basics is owned", () => {
  const row = name => catalog.find(f => f.name === name),
    key = tree => Object.keys(cfg.featTrees).find(k => cfg.featTrees[k] === tree),
    feat = (name, at) => ({
      id: name,
      name,
      type: "feat",
      system: { tree: key(row(name).tree), acquiredAtLevel: at, prerequisites: row(name).prerequisites }
    });
  let level = 1;
  while (native(level).base.bab < 3) level++;
  assert.equal(native(level).base.bab, 3);
  const items = [feat("Cleave Basics", 1), feat("Cleave Mastery", level)],
    marked = native(level, [mark("Mark of Turmoil"), ...items]),
    plain = native(level, items),
    wrongMark = native(level, [mark("Mark of Conflict"), ...items]);
  assert.equal(marked.featStatus["Cleave Mastery"].ok, true);
  assert.equal(plain.featStatus["Cleave Mastery"].ok, false);
  assert.equal(wrongMark.featStatus["Cleave Mastery"].ok, false);
  assert.equal(marked.featStatus["Cleave Basics"].ok, true);
});
