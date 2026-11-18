import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { checkRecord, validShape } from "../module/rules/record-check.mjs";
import { RECORD_SHAPES } from "../module/data/record-shapes.mjs";
import { reportRecord } from "../module/data/record-field.mjs";

const problems = (shape, value) => checkRecord(shape, value).map(p => `${p.path}: ${p.problem}`);

test("a type union accepts its types and names what it found otherwise", () => {
  assert.deepEqual(problems("number|null", 3), []);
  assert.deepEqual(problems("number|null", null), []);
  assert.deepEqual(problems("number|null", "3"), [": expected number|null, found string"]);
  assert.deepEqual(problems("any", { deep: [1] }), []);
  assert.deepEqual(problems("object", []), [": expected object, found array"]);
  assert.deepEqual(problems("string", undefined), []);
});

test("records check listed keys, map keys through *, and report keys nobody declared", () => {
  const shape = { id: "string", round: "number", proof: { dc: "number" }, uses: { "*": { count: "number" } } };
  assert.deepEqual(
    problems(shape, { id: "a", round: 2, proof: { dc: 15 }, uses: { x1: { count: 1 }, x2: { count: 2 } } }),
    []
  );
  assert.deepEqual(problems(shape, {}), []);
  assert.deepEqual(problems(shape, { id: 5, extra: true, proof: { dc: "15" }, uses: { x1: { count: "1" } } }), [
    "id: expected string, found number",
    "extra: undeclared key",
    "proof.dc: expected number, found string",
    "uses.x1.count: expected number, found string"
  ]);
  assert.deepEqual(problems(shape, "nope"), [": expected a record, found string"]);
});

test("lists check every entry; $also and $list allow a record to be something else too", () => {
  assert.deepEqual(problems([{ id: "string" }], [{ id: "a" }, { id: 2 }]), ["[1].id: expected string, found number"]);
  assert.deepEqual(problems([{ id: "string" }], { id: "a" }), [": expected a list, found object"]);
  const flexible = { $also: "null|boolean", $list: "number", id: "string" };
  assert.deepEqual(problems(flexible, null), []);
  assert.deepEqual(problems(flexible, true), []);
  assert.deepEqual(problems(flexible, [1, 2]), []);
  assert.deepEqual(problems(flexible, [1, "2"]), ["[1]: expected number, found string"]);
  assert.deepEqual(problems(flexible, "text"), [": expected a record, found string"]);
});

test("every declared shape is well formed, and every field that uses one has it", async () => {
  for (const [name, shape] of Object.entries(RECORD_SHAPES)) assert.ok(validShape(shape), name);
  assert.equal(validShape({ id: "text" }), false);
  assert.equal(validShape(["number", "string"]), false);
  const models = await readFile(new URL("../module/data/actor.mjs", import.meta.url), "utf8");
  const used = [...models.matchAll(/record(List)?\("(\w+)"/g)];
  assert.ok(used.length >= 40);
  for (const [, list, name] of used) {
    assert.ok(name in RECORD_SHAPES, `${name} has no declared shape`);
    assert.equal(Array.isArray(RECORD_SHAPES[name]), !!list, `${name}: list and record declarations must agree`);
  }
});

test("records the rules write fit their declared shapes", () => {
  const clock = { combatId: "c1", combatantId: "t1", startRound: 2, dueRound: 3 };
  assert.deepEqual(problems(RECORD_SHAPES.combatExpertise, { ...clock, penalty: 2 }), []);
  assert.deepEqual(problems(RECORD_SHAPES.totalDefense, { ...clock, equilibrium: { feat: "Equilibrium Basics" } }), []);
  assert.deepEqual(problems(RECORD_SHAPES.combatExpertise, { ...clock, penalty: "2" }), [
    "penalty: expected number, found string"
  ]);
  assert.deepEqual(
    problems(RECORD_SHAPES.disposition, { base: "neutral", toward: { "Actor.x": { grade: "friendly" } } }),
    []
  );
  assert.deepEqual(problems(RECORD_SHAPES.actionDieAwards, { m1: { count: 2, mission: "m1", events: [] } }), []);
});

test("a misfit is reported once per problem and never thrown", () => {
  const seen = [];
  const shape = { id: "string" };
  assert.equal(reportRecord("demoRecord", shape, { id: 1, extra: 2 }, m => seen.push(m)).length, 2);
  reportRecord("demoRecord", shape, { id: 7, extra: 9 }, m => seen.push(m));
  assert.equal(seen.length, 2);
  assert.match(seen[0], /record "demoRecord" at id: expected string, found number/);
  assert.match(seen[1], /undeclared key/);
  assert.deepEqual(
    reportRecord("demoRecord", shape, { id: "ok" }, m => seen.push(m)),
    []
  );
});
