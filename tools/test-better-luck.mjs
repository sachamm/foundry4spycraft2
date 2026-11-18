import test from "node:test";
import assert from "node:assert/strict";
import { finalAttackActor } from "./fixtures/final-attack-actor.mjs";
import { actionDieBoostPlan, actionDieBoostResult } from "../module/rules/action-dice.mjs";
import { betterLuckSettlement, betterLuckNote } from "../module/rules/better-luck.mjs";
import { fortunatePool } from "../module/rules/fortunate.mjs";
import { SpycraftActor } from "../module/documents/actor.mjs";

const periods = { scene: "s1", session: "n1", mission: "m1" };
const system = (feats = ["Better Luck Next Time"], extra = {}) => ({
  activeFeatNames: feats,
  actionDice: { value: 3, die: 6, explodeAt: 6 },
  coreClassIds: [],
  usagePeriods: periods,
  worldTime: 10,
  bonusActionDice: {},
  ...extra
});
const check = (kind = "skill", patch = {}) => ({
  checkKind: kind,
  rawTotal: 14,
  naturalDie: 9,
  threat: 20,
  cap: null,
  ...patch
});

test("only a skill check or save boosted by an owner of the feat qualifies", () => {
  assert.equal(actionDieBoostPlan(system(), check("skill")).betterLuck, true);
  assert.equal(actionDieBoostPlan(system(), check("save")).betterLuck, true);
  for (const kind of ["attack", "damage", "knowledge", "check"])
    assert.equal(actionDieBoostPlan(system(), check(kind)).betterLuck, false, kind);
  assert.equal(actionDieBoostPlan(system([]), check("skill")).betterLuck, false);
});

test("a single boosting die that rolls a natural 1 leaves one pending refund", () => {
  const plan = actionDieBoostPlan(system(), check("skill"));
  const one = actionDieBoostResult(check("skill"), plan, [1]);
  assert.deepEqual(one.betterLuckRefunds, [{ bonusPoolId: "", die: 6 }]);
  assert.equal(actionDieBoostResult(check("skill"), plan, [2]).betterLuckRefunds, undefined);
  const twice = actionDieBoostResult(check("skill", { betterLuckRefunds: one.betterLuckRefunds }), plan, [1]);
  assert.equal(twice.betterLuckRefunds.length, 2, "every qualifying boost counts");
  const two = actionDieBoostPlan(system(), check("skill"), { count: 2 });
  assert.equal(actionDieBoostResult(check("skill"), two, [1, 1]).betterLuckRefunds, undefined, "two dice spent");
  const doubled = actionDieBoostPlan(system(["Better Luck Next Time", "Card Shark"]), {
    ...check("skill"),
    skillKey: "streetwise",
    checkId: "gambling"
  });
  assert.equal(doubled.rolls, 2);
  assert.equal(actionDieBoostResult(check("skill"), doubled, [1, 3]).betterLuckRefunds, undefined, "two dice rolled");
  const pooled = { ...plan, bonusPoolId: "f1" };
  assert.deepEqual(actionDieBoostResult(check("save"), pooled, [1]).betterLuckRefunds, [{ bonusPoolId: "f1", die: 6 }]);
  const noFeat = actionDieBoostPlan(system([]), check("skill"));
  assert.equal(actionDieBoostResult(check("skill"), noFeat, [1]).betterLuckRefunds, undefined);
});

test("resolving returns ordinary dice and live unrestricted pool dice once; expired or check-bound dice are lost", () => {
  const live = { ...fortunatePool(system(["Fortunate"]), { id: "f1", periods }), remaining: 0 },
    old = { ...fortunatePool(system(["Fortunate"]), { id: "f2", periods: { ...periods, scene: "s0" } }), remaining: 0 },
    bound = { id: "b1", source: "iKnowWhatDoing", die: 10, granted: 1, remaining: 0, session: "n1", label: "Bound" };
  const s = system(["Better Luck Next Time"], { bonusActionDice: { f1: live, f2: old, b1: bound } });
  const settled = betterLuckSettlement(
    s,
    check("skill", {
      betterLuckRefunds: [
        { bonusPoolId: "", die: 6 },
        { bonusPoolId: "f1", die: 4 },
        { bonusPoolId: "f2", die: 4 },
        { bonusPoolId: "b1", die: 10 }
      ]
    })
  );
  assert.equal(settled.ordinary, 1);
  assert.equal(settled.value, 4);
  assert.deepEqual(settled.pools, { f1: 1 });
  assert.deepEqual(settled.lost, ["Fortunate", "Bound"]);
  assert.equal(settled.count, 4);
  assert.match(betterLuckNote(settled), /2 action dice returned.*Not returned .*: Fortunate, Bound\./);
  assert.equal(betterLuckSettlement(s, check("skill")), null);
  assert.equal(
    betterLuckSettlement(s, check("skill", { betterLuckRefunds: [{ bonusPoolId: "" }], betterLuckRefunded: true })),
    null,
    "a check pays out once"
  );
  assert.equal(
    betterLuckSettlement(
      { ...s, bonusActionDice: { f1: { ...live, remaining: 1 } } },
      check("skill", { betterLuckRefunds: [{ bonusPoolId: "f1" }] })
    ).lost.length,
    1,
    "a pool never holds more than it was granted"
  );
  assert.equal(
    betterLuckNote({ count: 1, lost: [] }),
    "Better Luck Next Time: 1 action die returned after a natural 1 on a boost."
  );
});

test("finishing the check returns the die and marks the refund made", async () => {
  const { a, messages } = finalAttackActor(["Better Luck Next Time"]);
  a.system.actionDice = { value: 2 };
  a.finishCheck = SpycraftActor.prototype.finishCheck;
  a.settleBetterLuck = SpycraftActor.prototype.settleBetterLuck;
  a.retireCheckBonusPool = async () => {};
  const infos = [];
  ui.notifications.info = m => infos.push(m);
  const message = {
    id: "m1",
    uuid: "ChatMessage.m1",
    flags: {
      spycraft2: {
        actorUuid: a.uuid,
        checkKind: "skill",
        checkMethod: "roll",
        rawTotal: 15,
        naturalDie: 10,
        effectiveTotal: 16,
        successConfirmed: true,
        betterLuckRefunds: [{ bonusPoolId: "", die: 4 }]
      }
    },
    async update(patch) {
      for (const [k, v] of Object.entries(patch))
        if (k.startsWith("flags.spycraft2.")) this.flags.spycraft2[k.slice(16)] = v;
    }
  };
  messages.push(message);
  await a.finishCheck(message);
  assert.equal(message.flags.spycraft2.resolved, true);
  assert.equal(message.flags.spycraft2.betterLuckRefunded, true);
  assert.equal(a.system.actionDice.value, 3);
  assert.match(infos.join(" "), /1 action die returned/);
});
