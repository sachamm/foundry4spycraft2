import test from "node:test";
import assert from "node:assert/strict";
import { gunslingerSpec, gunslingerReading, gunslingerNote } from "../module/rules/gunslinger.mjs";

const owner = names => ({
  activeFeatNames: ["Gunslinger's Eye", ...names],
  activeFeatSelections: [
    { name: "Gunslinger's Eye", tree: "Ranged Combat" },
    ...names.map(name => ({ name, tree: "Ranged Combat" }))
  ]
});
const target = {
  uuid: "Actor.t",
  name: "Vane",
  system: {
    attack: { ranged: 7 },
    initiative: { total: 5 },
    activeFeatSelections: [
      { name: "Snap Shot", tree: "Ranged Combat" },
      { name: "Quick Draw", tree: "Basic Combat" }
    ]
  }
};

test("uses per session equal the owner's Ranged Combat feats", () => {
  assert.equal(gunslingerSpec(owner(["Snap Shot", "Bullseye"])).limit, 3);
  assert.equal(gunslingerSpec({ activeFeatNames: [] }), null);
});

test("sizing up reveals the three details, once per character per mission", () => {
  const r = gunslingerReading(target, { history: {}, mission: "m1" });
  assert.deepEqual(r, { rangedAttack: 7, initiative: 5, rangedFeats: 1 });
  assert.match(gunslingerNote(target, r), /ranged attack bonus 7, Initiative bonus 5, 1 Ranged Combat feats/);
  assert.throws(() => gunslingerReading(target, { history: { m1: ["Actor.t"] }, mission: "m1" }), /already sized up/);
  assert.ok(gunslingerReading(target, { history: { m0: ["Actor.t"] }, mission: "m1" }), "a new mission resets it");
});
