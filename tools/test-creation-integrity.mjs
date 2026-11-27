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

test("an unnamed contact cannot silently complete Training even when its grade spends the final choice", () => {
  const s = agent(1, { contacts: [{ name: " ", rank: 1 }] });
  computeAgent(s, [cls], cfg);
  assert.equal(s.contactPicks.remaining, 0);
  assert.ok(s.todo.some(t => t.tab === "training" && t.error && /Contact 1/.test(t.text)));
  assert.equal(s.contacts[0].name, " ");
});
test("malformed contact grades cannot spend negative choices or hide invalid saved rows", () => {
  for (const rank of [-1, 0, 1.5, 5, Infinity, "1", null]) {
    const s = agent(1, {
      contacts: [
        { name: "Valid", rank: 1 },
        { name: "Review", rank }
      ]
    });
    computeAgent(s, [cls], cfg);
    assert.equal(s.contactPicks.used, 1);
    assert.equal(s.contacts[1].rank, rank);
    assert.ok(
      s.todo.some(t => t.error && /whole grade/.test(t.text)),
      String(rank)
    );
  }
});
test("contact names must identify distinct choices and over-budget grades remain setup errors", () => {
  const s = agent(1, {
    contacts: [
      { name: "Ada", rank: 1 },
      { name: " ada ", rank: 1 }
    ]
  });
  computeAgent(s, [cls], cfg);
  assert.equal(s.contactPicks.used, 2);
  assert.equal(s.contacts.length, 2);
  assert.ok(s.todo.some(t => t.error && /distinct names/.test(t.text)));
  assert.ok(s.todo.some(t => t.error && /Contacts:.*over the limit/.test(t.text)));
});
test("blank and duplicate focus entries give no extra focus and remain visible for correction", () => {
  const s = agent(1, { focuses: { cultures: [" ", "North America", " north america "] } });
  computeAgent(s, [cls], cfg);
  assert.deepEqual(s.focusTotals.cultures, ["North America"]);
  assert.equal(s.focuses.cultures.length, 3);
  assert.ok(s.todo.some(t => t.error && /name each focus/.test(t.text)));
  assert.ok(s.todo.some(t => t.error && /distinct focuses/.test(t.text)));
});
test("excess focus picks and duplicate or excess Interests keep Training unfinished", () => {
  for (const patch of [
    { focuses: { cultures: ["A", "B", "C", "D"] } },
    { interests: "Chess, chess" },
    { interests: "A, B, C, D, E, F, G, H" }
  ]) {
    const s = agent(1, patch);
    computeAgent(s, [cls], cfg);
    assert.ok(s.todo.some(t => t.tab === "training" && t.error));
  }
});
test("invalid, unearned and unknown proficiency selections remain setup errors without granting benefits", () => {
  for (const patch of [
    { edged: { forte: true } },
    { edged: { proficient: "false" } },
    { mystery: { proficient: true } }
  ]) {
    const s = agent(1, { proficiencies: patch });
    computeAgent(s, [cls], cfg);
    assert.ok(s.todo.some(t => t.tab === "training" && t.error));
    assert.equal(s.proficiencyTotals.edged.forte, false);
    if (patch.edged?.proficient === "false") assert.equal(s.proficiencyTotals.edged.proficient, false);
  }
  const s = agent(1, {
    proficiencies: Object.fromEntries(
      Object.keys(cfg.proficiencies).map(key => [key, { proficient: true, forte: true }])
    )
  });
  computeAgent(s, [cls], cfg);
  assert.ok(s.proficiencyPicks.remaining < 0);
  assert.ok(s.todo.some(t => t.tab === "training" && t.error));
});
test("too many unfinished Subplots remain setup errors while completed Subplots do not consume the allowance", () => {
  const s = agent(1, {
    subplots: [
      { name: "A", complete: false },
      { name: "B", complete: false }
    ]
  });
  computeAgent(s, [cls], cfg);
  assert.ok(s.todo.some(t => t.error && /Subplots:/.test(t.text)));
  s.subplots[1].complete = true;
  computeAgent(s, [cls], cfg);
  assert.ok(!s.todo.some(t => t.error && /Subplots:/.test(t.text)));
});
test("legal named contacts, interests, focuses and proficiency choices acquire no new Training error", () => {
  const s = agent(1, {
    contacts: [{ name: "Ada", rank: 1 }],
    interests: "Chess",
    focuses: { cultures: ["North America"] }
  });
  computeAgent(s, [cls], cfg);
  assert.ok(!s.todo.some(t => t.tab === "training" && t.error));
});
