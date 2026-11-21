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
