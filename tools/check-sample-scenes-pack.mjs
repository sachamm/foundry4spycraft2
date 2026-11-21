import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { ClassicLevel } from "classic-level";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
test("sample pack resolves embedded documents and portable assets without world dependencies", async () => {
  const manifest = JSON.parse(readFileSync(new URL("system.json", root)));
  assert.equal(manifest.packs.find(p => p.name === "sample-scenes")?.type, "Scene");
  const db = new ClassicLevel(
    process.env.SPYCRAFT_PACKS_DIR
      ? `${process.env.SPYCRAFT_PACKS_DIR}/sample-scenes`
      : fileURLToPath(new URL("packs/sample-scenes", root)),
    { valueEncoding: "json", createIfMissing: false }
  );
  await db.open();
  try {
    const rows = new Map();
    for await (const row of db.iterator()) rows.set(...row);
    const scenes = [...rows].filter(([k]) => k.startsWith("!scenes!")).map(([, s]) => s);
    assert.equal(scenes.length, 3);
    let total = 0;
    for (const s of scenes) {
      assert.deepEqual(s.tokens, []);
      assert.ok(!s.journal && !s.folder);
      assert.deepEqual(s.ownership, { default: 0 });
      for (const key of ["levels", "walls", "lights"]) {
        assert.ok(s[key].length > 0);
        for (const id of s[key]) assert.ok(rows.has(`!scenes.${key}!${s._id}.${id}`), `${s.name}: ${key}.${id}`);
      }
      const level = rows.get(`!scenes.levels!${s._id}.${s.initialLevel}`);
      const path = level.background.src.replace(/^systems\/spycraft2\//, "");
      assert.match(path, /^assets\/scenes\/[a-z-]+\.webp$/);
      const asset = new URL(path, root);
      const bytes = readFileSync(asset);
      assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
      total += statSync(asset).size;
      const walls = s.walls.map(id => rows.get(`!scenes.walls!${s._id}.${id}`));
      assert.ok(walls.some(w => w.door === 1));
      for (const w of walls) {
        assert.ok(w.c.every((v, i) => Number.isInteger(v) && v >= 0 && v <= (i % 2 ? s.height : s.width)));
        assert.deepEqual(w.levels, [s.initialLevel]);
      }
    }
    assert.ok(total < 1_000_000, `background budget exceeded: ${total}`);
  } finally {
    await db.close();
  }
});
