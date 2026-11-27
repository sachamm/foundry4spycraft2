import test from "node:test";
import assert from "node:assert/strict";
import { classFeatureLevels, expertClassQualification } from "../module/rules/class-features.mjs";
import { readFileSync } from "node:fs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { whateversHandyBonus, deadToRightsDice } from "../module/rules/gear.mjs";

const definition = {
  requirements: {
    type: "all",
    of: [
      { type: "ability", key: "dex", min: 13 },
      { type: "feat", name: "Required Feat" }
    ]
  }
};
const context = (dex = 14, feat = true) => ({
  abilities: { dex },
  hasFeat: name => feat && name.toLowerCase() === "required feat"
});
const entry = { expertEntry: { ok: true, unmet: [] } };

test("current expert requirements must still hold after a legal recorded entry", () => {
  assert.equal(expertClassQualification(definition, entry, context()).active, true);
  assert.equal(expertClassQualification(definition, entry, context(12)).active, false);
  assert.equal(expertClassQualification(definition, entry, context(14, false)).active, false);
  assert.equal(expertClassQualification(definition, entry, context()).active, true);
});

test("unknown entry history stays explicit; invalid or malformed entry evidence never grants abilities", () => {
  const unknown = expertClassQualification(definition, {}, context());
  assert.equal(unknown.entryNeedsReview, true);
  assert.equal(unknown.active, true);
  assert.equal(expertClassQualification(definition, {}, context(12)).active, false);
  assert.equal(
    expertClassQualification(definition, { expertEntry: { ok: false, unmet: ["Missing original feat"] } }, context())
      .active,
    false
  );
  const malformed = expertClassQualification(
    definition,
    { expertEntry: { ok: true, unmet: ["Contradictory entry"] } },
    context()
  );
  assert.equal(malformed.active, false);
  assert.equal(malformed.malformedEntry, true);
});

test("ability levels can be inactive without deleting owned class progression", () => {
  const system = { classLevels: { soldier: 4, brawler: 1 }, activeClassLevels: { soldier: 4, brawler: 0 } };
  assert.equal(classFeatureLevels(system).brawler, 0);
  assert.equal(system.classLevels.brawler, 1);
  assert.deepEqual(classFeatureLevels({ classLevels: { brawler: 1 } }), { brawler: 1 });
  assert.deepEqual(classFeatureLevels(null), {});
});

const classes = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url)));
const feats = JSON.parse(readFileSync(new URL("../src/data/feats.json", import.meta.url)));
function brawler(hasRequirement, { levels = 1, lostRank = false, fullFeatAllowance = false } = {}) {
  const progression = Array.from({ length: 4 }, (_, i) => ({
    classId: "soldier",
    vitality: 6,
    skills: { intimidate: i === 0 ? 4 : i < (lostRank ? 2 : 3) ? 1 : 0 }
  }));
  for (let i = 0; i < levels; i++)
    progression.push({
      classId: "brawler",
      vitality: 6,
      skills: {},
      ...(i === 0 ? { expertEntry: { ok: true, unmet: [] } } : {})
    });
  const items = ["soldier", "brawler"].map(key => {
    const cls = classes.find(c => c.key === key);
    return {
      id: key,
      name: cls.name,
      type: "class",
      system: {
        ...structuredClone(cls),
        identifier: key,
        vitalityDie: cls.vitality,
        choices: key === "soldier" ? { 0: 3, 1: 3 } : { 1: 3 }
      }
    };
  });
  const selections = fullFeatAllowance
    ? [
        ["Improvised Weapon Basics", 1],
        ["Great Fortitude", 1],
        ["Iron Will", 3],
        ["Lightning Reflexes", 3],
        ["Combat Expertise", 6],
        ["Wrestling Basics", 8]
      ]
    : [["Great Fortitude", 3], ...(hasRequirement ? [["Improvised Weapon Basics", 1]] : [])];
  for (const [name, career] of selections) {
    items.push({
      id: name,
      name,
      type: "feat",
      system: {
        ...structuredClone(feats.find(f => f.name === name)),
        tree: feats
          .find(f => f.name === name)
          .tree.replace(/^./, c => c.toLowerCase())
          .replaceAll(" ", ""),
        featKind: "permanent",
        acquiredAtLevel: career
      }
    });
  }
  return computeAgent(
    {
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(key => [key, { base: 14 }])),
      progression,
      skills: {},
      focuses: {},
      proficiencies: { unarmed: { proficient: true } },
      misc: {},
      vitality: { value: 20 },
      wounds: { value: 14 },
      resourceUses: { priorUse: { used: 1 } }
    },
    items,
    cfg
  );
}

test("losing an expert prerequisite removes core and weapon abilities while retaining progression, health, ranks and other feats", () => {
  const qualified = brawler(true),
    suspended = brawler(false),
    restored = brawler(true);
  assert.equal(qualified.expertClassStatus.brawler.active, true);
  assert.equal(suspended.expertClassStatus.brawler.active, false);
  assert.equal(qualified.coreClassIds.includes("brawler"), true);
  assert.equal(suspended.coreClassIds.includes("brawler"), false);
  assert.equal(whateversHandyBonus(qualified), 1);
  assert.equal(whateversHandyBonus(suspended), 0);
  assert.equal(whateversHandyBonus(restored), 1);
  assert.deepEqual(suspended.base, qualified.base);
  assert.deepEqual(suspended.classLevels, qualified.classLevels);
  assert.equal(suspended.vitality.max, qualified.vitality.max);
  assert.equal(suspended.wounds.max, qualified.wounds.max);
  assert.equal(suspended.skillTotals.intimidate.ranks, 6);
  assert.equal(suspended.featStatus["Great Fortitude"].ok, true);
  assert.deepEqual(suspended.resourceUses, qualified.resourceUses);
});

test("a previously acquired expert bonus feat stays active when the class loses a skill requirement", () => {
  const qualified = brawler(true, { levels: 4, fullFeatAllowance: true });
  const suspended = brawler(true, { levels: 4, lostRank: true, fullFeatAllowance: true });
  assert.equal(qualified.expertClassStatus.brawler.active, true);
  assert.equal(suspended.expertClassStatus.brawler.active, false);
  assert.equal(qualified.activeFeatNames.length, 6);
  assert.equal(suspended.activeFeatNames.length, 6);
  assert.equal(suspended.featStatus["Wrestling Basics"].ok, true);
  assert.equal(qualified.subdualThreshold - suspended.subdualThreshold, 4);
  assert.deepEqual(suspended.base, qualified.base);
});

test("losing an attribute requirement suspends a qualified Grunt's conditional weapon dice and core ability", () => {
  const derive = strength => {
    const progression = [
      ...Array.from({ length: 4 }, () => ({ classId: "soldier", vitality: 6, skills: {} })),
      { classId: "grunt", vitality: 6, skills: {}, expertEntry: { ok: true, unmet: [] } },
      { classId: "grunt", vitality: 6, skills: {} }
    ];
    const items = ["soldier", "grunt"].map(key => {
      const cls = classes.find(c => c.key === key);
      return {
        id: key,
        name: cls.name,
        type: "class",
        system: { ...structuredClone(cls), identifier: key, vitalityDie: cls.vitality, choices: {} }
      };
    });
    return computeAgent(
      {
        abilities: Object.fromEntries(
          ["str", "dex", "con", "int", "wis", "cha"].map(key => [key, { base: key === "str" ? strength : 14 }])
        ),
        progression,
        skills: {},
        focuses: {},
        proficiencies: { tactical: { proficient: true } },
        misc: {}
      },
      items,
      cfg
    );
  };
  const qualified = derive(16),
    suspended = derive(14);
  assert.equal(qualified.expertClassStatus.grunt.active, true);
  assert.equal(suspended.expertClassStatus.grunt.active, false);
  assert.equal(deadToRightsDice(qualified, { proficiency: "tactical" }), 1);
  assert.equal(deadToRightsDice(suspended, { proficiency: "tactical" }), 0);
  assert.equal(suspended.coreClassIds.includes("grunt"), false);
  assert.deepEqual(suspended.base, qualified.base);
});
