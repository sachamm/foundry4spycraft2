import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { mentalLeapRecord } from "../module/rules/mental-leap.mjs";
const defs = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))),
  ci = id => {
    const c = defs.find(c => c.key === id);
    return { id, name: c.name, type: "class", system: { ...c, identifier: id, vitalityDie: c.vitality } };
  },
  schemer = ci("schemer"),
  soldier = ci("soldier");
const source = (level = 10) => ({
    worldTime: 0,
    abilities: Object.fromEntries(
      ["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: k === "int" ? 15 : 12 }])
    ),
    progression: [
      ...Array.from({ length: 4 }, () => ({ classId: "soldier", vitality: 6, skills: {} })),
      ...Array.from({ length: level }, () => ({ classId: "schemer", vitality: 6, skills: {} }))
    ],
    actionDice: { value: 0 }
  }),
  compute = s => computeAgent(s, [soldier, schemer], cfg);
test("Evolved Mind grants exactly twelve points at the sixth Schemer level and Hyperconscious twenty-four at the tenth, never retroactively or at other levels", () => {
  for (let level = 0; level <= 10; level++) {
    const s = compute(source(level));
    for (const p of s.skillPoints) {
      const n = p.level - 4,
        expected = p.classId === "schemer" ? (n === 6 ? 12 : n === 10 ? 24 : 0) : 0;
      assert.equal(p.classGrantPoints, expected);
      const ordinary = p.classId === "soldier" ? (p.level === 1 ? 24 : 6) : 10;
      assert.equal(p.available, ordinary + expected);
    }
    assert.equal(
      s.skillPoints.reduce((n, p) => n + p.classGrantPoints, 0),
      (level >= 6 ? 12 : 0) + (level >= 10 ? 24 : 0)
    );
  }
});
test("all thirty skills become Schemer class skills beginning with class level six, preserving every historical pre-six price", () => {
  for (const key of Object.keys(cfg.skills)) {
    for (const level of [5, 6, 7, 10]) {
      const raw = source(level);
      raw.progression.at(-1).skills[key] = 1;
      const s = compute(raw),
        p = s.skillPoints.at(-1),
        native = schemer.system.classSkills.includes(key);
      assert.equal(p.classSkills.includes(key), native || level >= 6, key + "/" + level);
      assert.equal(s.skillTotals[key].ranks, native || level >= 6 ? 1 : 0, key + "/" + level);
      assert.equal(
        s.skillTotals[key].isClass,
        true === (native || level >= 6 || soldier.system.classSkills.includes(key))
      );
    }
    if (!schemer.system.classSkills.includes(key)) {
      const raw = source(10);
      raw.progression[8].skills[key] = 1;
      const s = compute(raw);
      assert.equal(s.skillTotals[key].ranks, 0);
      assert.ok(s.warnings.some(w => w.startsWith("Level 9:") && w.includes("cross-class ranks")));
    }
  }
});
test("expanded class-skill pricing remains Schemer-only in later multiclass levels and exact acquisition grants survive current INT damage/temporary boosts", () => {
  const raw = source(6);
  raw.progression[9].skills.acrobatics = 1;
  raw.progression.push({ classId: "soldier", vitality: 6, skills: { acrobatics: 2 } });
  let s = compute(raw);
  assert.equal(s.skillTotals.acrobatics.ranks, 2);
  assert.equal(s.skillPoints[9].classSkills.includes("acrobatics"), true);
  assert.equal(s.skillPoints[10].classSkills.includes("acrobatics"), false);
  raw.progression[10].skills.acrobatics = 1;
  s = compute(raw);
  assert.equal(s.skillTotals.acrobatics.ranks, 1);
  assert.ok(s.warnings.some(w => w.startsWith("Level 11:") && w.includes("cross-class")));
  const base = compute(source()),
    damaged = source();
  damaged.abilities.int.misc = -8;
  assert.deepEqual(
    compute(damaged).skillPoints.map(p => p.available),
    base.skillPoints.map(p => p.available)
  );
  const active = source();
  active.mentalLeaps = [mentalLeapRecord(base, { id: "mental", ability: "int" })];
  assert.deepEqual(
    compute(active).skillPoints.map(p => p.available),
    base.skillPoints.map(p => p.available)
  );
});
