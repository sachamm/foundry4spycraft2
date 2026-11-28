import test from "node:test";
import assert from "node:assert/strict";
import { changedFigures } from "../module/sheets/change-announcer.mjs";

test("a redrawn strip says only the figures that changed, and nothing on its first reading", () => {
  assert.deepEqual(changedFigures(null, { "Threat Level": "3" }), []);
  assert.deepEqual(changedFigures({ "Threat Level": "3", Defense: "14" }, { "Threat Level": "4", Defense: "14" }), [
    "Threat Level 4"
  ]);
  assert.deepEqual(
    changedFigures({ Defense: "14" }, { Defense: "14", Health: "12" }),
    [],
    "a new figure is not a change"
  );
});
