import test from "node:test";
import assert from "node:assert/strict";
import {
  featFreeActionPlan,
  roundActionSpecs,
  ROUND_ACTION_FEATS,
  FREE_ACTION_FEATS
} from "../module/rules/feat-free-actions.mjs";
import { limitedUseAbilities } from "../module/rules/limited-uses.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";

const own = { id: "c1", started: true, combatantId: "me", round: 2, turn: 0, ownTurnIndex: 0 },
  other = { ...own, turn: 1 };
const sys = (feats, extra = {}) => ({ activeFeatNames: feats, conditionContext: {}, ...extra });
const go = (feats, source, input = {}, combat = own, extra = {}) =>
  featFreeActionPlan(sys(feats, extra), combat, {
    source,
    action: ROUND_ACTION_FEATS[source].actions[0],
    description: "On the guard",
    confirmed: true,
    advantageConfirmed: true,
    ...input
  });

test("each feat gives its per-round uses; Quick Draw and Surge of Speed are unchanged", () => {
  const specs = roundActionSpecs(sys(["Containment Mastery", "Merciless", "Boxing Moves"]));
  assert.deepEqual(
    specs.map(s => [s.id, s.limit, s.period, s.roundAction]),
    [
      ["containmentMastery", 1, "round", true],
      ["merciless", 1, "round", true],
      ["weatherTheStorm", 2, "round", true]
    ]
  );
  assert.equal(FREE_ACTION_FEATS.quickDraw, "Quick Draw");
  assert.equal(FREE_ACTION_FEATS.weatherTheStorm, "Weather the Storm");
  const all = limitedUseAbilities(sys(["Quick Draw", "Fire-Team Basics"]), [], cfg).map(s => s.id);
  assert.ok(all.includes("quickDraw") && all.includes("fireTeamBasics"));
});

test("team feats need the GC's 2-to-1 confirmation and the user's own Initiative Count", () => {
  const plan = go(["Fire-Team Basics"], "fireTeamBasics");
  assert.deepEqual([plan.action, plan.actionCost, plan.advantageConfirmed], ["Cover Fire", "free", true]);
  assert.throws(() => go(["Fire-Team Basics"], "fireTeamBasics", { advantageConfirmed: false }), /2-to-1/);
  assert.throws(() => go(["Fire-Team Basics"], "fireTeamBasics", {}, other), /Initiative Count/);
  assert.throws(() => go([], "fireTeamBasics"), /not been earned/);
  assert.throws(() => go(["Containment Mastery"], "containmentMastery", { action: "Cover Fire" }), /Choose one/);
  assert.equal(go(["Containment Mastery"], "containmentMastery", { action: "Taunt" }).action, "Taunt");
  assert.equal(go(["Tac-Squad Mastery"], "tacSquadMastery").actionCost, "half");
  assert.equal(
    go(["Merciless"], "merciless", { advantageConfirmed: false }).source,
    "Merciless",
    "no advantage needed"
  );
});

test("Weather the Storm works at any Count, but only while in Total Defense", () => {
  assert.throws(() => go(["Boxing Moves"], "weatherTheStorm", {}, other), /Total Defense/);
  const defending = {
    totalDefense: { combatId: "c1", combatantId: "me", startRound: 2, dueRound: 3 },
    totalDefenseCombatContext: other
  };
  const plan = go(["Boxing Moves"], "weatherTheStorm", {}, other, defending);
  assert.equal(plan.source, "Weather the Storm");
  assert.equal(plan.action, "Tire against an attacking opponent");
});

test("Quick Draw still validates as before", () => {
  const plan = featFreeActionPlan(sys(["Quick Draw"]), own, {
    source: "quickDraw",
    action: "draw",
    description: "pistol",
    confirmed: true
  });
  assert.equal(plan.action, "Draw Weapon");
});
