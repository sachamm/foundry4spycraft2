import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  careerAgentMissionKey,
  careerAgentRewardPlan,
  getCareerAgentReview,
  careerAgentReviewPlan
} from "../module/rules/career-agent.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const confirmed = { missionCompleteConfirmed: true, activeAtMissionEndConfirmed: true },
  source = (affiliationType = "faction") => ({
    activeFeatNames: ["Career Agent"],
    affiliationType,
    reputation: 2,
    netWorth: 100000,
    careerAgentRewards: {},
    usagePeriods: { mission: "m" }
  });
test("Career Agent grants the affiliation-specific additional resource, never an arbitrary alternative, and records one reward per mission", () => {
  for (const [type, field, amount] of [
    ["faction", "reputation", 1],
    ["freelance", "netWorth", 50000]
  ]) {
    const s = source(type),
      before = structuredClone(s),
      p = careerAgentRewardPlan(s, {
        ...confirmed,
        id: "reward",
        choice: field === "reputation" ? "netWorth" : "reputation"
      });
    assert.equal(p.field, field);
    assert.equal(p.after, s[field] + amount);
    assert.equal(p.record.amount, amount);
    assert.deepEqual(s, before);
    s.careerAgentRewards[p.key] = p.record;
    assert.throws(() => careerAgentRewardPlan(s, { ...confirmed, id: "another" }), /already recorded/);
    s.affiliationType = type === "faction" ? "freelance" : "faction";
    assert.throws(() => careerAgentRewardPlan(s, { ...confirmed, id: "another" }), /already recorded/);
    s.usagePeriods.mission = "next";
    assert.doesNotThrow(() => careerAgentRewardPlan(s, { ...confirmed, id: "another" }));
  }
  for (const mission of ["a.b", "__proto__", "a/b", "constructor"]) {
    const key = careerAgentMissionKey({ ...source(), usagePeriods: { mission } });
    assert.ok(key.startsWith("mission_"));
    assert.equal(key.includes("."), false);
  }
});
test("the mission and active-at-end confirmations must be explicit; invalid source, affiliation and unsafe balances do not grant anything", () => {
  for (const patch of [
    { missionCompleteConfirmed: false },
    { missionCompleteConfirmed: "true" },
    { activeAtMissionEndConfirmed: 1 },
    { id: "unsafe.path" }
  ])
    assert.throws(() => careerAgentRewardPlan(source(), { ...confirmed, id: "r", ...patch }));
  for (const patch of [
    { activeFeatNames: [] },
    { affiliationType: "hybrid" },
    { reputation: NaN },
    { reputation: 1.5 },
    { reputation: Number.MAX_SAFE_INTEGER }
  ])
    assert.throws(() => careerAgentRewardPlan({ ...source(), ...patch }, { ...confirmed, id: "r" }));
  assert.equal(careerAgentRewardPlan({ ...source(), reputation: -2 }, { ...confirmed, id: "r" }).after, -1);
});
test("Career Agent retains exactly one insight bonus to all three saves at every earned level and duplicates do not stack", () => {
  const definition = JSON.parse(readFileSync(new URL("../src/data/feats.json", import.meta.url))).find(
      f => f.name === "Career Agent"
    ),
    feat = {
      id: "career",
      name: "Career Agent",
      type: "feat",
      system: { ...definition, tree: "tradecraft", acquiredAtLevel: 6 }
    },
    cls = {
      id: "test",
      name: "Test",
      type: "class",
      system: {
        identifier: "test",
        skillPoints: 4,
        vitalityDie: 6,
        classSkills: [],
        table: Array.from({ length: 20 }, (_, i) => ({ level: i + 1, fort: 2, ref: 2, will: 2 }))
      }
    },
    raw = level => ({
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
      progression: Array.from({ length: level }, () => ({ classId: "test", vitality: 1, skills: {} }))
    });
  for (let level = 1; level <= 20; level++) {
    const b = computeAgent(raw(level), [cls], cfg),
      s = computeAgent(raw(level), [cls, feat, { ...feat, id: "duplicate" }], cfg);
    for (const save of ["fort", "ref", "will"])
      assert.equal(s.saves[save].total, b.saves[save].total + (level >= 6 ? 1 : 0));
  }
});
let serial = 0,
  mission = "m",
  posts = [],
  mode = "",
  failPost = false,
  commitPost = false,
  postHook = null,
  dialogHook = null;
function apply(a, patch) {
  for (const [path, value] of Object.entries(patch)) {
    const keys = path.split(".");
    let o = a;
    for (const key of keys.slice(0, -1)) o = o[key] ??= {};
    const last = keys.at(-1);
    if (last.startsWith("-=")) delete o[last.slice(2)];
    else o[last] = structuredClone(value);
  }
}
globalThis.Actor = class {
  constructor() {
    this.uuid = "Actor.career" + ++serial;
    this.type = "agent";
    this.isOwner = true;
    this.items = new Map();
    this.flags = {};
    this.system = source();
  }
  async update(p) {
    const claim = Object.keys(p).some(k => k.startsWith("system.careerAgentRewards.") && !k.includes(".-=")),
      rollback = Object.keys(p).some(k => k.startsWith("system.careerAgentRewards.-=")),
      review = p["flags.spycraft2.careerAgentRewardReview"]?.needsReview === false;
    if (claim && mode === "reject") throw Error("write rejected");
    if (rollback && mode === "rollbackReject") throw Error("rollback rejected");
    if (review && mode === "reviewPartial") {
      apply(this, { "flags.spycraft2.careerAgentRewardReview": p["flags.spycraft2.careerAgentRewardReview"] });
      throw Error("review partial");
    }
    if (claim && ["balanceOnly", "recordOnly", "softBalanceOnly"].includes(mode)) {
      apply(
        this,
        Object.fromEntries(
          Object.entries(p).filter(([k]) =>
            mode === "recordOnly"
              ? k.startsWith("system.careerAgentRewards.")
              : !k.startsWith("system.careerAgentRewards.")
          )
        )
      );
      if (mode !== "softBalanceOnly") throw Error("partial write");
      return this;
    }
    apply(this, p);
    if (claim && mode === "commitThrow") throw Error("committed write");
    return this;
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = {
  user: { isGM: true, id: "gc" },
  settings: { get: () => ({ mission }) },
  time: { worldTime: 126 },
  messages: { find: fn => posts.find(fn) }
};
globalThis.foundry = {
  utils: { randomID: () => `reward${++serial}`, escapeHTML: String },
  applications: { api: { DialogV2: { input: async () => dialogHook?.() ?? null } } }
};
globalThis.ui = { notifications: { warn: () => ({ native: true }) } };
globalThis.ChatMessage = {
  getSpeaker: () => ({}),
  create: async d => {
    await postHook?.();
    if (commitPost) {
      posts.push(d);
      throw Error("committed post");
    }
    if (failPost) throw Error("post failed");
    posts.push(d);
    return d;
  }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");
function actor(type = "faction") {
  mission = "m";
  posts = [];
  mode = "";
  failPost = false;
  commitPost = false;
  postHook = null;
  dialogHook = null;
  game.user.isGM = true;
  game.spycraft2 = {};
  const a = new SpycraftActor();
  a.system.affiliationType = type;
  return a;
}
test("actual queued concurrent claims grant once; source reacquisition and affiliation changes cannot claim twice", async () => {
  for (const type of ["faction", "freelance"]) {
    const a = actor(type),
      results = await Promise.allSettled([a.useCareerAgentReward(confirmed), a.useCareerAgentReward(confirmed)]);
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    assert.equal(posts.length, 1);
    assert.equal(a.system.reputation, type === "faction" ? 3 : 2);
    assert.equal(a.system.netWorth, type === "freelance" ? 150000 : 100000);
    a.system.activeFeatNames = [];
    await assert.rejects(a.useCareerAgentReward(confirmed), /active/);
    a.system.activeFeatNames = ["Career Agent"];
    a.system.affiliationType = type === "faction" ? "freelance" : "faction";
    await assert.rejects(a.useCareerAgentReward(confirmed), /recorded/);
    mission = "next";
    await a.useCareerAgentReward(confirmed);
    assert.equal(Object.keys(a.system.careerAgentRewards).length, 2);
  }
});
test("cancellation and changed dialog context spend nothing; only the owning GC may settle the reward", async () => {
  const a = actor();
  assert.equal(await a.useCareerAgentReward(), null);
  assert.deepEqual(a.system.careerAgentRewards, {});
  for (const change of [
    () => {
      a.system.reputation++;
    },
    () => {
      mission = "later";
    },
    () => {
      a.system.activeFeatNames = [];
    },
    () => {
      a.system.affiliationType = "freelance";
    }
  ]) {
    a.system = source();
    mission = "m";
    dialogHook = () => {
      change();
      return confirmed;
    };
    await assert.rejects(a.useCareerAgentReward(), /changed|active/);
    assert.deepEqual(a.system.careerAgentRewards, {});
  }
  game.user.isGM = false;
  await assert.rejects(a.useCareerAgentReward(confirmed), /owning GC/);
  game.user.isGM = true;
  a.isOwner = false;
  await assert.rejects(a.useCareerAgentReward(confirmed), /owning GC/);
});
test("rejected writes and failed posts restore resources; committed write or receipt errors never grant twice", async () => {
  for (const failure of ["reject", "post", "commitThrow", "committedPost"]) {
    const a = actor();
    mode = failure === "reject" || failure === "commitThrow" ? failure : "";
    failPost = failure === "post";
    commitPost = failure === "committedPost";
    if (["reject", "post"].includes(failure)) {
      await assert.rejects(a.useCareerAgentReward(confirmed), /rejected|failed/);
      assert.equal(a.system.reputation, 2);
      assert.deepEqual(a.system.careerAgentRewards, {});
    } else {
      await a.useCareerAgentReward(confirmed);
      assert.equal(a.system.reputation, 3);
      assert.equal(Object.keys(a.system.careerAgentRewards).length, 1);
      assert.equal(posts.length, 1);
      await assert.rejects(a.useCareerAgentReward(confirmed), /recorded/);
    }
  }
});
test("partial or silently incomplete writes, changed posted balances and failed rollback hold a bounded GC review instead of repeating the grant", async () => {
  for (const failure of ["balanceOnly", "recordOnly", "softBalanceOnly", "rollbackReject", "changedBalance"]) {
    const a = actor();
    mode = failure;
    failPost = ["rollbackReject", "changedBalance"].includes(failure);
    if (failure === "changedBalance")
      postHook = () => {
        a.system.reputation++;
      };
    const r = await a.useCareerAgentReward(confirmed);
    assert.equal(r.needsReview, true, failure);
    assert.equal(getCareerAgentReview(a).needsReview, true);
    await assert.rejects(a.useCareerAgentReward(confirmed), /Review/);
  }
});
test("GC review records the confirmed final balances without adding a second reward, and clearing a cancelled grant permits a later actual claim", async () => {
  for (const retainReward of [true, false]) {
    const a = actor();
    mode = "balanceOnly";
    await a.useCareerAgentReward(confirmed);
    mode = "";
    failPost = false;
    const final = retainReward ? 3 : 2;
    await a.reviewCareerAgentReward({
      reputation: final,
      netWorth: 100000,
      retainReward,
      reason: "Confirmed actual balance and mission receipt",
      confirmed: true
    });
    assert.equal(a.system.reputation, final);
    assert.equal(getCareerAgentReview(a).needsReview, false);
    assert.equal(Object.keys(a.system.careerAgentRewards).length, retainReward ? 1 : 0);
    if (retainReward) await assert.rejects(a.useCareerAgentReward(confirmed), /recorded/);
    else {
      await a.useCareerAgentReward(confirmed);
      assert.equal(a.system.reputation, 3);
    }
  }
});
test("review rejects malformed, unconfirmed and stale balances, and a partial review remains held until all fields are confirmed", async () => {
  const a = actor();
  mode = "recordOnly";
  await a.useCareerAgentReward(confirmed);
  const review = getCareerAgentReview(a),
    opts = { reputation: 3, netWorth: 100000, retainReward: true, reason: "Actual balances checked", confirmed: true };
  for (const patch of [
    { confirmed: false },
    { retainReward: "true" },
    { reputation: NaN },
    { netWorth: 1.5 },
    { reason: "" }
  ])
    assert.throws(() => careerAgentReviewPlan(review, { ...opts, ...patch }), /Confirm/);
  assert.throws(() => careerAgentReviewPlan({ ...review, id: "another" }, opts), /valid mission/);
  mode = "reviewPartial";
  await assert.rejects(a.reviewCareerAgentReward(opts), /review partial/);
  assert.equal(getCareerAgentReview(a).needsReview, true);
  mode = "";
  await a.reviewCareerAgentReward(opts);
  assert.equal(getCareerAgentReview(a).needsReview, false);
  assert.equal(a.system.reputation, 3);
});

test("the actual review dialog accepts both numeric and string form values and does not grant resources again", async () => {
  for (const numeric of [false, true]) {
    const a = actor();
    mode = "balanceOnly";
    await a.useCareerAgentReward(confirmed);
    mode = "";
    dialogHook = () => ({
      reputation: numeric ? 3 : "3",
      netWorth: numeric ? 100000 : "100000",
      retainReward: "retain",
      reason: "Reviewed saved balances",
      confirmed: true
    });
    await a.reviewCareerAgentReward();
    assert.equal(a.system.reputation, 3);
    assert.equal(a.system.netWorth, 100000);
    assert.equal(getCareerAgentReview(a).needsReview, false);
  }
});

test("a stale correction dialog or lost GC role cannot replace changed balances or clear the pending reward", async () => {
  for (const phase of ["balance", "owner", "role"]) {
    const a = actor();
    mode = "balanceOnly";
    await a.useCareerAgentReward(confirmed);
    mode = "";
    dialogHook = () => {
      if (phase === "balance") a.system.netWorth++;
      if (phase === "owner") a.isOwner = false;
      if (phase === "role") game.user.isGM = false;
      return {
        reputation: "3",
        netWorth: "100000",
        retainReward: "retain",
        reason: "Reviewed balances",
        confirmed: true
      };
    };
    await assert.rejects(a.reviewCareerAgentReward(), /changed|owning GC/);
    assert.equal(getCareerAgentReview(a).needsReview, true);
  }
});
