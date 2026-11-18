import test from "node:test";
import assert from "node:assert/strict";

globalThis.Actor = class {
  constructor(items = []) {
    this.type = "agent";
    this.isOwner = true;
    this.items = items;
    this.system = { progression: [], classLevels: {} };
    this.created = [];
    this.deleted = [];
    this.updated = [];
  }
  async deleteEmbeddedDocuments(_type, ids) {
    this.deleted.push(...ids);
    this.items = this.items.filter(i => !ids.includes(i.id));
  }
  async createEmbeddedDocuments(_type, docs) {
    this.created.push(...docs);
    docs.forEach((d, i) => this.items.push({ ...d, id: "new" + (this.created.length + i), system: { ...d.system } }));
  }
  async updateEmbeddedDocuments(_type, docs) {
    this.updated.push(...docs);
    for (const d of docs) {
      const item = this.items.find(i => i.id === d._id);
      if (item && "system.acquiredAtLevel" in d) item.system.acquiredAtLevel = d["system.acquiredAtLevel"];
    }
  }
};
globalThis.game = { packs: { get: () => null } };
const { SpycraftActor } = await import("../module/documents/actor.mjs");

test("manual feat takes precedence over duplicated granted feat", async () => {
  const actor = new SpycraftActor([
    { id: "origin", name: "Agent", type: "origin", system: { grants: ["Quick Draw"] } },
    { id: "manual", name: "Quick Draw", type: "feat", system: { granted: false } },
    { id: "grant", name: "Quick Draw", type: "feat", system: { granted: true } }
  ]);
  await actor.syncGrantedFeats();
  assert.deepEqual(actor.deleted, ["grant"]);
  assert.equal(actor.created.length, 0);
  assert.ok(actor.items.some(i => i.id === "manual"));
});

test("grant synchronisation creates one copy and removes it when the origin disappears", async () => {
  const actor = new SpycraftActor([
    { id: "origin", name: "Agent", type: "origin", system: { grants: ["Quick Draw"] } }
  ]);
  await actor.syncGrantedFeats();
  assert.equal(actor.created.length, 1);
  assert.equal(actor.created[0].system.acquiredAtLevel, 1);
  await actor.syncGrantedFeats();
  assert.equal(actor.created.length, 1);
  actor.items = actor.items.filter(i => i.id !== "origin");
  await actor.syncGrantedFeats();
  assert.equal(actor.items.filter(i => i.type === "feat").length, 0);
});

test("legacy granted feat receives its actual class acquisition level", async () => {
  const actor = new SpycraftActor([
    {
      id: "class",
      name: "Pointman",
      type: "class",
      system: { identifier: "pointman", featGrants: [{ level: 2, feat: "Quick Draw" }] }
    },
    { id: "grant", name: "Quick Draw", type: "feat", system: { granted: true, acquiredAtLevel: 0 } }
  ]);
  actor.system.progression = [{ classId: "pointman" }, { classId: "soldier" }, { classId: "pointman" }];
  actor.system.classLevels = { pointman: 2 };
  await actor.syncGrantedFeats();
  assert.equal(actor.items.find(i => i.id === "grant").system.acquiredAtLevel, 3);
});

test("grant names differing only in case or whitespace create one feat", async () => {
  const actor = new SpycraftActor([
    { id: "talent", name: "Talent", type: "origin", system: { grants: ["Quick Draw"] } },
    { id: "specialty", name: "Specialty", type: "origin", system: { grants: [" quick draw "] } }
  ]);
  await actor.syncGrantedFeats();
  assert.equal(actor.created.length, 1);
  await actor.syncGrantedFeats();
  assert.equal(actor.deleted.length, 0);
});

test("prerequisite checks exclude inactive feats but retain grants and valid feats", () => {
  const actor = new SpycraftActor([
    { id: "invalid", name: "Invalid Feat", type: "feat", system: { tree: "covert", ranks: 1 } },
    { id: "valid", name: "Valid Feat", type: "feat", system: { tree: "covert", ranks: 1 } },
    { id: "grant", name: "Granted Feat", type: "feat", system: { tree: "style", ranks: 1, granted: true } }
  ]);
  actor.system.abilities = Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 10 }]));
  actor.system.featStatus = { invalid: { ok: false }, valid: { ok: true }, grant: { ok: false } };
  assert.equal(actor.checkPrerequisites({ type: "feat", name: "Invalid Feat" }).ok, false);
  assert.equal(actor.checkPrerequisites({ type: "featTree", tree: "covert", min: 2 }).ok, false);
  assert.equal(actor.checkPrerequisites({ type: "feat", name: "Valid Feat" }).ok, true);
  assert.equal(actor.checkPrerequisites({ type: "feat", name: "Granted Feat" }).ok, true);
});

// The originating-client guard must also cover edits, not just creation/deletion.
globalThis.foundry = { utils: { randomID: () => "local-client" } };
globalThis.Item = class {
  async _preUpdate() {
    return this.cancelUpdate ? false : undefined;
  }
  _onUpdate() {}
};
globalThis.game.user = { id: "owner" };
const { SpycraftItem } = await import("../module/documents/item.mjs");

test("editing origin or class grants synchronizes only on the originating client", async () => {
  for (const type of ["origin", "class"]) {
    let calls = 0;
    const item = new SpycraftItem();
    item.type = type;
    item.parent = {
      type: "agent",
      syncGrantedFeats: () => {
        calls++;
      }
    };
    const options = {};
    await item._preUpdate({ system: {} }, options, game.user);
    item._onUpdate({ system: {} }, options, "owner");
    assert.equal(calls, 1);
    item._onUpdate({ system: {} }, { spycraft2Client: "other-client" }, "owner");
    item._onUpdate({ system: {} }, options, "other-user");
    assert.equal(calls, 1);
  }
});

test("cancelled item updates do not acquire an originating-client marker", async () => {
  const item = new SpycraftItem();
  item.cancelUpdate = true;
  const options = {};
  assert.equal(await item._preUpdate({}, options, game.user), false);
  assert.equal(options.spycraft2Client, undefined);
});

test("inherited fixed-feat grants retain their source and original career level", () => {
  const actor = new SpycraftActor([]);
  actor.system.inheritedFeatureGrants = [
    { name: "Flawless Identity", source: "Pointman: Faceman: 1,000 faces", level: 6 }
  ];
  assert.deepEqual(actor.requiredGrantSpecs(), actor.system.inheritedFeatureGrants);
});

test("class grant synchronization retains temporary shared feats independently of class grants", async () => {
  const actor = new SpycraftActor([
    {
      id: "temporary",
      name: "Techie",
      type: "feat",
      system: { granted: true, featKind: "temporary", grantSource: "Professor" }
    }
  ]);
  await actor.syncGrantedFeats();
  assert.deepEqual(actor.deleted, []);
  assert.equal(actor.items.length, 1);
});

test("character exports remove both runtime mutex scopes while preserving ordinary equipment and source inventory", () => {
  const original = Actor.prototype.toCompendium;
  const items = [
    { _id: "sc2ResourceLock1", flags: { spycraft2: { resourceLock: { token: "a" } } } },
    { _id: "sc2GCResourceLk1", flags: { spycraft2: { resourceLock: { token: "b" } } } },
    { _id: "ordinary", name: "Knife" },
    { _id: "sc2ResourceLock1", name: "Unflagged ordinary item" }
  ];
  Actor.prototype.toCompendium = () => ({ items: structuredClone(items) });
  try {
    const data = new SpycraftActor().toCompendium(null);
    assert.equal(data.items.length, 2);
    assert.equal(data.items[0].name, "Knife");
    assert.equal(data.items[1].name, "Unflagged ordinary item");
    assert.equal(items.length, 4);
  } finally {
    if (original) Actor.prototype.toCompendium = original;
    else delete Actor.prototype.toCompendium;
  }
});
test("copied or newly imported characters cannot inherit a live resource transaction lock", async () => {
  const original = Actor.prototype._preCreate;
  Actor.prototype._preCreate = async () => {};
  try {
    const actor = new SpycraftActor(),
      data = {
        items: [
          { _id: "sc2ResourceLock1", flags: { spycraft2: { resourceLock: { token: "copied" } } } },
          { _id: "ordinary", name: "Armor" }
        ]
      };
    let updated;
    actor.updateSource = change => {
      updated = change;
    };
    await actor._preCreate(data, {}, {});
    assert.deepEqual(data.items, [{ _id: "ordinary", name: "Armor" }]);
    assert.deepEqual(updated.items, data.items);
  } finally {
    if (original) Actor.prototype._preCreate = original;
    else delete Actor.prototype._preCreate;
  }
});
