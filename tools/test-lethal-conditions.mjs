import test from "node:test";
import assert from "node:assert/strict";

globalThis.foundry = { utils: { escapeHTML: String, randomID: () => "id" } };
globalThis.CONFIG = {
  statusEffects: ["fatigued", "unconscious", "dying", "dead"].map(id => ({ id, name: id }))
};
globalThis.game = { combats: [] };
const { sufferLethal, sufferStress, animalStressMultiplier } = await import("../module/apps/hazards.mjs");

function agent(vitality, wounds) {
  const a = {
    system: { vitality: { value: vitality, max: 14 }, wounds: { value: wounds, max: 15 } },
    effects: [],
    async update(patch) {
      a.system.vitality.value = patch["system.vitality.value"];
      a.system.wounds.value = patch["system.wounds.value"];
    },
    async createEmbeddedDocuments(_type, rows) {
      const made = rows.map((row, i) => ({ id: `e${a.effects.length + i}`, ...row, statuses: new Set(row.statuses) }));
      a.effects.push(...made);
      return made;
    }
  };
  Object.defineProperty(a, "statuses", { get: () => new Set(a.effects.flatMap(e => [...e.statuses])) });
  return a;
}

test("lethal hazard or typed damage that takes wounds below 0 sets fatigued, unconscious and dying", async () => {
  const a = agent(0, 3),
    loss = await sufferLethal(a, 19);
  assert.equal(a.system.wounds.value, -16);
  assert.deepEqual([...a.statuses].sort(), ["dead"]);
  assert.ok(loss.notes.some(line => /dead/.test(line)));
  const b = agent(4, 15);
  await sufferLethal(b, 10);
  assert.equal(b.system.wounds.value, 9);
  assert.deepEqual([...b.statuses].sort(), ["fatigued"]);
  await sufferLethal(b, 12);
  assert.deepEqual([...b.statuses].sort(), ["dying", "fatigued", "unconscious"]);
});

test("an animal takes double stress from bang, fire and flash, and normal stress from anything else (p.445)", async () => {
  const npc = npcType => {
    const a = {
      type: "npc",
      system: { npcType, vitality: { value: 10, max: 10 } },
      flags: {},
      async update(patch) {
        a.flags = { spycraft2: { nonLethal: { stress: patch["flags.spycraft2.nonLethal.stress"] } } };
      }
    };
    return a;
  };
  for (const cause of ["bang", "fire", "flash"]) {
    const dog = npc("animal"),
      line = await sufferStress(dog, 3, cause, undefined, { cause });
    assert.equal(dog.flags.spycraft2.nonLethal.stress, 6, cause);
    assert.match(line, /double stress/);
  }
  const dog = npc("animal");
  await sufferStress(dog, 3, "Falling");
  assert.equal(dog.flags.spycraft2.nonLethal.stress, 3);
  const guard = npc("special");
  await sufferStress(guard, 3, "Bang", undefined, { cause: "bang" });
  assert.equal(guard.flags.spycraft2.nonLethal.stress, 3);
  assert.equal(animalStressMultiplier({ type: "agent", system: { npcType: "animal" } }, "fire"), 1);
  // A standard animal takes it through its Damage save, at the doubled amount.
  const pup = { type: "npc", system: { npcType: "animal", vitality: { max: 0 } } };
  assert.match(
    await sufferStress(pup, 2, "Flash", undefined, { cause: "flash" }),
    /4 stress damage: roll the Damage save/
  );
});
