import test from "node:test";
import assert from "node:assert/strict";
import { wrestlingDefense, openStanceSpec, brushPlan, inOpenStance } from "../module/rules/wrestling.mjs";
import { COMBAT_STANCES } from "../module/rules/combat-stance.mjs";
import { combatMovementPlan } from "../module/rules/combat-movement.mjs";
import { unarmedTrickClash } from "../module/rules/boxing.mjs";
import { rollPipeline } from "../module/rules/roll-pipeline.mjs";

const fists = { proficiency: "unarmed", damage: "1d4", qualities: "" };
const wrestler = (stance = null) => ({
  activeFeatNames: ["Wrestling Basics"],
  combatStance: stance ? { version: 1, id: "s", key: stance } : null,
  conditionContext: {},
  speed: 30,
  abilities: { dex: { mod: 0 } },
  wounds: { value: 4 }
});

test("+1 Defense against an adjacent opponent's non-ranged attack", () => {
  assert.equal(wrestlingDefense(wrestler(), { adjacent: true }), 1);
  assert.equal(wrestlingDefense(wrestler(), { adjacent: false }), 0);
  assert.equal(wrestlingDefense(wrestler(), { adjacent: true, ranged: true }), 0);
  assert.equal(wrestlingDefense({ activeFeatNames: [] }, { adjacent: true }), 0);
});

test("Open Stance: once per round, and no Run actions", () => {
  assert.deepEqual(COMBAT_STANCES.open, { name: "Open Stance", feat: "Wrestling Basics", page: 189 });
  assert.ok(inOpenStance(wrestler("open")));
  assert.deepEqual([openStanceSpec(wrestler()).limit, openStanceSpec(wrestler()).period], [1, "round"]);
  assert.equal(openStanceSpec({ activeFeatNames: [] }), null);
  const move = (sys, action) =>
    combatMovementPlan(sys, {
      action,
      distanceFeet: 30,
      routeConfirmed: true,
      adjacentThreateningOpponent: false,
      passesThreateningAdjacency: false
    });
  assert.throws(() => move(wrestler("open"), "run"), /no Run actions/);
  assert.doesNotThrow(() => move(wrestler("open"), "standardMove"));
});

test("Brush: an unarmed Standard Attack for 1d6 subdual, and one unarmed trick per action", () => {
  assert.equal(brushPlan(wrestler(), fists, {}), null);
  assert.match(brushPlan(wrestler(), fists, { brush: true }).note, /1d6 subdual/);
  assert.ok(brushPlan({ activeFeatNames: [] }, fists, { brush: true }).blocked);
  assert.ok(brushPlan(wrestler(), fists, { brush: true, attackAction: "other" }).blocked);
  assert.match(unarmedTrickClash({ brush: true, doubleJab: true }), /Only one/);
  const html = rollPipeline.dialog({
    dialog: "attack",
    actor: { system: wrestler() },
    item: { system: fists },
    options: {}
  });
  assert.match(html, /name="brush"/);
});
