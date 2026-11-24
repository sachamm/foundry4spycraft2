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

test("the OGL copy carries the rulebook's section 15 and this project's notice", () => {
  const ogl = readFileSync(new URL("../LICENSES/OGL-1.0a.txt", import.meta.url), "utf8");
  for (const entry of [
    "OPEN GAME LICENSE Version 1.0a",
    "Open Game License v1.0a Copyright 2000, Wizards of the Coast, Inc.",
    "Spycraft Soldier/Wheelman Class Guide Copyright 2003",
    "Spycraft Copyright 2005, Alderac Entertainment Group.",
    "The Field Agent's Handbook Copyright 2026"
  ])
    assert.ok(ogl.includes(entry), `LICENSES/OGL-1.0a.txt omits "${entry}"`);
});
