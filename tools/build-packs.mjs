#!/usr/bin/env node
/**
 * Build step for the Spycraft 2.0 system.
 *
 *   src/data/*.json  ──►  module/rules/*tables.mjs  (generated rules tables)
 *                    ──►  packs/<name>/             (LevelDB compendium packs)
 *
 * src/data/*.json is the source of truth and is edited by hand. Run with `npm run build`.
 * The documents themselves are assembled in tools/lib/pack-docs.mjs.
 *
 * Set SPYCRAFT_PACKS_DIR to write the packs somewhere else (for example while Foundry has the real ones open).
 * A pack that another process has open is left untouched and reported.
 */
import { writeFileSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ClassicLevel } from "classic-level";
import { ROOT, buildPacks } from "./lib/pack-docs.mjs";

const { packs, generated, system } = buildPacks();
for (const [path, source] of Object.entries(generated)) writeFileSync(join(ROOT, path), source);

/* ------------------------------------------------------------------ */
/*  Write LevelDB                                                      */
/* ------------------------------------------------------------------ */
const PACKS_DIR = process.env.SPYCRAFT_PACKS_DIR || join(ROOT, "packs");
const inUse = [];
/** True when another process (usually a running Foundry) holds this pack's database open. */
async function packInUse(dir) {
  if (!existsSync(join(dir, "LOCK"))) return false;
  const probe = new ClassicLevel(dir, { createIfMissing: false });
  try {
    await probe.open();
    await probe.close();
    return false;
  } catch (error) {
    return error?.cause?.code === "LEVEL_LOCKED";
  }
}
for (const [name, pack] of Object.entries(packs)) {
  const dir = join(PACKS_DIR, name);
  if (await packInUse(dir)) {
    inUse.push(name);
    continue;
  }
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const db = new ClassicLevel(dir, { valueEncoding: "json" });
  // classic-level 2+ only queues get/put/del until the database opens, not chained batches, so open it first.
  await db.open();
  const batch = db.batch();
  for (const f of pack.folders) batch.put(`!folders!${f._id}`, f);
  const collection = pack.collection ?? "items";
  for (const { embedded, ...d } of pack.docs) {
    batch.put(`!${collection}!${d._id}`, d);
    for (const [name, children] of Object.entries(embedded ?? {}))
      for (const child of children) batch.put(`!${collection}.${name}!${d._id}.${child._id}`, child);
  }
  await batch.write();
  await db.compactRange("\x00", "\xff");
  await db.close();
  console.log(`${dir}: ${pack.docs.length} items, ${pack.folders.length} folders`);
}
if (inUse.length) {
  console.warn(
    `\nNot rebuilt because another process has them open (close Foundry and run the build again): ${inUse.join(", ")}`
  );
  process.exitCode = 1;
}

// Keep system.json's pack list in sync.
system.packs = Object.entries(packs).map(([name, pack]) => ({
  name,
  label: pack.label,
  path: `packs/${name}`,
  type: pack.type ?? "Item",
  system: "spycraft2",
  ownership:
    name !== "sample-agents" && ["RollTable", "Actor", "Adventure"].includes(pack.type)
      ? { PLAYER: "NONE", ASSISTANT: "OWNER" }
      : { PLAYER: "OBSERVER", ASSISTANT: "OWNER" },
  flags: {}
}));
system.packFolders = [{ name: "Spycraft 2.0", sorting: "m", color: "#1d2b3a", packs: Object.keys(packs) }];
writeFileSync(join(ROOT, "system.json"), JSON.stringify(system, null, 2) + "\n");
console.log("module/rules/tables.mjs and system.json updated");
