import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  RESISTANCE_TYPES,
  resistanceType,
  damageResistanceSource,
  damageResistancePlan,
  qualityResistanceReview
} from "../module/rules/resistances.mjs";
import { characterSurvivalStats } from "../module/rules/terrain.mjs";
import { armorTotals } from "../module/rules/gear.mjs";
import { resolveOriginChoices } from "../module/rules/origins.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const origins = JSON.parse(await readFile(new URL("../src/data/origins.json", import.meta.url), "utf8")),
  defs = JSON.parse(await readFile(new URL("../src/data/classes.json", import.meta.url), "utf8")),
  o = origins.specialties.find(o => o.name === "Test Subject"),
  scout = defs.find(c => c.key === "scout"),
  source = () => ({
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
    progression: [{ classId: "scout", vitality: 5, skills: {} }]
  }),
  subject = (first, second = "improvedHearing", other = "") => ({
    id: "subject",
    name: "Test Subject",
    type: "origin",
    system: {
      ...o,
      originChoices: {
        up: "con",
        down: "int",
        npcQuality0: "damageResistance",
        npcDetails0: first,
        npcQuality1: second,
        npcDetails1: other
      }
    }
  }),
  items = [{ id: "scout", name: "Scout", type: "class", system: { ...scout, identifier: "scout", vitalityDie: 10 } }];
test("damage resistance validates its original policy and uses that policy after later gear changes", () => {
  const system = { survivalStats: { resistances: { AD: 4 }, resistanceSources: [] } };
  const source = damageResistanceSource(system, "acid");
  system.survivalStats.resistances.AD = 0;
  assert.equal(damageResistancePlan(system, "acid", 7, source).net, 3);
  assert.equal(damageResistancePlan(system, "acid", 4, source).negatesEffects, true);
  assert.equal(damageResistancePlan(system, "acid", 0, source).negatesEffects, false);
  assert.equal(damageResistancePlan(system, "acid", 4).net, 4);
  for (const patch of [{ key: "FR" }, { resistance: -1 }, { resistance: 0.5 }, { sources: [{}] }, { version: 2 }])
    assert.throws(() => damageResistancePlan(system, "acid", 7, { ...source, ...patch }));
  assert.throws(() => damageResistancePlan(system, "acid", 0.5, source));
});

test("NPC quality resistances share the prepared maximum and independent feat stacking", () => {
  const system = {
    qualityEffects: {
      resistances: [
        { type: "cold", value: 4 },
        { type: "CD", value: 2 }
      ]
    },
    armor: { resistances: { CD: 3 } },
    activeFeatNames: ["Arctic Training"]
  };
  const stats = characterSurvivalStats(system);
  assert.equal(stats.resistances.CD, 11);
  assert.ok(stats.resistanceSources.some(row => row.source === "NPC damage resistance" && row.value === 6));
  assert.deepEqual(qualityResistanceReview(system), []);
  assert.equal(
    qualityResistanceReview({ qualityEffects: { resistances: [{ type: "custom protection", value: 4 }] } }).length,
    1
  );
  assert.equal(
    qualityResistanceReview({
      qualityEffects: {
        resistances: [
          { type: "acid", value: 8 },
          { type: "fire", value: 1 }
        ]
      }
    }).length,
    1
  );
});

test("all sixteen effective damage-resistance types support exact names/codes, both printed acid aliases and electrical names without guessing ambiguous prose", () => {
  assert.equal(Object.keys(RESISTANCE_TYPES).length, 16);
  for (const [key, label] of Object.entries(RESISTANCE_TYPES)) {
    assert.equal(resistanceType(key), key);
    assert.equal(resistanceType(label.toLowerCase()), key);
  }
  assert.equal(resistanceType(" AC "), "AD");
  assert.equal(resistanceType("electric"), "EL");
  assert.equal(resistanceType("electricity"), "EL");
  for (const value of ["lethal", "cold or heat", "constructor", "__proto__", "", null])
    assert.equal(resistanceType(value), null);
});
test("Test Subject resistance choices require a real selected type and retain incomplete legacy prose for review", () => {
  for (const [key, label] of Object.entries(RESISTANCE_TYPES)) {
    const p = resolveOriginChoices(subject(label), source(), [], cfg),
      effect = p.notes.find(e => e.qualityKey === "damageResistance");
    assert.equal(effect.resistanceType, key);
    assert.equal(
      p.pending.some(t => t.includes("damage type")),
      false
    );
  }
  const s = computeAgent(source(), [...items, subject("cold or heat")], cfg);
  assert.deepEqual(s.survivalStats.resistances, {});
  assert.ok(s.todo.some(t => t.text.includes("choose the damage type")));
  assert.equal(s.originEffects.find(e => e.qualityKey === "damageResistance").details, "cold or heat");
});
test("the full engine derives each selected four-point resistance, repeated same-type eight points and independent type choices", () => {
  for (const key of Object.keys(RESISTANCE_TYPES)) {
    const s = computeAgent(source(), [...items, subject(key)], cfg);
    assert.equal(s.survivalStats.resistances[key], 4, key);
  }
  const repeated = computeAgent(source(), [...items, subject("CD", "damageResistance", "cold")], cfg);
  assert.equal(repeated.survivalStats.resistances.CD, 8);
  const mixed = computeAgent(source(), [...items, subject("AD", "damageResistance", "EL")], cfg);
  assert.deepEqual(mixed.survivalStats.resistances, { AD: 4, EL: 4 });
});
test("quality resistance competes with identical gear/class resistance before independent feats add; armor immunity remains immunity", () => {
  const s = {
    activeFeatNames: ["Arctic Training", "Battle Hardened"],
    classLevels: { grunt: 4 },
    abilities: { con: { mod: 3 } },
    armor: { resistances: { CD: 4 } },
    originEffects: [
      { qualityKey: "damageResistance", resistanceType: "CD" },
      { qualityKey: "damageResistance", resistanceType: "CD" },
      { qualityKey: "damageResistance", resistanceType: "stress" }
    ]
  };
  const p = characterSurvivalStats(s);
  assert.equal(p.resistances.CD, 13);
  assert.equal(p.resistances.stress, 6);
  assert.equal(p.resistances.subdual, 3);
  s.abilities.con.mod = 6;
  assert.equal(characterSurvivalStats(s).resistances.stress, 8);
  s.armor.resistances.CD = "all";
  assert.equal(characterSurvivalStats(s).resistances.CD, "all");
  assert.equal(s.armor.resistances.CD, "all");
});
test("Battle Hardened, Vital Points Basics and Cool-Headed have exact sources, class milestones and nonnegative Constitution amounts", () => {
  for (let grunt = 0; grunt <= 10; grunt++)
    for (let con = -2; con <= 6; con++) {
      const s = {
          classLevels: { grunt },
          abilities: { con: { mod: con } },
          activeFeatNames: ["Battle Hardened", "Vital Points Basics"]
        },
        p = characterSurvivalStats(s),
        base = grunt >= 4 ? Math.max(0, con) : 0;
      assert.equal(p.resistances.stress, base + 2);
      assert.equal(p.resistances.subdual ?? 0, base);
      assert.equal(p.resistances.sneakAttack, 6);
    }
  assert.deepEqual(characterSurvivalStats({}).resistances, {});
});
test("armor’s AC/AD acid spellings combine correctly across pieces and preserve all other codes and per-type immunity", () => {
  const a = armorTotals([
    { id: "body", name: "Body", type: "armor", system: { equipped: true, armorSlot: "body", resistances: "AC4, EL4" } },
    {
      id: "helmet",
      name: "Helmet",
      type: "armor",
      system: { equipped: true, armorSlot: "helmet", resistances: "ad2, cD (ALL)" }
    }
  ]);
  assert.deepEqual(a.armor.resistances, { AD: 6, EL: 4, CD: "all" });
});
