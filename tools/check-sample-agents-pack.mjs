import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { access, readFile } from "node:fs/promises";
import { ClassicLevel } from "classic-level";
import { SAMPLE_COMPANIONS } from "../module/data/sample-agent-companions.mjs";

test("the installed sample pack resolves all 16 agents, class folders, items and artwork", async () => {
  const base = process.env.SPYCRAFT_PACKS_DIR ?? fileURLToPath(new URL("../packs", import.meta.url));
  const db = new ClassicLevel(`${base}/sample-agents`, { valueEncoding: "json", createIfMissing: false });
  await db.open();
  try {
    const rows = new Map();
    for await (const [key, value] of db.iterator()) rows.set(key, value);
    const actors = [...rows].filter(([key]) => key.startsWith("!actors!")).map(([, value]) => value);
    assert.equal(actors.length, 16);
    assert.equal([...rows.keys()].filter(key => key.startsWith("!folders!")).length, 12);
    for (const actor of actors) {
      assert.equal(actor.type, "agent");
      assert.ok(rows.has(`!folders!${actor.folder}`), actor.name);
      assert.ok(actor.items.length > 10, actor.name);
      for (const id of actor.items) assert.ok(rows.has(`!actors.items!${actor._id}.${id}`), `${actor.name}: ${id}`);
      for (const path of [actor.img, actor.prototypeToken.texture.src]) {
        assert.match(path, /^systems\/spycraft2\/assets\/agents\//);
        await access(new URL(`../${path.replace("systems/spycraft2/", "")}`, import.meta.url));
      }
    }
    const manifest = JSON.parse(await readFile(new URL("../system.json", import.meta.url), "utf8"));
    assert.equal(manifest.packs.find(pack => pack.name === "sample-agents").ownership.PLAYER, "OBSERVER");
    assert.equal(SAMPLE_COMPANIONS.length, 1);
    const pet = SAMPLE_COMPANIONS[0];
    assert.ok(pet.items.length > 0);
    assert.ok(actors.some(actor => actor.flags.spycraft2.sampleAgent === pet.flags.spycraft2.sampleOwner));
  } finally {
    await db.close();
  }
});
