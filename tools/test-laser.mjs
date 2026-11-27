import test from "node:test";
import assert from "node:assert/strict";
import { laserDistancePlan, laserWeapon } from "../module/rules/damage-types.mjs";
import { criticalPlan } from "../module/rules/criticals.mjs";
import { incomingDefensePlan } from "../module/rules/defense.mjs";

test("a laser is known by its damage entry or a marked damage type", () => {
  assert.equal(laserWeapon({ damage: "3d6 laser" }), true);
  assert.equal(laserWeapon({ damageType: "laser", damage: "2d8" }), true);
  assert.equal(laserWeapon({ damage: "2d6" }), false);
});

test("laser damage drops one die per range increment past the first", () => {
  assert.equal(laserDistancePlan("3d6", { distanceFeet: 20, increment: 50 }).expression, "3d6");
  const third = laserDistancePlan("3d6+2", { distanceFeet: 140, increment: 50 });
  assert.equal(third.expression, "1d6+2");
  assert.equal(third.removed, 2);
  assert.equal(laserDistancePlan("2d6", { distanceFeet: 500, increment: 50 }).expression, "0");
  const unknown = laserDistancePlan("3d6", { distanceFeet: "", increment: 50 });
  assert.equal(unknown.expression, "3d6");
  assert.match(unknown.note, /enter the target distance/);
});

test("a laser threat costs one die less to activate", () => {
  const check = { checkKind: "attack", threatConfirmed: true, successConfirmed: true, weaponProficiency: "rifle" },
    options = { baseCost: 2, effect: "Extra damage", effectConfirmed: true, beforeDamage: true, available: 4 };
  const plain = criticalPlan({}, check, options).cost;
  const laser = criticalPlan({}, { ...check, attackContext: { laser: true } }, options);
  assert.equal(laser.cost, plain - 1);
  assert.ok(laser.sources.some(line => line.startsWith("Laser")));
});

test("laser attacks ignore dodge bonuses to Defense", () => {
  const defender = {
    abilities: { dex: { mod: 2 } },
    defense: { total: 17, dodgeBonuses: 3, dexterity: 2 },
    classLevels: {},
    activeFeatNames: []
  };
  const plain = incomingDefensePlan(defender, { ranged: true }).total;
  assert.equal(incomingDefensePlan(defender, { ranged: true, laser: true }).total, plain - 3);
});
