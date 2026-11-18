import test from "node:test";
import assert from "node:assert/strict";
import { kickPlan, kickCountCost, kickDamageBonus, unarmedWeapon, shiftingStanceNote } from "../module/rules/kick.mjs";
import { circlingDefensePlan } from "../module/rules/knife-basics.mjs";
import { COMBAT_STANCES } from "../module/rules/combat-stance.mjs";
import { weaponDamage } from "../module/rules/gear.mjs";
import { rollPipeline } from "../module/rules/roll-pipeline.mjs";

const fists = { proficiency: "unarmed", damage: "1d4", qualities: "" };

test("a Kick is an unarmed attack that costs 2 Initiative Count, or none with Kicking Basics", () => {
  assert.ok(unarmedWeapon(fists));
  assert.ok(unarmedWeapon({ proficiency: "blunt", qualities: "NKL" }), "knuckles count");
  assert.equal(unarmedWeapon({ proficiency: "edged" }), false);
  assert.equal(kickPlan({}, fists), null);
  assert.equal(kickPlan({ activeFeatNames: [] }, fists, { kick: true }).countCost, 2);
  assert.equal(kickPlan({ activeFeatNames: ["Kicking Basics"] }, fists, { kick: true }).countCost, 0);
  assert.equal(kickCountCost({ activeFeatNames: ["Kicking Basics"] }), 0);
  assert.ok(kickPlan({}, { proficiency: "edged" }, { kick: true }).blocked);
  const read = rollPipeline.read({ dialog: "attack", actor: {}, item: { system: fists }, entered: { kick: true } }, {});
  assert.equal(read.kick, true);
  assert.equal(read.attackAction, "other", "a Kick is not a Standard Attack");
});

test("Kick damage adds a positive Strength modifier once more", () => {
  const strong = { abilities: { str: { mod: 3 } } },
    weak = { abilities: { str: { mod: -1 } } };
  assert.equal(kickDamageBonus(strong), 3);
  assert.equal(kickDamageBonus(weak), 0);
  const plain = weaponDamage(strong, fists),
    kicked = weaponDamage(strong, { ...fists, kick: true });
  assert.equal(kicked.bonus - plain.bonus, 3);
  assert.equal(
    weaponDamage(strong, { proficiency: "edged", damage: "1d6", kick: true }).bonus,
    weaponDamage(strong, { proficiency: "edged", damage: "1d6" }).bonus
  );
});

test("Shifting Stance halves the target's dodge bonus, rounded up, against a confirmed unarmed attack", () => {
  assert.deepEqual(COMBAT_STANCES.shifting, { name: "Shifting Stance", feat: "Kicking Basics", page: 186 });
  const attacker = {
    activeFeatNames: ["Kicking Basics"],
    combatStance: { version: 1, id: "s", key: "shifting" },
    conditionContext: {}
  };
  const halved = circlingDefensePlan({ attackerSystem: attacker, unarmedConfirmed: true, dodgeBonus: 5 });
  assert.equal(halved.retainedDodgeBonus, 3);
  assert.equal(halved.dodgeReduction, 2);
  assert.equal(halved.shifting, true);
  assert.equal(circlingDefensePlan({ attackerSystem: attacker, dodgeBonus: 5 }).dodgeReduction, 0, "unconfirmed");
  assert.throws(() =>
    circlingDefensePlan({ attackerSystem: attacker, ranged: true, unarmedConfirmed: true, dodgeBonus: 5 })
  );
  assert.match(shiftingStanceNote(attacker, fists, false), /opposite side/);
  assert.equal(shiftingStanceNote(attacker, { proficiency: "edged" }, false), "");
  const circling = {
    activeFeatNames: ["Knife Basics"],
    combatStance: { version: 1, id: "c", key: "circling" },
    conditionContext: {}
  };
  assert.equal(
    circlingDefensePlan({ attackerSystem: circling, unoccupiedAdjacentConfirmed: true, dodgeBonus: 5 })
      .retainedDodgeBonus,
    3,
    "Circling is unchanged"
  );
});
