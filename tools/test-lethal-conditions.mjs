import test from "node:test";
import assert from "node:assert/strict";

globalThis.foundry = { utils: { escapeHTML: String, randomID: () => "id" } };
globalThis.CONFIG = {
  statusEffects: ["fatigued", "unconscious", "dying", "dead"].map(id => ({ id, name: id }))
};
globalThis.game = { combats: [] };
const { sufferLethal } = await import("../module/apps/hazards.mjs");

function agent(vitality, wounds) {
  const a = {
    type: "agent",
    isOwner: true,
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

test("unowned lethal hazards and fractional damage cannot change health", async () => {
  const a = agent(14, 15);
  a.isOwner = false;
  assert.equal(await sufferLethal(a, 10), null);
  assert.equal(a.system.vitality.value, 14);
  a.isOwner = true;
  for (const damage of [-1, 1.5, Infinity]) await assert.rejects(sufferLethal(a, damage), /nonnegative whole/);
  assert.equal(a.system.vitality.value, 14);
  assert.equal(a.effects.length, 0);
});
