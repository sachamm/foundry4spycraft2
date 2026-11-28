import test from "node:test";
import assert from "node:assert/strict";
import { defaultNpcProfile, NPC_STATS, computeNpcProfile } from "../module/rules/npcs.mjs";
import { npcDrainedProjection, npcDrainedApplicationPlan } from "../module/rules/npc-drained.mjs";
import { beginDrainedRecovery, settleDrainedRecovery, reviewDrainedRecoveryPlan } from "../module/rules/drained.mjs";
const source = (npcType = "standard") => ({
  npcType,
  threatLevel: 10,
  npcProfile: {
    ...defaultNpcProfile(),
    enabled: true,
    grades: Object.fromEntries(Object.keys(NPC_STATS).map(k => [k, 5])),
    skills: [{ key: "resolve", grade: 6 }],
    qualities: [
      { id: "fleet", units: 1 },
      { id: "damageResistance", units: 4, details: "AC" }
    ]
  }
});
const input = patch => ({
  id: "event",
  source: "Actual failed save",
  levels: 1,
  confirmed: true,
  reviewer: "gc",
  at: 1,
  forfeit: { kind: "quality", index: 0 },
  ...patch
});
const apply = (s, items = [], record = null, patch = {}) =>
  npcDrainedApplicationPlan(
    s,
    items,
    record,
    input(patch),
    s.npcProfile.qualities.map((q, i) => q.entryId ?? `quality${i}`)
  );
const recoveryMessage = (record, mission = "mission", success = true) => ({
  uuid: "ChatMessage.original",
  flags: {
    spycraft2: {
      drainedRecovery: Object.fromEntries(
        ["mission", "attempt", "levels", "dc", "mode"].map(k => [k, record.recoveries[mission][k]])
      ),
      checkKind: "skill",
      skillKey: "resolve",
      ability: "wis",
      checkId: "drained-recovery",
      checkMethod: "roll",
      resolved: true,
      successConfirmed: success,
      effectiveTotal: success ? 40 : 1
    }
  }
});

test("standard NPC recovery restores only the most recent quality and one grade step per successful mission", () => {
  const s = source(),
    first = apply(s);
  s.npcProfile = first.profile;
  const second = apply(s, [], first.record, { id: "second", forfeit: { kind: "quality", index: 1 } });
  s.npcProfile = second.profile;
  const staged = beginDrainedRecovery(s, [], second.record, {
    mission: "mission",
    attempt: "original",
    confirmed: true,
    at: 2
  });
  assert.equal(staged.recoveries.mission.dc, 25);
  assert.equal(staged.recoveries.mission.mode, "Active");
  const result = settleDrainedRecovery(s, [], staged, "mission", recoveryMessage(staged), 3),
    prepared = npcDrainedProjection(s, [], result);
  assert.deepEqual(result.stack, first.record.stack);
  assert.equal(result.levels, 1);
  assert.equal(prepared.profile.grades.health, 4);
  assert.deepEqual(
    prepared.profile.qualities.map(q => q.id),
    ["damageResistance"]
  );
  assert.deepEqual(result.losses, staged.losses);
  assert.deepEqual(s.npcProfile.grades.health, 5);
  assert.equal(settleDrainedRecovery(s, [], result, "mission", recoveryMessage(staged), 4), result);
  assert.throws(
    () => beginDrainedRecovery(s, [], result, { mission: "mission", attempt: "replacement", confirmed: true, at: 4 }),
    /already/
  );
  const next = beginDrainedRecovery(s, [], result, { mission: "next", attempt: "next", confirmed: true, at: 5 }),
    failed = settleDrainedRecovery(s, [], next, "next", recoveryMessage(next, "next", false), 6);
  assert.equal(failed.levels, 1);
  assert.deepEqual(failed.stack, result.stack);
});

test("manual NPC restoration requires the GC to restore the actual latest loss and keeps original outcome evidence", () => {
  const s = source();
  s.npcProfile.enabled = false;
  const plan = apply(s, [], null, {
    manualStatsHandled: true,
    manualQualityHandled: true,
    note: "Manual quality",
    forfeit: { kind: "manual" }
  });
  s.npcProfile = plan.profile;
  const record = beginDrainedRecovery(s, [], plan.record, {
      mission: "mission",
      attempt: "original",
      confirmed: true,
      at: 2
    }),
    message = recoveryMessage(record);
  assert.throws(() => settleDrainedRecovery(s, [], record, "mission", message, 3), /manual statistics/);
  const review = {
      restorationConfirmed: true,
      restorationNote: "GC restored original manual grades and quality",
      reviewer: "gc"
    },
    result = settleDrainedRecovery(s, [], record, "mission", message, 3, review);
  assert.equal(result.levels, 0);
  assert.deepEqual(result.stack, []);
  assert.deepEqual(result.recoveries.mission.restorationReview, review);
  assert.throws(
    () =>
      reviewDrainedRecoveryPlan(s, [], record, "mission", {
        mode: "success",
        actualOutcomeConfirmed: true,
        reviewer: "gc",
        at: 3,
        note: "Verified original check"
      }),
    /manual statistics/
  );
});

test("special NPC recovery restores one actor-specific career level without changing shared Threat Level", () => {
  const s = source("special"),
    plan = apply(s, [], null, { levels: 3 });
  s.npcProfile = plan.profile;
  const staged = beginDrainedRecovery(s, [], plan.record, {
      mission: "mission",
      attempt: "original",
      confirmed: true,
      at: 2
    }),
    result = settleDrainedRecovery(s, [], staged, "mission", recoveryMessage(staged), 3);
  assert.equal(result.levels, 2);
  assert.equal(npcDrainedProjection(s, [], result).state.effectiveLevel, 8);
  assert.equal(s.threatLevel, 10);
});

test("standard NPCs lose every stat/skill grade and one chosen quality, preserving the owned profile and equipment", () => {
  const s = source(),
    original = structuredClone(s),
    plan = apply(s),
    prepared = npcDrainedProjection({ ...s, npcProfile: plan.profile }, [], plan.record);
  assert.deepEqual(s, original);
  for (const key of Object.keys(NPC_STATS)) assert.equal(prepared.profile.grades[key], 4, key);
  assert.equal(prepared.profile.skills[0].grade, 5);
  assert.equal(prepared.profile.qualities.length, 1);
  assert.equal(prepared.profile.qualities[0].id, "damageResistance");
  assert.deepEqual(prepared.profile.equipment, s.npcProfile.equipment);
  assert.equal(prepared.state.effectiveLevel, 10);
  assert.equal(plan.profile.qualities.length, 2);
  const baseline = computeNpcProfile(prepared.profile, "standard", 10),
    expected = structuredClone(plan.profile);
  for (const key of Object.keys(NPC_STATS)) expected.grades[key] = 4;
  expected.skills[0].grade = 5;
  expected.qualities.shift();
  assert.deepEqual(baseline, computeNpcProfile(expected, "standard", 10));
});

test("standard grades stop at I, no-Wealth stays None, and separate losses cannot forfeit the same quality twice", () => {
  const s = source();
  s.npcProfile.grades.health = 1;
  s.npcProfile.grades.wealth = 0;
  s.npcProfile.skills[0].grade = 1;
  const first = apply(s);
  s.npcProfile = first.profile;
  assert.throws(() => apply(s, [], first.record, { id: "duplicate-quality" }), /already forfeited/);
  const second = apply(s, [], first.record, { id: "second", forfeit: { kind: "quality", index: 1 } }),
    active = npcDrainedProjection({ ...s, npcProfile: second.profile }, [], second.record);
  assert.equal(active.profile.grades.health, 1);
  assert.equal(active.profile.grades.wealth, 0);
  assert.equal(active.profile.skills[0].grade, 1);
  assert.equal(active.profile.grades.attack, 3);
  assert.equal(active.profile.qualities.length, 0);
  assert.equal(apply(s, [], second.record, { id: "second" }).duplicate, true);
  const recovered = npcDrainedProjection({ ...s, npcProfile: second.profile }, [], {
    ...second.record,
    levels: 1,
    stack: second.record.stack.slice(0, -1)
  });
  assert.equal(recovered.profile.qualities.length, 1);
  assert.equal(recovered.profile.qualities[0].id, "damageResistance");
});

test("special NPCs lose actor-specific effective career levels without changing grades, mission TL or source qualities", () => {
  const s = source("special"),
    plan = apply(s, [], null, { levels: 3 }),
    active = npcDrainedProjection({ ...s, npcProfile: plan.profile }, [], plan.record);
  assert.equal(active.state.effectiveLevel, 7);
  assert.equal(s.threatLevel, 10);
  assert.deepEqual(active.profile.grades, s.npcProfile.grades);
  assert.equal(active.profile.qualities.length, 2);
  assert.deepEqual(computeNpcProfile(active.profile, "special", 7), computeNpcProfile(plan.profile, "special", 7));
  s.npcProfile = plan.profile;
  const floor = apply(s, [], plan.record, { id: "floor", levels: 20 });
  assert.equal(floor.record.levels, 9);
  const stopped = apply(s, [], floor.record, { id: "stopped" });
  assert.equal(stopped.applied, 0);
  assert.equal(stopped.record.stack.length, 9);
});

test("forfeited NPC feats and their dependent feats suspend together while original items remain owned", () => {
  const s = source(),
    items = [
      { id: "base", name: "Iron Will", type: "feat", system: { tree: "basicCombat", prerequisites: null } },
      {
        id: "follow",
        name: "Dependent feat",
        type: "feat",
        system: { tree: "basicCombat", prerequisites: { type: "feat", name: "Iron Will" } }
      },
      { id: "other", name: "Independent feat", type: "feat", system: { tree: "basicCombat", prerequisites: null } }
    ],
    plan = apply(s, items, null, { forfeit: { kind: "feat", id: "base" } }),
    active = npcDrainedProjection({ ...s, npcProfile: plan.profile }, items, plan.record);
  assert.deepEqual(
    active.items.map(i => i.id),
    ["other"]
  );
  assert.equal(items.length, 3);
  assert.equal(npcDrainedProjection(s, items, { ...plan.record, levels: 0, stack: [] }).items.length, 3);
});

test("construct immunity and manual/class benefit review are checked before any original data changes", () => {
  const s = source();
  s.npcProfile.qualities.push({ id: "construct", units: 1 });
  assert.throws(() => apply(s), /Constructs/);
  const manual = source("special");
  manual.npcProfile.enabled = false;
  assert.throws(() => apply(manual), /manual NPC/);
  assert.equal(apply(manual, [], null, { manualStatsHandled: true }).applied, 1);
  const cls = source();
  cls.npcProfile.qualities.push({ id: "classAbility", details: "Cold Read", level: 1 });
  assert.throws(() => apply(cls), /class-supplied/);
  assert.equal(apply(cls, [], null, { classOptionsReviewed: true }).applied, 1);
});

test("removed source qualities need restoration review and malformed reference histories cannot silently pick another quality", () => {
  const s = source(),
    plan = apply(s);
  s.npcProfile = plan.profile;
  s.npcProfile.qualities.shift();
  assert.equal(npcDrainedProjection(s, [], plan.record).state.manualRestoration, true);
  assert.equal(npcDrainedProjection(s, [], plan.record).profile.qualities[0].id, "damageResistance");
  const malformed = { ...plan.record, levels: 2 };
  assert.throws(() => npcDrainedProjection(s, [], malformed), /history/);
});
