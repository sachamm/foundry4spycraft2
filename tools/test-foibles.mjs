import test from "node:test";
import assert from "node:assert/strict";
import { specialistDefense } from "../module/rules/weapon-specialist.mjs";
import { drForAttack } from "../module/rules/damage-application.mjs";

const soldier = {
  weaponSpecialist: { proficiencies: ["handgun"], abilities: ["Foibles"] },
  dr: { melee: 0, other: 2 }
};

test("Foibles: +1 dodge and DR 1/— against the chosen proficiency only (p.50)", () => {
  assert.deepEqual(specialistDefense(soldier, "handgun"), { dodge: 1, damageReduction: 1 });
  assert.deepEqual(specialistDefense(soldier, "rifle"), { dodge: 0, damageReduction: 0 });
  assert.deepEqual(specialistDefense(soldier, ""), { dodge: 0, damageReduction: 0 });
  assert.deepEqual(specialistDefense({ ...soldier, vulnerable: true }, "handgun"), { dodge: 0, damageReduction: 1 });
});

test("the extra DR joins the attack's DR column", () => {
  assert.equal(drForAttack(soldier, "rangedWeapon", { proficiency: "handgun" }), 3);
  assert.equal(drForAttack(soldier, "rangedWeapon", { proficiency: "rifle" }), 2);
  assert.equal(
    drForAttack({ ...soldier, armorDRByAttack: { rangedWeapon: 4 } }, "rangedWeapon", { proficiency: "handgun" }),
    5
  );
  assert.equal(drForAttack({}, "other"), 0);
});
