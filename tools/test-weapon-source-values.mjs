import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { damageProfile } from "../module/rules/damage-application.mjs";
import { ammunitionConfiguration } from "../module/rules/ammunition.mjs";

const equipment = JSON.parse(readFileSync(new URL("../src/data/equipment.json", import.meta.url), "utf8"));
const reference = JSON.parse(
  readFileSync(new URL("./fixtures/raw/weapon-source-values.json", import.meta.url), "utf8")
);
const normalized = (key, value) => {
  if (["recoil", "range", "weight"].includes(key)) return String(Number(value));
  const text = String(value)
    .toLowerCase()
    .replace(/[–−]/g, "-")
    .replace(/’/g, "'")
    .replace(/↳/g, "")
    .replace(/[\s*†∆ΩΩω]+/g, "");
  return key === "qualities" ? text.replace(/,/g, "") : text;
};
const fingerprint = (key, value) =>
  createHash("sha256").update(normalized(key, value)).digest("hex").slice(0, reference.width);

// These hashes came from independently checked source rows. Recheck the printed entry before changing them.
test("all 455 main-table weapon picks retain nine independently verified combat and Caliber fields", () => {
  const weapons = equipment.weapons.filter(row => row.sourcePage >= 250 && row.sourcePage <= 271);
  assert.equal(weapons.length, 455);
  assert.deepEqual(weapons.map(row => row.name).sort(), Object.keys(reference.weapons).sort());
  for (const weapon of weapons) {
    const [page, expected] = reference.weapons[weapon.name];
    assert.equal(weapon.sourcePage, page, weapon.name);
    const changed = reference.fields.filter(
      (key, index) =>
        fingerprint(key, weapon[key]) !== expected.slice(index * reference.width, (index + 1) * reference.width)
    );
    assert.deepEqual(changed, [], `${weapon.name}, p.${page}: verify changed source fields`);
  }
});

test("the source's raw-explosive footnote becomes an executable damage type", () => {
  const names = [
    "ANFO, 50 lbs.",
    "Black powder, 1 lb.",
    "Dynamite, 1 stick",
    "Dynamite (expired), 1 stick",
    "Nitroglycerine, 1/4 lb.",
    "Plastic explosive, 1/4 lb.",
    "Plastic explosive, 1-ft. strip",
    "TNT, 1/4 lb."
  ];
  for (const name of names) {
    const weapon = equipment.weapons.find(row => row.name === name);
    assert.equal(weapon.sourcePage, 269);
    const profile = damageProfile(weapon.damage, weapon.qualities);
    assert.deepEqual([profile.kind, profile.type, profile.blast], ["lethal", "explosive", true], name);
  }
  const thermite = equipment.weapons.find(row => row.name === "Thermite, 1 lb.");
  assert.equal(damageProfile(thermite.damage, thermite.qualities).type, "fire");
});

test("both Daewoo loads offer the printed magazine/drum choice with forty supplied shots", () => {
  const weapons = equipment.weapons.filter(row => row.name.startsWith("Daewoo USAS-12 "));
  assert.equal(weapons.length, 2);
  for (const weapon of weapons) {
    const config = ammunitionConfiguration(weapon);
    assert.equal(config.requiresChoice, true);
    assert.deepEqual(
      config.options.map(row => [row.code, row.capacity, row.loads, row.shots]),
      [
        ["10M4", 10, 4, 40],
        ["20D2", 20, 2, 40]
      ]
    );
    assert.equal(ammunitionConfiguration({ ...weapon, ammoCodeChoice: "20D2" }).selected.capacity, 20);
  }
});
