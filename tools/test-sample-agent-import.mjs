import test from "node:test";
import assert from "node:assert/strict";
import { ensureSampleCompanions, installSampleAgentHooks } from "../module/sample-agents.mjs";
const uuid = n => `Actor.owner${n}`;
function fixture({ gm = true, leading = true, failAt = 0 } = {}) {
  const actors = [];
  let creates = 0,
    saves = 0;
  globalThis.game = { user: { id: "gm", isGM: gm }, users: { activeGM: { id: leading ? "gm" : "other" } }, actors };
  globalThis.ui = { notifications: { warn() {} } };
  globalThis.Actor = {
    create: async data => {
      creates++;
      assert.equal(data._id, undefined);
      assert.match(data.system.companionOf.ownerUuid, /^Actor\./);
      const doc = { ...data, id: "pet" + creates, getFlag: (s, k) => data.flags?.[s]?.[k] };
      actors.push(doc);
      return doc;
    }
  };
  function owner(n = 1) {
    const flags = { spycraft2: { sampleAgent: "tomas-aalto" } };
    return {
      uuid: uuid(n),
      type: "agent",
      pack: null,
      system: { activeFeatNames: ["Animal Partner"] },
      folder: { id: "folder" + n },
      ownership: { default: 0, player: 3 },
      getFlag: (s, k) => flags[s]?.[k],
      setFlag: async (s, k, v) => {
        if (++saves === failAt) throw Error("lost acknowledgement");
        flags[s] ??= {};
        flags[s][k] = structuredClone(v);
      }
    };
  }
  return {
    actors,
    owner,
    get creates() {
      return creates;
    }
  };
}
test("importing an eligible sample creates a complete companion linked to the actual world copy", async () => {
  const f = fixture(),
    owner = f.owner();
  await ensureSampleCompanions(owner);
  assert.equal(f.creates, 1);
  const pet = f.actors[0];
  assert.equal(pet.system.companionOf.ownerUuid, owner.uuid);
  assert.deepEqual(pet.ownership, owner.ownership);
  assert.equal(pet.folder, owner.folder.id);
  assert.equal(pet.items.length, 2);
  assert.equal(pet.system.npcType, "animal");
  await ensureSampleCompanions(owner);
  assert.equal(f.creates, 1);
  f.actors.length = 0;
  await ensureSampleCompanions(owner);
  assert.equal(f.creates, 1);
});
test("different world copies receive their own companions and repeated concurrent hooks coalesce", async () => {
  const f = fixture(),
    a = f.owner(1),
    b = f.owner(2);
  await Promise.all([ensureSampleCompanions(a), ensureSampleCompanions(a), ensureSampleCompanions(b)]);
  assert.equal(f.creates, 2);
  assert.deepEqual(new Set(f.actors.map(p => p.system.companionOf.ownerUuid)), new Set([a.uuid, b.uuid]));
});
test("an interrupted receipt resumes by adopting the existing created companion without duplicating it", async () => {
  const f = fixture({ failAt: 1 }),
    a = f.owner(),
    old = console.error;
  console.error = () => {};
  try {
    await ensureSampleCompanions(a);
    await ensureSampleCompanions(a);
    assert.equal(f.creates, 1);
    assert.ok(a.getFlag("spycraft2", "sampleCompanionImports").ids.bracken);
  } finally {
    console.error = old;
  }
});
test("players, other GMs, compendium documents, unselected samples and owners without the feat create nothing", async () => {
  for (const setup of [
    { gm: false },
    { leading: false },
    { pack: "spycraft2.sample-agents" },
    { noFeat: true },
    { other: true }
  ]) {
    const f = fixture(setup),
      a = f.owner();
    if (setup.pack) a.pack = setup.pack;
    if (setup.noFeat) a.system.activeFeatNames = [];
    if (setup.other) a.getFlag = () => undefined;
    await ensureSampleCompanions(a);
    assert.equal(f.creates, 0);
  }
});
test("the installer registers native actor-import and retry hooks without seeding sample agents", () => {
  const calls = [];
  globalThis.Hooks = { on: (name, fn) => calls.push([name, fn]), once: (name, fn) => calls.push([name, fn]) };
  installSampleAgentHooks();
  assert.deepEqual(
    calls.map(c => c[0]),
    ["createActor", "ready"]
  );
});
