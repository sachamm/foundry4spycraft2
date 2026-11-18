import test from "node:test";
import assert from "node:assert/strict";
import { setupSampleScenes } from "../module/sample-scenes.mjs";
function fixture({ existing = [], status, gm = true, active = true, failAt = 0 } = {}) {
  let state = status ? { status } : {};
  let calls = 0;
  const scenes = [...existing];
  const doc = slug => ({
    getFlag: () => slug,
    toObject: () => ({ _id: slug, flags: { spycraft2: { sampleScene: slug } }, tokens: [] })
  });
  globalThis.game = {
    user: { id: "gm", isGM: gm },
    users: { activeGM: { id: active ? "gm" : "other" } },
    settings: {
      get: () => state,
      set: async (_s, _k, v) => {
        state = v;
      }
    },
    scenes: {
      get size() {
        return scenes.length;
      },
      some: fn => scenes.some(fn)
    },
    packs: new Map([["spycraft2.sample-scenes", { getDocuments: async () => ["a", "b", "c"].map(doc) }]])
  };
  globalThis.Scene = {
    create: async data => {
      calls++;
      if (calls === failAt) throw Error("interrupted");
      scenes.push(doc(data.flags.spycraft2.sampleScene));
      assert.equal(data._id, undefined);
      assert.equal(data.active, false);
      assert.equal(data.navigation, true);
    }
  };
  globalThis.ui = { notifications: { info() {}, warn() {} } };
  return {
    scenes,
    get state() {
      return state;
    },
    get calls() {
      return calls;
    }
  };
}
test("empty world receives three scenes once, and deletion does not trigger reseeding", async () => {
  const f = fixture();
  await setupSampleScenes();
  assert.equal(f.calls, 3);
  assert.equal(f.state.status, "done");
  f.scenes.length = 0;
  await setupSampleScenes();
  assert.equal(f.calls, 3);
});
test("existing worlds and non-leading GMs are left alone", async () => {
  for (const options of [{ existing: [{}] }, { gm: false }, { active: false }]) {
    const f = fixture(options);
    await setupSampleScenes();
    assert.equal(f.calls, 0);
  }
});
test("interrupted import resumes without duplicating completed scenes", async () => {
  const f = fixture({ failAt: 2 });
  const log = console.error;
  console.error = () => {};
  try {
    await setupSampleScenes();
    assert.equal(f.state.status, "pending");
    assert.equal(f.scenes.length, 1);
    await setupSampleScenes();
    assert.equal(f.scenes.length, 3);
    assert.equal(f.state.status, "done");
  } finally {
    console.error = log;
  }
});
