import test from "node:test";
import assert from "node:assert/strict";

// A player's grapple asks the GC's client to set conditions on a character the player does not own.
const created = [];
const npc = {
  name: "Guard",
  uuid: "Actor.npc",
  statuses: new Set(),
  effects: [],
  async createEmbeddedDocuments(type, data) {
    created.push({ type, data });
    for (const d of data) for (const id of d.statuses ?? []) this.statuses.add(id);
    return data.map((d, i) => ({ id: `e${i}`, ...d }));
  }
};
globalThis.foundry = {
  utils: { escapeHTML: text => String(text), randomID: () => "op1", deepClone: x => structuredClone(x) },
  applications: { api: { DialogV2: { confirm: async () => true, input: async () => null } } }
};
globalThis.CONFIG = { statusEffects: [{ id: "held", name: "Held", img: "held.svg" }], SPYCRAFT: {} };
globalThis.fromUuid = async uuid => (uuid === npc.uuid ? npc : null);
globalThis.ui = { notifications: { warn() {}, info() {} } };
globalThis.Hooks = { on() {}, once() {} };
globalThis.game = {
  user: { id: "gm", isGM: true, name: "GC" },
  users: { get: id => ({ id, name: "Player", isGM: false }), activeGM: null },
  settings: { get: (_scope, key) => key === "relayAutoApprove" },
  i18n: { localize: String },
  messages: [],
  actors: []
};

await import("../module/apps/combat-actions.mjs");
const { handleRelay } = await import("../module/apps/gc-relay.mjs");

test("the GC's client sets a grapple condition on the opponent for the player", async () => {
  const answer = await handleRelay({
    action: "grappleCondition",
    userId: "player",
    data: { actorUuid: npc.uuid, id: "held", active: true, label: "Held" }
  });
  assert.deepEqual(answer, { value: true });
  assert.equal(created.length, 1);
  assert.equal(created[0].type, "ActiveEffect");
});

test("a grapple cannot ask the GC for a condition it does not bring", async () => {
  const answer = await handleRelay({
    action: "grappleCondition",
    userId: "player",
    data: { actorUuid: npc.uuid, id: "dead", active: true, label: "Dead" }
  });
  assert.ok(answer.error);
});
