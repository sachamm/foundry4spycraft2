import test from "node:test";
import assert from "node:assert/strict";
import { weaponDamage, whateversHandyBonus, deadToRightsDice } from "../module/rules/gear.mjs";

const system = classLevels => ({ classLevels, bab: 0, abilities: { str: { mod: 0 }, dex: { mod: 0 } } });

test("Dead to Rights adds 1d4 to tactical weapon damage from Grunt 2nd and 2d4 from 7th", () => {
  const tactical = { proficiency: "tactical", damage: "2d10" },
    rifle = { proficiency: "rifle", damage: "2d10" };
  assert.equal(deadToRightsDice(system({ grunt: 1 }), tactical), 0);
  assert.equal(deadToRightsDice(system({ grunt: 2 }), tactical), 1);
  assert.equal(deadToRightsDice(system({ grunt: 7 }), tactical), 2);
  assert.equal(deadToRightsDice(system({ grunt: 9 }), rifle), 0);
  assert.equal(weaponDamage(system({ grunt: 1 }), tactical).formula, "max(1, 2d10 + (0))");
  assert.equal(weaponDamage(system({ grunt: 2 }), tactical).formula, "max(1, 2d10 + 1d4 + (0))");
  assert.equal(weaponDamage(system({ grunt: 7 }), tactical).formula, "max(1, 2d10 + 2d4 + (0))");
  assert.equal(weaponDamage(system({ grunt: 7 }), rifle).formula, "max(1, 2d10 + (0))");
});

test("Whatever's Handy rises from +1 to +2 at Brawler 5th and +3 at 9th", () => {
  assert.deepEqual(
    [0, 1, 4, 5, 8, 9, 10].map(level => whateversHandyBonus(system({ brawler: level }))),
    [0, 1, 1, 2, 2, 3, 3]
  );
  const improvised = { proficiency: "blunt", damage: "1d6", improvised: true };
  const without = weaponDamage(system({}), improvised).bonus;
  assert.equal(weaponDamage(system({ brawler: 1 }), improvised).bonus - without, 1);
  assert.equal(weaponDamage(system({ brawler: 5 }), improvised).bonus - without, 2);
  assert.equal(weaponDamage(system({ brawler: 9 }), improvised).bonus - without, 3);
});
