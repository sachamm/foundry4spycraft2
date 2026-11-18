import test from "node:test";
import assert from "node:assert/strict";
import {
  attributeDamageState,
  attributeDamagePlan,
  attributeMissionRecoveryPlan
} from "../module/rules/attribute-damage.mjs";
const state = () => ({
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 12 }])),
    usagePeriods: { mission: "mission1" }
  }),
  request = (patch = {}) => ({
    id: "event1",
    ability: "wis",
    amount: 1,
    source: "Silver Tongue victory",
    floor: 6,
    confirmed: true,
    worldTime: 126,
    ...patch
  });
function apply(s, request) {
  const p = attributeDamagePlan(s, request);
  s.attributeDamage = p.record;
  if (!p.alreadyApplied) s.abilities[p.event.ability].value = p.after;
  return p;
}
test("typed damage adds actual temporary/permanent sources for all six attributes without mutating the caller", () => {
  for (const ability of ["str", "dex", "con", "int", "wis", "cha"]) {
    const s = state(),
      before = structuredClone(s),
      a = attributeDamagePlan(s, request({ ability, amount: 3, floor: null }));
    assert.deepEqual(s, before);
    assert.equal(a.after, 9);
    s.attributeDamage = a.record;
    s.abilities[ability].value = a.after;
    apply(s, request({ id: "event2", ability, amount: 2, kind: "permanent", floor: null }));
    const r = attributeDamageState(s);
    assert.deepEqual(r.byAbility[ability], { temporary: 3, permanent: 2, total: 5 });
    assert.equal(r.events[0].remaining, 3);
    assert.equal(s.abilities[ability].value, 7);
  }
});
test("bounded source damage never reduces Wisdom below six, never heals a lower score, and records zero-damage victories once", () => {
  for (let score = -5; score <= 20; score++) {
    const s = state();
    s.abilities.wis.value = score;
    const p = apply(s, request());
    assert.equal(p.event.amount, score > 6 ? 1 : 0);
    assert.equal(p.after, score > 6 ? score - 1 : score);
    const original = structuredClone(s.attributeDamage);
    assert.equal(apply(s, request()).alreadyApplied, true);
    assert.deepEqual(s.attributeDamage, original);
  }
  const s = state();
  s.abilities.wis.value = 8;
  for (let n = 1; n <= 4; n++) apply(s, request({ id: "victory" + n }));
  assert.equal(s.abilities.wis.value, 6);
  assert.deepEqual(
    s.attributeDamage.events.map(e => e.amount),
    [1, 1, 0, 0]
  );
});
test("unbounded attribute damage may produce negative scores and retains the complete amount", () => {
  const s = state(),
    p = apply(s, request({ ability: "str", amount: 15, floor: null }));
  assert.equal(p.after, -3);
  assert.equal(attributeDamageState(s).byAbility.str.total, 15);
});
test("stable damage IDs replay after healing or unrelated stat/source changes but reject different requests", () => {
  const s = state();
  apply(s, request());
  s.attributeDamage = attributeMissionRecoveryPlan(s, {
    id: "end1",
    missionId: "mission1",
    confirmed: true,
    worldTime: 127
  }).record;
  s.abilities.wis.value = 20;
  s.activeFeatNames = [];
  const before = structuredClone(s);
  assert.equal(apply(s, request({ worldTime: 128 })).alreadyApplied, true);
  assert.deepEqual(s, before);
  for (const patch of [{ source: "Other" }, { ability: "cha" }, { kind: "permanent" }, { amount: 2 }, { floor: 5 }])
    assert.throws(() => attributeDamagePlan(s, request(patch)), /different event/);
});
test("mission-end recovery heals all remaining temporary damage once, retains source history and permanent damage, and does not infer time-based healing", () => {
  const s = state();
  apply(s, request({ amount: 3 }));
  apply(s, request({ id: "permanent1", ability: "int", kind: "permanent", amount: 2, floor: null }));
  const before = structuredClone(s);
  s.worldTime = 864000;
  assert.equal(attributeDamageState(s).byAbility.wis.temporary, 3);
  const p = attributeMissionRecoveryPlan(s, { id: "end1", missionId: "mission1", confirmed: true, worldTime: 864000 });
  assert.deepEqual(s.attributeDamage, before.attributeDamage);
  s.attributeDamage = p.record;
  const r = attributeDamageState(s);
  assert.equal(r.byAbility.wis.temporary, 0);
  assert.equal(r.byAbility.int.permanent, 2);
  assert.equal(r.events[0].healed, 3);
  assert.equal(r.events.length, 2);
  assert.equal(
    attributeMissionRecoveryPlan(s, { id: "end1", missionId: "mission1", confirmed: true, worldTime: 864001 })
      .alreadyApplied,
    true
  );
  assert.throws(
    () => attributeMissionRecoveryPlan(s, { id: "other", missionId: "mission1", confirmed: true, worldTime: 864001 }),
    /already/
  );
  assert.throws(() => attributeDamagePlan(s, request({ id: "new" })), /already settled/);
  s.usagePeriods.mission = "mission2";
  s.abilities.wis.value = 12;
  assert.equal(apply(s, request({ id: "new", worldTime: 864002 })).changed, true);
});
test("empty mission-end receipts still prevent old recovery replay from healing later damage", () => {
  const s = state();
  s.attributeDamage = attributeMissionRecoveryPlan(s, {
    id: "empty",
    missionId: "mission1",
    confirmed: true,
    worldTime: 126
  }).record;
  assert.deepEqual(s.attributeDamage.recoveries[0].allocations, []);
  assert.throws(() => attributeDamagePlan(s, request()), /already settled/);
  s.usagePeriods.mission = "mission2";
  apply(s, request({ id: "second", worldTime: 127 }));
  assert.throws(
    () => attributeMissionRecoveryPlan(s, { id: "empty", missionId: "mission2", confirmed: true, worldTime: 128 }),
    /different mission/
  );
  assert.equal(attributeDamageState(s).byAbility.wis.temporary, 1);
});
test("malformed amounts, kinds, sources, floors, IDs, scores and confirmations cannot create damage", () => {
  for (const patch of [
    { id: "" },
    { id: {} },
    { ability: "unknown" },
    { kind: "damage" },
    { amount: 0 },
    { amount: -1 },
    { amount: 1.5 },
    { amount: "1" },
    { amount: Infinity },
    { source: "" },
    { floor: NaN },
    { floor: "6" },
    { confirmed: "true" },
    { worldTime: -1 }
  ])
    assert.throws(() => attributeDamagePlan(state(), request(patch)));
  for (const score of [undefined, NaN, Infinity, "12", 12.5]) {
    const s = state();
    s.abilities.wis.value = score;
    assert.throws(() => attributeDamagePlan(s, request()), /actual current/);
  }
  for (const patch of [{ missionId: "other" }, { confirmed: 1 }, { worldTime: 125 }]) {
    const s = state();
    apply(s, request());
    assert.throws(() =>
      attributeMissionRecoveryPlan(s, { id: "end1", missionId: "mission1", confirmed: true, worldTime: 127, ...patch })
    );
  }
});
test("corrupt or duplicated damage/recovery records require review and cannot be used by another plan", () => {
  const s = state();
  apply(s, request());
  const good = structuredClone(s.attributeDamage);
  for (const mutate of [
    r => (r.version = 2),
    r => r.events.push(structuredClone(r.events[0])),
    r => (r.events[0].amount = 99),
    r => (r.events[0].before = "12"),
    r => r.recoveries.push({}),
    r =>
      r.recoveries.push({
        version: 1,
        id: "r",
        kind: "missionEnd",
        missionId: "mission1",
        worldTime: 127,
        allocations: [{ eventId: "missing", amount: 1 }]
      })
  ]) {
    const corrupt = structuredClone(good);
    mutate(corrupt);
    const bad = { ...s, attributeDamage: corrupt };
    assert.equal(attributeDamageState(bad).needsReview, true);
    assert.throws(() => attributeDamagePlan(bad, request({ id: "new" })), /Review/);
    assert.throws(
      () => attributeMissionRecoveryPlan(bad, { id: "end1", missionId: "mission1", confirmed: true, worldTime: 127 }),
      /Review/
    );
  }
  const p = attributeMissionRecoveryPlan(s, { id: "end1", missionId: "mission1", confirmed: true, worldTime: 127 });
  for (const patch of [
    r => (r.recoveries[0].allocations[0].amount = 2),
    r => r.recoveries[0].allocations.push(structuredClone(r.recoveries[0].allocations[0])),
    r => r.recoveries.push(structuredClone(r.recoveries[0]))
  ]) {
    const corrupt = structuredClone(p.record);
    patch(corrupt);
    assert.equal(attributeDamageState({ attributeDamage: corrupt }).needsReview, true);
  }
});

test("actual fractional world time is retained exactly and healing never rewrites raw event records", () => {
  const s = state();
  apply(s, request({ worldTime: 126.25 }));
  const e = structuredClone(s.attributeDamage.events[0]),
    p = attributeMissionRecoveryPlan(s, { id: "end1", missionId: "mission1", confirmed: true, worldTime: 126.75 });
  assert.equal(p.recovery.worldTime, 126.75);
  assert.deepEqual(p.record.events[0], e);
  assert.equal(attributeDamageState({ attributeDamage: p.record }).needsReview, false);
  const bad = structuredClone(p.record);
  bad.recoveries.push({ ...structuredClone(bad.recoveries[0]), id: "other", allocations: [] });
  assert.equal(attributeDamageState({ attributeDamage: bad }).needsReview, true);
});
