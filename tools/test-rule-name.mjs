import test from "node:test";
import assert from "node:assert/strict";
import { ruleName } from "../module/rules/rule-name.mjs";
import { buildPacks } from "./lib/pack-docs.mjs";

test("an item is known to the rules by its stored English name, then Babele's original, then its own", () => {
  assert.equal(ruleName({ name: "Guts" }), "Guts");
  assert.equal(ruleName({ name: "Cran", flags: { babele: { originalName: "Guts" } } }), "Guts");
  assert.equal(
    ruleName({ name: "Cran", flags: { spycraft2: { ruleName: "Guts" }, babele: { originalName: "Other" } } }),
    "Guts"
  );
  assert.equal(ruleName({ name: "Cran", flags: { spycraft2: { ruleName: "" } } }), "Cran");
  assert.equal(ruleName(null), "");
});

test("every compendium feat carries its rule name, and other items carry none", () => {
  const { packs } = buildPacks();
  assert.ok(packs.feats.docs.length > 300);
  for (const feat of packs.feats.docs) assert.equal(feat.flags.spycraft2.ruleName, feat.name);
  for (const [name, pack] of Object.entries(packs))
    for (const doc of pack.docs) if (doc.type !== "feat") assert.equal(doc.flags?.spycraft2?.ruleName, undefined, name);
});

test("a renamed feat still counts for the rules", async () => {
  const { SPYCRAFT: cfg } = await import("../module/config.mjs");
  globalThis.CONFIG ??= { SPYCRAFT: cfg };
  const { computeAgent } = await import("../module/rules/engine.mjs");
  const feat = (id, name, flags = {}) => ({
    id,
    _id: id,
    name,
    type: "feat",
    flags,
    system: { tree: "basicCombat", featKind: "permanent", granted: true, bonuses: [], prerequisites: null }
  });
  const run = items => {
    const sys = {
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 12 }])),
      progression: [],
      conditionContext: {}
    };
    try {
      computeAgent(sys, items, cfg);
    } catch {
      // The bare character is enough for the feat pass; later passes may need more than this fixture has.
    }
    return sys.activeFeatNames ?? [];
  };
  const plain = run([feat("a", "Guts")]),
    renamed = run([feat("a", "Cran", { spycraft2: { ruleName: "Guts" } })]),
    translated = run([feat("a", "Cran", { babele: { originalName: "Guts" } })]);
  assert.ok(plain.includes("Guts"), "the fixture reaches the feat pass");
  assert.deepEqual(renamed, plain);
  assert.deepEqual(translated, plain);
});
