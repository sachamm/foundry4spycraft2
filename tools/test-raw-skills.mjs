// These fixtures supply required gear unless a case explicitly overrides gearStatus; absence/kit boundaries are tested in test-skill-gear.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
const reference = JSON.parse(readFileSync(new URL("./fixtures/raw/skills-reference.json", import.meta.url)));

test("RAW pp.106–169: every one of 30 skill definitions and 100 named checks matches its source", () => {
  let count = 0;
  for (const skill of Object.values(cfg.skills)) {
    const source = reference[skill.name];
    assert.deepEqual(skill.abilities, source.abilities, skill.name);
    assert.equal(skill.focus, source.focus, skill.name);
    assert.deepEqual(skill.checks, source.checks, skill.name);
    count += skill.checks.length;
    for (const check of skill.checks) {
      assert.ok(check.attributes.length > 0, `${skill.name}/${check.name}`);
      for (const attr of check.attributes)
        assert.ok(skill.abilities.includes(attr), `${skill.name}/${check.name}: ${attr}`);
    }
  }
  assert.equal(Object.keys(reference).length, 30);
  assert.equal(count, 100);
});

test("RAW p.92: all 100 checks add +2 error when untrained, with ACP only when tagged", () => {
  for (const skill of Object.values(cfg.skills))
    for (const check of skill.checks)
      for (const ranks of [0, 5]) {
        const sys = {
          skillTotals: {
            [skill.key]: {
              ranks,
              totals: skill.abilities.map((ability, index) => ({ ability, total: 5 + index })),
              threat: 20,
              cap: 30
            }
          },
          armor: { check: -4 }
        };
        const resolved = resolveSkillCheck(sys, skill.key, check, { gearStatus: "available", synergySkill: "none" });
        assert.equal(resolved.error, check.error + (ranks === 0 ? 2 : 0), `${skill.name}/${check.name}`);
        assert.equal(
          resolved.total,
          sys.skillTotals[skill.key].totals.find(t => t.ability === check.attributes[0]).total +
            (check.tags.includes("Armor Check Penalty") ? -4 : 0)
        );
        assert.equal(
          resolved.rollMode,
          check.mode === "Secret" || check.mode.includes("Passive") ? "blindroll" : undefined
        );
      }
});

test("RAW skill uses: Jump uses STR, Skydiving DEX, Surgery has base error 1–4, untrained Resolve has +2 error", () => {
  const sys = {
    skillTotals: {
      acrobatics: {
        ranks: 0,
        totals: [
          { ability: "str", total: 1 },
          { ability: "dex", total: 7 }
        ],
        threat: 20,
        cap: 15
      }
    }
  };
  const checks = cfg.skills.acrobatics.checks;
  assert.equal(
    resolveSkillCheck(
      sys,
      "acrobatics",
      checks.find(c => c.id === "jump"),
      { gearStatus: "available", ability: "dex" }
    ).total,
    1
  );
  assert.equal(
    resolveSkillCheck(
      sys,
      "acrobatics",
      checks.find(c => c.id === "skydiving"),
      { gearStatus: "available", ability: "str" }
    ).total,
    7
  );
  assert.equal(cfg.skills.medicine.checks.find(c => c.id === "surgery").error, 4);
  assert.equal(cfg.skills.bureaucracy.abilities.join("/"), "int/cha");
});

function system() {
  return {
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 10, misc: 0 }])),
    progression: [
      { classId: "test", skills: { bluff: 2 }, vitality: 0 },
      { classId: "test", skills: { bluff: 2 }, vitality: 1 }
    ],
    skills: {},
    focuses: {},
    misc: {}
  };
}
const cls = {
  id: "test",
  name: "Test",
  type: "class",
  system: { identifier: "test", table: [], classSkills: [], skillPoints: 4, vitalityDie: 6 }
};
test("RAW pp.17,87: later INT changes do not rewrite earned points; class-skill designations do not rewrite previous purchases", () => {
  const sys = system();
  sys.skills.bluff = { classSkill: true, classSkillAt: 2 };
  sys.abilities.int.misc = -4;
  computeAgent(sys, [cls], cfg);
  assert.equal(sys.skillTotals.bluff.ranks, 3); // level 1 cross-class +1, level 2 class +2.
  assert.deepEqual(
    sys.skillPoints.map(p => p.available),
    [16, 4]
  );
  sys.progression[0].intelligenceModifier = 2;
  computeAgent(sys, [cls], cfg);
  assert.equal(sys.skillPoints[0].available, 24);
});

test("RAW p.92: named bonuses keep the best bonus and worst penalty, while unnamed and dodge stack", () => {
  const sys = system();
  const bonuses = [
    { target: "skills.bluff.misc", value: "2", bonusType: "insight" },
    { target: "skills.bluff.misc", value: "3", bonusType: "insight" },
    { target: "skills.bluff.misc", value: "-1", bonusType: "insight" },
    { target: "skills.bluff.misc", value: "-2", bonusType: "insight" },
    { target: "skills.bluff.misc", value: "1" },
    { target: "defense", value: "1", bonusType: "dodge" },
    { target: "defense", value: "2", bonusType: "dodge" }
  ];
  computeAgent(sys, [cls, { id: "origin", name: "Test Origin", type: "origin", system: { bonuses } }], cfg);
  assert.equal(sys.skillTotals.bluff.bonus, 2); // best +3, worst −2, unnamed +1.
  assert.equal(sys.defense.total, 13);
  assert.equal(
    sys.bonusSources["skills.bluff.misc"].reduce((n, s) => n + s.value, 0),
    2
  );
});
