import test from "node:test";
import assert from "node:assert/strict";
import { postFinalAttack } from "../module/apps/final-attack.mjs";
const proof = () => ({ id: "earned-final", source: "test" }),
  setup = () => {
    globalThis.game = { messages: [] };
    const a = { uuid: "Actor.owner", items: { get: id => ({ id }) } };
    return a;
  },
  publish = (a, receipt) => {
    const m = {
      id: "actual",
      uuid: "ChatMessage.actual",
      flags: { spycraft2: { actorUuid: a.uuid, checkKind: "attack", finalAttack: receipt } }
    };
    game.messages.push(m);
    return m;
  };
test("an unposted null, warning, notification or unregistered document cannot masquerade as a committed final attack", async () => {
  for (const value of [
    null,
    undefined,
    "Warning notification",
    { warning: "blocked" },
    { uuid: "ChatMessage.unregistered" }
  ]) {
    const a = setup();
    let calls = 0;
    a.rollAttack = async () => {
      calls++;
      return value;
    };
    await assert.rejects(
      postFinalAttack(a, "weapon", {}, proof(), () => {}),
      /cancelled before posting|did not post/
    );
    assert.equal(calls, 1);
    assert.equal(game.messages.length, 0);
  }
});
test("a real recorded final attack survives a lost response or warning return without executing the attack again", async () => {
  for (const mode of ["ordinary", "warning", "undefined", "throw"]) {
    const a = setup(),
      receipt = proof();
    let calls = 0,
      actual;
    a.rollAttack = async () => {
      calls++;
      actual = publish(a, receipt);
      if (mode === "throw") throw Error("response lost");
      return mode === "ordinary" ? actual : mode === "warning" ? { warning: "late notification" } : undefined;
    };
    const r = await postFinalAttack(a, "weapon", {}, receipt, () => {});
    assert.equal(r, actual);
    assert.equal(calls, 1);
    assert.equal(game.messages.length, 1);
  }
});
test("source validation precedes any attack and another actor or another opportunity cannot supply its posted-result proof", async () => {
  let a = setup(),
    calls = 0;
  a.rollAttack = async () => {
    calls++;
  };
  await assert.rejects(
    postFinalAttack(a, "weapon", {}, proof(), () => {
      throw Error("source changed");
    }),
    /source changed/
  );
  assert.equal(calls, 0);
  for (const mismatch of ["actor", "opportunity"]) {
    a = setup();
    a.rollAttack = async () =>
      publish(
        mismatch === "actor" ? { uuid: "Actor.other" } : a,
        mismatch === "opportunity" ? { id: "different" } : proof()
      );
    await assert.rejects(
      postFinalAttack(a, "weapon", {}, proof(), () => {}),
      /did not post/
    );
  }
});
