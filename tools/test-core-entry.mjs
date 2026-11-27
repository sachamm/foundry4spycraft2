// These fixtures supply required gear unless a case explicitly overrides gearStatus; absence/kit boundaries are tested in test-skill-gear.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { isolatedClassAbilityCalculation as computeAgent } from "./lib/class-ability-fixture.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
const classes = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))),
  feats = JSON.parse(readFileSync(new URL("../src/data/feats.json", import.meta.url)));
const cls = key => {
  const c = structuredClone(classes.find(c => c.key === key));
  return { id: key, name: c.name, type: "class", system: { ...c, identifier: key, vitalityDie: c.vitality } };
};
function compute(items, ids) {
  return computeAgent(
    {
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 10 }])),
      progression: ids.map(classId => ({ classId, vitality: 1, skills: {} })),
      skills: {},
      focuses: { profession: ["Artist", "Engineer", "Teacher"] },
      misc: {}
    },
    items,
    cfg
  );
}

test("only the first base and first expert class supply core abilities", () => {
  const items = ["soldier", "intruder", "counterterrorist", "schemer"].map(cls),
    sys = compute(items, ["soldier", "intruder", "counterterrorist", "schemer"]);
  assert.deepEqual(sys.coreClassIds, ["soldier", "counterterrorist"]);
  assert.equal(sys.coreAbilities.length, 2);
});

test("Virtuoso Profession key and related focuses both receive Field of Expertise, but only the key receives Meticulous", () => {
  const item = cls("virtuoso");
  item.system.keySkill = "profession";
  item.system.keyFocus = "Artist";
  item.system.professionFocus = "Engineer";
  const sys = compute([item], ["virtuoso"]),
    check = cfg.skills.profession.checks[0];
  sys.skillTotals.profession.ranks = 1;
  const artist = resolveSkillCheck(sys, "profession", check, {
      gearStatus: "available",
      focus: "Artist",
      synergySkill: "none"
    }),
    engineer = resolveSkillCheck(sys, "profession", check, {
      gearStatus: "available",
      focus: "Engineer",
      synergySkill: "none"
    }),
    teacher = resolveSkillCheck(sys, "profession", check, {
      gearStatus: "available",
      focus: "Teacher",
      synergySkill: "none"
    });
  assert.equal(artist.total, teacher.total + 2);
  assert.equal(engineer.total, teacher.total + 2);
  assert.equal(artist.threat, 19);
  assert.equal(engineer.threat, 19);
  assert.equal(artist.error, 0);
  assert.equal(engineer.error, check.error);
});

test("core active-check overrides affect only their specified skills", () => {
  const passive = {
    id: "test",
    name: "Test",
    mode: "Passive",
    attributes: ["wis"],
    tags: "",
    time: "1 Free Action",
    error: 1
  };
  const system = {
    coreClassIds: ["fieldAnalyst"],
    skillTotals: {
      notice: { ranks: 1, totals: [{ ability: "wis", total: 1 }], threat: 20, cap: 20 },
      search: { ranks: 1, totals: [{ ability: "wis", total: 1 }], threat: 20, cap: 20 }
    }
  };
  assert.equal(resolveSkillCheck(system, "notice", passive, { gearStatus: "available" }).rollMode, undefined);
  assert.equal(resolveSkillCheck(system, "search", passive, { gearStatus: "available" }).rollMode, "blindroll");
});

test("temporary feats do not consume career slots or stack repeatable benefits already permanently possessed", () => {
  const definition = feats.find(f => f.name === "Great Fortitude"),
    permanent = {
      id: "permanent",
      name: definition.name,
      type: "feat",
      system: { ...definition, granted: false, acquiredAtLevel: 1 }
    },
    temporary = {
      id: "temporary",
      name: definition.name,
      type: "feat",
      system: { ...definition, featKind: "temporary", granted: false, acquiredAtLevel: 1 }
    };
  const base = compute([cls("soldier"), permanent], ["soldier"]),
    withTemp = compute([cls("soldier"), temporary, permanent], ["soldier"]);
  assert.equal(withTemp.feats.any.spent, base.feats.any.spent);
  assert.equal(withTemp.wounds.max, base.wounds.max);
  assert.equal(withTemp.saves.fort.base, base.saves.fort.base);
  assert.equal(compute([cls("soldier"), temporary], ["soldier"]).feats.any.spent, 0);
});
