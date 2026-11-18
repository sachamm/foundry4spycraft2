import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { computeAgent, prerequisiteContext } from "../module/rules/engine.mjs";
import { checkPrerequisites, describe } from "../module/rules/prerequisites.mjs";
import { extraGearCategory } from "../module/rules/feats.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const definitions = JSON.parse(await readFile(new URL("../src/data/feats.json", import.meta.url), "utf8")),
  classes = JSON.parse(await readFile(new URL("../src/data/classes.json", import.meta.url), "utf8"));
const choices = { "Electronic Warrior": "Electronics", "Micro-miniaturized": "Gadgets", "Trap Master": "Security" },
  focuses = {
    "Firefighter Training": ["Engineering", 3],
    Cryptographer: ["Mathematics", 4],
    "Disease Basics": ["Genetics", 3],
    "Poison Basics": ["Pharmacology", 3]
  },
  categories = {
    Electronics: "E",
    Gadgets: "G",
    Resources: "R",
    Security: "S",
    Tradecraft: "T",
    Vehicles: "V",
    Weapons: "W"
  };
const definition = name => definitions.find(f => f.name === name),
  feat = (name, patch = {}, id = name) => ({
    id,
    name,
    type: "feat",
    system: {
      ...structuredClone(definition(name)),
      tree: name === "Extra Gear" ? "gear" : "tradecraft",
      acquiredAtLevel: 1,
      ...patch
    }
  });
function agent(feats = [], { science = 3, focus = "Engineering", level = 3 } = {}) {
  const d = classes.find(c => c.key === "scientist"),
    items = [
      { id: "scientist", name: "Scientist", type: "class", system: { ...d, identifier: "scientist", vitalityDie: 8 } },
      ...feats
    ],
    system = {
      usagePeriods: { session: "s" },
      startingIntelligenceModifier: 3,
      focuses: { science: focus ? [focus] : [] },
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 16 }])),
      progression: Array.from({ length: level }, (_, i) => ({
        classId: "scientist",
        vitality: 4,
        skills: { science: i === 0 ? science : 0 }
      }))
    };
  return { items, system: computeAgent(system, items, cfg) };
}
test("Extra Gear category aliases share the same canonical benefit/prerequisite mapping across all seven categories", () => {
  for (const [label, key] of Object.entries(categories))
    for (const choice of [label, label.toLowerCase(), " " + label.toUpperCase() + " ", key, key.toLowerCase()])
      assert.equal(extraGearCategory(choice), key);
  for (const bad of ["", null, "Electronic", "Extra Gear (Electronics)", "X"])
    assert.equal(extraGearCategory(bad), null);
});
test("every Extra Gear prerequisite requires its exact earned choice, not merely possession of Extra Gear or a GC waiver", () => {
  for (const [name, required] of Object.entries(choices))
    for (const [label, key] of Object.entries(categories))
      for (const choice of [label, key]) {
        const gear = feat("Extra Gear", { choice }),
          target = feat(name),
          s = agent([gear, target]).system;
        assert.equal(s.featStatus[name].ok, label === required, name + "/" + choice);
      }
  for (const name of Object.keys(choices)) {
    const s = agent([feat(name, { manualPrerequisitesConfirmed: true })]).system;
    assert.equal(s.featStatus[name].ok, false);
  }
});
test("all four focused Science prerequisites enforce both purchased ranks and the actual focus, even with manual confirmation", () => {
  for (const [name, [focus, min]] of Object.entries(focuses))
    for (const ranks of [0, min - 1, min])
      for (const selected of [focus, "Biology", ""]) {
        const f = feat(name, { manualPrerequisitesConfirmed: true }),
          s = agent([f], { science: ranks, focus: selected, level: 3 }).system;
        assert.equal(s.featStatus[name].ok, ranks >= min && selected === focus, name + "/" + ranks + "/" + selected);
      }
});
test("all seven catalog prerequisites use supported specific nodes and retain their independent feat/rank clauses", () => {
  const leaves = n => (n.of ? n.of.flatMap(leaves) : [n]);
  for (const [name, choice] of Object.entries(choices)) {
    const d = definition(name),
      nodes = leaves(d.prerequisites);
    assert.equal(d.notChecked, false);
    assert.ok(nodes.some(n => n.type === "featChoice" && n.name === "Extra Gear" && n.choice === choice));
    assert.equal(
      nodes.some(n => n.type === "manual"),
      false
    );
    assert.equal(describe(nodes.find(n => n.type === "featChoice")), `Extra Gear (${choice})`);
  }
  for (const [name, [focus, min]] of Object.entries(focuses)) {
    const d = definition(name),
      nodes = leaves(d.prerequisites);
    assert.equal(d.notChecked, false);
    assert.ok(nodes.some(n => n.type === "skill" && n.key === "science" && n.min === min));
    assert.ok(nodes.some(n => n.type === "focus" && n.skill === "science" && n.group === focus));
    assert.equal(
      nodes.some(n => n.type === "manual"),
      false
    );
  }
});
test("choice contexts cannot borrow a temporary category from an unrelated same-name permanent source", () => {
  const { system } = agent([feat("Extra Gear", { choice: "Weapons" })]),
    names = new Set(["extra gear"]);
  system.activeFeatSelections.push({ name: "Extra Gear", choice: "Electronics" });
  const ctx = prerequisiteContext(
    system,
    names,
    {},
    {},
    { featChoices: [{ name: "Extra Gear", system: { choice: "Weapons" } }] }
  );
  assert.equal(checkPrerequisites(definition("Electronic Warrior").prerequisites, ctx).ok, false);
  assert.equal(
    checkPrerequisites(definition("Electronic Warrior").prerequisites, { ...ctx, hasFeatChoice: undefined }).ok,
    false
  );
});
globalThis.Actor = class {
  getRollData() {
    return {};
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = { user: { isGM: true }, settings: { get: () => ({ session: "s" }) } };
globalThis.foundry = { utils: { deepClone: structuredClone } };
const { SpycraftActor } = await import("../module/documents/actor.mjs");
test("actual actor/capture paths check exact categories and exclude temporary-only sources for permanent qualification", async () => {
  const { captureFeatAcquisition } = await import("../module/rules/feat-acquisition.mjs"),
    a = new SpycraftActor(),
    target = feat("Electronic Warrior");
  let s = agent([feat("Extra Gear", { choice: "Electronics" })]);
  a.system = s.system;
  a.items = s.items;
  assert.equal(captureFeatAcquisition(a, target.system).ok, true);
  s = agent([feat("Extra Gear", { choice: "Security" })]);
  a.system = s.system;
  a.items = s.items;
  assert.equal(captureFeatAcquisition(a, target.system).ok, false);
  const temp = feat("Extra Gear", {
    choice: "Electronics",
    featKind: "temporary",
    granted: true,
    temporaryGrant: { period: "session", epoch: "s" }
  });
  s = agent([temp]);
  a.system = s.system;
  a.items = s.items;
  assert.equal(a.checkPrerequisites(target.system.prerequisites).ok, false);
  assert.equal(a.checkPrerequisites(target.system.prerequisites, { temporary: true }).ok, true);
});
test("failed acquisition history stays invalid after buying the correct category or focus; catalog changes require review", () => {
  const { system, items } = agent([feat("Extra Gear", { choice: "Electronics" })]),
    d = feat("Electronic Warrior", {
      acquisitionCheck: {
        ok: false,
        unmet: ["Wrong original category"],
        level: 1,
        signature: JSON.stringify({
          prerequisites: definition("Electronic Warrior").prerequisites,
          tree: "tradecraft",
          source: ""
        })
      }
    });
  assert.equal(computeAgent(structuredClone(system), [...items, d], cfg).featStatus["Electronic Warrior"].ok, false);
  const nodes = definitions.flatMap(f => (f.prerequisites ? [JSON.stringify(f.prerequisites)] : []));
  assert.equal(
    nodes.some(n => n.includes('"type":"manual"')),
    false
  );
});
