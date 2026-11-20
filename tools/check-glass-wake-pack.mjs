import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ClassicLevel } from "classic-level";
import { buildPacks } from "./lib/pack-docs.mjs";

test("the release manifest and built Adventure pack contain all Glass Wake content inline", async () => {
  const manifest = JSON.parse(readFileSync(new URL("../system.json", import.meta.url)));
  const pack = manifest.packs.find(p => p.name === "glass-wake");
  assert.equal(pack.type, "Adventure");
  assert.equal(pack.system, "spycraft2");
  assert.equal(pack.ownership.PLAYER, "NONE");
  assert.ok(manifest.packFolders.some(f => f.packs.includes("glass-wake")));
  const db = new ClassicLevel(
    process.env.SPYCRAFT_PACKS_DIR
      ? `${process.env.SPYCRAFT_PACKS_DIR}/glass-wake`
      : fileURLToPath(new URL("../packs/glass-wake", import.meta.url)),
    { valueEncoding: "json", createIfMissing: false }
  );
  await db.open();
  try {
    const rows = [...(await db.iterator().all())];
    assert.equal(rows.length, 1);
    assert.equal(rows[0][0], "!adventures!76167ee4038d3ebd");
    assert.deepEqual(rows[0][1], buildPacks().packs["glass-wake"].docs[0]);
  } finally {
    await db.close();
  }
  for (const workflow of [
    "release.yml",
    "release-candidate.yml",
    "retro-test.yml",
    "test-release.yml",
    "publish-stable-0.3.1.yml"
  ])
    assert.match(
      readFileSync(new URL(`../.github/workflows/${workflow}`, import.meta.url), "utf8"),
      /zip -r[^\n]*\bpacks\b[^\n]*\bassets\b/,
      workflow
    );
});
