import test from "node:test";
import assert from "node:assert/strict";
import {
  brawlingFinalEligible,
  brawlingFinalPlan,
  brawlingSupremacySpec
} from "../module/rules/brawling-supremacy.mjs";
import { FINAL_ATTACK_WORKFLOWS } from "../module/rules/final-round.mjs";

const owner = { activeFeatNames: ["Brawling Supremacy"] };
const hit = (extra = {}) => ({
  checkKind: "attack",
  actorUuid: "Actor.a",
  successConfirmed: true,
  weaponProficiency: "unarmed",
  weaponQualities: "",
  attackContext: { targetActorUuid: "Actor.t" },
  rollCombat: { id: "c", round: 2, combatantId: "own" },
  ...extra
});

test("Brawling Supremacy: the second non-final unarmed hit on one opponent in a round earns a final attack", () => {
  const first = hit(),
    second = hit();
  assert.equal(brawlingFinalEligible(owner, first, [first]), false);
  assert.ok(brawlingFinalEligible(owner, second, [first, second]));
  assert.equal(brawlingFinalEligible({ activeFeatNames: [] }, second, [first, second]), false);
  const otherTarget = hit({ attackContext: { targetActorUuid: "Actor.u" } });
  assert.equal(brawlingFinalEligible(owner, otherTarget, [first, otherTarget]), false);
  const lastRound = hit({ rollCombat: { id: "c", round: 1 } });
  assert.equal(brawlingFinalEligible(owner, second, [lastRound, second]), false);
  const armed = hit({ weaponProficiency: "edged" });
  assert.equal(brawlingFinalEligible(owner, second, [armed, second]), false);
  const final = hit({ finalAttack: { source: "brawlingSupremacy", targetUuid: "Actor.t" } });
  assert.equal(brawlingFinalEligible(owner, second, [first, second, final]), false, "once per opponent per round");
  assert.equal(brawlingFinalEligible(owner, final, [first, second, final]), false, "final attacks do not count");
});

test("the plan is a free final attack against the hit opponent in the same round", () => {
  const combat = { id: "c", started: true, round: 2, combatantId: "own" };
  const plan = brawlingFinalPlan(owner, combat, hit());
  assert.deepEqual([plan.source, plan.targetUuid, plan.free], ["brawlingSupremacy", "Actor.t", true]);
  assert.throws(() => brawlingFinalPlan(owner, { ...combat, round: 3 }, hit()), /round of the hits/);
  assert.ok(FINAL_ATTACK_WORKFLOWS.has("brawlingSupremacy"));
  assert.equal(brawlingSupremacySpec(owner).workflow, "brawlingSupremacy");
});
