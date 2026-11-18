// These fixtures supply required gear unless a case explicitly overrides gearStatus; absence/kit boundaries are tested in test-skill-gear.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
const classes = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url)));

test("RAW p.86: Virtuoso benefits apply only to the chosen key focus and related Profession focus", () => {
  const cls = classes.find(c => c.key === "virtuoso");
  const item = {
    id: "virtuoso",
    name: "Virtuoso",
    type: "class",
    system: {
      ...cls,
      identifier: "virtuoso",
      vitalityDie: cls.vitality,
      keySkill: "science",
      keyFocus: "Engineering",
      professionFocus: "Architect"
    }
  };
  const sys = {
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 10 }])),
    progression: [{ classId: "virtuoso", skills: { science: 1 }, vitality: 6 }],
    skills: {},
    focuses: { science: ["Engineering", "Genetics"], profession: ["Architect", "Teacher"] },
    wealthAllocation: { lifestyle: 2 },
    misc: {}
  };
  computeAgent(sys, [item], cfg);
  const engineering = cfg.skills.science.checks.find(c => c.id === "engineering");
  const chosen = resolveSkillCheck(sys, "science", engineering, { gearStatus: "available", focus: "Engineering" });
  const other = resolveSkillCheck(sys, "science", engineering, { gearStatus: "available", focus: "Genetics" });
  assert.equal(chosen.total, other.total + 2);
  assert.equal(chosen.threat, 19);
  assert.equal(other.threat, 20);
  const profession = cfg.skills.profession.checks[0];
  const architect = resolveSkillCheck(sys, "profession", profession, { gearStatus: "available", focus: "Architect" });
  const teacher = resolveSkillCheck(sys, "profession", profession, { gearStatus: "available", focus: "Teacher" });
  assert.equal(architect.total, teacher.total + 2);
  assert.equal(architect.threat, 19);
  assert.equal(teacher.threat, 20);
});
