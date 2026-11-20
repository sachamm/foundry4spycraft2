import test from "node:test";
import assert from "node:assert/strict";
import {
  SCHEMA_VERSION,
  MIGRATIONS,
  agentSightUpdate,
  agentTokenSightUpdate,
  migrateWorld
} from "../module/migrations/index.mjs";
import { nonLethalMeters } from "../module/rules/accumulated-damage.mjs";
import { buildCreationTrack, buildSetupGuide } from "../module/sheets/agent-ux.mjs";
import { sheetPlacement } from "../module/sheets/sheet-placement.mjs";
import { messageModeOption } from "../module/rolls/message-mode.mjs";

test("version 3 switches token vision on for agents and their placed tokens, and leaves everyone else alone", async () => {
  assert.ok(SCHEMA_VERSION >= 3);
  assert.ok(MIGRATIONS.some(m => m.version === 3 && m.actor && m.token));
  assert.deepEqual(agentSightUpdate({ type: "agent", prototypeToken: { sight: { enabled: false } } }), {
    "prototypeToken.sight.enabled": true
  });
  assert.deepEqual(agentSightUpdate({ type: "agent" }), { "prototypeToken.sight.enabled": true });
  assert.equal(agentSightUpdate({ type: "agent", prototypeToken: { sight: { enabled: true } } }), null);
  assert.equal(agentSightUpdate({ type: "npc", prototypeToken: { sight: { enabled: false } } }), null);
  assert.deepEqual(agentTokenSightUpdate({ sight: { enabled: false } }, { type: "agent" }), { "sight.enabled": true });
  assert.equal(agentTokenSightUpdate({ sight: { enabled: true } }, { type: "agent" }), null);
  assert.equal(agentTokenSightUpdate({ sight: { enabled: false } }, { type: "npc" }), null);

  const doc = source => ({
    source,
    changes: [],
    toObject() {
      return structuredClone(this.source);
    },
    async update(update) {
      this.changes.push(update);
    }
  });
  const agent = doc({ type: "agent", name: "A", system: {}, prototypeToken: { sight: { enabled: false } } }),
    guard = doc({ type: "npc", name: "G", system: {}, prototypeToken: { sight: { enabled: false } } });
  const agentToken = { ...doc({ sight: { enabled: false } }), actor: agent },
    guardToken = { ...doc({ sight: { enabled: false } }), actor: guard };
  const world = {
    version: 2,
    actors: [agent, guard],
    items: [],
    tokens: [agentToken, guardToken],
    setVersion: async v => (world.version = v)
  };
  const report = await migrateWorld(world);
  assert.equal(report.updated, 2);
  assert.equal(world.version, SCHEMA_VERSION);
  assert.deepEqual(agent.changes, [{ "prototypeToken.sight.enabled": true }]);
  assert.deepEqual(agentToken.changes, [{ "sight.enabled": true }]);
  assert.deepEqual([guard.changes, guardToken.changes], [[], []]);
});

test("stress and subdual totals get a meter beside vitality only once some has been taken", () => {
  const system = { stressThreshold: 12, subdualThreshold: 14 };
  assert.deepEqual(nonLethalMeters(system), []);
  assert.deepEqual(nonLethalMeters({ ...system, accumulatedDamage: { stress: 0, subdual: 0, pending: [] } }), []);
  const [meter] = nonLethalMeters({ ...system, accumulatedDamage: { stress: 0, subdual: 2, pending: [] } });
  assert.deepEqual(
    [meter.kind, meter.total, meter.threshold, meter.pending, meter.action],
    ["subdual", 2, 14, false, "checkAccumulatedDamage"]
  );
  const waiting = nonLethalMeters({ ...system, accumulatedDamage: { stress: 13, subdual: 2, pending: ["x"] } });
  assert.deepEqual(
    waiting.map(row => [row.kind, row.pending, row.action]),
    [
      ["stress", true, "rollPendingDamageSave"],
      ["subdual", true, "rollPendingDamageSave"]
    ]
  );
});

test("the next setup step is the step the creation track marks as the place to start", () => {
  // A talent reminder sorts before the attribute reminder by its order, but attributes are the earlier step.
  const blank = [
    { order: 4, tab: "main", text: "Choose a talent." },
    { order: 5, tab: "main", text: "Assign attribute points." },
    { order: 20, tab: "classes", text: "Choose a class." }
  ];
  const start = tasks => buildCreationTrack(tasks).steps.find(step => step.start);
  assert.equal(start(blank).key, "attributes");
  assert.equal(buildSetupGuide(blank).next.text, "Assign attribute points.");
  // After a class is taken, an origin choice that is still open comes before the class's own choice in both.
  const classed = [
    { order: 21, tab: "classes", text: "Choose a class ability." },
    { order: 51, tab: "main", text: "Choose a specialty feat." }
  ];
  assert.equal(start(classed).key, "origin");
  assert.equal(buildSetupGuide(classed).next.text, "Choose a specialty feat.");
  assert.equal(buildSetupGuide(classed).next.tab, "main");
});

test("a sheet opens at the left, clear of the sidebar, and narrows on a small screen", () => {
  const wanted = { width: 860, height: 760 };
  assert.deepEqual(sheetPlacement(wanted, { width: 1600, height: 900, sidebar: 348, open: 0 }), {
    left: 110,
    top: 60,
    width: 860,
    height: 760
  });
  const small = sheetPlacement(wanted, { width: 1280, height: 720, sidebar: 348, open: 0 });
  assert.equal(small.width, 810);
  assert.ok(small.left + small.width <= 1280 - 348, "the chat stays in view");
  assert.ok(small.top + small.height <= 720, "the sheet fits the window");
  // Never narrower than the sheet's own compact layout can show.
  assert.equal(sheetPlacement(wanted, { width: 900, height: 700, sidebar: 348, open: 0 }).width, 640);
  // A second sheet steps down and right so both title bars can be reached.
  const second = sheetPlacement(wanted, { width: 1600, height: 900, sidebar: 348, open: 1 });
  assert.deepEqual([second.left, second.top], [134, 84]);
});

test("roll visibility uses the new option name where Foundry lists the mode, and the old one otherwise", () => {
  const v14 = { ChatMessage: { modes: { public: {}, gm: {}, blind: {}, self: {} } } };
  assert.deepEqual(messageModeOption("blindroll", v14), { messageMode: "blind" });
  assert.deepEqual(messageModeOption("gmroll", v14), { messageMode: "gm" });
  assert.deepEqual(messageModeOption("publicroll", v14), { messageMode: "public" });
  assert.deepEqual(messageModeOption("gmroll", {}), { rollMode: "gmroll" });
  assert.deepEqual(messageModeOption("gmroll", { ChatMessage: { modes: { other: {} } } }), { rollMode: "gmroll" });
  assert.deepEqual(messageModeOption(undefined, v14), {});
});
