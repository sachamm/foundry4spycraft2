import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { armorTotals } from "../module/rules/gear.mjs";
import { contagionSavePlan } from "../module/rules/hazards.mjs";

const equipment = JSON.parse(readFileSync(new URL("../src/data/equipment.json", import.meta.url), "utf8"));
const reference = JSON.parse(readFileSync(new URL("./fixtures/raw/armor-source-values.json", import.meta.url), "utf8"));
const fingerprint = value =>
  createHash("sha256")
    .update(
      String(value)
        .toLowerCase()
        .replace(/[–−]/g, "-")
        .replace(/’/g, "'")
        .replace(/[\s*†,]+/g, "")
    )
    .digest("hex")
    .slice(0, reference.width);

test("all 44 armor profiles retain thirteen independently verified fields from Tables 4.13–4.14", () => {
  assert.equal(equipment.armor.length, 44);
  assert.deepEqual(equipment.armor.map(row => row.name).sort(), Object.keys(reference.armor).sort());
  for (const armor of equipment.armor) {
    const [page, expected] = reference.armor[armor.name];
    assert.equal(armor.sourcePage, page, armor.name);
    assert.deepEqual(
      reference.fields.filter(
        (key, index) =>
          fingerprint(armor[key]) !== expected.slice(index * reference.width, (index + 1) * reference.width)
      ),
      [],
      `${armor.name}: recheck the source before changing its fields`
    );
  }
});

test("NBC gear and radiation suits grant only their applicable Primary Phase protection", () => {
  const primary = { phase: "primary", name: "Contagion", primary: { saveDC: 15 }, doses: 1 };
  const radiation = { ...primary, name: "Radiation poisoning" };
  for (const [index, bonus] of [1, 3, 6, 10].entries()) {
    const row = equipment.armor.find(row => row.name === `NBC gear, Level ${index + 1}`);
    const item = {
      id: "nbc",
      name: row.name,
      type: "armor",
      system: {
        equipped: true,
        carried: true,
        quantity: 1,
        armorSlot: row.armorSlot,
        armorType: row.armorType,
        contagionSaveBonus: row.contagionSaveBonus
      }
    };
    const armor = armorTotals([item]).armor;
    assert.equal(contagionSavePlan(primary, { armor }).suitBonus, bonus);
    assert.equal(contagionSavePlan(radiation, { armor }).suitBonus, bonus);
    assert.equal(
      contagionSavePlan({ ...primary, phase: "secondary", secondary: { saveDC: 18 } }, { armor }).suitBonus,
      0
    );
    assert.equal(armorTotals([{ ...item, system: { ...item.system, reserve: true } }]).armor, null);
  }
  for (const name of ["Radiation suit (sealed)", "Space suit (sealed)"]) {
    const row = equipment.armor.find(row => row.name === name);
    assert.equal(row.radiationSaveBonus, 10);
    assert.equal(contagionSavePlan(radiation, { armor: row, sealedSuit: true }).suitBonus, 10);
    assert.equal(contagionSavePlan(primary, { armor: row, sealedSuit: true }).suitBonus, 0);
  }
  assert.throws(() => contagionSavePlan(primary, { armor: { contagionSaveBonus: 1.5 } }), /Review the protective/);
});
