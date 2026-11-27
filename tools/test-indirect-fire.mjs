import test from "node:test";
import assert from "node:assert/strict";
import "../module/rolls/index.mjs";
import {
  HANG_TIME,
  OBSERVER_DC,
  hangTimeApplies,
  hangTimeRounds,
  indirectFirePlan
} from "../module/rules/indirect-fire.mjs";
import { planTerms } from "../module/rules/roll-pipeline.mjs";

const attacker = { abilities: { wis: { mod: 2 } }, activeFeatNames: [], classLevels: {} };
const context = { stance: {}, firing: {}, grip: {}, ranged: true, trained: true, ability: "int" };

test("Table 4.79 sets the hang time by range increments", () => {
  assert.equal(HANG_TIME.length, 4);
  assert.equal(hangTimeRounds(100, 100), 0);
  assert.equal(hangTimeRounds(250, 100), 1);
  assert.equal(hangTimeRounds(300, 100), 1);
  assert.equal(hangTimeRounds(301, 100), 2);
  assert.equal(hangTimeRounds(1000, 100), 3);
  assert.equal(hangTimeRounds("", 100), null);
  assert.equal(hangTimeRounds(100, 0), null);
});

test("launchers, mortars, bombs and indirect fire wait out hang time; cruise missiles do not", () => {
  assert.equal(hangTimeApplies({ weaponCategory: "mortar" }), true);
  assert.equal(hangTimeApplies({ name: "Rocket launcher (HE)" }), true);
  assert.equal(hangTimeApplies({ name: "Cruise missile" }), false);
  assert.equal(hangTimeApplies({ name: "Service pistol", proficiency: "handgun" }), false);
  assert.equal(hangTimeApplies({ name: "Service pistol" }, { indirectFire: true }), true);
});

test("a forward observer's result caps the attack and must reach DC 15", () => {
  assert.equal(OBSERVER_DC, 15);
  assert.equal(indirectFirePlan(attacker, { observerResult: 14 }).blocked, true);
  const plan = indirectFirePlan(attacker, { observerResult: 22 });
  assert.equal(plan.blocked, false);
  assert.equal(plan.cap, 22);
  assert.equal(indirectFirePlan(attacker, {}).cap, null);
  assert.equal(indirectFirePlan(attacker, { observerResult: "x" }).blocked, true);
});

test("adjust fire adds +1 morale per relay up to the Wisdom bonus", () => {
  assert.equal(indirectFirePlan(attacker, { adjustments: 1 }).bonus, 1);
  assert.equal(indirectFirePlan(attacker, { adjustments: 5 }).bonus, 2);
  assert.equal(indirectFirePlan({ abilities: { wis: { mod: -1 } } }, { adjustments: 3 }).bonus, 0);
});

test("the attack term carries the cap, the bonus and a hang time note", () => {
  const terms = planTerms("attack", {
    system: attacker,
    weapon: { name: "Mortar", proficiency: "indirectFire", weaponCategory: "mortar" },
    options: { observerResult: 20, adjustFire: 1, distanceFeet: 450 },
    rangeIncrement: 100,
    ...context
  });
  assert.deepEqual(terms.all("cap"), [20]);
  assert.ok(terms.merge("rows").some(([label, value]) => label === "Adjust fire" && value === 1));
  assert.ok(terms.merge("notes").some(note => note.startsWith("Hang time: 2 round(s).")));
  const failed = planTerms("attack", {
    system: attacker,
    weapon: { name: "Mortar", proficiency: "indirectFire" },
    options: { observerResult: 9 },
    rangeIncrement: 100,
    ...context
  });
  assert.ok(failed.merge("blocked").length);
});

test("a forward observer's relay is a hard ceiling, even on a threat or with action dice (p.300)", async () => {
  const { resolveSkillResult } = await import("../module/rules/checks.mjs");
  assert.equal(resolveSkillResult(30, 20, { threat: 19, ceiling: 22 }).total, 22);
  assert.equal(resolveSkillResult(18, 10, { actionDieBonus: 8, ceiling: 22 }).total, 22);
  assert.equal(resolveSkillResult(18, 10, { actionDieBonus: 2, ceiling: 22 }).total, 20);
});
