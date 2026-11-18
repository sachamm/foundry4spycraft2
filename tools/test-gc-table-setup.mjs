import test from "node:test";
import assert from "node:assert/strict";
import { GC_TABLE_CATALOG } from "../module/data/gc-table-catalog.mjs";
import { setupGCTables, inputRollTableClass } from "../module/gc-table-setup.mjs";
function fixture({
  leading = true,
  gm = true,
  existing = [],
  installed = [],
  failCreate = 0,
  failSave = 0,
  incomplete = false
} = {}) {
  let state = { installed },
    creates = 0,
    saves = 0,
    folders = 0;
  const tables = [...existing];
  const documents = GC_TABLE_CATALOG.map(entry => ({
    id: entry.id,
    toObject: () => ({ _id: entry.id, name: entry.name, flags: { spycraft2: { gcTable: entry.key } } })
  }));
  const flagDoc = data => ({ ...data, getFlag: (s, k) => data.flags?.[s]?.[k] });
  globalThis.game = {
    user: { id: "gm", isGM: gm },
    users: { activeGM: { id: leading ? "gm" : "other" } },
    settings: {
      get: () => state,
      set: async (_s, _k, value) => {
        if (++saves === failSave) throw Error("save failed");
        state = structuredClone(value);
      }
    },
    packs: new Map([
      [
        "spycraft2.gc-tables",
        { documentName: "RollTable", getDocuments: async () => (incomplete ? documents.slice(1) : documents) }
      ]
    ]),
    tables,
    folders: []
  };
  globalThis.Folder = {
    create: async data => {
      const folder = flagDoc({ ...data, id: "folder" + ++folders });
      game.folders.push(folder);
      return folder;
    }
  };
  globalThis.RollTable = {
    create: async data => {
      if (++creates === failCreate) throw Error("create failed");
      assert.equal(data._id, undefined);
      assert.equal(data.folder, "folder1");
      assert.deepEqual(data.ownership, { default: 0 });
      tables.push(flagDoc({ ...data, id: "table" + creates }));
    }
  };
  globalThis.ui = { notifications: { info() {}, warn() {} } };
  return {
    tables,
    get state() {
      return state;
    },
    get creates() {
      return creates;
    },
    get folders() {
      return folders;
    }
  };
}
const legacy = (entry, kind) => ({
  id: "existing",
  name: entry.name,
  formula: "edited",
  flags: {},
  _stats: kind === "stats" ? { compendiumSource: `Compendium.spycraft2.gc-tables.RollTable.${entry.id}` } : {},
  getFlag: (s, k) =>
    kind === "old" && s === "core" && k === "sourceId"
      ? `Compendium.spycraft2.gc-tables.RollTable.${entry.id}`
      : undefined
});
test("setup imports all 36 tables once into one GM-only folder and preserves deliberate deletions", async () => {
  const f = fixture();
  assert.deepEqual(await setupGCTables(), { created: 36 });
  assert.equal(f.folders, 1);
  assert.equal(f.state.installed.length, 36);
  f.tables.length = 0;
  await setupGCTables();
  assert.equal(f.creates, 36);
});
test("manual compendium imports are recognized by native provenance without overwriting user edits", async () => {
  const existing = GC_TABLE_CATALOG.slice(0, 4).map((entry, n) => legacy(entry, n % 2 ? "old" : "stats"));
  const f = fixture({ existing });
  await setupGCTables();
  assert.equal(f.creates, 32);
  for (const doc of existing) assert.equal(doc.formula, "edited");
});
test("only the elected GM performs setup; incomplete packs create nothing", async () => {
  for (const options of [{ gm: false }, { leading: false }, { incomplete: true }]) {
    const f = fixture(options);
    const old = console.error;
    console.error = () => {};
    try {
      await setupGCTables();
      assert.equal(f.creates, 0);
      assert.equal(f.folders, 0);
    } finally {
      console.error = old;
    }
  }
});
test("interrupted creation and lost setup acknowledgements resume without duplicates", async () => {
  for (const options of [{ failCreate: 3 }, { failSave: 3 }]) {
    const f = fixture(options);
    const old = console.error;
    console.error = () => {};
    try {
      await setupGCTables();
      await setupGCTables();
      assert.equal(f.tables.length, 36);
      assert.equal(new Set(f.tables.map(t => t.flags.spycraft2.gcTable)).size, 36);
      assert.equal(f.state.installed.length, 36);
    } finally {
      console.error = old;
    }
  }
});
test("new catalog entries are delivered to established worlds and simultaneous setup calls share work", async () => {
  const f = fixture({ installed: GC_TABLE_CATALOG.slice(0, 4).map(e => e.key) });
  await Promise.all([setupGCTables(), setupGCTables()]);
  assert.equal(f.creates, 32);
});
class NativeTable {
  constructor(input = false) {
    this.input = input;
  }
  getFlag() {
    return this.input ? "criticalInjury" : undefined;
  }
  async roll(options) {
    return options;
  }
}
const Table = inputRollTableClass(NativeTable);
let input;
globalThis.foundry = { applications: { api: { DialogV2: { input: async () => input } } } };
globalThis.Roll = class {
  constructor(formula, data) {
    this.formula = formula;
    this.data = data;
  }
  async evaluate() {
    this.total = 0;
    return this;
  }
};
test("injury draws require actual damage, support Guts, cancel without rolling and preserve supplied rolls", async () => {
  for (const die of [10, 20]) {
    input = { damage: "50", die: String(die) };
    const result = await new Table(true).roll({ recursive: false });
    assert.equal(result.roll.formula, `1d${die} + @damage`);
    assert.deepEqual(result.roll.data, { damage: 50 });
    assert.equal(result.recursive, false);
  }
  input = null;
  const canceled = await new Table(true).roll();
  assert.equal(canceled.roll.formula, "0");
  assert.equal(canceled.roll.total, 0);
  assert.deepEqual(canceled.results, []);
  for (const damage of ["", null, -1, 1.5, "bad", Number.MAX_SAFE_INTEGER]) {
    input = { damage, die: 20 };
    await assert.rejects(new Table(true).roll(), /whole damage/);
  }
  const supplied = { sentinel: true };
  assert.deepEqual(await new Table(true).roll({ roll: supplied }), { roll: supplied });
  assert.deepEqual(await new Table().roll({ recursive: false }), { recursive: false });
});
