import test from "node:test";
import assert from "node:assert/strict";
import { hazardSaveResolvers, resolveHazardSave } from "../module/apps/hazards.mjs";
import { reviewHazardResolution } from "../module/apps/hazard-resolution-records.mjs";

globalThis.game = { user: { id: "gc", isGM: true } };
globalThis.foundry = { utils: { randomID: () => `lease${++sequence}` } };
let sequence = 0;

function fixture(options = {}) {
  const calls = [];
  const check = {
    actorUuid: "Actor.hazard",
    effectiveTotal: 9,
    hazardSave: { kind: "resolution-test", dc: 10 },
    ...options
  };
  const message = {
    id: "hazard1",
    uuid: "ChatMessage.hazard1",
    flags: { spycraft2: check },
    async update(patch) {
      assert.equal(patch["flags.spycraft2.hazardSave.resolved"], true);
      check.hazardSave.resolved = true;
      calls.push("applied");
      return this;
    }
  };
  const actor = {
    uuid: "Actor.hazard",
    isOwner: true,
    flags: {},
    async update(patch) {
      for (const [path, value] of Object.entries(patch)) {
        const keys = path.split(".");
        let target = this;
        for (const key of keys.slice(0, -1)) target = target[key] ??= {};
        const key = keys.at(-1);
        if (key.startsWith("-=")) delete target[key.slice(2)];
        else target[key] = structuredClone(value);
      }
      return this;
    },
    async confirmCheckOutcome(m, outcome) {
      calls.push("confirm");
      assert.equal(outcome.difficultyClass, 10);
      check.successConfirmed = outcome.succeeded;
      return m;
    },
    async finishCheck(m) {
      calls.push("finish");
      check.resolved = true;
      return m;
    }
  };
  hazardSaveResolvers.set("resolution-test", async (a, m, save, succeeded, frozen) => {
    assert.equal(a, actor);
    assert.equal(m, message);
    assert.equal(frozen.resolved, true, "effects only use a finished roll");
    calls.push(succeeded ? "success" : "failure");
  });
  return { actor, message, check, calls };
}

test("hazard settlement confirms and closes both successful and failed saves before effects", async () => {
  for (const effectiveTotal of [9, 10]) {
    const f = fixture({ effectiveTotal });
    const succeeded = effectiveTotal >= 10;
    assert.equal(await resolveHazardSave(f.actor, f.message), succeeded);
    assert.deepEqual(f.calls, ["confirm", "finish", succeeded ? "success" : "failure", "applied"]);
    assert.equal(await resolveHazardSave(f.actor, f.message), null);
    assert.equal(f.calls.length, 4);
  }
});

test("a confirmed outcome is preserved when the save closes", async () => {
  const f = fixture({ successConfirmed: true });
  assert.equal(await resolveHazardSave(f.actor, f.message), true);
  assert.deepEqual(f.calls, ["finish", "success", "applied"]);
});

test("cancelled confirmation or refused finalization applies no hazard effect", async () => {
  for (const method of ["confirmCheckOutcome", "finishCheck"]) {
    const f = fixture();
    f.actor[method] = async () => null;
    assert.equal(await resolveHazardSave(f.actor, f.message), null);
    assert.equal(f.check.hazardSave.resolved, undefined);
    assert.equal(f.calls.includes("failure"), false);
  }
});

test("invalid, superseded, unauthorized and wrong-character saves cannot settle", async () => {
  for (const options of [
    { superseded: true },
    { actorUuid: "Actor.other" },
    { effectiveTotal: NaN },
    { hazardSave: { kind: "resolution-test", dc: NaN } }
  ]) {
    const f = fixture(options);
    assert.equal(await resolveHazardSave(f.actor, f.message), null);
    assert.deepEqual(f.calls, []);
  }
  const f = fixture();
  f.actor.isOwner = false;
  assert.equal(await resolveHazardSave(f.actor, f.message), null);
  assert.deepEqual(f.calls, []);
});

test("an interrupted effect requires explicit GC verification before retrying the frozen roll", async () => {
  const f = fixture();
  const resolve = hazardSaveResolvers.get("resolution-test");
  hazardSaveResolvers.set("resolution-test", async () => {
    throw new Error("effect interrupted");
  });
  await assert.rejects(resolveHazardSave(f.actor, f.message), /effect interrupted/);
  assert.equal(f.check.resolved, true);
  assert.equal(f.check.hazardSave.resolved, undefined);
  hazardSaveResolvers.set("resolution-test", resolve);
  await assert.rejects(resolveHazardSave(f.actor, f.message), /already started/);
  await reviewHazardResolution(f.actor, f.message, {
    decision: "release",
    noEffects: true,
    noDice: true,
    note: "The injected failure happened before any effects or dice."
  });
  assert.equal(await resolveHazardSave(f.actor, f.message), false);
  assert.deepEqual(f.calls, ["confirm", "finish", "failure", "applied"]);
});

test("GC keeps actual interrupted effects and dice without replay, and incomplete release proof is refused", async () => {
  const f = fixture({ resolved: true, successConfirmed: false });
  let actualDice = 0;
  hazardSaveResolvers.set("resolution-test", async () => {
    actualDice++;
    throw Error("result lost after actual dice");
  });
  await assert.rejects(resolveHazardSave(f.actor, f.message), /result lost/);
  await assert.rejects(resolveHazardSave(f.actor, f.message), /already started/);
  await assert.rejects(
    reviewHazardResolution(f.actor, f.message, {
      decision: "release",
      noEffects: true,
      noDice: false,
      note: "Actual dice happened."
    }),
    /both no effects and no dice/
  );
  await reviewHazardResolution(f.actor, f.message, {
    decision: "keep",
    note: "Verified and retained the actual dice and outcome."
  });
  assert.equal(actualDice, 1);
  assert.equal(f.check.hazardSave.resolved, true);
  assert.equal(f.actor.flags.spycraft2.hazardResolutions.hazard1.state, "complete");
  assert.equal(await resolveHazardSave(f.actor, f.message), null);
  assert.equal(actualDice, 1);
});

test("a completed actor receipt repairs a lost card update without applying effects twice", async () => {
  const f = fixture({ resolved: true, successConfirmed: false }),
    update = f.message.update;
  let writes = 0;
  f.message.update = async function (patch) {
    if (++writes === 1) throw Error("card response lost");
    return update.call(this, patch);
  };
  await assert.rejects(resolveHazardSave(f.actor, f.message), /effects are recorded/);
  assert.equal(f.actor.flags.spycraft2.hazardResolutions.hazard1.state, "complete");
  assert.equal(await resolveHazardSave(f.actor, f.message), false);
  assert.equal(f.calls.filter(c => c === "failure").length, 1);
});

test("duplicate concurrent deliveries and altered or unauthorized reviews cannot replay a hazard", async () => {
  const f = fixture({ resolved: true, successConfirmed: false });
  await Promise.allSettled([resolveHazardSave(f.actor, f.message), resolveHazardSave(f.actor, f.message)]);
  assert.equal(f.calls.filter(c => c === "failure").length, 1);
  const g = fixture({ resolved: true, successConfirmed: false });
  hazardSaveResolvers.set("resolution-test", async () => {
    throw Error("interrupted");
  });
  await assert.rejects(resolveHazardSave(g.actor, g.message), /interrupted/);
  game.user.isGM = false;
  assert.equal(await reviewHazardResolution(g.actor, g.message, { decision: "keep", note: "No GC authority" }), null);
  game.user.isGM = true;
  g.check.effectiveTotal = 10;
  await assert.rejects(
    reviewHazardResolution(g.actor, g.message, { decision: "keep", note: "Changed save" }),
    /original hazard save/
  );
});

test("a refused final transaction cannot report a completed hazard", async () => {
  const f = fixture({ resolved: true, successConfirmed: false });
  let transactions = 0;
  game.spycraft2 = { resourceLocks: { run: async (actors, work) => (++transactions === 1 ? work() : null) } };
  try {
    await assert.rejects(resolveHazardSave(f.actor, f.message), /still pending/);
    assert.equal(f.actor.flags.spycraft2.hazardResolutions.hazard1.state, "started");
    assert.equal(f.check.hazardSave.resolved, undefined);
  } finally {
    delete game.spycraft2;
  }
});

test("ordinary Undo cannot erase a hazard's replay protection", async () => {
  const { snapshot } = await import("../module/apps/undo.mjs");
  const f = fixture({ resolved: true, successConfirmed: false }),
    before = snapshot(f.actor);
  await resolveHazardSave(f.actor, f.message);
  assert.equal(f.actor.flags.spycraft2.hazardResolutions.hazard1.state, "complete");
  assert.deepEqual(
    snapshot(f.actor).data,
    before.data,
    "resolution bookkeeping stays outside reversible actor effects"
  );
});

test("already finished but unapplied saves remain usable", async () => {
  const f = fixture({ resolved: true, successConfirmed: false });
  assert.equal(await resolveHazardSave(f.actor, f.message), false);
  assert.deepEqual(f.calls, ["failure", "applied"]);
});
