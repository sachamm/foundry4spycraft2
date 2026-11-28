import test from "node:test";
import assert from "node:assert/strict";
import { actionDieAwardPlan, actionDieAwardSummary, missionXPPlan } from "../module/rules/action-dice.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const sys = () => ({
  level: 3,
  xp: 10,
  actionDice: { value: 3, die: 4 },
  activeFeatNames: [],
  actionDieAwards: {},
  missionXPRewards: {},
  usagePeriods: { mission: "m", session: "s" }
});
const award = { count: 2, careerDie: 4, reason: "Clever attempt", mission: "m", session: "s", id: "award", at: 1 };
test("RAW pp.63,397: ordinary awards add player dice, equal GC dice and persistent counts independently of spending", () => {
  const s = sys(),
    plan = actionDieAwardPlan(s, award);
  assert.equal(plan.value, 5);
  assert.equal(plan.gcGain, 2);
  assert.equal(plan.record.count, 2);
  assert.equal(plan.record.events[0].session, "s");
  s.actionDieAwards.m = plan.record;
  s.actionDice.value = 0;
  assert.equal(actionDieAwardSummary(s).count, 2);
  assert.equal(actionDieAwardSummary(s).baseXP, 50);
  s.usagePeriods.mission = "next";
  assert.equal(actionDieAwardSummary(s).count, 0);
  assert.equal(s.actionDieAwards.m.count, 2);
});
test("Fortune Favors the Bold improves each award once; a d12 award becomes two d6 player dice but remains one GC award/XP-count event", () => {
  for (const [base, die, units] of [
    [4, 6, 1],
    [6, 8, 1],
    [8, 10, 1],
    [10, 12, 1],
    [12, 6, 2]
  ]) {
    const s = sys();
    s.activeFeatNames = ["Fortune Favors the Bold"];
    const p = actionDieAwardPlan(s, { ...award, count: 1, careerDie: base });
    assert.equal(p.die, die);
    assert.equal(p.units, units);
    assert.equal(p.gcGain, 1);
    assert.equal(p.record.count, 1);
  }
});
test("award ledgers encode dotted mission identifiers, accumulate distinct events and reject invalid amounts/reasons", () => {
  const s = sys(),
    p = actionDieAwardPlan(s, { ...award, mission: "m.one" });
  assert.equal(p.key, "m%2Eone");
  s.actionDieAwards[p.key] = p.record;
  assert.equal(actionDieAwardPlan(s, { ...award, mission: "m.one", id: "second" }).record.count, 4);
  for (const patch of [
    { count: 0 },
    { count: -1 },
    { count: 1.5 },
    { reason: "" },
    { careerDie: 20 },
    { id: "" },
    { count: Number.MAX_SAFE_INTEGER }
  ])
    assert.throws(() => actionDieAwardPlan(s, { ...award, ...patch }));
});
test("user-confirmed p.440: capped award XP is added to base XP before the lower Career/Threat multiplier", () => {
  const s = { ...sys(), level: 5, actionDieAwards: { m: { count: 2 } } };
  let p = missionXPPlan(s, { baseXP: 1000, threatLevel: 8, mission: "m", missionCompleteConfirmed: true });
  assert.equal(p.record.awardBaseBonus, 50);
  assert.equal(p.record.multiplier, 5);
  assert.equal(p.record.totalXP, 5250);
  s.level = 13;
  s.actionDieAwards.m.count = 20;
  p = missionXPPlan(s, { baseXP: 100, threatLevel: 11, mission: "m", missionCompleteConfirmed: true });
  assert.equal(p.record.awardBaseBonus, 325);
  assert.equal(p.record.multiplier, 11);
  assert.equal(p.record.totalXP, 4675);
});
test("post-multiplier XP is an explicit GC amount; settlement is once per mission and its historical award cap does not grow after later leveling", () => {
  const s = sys();
  s.actionDieAwards.m = { count: 4 };
  const options = {
    baseXP: 100,
    threatLevel: 9,
    additionalXP: 53,
    modifierReason: "Team Triumph, calculated by GC",
    mission: "m",
    missionCompleteConfirmed: true
  };
  const p = missionXPPlan(s, options);
  assert.equal(p.record.coreXP, 525);
  assert.equal(p.record.totalXP, 578);
  s.missionXPRewards.m = p.record;
  s.level = 4;
  assert.equal(actionDieAwardSummary(s).baseXP, 75);
  assert.equal(actionDieAwardSummary(s).settled, true);
  assert.throws(() => missionXPPlan(s, options), /already settled/);
  assert.throws(() => actionDieAwardPlan(s, award), /already settled/);
  for (const patch of [{ missionCompleteConfirmed: false }, { baseXP: -1 }, { threatLevel: 0 }, { modifierReason: "" }])
    assert.throws(() => missionXPPlan(sys(), { ...options, ...patch }));
});
test("a settlement reopened by Resume takes awards again and settles only the difference", () => {
  const s = sys();
  s.actionDieAwards.m = { count: 1, mission: "m" };
  const options = { baseXP: 100, threatLevel: 3, mission: "m", missionCompleteConfirmed: true };
  const first = missionXPPlan(s, options);
  s.missionXPRewards.m = { ...first.record, reopened: true };
  s.xp = first.xp;
  assert.equal(actionDieAwardSummary(s).settled, false);
  // An award after the resume is accepted.
  const more = actionDieAwardPlan(s, award);
  s.actionDieAwards.m = more.record;
  const second = missionXPPlan(s, options);
  assert.equal(second.record.previousTotalXP, first.record.totalXP);
  assert.equal(second.record.gainedXP, second.record.totalXP - first.record.totalXP);
  assert.equal(second.xp, first.xp + second.record.gainedXP);
  assert.equal(second.record.reopened, undefined, "the new record is settled again");
});
let settings,
  posts,
  failPost = false,
  failSetting = false,
  awardSequence = 0;
function reset() {
  settings = { usagePeriods: { mission: "m", session: "s" }, gcActionDice: { session: "s", value: 5 } };
  posts = [];
  failPost = false;
  failSetting = false;
  game.user.isGM = true;
  game.messages = [];
  game.actors = [];
  awardSequence = 0;
}
globalThis.Actor = class {
  constructor() {
    this.name = "Award Agent";
    this.uuid = "Actor.award";
    this.type = "agent";
    this.isOwner = true;
    this.system = sys();
    this.items = [];
  }
  async update(data) {
    for (const [path, value] of Object.entries(data)) {
      const keys = path.split(".");
      let target = this;
      for (const key of keys.slice(0, -1)) target = target[key] ??= {};
      const key = keys.at(-1);
      if (key.startsWith("-=")) delete target[key.slice(2)];
      else target[key] = structuredClone(value);
    }
  }
};
globalThis.game = {
  user: { isGM: true },
  settings: {
    get: (_scope, key) => settings[key],
    set: async (_scope, key, value) => {
      if (failSetting) {
        failSetting = false;
        throw Error("setting rejected");
      }
      settings[key] = structuredClone(value);
      return value;
    }
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.foundry = {
  utils: {
    randomID: () => String(++awardSequence) + "award",
    escapeHTML: s => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  }
};
globalThis.ChatMessage = {
  getSpeaker: () => ({}),
  create: async data => {
    if (failPost) throw Error("post rejected");
    posts.push(data);
    game.messages.push(data);
    return data;
  }
};
globalThis.ui = { notifications: { warn: () => null } };
const { SpycraftActor } = await import("../module/documents/actor.mjs");
// Registers the Undo note a settlement leaves.
const { applyUndo } = await import("../module/apps/undo.mjs");
test("document awards transfer both balances, retain provenance and escape the recorded reason", async () => {
  reset();
  const actor = new SpycraftActor();
  await actor.awardActionDice({ count: 2, reason: "<b>Risky attempt</b>" });
  assert.equal(actor.system.actionDice.value, 5);
  assert.equal(settings.gcActionDice.value, 7);
  assert.equal(actor.system.actionDieAwards.m.count, 2);
  assert.equal(actor.system.xp, 10);
  assert.doesNotMatch(posts[0].content, /<b>/);
  assert.match(posts[0].content, /&lt;b&gt;/);
});
test("a failed award post refunds both pools and deletes its newly absent ObjectField ledger entry", async () => {
  reset();
  const actor = new SpycraftActor();
  failPost = true;
  await assert.rejects(actor.awardActionDice({ count: 1, reason: "Attempt" }), /post rejected/);
  assert.equal(actor.system.actionDice.value, 3);
  assert.equal(settings.gcActionDice.value, 5);
  assert.equal(Object.hasOwn(actor.system.actionDieAwards, "m"), false);
});
test("a failed GC-setting write refunds the character and does not retain an award record", async () => {
  reset();
  const actor = new SpycraftActor();
  failSetting = true;
  await assert.rejects(actor.awardActionDice({ count: 1, reason: "Attempt" }), /setting rejected/);
  assert.equal(actor.system.actionDice.value, 3);
  assert.equal(settings.gcActionDice.value, 5);
  assert.equal(Object.hasOwn(actor.system.actionDieAwards, "m"), false);
});
test("a mission XP settlement leaves an Undo note that takes the XP and the settled mark back off (U5)", async () => {
  reset();
  const actor = new SpycraftActor();
  globalThis.fromUuid = async uuid => (uuid === actor.uuid ? actor : null);
  const options = { baseXP: 100, threatLevel: 3, missionCompleteConfirmed: true };
  await actor.settleMissionXP(options);
  assert.equal(actor.system.xp, 310);
  const data = posts.find(post => post.flags?.spycraft2?.undo);
  assert.equal(data.flags.spycraft2.undo.label, "Mission XP settled: Award Agent");
  const note = { id: "undo", flags: structuredClone(data.flags), update: async () => null };
  await applyUndo(note);
  assert.equal(actor.system.xp, 10);
  assert.equal(Object.hasOwn(actor.system.missionXPRewards, "m"), false, "the mission can be settled again");
  await actor.settleMissionXP({ ...options, baseXP: 200 });
  assert.equal(actor.system.xp, 610);
});
test("settlement applies the p.440 total once, records its components and excludes later awards until a new mission", async () => {
  reset();
  const actor = new SpycraftActor();
  await actor.awardActionDice({ count: 4, reason: "Several attempts" });
  const options = { baseXP: 100, threatLevel: 5, missionCompleteConfirmed: true };
  await actor.settleMissionXP(options);
  assert.equal(actor.system.xp, 535);
  assert.equal(actor.system.missionXPRewards.m.awardBaseBonus, 75);
  await assert.rejects(actor.settleMissionXP(options), /already settled/);
  assert.equal(actor.system.xp, 535);
  await assert.rejects(actor.awardActionDice({ count: 1, reason: "Late award" }), /already settled/);
  assert.equal(settings.gcActionDice.value, 9);
  settings.usagePeriods.mission = "next";
  await actor.awardActionDice({ count: 1, reason: "New mission attempt" });
  assert.equal(actor.system.actionDieAwards.next.count, 1);
  assert.equal(actor.system.actionDieAwards.m.count, 4);
});
test("failed XP posting restores the XP balance and removes the settlement marker so a reviewed retry remains possible", async () => {
  reset();
  const actor = new SpycraftActor();
  actor.system.actionDieAwards.m = { count: 2 };
  failPost = true;
  const options = { baseXP: 100, threatLevel: 3, missionCompleteConfirmed: true };
  await assert.rejects(actor.settleMissionXP(options), /post rejected/);
  assert.equal(actor.system.xp, 10);
  assert.equal(Object.hasOwn(actor.system.missionXPRewards, "m"), false);
  failPost = false;
  await actor.settleMissionXP(options);
  assert.equal(actor.system.xp, 460);
});
test("only the GC may award dice or settle XP, and awards require the session GC pool to be initialized", async () => {
  reset();
  const actor = new SpycraftActor();
  game.user.isGM = false;
  await assert.rejects(actor.awardActionDice({ count: 1, reason: "Attempt" }), /Only the GC/);
  await assert.rejects(actor.settleMissionXP({}), /Only the GC/);
  game.user.isGM = true;
  settings.usagePeriods.session = "new";
  await assert.rejects(actor.awardActionDice({ count: 1, reason: "Attempt" }), /Set up the GC action dice/);
  assert.equal(actor.system.actionDice.value, 3);
});

import { actionDiceFundingContext } from "../module/rules/bonus-pools.mjs";
import { spendGCDice } from "../module/services/gc-dice.mjs";
const awardInput = { count: 1, reason: "QA ordinary award" };
async function pendingAward(kind = "player") {
  reset();
  const a = new SpycraftActor(),
    update = a.update.bind(a),
    set = game.settings.set.bind(game.settings);
  game.actors = [a];
  failPost = true;
  if (kind === "player") {
    a.update = async patch => {
      if (patch["system.actionDice.value"] === 3 && Object.hasOwn(patch, "system.actionDieAwards.-=m"))
        throw Error("player rollback failed");
      return update(patch);
    };
  } else {
    game.settings.set = async (scope, key, value) => {
      if (key === "gcActionDice" && value.value === 5) throw Error("GC rollback failed");
      return set(scope, key, value);
    };
  }
  try {
    await assert.rejects(a.awardActionDice(awardInput), /safely restored/);
  } finally {
    a.update = update;
    game.settings.set = set;
  }
  return a;
}
test("award player-credit failures before commitment leave no gain while committed writes complete one full award", async () => {
  for (const boundary of ["before", "after"]) {
    reset();
    const a = new SpycraftActor(),
      update = a.update.bind(a);
    let once = true;
    a.update = async patch => {
      if (once && patch["system.actionDieAwards.m"]) {
        once = false;
        if (boundary === "after") await update(patch);
        throw Error("player credit error");
      }
      return update(patch);
    };
    if (boundary === "before") await assert.rejects(a.awardActionDice(awardInput), /player credit error/);
    else await a.awardActionDice(awardInput);
    assert.equal(a.system.actionDice.value, boundary === "before" ? 3 : 4);
    assert.equal(settings.gcActionDice.value, boundary === "before" ? 5 : 6);
    assert.equal(a.system.actionDieAwards.m?.count, boundary === "before" ? undefined : 1);
  }
});
test("committed GC-credit and award-post errors retain exactly one player gain, GC gain and mission count", async () => {
  for (const phase of ["gc", "post"]) {
    reset();
    const a = new SpycraftActor(),
      set = game.settings.set,
      post = ChatMessage.create;
    if (phase === "gc")
      game.settings.set = async (...args) => {
        await set(...args);
        throw Error("GC credit committed");
      };
    else
      ChatMessage.create = async data => {
        await post(data);
        throw Error("award post committed");
      };
    try {
      await a.awardActionDice(awardInput);
      assert.equal(a.system.actionDice.value, 4);
      assert.equal(settings.gcActionDice.value, 6);
      assert.equal(a.system.actionDieAwards.m.count, 1);
      assert.equal(posts.length, 1);
    } finally {
      game.settings.set = set;
      ChatMessage.create = post;
    }
  }
});
test("committed player/GC rollback errors are reconciled without retaining a false review or partial award", async () => {
  for (const phase of ["player", "gc"]) {
    reset();
    const a = new SpycraftActor(),
      update = a.update.bind(a),
      set = game.settings.set;
    failPost = true;
    if (phase === "player")
      a.update = async patch => {
        await update(patch);
        if (Object.hasOwn(patch, "system.actionDieAwards.-=m")) throw Error("player refund committed");
      };
    else
      game.settings.set = async (...args) => {
        await set(...args);
        if (args[2].value === 5) throw Error("GC refund committed");
      };
    try {
      await assert.rejects(a.awardActionDice(awardInput), /post rejected/);
      assert.equal(a.system.actionDice.value, 3);
      assert.equal(settings.gcActionDice.value, 5);
      assert.equal(a.system.actionDieAwards.m, undefined);
      assert.equal(a.flags?.spycraft2?.actionDieAwardReview, undefined);
    } finally {
      game.settings.set = set;
    }
  }
});
test("unprovable award rollback retains the actual balances and blocks further awards, spending, GC spending and XP settlement", async () => {
  const a = await pendingAward();
  assert.equal(a.system.actionDice.value, 4);
  assert.equal(settings.gcActionDice.value, 6);
  assert.equal(a.flags.spycraft2.actionDieAwardReview.needsReview, true);
  await assert.rejects(a.awardActionDice(awardInput), /interrupted award/);
  await assert.rejects(a.settleMissionXP({}), /interrupted award/);
  assert.equal(actionDiceFundingContext(a.actionDiceFundingSystem).blocked, true);
  await assert.rejects(
    spendGCDice(1, async () => {}),
    /interrupted player award/
  );
});
test("GC review can retain a proved player/GC award or cancel a GC-only remainder using confirmed absolute balances", async () => {
  for (const retainAward of [true, false]) {
    const a = await pendingAward(retainAward ? "player" : "gc");
    await a.reviewActionDieAward({
      retainAward,
      playerBalance: retainAward ? 4 : 3,
      gcBalance: retainAward ? 6 : 5,
      resolution: "Checked all three records",
      confirmed: true
    });
    assert.equal(a.system.actionDice.value, retainAward ? 4 : 3);
    assert.equal(settings.gcActionDice.value, retainAward ? 6 : 5);
    assert.equal(a.system.actionDieAwards.m?.count, retainAward ? 1 : undefined);
    assert.equal(a.flags.spycraft2.actionDieAwardReview.needsReview, false);
  }
});
test("award review rechecks GC role, both balances and the ledger after its dialog", async () => {
  for (const change of ["role", "gc", "player", "ledger"]) {
    const a = await pendingAward(),
      old = foundry.applications;
    foundry.applications = {
      api: {
        DialogV2: {
          input: async () => {
            if (change === "role") game.user.isGM = false;
            if (change === "gc") settings.gcActionDice.value++;
            if (change === "player") a.system.actionDice.value++;
            if (change === "ledger") a.system.actionDieAwards.m.count++;
            return { retainAward: "retain", playerBalance: 4, gcBalance: 6, resolution: "Review", confirmed: true };
          }
        }
      }
    };
    try {
      await assert.rejects(a.reviewActionDieAward(), change === "role" ? /Only the GC/ : /changed/);
      assert.equal(a.flags.spycraft2.actionDieAwardReview.needsReview, true);
    } finally {
      foundry.applications = old;
      game.user.isGM = true;
    }
  }
});
test("award review rejects malformed balances and edited mission paths without touching other actor fields", async () => {
  let a = await pendingAward();
  for (const invalid of [
    { playerBalance: "" },
    { gcBalance: -1 },
    { gcBalance: 1.5 },
    { confirmed: false },
    { retainAward: null },
    { resolution: "" }
  ])
    await assert.rejects(
      a.reviewActionDieAward({
        retainAward: true,
        playerBalance: 4,
        gcBalance: 6,
        resolution: "Review",
        confirmed: true,
        ...invalid
      }),
      /Confirm/
    );
  a.flags.spycraft2.actionDieAwardReview.transaction.key = "ownership.default";
  await assert.rejects(a.reviewActionDieAward({ confirmed: true }), /saved award source/);
  assert.equal(a.ownership, undefined);
});
test("an interrupted GC reconciliation leaves its review active and retries without duplicating credit or ledger events", async () => {
  const a = await pendingAward(),
    opts = {
      retainAward: false,
      playerBalance: 3,
      gcBalance: 5,
      resolution: "Cancelled incomplete award",
      confirmed: true
    };
  failSetting = true;
  await assert.rejects(a.reviewActionDieAward(opts), /setting rejected/);
  assert.equal(a.system.actionDice.value, 3);
  assert.equal(a.system.actionDieAwards.m, undefined);
  assert.equal(settings.gcActionDice.value, 6);
  assert.equal(a.flags.spycraft2.actionDieAwardReview.needsReview, true);
  await a.reviewActionDieAward(opts);
  assert.equal(settings.gcActionDice.value, 5);
  assert.equal(a.flags.spycraft2.actionDieAwardReview.needsReview, false);
});
test("a committed final review-marker error returns the completed reconciliation rather than inviting a duplicate adjustment", async () => {
  const a = await pendingAward(),
    update = a.update.bind(a);
  a.update = async patch => {
    await update(patch);
    if (patch["flags.spycraft2.actionDieAwardReview"]?.needsReview === false) throw Error("review marker committed");
  };
  const r = await a.reviewActionDieAward({
    retainAward: true,
    playerBalance: 4,
    gcBalance: 6,
    resolution: "Retained the complete award",
    confirmed: true
  });
  assert.equal(r.needsReview, false);
  assert.equal(settings.gcActionDice.value, 6);
  assert.equal(a.system.actionDieAwards.m.events.length, 1);
});

const xpOptions = { baseXP: 100, threatLevel: 3, missionCompleteConfirmed: true };
async function pendingXP() {
  reset();
  const a = new SpycraftActor(),
    update = a.update.bind(a);
  failPost = true;
  a.update = async patch => {
    if (patch["system.xp"] === 10 && Object.hasOwn(patch, "system.missionXPRewards.-=m"))
      throw Error("XP rollback failed");
    return update(patch);
  };
  try {
    await assert.rejects(a.settleMissionXP(xpOptions), /safely restored/);
  } finally {
    a.update = update;
  }
  return a;
}
test("mission XP credit errors before commitment apply nothing, while committed credit writes complete one settlement", async () => {
  for (const boundary of ["before", "after"]) {
    reset();
    const a = new SpycraftActor(),
      update = a.update.bind(a);
    let once = true;
    a.update = async patch => {
      if (once && patch["system.missionXPRewards.m"]) {
        once = false;
        if (boundary === "after") await update(patch);
        throw Error("XP credit boundary");
      }
      return update(patch);
    };
    if (boundary === "before") await assert.rejects(a.settleMissionXP(xpOptions), /XP credit boundary/);
    else await a.settleMissionXP(xpOptions);
    assert.equal(a.system.xp, boundary === "before" ? 10 : 310);
    assert.equal(a.system.missionXPRewards.m?.totalXP, boundary === "before" ? undefined : 300);
  }
});
test("a mission XP receipt committed before an error retains one reward and cannot be settled twice", async () => {
  reset();
  const a = new SpycraftActor(),
    create = ChatMessage.create;
  ChatMessage.create = async data => {
    await create(data);
    throw Error("XP receipt committed");
  };
  try {
    const r = await a.settleMissionXP(xpOptions);
    assert.ok(r.settlementId);
    assert.equal(a.system.xp, 310);
    assert.equal(posts.filter(post => !post.flags?.spycraft2?.undo).length, 1);
    await assert.rejects(a.settleMissionXP(xpOptions), /already settled/);
    assert.equal(a.system.xp, 310);
  } finally {
    ChatMessage.create = create;
  }
});
test("a failed XP post preserves unrelated later XP and reconciles committed rollback errors", async () => {
  for (const variant of ["laterXP", "rollbackCommit"]) {
    reset();
    const a = new SpycraftActor(),
      create = ChatMessage.create,
      update = a.update.bind(a);
    if (variant === "laterXP")
      ChatMessage.create = async () => {
        a.system.xp += 7;
        throw Error("post rejected");
      };
    else {
      failPost = true;
      a.update = async patch => {
        await update(patch);
        if (Object.hasOwn(patch, "system.missionXPRewards.-=m")) throw Error("XP rollback committed");
      };
    }
    try {
      await assert.rejects(a.settleMissionXP(xpOptions), /post rejected/);
      assert.equal(a.system.xp, variant === "laterXP" ? 17 : 10);
      assert.equal(a.system.missionXPRewards.m, undefined);
      assert.equal(a.flags?.spycraft2?.missionXPReview, undefined);
    } finally {
      ChatMessage.create = create;
    }
  }
});
test("an uncertain XP rollback blocks further settlement and awards until GC confirms retention or cancellation", async () => {
  for (const retained of [true, false]) {
    const a = await pendingXP();
    assert.equal(a.system.xp, 310);
    assert.equal(a.flags.spycraft2.missionXPReview.needsReview, true);
    await assert.rejects(a.settleMissionXP(xpOptions), /interrupted mission XP/);
    await assert.rejects(a.awardActionDice(awardInput), /interrupted mission XP/);
    await a.reviewMissionXP({
      retainSettlement: retained,
      xp: retained ? 310 : 10,
      resolution: "Reviewed actual XP and reward",
      confirmed: true
    });
    assert.equal(a.system.xp, retained ? 310 : 10);
    assert.equal(a.system.missionXPRewards.m?.totalXP, retained ? 300 : undefined);
    assert.equal(a.flags.spycraft2.missionXPReview.needsReview, false);
  }
});
test("mission XP input cannot drift into a different mission, level, XP balance or award count while its dialog is open", async () => {
  for (const change of ["mission", "level", "xp", "awards", "role"]) {
    reset();
    const a = new SpycraftActor(),
      old = foundry.applications;
    foundry.applications = {
      api: {
        DialogV2: {
          input: async () => {
            if (change === "mission") settings.usagePeriods.mission = "next";
            if (change === "level") a.system.level++;
            if (change === "xp") a.system.xp++;
            if (change === "awards") a.system.actionDieAwards.m = { count: 1 };
            if (change === "role") game.user.isGM = false;
            return xpOptions;
          }
        }
      }
    };
    try {
      await assert.rejects(a.settleMissionXP(), change === "role" ? /Only the GC/ : /changed/);
      assert.equal(Object.keys(a.system.missionXPRewards).length, 0);
    } finally {
      foundry.applications = old;
      game.user.isGM = true;
    }
  }
});
test("XP reconciliation rejects malformed saved formulas, edited paths and changed evidence", async () => {
  for (const invalid of ["formula", "path", "dialog"]) {
    const a = await pendingXP(),
      old = foundry.applications;
    if (invalid === "formula") a.flags.spycraft2.missionXPReview.transaction.record.totalXP++;
    if (invalid === "path") a.flags.spycraft2.missionXPReview.transaction.key = "ownership.default";
    if (invalid === "dialog")
      foundry.applications = {
        api: {
          DialogV2: {
            input: async () => {
              a.system.xp++;
              return { retainSettlement: "retain", xp: 310, resolution: "Review", confirmed: true };
            }
          }
        }
      };
    try {
      await assert.rejects(
        a.reviewMissionXP(
          invalid === "dialog" ? {} : { retainSettlement: true, xp: 310, resolution: "Review", confirmed: true }
        ),
        invalid === "formula" ? /formula is invalid/ : invalid === "path" ? /saved mission XP source/ : /changed/
      );
      assert.equal(a.flags.spycraft2.missionXPReview.needsReview, true);
      assert.equal(a.ownership, undefined);
    } finally {
      foundry.applications = old;
    }
  }
});
test("a committed atomic XP-review write returns the reconciliation once without adding XP again", async () => {
  const a = await pendingXP(),
    update = a.update.bind(a);
  a.update = async patch => {
    await update(patch);
    if (patch["flags.spycraft2.missionXPReview"]?.needsReview === false) throw Error("XP review committed");
  };
  const r = await a.reviewMissionXP({
    retainSettlement: true,
    xp: 310,
    resolution: "Retain verified settlement",
    confirmed: true
  });
  assert.equal(r.needsReview, false);
  assert.equal(a.system.xp, 310);
  assert.equal(a.system.missionXPRewards.m.totalXP, 300);
});
