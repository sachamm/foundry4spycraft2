import test from "node:test";
import assert from "node:assert/strict";
import { fireActionPlan, burstHits, autofireHits, strafeHits } from "../module/rules/combat-actions.mjs";
import { roundActionSpecs } from "../module/rules/feat-free-actions.mjs";
import { autofireMasteryUsed } from "../module/apps/autofire.mjs";

const facts = (feats = [], fireMode = "single") => ({ firearm: true, fireMode, attackAction: "standard", feats });

test("Two-Shot Burst: Autofire Basics, Single-Shot or Burst mode, 2 shots, never a third hit", () => {
  const plan = fireActionPlan(facts(["Autofire Basics"]), { action: "twoShotBurst" });
  assert.deepEqual([plan.blocked, plan.shots, plan.error], [false, 2, 1]);
  assert.equal(fireActionPlan(facts(["Autofire Basics"], "burst"), { action: "twoShotBurst" }).blocked, false);
  assert.ok(fireActionPlan(facts(["Autofire Basics"], "auto"), { action: "twoShotBurst" }).blocked);
  assert.ok(fireActionPlan(facts([]), { action: "twoShotBurst" }).blocked);
  assert.ok(fireActionPlan(facts(["Autofire Basics"]), { action: "twoShotBurst", shotsRemaining: 1 }).blocked);
  assert.equal(burstHits(30, 15, 2), 2, "capped at two hits");
  assert.equal(burstHits(30, 15), 3);
  assert.equal(burstHits(16, 15, 2), 1);
});

test("Autofire Basics: Cover Fire as a half action once per round", () => {
  const spec = roundActionSpecs({ activeFeatNames: ["Autofire Basics"] }).find(s => s.id === "autofireBasics");
  assert.deepEqual([spec.limit, spec.period], [1, "round"]);
  assert.match(spec.name, /Cover Fire as a half action/);
});

test("Autofire Mastery: no extra error range for Burst or Two-Shot Burst; one teammate bonus per opponent per round", () => {
  assert.equal(fireActionPlan(facts([], "burst"), { action: "burst" }).error, 1);
  assert.equal(fireActionPlan(facts(["Autofire Mastery"], "burst"), { action: "burst" }).error, 0);
  assert.equal(fireActionPlan(facts(["Autofire Basics", "Autofire Mastery"]), { action: "twoShotBurst" }).error, 0);
  const posted = [
    {
      flags: {
        spycraft2: { actorUuid: "Actor.a", autofireMastery: { targetUuid: "Actor.t", combatId: "c", round: 2 } }
      }
    }
  ];
  assert.ok(autofireMasteryUsed(posted, "Actor.a", "Actor.t", { id: "c", round: 2 }));
  assert.equal(autofireMasteryUsed(posted, "Actor.a", "Actor.t", { id: "c", round: 3 }), false);
  assert.equal(autofireMasteryUsed(posted, "Actor.a", "Actor.u", { id: "c", round: 2 }), false);
});

test("Autofire Supremacy: an extra hit per 3 points over Defense, and +1 per strafed target", () => {
  assert.equal(autofireHits(27, 15, 10), 4, "standard: 1 + 12/4");
  assert.equal(autofireHits(27, 15, 10, { perPoints: 3 }), 5, "Supremacy: 1 + 12/3");
  assert.deepEqual(
    strafeHits(18, [15, 15, 15], { step: 1 }).map(r => r.hit),
    [true, true, true]
  );
  assert.deepEqual(
    strafeHits(18, [15, 15, 15]).map(r => r.hit),
    [true, false, false]
  );
});
