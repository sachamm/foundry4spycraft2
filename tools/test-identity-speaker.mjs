import test from "node:test";
import assert from "node:assert/strict";

globalThis.foundry = { utils: { escapeHTML: String } };
globalThis.game = { i18n: { localize: String } };
const { identitySpeakerAlias } = await import("../module/apps/flawless-identity.mjs");

test("an agent in a cover identity is named with it on the speaker line", () => {
  const agent = { type: "agent", name: "Ana", system: { activeIdentityState: { name: "Mme Roux" } } };
  assert.equal(identitySpeakerAlias("Ana", agent), "Ana (as Mme Roux)");
  assert.equal(identitySpeakerAlias("", agent), "Ana (as Mme Roux)");
  assert.equal(identitySpeakerAlias("Ana (as Mme Roux)", agent), null);
  assert.equal(identitySpeakerAlias("Ana", { ...agent, system: {} }), null);
  assert.equal(identitySpeakerAlias("Ana", { ...agent, type: "npc" }), null);
});
