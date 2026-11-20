import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const workflows = fileURLToPath(new URL("../.github/workflows/", import.meta.url));

test("every release archive includes the licensing scope and license texts", () => {
  let archives = 0;
  for (const file of readdirSync(workflows)) {
    if (!file.endsWith(".yml")) continue;
    const source = readFileSync(new URL(`../.github/workflows/${file}`, import.meta.url), "utf8");
    for (const line of source.split(/\r?\n/).filter(value => /\bzip -r\b/.test(value))) {
      archives += 1;
      const argumentsList = line.trim().split(/\s+/);
      assert.ok(argumentsList.includes("LICENSING.md"), `${file} omits LICENSING.md`);
      assert.ok(argumentsList.includes("LICENSES"), `${file} omits LICENSES`);
    }
  }
  assert.ok(archives > 0, "no release archive commands were checked");
});
