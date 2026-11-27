import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { inheritedClassFeatures } from "../module/rules/inherited-classes.mjs";
const classes = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url)));
function doc(key) {
  const c = structuredClone(classes.find(c => c.key === key));
  return {
    id: key,
    name: c.name,
    type: "class",
    system: { ...c, identifier: key, vitalityDie: c.vitality, choices: {}, inheritedChoices: {} }
  };
}
function select(item, name, position = 0) {
  const list = item.system.choiceLists.find(l => l.kind === "crossClass");
  const indices = item.system.choiceSchedule.flatMap((slot, index) => (slot.list === list.key ? [index] : []));
  const index = indices[position],
    level = item.system.choiceSchedule[index].level;
  const option = list.options.find(o => o.name === name);
  assert.ok(option, name);
  item.system.choices[index] = option.index;
  return { index, level, key: `cross${index}` };
}
const sequence = (key, level) => Array.from({ length: level }, () => ({ classId: key, skills: {}, vitality: 1 }));
function compute(items, progression) {
  return computeAgent(
    {
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 10 }])),
      progression,
      skills: {},
      focuses: {},
      proficiencies: {},
      misc: {}
    },
    items,
    cfg
  );
}

test("RAW pp.40–41: each of 42 inherited choices resolves for both Pointman and Schemer", () => {
  for (const key of ["pointman", "schemer"])
    for (const option of doc(key).system.choiceLists.find(l => l.kind === "crossClass").options) {
      const item = doc(key),
        slot = select(item, option.name),
        state = inheritedClassFeatures([item], sequence(key, slot.level), cfg);
      assert.equal(state.entries.length, 1, `${key}/${option.name}`);
      assert.equal(state.entries[0].career, slot.level);
      assert.equal(state.entries[0].assumedLevel, option.assumedClassLevel);
      if (state.entries[0].menu)
        assert.ok(
          state.pending.some(text => text.includes("choose an option")),
          option.name
        );
    }
});

test("inherited limited abilities reach actual use counters with only their own entitlement and printed period", () => {
  for (const ownerKey of ["pointman", "schemer"])
    for (const [choice, id, limit] of [
      ["Faceman: Cold read (1/session)", "classUse_faceman_ColdRead", 1],
      ["Faceman: Quick change (2/session)", "classUse_faceman_QuickChange", 2],
      ["Hacker: Trap door (1/session)", "classUse_hacker_TrapDoor", 1],
      ["Snoop: Intercept communication (1/session)", "classUse_snoop_InterceptCommunication", 1]
    ]) {
      const owner = doc(ownerKey),
        slot = select(owner, choice);
      const before = compute([owner], sequence(ownerKey, slot.level - 1));
      assert.equal(
        before.limitedUses.some(s => s.id === id),
        false
      );
      const system = compute([owner], sequence(ownerKey, slot.level));
      const spec = system.limitedUses.find(s => s.id === id);
      assert.ok(spec, ownerKey + "/" + choice);
      assert.equal(spec.limit, limit);
      assert.equal(spec.period, "session");
      assert.equal(spec.workflow, "manual");
      assert.equal(
        system.limitedUses.filter(s => s.id.startsWith("classUse_")).length,
        1,
        "borrowing one ability does not grant the entire emulated class"
      );
    }
});

test("duplicate inherited sources share one allowance and actual class takeover retains the counter identity", () => {
  const pointman = doc("pointman"),
    schemer = doc("schemer");
  const p = select(pointman, "Faceman: Cold read (1/session)"),
    s = select(schemer, "Faceman: Cold read (1/session)");
  const progression = [...sequence("pointman", p.level), ...sequence("schemer", s.level)];
  const system = compute([pointman, schemer], progression);
  const id = "classUse_faceman_ColdRead";
  assert.equal(system.limitedUses.filter(spec => spec.id === id).length, 1);
  assert.equal(system.limitedUses.find(spec => spec.id === id).limit, 1);
  const faceman = doc("faceman");
  const native = compute([pointman, schemer, faceman], [...progression, ...sequence("faceman", 2)]);
  assert.equal(
    native.inheritedClassChoices.some(entry => entry.abilityId === "Faceman:Cold read (1/session)"),
    false
  );
  assert.equal(native.limitedUses.filter(spec => spec.id === id).length, 1);
  assert.equal(native.limitedUses.find(spec => spec.id === id).limit, 1);
});

test("inherited menus retain every original option, apply its bonuses and expose their bonus-feat sources", () => {
  const owner = doc("pointman"),
    list = owner.system.choiceLists.find(l => l.kind === "crossClass");
  let menus = 0;
  for (const parent of list.options) {
    const initial = doc("pointman"),
      slot = select(initial, parent.name),
      progression = sequence("pointman", slot.level);
    const menu = inheritedClassFeatures([initial], progression, cfg).entries[0].menu;
    if (!menu) continue;
    menus++;
    assert.deepEqual(menu.options, cfg.classFeatures[parent.classId].choiceLists.find(l => l.key === menu.key).options);
    for (const option of menu.options) {
      const item = doc("pointman");
      select(item, parent.name);
      item.system.inheritedChoices[slot.key] = {
        option: option.index,
        skill: cfg.classFeatures[parent.classId].classSkills[0]
      };
      const state = inheritedClassFeatures([item], progression, cfg);
      for (const bonus of option.bonuses ?? [])
        assert.ok(
          state.sources.some(s => s.bonuses.some(b => b.target === bonus.target && b.value === bonus.value)),
          `${parent.name}/${option.name}`
        );
      const tree = option.bonuses?.find(b => b.target.startsWith("featSlots."))?.target.split(".")[1];
      if (tree) {
        assert.equal(state.featSources[0].tree, tree);
        assert.equal(state.featSources[0].levelAllowance, parent.classId === "scientist" ? 2 : 0);
      }
    }
  }
  assert.equal(menus, 11);
});

test("inherited Fight On gives two proficiency picks; Intense Study permits two distinct inherited feat sources", () => {
  const soldier = doc("pointman"),
    s = select(soldier, "Soldier: Fight on");
  soldier.system.inheritedChoices[s.key] = { option: 2 };
  const baseline = compute([doc("pointman")], sequence("pointman", s.level));
  assert.equal(
    compute([soldier], sequence("pointman", s.level)).proficiencyPicks.available,
    baseline.proficiencyPicks.available + 2
  );
  const scientist = doc("pointman"),
    a = select(scientist, "Scientist: Intense study"),
    b = select(scientist, "Scientist: Intense study", 1);
  scientist.system.inheritedChoices[a.key] = { option: 2 };
  scientist.system.inheritedChoices[b.key] = { option: 3 };
  const sys = compute([scientist], sequence("pointman", b.level));
  assert.equal(sys.featAcquisitionSources.length, 2);
  assert.equal(new Set(sys.featAcquisitionSources.map(s => s.id)).size, 2);
  assert.equal(sys.feats.trees.basicSkill.slots, 1);
  assert.equal(sys.feats.trees.advancedSkill.slots, 1);
});

test("inherited Ph.D. and Masks Skill Mastery apply selected skill effects, and 1,000 Faces creates a fixed-feat grant", () => {
  const phd = doc("pointman"),
    p = select(phd, "Scientist: Ph.D. (1 skill)");
  phd.system.inheritedChoices[p.key] = { skill: "science" };
  assert.equal(compute([phd], sequence("pointman", p.level)).skillTotals.science.maxRanks, p.level + 8);
  const mask = doc("pointman"),
    m = select(mask, "Faceman: Masks");
  mask.system.inheritedChoices[m.key] = { option: 9, skill: "bluff" };
  assert.equal(compute([mask], sequence("pointman", m.level)).skillTotals.bluff.errorReduction, 2);
  const face = doc("pointman"),
    f = select(face, "Faceman: 1,000 faces");
  assert.deepEqual(compute([face], sequence("pointman", f.level)).inheritedFeatureGrants, [
    { name: "Flawless Identity", source: "Pointman: Faceman: 1,000 faces", level: f.level }
  ]);
});

test("inherited choices stop contributing when the real class grants that ability; Bright Idea is earned at Scientist 3", () => {
  const owner = doc("pointman"),
    slot = select(owner, "Scientist: Bright idea (1/session)");
  assert.equal(
    inheritedClassFeatures(
      [owner, doc("scientist")],
      [...sequence("pointman", slot.level), ...sequence("scientist", 3)],
      cfg
    ).entries.length,
    0
  );
  const masks = doc("pointman"),
    m = select(masks, "Faceman: Masks");
  masks.system.inheritedChoices[m.key] = { option: 8 };
  const before = compute([masks], sequence("pointman", m.level)),
    after = compute([masks, doc("faceman")], [...sequence("pointman", m.level), ...sequence("faceman", 4)]);
  assert.equal(before.contactPicks.available, 3);
  assert.equal(after.contactPicks.available, 1);
  assert.ok(after.warnings.some(text => text.includes("replace Faceman: Masks")));
});

test("RAW p.29: Armor Use combines legacy grades, has only one ACP reduction and respects the highest offered grade", () => {
  const vest = {
    id: "vest",
    name: "Vest",
    type: "armor",
    system: { equipped: true, armorType: "P", armorSlot: "body", defensePenalty: 0, armorCheck: -4 }
  };
  const native = compute(
    [doc("soldier"), doc("counterterrorist"), vest],
    [...sequence("soldier", 8), ...sequence("counterterrorist", 8)]
  );
  assert.equal(native.legacyAbilities.armorUse.grade, 4);
  assert.equal(native.armor.defense, 4);
  assert.equal(native.armor.check, -3);
  const p = doc("pointman"),
    ps = select(p, "Soldier: Armor use I"),
    s = doc("schemer"),
    ss = select(s, "Soldier: Armor use I");
  const capped = compute(
    [p, s, doc("counterterrorist"), vest],
    [...sequence("pointman", ps.level), ...sequence("schemer", ss.level), ...sequence("counterterrorist", 8)]
  );
  assert.equal(capped.legacyAbilities.armorUse.grade, 2);
  assert.equal(capped.armor.defense, 2);
  assert.equal(capped.armor.check, -3);
});

test("Advocate Networks may choose associate contacts repeatedly at successive milestones", () => {
  const item = doc("advocate"),
    list = item.system.choiceLists.find(l => l.key === "network");
  item.system.choiceSchedule.forEach((slot, index) => {
    if (slot.list === list.key) item.system.choices[index] = 2;
  });
  const sys = compute([item], sequence("advocate", 5));
  assert.equal(sys.contactPicks.available, 5);
  assert.ok(!sys.warnings.some(w => w.includes("Contact may be selected only")));
});
