import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
const definitions = JSON.parse(readFileSync(new URL("../src/data/feats.json", import.meta.url)));
const reference = JSON.parse(readFileSync(new URL("./fixtures/raw/feats-reference.json", import.meta.url)));
const camel = s => s[0].toLowerCase() + s.slice(1).replace(/ ([a-z])/gi, (_, c) => c.toUpperCase());
let next = 0;
const feat = (name, patch = {}) => {
  const data = definitions.find(f => f.name === name);
  assert.ok(data, name);
  return {
    id: `feat${++next}`,
    name,
    type: "feat",
    system: { ...structuredClone(data), tree: camel(data.tree), acquiredAtLevel: 1, ...patch }
  };
};
function compute(items, level = 20, bases = {}) {
  const sys = {
    abilities: Object.fromEntries(
      ["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: bases[k] ?? 16, misc: 0 }])
    ),
    progression: Array.from({ length: level }, () => ({ classId: "test", vitality: 1, skills: {} })),
    skills: {},
    focuses: {},
    proficiencies: { unarmed: { proficient: true } },
    misc: {}
  };
  const cls = {
    id: "test",
    name: "Test",
    type: "class",
    system: {
      identifier: "test",
      skillPoints: 4,
      vitalityDie: 6,
      table: Array.from({ length: 20 }, (_, i) => ({ level: i + 1, bab: 20, fort: 2, ref: 2, will: 2, defense: 10 })),
      classSkills: []
    }
  };
  return computeAgent(sys, [cls, ...items], cfg);
}
function leaves(node) {
  return !node ? [] : ["all", "any"].includes(node.type) ? node.of.flatMap(leaves) : [node];
}

test("RAW pp.171–209: all 314 feat records match source names, repeatability and numeric prerequisites", () => {
  assert.equal(definitions.length, 314);
  assert.equal(Object.keys(reference).length, 314);
  const skills = Object.values(cfg.skills);
  for (const data of definitions) {
    const source = reference[data.name];
    assert.ok(source, data.name);
    assert.equal(data.repeatable, source.repeatable, data.name);
    const nodes = leaves(data.prerequisites);
    const patterns = [
      ["level", null, /Career [Ll]evel (\d+)/i],
      ["base", "bab", /Base attack bonus \+(\d+)/i],
      ["base", "defense", /Base Defense bonus \+(\d+)/i],
      ...skills.map(s => ["skill", s.key, new RegExp(s.name + " (\\d+)\\+ ranks", "i")])
    ];
    for (const [type, key, pattern] of patterns) {
      const match = pattern.exec(source.prerequisites);
      if (!match) continue;
      assert.ok(
        nodes.some(n => n.type === type && (key === null || n.key === key) && (n.min ?? n.eq) === Number(match[1])),
        `${data.name}: ${match[0]}`
      );
    }
    if (data.notChecked)
      assert.ok(
        nodes.some(n => n.type === "manual"),
        `${data.name} must not silently waive an unimplemented prerequisite`
      );
  }
});

test("RAW p.171: acquisition-only requirements remain valid after leveling; future feats stay inactive", () => {
  const memory = feat("Photographic Memory");
  assert.equal(compute([memory]).featStatus[memory.id].ok, true);
  const future = feat("Great Fortitude", { acquiredAtLevel: 5 });
  const sys = compute([future], 1);
  assert.equal(sys.featStatus[future.id].ok, false);
  assert.equal(sys.saves.fort.base, 2);
});

test("RAW p.174–176: Great Fortitude changes base Fortitude, Toughness uses it, repeat limit is three", () => {
  const tough = [feat("Toughness"), feat("Toughness"), feat("Toughness")],
    great = feat("Great Fortitude");
  const baseline = compute([great]);
  const sys = compute([great, ...tough]);
  assert.equal(sys.saves.fort.base, 5);
  assert.equal(sys.vitality.max - baseline.vitality.max, 15);
  const excess = compute([great, ...tough, feat("Toughness")]);
  assert.equal(excess.vitality.max, sys.vitality.max);
  assert.ok(excess.warnings.some(w => w.includes("maximum of 3")));
});

test("RAW p.174: Iron Will raises base Will and both damage thresholds", () => {
  const iron = feat("Iron Will");
  const base = compute([]),
    sys = compute([iron]);
  assert.equal(sys.saves.will.base, base.saves.will.base + 3);
  assert.equal(sys.stressThreshold, base.stressThreshold + 3);
  assert.equal(sys.subdualThreshold, base.subdualThreshold + 3);
});

test("RAW pp.199–200: all 15 Basic Skill feats and each mastery tier set the named bonuses and base ranges", () => {
  for (const [name, skills] of Object.entries(cfg.tables.basicSkillFeats)) {
    const basic = feat(name);
    const chain = [basic];
    for (const [mastery, bonus, threat] of [
      [null, 2, 19],
      ["Advanced Skill Mastery", 3, 18],
      ["Grand Skill Mastery", 4, 17],
      ["Perfect Skill Mastery", 5, 16]
    ]) {
      if (mastery) chain.push(feat(mastery, { choice: name }));
      const sys = compute(chain);
      for (const skill of skills) {
        assert.equal(
          sys.skillTotals[skill].bonus,
          bonus + (["cultures", "impress", "networking", "profession"].includes(skill) ? -2 : 0),
          `${name}/${mastery}`
        );
        assert.equal(sys.skillTotals[skill].threat, threat, `${name}/${mastery}`);
      }
    }
  }
});

test("RAW p.201: Talented grants paired class ranks and caps without requiring ownership of the chosen basic feat", () => {
  const talented = feat("Talented", { choice: "Actor", granted: true });
  const cls = {
    id: "test",
    name: "Test",
    type: "class",
    system: { identifier: "test", table: [], classSkills: [], skillPoints: 4, vitalityDie: 6 }
  };
  const sys = {
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 10 }])),
    progression: [{ classId: "test", skills: { bluff: 3 } }],
    skills: {},
    focuses: {},
    misc: {}
  };
  computeAgent(sys, [cls, talented], cfg);
  assert.equal(sys.skillTotals.bluff.ranks, 3);
  assert.equal(sys.skillTotals.impress.ranks, 3);
  assert.equal(sys.skillTotals.bluff.isClass, true);
  assert.equal(sys.skillTotals.bluff.cap, sys.skillTotals.impress.cap);
  assert.equal(sys.skillPoints[0].spent, 3);
});

test("RAW p.201: Unlocked Potential has the chosen noncumulative career+6 maximum", () => {
  const sys = compute([feat("Unlocked Potential", { choice: "notice" })], 4);
  assert.equal(sys.skillTotals.notice.maxRanks, 10);
  assert.equal(sys.skillTotals.notice.isClass, true);
});

test("RAW unimplemented prerequisites require explicit GC confirmation", () => {
  const prerequisites = { type: "manual", text: "A remaining GC-confirmed condition" },
    no = feat("Bludgeon", { prerequisites }),
    yes = feat("Bludgeon", { prerequisites, manualPrerequisitesConfirmed: true });
  assert.equal(compute([no]).featStatus[no.id].ok, false);
  assert.equal(compute([yes]).featStatus[yes.id].ok, true);
});

test("RAW p.186–187: Martial Arts substitution and Master's Art addition use the chosen attribute", () => {
  const martial = feat("Martial Arts", { choice: "wis", granted: true });
  const base = compute([], 20, { str: 10, dex: 12, wis: 18 });
  const first = compute([martial], 20, { str: 10, dex: 12, wis: 18 });
  assert.equal(first.attack.unarmed - base.attack.unarmed, 4);
  const master = compute([martial, feat("Master's Art", { granted: true })], 20, { str: 10, dex: 12, wis: 18 });
  assert.equal(master.attack.unarmed, base.attack.unarmed + 4);
  assert.equal(master.defense.total, base.defense.total + 4);
  assert.equal(master.initiative.total, base.initiative.total + 4);
  assert.equal(master.unarmed.threat, 17);
});

test("Practice Makes Perfect validates all15 chosen prerequisite chains and removes both effects when its matching Mark source is absent", () => {
  for (const choice of Object.keys(cfg.tables.basicSkillFeats)) {
    const basic = feat(choice, { acquiredAtLevel: 1 }),
      start = feat("False Start", { choice, acquiredAtLevel: 3 }),
      mark = feat("Mark of a Professional", { choice, acquiredAtLevel: 9 }),
      practice = feat("Practice Makes Perfect", { choice, acquiredAtLevel: 15 }),
      items = [basic, start, mark, practice],
      s = compute(items, 15);
    assert.equal(s.featStatus[practice.id].ok, true, choice);
    for (const skill of cfg.tables.basicSkillFeats[choice])
      assert.ok(
        s.skillFeatRules.some(r => r.name === "Practice Makes Perfect" && r.skill === skill && r.choice === choice)
      );
    const missing = compute([basic, start, practice], 15);
    assert.equal(missing.featStatus[practice.id].ok, false);
    assert.equal(
      missing.skillFeatRules.some(r => r.name === "Practice Makes Perfect"),
      false
    );
  }
});
