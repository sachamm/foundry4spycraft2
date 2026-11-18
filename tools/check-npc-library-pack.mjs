import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { ClassicLevel } from "classic-level";
import { buildPacks } from "./lib/pack-docs.mjs";

for (const [name, count] of [
  ["core-npcs", 20],
  ["sample-npcs", 12]
])
  test(`the built ${name} actor pack resolves all folders and embedded equipment`, async () => {
    const base = process.env.SPYCRAFT_PACKS_DIR ?? fileURLToPath(new URL("../packs", import.meta.url));
    const db = new ClassicLevel(`${base}/${name}`, { valueEncoding: "json", createIfMissing: false });
    await db.open();
    try {
      const rows = new Map();
      for await (const [key, value] of db.iterator()) rows.set(key, value);
      const actors = [...rows].filter(([key]) => key.startsWith("!actors!")).map(([, value]) => value);
      assert.equal(actors.length, count);
      for (const actor of actors) {
        assert.ok(rows.has(`!folders!${actor.folder}`), actor.name);
        for (const id of actor.items) assert.ok(rows.has(`!actors.items!${actor._id}.${id}`), `${actor.name}: ${id}`);
      }
    } finally {
      await db.close();
    }
  });

test("the rebuilt soundtrack document uses sequential playback", async () => {
  const base = process.env.SPYCRAFT_PACKS_DIR ?? fileURLToPath(new URL("../packs", import.meta.url));
  const db = new ClassicLevel(`${base}/soundtrack`, { valueEncoding: "json", createIfMissing: false });
  await db.open();
  try {
    const id = buildPacks().packs.soundtrack.docs[0]._id;
    const album = await db.get(`!playlists!${id}`);
    assert.equal(album.mode, 0);
    assert.equal(album.sorting, "m");
  } finally {
    await db.close();
  }
});
