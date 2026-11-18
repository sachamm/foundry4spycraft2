import test from "node:test";
import assert from "node:assert/strict";
import { silverVictoryKey, silverVictoryPlan, silverVictoryRecordValid } from "../module/rules/silver-tongue.mjs";
import {
  attributeDamageState,
  attributeDamagePlan,
  attributeDamageCorrectionPlan,
  attributeMissionRecoveryPlan
} from "../module/rules/attribute-damage.mjs";
const source = () => ({ activeFeatNames: ["Silver Tongue"], usagePeriods: { mission: "mission1" } }),
  target = () => ({ abilities: { wis: { value: 8 } }, usagePeriods: { mission: "mission1" } }),
  input = () => ({
    sourceActorUuid: "Actor.source",
    targetActorUuid: "Actor.target",
    targetName: "Target",
    conflictId: "seduction-1",
    victoryConfirmed: true,
    sourceAtVictoryConfirmed: true,
    confirmedBy: "GC",
    worldTime: 126,
    records: {}
  });
test("Silver Tongue victory plans exactly one temporary Wisdom damage with floor six, including zero-damage historical claims", () => {
  for (let wisdom = -5; wisdom <= 20; wisdom++) {
    const s = source(),
      t = target();
    t.abilities.wis.value = wisdom;
    const before = structuredClone({ s, t }),
      p = silverVictoryPlan(s, t, input());
    assert.equal(p.damage.event.ability, "wis");
    assert.equal(p.damage.event.kind, "temporary");
    assert.equal(p.damage.event.amount, wisdom > 6 ? 1 : 0);
    assert.equal(p.damage.after, wisdom > 6 ? wisdom - 1 : wisdom);
    assert.equal(p.record.status, "pending");
    assert.equal(silverVictoryRecordValid(p.record), true);
    assert.deepEqual({ s, t }, before);
  }
});
test("victory history binds actual character identities, current mission, GC confirmations, source and stable Conflict ID", () => {
  for (const patch of [
    { sourceActorUuid: "Item.source" },
    { targetActorUuid: "Actor.source" },
    { targetActorUuid: "" },
    { targetName: "" },
    { conflictId: "" },
    { conflictId: {} },
    { victoryConfirmed: "true" },
    { sourceAtVictoryConfirmed: false },
    { confirmedBy: "" },
    { worldTime: NaN }
  ])
    assert.throws(() => silverVictoryPlan(source(), target(), { ...input(), ...patch }));
  const s = source();
  s.activeFeatNames = [];
  assert.throws(() => silverVictoryPlan(s, target(), input()), /qualified Silver/);
  const t = target();
  t.usagePeriods.mission = "other";
  assert.throws(
    () => silverVictoryPlan(source(), t, input()),
    /same actual current mission|share the actual current mission/
  );
});
test("encoded victory keys remain path-safe and unambiguous across dots, separators, unicode and mission/Conflict boundaries", () => {
  const keys = new Set();
  for (const [mission, conflict] of [
    ["a_b", "c"],
    ["a", "b_c"],
    ["mission.1", "conflict.2"],
    ["使命", "接触"],
    ["mission1", "seduction-1"]
  ]) {
    const id = silverVictoryKey(mission, conflict);
    assert.equal(id.includes("."), false);
    assert.ok(!keys.has(id));
    keys.add(id);
  }
  assert.throws(() => silverVictoryKey("", "name"));
  assert.throws(() => silverVictoryKey("mission", "  name"));
});
test("already accepted victories remain historical after feat loss, healing or target rename but never transfer to another target", () => {
  const s = source(),
    t = target(),
    p = silverVictoryPlan(s, t, input()),
    records = { [p.record.id]: p.record };
  s.activeFeatNames = [];
  t.abilities.wis.value = 12;
  const r = silverVictoryPlan(s, t, { ...input(), records, targetName: "Renamed Target" });
  assert.equal(r.alreadyRecorded, true);
  assert.deepEqual(r.record, p.record);
  for (const status of ["settled", "cancelled"]) {
    const record = {
      ...p.record,
      status,
      ...(status === "cancelled" ? { correctionReason: "Wrong victory", reviewedBy: "GC" } : {})
    };
    assert.equal(silverVictoryPlan(s, t, { ...input(), records: { [record.id]: record } }).alreadyRecorded, true);
  }
  assert.throws(
    () => silverVictoryPlan(s, t, { ...input(), records, targetActorUuid: "Actor.other" }),
    /different target/
  );
});
test("a pending victory blocks another new claim and malformed source history cannot be bypassed", () => {
  const p = silverVictoryPlan(source(), target(), input());
  assert.throws(
    () =>
      silverVictoryPlan(source(), target(), { ...input(), conflictId: "next", records: { [p.record.id]: p.record } }),
    /interrupted/
  );
  for (const mutate of [
    r => (r.version = 2),
    r => (r.event.amount = 2),
    r => (r.event.floor = 0),
    r => (r.event.ability = "cha"),
    r => (r.beforeRecord = "{}"),
    r => (r.status = "unknown"),
    r => (r.id = "other")
  ]) {
    const r = structuredClone(p.record);
    mutate(r);
    assert.equal(silverVictoryRecordValid(r, p.record.id), false);
    assert.throws(() => silverVictoryPlan(source(), target(), { ...input(), records: { [p.record.id]: r } }), /Review/);
  }
});
test("GC correction removes only a specific remaining erroneous contribution while retaining all original sources and other damage", () => {
  const t = target(),
    p = silverVictoryPlan(source(), t, input());
  t.attributeDamage = p.damage.record;
  t.abilities.wis.value = p.damage.after;
  t.abilities.int = { value: 12 };
  t.attributeDamage = attributeDamagePlan(t, {
    id: "other",
    ability: "int",
    kind: "permanent",
    amount: 2,
    source: "Other damage",
    confirmed: true,
    worldTime: 126
  }).record;
  const before = structuredClone(t.attributeDamage.events),
    c = attributeDamageCorrectionPlan(t, {
      id: "correction1",
      eventId: p.record.event.id,
      reason: "Erroneous victory",
      confirmed: true,
      worldTime: 127
    });
  assert.deepEqual(c.record.events, before);
  const state = attributeDamageState({ attributeDamage: c.record });
  assert.equal(state.byAbility.wis.total, 0);
  assert.equal(state.byAbility.int.permanent, 2);
  assert.equal(c.recovery.kind, "correction");
  t.attributeDamage = c.record;
  assert.equal(
    attributeDamageCorrectionPlan(t, {
      id: "correction1",
      eventId: p.record.event.id,
      reason: "Erroneous victory",
      confirmed: true,
      worldTime: 128
    }).alreadyApplied,
    true
  );
  assert.equal(
    attributeDamagePlan(t, {
      id: "another",
      ability: "wis",
      amount: 1,
      source: "Next legitimate damage",
      confirmed: true,
      worldTime: 128
    }).changed,
    true
  );
  assert.throws(
    () =>
      attributeDamageCorrectionPlan(t, {
        id: "correction1",
        eventId: p.record.event.id,
        reason: "Other reason",
        confirmed: true,
        worldTime: 128
      }),
    /different decision/
  );
});
test("correcting a healed or zero-damage victory records an empty allocation and cannot restore or damage another point", () => {
  for (const wisdom of [6, 8]) {
    const t = target();
    t.abilities.wis.value = wisdom;
    const p = silverVictoryPlan(source(), t, input());
    t.attributeDamage = p.damage.record;
    t.attributeDamage = attributeMissionRecoveryPlan(t, {
      id: "end1",
      missionId: "mission1",
      confirmed: true,
      worldTime: 127
    }).record;
    const c = attributeDamageCorrectionPlan(t, {
      id: "correction1",
      eventId: p.record.event.id,
      reason: "Erroneous victory",
      confirmed: true,
      worldTime: 128
    });
    assert.deepEqual(c.recovery.allocations, []);
    assert.equal(attributeDamageState({ attributeDamage: c.record }).byAbility.wis.total, 0);
    assert.deepEqual(c.record.events, p.damage.record.events);
  }
});
test("malformed corrections cannot allocate unrelated sources, over-heal, reference a missing event or precede its source", () => {
  const t = target(),
    p = silverVictoryPlan(source(), t, input());
  t.attributeDamage = p.damage.record;
  for (const patch of [{ id: "" }, { eventId: "missing" }, { confirmed: "true" }, { reason: "" }, { worldTime: 125 }])
    assert.throws(() =>
      attributeDamageCorrectionPlan(t, {
        id: "correction1",
        eventId: p.record.event.id,
        reason: "Wrong victory",
        confirmed: true,
        worldTime: 127,
        ...patch
      })
    );
  const c = attributeDamageCorrectionPlan(t, {
    id: "correction1",
    eventId: p.record.event.id,
    reason: "Wrong victory",
    confirmed: true,
    worldTime: 127
  });
  for (const mutate of [
    r => (r.recoveries[0].eventId = "missing"),
    r => (r.recoveries[0].reason = ""),
    r => (r.recoveries[0].allocations[0].amount = 2),
    r => (r.recoveries[0].allocations[0].eventId = "other"),
    r => (r.recoveries[0].worldTime = 125)
  ]) {
    const r = structuredClone(c.record);
    mutate(r);
    assert.equal(attributeDamageState({ attributeDamage: r }).needsReview, true);
  }
});
