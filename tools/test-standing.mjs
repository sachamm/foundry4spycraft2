import test from "node:test";
import assert from "node:assert/strict";

globalThis.game = { i18n: { localize: String } };

test("standing at exactly 0 after going below it is still burned, until it is above 0 (p.440)", async () => {
  const { standingStatus: status, standingBurnedAfter } = await import("../module/rules/standing.mjs");
  assert.equal(status({ reputation: 0 }).burned, false);
  assert.equal(status({ reputation: 0, standingBurned: true }).burned, true);
  assert.equal(status({ reputation: 1, standingBurned: true }).burned, false);
  assert.equal(standingBurnedAfter({ reputation: 2 }, { reputation: -1 }), true);
  assert.equal(standingBurnedAfter({ reputation: -1, standingBurned: true }, { reputation: 0 }), undefined);
  assert.equal(standingBurnedAfter({ reputation: 0, standingBurned: true }, { reputation: 1 }), false);
  assert.equal(standingBurnedAfter({ reputation: 2 }, { reputation: 3 }), undefined);
});
