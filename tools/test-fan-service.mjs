import test from "node:test";
import assert from "node:assert/strict";
import { feintSkillChecks, feintActingSkill, feintCheckPlan } from "../module/rules/feint.mjs";

const fan = { activeFeatNames: ["Fan Service"] };
const combat = { id: "c", started: true, round: 1, turn: 0, combatantId: "own", ownTurnIndex: 0 };

test("Fan Service: Feint with Impress (Cha) as well as Sleight of Hand", () => {
  assert.ok(feintActingSkill("impress", fan));
  assert.equal(feintActingSkill("impress", { activeFeatNames: [] }), false);
  assert.ok(feintActingSkill("sleightOfHand", null));
  const [feint] = feintSkillChecks("impress", [], fan).filter(c => c.id === "feint");
  assert.deepEqual([feint.attributes, feint.tags, feint.role], [["cha"], "Vision", "attacker"]);
  assert.equal(
    feintSkillChecks("impress", [], { activeFeatNames: [] }).some(c => c.id === "feint"),
    false
  );
  const plan = feintCheckPlan(fan, "impress", feint, {
    feintOpponentName: "Vex",
    feintAdjacent: true,
    feintTargetEligibleConfirmed: true,
    feintLegalConfirmed: true,
    feintCombat: combat
  });
  assert.equal(plan.blockedReason, "");
  assert.equal(plan.evidence.role, "attacker");
  assert.match(plan.notes.join(" "), /Fan Service/);
});
