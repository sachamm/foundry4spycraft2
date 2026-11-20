import test from "node:test";
import assert from "node:assert/strict";
import { weaponDamage, whateversHandyBonus, deadToRightsDice } from "../module/rules/gear.mjs";

const system = classLevels => ({ classLevels, bab: 0, abilities: { str: { mod: 0 }, dex: { mod: 0 } } });

test("Dead to Rights adds 1d4 to tactical weapon damage from Grunt 2nd and 2d4 from 7th", () => {
  const tactical = { proficiency: "tactical", damage: "2d10" },
    rifle = { proficiency: "rifle", damage: "2d10" };
  assert.equal(deadToRightsDice(system({ grunt: 1 }), tactical), 0);
  assert.equal(deadToRightsDice(system({ grunt: 2 }), tactical), 1);
  assert.equal(deadToRightsDice(system({ grunt: 7 }), tactical), 2);
  assert.equal(deadToRightsDice(system({ grunt: 9 }), rifle), 0);
  assert.equal(weaponDamage(system({ grunt: 1 }), tactical).formula, "max(1, 2d10 + (0))");
  assert.equal(weaponDamage(system({ grunt: 2 }), tactical).formula, "max(1, 2d10 + 1d4 + (0))");
  assert.equal(weaponDamage(system({ grunt: 7 }), tactical).formula, "max(1, 2d10 + 2d4 + (0))");
  assert.equal(weaponDamage(system({ grunt: 7 }), rifle).formula, "max(1, 2d10 + (0))");
});

test("Whatever's Handy rises from +1 to +2 at Brawler 5th and +3 at 9th", () => {
  assert.deepEqual(
    [0, 1, 4, 5, 8, 9, 10].map(level => whateversHandyBonus(system({ brawler: level }))),
    [0, 1, 1, 2, 2, 3, 3]
  );
  const improvised = { proficiency: "blunt", damage: "1d6", improvised: true };
  const without = weaponDamage(system({}), improvised).bonus;
  assert.equal(weaponDamage(system({ brawler: 1 }), improvised).bonus - without, 1);
  assert.equal(weaponDamage(system({ brawler: 5 }), improvised).bonus - without, 2);
  assert.equal(weaponDamage(system({ brawler: 9 }), improvised).bonus - without, 3);
});

test("Gunplay raises the Count for each handgun hit; Juggernaut converts up to half a lethal hit", async () => {
  const { gunplayCountGain, juggernautConversion, stratagemCountGain } =
    await import("../module/rules/class-combat.mjs");
  assert.equal(gunplayCountGain(system({ triggerman: 1 }), "handgun", 1), 0);
  assert.equal(gunplayCountGain(system({ triggerman: 2 }), "handgun", 1), 1);
  assert.equal(gunplayCountGain(system({ triggerman: 7 }), "handgun", 3), 6);
  assert.equal(gunplayCountGain(system({ triggerman: 7 }), "rifle", 3), 0);
  assert.equal(gunplayCountGain(system({ triggerman: 7 }), "handgun", 0), 0);
  assert.equal(juggernautConversion(system({ brawler: 9 }), 11), 0);
  assert.equal(juggernautConversion(system({ brawler: 10 }), 11), 5);
  assert.deepEqual(
    [1, 2, 6, 7].map(level => stratagemCountGain(system({ tactician: level }))),
    [0, 1, 1, 2]
  );
});

test("Fall Guy lowers each falling damage die by 2, on top of Spider Mastery", async () => {
  const { fallDistancePlan } = await import("../module/rules/fall-distance.mjs");
  const fall = { fallDeclared: true, fallDistanceFeet: 40, fallSoftSurface: false, fallConfirmed: true };
  assert.equal(
    fallDistancePlan({ activeFeatNames: [], classLevels: { stuntman: 3 } }, fall).perDieReduction,
    undefined
  );
  assert.equal(fallDistancePlan({ activeFeatNames: [], classLevels: { stuntman: 4 } }, fall).perDieReduction, 2);
  assert.equal(
    fallDistancePlan({ activeFeatNames: ["Spider Mastery"], classLevels: { stuntman: 4 } }, fall).perDieReduction,
    3
  );
});

test("counted class abilities appear with the limit their class level sets", async () => {
  const { classAbilityUseSpecs, CLASS_ABILITY_USES } = await import("../module/rules/class-ability-uses.mjs");
  const byName = levels => Object.fromEntries(classAbilityUseSpecs({ classLevels: levels }).map(s => [s.name, s]));
  assert.deepEqual(classAbilityUseSpecs({ classLevels: { faceman: 1 } }), []);
  assert.equal(byName({ faceman: 2 })["Cold Read"].limit, 1);
  assert.equal(byName({ faceman: 11 })["Quick Change"].limit, 6);
  assert.equal(byName({ faceman: 11 })["Cold Read"].limit, 2);
  assert.equal(byName({ hacker: 19 })["Trap Door"].period, "mission");
  const strike = byName({ counterterrorist: 10 })["First Strike"];
  assert.equal(strike.period, "combat");
  assert.equal(strike.combatScoped, true);
  assert.equal(strike.workflow, "manual");
  const ids = CLASS_ABILITY_USES.map(([key, name]) => `${key}:${name}`);
  assert.equal(new Set(ids).size, ids.length);
});

test("a Career Level 0 agent has 6 vitality, replaced by the first class level", async () => {
  const { computeAgent } = await import("../module/rules/engine.mjs");
  const { SPYCRAFT } = await import("../module/config.mjs");
  const { readFileSync } = await import("node:fs");
  const soldier = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))).find(
    c => c.key === "soldier"
  );
  const build = (progression, items) =>
    computeAgent(
      {
        abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 14 }])),
        progression,
        actionDice: { value: 2 },
        wounds: { value: 4 },
        vitality: { value: 4 }
      },
      items,
      SPYCRAFT
    );
  assert.equal(build([], []).vitality.max, 6);
  const item = {
    id: "soldier",
    name: soldier.name,
    type: "class",
    system: { ...soldier, identifier: "soldier", vitalityDie: soldier.vitality }
  };
  assert.equal(build([{ classId: "soldier", vitality: 6, skills: {} }], [item]).vitality.max, soldier.vitality + 2);
});
