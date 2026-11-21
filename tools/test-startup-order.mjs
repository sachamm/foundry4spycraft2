import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("first-load importers run after the world migration, in one ordered ready handler", () => {
  const entry = read("spycraft2.mjs");
  for (const setup of ["setupSampleScenes", "setupActorFolders", "setupGCTables", "setupSoundtrack"]) {
    assert.doesNotMatch(entry, new RegExp(`Hooks\\.once\\("ready", ${setup}\\)`), `${setup} has its own ready hook`);
  }
  const migrate = entry.indexOf("await runWorldMigrations()"),
    setups = entry.indexOf("[setupSampleScenes, setupActorFolders, setupGCTables, setupSoundtrack]"),
    ready = entry.indexOf('Hooks.callAll("spycraft2.ready")');
  assert.ok(migrate > 0 && migrate < setups && setups < ready, "migrate, then import, then announce");
});

test("the reconcilers wait for the migration and catch up once afterwards", () => {
  for (const path of ["module/apps/shaken-initiative.mjs", "module/apps/power-stance.mjs"]) {
    const source = read(path);
    assert.match(source, /if \(worldMigrating\(\)\) return;/, path);
    assert.match(source, /Hooks\.once\("spycraft2\.ready"/, path);
    assert.doesNotMatch(source, /Hooks\.once\("ready"/, path);
  }
});
