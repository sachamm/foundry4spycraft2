import test from "node:test";
import assert from "node:assert/strict";
import { doubleJabFormula, doubleJabPlan, inClosedStance } from "../module/rules/boxing.mjs";
import { COMBAT_STANCES } from "../module/rules/combat-stance.mjs";
import { weaponDamage } from "../module/rules/gear.mjs";
import { rollPipeline } from "../module/rules/roll-pipeline.mjs";

const fists = { proficiency: "unarmed", damage: "1d4", qualities: "" };
const boxer = stance => ({
  activeFeatNames: ["Boxing Basics"],
  combatStance: stance ? { version: 1, id: "s", key: stance } : null,
  conditionContext: {},
  abilities: { str: { mod: 1 } }
});

test("Double Jab takes 2 from each damage die, never below 1", () => {
  assert.equal(doubleJabFormula("1d4"), "(1d4min3 - 2)");
  assert.equal(doubleJabFormula("2d6"), "(2d6min3 - 4)");
  assert.equal(doubleJabFormula("d8"), "(1d8min3 - 2)");
  // Every face of a d4: max(1, face − 2) equals max(3, face) − 2.
  for (const face of [1, 2, 3, 4]) assert.equal(Math.max(3, face) - 2, Math.max(1, face - 2));
  const plain = weaponDamage(boxer(), fists).formula,
    jab = weaponDamage(boxer(), { ...fists, doubleJab: true }).formula;
  assert.match(jab, /1d4min3 - 2/);
  assert.doesNotMatch(plain, /min3/);
  assert.doesNotMatch(weaponDamage(boxer(), { proficiency: "edged", damage: "1d6", doubleJab: true }).formula, /min3/);
});

test("Double Jab is an unarmed Standard Attack at −2 for a Boxing Basics owner", () => {
  assert.equal(doubleJabPlan(boxer(), fists, {}), null);
  assert.equal(doubleJabPlan(boxer(), fists, { doubleJab: true }).attackBonus, -2);
  assert.ok(doubleJabPlan({ activeFeatNames: [] }, fists, { doubleJab: true }).blocked);
  assert.ok(doubleJabPlan(boxer(), { proficiency: "edged" }, { doubleJab: true }).blocked);
  assert.ok(doubleJabPlan(boxer(), fists, { doubleJab: true, attackAction: "other" }).blocked, "not with a Kick");
  const html = rollPipeline.dialog({
    dialog: "attack",
    actor: { system: boxer() },
    item: { system: fists },
    options: {}
  });
  assert.match(html, /name="doubleJab"/);
});

test("Closed Stance adds +2 unarmed damage only against an opponent sharing the square", () => {
  assert.deepEqual(COMBAT_STANCES.closed, { name: "Closed Stance", feat: "Boxing Basics", page: 184 });
  assert.ok(inClosedStance(boxer("closed")));
  assert.equal(inClosedStance(boxer("shifting")), false);
  const base = weaponDamage(boxer("closed"), fists).bonus;
  assert.equal(weaponDamage(boxer("closed"), { ...fists, closedStanceTarget: true }).bonus - base, 2);
  assert.equal(
    weaponDamage(boxer(), { ...fists, closedStanceTarget: true }).bonus,
    weaponDamage(boxer(), fists).bonus,
    "out of the stance"
  );
  const html = rollPipeline.dialog({
    dialog: "damage",
    actor: { system: boxer("closed"), limitedUseStatus: [] },
    item: { system: fists },
    attackBonusHits: [],
    automaticAttackBonus: null,
    sideHits: [],
    targetChoices: { actors: [], selected: "" },
    trickSneakHit: null
  });
  assert.match(html, /name="closedStanceTarget"/);
});
