import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { quirkyAttackPlan as plan } from "../module/rules/quirky.mjs";
test("QKY worsens only untrained attacks, once, across all quality/training/base combinations", () => {
  for (const quirky of [false, true])
    for (const trained of [false, true])
      for (const base of [0, -2, -4, -6, -8, -10, -12]) {
        assert.deepEqual(plan({ qualities: quirky ? "QKY, QKY" : "" }, { trained, untrainedPenalty: base }), {
          version: 1,
          quirky,
          trained,
          baseUntrainedPenalty: base,
          adjustment: quirky ? -4 : 0,
          attackPenalty: trained ? 0 : base - (quirky ? 4 : 0)
        });
      }
  assert.equal(plan({ qualities: "QKY" }).attackPenalty, -8);
  for (const qualities of ["", "QKY2", "XQKY", "Quirky", "ACC"])
    assert.equal(plan({ name: "QKY", qualities }).attackPenalty, -4);
});
test("all thirteen canonical QKY weapons and the COP base penalty have explicit coverage", () => {
  const rows = JSON.parse(readFileSync(new URL("../src/data/equipment.json", import.meta.url))).weapons.filter(w =>
      /\bQKY\b/.test(w.qualities)
    ),
    bases = { Blunt: -2, Edged: -4, "Exotic (Blunt)": -6, Handgun: -6, Shotgun: -4, "Submachine gun": -4 };
  assert.equal(rows.length, 13);
  const cop = rows.find(w => w.name === "COP Inc. COP .357 Magnum");
  assert.equal(cop.untrainedPenalty, -6);
  for (const w of rows) {
    const base = bases[w.proficiency];
    assert.ok(Number.isInteger(base), w.name);
    assert.equal(plan(w, { untrainedPenalty: base }).attackPenalty, base - 4, w.name);
    assert.equal(plan(w, { trained: true, untrainedPenalty: base }).attackPenalty, 0, w.name);
  }
});
test("invalid training, quality and base penalty data requires review rather than coercion", () => {
  for (const trained of [1, "true", null, {}, []])
    assert.throws(() => plan({ qualities: "QKY" }, { trained }), /Review/);
  for (const untrainedPenalty of ["-6", NaN, Infinity, -2.5, 1, null, {}, []])
    assert.throws(() => plan({ qualities: "QKY" }, { untrainedPenalty }), /Review/);
  for (const qualities of [1, {}, [], true]) assert.throws(() => plan({ qualities }), /Review/);
});
test("planning changes no weapon fields or resources and never reads unrelated character effects", () => {
  const w = { qualities: "QKY", untrainedPenalty: -6, damage: "1d6", error: 2, threat: 20, quantity: 1 },
    before = structuredClone(w);
  for (const k of ["abilities", "actionDice", "classLevels", "activeFeatNames"])
    Object.defineProperty(w, k, {
      get() {
        throw Error("Unused " + k);
      }
    });
  plan(w);
  assert.deepEqual(w, before);
});
