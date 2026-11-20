import test from "node:test";
import assert from "node:assert/strict";

const made = [],
  assigned = [];
const weapon = {
  uuid: "Actor.a.Item.w",
  type: "weapon",
  name: "Pistol",
  img: "pistol.webp",
  parent: { documentName: "Actor", name: "Vector" }
};
globalThis.fromUuidSync = uuid => (uuid === weapon.uuid ? weapon : { type: "gear", parent: weapon.parent });
globalThis.Macro = { create: async data => (made.push(data), data) };
globalThis.game = {
  macros: [],
  user: { assignHotbarMacro: async (macro, slot) => assigned.push([macro.name, slot]) },
  settings: { get: () => false }
};
const { onHotbarDrop } = await import("../module/apps/hotbar.mjs");

test("a weapon or skill dropped on the hotbar becomes a macro that rolls it", async () => {
  assert.equal(onHotbarDrop(null, { type: "Item", uuid: weapon.uuid }, 3), false);
  assert.equal(
    onHotbarDrop(null, { type: "spycraft2.skill", actorUuid: "Actor.a", skill: "notice", name: "Notice" }, 4),
    false
  );
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(
    made.map(m => [m.name, m.command]),
    [
      ["Vector: Pistol", 'game.spycraft2.rollFromMacro({"itemUuid":"Actor.a.Item.w"}, event);'],
      ["Notice", 'game.spycraft2.rollFromMacro({"actorUuid":"Actor.a","skill":"notice"}, event);']
    ]
  );
  assert.deepEqual(assigned, [
    ["Vector: Pistol", 3],
    ["Notice", 4]
  ]);
  // Anything else is left to Foundry.
  assert.equal(onHotbarDrop(null, { type: "Item", uuid: "Actor.a.Item.g" }, 5), true);
  assert.equal(onHotbarDrop(null, { type: "Macro", uuid: "Macro.m" }, 6), true);
});
