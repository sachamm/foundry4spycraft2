import assert from "node:assert/strict";
import test from "node:test";

globalThis.game = { i18n: { has: () => false, localize: key => key, format: key => key } };
const { searchMatches } = await import("../module/apps/tool-search.mjs");

test("search matches every word typed, in any order, not one exact run", () => {
  assert.equal(searchMatches("mission report: xp report experience", "xp report"), true);
  assert.equal(searchMatches("award standing reputation", "reputation award"), true);
  assert.equal(searchMatches("award standing", "award xp"), false);
  assert.equal(searchMatches("anything", ""), true);
});
