import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { same, stable } from "../module/rules/equal.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const sources = dir =>
  readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : path.endsWith(".mjs") ? [path] : [];
  });

test("stable ignores the order of object keys at every depth and keeps the order of arrays", () => {
  assert.equal(stable({ b: 1, a: { d: [2, 1], c: null } }), stable({ a: { c: null, d: [2, 1] }, b: 1 }));
  assert.equal(stable({ b: 1, a: 2 }), '{"a":2,"b":1}');
  assert.notEqual(stable([1, 2]), stable([2, 1]));
  assert.equal(stable(undefined), undefined);
  // The text is what a plain JSON.stringify gives once the keys are in order.
  for (const value of [null, 3, "x", [], {}, { a: [{ z: 1, y: 2 }] }])
    assert.equal(stable(value), JSON.stringify(JSON.parse(stable(value))));
});

test("same compares the JSON text as written", () => {
  assert.ok(same({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] }));
  assert.ok(!same({ a: 1, b: 2 }, { b: 2, a: 1 }));
  assert.ok(same(undefined, undefined));
});

test("modules share these helpers instead of declaring their own copies", () => {
  const copy =
    /const (?:stable|same) = (?:\(a, b\) => JSON\.stringify\(a\) === JSON\.stringify\(b\)|v =>\s*JSON\.stringify\(v, \(_k, x\) =>\s*x && typeof x === "object" && !Array\.isArray\(x\)\s*\? Object\.fromEntries\(\s*Object\.keys\(x\))/;
  const offenders = sources(join(ROOT, "module")).filter(
    file => !file.endsWith("rules/equal.mjs") && copy.test(readFileSync(file, "utf8"))
  );
  assert.deepEqual(offenders, []);
});
