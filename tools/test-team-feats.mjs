import test from "node:test";
import assert from "node:assert/strict";
import {
  hordeCoverFloor,
  hordeSupremacyDamage,
  fireTeamSupremacyPlan,
  fireTeamSupremacySpec
} from "../module/rules/team-feats.mjs";
import { featFreeActionPlan, roundActionSpecs } from "../module/rules/feat-free-actions.mjs";
import { FINAL_ATTACK_WORKFLOWS } from "../module/rules/final-round.mjs";
import { weaponDamage } from "../module/rules/gear.mjs";

const own = { id: "c1", started: true, combatantId: "me", round: 2, turn: 0, ownTurnIndex: 0 };
const sys = feats => ({
  activeFeatNames: feats,
  conditionContext: {},
  wounds: { value: 4 },
  abilities: { str: { mod: 0 } }
});

test("Horde Basics raises personal cover to 1/4 at 2-to-1 and 1/2 at 3-to-1", () => {
  assert.deepEqual([hordeCoverFloor(""), hordeCoverFloor("2"), hordeCoverFloor("3")], [0, 1, 2]);
});

test("Horde Supremacy adds +2 morale damage when declared", () => {
  const w = { proficiency: "edged", damage: "1d6" };
  assert.equal(hordeSupremacyDamage(sys(["Horde Supremacy"]), { ...w, hordeSupremacy: true }), 2);
  assert.equal(hordeSupremacyDamage(sys([]), { ...w, hordeSupremacy: true }), 0);
  assert.equal(
    weaponDamage(sys(["Horde Supremacy"]), { ...w, hordeSupremacy: true }).bonus -
      weaponDamage(sys(["Horde Supremacy"]), w).bonus,
    2
  );
});

test("Tac-Squad Basics and Horde Mastery are round actions with their own costs", () => {
  const go = (feats, source, action) =>
    featFreeActionPlan(sys(feats), own, {
      source,
      action,
      description: "x",
      confirmed: true,
      advantageConfirmed: true
    });
  assert.equal(go(["Tac-Squad Basics"], "tacSquadBasics", "Threaten").actionCost, "free");
  assert.equal(go(["Tac-Squad Basics"], "tacSquadBasics", "Intimidate/Coercion check").actionCost, "half");
  assert.equal(go(["Horde Mastery"], "hordeMastery", "Pummel").actionCost, "half");
  assert.ok(roundActionSpecs(sys(["Horde Mastery"])).some(s => s.id === "hordeMastery"));
});

test("Fire-Team Supremacy: one free final attack per round with a confirmed 2-to-1 advantage", () => {
  assert.deepEqual(
    [
      fireTeamSupremacySpec(sys(["Fire-Team Supremacy"])).limit,
      fireTeamSupremacySpec(sys(["Fire-Team Supremacy"])).period
    ],
    [1, "round"]
  );
  assert.ok(FINAL_ATTACK_WORKFLOWS.has("fireTeamSupremacy"));
  const plan = fireTeamSupremacyPlan(sys(["Fire-Team Supremacy"]), own, { advantageConfirmed: true, confirmed: true });
  assert.equal(plan.free, true);
  assert.throws(() => fireTeamSupremacyPlan(sys(["Fire-Team Supremacy"]), own, { confirmed: true }), /2-to-1/);
  assert.throws(
    () => fireTeamSupremacyPlan(sys([]), own, { advantageConfirmed: true, confirmed: true }),
    /not been earned/
  );
});
