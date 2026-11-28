import test from "node:test";
import assert from "node:assert/strict";

globalThis.foundry = { utils: { escapeHTML: String } };
globalThis.game = { i18n: { localize: String }, settings: { get: () => null } };
const { requestText, requestButtons } = await import("../module/apps/gc/request-check.mjs");

test("a check request names who is asked and offers each owner their own agent's roll", () => {
  assert.equal(requestText({ skillName: "Notice", names: ["Ana", "Ben"] }), "The GC asks Ana, Ben for a Notice check.");
  assert.equal(
    requestText({ skillName: "Notice", names: ["Ana"], note: "the guard's face" }),
    "The GC asks Ana for a Notice check: the guard's face"
  );
  const actors = {
    a: { uuid: "a", name: "Ana", type: "agent", isOwner: true },
    b: { uuid: "b", name: "Ben", type: "agent", isOwner: false }
  };
  const buttons = requestButtons({ skillName: "Notice", actorUuids: ["a", "b", "gone"] }, uuid => actors[uuid]);
  assert.deepEqual(
    buttons.map(b => b.label),
    ["Roll Notice: Ana"]
  );
});
