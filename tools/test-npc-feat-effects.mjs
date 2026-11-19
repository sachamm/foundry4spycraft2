import test from "node:test";
import assert from "node:assert/strict";
import { npcFeatEffects } from "../module/rules/npc-feat-effects.mjs";

const feat = (name, bonuses, ranks = 1) => ({ type: "feat", name, system: { bonuses, ranks } });

test("plain-number feat bonuses reach an NPC's saves, Initiative, Speed, health and skills", () => {
  const effects = npcFeatEffects(
    [
      feat("Save feat", [
        { target: "baseSave.fort", value: "3" },
        { target: "wounds", value: "3" }
      ]),
      feat("Quick feat", [
        { target: "initiative", value: "4" },
        { target: "speed", value: "10" }
      ]),
      feat("Skill feat", [
        { target: "skills.sneak.misc", value: "2" },
        { target: "skills.sneak.baseThreat", value: "1" }
      ]),
      { type: "weapon", name: "Pistol", system: { bonuses: [{ target: "initiative", value: "9" }] } }
    ],
    { level: 5, base: { fort: 4 } }
  );
  assert.deepEqual(effects.saves, { fort: 3, ref: 0, will: 0 });
  assert.equal(effects.initiative, 4);
  assert.equal(effects.speed, 10);
  assert.equal(effects.wounds, 3);
  assert.deepEqual(effects.skills, { sneak: 2 });
  assert.deepEqual(effects.uncounted, ["Skill feat"], "the threat-range part is left to the GC");
  assert.equal(effects.rows.length, 5);
});

test("a formula reads the feat's rank and the NPC's base saves", () => {
  const effects = npcFeatEffects([feat("Hardy", [{ target: "vitality", value: "(@rank * @base.fort)" }], 2)], {
    base: { fort: 6 }
  });
  assert.equal(effects.vitality, 12);
});

test("feats with no countable bonus are named, once, and nothing breaks on odd data", () => {
  const effects = npcFeatEffects([
    feat("Contacts feat", [{ target: "contacts", value: "1" }]),
    feat("Contacts feat", [{ target: "contacts", value: "1" }]),
    feat("Bare feat", undefined),
    null
  ]);
  assert.deepEqual(effects.uncounted, ["Contacts feat"]);
  assert.deepEqual(effects.rows, []);
  assert.deepEqual(npcFeatEffects(undefined).saves, { fort: 0, ref: 0, will: 0 });
});
