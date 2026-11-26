import test from "node:test";
import assert from "node:assert/strict";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";

const cls = {
  id: "test",
  name: "Test",
  type: "class",
  system: { identifier: "test", table: [], classSkills: [], vitalityDie: 6, skillPoints: 4 }
};
function agent(level = 4, patch = {}) {
  return {
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
    progression: Array.from({ length: level }, () => ({ classId: "test", vitality: 3, skills: {} })),
    abilityIncreases: { l4: "str" },
    misc: {},
    ...patch
  };
}
test("creation flags an invalid earned attribute increase instead of considering it assigned", () => {
  const s = computeAgent(agent(4, { abilityIncreases: { l4: "strength" } }), [cls], cfg);
  assert.ok(s.todo.some(t => t.tab === "main" && /attribute increase/.test(t.text)));
  assert.equal(s.abilities.str.increase, 0);
});
test("invalid creation scores remain visible as setup errors even when their point cost is zero", () => {
  const s = agent(1);
  s.abilities.str.base = 19;
  computeAgent(s, [cls], cfg);
  assert.ok(s.todo.some(t => t.error && t.tab === "main" && /STR/.test(t.text)));
  assert.equal(s.abilities.str.base, 19);
});
test("stored vitality must be a whole result within its class die; invalid values cannot inflate health", () => {
  for (const value of [7, 99, -2, 2.5, Infinity, "99"]) {
    const s = agent(2);
    s.progression[1].vitality = value;
    computeAgent(s, [cls], cfg);
    assert.ok(
      s.todo.some(t => t.error && t.tab === "classes" && /[Vv]itality/.test(t.text)),
      String(value)
    );
    assert.equal(s.vitality.max, 8);
    assert.equal(s.progression[1].vitality, value);
  }
});
test("first-level maximum, later die boundaries and missing rolls retain their separate rules", () => {
  for (const value of [1, 6]) {
    const s = agent(2);
    s.progression[0].vitality = 99;
    s.progression[1].vitality = value;
    computeAgent(s, [cls], cfg);
    assert.equal(s.vitality.max, 8 + value);
    assert.ok(!s.todo.some(t => t.error && /[Vv]itality/.test(t.text)));
  }
  const s = agent(2);
  s.progression[1].vitality = 0;
  computeAgent(s, [cls], cfg);
  assert.ok(s.todo.some(t => /Vitality not rolled/.test(t.text)));
});
