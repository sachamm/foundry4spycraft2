import test from "node:test";
import assert from "node:assert/strict";
import { COMBAT_STANCES, stanceForcedExit, combatStanceState } from "../module/rules/combat-stance.mjs";
import { conditionRollPenalties } from "../module/rules/attributes.mjs";
import { combatMovementPlan } from "../module/rules/combat-movement.mjs";
import { unarmedTrickPlan, unarmedTrickDamageBonus, unarmedTrickNote } from "../module/rules/unarmed-tricks.mjs";
import { weaponDamage } from "../module/rules/gear.mjs";
import { roundActionSpecs, featFreeActionPlan } from "../module/rules/feat-free-actions.mjs";

const sys = (feats, stance, conditions = {}) => ({
  activeFeatNames: feats,
  combatStance: stance ? { version: 1, id: "s", key: stance } : null,
  conditionContext: conditions,
  speed: 30,
  abilities: { dex: { mod: 0 }, str: { mod: 0 } },
  wounds: { value: 4 }
});
const fists = { proficiency: "unarmed", damage: "1d4", qualities: "" };
const move = (system, action, distanceFeet = 30) =>
  combatMovementPlan(system, {
    action,
    distanceFeet,
    routeConfirmed: true,
    adjacentThreateningOpponent: false,
    passesThreateningAdjacency: false
  });

test("the three new stances belong to their feats", () => {
  assert.equal(COMBAT_STANCES.forward.feat, "Rolling Basics");
  assert.equal(COMBAT_STANCES.rooted.feat, "Spirit Basics");
  assert.equal(COMBAT_STANCES.prone.feat, "Submission Basics");
});

test("Forward and Rooted Stances restrict movement", () => {
  assert.throws(() => move(sys(["Rolling Basics"], "forward"), "standardMove"), /Forward Stance/);
  assert.throws(() => move(sys(["Spirit Basics"], "rooted"), "standardMove", 5), /Rooted Stance/);
  assert.doesNotThrow(() => move(sys(["Spirit Basics"], "rooted"), "standardMove", 0));
  assert.doesNotThrow(() => move(sys(["Rolling Basics"]), "standardMove"));
});

test("Prone Stance survives being prone and waives the prone attack penalty", () => {
  const prone = sys(["Submission Basics"], "prone", { prone: true });
  assert.equal(stanceForcedExit(prone), false);
  assert.ok(combatStanceState(prone));
  assert.equal(conditionRollPenalties(prone).meleeAttack, 0);
  const plain = sys(["Submission Basics"], null, { prone: true });
  assert.equal(conditionRollPenalties(plain).meleeAttack, -2);
  assert.equal(stanceForcedExit(sys(["Rolling Basics"], "forward", { prone: true })), true, "other stances still end");
});

test("Roll adds +1 damage; Palm Strike states its push", () => {
  assert.equal(
    unarmedTrickPlan(sys(["Rolling Basics"]), fists, { trick: "roll", kick: true, attackAction: "other" }).damageBonus,
    1
  );
  assert.equal(unarmedTrickDamageBonus("roll"), 1);
  const base = weaponDamage(sys([]), fists).bonus;
  assert.equal(weaponDamage(sys([]), { ...fists, unarmedTrick: "roll" }).bonus - base, 1);
  assert.match(unarmedTrickNote({ key: "palmStrike" }), /push the opponent 5 ft\./);
});

test("Spirit Basics reduces one source's lethal damage once per combat, at any Count", () => {
  const spec = roundActionSpecs(sys(["Spirit Basics"])).find(s => s.id === "spiritBasics");
  assert.deepEqual([spec.limit, spec.period], [1, "combat"]);
  const plan = featFreeActionPlan(
    sys(["Spirit Basics"]),
    { id: "c", started: true, combatantId: "me", round: 1, turn: 2, ownTurnIndex: 0 },
    {
      source: "spiritBasics",
      action: "Reduce the lethal damage from one source by your base attack bonus (minimum 1)",
      description: "Grenade",
      confirmed: true
    }
  );
  assert.equal(plan.source, "Spirit Basics");
});
