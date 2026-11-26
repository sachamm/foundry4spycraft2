import test from "node:test";
import assert from "node:assert/strict";
import { incomingDefensePlan } from "../module/rules/defense.mjs";
import { drForAttack } from "../module/rules/damage-application.mjs";
import { subdualDefensePlan } from "../module/rules/subdual-defense.mjs";

const system = () => ({
  abilities: {
    str: { value: 12, mod: 1 },
    dex: { value: 14, mod: 2 },
    con: { value: 12, mod: 1 },
    int: { value: 12, mod: 1 },
    wis: { value: 12, mod: 1 },
    cha: { value: 12, mod: 1 }
  },
  defense: { total: 15, dexterity: 2, dodgeBonuses: 0 },
  weaponSpecialist: { proficiencies: ["rifle", "edged"], abilities: ["Foibles"] },
  armorDRByAttack: { unarmed: 2, meleeWeapon: 2, hurledWeapon: 2, rangedWeapon: 2, other: 2 },
  damageReductionComponents: { feat: 0, natural: 0, class: 0, armorMelee: 2, armorOther: 2 },
  survivalStats: { resistances: { subdual: 0 } }
});
test("Foibles uses the incoming weapon proficiency and its dodge is lost while vulnerable", () => {
  const s = system();
  assert.equal(incomingDefensePlan(s, { weaponProficiency: "rifle", ranged: true }).total, 16);
  assert.equal(incomingDefensePlan(s, { weaponProficiency: "handgun", ranged: true }).total, 15);
  assert.equal(incomingDefensePlan(s).total, 15);
  assert.equal(incomingDefensePlan(s, { weaponProficiency: "rifle", flatFooted: true }).total, 13);
  s.weaponSpecialist.abilities = [];
  assert.equal(incomingDefensePlan(s, { weaponProficiency: "rifle" }).total, 15);
});
test("Foibles DR remains against covered weapons while flat-footed, without changing the sheet's unconditional DR", () => {
  const s = system();
  s.conditionContext = { flatFooted: true };
  assert.equal(drForAttack(s, "rangedWeapon", "rifle"), 3);
  assert.equal(drForAttack(s, "meleeWeapon", "edged"), 3);
  assert.equal(drForAttack(s, "rangedWeapon", "handgun"), 2);
  assert.equal(drForAttack(s, "rangedWeapon"), 2);
  assert.equal(s.armorDRByAttack.rangedWeapon, 2);
});
test("Foibles joins subdual DR before armor piercing and doubling; AP(all) still bypasses it", () => {
  const s = system();
  const options = { rawDamage: 10, attackKind: "rangedWeapon", weaponProficiency: "rifle", armorPiercing: 1 };
  assert.equal(subdualDefensePlan(s, options).netDamage, 6);
  assert.equal(subdualDefensePlan(s, { ...options, weaponProficiency: "handgun" }).netDamage, 8);
  assert.equal(subdualDefensePlan(s, { ...options, armorPiercingAll: true }).netDamage, 10);
});

test("Foibles class DR does not stack on top of a stronger natural quality", () => {
  const s = system();
  s.damageReductionComponents.natural = 5;
  for (const key of Object.keys(s.armorDRByAttack)) s.armorDRByAttack[key] = 5;
  assert.equal(drForAttack(s, "rangedWeapon", "rifle"), 5);
  assert.equal(
    subdualDefensePlan(s, { rawDamage: 12, attackKind: "rangedWeapon", weaponProficiency: "rifle" }).netDamage,
    2
  );
});
