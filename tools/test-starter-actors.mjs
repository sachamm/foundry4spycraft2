import test from "node:test";
import assert from "node:assert/strict";
import { setupActorFolders } from "../module/actor-folders.mjs";
import { buildPacks } from "./lib/pack-docs.mjs";
import { computeNpcProfile } from "../module/rules/npcs.mjs";

const { packs } = buildPacks();
const cast = packs["sample-npcs"];

test("starter cast has one mastermind, three henchmen and eight minion profiles with valid scalable builds", () => {
  assert.equal(cast.docs.length, 12);
  for (const [role, count] of [
    ["mastermind", 1],
    ["henchman", 3],
    ["minion", 8]
  ]) {
    const docs = cast.docs.filter(doc => doc.system.npcProfile.qualities.some(q => q.id === role));
    assert.equal(docs.length, count);
    for (const doc of docs) {
      assert.equal(doc.system.npcType, role === "minion" ? "standard" : "special");
      assert.ok(doc.flags.spycraft2.sampleNpc);
      assert.ok(cast.folders.some(folder => folder._id === doc.folder));
      assert.ok(doc.embedded.items.length);
      for (let tl = 1; tl <= 20; tl++) {
        const result = computeNpcProfile(doc.system.npcProfile, doc.system.npcType, tl, doc.system.abilities);
        assert.deepEqual(result.warnings, [], `${doc.name} TL ${tl}`);
        assert.ok(result.complete);
      }
      if (role !== "minion") {
        const result = computeNpcProfile(doc.system.npcProfile, "special", 1, doc.system.abilities);
        assert.equal(doc.system.vitality.value, result.health[0]);
        assert.equal(doc.system.wounds.value, result.health[1]);
        assert.equal(doc.prototypeToken.actorLink, true);
      }
    }
  }
});

function fixture({
  gm = true,
  leading = true,
  failAt = 0,
  committedFailure = false,
  legacy = false,
  companions = false
} = {}) {
  const settings = new Map([
    ["actorFolderSetup", legacy],
    ["sampleActorSetup", {}]
  ]);
  const folders = [];
  const actors = [];
  let calls = 0;
  const folder = data => ({
    id: `folder-${folders.length}`,
    type: "Actor",
    folder: null,
    sort: 0,
    ...data,
    async update(patch) {
      Object.assign(this, patch);
    }
  });
  if (legacy) folders.push(folder({ name: "Sample Level-1 Agents" }));
  function actor(data) {
    return {
      ...data,
      id: `world-${actors.length}`,
      uuid: `Actor.world-${actors.length}`,
      folder: folders.find(f => f.id === data.folder),
      system: {
        ...data.system,
        activeFeatNames: companions
          ? (data.items ?? []).filter(item => item.type === "feat").map(item => item.name)
          : []
      },
      getFlag(scope, key) {
        return this.flags?.[scope]?.[key];
      },
      async update(patch) {
        if (patch.folder) this.folder = folders.find(f => f.id === patch.folder);
      },
      async setFlag(scope, key, value) {
        this.flags[scope][key] = value;
      }
    };
  }
  globalThis.game = {
    user: { id: "gm", isGM: gm },
    users: { activeGM: { id: leading ? "gm" : "other" } },
    settings: {
      get: (_s, key) => structuredClone(settings.get(key)),
      set: async (_s, key, value) => settings.set(key, structuredClone(value))
    },
    folders,
    actors,
    packs: new Map(
      ["sample-npcs", "sample-agents"].map(name => [
        `spycraft2.${name}`,
        {
          getDocuments: async () =>
            packs[name].docs.map(source => ({
              name: source.name,
              uuid: `Compendium.spycraft2.${name}.Actor.${source._id}`,
              getFlag: (scope, key) => source.flags[scope][key],
              toObject: () => {
                const { embedded, ...data } = structuredClone(source);
                return { ...data, items: embedded.items };
              }
            }))
        }
      ])
    )
  };
  globalThis.Folder = {
    create: async data => {
      const result = folder(data);
      folders.push(result);
      return result;
    }
  };
  globalThis.Actor = {
    create: async data => {
      calls++;
      if (calls === failAt && !committedFailure) throw Error("disconnected before create");
      assert.equal(data._id, undefined);
      const result = actor(data);
      actors.push(result);
      if (calls === failAt && committedFailure) throw Error("disconnected after create");
      return result;
    }
  };
  return {
    actors,
    folders,
    settings,
    actor,
    get calls() {
      return calls;
    }
  };
}

test("new and previously initialized worlds receive all starter actors in the right folders once", async () => {
  for (const legacy of [false, true]) {
    const f = fixture({ legacy });
    await setupActorFolders();
    assert.equal(f.actors.length, 28);
    assert.deepEqual(f.folders.map(f => f.name).sort(), ["Henchmen", "Masterminds", "Minions", "Sample PCs"]);
    for (const [name, count] of [
      ["Masterminds", 1],
      ["Henchmen", 3],
      ["Minions", 8],
      ["Sample PCs", 16]
    ])
      assert.equal(f.actors.filter(actor => actor.folder.name === name).length, count);
    assert.equal(f.settings.get("sampleActorSetup").status, "done");
    f.actors[0].name = "My edited villain";
    f.actors[0].folder = null;
    f.actors.pop();
    await setupActorFolders();
    assert.equal(f.calls, 28);
    assert.equal(f.actors[0].name, "My edited villain");
    assert.equal(f.actors[0].folder, null);
    assert.equal(f.actors.length, 27);
  }
});

test("manual sample imports are adopted without replacing their data or creating duplicates", async () => {
  const f = fixture();
  const source = packs["sample-agents"].docs[0];
  const existing = f.actor({ name: "My renamed PC", flags: source.flags, system: {} });
  f.actors.push(existing);
  await setupActorFolders();
  assert.equal(f.calls, 27);
  assert.equal(existing.name, "My renamed PC");
  assert.equal(existing.folder.name, "Sample PCs");
});

test("interrupted imports resume, including a create committed before disconnect, without duplicates", async () => {
  const log = console.error;
  console.error = () => {};
  try {
    for (const committedFailure of [false, true]) {
      const f = fixture({ failAt: 6, committedFailure });
      await setupActorFolders();
      assert.equal(f.settings.get("sampleActorSetup").status, "pending");
      await setupActorFolders();
      assert.equal(f.actors.length, 28);
      assert.equal(
        new Set(f.actors.map(a => a.getFlag("spycraft2", "sampleNpc") ?? a.getFlag("spycraft2", "sampleAgent"))).size,
        28
      );
      assert.equal(f.settings.get("sampleActorSetup").status, "done");
    }
  } finally {
    console.error = log;
  }
});

test("non-leading clients do nothing, concurrent leading calls share one import, missing packs retry", async () => {
  for (const options of [{ gm: false }, { leading: false }]) {
    const f = fixture(options);
    await setupActorFolders();
    assert.equal(f.calls, 0);
    assert.equal(f.folders.length, 0);
  }
  const f = fixture();
  await Promise.all([setupActorFolders(), setupActorFolders()]);
  assert.equal(f.calls, 28);
  const retry = fixture();
  const pack = game.packs.get("spycraft2.sample-agents");
  game.packs.delete("spycraft2.sample-agents");
  const log = console.error;
  console.error = () => {};
  try {
    await setupActorFolders();
  } finally {
    console.error = log;
  }
  assert.equal(retry.calls, 0);
  assert.equal(retry.settings.get("sampleActorSetup").status, "pending");
  game.packs.set("spycraft2.sample-agents", pack);
  await setupActorFolders();
  assert.equal(retry.calls, 28);
});

test("automatic PC setup includes the real Scout animal partner in Sample PCs, linked once to its world owner", async () => {
  const f = fixture({ companions: true });
  await setupActorFolders();
  const partner = f.actors.find(actor => actor.getFlag("spycraft2", "sampleCompanion"));
  assert.ok(partner);
  const owner = f.actors.find(actor => actor.uuid === partner.system.companionOf.ownerUuid);
  assert.ok(owner?.getFlag("spycraft2", "sampleAgent"));
  assert.equal(partner.folder.name, "Sample PCs");
  assert.equal(f.actors.length, 29);
  await setupActorFolders();
  assert.equal(f.calls, 29);
});
