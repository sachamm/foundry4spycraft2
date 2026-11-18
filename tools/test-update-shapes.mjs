import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// A document update with `recursive: false` replaces every top-level object it names. For a dotted key such as
// "system.hazards" that means the whole of `system`, which resets the character to defaults. Replace one field
// with the "==" key instead ("system.==hazards"). Local `updateSource` copies of whole documents are not affected.
function sources(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return path.endsWith(".mjs") ? [path] : [];
  });
}

test("no document update() call is non-recursive", () => {
  const offenders = [];
  for (const file of [...sources("module"), "spycraft2.mjs"]) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        if (/\.update\(/.test(line) && /recursive:\s*false/.test(line)) offenders.push(`${file}:${index + 1}`);
      });
  }
  assert.deepEqual(offenders, []);
});
