import test from "node:test";
import assert from "node:assert/strict";

globalThis.foundry = { utils: { escapeHTML: String } };
globalThis.game = { i18n: { localize: String } };
const { latestVitalityReview } = await import("../module/rules/vitality.mjs");

test("a stored vitality roll brings back its latest GC review", () => {
  const actor = {
    flags: {
      spycraft2: {
        vitalityReviews: {
          r1: { id: "aaaaaaaaaaaaaaaa", levelId: "lvl1", value: 3, at: 10 },
          r2: { id: "bbbbbbbbbbbbbbbb", levelId: "lvl1", value: 2, at: 10, previousReviewId: "aaaaaaaaaaaaaaaa" },
          r3: { id: "cccccccccccccccc", levelId: "other", value: 6, at: 30 }
        }
      }
    }
  };
  assert.equal(latestVitalityReview(actor, "lvl1").value, 2);
  assert.equal(latestVitalityReview(actor, "none"), null);
  assert.equal(latestVitalityReview(actor, ""), null);
});
