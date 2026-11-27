import test from "node:test";
import assert from "node:assert/strict";
import {
  crossroadsMissionXPPolicy as policy,
  crossroadsMissionXPBonus as bonus,
  crossroadsMissionXPReviewPlan as reviewPlan
} from "../module/rules/crossroads-xp.mjs";
import { missionLevelSnapshot } from "../module/rules/advancement.mjs";
import { missionXPPlan } from "../module/rules/action-dice.mjs";
import { characterMissionXP } from "../module/rules/gc/mission.mjs";
import { reviewCrossroadsMissionXP, crossroadsXPContext } from "../module/apps/crossroads-xp.mjs";
const system = (crossroadsTitle = "weathered", level = 7) => ({
  actorUuid: "Actor.a",
  level,
  xp: 1000,
  worldTime: 8,
  crossroadsTitle,
  usagePeriods: { mission: "m", session: "s" },
  actionDieAwards: {},
  missionXPRewards: {}
});
const snapshot = (title = "weathered", level = 7) => ({
  version: 1,
  mission: "m",
  levels: { "Actor.a": level },
  crossroadsTitles: { "Actor.a": title }
});
const reviewed = (s, title = "weathered") =>
  reviewPlan(s, {
    id: "review",
    actorUuid: "Actor.a",
    mission: "m",
    eligibleTitle: title,
    note: "Actual title eligibility at mission start checked",
    reviewerId: "gc",
    confirmed: true
  });
test("title-free and zero-percent titles preserve ordinary mission XP without inventing historical eligibility", () => {
  for (const title of ["", "seasoned"]) {
    const p = policy(system(title));
    assert.equal(p.needsReview, false);
    assert.equal(bonus(707, p), 0);
    assert.equal(p.source, "no-xp-difference");
  }
  assert.equal(policy(system()).needsReview, true);
});
test("mission-start snapshots bind an empty or lower title and a later award cannot improve the same mission's XP", () => {
  const s = system();
  s.usagePeriods.missionCareerLevels = snapshot("");
  assert.equal(policy(s).percent, 0);
  assert.equal(policy(s).source, "mission-start");
  s.usagePeriods.missionCareerLevels = snapshot("seasoned");
  assert.equal(policy(s).percent, 0);
  const later = missionLevelSnapshot([{ type: "agent", uuid: "Actor.a", system: s }], "next");
  s.usagePeriods = { mission: "next", missionCareerLevels: later };
  assert.equal(policy(s).percent, 5);
  s.usagePeriods.mission = "different";
  assert.equal(policy(s).needsReview, true);
});
test("the highest eligible title replaces earlier percentages and never compounds them", () => {
  for (const [title, level, percent] of [
    ["weathered", 7, 5],
    ["hardened", 13, 5],
    ["crafty", 19, 10]
  ]) {
    const s = system(title, level);
    s.usagePeriods.missionCareerLevels = snapshot(title, level);
    assert.equal(policy(s).percent, percent);
  }
  const s = system("crafty", 19);
  s.usagePeriods.missionCareerLevels = snapshot("weathered");
  assert.equal(policy(s).percent, 5);
  s.crossroadsTitle = "seasoned";
  assert.equal(policy(s).percent, 0);
});
test("the user-confirmed upward rounding applies to the separate post-multiplier Crossroads bonus, including exact integer boundaries", () => {
  const s = system();
  s.usagePeriods.missionCareerLevels = snapshot();
  const p = policy(s);
  assert.equal(bonus(0, p), 0);
  assert.equal(bonus(700, p), 35);
  assert.equal(bonus(701, p), 36);
  assert.equal(bonus(707, p), 36);
  const big = Number.MAX_SAFE_INTEGER;
  assert.equal(BigInt(bonus(big, p)), (BigInt(big) * 5n + 99n) / 100n);
  for (const value of [-1, 1.5, NaN, Infinity, "700"]) assert.throws(() => bonus(value, p));
  assert.throws(() => bonus(700, policy(system())), /eligibility/);
});
test("mission settlement and the GC preview use the same rounded Crossroads result and guard other XP against duplicate inclusion", () => {
  const s = system();
  s.usagePeriods.missionCareerLevels = snapshot();
  const options = { mission: "m", baseXP: 101, threatLevel: 7, missionCompleteConfirmed: true };
  const p = missionXPPlan(s, options),
    preview = characterMissionXP({ baseXP: 101, level: 7, threatLevel: 7, crossroadsPolicy: policy(s) });
  assert.equal(p.record.coreXP, 707);
  assert.equal(p.record.crossroads.bonusXP, 36);
  assert.equal(p.record.totalXP, 743);
  assert.equal(preview.total, 743);
  assert.equal(p.xp, 1743);
  assert.throws(() => missionXPPlan(s, { ...options, additionalXP: 71, modifierReason: "Triumph" }), /excludes/);
  assert.equal(
    missionXPPlan(s, { ...options, additionalXP: 71, modifierReason: "Triumph", additionalExcludesCrossroads: true })
      .record.totalXP,
    814
  );
  s.actionDieAwards.m = { count: 2 };
  assert.equal(missionXPPlan(s, options).record.totalXP, 1110);
});
test("reviewed eligibility is mission- and actor-bound, can preserve no current benefit, and does not replay a settlement", () => {
  const s = system();
  s.crossroadsMissionReviews = { m: reviewed(s, "") };
  assert.equal(policy(s).percent, 0);
  assert.equal(policy(s).source, "gc-review");
  s.crossroadsMissionReviews.m = reviewed(s);
  assert.equal(policy(s).percent, 5);
  s.missionXPRewards.m = { totalXP: 100 };
  assert.throws(() => missionXPPlan(s, { mission: "m", missionCompleteConfirmed: true }), /already settled/);
  s.crossroadsMissionReviews.m.actorUuid = "Actor.other";
  assert.throws(() => policy(s), /saved Crossroads/);
  for (const patch of [
    { eligibleTitle: "crafty" },
    { confirmed: false },
    { note: "" },
    { note: "x".repeat(501) },
    { mission: "other" }
  ])
    assert.throws(() =>
      reviewPlan(s, {
        id: "r",
        actorUuid: "Actor.a",
        mission: "m",
        eligibleTitle: "weathered",
        note: "Checked",
        reviewerId: "gc",
        confirmed: true,
        ...patch
      })
    );
});
test("malformed or impossible held titles require correction before a reward can be enhanced", () => {
  for (const title of ["made-up", "constructor", "__proto__"])
    assert.throws(() => policy(system(title)), /actual GC-confirmed/);
  assert.throws(() => policy(system("crafty", 7)), /minimum career level/);
  assert.throws(() => policy({ ...system(), classLevels: { soldier: 6 } }), /actual class progression/);
  const s = system();
  s.usagePeriods.missionCareerLevels = snapshot("made-up");
  assert.throws(() => policy(s), /mission-start/);
  s.usagePeriods.missionCareerLevels = snapshot("weathered", 1);
  assert.throws(() => policy(s), /mission-start career/);
});

function controller() {
  let id = 0;
  const posts = [];
  globalThis.game = {
    ready: false,
    user: { id: "gc", isGM: true },
    combats: [],
    time: { worldTime: 8 },
    settings: { get: () => ({}) }
  };
  globalThis.foundry = {
    utils: { randomID: () => `review${++id}`, escapeHTML: String },
    applications: { api: { DialogV2: { input: async () => null } } }
  };
  globalThis.ChatMessage = {
    getWhisperRecipients: () => [],
    create: async data => {
      posts.push(data);
      return data;
    }
  };
  const a = {
    uuid: "Actor.a",
    name: "QA title actor",
    type: "agent",
    isOwner: true,
    system: system(),
    flags: {},
    items: [],
    effects: [],
    async update(patch) {
      for (const [path, value] of Object.entries(patch)) {
        const keys = path.split(".");
        let target = this;
        for (const key of keys.slice(0, -1)) target = target[key] ??= {};
        const key = keys.at(-1);
        if (key.startsWith("-=")) delete target[key.slice(2)];
        else target[key] = structuredClone(value);
      }
      return this;
    }
  };
  a.usagePeriods = a.system.usagePeriods;
  return { a, posts };
}
const input = {
  eligibleTitle: "weathered",
  note: "Confirmed title was already eligible for this mission",
  confirmed: true
};
test("the actual eligibility controller records source history and Undo without changing XP, even after a lost successful response", async () => {
  for (const lost of [false, true]) {
    const { a, posts } = controller(),
      beforeXP = a.system.xp,
      update = a.update.bind(a);
    if (lost)
      a.update = async patch => {
        await update(patch);
        throw Error("response lost");
      };
    const r = await reviewCrossroadsMissionXP(a, input);
    assert.equal(r.eligibleTitle, "weathered");
    assert.equal(a.system.xp, beforeXP);
    assert.equal(policy(crossroadsXPContext(a)).percent, 5);
    assert.equal(posts.length, 1);
    assert.ok(posts[0].flags.spycraft2.undo);
  }
});
test("a failed eligibility write or changed mission during its actual dialog cannot establish a bonus", async () => {
  const { a } = controller();
  a.update = async () => {
    throw Error("write rejected");
  };
  await assert.rejects(reviewCrossroadsMissionXP(a, input), /write rejected/);
  assert.equal(policy(crossroadsXPContext(a)).needsReview, true);
  foundry.applications.api.DialogV2.input = async () => {
    a.usagePeriods.mission = "next";
    return input;
  };
  await assert.rejects(reviewCrossroadsMissionXP(a), /mission.*changed/);
  assert.equal(a.system.xp, 1000);
});
test("GC eligibility corrections preserve a malformed earlier record without granting XP or retaining its obsolete fields", async () => {
  const { a } = controller();
  a.flags.spycraft2 = { crossroadsMissionReviews: { m: { version: 0, obsolete: true } } };
  const r = await reviewCrossroadsMissionXP(a, input);
  assert.equal(a.flags.spycraft2.crossroadsMissionReviews.m.obsolete, undefined);
  assert.deepEqual(a.flags.spycraft2.crossroadsMissionReviewHistory[r.id].before, { version: 0, obsolete: true });
  assert.equal(a.system.xp, 1000);
});
