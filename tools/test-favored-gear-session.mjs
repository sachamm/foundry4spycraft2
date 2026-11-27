import test from "node:test";
import assert from "node:assert/strict";
import {
  favoredGearSessionPlan,
  favoredGearSessionItems,
  favoredGearReviewPlan,
  favoredGearPoolStatus,
  favoredGearAccess,
  favoredPeriodKey
} from "../module/rules/favored-gear-session.mjs";
import { settleFavoredGearSession, reviewFavoredGearSession } from "../module/apps/favored-gear-session.mjs";
import { bonusPoolForCheck, actionDiceFundingContext, possessedActionDice } from "../module/rules/bonus-pools.mjs";
import { actionDieBenefitQuote } from "../module/rules/benefit-payments.mjs";
import { multipartActionDicePlan } from "../module/rules/action-die-payments.mjs";

function fixture(calibers = [1, 3]) {
  const items = calibers.map((caliber, i) => ({
    id: `gear${i}`,
    uuid: `Actor.a.Item.gear${i}`,
    name: `Gear ${i}`,
    type: i ? "armor" : "weapon",
    system: { caliber, possessionSource: "favoredGear", possessionApproved: true }
  }));
  const system = {
    actorUuid: "Actor.a",
    level: 9,
    activeFeatSelections: items.map(() => ({ name: "Favored Gear" })),
    activeFeatNames: ["Favored Gear"],
    actionDice: { die: 6, value: 5 },
    worldTime: 10,
    usagePeriods: { session: "s1", mission: "m1" },
    bonusActionDice: {},
    favoredGearSources: items
  };
  const settle = (options = {}) => {
    const plan = favoredGearSessionPlan(system, items, {
      id: "receipt",
      actorUuid: "Actor.a",
      missionCaliber: 2,
      careerDie: system.actionDice.die,
      choices: { [items[1]?.uuid]: "pay" },
      ...options
    });
    system.favoredGearSessions = { [favoredPeriodKey(plan.session)]: plan };
    system.favoredGearForfeits = plan.forfeits;
    system.bonusActionDice = plan.pools;
    system.actionDice.value = plan.afterBalance;
    return plan;
  };
  return { items, system, settle };
}
const check = (item, patch = {}) => ({
  actorUuid: "Actor.a",
  checkKind: "skill",
  skillKey: "mechanics",
  gearUuid: item.uuid,
  resolved: false,
  ...patch
});
test("ordinary catalog and reference items without UUIDs need no Favored Gear record", () => {
  assert.equal(favoredGearAccess({}, undefined, { caliber: 1 }), "");
});
test("Favored Gear compares actual mission and item Calibers, with separate bonus wallets and exact ordinary discards", () => {
  const f = fixture(),
    plan = f.settle();
  assert.equal(plan.discarded, 1);
  assert.equal(plan.afterBalance, 4);
  assert.equal(plan.items[0].status, "bonus");
  assert.equal(plan.items[1].status, "paid");
  assert.equal(plan.pools.receipt_0.granted, 1);
  assert.equal(plan.pools.receipt_0.die, 6);
  assert.equal(plan.pools.receipt_0.itemUuid, f.items[0].uuid);
  assert.throws(() => f.settle(), /already has a record/);
  assert.equal(f.system.actionDice.value, 4);
});
test("every positive difference is specific to its favored item", () => {
  const f = fixture([1, 2]),
    plan = f.settle({ missionCaliber: 4 });
  assert.equal(plan.pools.receipt_0.granted, 3);
  assert.equal(plan.pools.receipt_1.granted, 2);
  assert.equal(favoredGearPoolStatus(f.system, "receipt_0", { check: check(f.items[0]) }).available, 3);
  assert.equal(favoredGearPoolStatus(f.system, "receipt_0", { check: check(f.items[1]) }).available, 0);
  assert.equal(favoredGearPoolStatus(f.system, "receipt_1", { check: check(f.items[1]) }).available, 2);
});
test("favored dice boost skill checks and activate item threats, but do not boost attacks or damage", () => {
  const f = fixture([1]);
  f.settle();
  for (const kind of ["attack", "damage", "knowledge", "save"])
    assert.equal(
      favoredGearPoolStatus(f.system, "receipt_0", {
        check: check(f.items[0], { checkKind: kind, weaponUuid: f.items[0].uuid })
      }).available,
      0,
      kind
    );
  const attack = check(f.items[0], {
    checkKind: "attack",
    weaponUuid: f.items[0].uuid,
    successConfirmed: true,
    threatConfirmed: true
  });
  assert.equal(favoredGearPoolStatus(f.system, "receipt_0", { check: attack, purpose: "threat" }).available, 1);
  assert.equal(favoredGearPoolStatus(f.system, "receipt_0", { check: attack, purpose: "surcharge" }).available, 0);
  assert.equal(
    favoredGearPoolStatus(f.system, "receipt_0", { check: { ...attack, threatConfirmed: false }, purpose: "threat" })
      .available,
    0
  );
});
test("forfeiting a higher-Caliber item preserves dice and denies access throughout the mission", () => {
  const f = fixture([3]),
    plan = f.settle({ choices: { [f.items[0].uuid]: "forfeit" } });
  assert.equal(plan.discarded, 0);
  assert.equal(plan.afterBalance, 5);
  assert.match(favoredGearAccess(f.system, f.items[0].uuid, f.items[0].system), /forfeited/);
  f.system.usagePeriods.session = "s2";
  const next = favoredGearSessionPlan(f.system, f.items, {
    id: "next",
    actorUuid: "Actor.a",
    missionCaliber: 4,
    careerDie: 6
  });
  assert.equal(next.items[0].status, "unavailable");
  assert.deepEqual(next.pools, {});
  f.items[0].system.possessionSource = "wealth";
  assert.match(favoredGearAccess(f.system, f.items[0].uuid, f.items[0].system), /forfeited/);
  f.system.usagePeriods.mission = "m2";
  assert.equal(favoredGearAccess(f.system, f.items[0].uuid, f.items[0].system), "");
});
test("equal Calibers have neither payment nor bonus, and insufficient ordinary dice require an explicit forfeiture choice", () => {
  const f = fixture([3]);
  f.system.actionDice.value = 0;
  assert.throws(() => f.settle({ choices: { [f.items[0].uuid]: "pay" } }), /Not enough/);
  assert.throws(() => f.settle({ choices: {} }), /Choose whether/);
  assert.equal(f.settle({ missionCaliber: 3 }).items[0].status, "equal");
});
test("Fortune Favors the Bold improves only the awarded item wallets and preserves d12 conversion", () => {
  for (const [base, die, multiplier] of [
    [4, 6, 1],
    [6, 8, 1],
    [8, 10, 1],
    [10, 12, 1],
    [12, 6, 2]
  ]) {
    const f = fixture([1]);
    f.system.actionDice.die = base;
    f.system.activeFeatNames.push("Fortune Favors the Bold");
    const pool = f.settle({ missionCaliber: 3 }).pools.receipt_0;
    assert.equal(pool.die, die);
    assert.equal(pool.granted, 2 * multiplier);
    assert.equal(favoredGearPoolStatus(f.system, pool.id, { check: check(f.items[0]) }).available, 2 * multiplier);
  }
});
test("grants expire at session end, survive mission changes in the same session and retain their actual historical die", () => {
  const f = fixture([1]);
  f.settle();
  f.system.actionDice.die = 10;
  f.system.usagePeriods.mission = "m2";
  assert.equal(favoredGearPoolStatus(f.system, "receipt_0", { check: check(f.items[0]) }).die, 6);
  assert.equal(favoredGearPoolStatus(f.system, "receipt_0", { check: check(f.items[0]) }).available, 1);
  f.system.usagePeriods.session = "s2";
  const expired = favoredGearPoolStatus(f.system, "receipt_0", { check: check(f.items[0]) });
  assert.equal(expired.available, 0);
  assert.equal(expired.needsReview, false);
  assert.match(expired.reason, /expired/);
});
test("removed approval, changed ownership, removed feats, superseded or closed checks cannot spend favored dice", () => {
  for (const mutate of [
    f => {
      f.items[0].system.possessionApproved = false;
    },
    f => {
      f.system.actorUuid = "Actor.other";
    },
    f => {
      f.system.activeFeatSelections = [];
    },
    f => {
      f.items[0].system.caliber = 2;
    }
  ]) {
    const f = fixture([1]);
    f.settle();
    mutate(f);
    assert.equal(favoredGearPoolStatus(f.system, "receipt_0", { check: check(f.items[0]) }).available, 0);
  }
  for (const patch of [
    { actorUuid: "Actor.other" },
    { resolved: true },
    { superseded: true },
    { criticalFailure: true }
  ]) {
    const f = fixture([1]);
    f.settle();
    assert.equal(favoredGearPoolStatus(f.system, "receipt_0", { check: check(f.items[0], patch) }).available, 0);
  }
});
test("unknown historical pools, invalid grades, missing approval or excess favored selections require review", () => {
  for (const mutate of [
    f => {
      f.items[0].system.caliber = 4;
    },
    f => {
      f.items[0].system.caliber = 0;
    },
    f => {
      f.items[0].system.possessionApproved = false;
    },
    f => {
      f.items[0].system.pick = "W";
    },
    f => {
      f.system.activeFeatSelections = [];
    }
  ]) {
    const f = fixture([1]);
    mutate(f);
    assert.throws(() => favoredGearSessionItems(f.system, f.items, 2));
  }
  const f = fixture([1]);
  f.settle();
  f.system.favoredGearSessions.s1.items = {};
  const status = favoredGearPoolStatus(f.system, "receipt_0", { check: check(f.items[0]) });
  assert.equal(status.available, 0);
  assert.equal(status.needsReview, true);
});

test("generic funding rejects restricted item dice while skill boosts and actual threat payments can use them", () => {
  const f = fixture([1]);
  f.settle();
  const skill = { uuid: "ChatMessage.skill", flags: { spycraft2: check(f.items[0], { rawTotal: 25 }) } };
  assert.equal(bonusPoolForCheck(f.system, "receipt_0", skill).available, 1);
  assert.equal(actionDiceFundingContext(f.system, { bonusPoolId: "receipt_0" }).blocked, true);
  const message = {
    uuid: "ChatMessage.threat",
    flags: {
      spycraft2: check(f.items[0], {
        checkKind: "attack",
        weaponUuid: f.items[0].uuid,
        rawTotal: 25,
        successConfirmed: true,
        threatConfirmed: true
      })
    }
  };
  const funding = actionDiceFundingContext(f.system, { bonusPoolId: "receipt_0", message, purpose: "threat" });
  assert.equal(funding.balance, 1);
  const paid = multipartActionDicePlan(f.system, [{ bonusPoolId: "receipt_0", count: 1, scope: "threat" }], {
    id: "pay",
    actorUuid: "Actor.a",
    message
  });
  assert.equal(paid.payments[0].afterBalance, 0);
  assert.equal(possessedActionDice(f.system).total, 6);
});
test("critical payment quotes confine favored dice to the base threat cost and ordinary dice to Shaken fees", () => {
  const f = fixture([1]);
  f.settle();
  f.system.conditionContext = { shakenGrade: 2 };
  const actor = { uuid: "Actor.a", actionDiceFundingSystem: f.system, usagePeriods: f.system.usagePeriods };
  const message = {
    uuid: "ChatMessage.threat",
    flags: { spycraft2: check(f.items[0], { rawTotal: 25, successConfirmed: true, threatConfirmed: true }) }
  };
  const quote = actionDieBenefitQuote(actor, {
    baseCost: 1,
    benefit: "criticalSuccess",
    message,
    bonusPoolId: "receipt_0"
  });
  assert.equal(quote.allocations[0].scope, "threat");
  assert.equal(quote.surcharge, 1);
  assert.equal(quote.allocations[1].bonusPoolId, "");
  assert.equal(quote.allocations[1].scope, "surcharge");
  assert.throws(() =>
    actionDieBenefitQuote(actor, { baseCost: 1, benefit: "criticalFailure", message, bonusPoolId: "receipt_0" })
  );
  assert.throws(() =>
    actionDieBenefitQuote(actor, { baseCost: 1, benefit: "healing", message, bonusPoolId: "receipt_0" })
  );
});

function controllerFixture() {
  const f = fixture();
  let serial = 0,
    writes = 0;
  const notes = [];
  globalThis.game = { ready: false, user: { id: "gc", isGM: true }, combats: [], settings: { get: () => ({}) } };
  globalThis.CONFIG = { SPYCRAFT: { tables: { levels: { 9: { actionDie: 6 } } } } };
  globalThis.foundry = {
    utils: { randomID: () => `id${++serial}`, escapeHTML: String },
    applications: { api: { DialogV2: { input: async () => null } } }
  };
  globalThis.ChatMessage = {
    getWhisperRecipients: () => [],
    create: async data => {
      notes.push(data);
      return data;
    }
  };
  const a = {
    uuid: "Actor.a",
    name: "Agent",
    type: "agent",
    isOwner: true,
    flags: {},
    effects: [],
    items: f.items,
    system: f.system,
    usagePeriods: f.system.usagePeriods,
    async update(patch) {
      writes++;
      for (const [path, value] of Object.entries(patch)) {
        const keys = path.split(".");
        let node = this;
        for (const key of keys.slice(0, -1)) node = node[key] ??= {};
        const key = keys.at(-1);
        if (key.startsWith("-=")) delete node[key.slice(2)];
        else node[key] = structuredClone(value);
      }
      return this;
    }
  };
  Object.defineProperty(a, "actionDiceFundingSystem", {
    get: () => ({
      ...a.system,
      favoredGearSessions: a.flags.spycraft2?.favoredGearSessions ?? {},
      favoredGearForfeits: a.flags.spycraft2?.favoredGearForfeits ?? {},
      favoredGearSources: a.items
    })
  });
  const options = { missionCaliber: 2, fresh: true, choices: { [f.items[1].uuid]: "pay" } };
  return { ...f, a, notes, options, writes: () => writes, record: () => a.flags.spycraft2?.favoredGearSessions?.s1 };
}
test("the controller reserves access then atomically settles every favored wallet and ordinary discard once", async () => {
  const f = controllerFixture(),
    receipt = await settleFavoredGearSession(f.a, f.options);
  assert.equal(receipt.state, "complete");
  assert.equal(f.a.system.actionDice.value, 4);
  assert.equal(f.a.system.bonusActionDice.id1_0.remaining, 1);
  assert.equal(f.writes(), 2);
  assert.equal(f.notes.length, 1);
  assert.deepEqual(await settleFavoredGearSession(f.a, f.options), receipt);
  assert.equal(f.writes(), 2);
});
test("rejected completion leaves favored items held; retry finishes the same reservation without duplicate grants", async () => {
  const f = controllerFixture(),
    update = f.a.update.bind(f.a);
  let rejected = false;
  f.a.update = async patch => {
    if (Object.values(patch).some(v => v?.state === "complete") && !rejected) {
      rejected = true;
      throw Error("rejected");
    }
    return update(patch);
  };
  await assert.rejects(settleFavoredGearSession(f.a, f.options), /rejected/);
  assert.equal(f.record().state, "pending");
  assert.equal(f.a.system.actionDice.value, 5);
  assert.match(favoredGearAccess(f.a.actionDiceFundingSystem, f.items[0].uuid, f.items[0].system), /Settle/);
  await settleFavoredGearSession(f.a, f.options);
  assert.equal(f.record().id, "id1");
  assert.equal(f.a.system.actionDice.value, 4);
});
test("lost responses after either write are proved from the retained receipt and every actual balance", async () => {
  const f = controllerFixture(),
    update = f.a.update.bind(f.a);
  f.a.update = async patch => {
    await update(patch);
    throw Error("committed response lost");
  };
  await settleFavoredGearSession(f.a, f.options);
  assert.equal(f.record().state, "complete");
  assert.equal(f.writes(), 2);
  assert.equal(f.a.system.actionDice.value, 4);
});
test("cancelled cost choices retain the pending access hold and can be completed later", async () => {
  const f = controllerFixture();
  await settleFavoredGearSession(f.a, { missionCaliber: 2, fresh: true });
  assert.equal(f.record().state, "pending");
  assert.equal(f.a.system.actionDice.value, 5);
  await settleFavoredGearSession(f.a, f.options);
  assert.equal(f.record().state, "complete");
});
test("simultaneous session settlement attempts create one receipt and spend only once", async () => {
  const f = controllerFixture();
  const [a, b] = await Promise.all([
    settleFavoredGearSession(f.a, f.options),
    settleFavoredGearSession(f.a, f.options)
  ]);
  assert.equal(a.id, b.id);
  assert.equal(f.writes(), 2);
  assert.equal(f.a.system.actionDice.value, 4);
});
test("a pending session marker holds favored gear before its settlement dialog starts", () => {
  const f = fixture([1]);
  f.system.favoredGearPendingSession = "s1";
  assert.match(favoredGearAccess(f.system, f.items[0].uuid, f.items[0].system), /Settle/);
  f.system.usagePeriods.session = "s2";
  assert.equal(favoredGearAccess(f.system, f.items[0].uuid, f.items[0].system), "");
});

const reviewInput = f => ({
  missionCaliber: 2,
  careerLevel: 9,
  ordinaryBalance: f.a.system.actionDice.value,
  rows: [
    { itemUuid: f.items[0].uuid, mode: "available", die: 6, remaining: 1 },
    { itemUuid: f.items[1].uuid, mode: "pay" }
  ],
  note: "Actual balances and prior item fees reviewed",
  confirmed: true
});
test("GC review separates actual wallets, preserves earlier evidence and does not reapply historical discards", async () => {
  const f = controllerFixture(),
    original = await settleFavoredGearSession(f.a, f.options),
    balance = f.a.system.actionDice.value;
  const result = await reviewFavoredGearSession(f.a, reviewInput(f));
  assert.equal(f.a.system.actionDice.value, balance);
  assert.equal(result.discarded, 0);
  assert.equal(result.reviewedDiscarded, 1);
  assert.equal(f.a.system.bonusActionDice.id1_0.remaining, 0);
  assert.equal(f.a.system.bonusActionDice[`${result.id}_0`].remaining, 1);
  assert.equal(f.a.flags.spycraft2.favoredGearReviews[result.id].record.id, original.id);
  assert.equal(possessedActionDice(f.a.actionDiceFundingSystem).total, balance + 1);
});
test("a GC correction can reconcile a mistaken forfeiture with actual paid history and keeps its original evidence", async () => {
  const f = controllerFixture();
  await settleFavoredGearSession(f.a, { ...f.options, choices: { [f.items[1].uuid]: "forfeit" } });
  const original = f.record().id;
  assert.ok(f.a.flags.spycraft2.favoredGearForfeits[favoredPeriodKey(f.items[1].uuid)]);
  const result = await reviewFavoredGearSession(f.a, { ...reviewInput(f), ordinaryBalance: 4 });
  assert.equal(f.a.flags.spycraft2.favoredGearForfeits[favoredPeriodKey(f.items[1].uuid)], undefined);
  assert.equal(f.a.flags.spycraft2.favoredGearReviews[result.id].record.id, original);
  assert.equal(f.a.system.actionDice.value, 4);
});
test("lost review responses preserve the actual wallet writes, original evidence and removal of an obsolete forfeiture", async () => {
  const f = controllerFixture();
  await settleFavoredGearSession(f.a, { ...f.options, choices: { [f.items[1].uuid]: "forfeit" } });
  const update = f.a.update.bind(f.a);
  f.a.update = async patch => {
    await update(patch);
    throw Error("response lost");
  };
  const result = await reviewFavoredGearSession(f.a, { ...reviewInput(f), ordinaryBalance: 4 });
  assert.equal(result.review.reviewerId, "gc");
  assert.equal(f.a.system.actionDice.value, 4);
});
test("manual-history review requires actual complete values and a GC attestation", async () => {
  for (const patch of [
    { ordinaryBalance: "" },
    { ordinaryBalance: -1 },
    { note: "" },
    { confirmed: false },
    { careerLevel: "" },
    { rows: [] }
  ]) {
    const f = controllerFixture();
    await assert.rejects(reviewFavoredGearSession(f.a, { ...reviewInput(f), ...patch }));
    assert.equal(f.a.system.actionDice.value, 5);
  }
  const f = controllerFixture();
  game.user.isGM = false;
  await assert.rejects(reviewFavoredGearSession(f.a, reviewInput(f)), /owning GC/);
});
test("reviewed historical die types retain their actual Bold improvement and cannot invent extra dice", () => {
  const f = fixture([1]);
  f.system.actionDice.die = 12;
  const options = {
    id: "history",
    actorUuid: "Actor.a",
    missionCaliber: 3,
    careerDie: 10,
    ordinaryBalance: 3,
    rows: [{ itemUuid: f.items[0].uuid, mode: "available", die: 12, remaining: 2 }],
    note: "Original session type reviewed",
    reviewerId: "gc"
  };
  const reviewed = favoredGearReviewPlan(f.system, f.items, options);
  assert.equal(reviewed.pools.history_0.die, 12);
  assert.equal(reviewed.pools.history_0.granted, 2);
  assert.throws(() =>
    favoredGearReviewPlan(f.system, f.items, { ...options, rows: [{ ...options.rows[0], remaining: 3 }] })
  );
  assert.throws(() => favoredGearReviewPlan(f.system, f.items, { ...options, rows: [{ ...options.rows[0], die: 6 }] }));
});
