import test from "node:test";
import assert from "node:assert/strict";
import {
  MIGRATIONS,
  SCHEMA_VERSION,
  applyUpdate,
  documentUpdate,
  migrateWorld,
  pendingMigrations
} from "../module/migrations/index.mjs";

const doc = (name, source, items = []) => ({
  name,
  source: structuredClone(source),
  items,
  updates: [],
  toObject() {
    return structuredClone(this.source);
  },
  async update(update) {
    if (this.failing) throw new Error("write refused");
    this.updates.push(update);
    this.source = applyUpdate(this.source, update);
  }
});

const renameLegacy = {
  version: 2,
  label: "Rename the legacy stance field",
  actor: source =>
    source.system.oldStance ? { "system.stance": source.system.oldStance, "system.oldStance": null } : null
};
const capFailedSaves = {
  version: 3,
  label: "Cap failed saves",
  item: (source, parent) =>
    source.system.failedSaves > 5 ? { system: { failedSaves: 5, cappedFor: parent?.name ?? "world" } } : null
};

test("the shipped migration list is consistent with the schema version", () => {
  assert.ok(Number.isSafeInteger(SCHEMA_VERSION) && SCHEMA_VERSION >= 1);
  assert.equal(new Set(MIGRATIONS.map(m => m.version)).size, MIGRATIONS.length);
  for (const migration of MIGRATIONS) {
    assert.ok(migration.version >= 2 && migration.version <= SCHEMA_VERSION, `migration ${migration.version}`);
    assert.ok(migration.label, `migration ${migration.version} needs a label`);
    assert.ok(typeof migration.actor === "function" || typeof migration.item === "function");
  }
  assert.deepEqual(pendingMigrations(SCHEMA_VERSION), []);
});

test("pending migrations are the versions above the world's, oldest first", () => {
  const list = [capFailedSaves, renameLegacy];
  assert.deepEqual(
    pendingMigrations(0, list, 3).map(m => m.version),
    [2, 3]
  );
  assert.deepEqual(
    pendingMigrations(2, list, 3).map(m => m.version),
    [3]
  );
  assert.deepEqual(pendingMigrations(3, list, 3), []);
  assert.deepEqual(
    pendingMigrations(undefined, list, 2).map(m => m.version),
    [2]
  );
  assert.throws(() => pendingMigrations(0, [renameLegacy, { ...renameLegacy }], 3), /share a version/);
  assert.throws(() => pendingMigrations(0, [{ version: 1.5 }], 3), /whole-number version/);
});

test("updates apply to a copy, with dotted and nested keys merged like a document update", () => {
  const source = { system: { a: { x: 1, y: 2 }, list: [1, 2] } };
  const next = applyUpdate(source, { "system.a.x": 5, system: { a: { z: 3 }, list: [9] }, "flags.new.key": true });
  assert.deepEqual(next, { system: { a: { x: 5, y: 2, z: 3 }, list: [9] }, flags: { new: { key: true } } });
  assert.deepEqual(source, { system: { a: { x: 1, y: 2 }, list: [1, 2] } });
});

test("a document's migrations chain: each sees what the earlier one wrote", () => {
  const first = { version: 2, actor: s => (s.system.n === 1 ? { "system.n": 2 } : null) };
  const second = { version: 3, actor: s => (s.system.n === 2 ? { "system.n": 3, "system.done": true } : null) };
  assert.deepEqual(documentUpdate("actor", { system: { n: 1 } }, null, [first, second]), {
    "system.n": 3,
    "system.done": true
  });
  assert.equal(documentUpdate("actor", { system: { n: 9 } }, null, [first, second]), null);
  assert.equal(documentUpdate("item", { system: {} }, null, [first, second]), null);
  assert.throws(
    () => documentUpdate("actor", { system: {} }, null, [{ version: 2, actor: () => "nope" }]),
    /invalid actor update/
  );
});

test("a world is migrated once: actors, their items and world items, then the version is stored", async () => {
  const owned = doc("Pistol", { system: { failedSaves: 9 } });
  const actor = doc("Agent", { name: "Agent", system: { oldStance: "side" } }, [owned]);
  const untouched = doc("Other", { name: "Other", system: {} });
  const loose = doc("Crate", { system: { failedSaves: 7 } });
  const notices = [];
  const world = {
    version: 1,
    actors: [actor, untouched],
    items: [loose],
    setVersion: async v => (world.version = v),
    notify: m => notices.push(m)
  };
  const report = await migrateWorld(world, { migrations: [renameLegacy, capFailedSaves], to: 3 });
  assert.deepEqual(report, { from: 1, to: 3, updated: 3, failed: 0, ran: [2, 3] });
  assert.equal(world.version, 3);
  assert.deepEqual(actor.source.system, { oldStance: null, stance: "side" });
  assert.deepEqual(owned.source.system, { failedSaves: 5, cappedFor: "Agent" });
  assert.deepEqual(loose.source.system, { failedSaves: 5, cappedFor: "world" });
  assert.equal(untouched.updates.length, 0);
  assert.equal(notices.length, 1);

  // Running again does nothing.
  const again = await migrateWorld(world, { migrations: [renameLegacy, capFailedSaves], to: 3 });
  assert.deepEqual(again, { from: 3, to: 3, updated: 0, failed: 0, ran: [] });
  assert.equal(actor.updates.length, 1);
});

test("a failed write keeps the old version so the migration is retried", async () => {
  const bad = doc("Agent", { name: "Agent", system: { oldStance: "side" } });
  bad.failing = true;
  const notices = [];
  const world = {
    version: 1,
    actors: [bad],
    items: [],
    setVersion: async v => (world.version = v),
    notify: m => notices.push(m)
  };
  const original = console.error;
  console.error = () => {};
  try {
    const report = await migrateWorld(world, { migrations: [renameLegacy], to: 2 });
    assert.equal(report.failed, 1);
  } finally {
    console.error = original;
  }
  assert.equal(world.version, 1);
  assert.match(notices.at(-1), /retried/);
  bad.failing = false;
  await migrateWorld(world, { migrations: [renameLegacy], to: 2 });
  assert.equal(world.version, 2);
  assert.equal(bad.source.system.stance, "side");
});

test("a world with nothing to convert is simply stamped with the current version", async () => {
  const world = {
    version: 0,
    actors: [doc("Agent", { system: {} })],
    items: [],
    setVersion: async v => (world.version = v)
  };
  const report = await migrateWorld(world, { migrations: [], to: 1 });
  assert.deepEqual(report, { from: 0, to: 1, updated: 0, failed: 0, ran: [] });
  assert.equal(world.version, 1);
});
