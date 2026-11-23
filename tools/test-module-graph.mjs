import test from "node:test";
import assert from "node:assert/strict";
import { importCycles, moduleGraph } from "./module-graph.mjs";

const graph = moduleGraph();

/*
 * Import cycles that are known and accepted. Each one is reviewed: its members only call each other inside functions,
 * never at module top level, so load order cannot hit a not-yet-initialized binding. Remove an entry when the cycle is
 * broken; add one only with the same review.
 */
const ACCEPTED_CYCLES = [
  // Counter-trip validates against the settled trip; the trip settlement checks the counter-trip receipt.
  ["module/apps/counter-trip.mjs", "module/apps/trip-outcomes.mjs"]
];

test("no new import cycles, and every accepted cycle still exists", () => {
  const key = cycle => cycle.join(" ");
  const found = importCycles(graph).map(key);
  const accepted = ACCEPTED_CYCLES.map(cycle => key([...cycle].sort()));
  assert.deepEqual(
    found.filter(cycle => !accepted.includes(cycle)),
    [],
    "New import cycle. Move the shared helper into its own module instead of importing back."
  );
  assert.deepEqual(
    accepted.filter(cycle => !found.includes(cycle)),
    [],
    "This cycle is gone: remove it from ACCEPTED_CYCLES."
  );
});

test("rules stay pure: module/rules imports no apps, sheets, rolls, documents or services", () => {
  const layered = /^module\/(apps|sheets|rolls|documents|services)\//;
  const leaks = [...graph]
    .filter(([file]) => file.startsWith("module/rules/"))
    .flatMap(([file, deps]) => deps.filter(dep => layered.test(dep)).map(dep => `${file} -> ${dep}`));
  assert.deepEqual(leaks, []);
});

test("the cycle finder reports a cycle and ignores a chain", () => {
  const sample = new Map([
    ["a", ["b"]],
    ["b", ["c"]],
    ["c", ["a"]],
    ["d", ["a"]]
  ]);
  assert.deepEqual(importCycles(sample), [["a", "b", "c"]]);
  assert.deepEqual(
    importCycles(
      new Map([
        ["x", ["y"]],
        ["y", []]
      ])
    ),
    []
  );
});

test("every system module is reachable from spycraft2.mjs", () => {
  const seen = new Set();
  const walk = file => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const dep of graph.get(file) ?? []) walk(dep);
  };
  walk("spycraft2.mjs");
  // dialog-kit is a one-import kit for new dialog code; existing files import the helpers directly.
  assert.deepEqual(
    [...graph.keys()].filter(file => !seen.has(file) && file !== "module/apps/dialog-kit.mjs"),
    []
  );
});

/*
 * Dependencies should point one way: rules at the bottom, then services and data, then documents and rolls, then
 * apps, then sheets. The edges below point the other way. They are counted so that the number can only fall: a new
 * feature registers itself with the layer above (as roll contributors do with the roll pipeline) instead of being
 * imported by the layer below. Lower a limit when edges are removed; never raise one.
 */
const UPWARD_EDGE_LIMITS = {
  "documents -> apps": 62,
  "rolls -> apps": 60,
  "services -> apps": 2,
  "apps -> sheets": 1,
  "data -> services": 1,
  "data -> apps": 0,
  "services -> documents": 0,
  "services -> sheets": 0,
  "documents -> sheets": 0,
  "rolls -> sheets": 0
};

test("layers do not gain imports that point upward", () => {
  const layer = file => file.match(/^module\/([^/]+)\//)?.[1];
  const counts = Object.fromEntries(Object.keys(UPWARD_EDGE_LIMITS).map(edge => [edge, 0]));
  for (const [file, deps] of graph)
    for (const dep of deps) {
      const edge = `${layer(file)} -> ${layer(dep)}`;
      if (edge in counts) counts[edge] += 1;
    }
  for (const [edge, limit] of Object.entries(UPWARD_EDGE_LIMITS))
    assert.ok(
      counts[edge] <= limit,
      `${edge}: ${counts[edge]} imports, limit ${limit}. Register with the layer above.`
    );
  // A limit left above the real count hides the next upward import.
  assert.deepEqual(counts, UPWARD_EDGE_LIMITS, "An upward import was removed: lower its limit to match.");
});
