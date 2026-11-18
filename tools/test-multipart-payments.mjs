import test from "node:test";
import assert from "node:assert/strict";
import { masterPlanGainPlan, masterPlanPool, checkBonusPool } from "../module/rules/bonus-pools.mjs";
import {
  multipartActionDicePlan,
  multipartPaymentRecord,
  getActionDieSettlementReview,
  setPendingActionDieReview,
  beginActionDiePayment,
  endActionDiePayment
} from "../module/rules/action-die-payments.mjs";
import {
  payMultipartActionDiceLocked,
  reviewMultipartActionDice,
  markMultipartActionDieReview
} from "../module/apps/action-die-payments.mjs";
let serial = 0;
const clone = structuredClone;
globalThis.game = {
  user: { isGM: true, id: "gc" },
  time: { worldTime: 0 },
  settings: { get: () => ({}) },
  messages: new Map()
};
globalThis.foundry = {
  utils: { randomID: () => `id${++serial}`, escapeHTML: String },
  applications: { api: { DialogV2: { input: async () => null } } }
};
globalThis.ui = { notifications: { warn: () => {} } };
function actor() {
  game.user.isGM = true;
  const a = {
    uuid: "Actor.multi" + ++serial,
    isOwner: true,
    flags: {},
    items: [],
    usagePeriods: { scene: "s", session: "s", mission: "m" },
    fail: {},
    system: {
      worldTime: 0,
      level: 12,
      classLevels: { schemer: 8 },
      abilities: { int: { mod: 4 } },
      activeFeatNames: [],
      actionDice: { value: 3, die: 8, explodeAt: 8 },
      bonusActionDice: {},
      conditionContext: {},
      vitality: { value: 4 },
      wounds: { value: 4 },
      resourceUses: {},
      xp: 35
    },
    get actionDiceFundingSystem() {
      return {
        ...this.system,
        usagePeriods: this.usagePeriods,
        actionDiceSettlementReview: getActionDieSettlementReview(this)
      };
    },
    actorRecordRestorePatch: (path, value) =>
      value === undefined
        ? { [path.split(".").slice(0, -1).join(".") + ".-=" + path.split(".").at(-1)]: null }
        : { [path]: value },
    async update(patch) {
      const marker = Object.keys(patch).find(k => k.startsWith("flags.spycraft2.actionDiePayments.")),
        kind = patch["flags.spycraft2.actionDiceSettlementReview"] ? "review" : marker ? patch[marker].state : "other";
      if (this.fail[kind + "Before"]) {
        this.fail[kind + "Before"] = false;
        await this.hook?.(kind, "before");
        throw Error(kind + " rejected");
      }
      for (const [path, value] of Object.entries(patch)) {
        const keys = path.split(".");
        let o = this;
        for (const k of keys.slice(0, -1)) o = o[k] ??= {};
        const k = keys.at(-1);
        if (k.startsWith("-=")) delete o[k.slice(2)];
        else o[k] = clone(value);
      }
      if (this.fail[kind + "After"]) {
        this.fail[kind + "After"] = false;
        await this.hook?.(kind, "after");
        throw Error(kind + " committed");
      }
      return this;
    }
  };
  a.system.usagePeriods = a.usagePeriods;
  a.system.bonusActionDice.mp = masterPlanPool(a.system, masterPlanGainPlan(a.system), { id: "mp" });
  return a;
}
const parts = [{ count: 1 }, { bonusPoolId: "mp", count: 2, scope: "surcharge" }];
const pay = (a, fn = async p => p, opts = {}) => payMultipartActionDiceLocked(a, parts, fn, opts);
const confirm = (a, extra = {}) =>
  reviewMultipartActionDice(a, {
    balances: [2, 2],
    benefitRemains: true,
    resolution: "Verified actual benefit and both balances",
    healthReviewed: true,
    ...extra
  });
test("one atomic payment groups duplicate sources, retains the benefit die type, and does not alter XP or awards", async () => {
  const a = actor(),
    p = await pay(a);
  assert.equal(p.count, 3);
  assert.equal(p.system.actionDice.die, 8);
  assert.deepEqual(
    p.payments.map(p => p.count),
    [1, 2]
  );
  assert.equal(a.system.actionDice.value, 2);
  assert.equal(a.system.bonusActionDice.mp.remaining, 2);
  assert.equal(a.flags.spycraft2.actionDiePayments[p.id].state, "spent");
  assert.equal(a.system.xp, 35);
  assert.equal(getActionDieSettlementReview(a).needsReview, undefined);
  const merged = multipartActionDicePlan(a.actionDiceFundingSystem, [{ count: 1 }, { count: 1, scope: "surcharge" }], {
    id: "merge",
    actorUuid: a.uuid
  });
  assert.equal(merged.payments.length, 1);
  assert.equal(merged.payments[0].count, 2);
  assert.throws(
    () =>
      multipartActionDicePlan(a.actionDiceFundingSystem, [{ count: 2 }, { count: 1 }], {
        id: "tooMuch",
        actorUuid: a.uuid
      }),
    /Not enough/
  );
});
test("a check-bound bonus die funds only its own boost; fee dice require an unrestricted source", () => {
  const a = actor(),
    m = {
      uuid: "ChatMessage.check",
      flags: {
        spycraft2: {
          actorUuid: a.uuid,
          rawTotal: 7,
          checkKind: "skill",
          skillKey: "athletics",
          ability: "str",
          checkMethod: "roll",
          requiredBonusPoolId: "bound"
        }
      }
    };
  a.system.bonusActionDice.bound = checkBonusPool(
    a.system,
    { source: "iKnowWhatDoing", label: "Bound", die: 10, units: 1, mandatory: true },
    { id: "bound", messageUuid: m.uuid, skillKey: "athletics", ability: "str" }
  );
  const plan = multipartActionDicePlan(
    a.actionDiceFundingSystem,
    [
      { bonusPoolId: "bound", count: 1, scope: "boost" },
      { count: 2, scope: "surcharge" }
    ],
    { id: "boundPay", actorUuid: a.uuid, message: m }
  );
  assert.equal(plan.die, 10);
  assert.equal(plan.system.actionDice.value, 3);
  assert.throws(() =>
    multipartActionDicePlan(a.actionDiceFundingSystem, [{ bonusPoolId: "bound", count: 1, scope: "surcharge" }], {
      id: "bad",
      actorUuid: a.uuid,
      message: m
    })
  );
  m.flags.spycraft2.actorUuid = "Actor.other";
  assert.throws(() =>
    multipartActionDicePlan(a.actionDiceFundingSystem, [{ bonusPoolId: "bound", count: 1, scope: "boost" }], {
      id: "bad",
      actorUuid: a.uuid,
      message: m
    })
  );
});
test("Shaken IV, malformed amounts, exhausted pools, invalid references and unowned characters cannot pay", async () => {
  const a = actor();
  a.system.conditionContext.shakenGrade = 4;
  await assert.rejects(pay(a), /Shaken IV/);
  a.system.conditionContext = {};
  for (const count of [0, -1, 1.5, true, NaN])
    await assert.rejects(payMultipartActionDiceLocked(a, [{ count }], async () => {}));
  await assert.rejects(pay(a, async () => {}, { id: "__proto__" }));
  a.isOwner = false;
  await assert.rejects(pay(a), /own/);
  assert.equal(a.system.actionDice.value, 3);
});
test("rejected reservations invoke no benefit; proven committed reservations continue exactly once", async () => {
  for (const when of ["Before", "After"]) {
    const a = actor();
    a.fail["reserved" + when] = true;
    let called = 0;
    const run = pay(a, async () => ++called);
    if (when === "Before") {
      await assert.rejects(run, /rejected/);
      assert.equal(called, 0);
      assert.equal(a.system.actionDice.value, 3);
    } else {
      assert.equal(await run, 1);
      assert.equal(called, 1);
      assert.equal(a.system.actionDice.value, 2);
    }
  }
});
test("callback failure refunds every source while preserving independent dice gains and spends", async () => {
  const a = actor();
  await assert.rejects(
    pay(a, async () => {
      a.system.actionDice.value++;
      a.system.bonusActionDice.mp.remaining--;
      throw Error("benefit failed");
    }),
    /benefit failed/
  );
  assert.equal(a.system.actionDice.value, 4);
  assert.equal(a.system.bonusActionDice.mp.remaining, 3);
  assert.equal(Object.values(a.flags.spycraft2.actionDiePayments)[0].state, "refunded");
  assert.equal(getActionDieSettlementReview(a).needsReview, undefined);
});
test("committed refund and final receipt errors are proved without repeating payments or benefits", async () => {
  let a = actor();
  a.fail.refundedAfter = true;
  await assert.rejects(
    pay(a, async () => {
      throw Error("failed benefit");
    }),
    /failed benefit/
  );
  assert.equal(a.system.actionDice.value, 3);
  assert.equal(getActionDieSettlementReview(a).needsReview, undefined);
  a = actor();
  a.fail.spentAfter = true;
  assert.equal(await pay(a, async () => 17), 17);
  assert.equal(a.system.actionDice.value, 2);
  assert.equal(getActionDieSettlementReview(a).needsReview, undefined);
});
test("uncertain benefits and failed refunds hold every source, with local fallback if the review cannot be saved", async () => {
  for (const uncertainty of [true, false]) {
    const a = actor();
    a.fail.reviewBefore = true;
    if (!uncertainty) a.fail.refundedBefore = true;
    await assert.rejects(
      pay(a, async () => {
        const error = Error("effect uncertain");
        if (uncertainty) error.actionDiceSettlementReview = { purpose: "Test effect" };
        throw error;
      })
    );
    assert.equal(a.system.actionDice.value, 2);
    assert.equal(a.system.bonusActionDice.mp.remaining, 2);
    const review = getActionDieSettlementReview(a);
    assert.equal(review.needsReview, true);
    assert.equal(review.payments.length, 2);
    await assert.rejects(pay(a), /interrupted/);
    await confirm(a);
    assert.equal(getActionDieSettlementReview(a).needsReview, false);
  }
});
test("a rejected final marker holds recovery but returns the already completed benefit", async () => {
  const a = actor();
  a.fail.spentBefore = true;
  let calls = 0;
  assert.equal(await pay(a, async () => ++calls), 1);
  assert.equal(calls, 1);
  assert.equal(getActionDieSettlementReview(a).callbackCompleted, true);
  await confirm(a);
  const record = Object.values(a.flags.spycraft2.actionDiePayments)[0];
  assert.equal(record.state, "reviewed");
  assert.equal(record.benefitRemains, true);
  await assert.rejects(
    pay(a, async () => ++calls, { id: record.id }),
    /already exists/
  );
  assert.equal(calls, 1);
});
test("interrupted durable reservations are detected after reload, while active transactions and their exact lock token are excluded", () => {
  const a = actor(),
    p = multipartActionDicePlan(a.actionDiceFundingSystem, parts, { id: "interrupted", actorUuid: a.uuid }),
    r = multipartPaymentRecord(p, { lockToken: "old" });
  a.flags.spycraft2 = { actionDiePayments: { interrupted: r } };
  beginActionDiePayment(a, r.id);
  assert.equal(getActionDieSettlementReview(a).needsReview, undefined);
  assert.throws(() => beginActionDiePayment(a, "nested"), /Combine/);
  endActionDiePayment(a, r.id);
  a.items = [{ id: "sc2ResourceLock1", flags: { spycraft2: { resourceLock: { token: "old" } } } }];
  assert.equal(getActionDieSettlementReview(a).needsReview, undefined);
  a.items[0].flags.spycraft2.resourceLock.token = "new";
  assert.equal(getActionDieSettlementReview(a).needsReview, true);
  assert.equal(getActionDieSettlementReview({ ...a }).needsReview, true);
});
test("GC review reconciles all balances atomically and requires explicit disposition for a replaced grant", async () => {
  const a = actor();
  a.fail.spentBefore = true;
  await pay(a);
  a.system.bonusActionDice.mp.at = 99;
  await assert.rejects(confirm(a), /changed grant/);
  await confirm(a, { balances: [1, 999], unavailable: [false, true] });
  assert.equal(a.system.actionDice.value, 1);
  assert.equal(a.system.bonusActionDice.mp.remaining, 2);
  assert.deepEqual(getActionDieSettlementReview(a).settledBalances, [1, null]);
});
test("GC review rejects stale health/action state, non-GCs, invalid balances and inconsistent limited-use restoration", async () => {
  const a = actor();
  a.fail.spentBefore = true;
  await pay(a);
  game.user.isGM = false;
  await assert.rejects(confirm(a), /Only the GC/);
  game.user.isGM = true;
  for (const balances of [
    [-1, 2],
    [1.5, 2],
    [2, 5],
    [true, 2],
    [null, 2]
  ])
    await assert.rejects(confirm(a, { balances }), /valid whole/);
  const previous = foundry.applications.api.DialogV2.input;
  foundry.applications.api.DialogV2.input = async () => {
    a.system.eagleEyeBoost = { new: true };
    return { balance_0: 2, balance_1: 2, benefitRemains: "true", resolution: "reviewed", healthReviewed: true };
  };
  await assert.rejects(reviewMultipartActionDice(a), /changed/);
  foundry.applications.api.DialogV2.input = previous;
  const review = getActionDieSettlementReview(a);
  review.limitedUseSettlement = [{ id: "power", before: { epoch: "s", used: 1 }, reserved: { epoch: "s", used: 2 } }];
  a.system.resourceUses.power = { epoch: "s", used: 2 };
  await assert.rejects(confirm(a, { restoreLimitedUses: true }), /disposition/);
  await confirm(a, { restoreLimitedUses: true, benefitRemains: false });
  assert.equal(a.system.resourceUses.power.used, 1);
});
test("limited-use restoration validates new epochs, missing counters and exact increments", async () => {
  for (const before of [null, { epoch: "older", used: 5 }, { epoch: "s", used: 0 }]) {
    const a = actor();
    a.fail.spentBefore = true;
    await pay(a);
    getActionDieSettlementReview(a).limitedUseSettlement = [{ id: "power", before, reserved: { epoch: "s", used: 1 } }];
    a.system.resourceUses.power = { epoch: "s", used: 1 };
    await confirm(a, { restoreLimitedUses: true, benefitRemains: false });
    assert.deepEqual(a.system.resourceUses.power, before ?? undefined);
  }
  const a = actor();
  a.fail.spentBefore = true;
  await pay(a);
  getActionDieSettlementReview(a).limitedUseSettlement = [
    { id: "power", before: null, reserved: { epoch: "s", used: 2 } }
  ];
  a.system.resourceUses.power = { epoch: "s", used: 2 };
  await assert.rejects(confirm(a, { restoreLimitedUses: true, benefitRemains: false }), /limited-use/);
});
test("GC completion committed before an error clears the local hold without another balance write", async () => {
  const a = actor();
  a.fail.spentBefore = true;
  await pay(a);
  a.fail.reviewAfter = true;
  const done = await confirm(a);
  assert.equal(done.needsReview, false);
  assert.equal(getActionDieSettlementReview(a).needsReview, false);
  assert.equal(await reviewMultipartActionDice(a), null);
});
test("review merging preserves conflicting original grant evidence and cannot lose a local hold", async () => {
  const a = actor();
  const row = {
    bonusPoolId: "mp",
    paymentPath: "system.bonusActionDice.mp.remaining",
    poolFingerprint: "old",
    count: 1
  };
  setPendingActionDieReview(a, { id: "older", needsReview: true, payments: [row], markerIds: ["older"] });
  const next = await markMultipartActionDieReview(
    a,
    { id: "newer", payments: [{ ...row, poolFingerprint: "new" }] },
    Error("second failure")
  );
  assert.equal(next.payments.length, 1);
  assert.equal(next.payments[0].conflictingSources.length, 2);
  assert.equal(next.payments[0].poolFingerprint, null);
  assert.deepEqual(next.markerIds, ["older", "newer"]);
});
test("multi-payer GC recovery freezes the related Request attempt and actual posted result, including result-UUID fallback", async () => {
  const a = actor(),
    receiver = {
      uuid: "Actor.receiver",
      system: {
        missionReserves: {
          epoch: "m",
          attempts: { request1: { id: "request1", status: "pending", claimedItemId: "" } }
        }
      }
    };
  game.actors = [receiver];
  a.fail.spentBefore = true;
  const message = {
    uuid: "ChatMessage.request",
    id: "request",
    flags: { spycraft2: { actorUuid: receiver.uuid, rawTotal: 12, gearAttempt: { id: "request1" } } },
    content: "Request",
    rolls: []
  };
  game.messages.set("request", message);
  await pay(a, async () => message, {
    purpose: "Shared Request",
    details: { recipientActorUuid: receiver.uuid, attemptId: "request1" }
  });
  const previous = foundry.applications.api.DialogV2.input;
  for (const change of ["attempt", "message"]) {
    foundry.applications.api.DialogV2.input = async () => {
      if (change === "attempt") receiver.system.missionReserves.attempts.request1.claimedItemId = "claimed";
      else message.content = "Changed result";
      return { balance_0: 2, balance_1: 2, benefitRemains: "true", resolution: "reviewed", healthReviewed: true };
    };
    await assert.rejects(reviewMultipartActionDice(a), /changed/);
  }
  foundry.applications.api.DialogV2.input = previous;
  await confirm(a);
  assert.equal(getActionDieSettlementReview(a).needsReview, false);
  game.actors = [];
  game.messages.clear();
});
test("durable interrupted-payment recovery retains limited-use evidence and freezes its financially linked result", async () => {
  const a = actor(),
    plan = multipartActionDicePlan(a.actionDiceFundingSystem, parts, { id: "interruptedClass", actorUuid: a.uuid }),
    limitedUseSettlement = [{ id: "power", before: null, reserved: { epoch: "s", used: 1 } }],
    record = multipartPaymentRecord(plan, { details: { benefit: "classAbility", limitedUseSettlement } });
  a.flags.spycraft2 = { actionDiePayments: { interruptedClass: record } };
  a.system.resourceUses.power = { epoch: "s", used: 1 };
  const review = getActionDieSettlementReview(a);
  assert.deepEqual(review.limitedUseSettlement, limitedUseSettlement);
  const message = {
    uuid: "ChatMessage.class",
    id: "class",
    flags: { spycraft2: { actorUuid: a.uuid, preRollFunding: { id: record.id }, rawTotal: 10 } },
    content: "Paid class result"
  };
  game.messages.set("class", message);
  const previous = foundry.applications.api.DialogV2.input;
  foundry.applications.api.DialogV2.input = async () => {
    message.content = "Edited during review";
    return { balance_0: 2, balance_1: 2, benefitRemains: "true", resolution: "reviewed", healthReviewed: true };
  };
  await assert.rejects(reviewMultipartActionDice(a), /changed/);
  foundry.applications.api.DialogV2.input = previous;
  await confirm(a, { balances: [3, 4], benefitRemains: false, restoreLimitedUses: true });
  assert.equal(a.system.resourceUses.power, undefined);
  assert.equal(getActionDieSettlementReview(a).needsReview, false);
  game.messages.clear();
});
test("a recovery review freezes both the original and replacement paid-roll records", async () => {
  const a = actor(),
    original = {
      uuid: "ChatMessage.original",
      id: "original",
      flags: { spycraft2: { actorUuid: a.uuid, rawTotal: 10, superseded: "ChatMessage.replacement" } }
    },
    replacement = {
      uuid: "ChatMessage.replacement",
      id: "replacement",
      flags: { spycraft2: { actorUuid: a.uuid, rawTotal: 12 } }
    };
  game.messages.set("original", original);
  game.messages.set("replacement", replacement);
  a.fail.spentBefore = true;
  await pay(a, async () => replacement, { message: original });
  const previous = foundry.applications.api.DialogV2.input;
  foundry.applications.api.DialogV2.input = async () => {
    replacement.flags.spycraft2.rawTotal++;
    return { balance_0: 2, balance_1: 2, benefitRemains: "true", resolution: "reviewed", healthReviewed: true };
  };
  await assert.rejects(reviewMultipartActionDice(a), /changed/);
  foundry.applications.api.DialogV2.input = previous;
  game.messages.clear();
});
