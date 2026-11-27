import test from "node:test";
import assert from "node:assert/strict";
import { hazardSaveResolvers, resolveHazardSave } from "../module/apps/hazards.mjs";

globalThis.game = { user: { isGM: true } };

function fixture(options = {}) {
  const calls = [];
  const check = {
    actorUuid: "Actor.hazard",
    effectiveTotal: 9,
    hazardSave: { kind: "resolution-test", dc: 10 },
    ...options
  };
  const message = {
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

test("a failed effect can retry without reopening or reconfirming its frozen roll", async () => {
  const f = fixture();
  const resolve = hazardSaveResolvers.get("resolution-test");
  hazardSaveResolvers.set("resolution-test", async () => {
    throw new Error("effect interrupted");
  });
  await assert.rejects(resolveHazardSave(f.actor, f.message), /effect interrupted/);
  assert.equal(f.check.resolved, true);
  assert.equal(f.check.hazardSave.resolved, undefined);
  hazardSaveResolvers.set("resolution-test", resolve);
  assert.equal(await resolveHazardSave(f.actor, f.message), false);
  assert.deepEqual(f.calls, ["confirm", "finish", "failure", "applied"]);
});

test("already finished but unapplied saves remain usable", async () => {
  const f = fixture({ resolved: true, successConfirmed: false });
  assert.equal(await resolveHazardSave(f.actor, f.message), false);
  assert.deepEqual(f.calls, ["failure", "applied"]);
});
