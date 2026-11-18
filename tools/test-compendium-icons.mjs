import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { buildPacks } from "./lib/pack-docs.mjs";
import { applyCompendiumIcons, iconPath } from "./lib/compendium-icons.mjs";

const data = JSON.parse(readFileSync(new URL("../src/data/compendium-icons.json", import.meta.url)));
const built = buildPacks();
const { packs } = built;

test("every catalog item and GC table has an explicit, defined compressed icon", () => {
  let items = 0,
    tables = 0;
  for (const [packId, pack] of Object.entries(packs)) {
    if (!["Item", "RollTable"].includes(pack.type ?? "Item")) continue;
    assert.equal(data.packs[packId].length, pack.docs.length);
    for (const doc of pack.docs) {
      const assignment = data.packs[packId].find(row => row.id === doc._id);
      assert.equal(assignment.name, doc.name);
      assert.equal(doc.img, iconPath(data, assignment.icon));
      assert.equal(doc.flags.spycraft2.compendiumIcon, assignment.icon);
      assert.match(doc.img, /^systems\/spycraft2\/assets\/icons\/[a-z0-9-]+\.webp$/);
      if ((pack.type ?? "Item") === "Item") items++;
      else tables++;
      for (const result of doc.embedded?.results ?? []) assert.equal(result.img, doc.img);
    }
  }
  assert.equal(items, 1921);
  assert.equal(tables, 36);
});

test("related models share icons while distinct item families remain distinguishable", () => {
  const image = (pack, name) => packs[pack].docs.find(doc => doc.name === name).img;
  assert.equal(image("kits", "First Aid Kit I"), image("kits", "First Aid Kit III"));
  assert.equal(image("gear", "Computer, laptop (Caliber I)"), image("gear", "Computer, laptop (Caliber V)"));
  assert.notEqual(image("gear", "Computer, laptop (Caliber I)"), image("gear", "Computer, desktop (Caliber I)"));
  assert.equal(image("feats", "Armor Basics"), image("feats", "Armor Supremacy"));
  assert.notEqual(image("feats", "Armor Basics"), image("feats", "Knife Basics"));
});

test("NPC inventories and every optional package inherit icons without replacing portraits or tokens", () => {
  const templates = JSON.parse(readFileSync(new URL("../src/data/npc-templates.json", import.meta.url)));
  for (const actor of packs["core-npcs"].docs) {
    const template = templates.templates.find(t => t.id === actor.flags.spycraft2.npcTemplate);
    assert.equal(actor.img, template.portrait);
    assert.equal(actor.prototypeToken.texture.src, template.token);
    for (const item of actor.embedded.items) assert.match(item.img, /\/assets\/icons\/[a-z0-9-]+\.webp$/);
  }
  const packageData = JSON.parse(built.generated["module/data/npc-packages.json"]);
  for (const role of Object.values(packageData.roles))
    for (const variant of role.packages)
      for (const item of variant.items) assert.match(item.img, /\/assets\/icons\/[a-z0-9-]+\.webp$/);
});

test("icon updates leave mechanics and non-icon documents intact", () => {
  const row = data.packs.classes[0];
  const doc = {
    _id: row.id,
    name: row.name,
    img: "old.svg",
    system: { level: 3, choices: [1, 2] },
    flags: { custom: { note: "keep" } }
  };
  const fixtures = {
    classes: { docs: [doc] },
    scenes: { type: "Scene", docs: [{ background: { src: "map.webp" } }] },
    actors: { type: "Actor", docs: [{ img: "portrait.png" }] },
    playlist: { type: "Playlist", docs: [{ mode: 0 }] }
  };
  const original = structuredClone(fixtures);
  applyCompendiumIcons(fixtures, { ...data, packs: { classes: [row] } });
  assert.deepEqual(fixtures.classes.docs[0].system, original.classes.docs[0].system);
  assert.deepEqual(fixtures.classes.docs[0].flags.custom, original.classes.docs[0].flags.custom);
  for (const key of ["scenes", "actors", "playlist"]) assert.deepEqual(fixtures[key], original[key]);
});

test("missing, stale, duplicate or unknown icon assignments stop publication", () => {
  const row = data.packs.classes[0];
  const make = () => ({ classes: { docs: [{ _id: row.id, name: row.name }] } });
  const change = (mutate, pattern) => {
    const bad = { ...structuredClone(data), packs: { classes: [structuredClone(row)] } };
    mutate(bad);
    assert.throws(() => applyCompendiumIcons(make(), bad), pattern);
  };
  change(d => {
    delete d.packs.classes;
  }, /Missing icon assignments/);
  change(d => {
    d.packs.classes[0].name = "Renamed";
  }, /stale icon assignment/);
  change(d => {
    d.packs.classes.push(row);
  }, /Duplicate icon assignments/);
  change(d => {
    d.packs.classes[0].icon = "unknown";
  }, /Unknown compendium icon/);
  change(d => {
    d.icons.push(d.icons[0]);
  }, /Duplicate compendium icon IDs/);
  change(d => {
    d.packs.missing = [];
  }, /Unknown icon assignment pack/);
});

test("every generated icon is a small 128px WebP with recorded provenance", () => {
  const provenance = JSON.parse(readFileSync(new URL("../assets/icons/generation-prompts.json", import.meta.url)));
  assert.equal(provenance.icons.length, data.icons.length);
  for (const spec of data.icons) {
    const bytes = readFileSync(new URL(`../assets/icons/${spec.id}.webp`, import.meta.url));
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
    assert.equal(bytes.toString("ascii", 12, 16), "VP8 ");
    assert.equal(bytes.readUInt16LE(26) & 0x3fff, 128);
    assert.equal(bytes.readUInt16LE(28) & 0x3fff, 128);
    assert.ok(bytes.length < 16384, spec.id);
    const record = provenance.icons.find(row => row.id === spec.id);
    assert.equal(record.bytes, bytes.length);
    assert.equal(record.sha256, createHash("sha256").update(bytes).digest("hex"));
    assert.ok(record.prompt.includes(spec.subject) || spec.id === "service-pistol");
  }
});
