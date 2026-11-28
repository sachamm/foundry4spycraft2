import test from "node:test";
import assert from "node:assert/strict";

globalThis.foundry = { utils: { escapeHTML: String } };
globalThis.game = { i18n: { localize: String } };
const { isImportedNpc } = await import("../module/apps/npc-import.mjs");

test("only an NPC copied from this system's compendiums, outside any folder, is filed", () => {
  const npc = { type: "npc", folder: null, _stats: { compendiumSource: "Compendium.spycraft2.npcs.Actor.abc" } };
  assert.equal(isImportedNpc(npc), true);
  assert.equal(isImportedNpc({ ...npc, folder: "f1" }), false);
  assert.equal(isImportedNpc({ ...npc, type: "agent" }), false);
  assert.equal(isImportedNpc({ ...npc, _stats: { compendiumSource: "Compendium.world.mine.Actor.x" } }), false);
  assert.equal(
    isImportedNpc({ type: "npc", flags: { core: { sourceId: "Compendium.spycraft2.npcs.Actor.b" } } }),
    true
  );
});
