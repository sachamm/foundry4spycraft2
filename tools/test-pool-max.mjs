import test from "node:test";
import assert from "node:assert/strict";
import { poolMaxPlan, newAgentPoolMax, followedValue } from "../module/rules/pool-max.mjs";

const pools = (vitality, wounds, actionDice) => ({
  vitality: { value: vitality[0], max: vitality[1] },
  wounds: { value: wounds[0], max: wounds[1] },
  actionDice: { value: actionDice[0], max: actionDice[1] }
});

test("a new blank agent records empty maximums and then starts every pool at the Career Level 0 maximum", () => {
  const seen = newAgentPoolMax(pools([0, 0], [0, 0], [0, 0]));
  assert.deepEqual(seen, { vitality: 0, wounds: 0, actionDice: 0 });
  // Level 0: flat 6 vitality, wounds equal to Constitution, 2 action dice.
  assert.deepEqual(poolMaxPlan(pools([0, 6], [0, 10], [0, 2]), seen), {
    "system.vitality.value": 6,
    "system.wounds.value": 10,
    "system.actionDice.value": 2,
    "flags.spycraft2.poolMax": { vitality: 6, wounds: 10, actionDice: 2 }
  });
});

test("a copy of a played character keeps the values it already holds", () => {
  const seen = newAgentPoolMax(pools([12, 0], [7, 0], [3, 0]));
  assert.deepEqual(seen, {});
  assert.deepEqual(poolMaxPlan(pools([12, 30], [7, 14], [3, 4]), seen), {
    "flags.spycraft2.poolMax": { vitality: 30, wounds: 14, actionDice: 4 }
  });
});

test("an existing agent with no record keeps its values and only records its maximums", () => {
  for (const seen of [undefined, null, {}])
    assert.deepEqual(poolMaxPlan(pools([3, 30], [2, 14], [0, 4]), seen), {
      "flags.spycraft2.poolMax": { vitality: 30, wounds: 14, actionDice: 4 }
    });
});

test("nothing is written while the maximums are unchanged", () => {
  assert.deepEqual(poolMaxPlan(pools([3, 30], [2, 14], [9, 4]), { vitality: 30, wounds: 14, actionDice: 4 }), {});
});

test("each build choice that raises a maximum raises the current value by the same amount", () => {
  let system = pools([6, 6], [10, 10], [2, 2]),
    seen = { vitality: 6, wounds: 10, actionDice: 2 };
  const step = (vitalityMax, woundsMax, diceMax) => {
    system.vitality.max = vitalityMax;
    system.wounds.max = woundsMax;
    system.actionDice.max = diceMax;
    const patch = poolMaxPlan(system, seen);
    for (const key of ["vitality", "wounds", "actionDice"])
      if (Object.hasOwn(patch, `system.${key}.value`)) system[key].value = patch[`system.${key}.value`];
    seen = patch["flags.spycraft2.poolMax"] ?? seen;
  };
  step(12, 10, 3); // first class level
  step(13, 12, 3); // Constitution raised in the point buy
  step(16, 12, 4); // a feat adds vitality and a starting die
  assert.deepEqual([system.vitality.value, system.wounds.value, system.actionDice.value], [16, 12, 4]);
  step(13, 12, 3); // the feat is taken back
  assert.deepEqual([system.vitality.value, system.wounds.value, system.actionDice.value], [13, 12, 3]);
});

test("a hurt character who gains maximum keeps the damage taken instead of healing to full", () => {
  assert.equal(followedValue("vitality", 10, 8, 38), 18);
  assert.equal(followedValue("wounds", 4, 2, 16), 6);
  // A value never rises past its maximum, and one already above it is not pulled down by a rise.
  assert.equal(followedValue("vitality", 30, 8, 32), 32);
  assert.equal(followedValue("vitality", 40, 2, 32), 40);
  // Action dice can be held past the starting count (awards), so their rise is not capped.
  assert.equal(followedValue("actionDice", 5, 1, 4), 6);
});

test("a falling maximum takes the same amount away but never empties a pool or knocks a character out", () => {
  assert.equal(followedValue("vitality", 20, -8, 22), 12);
  assert.equal(followedValue("vitality", 5, -8, 22), 0);
  assert.equal(followedValue("wounds", 5, -8, 6), 1);
  assert.equal(followedValue("wounds", 0, -2, 8), 0);
  assert.equal(followedValue("wounds", -3, -2, 8), -3);
  assert.equal(followedValue("actionDice", 1, -2, 2), 0);
});

test("a pool without a usable value or maximum is skipped and keeps what was recorded for it", () => {
  const system = pools([3, 30], [2, 14], [1, 4]);
  system.wounds.max = undefined;
  assert.deepEqual(poolMaxPlan(system, { vitality: 20, wounds: 12, actionDice: 4 }), {
    "system.vitality.value": 13,
    "flags.spycraft2.poolMax": { vitality: 30, wounds: 12, actionDice: 4 }
  });
});

globalThis.Actor = class {
  constructor() {
    this.uuid = "Actor.new";
    this.type = "agent";
    this.isOwner = true;
    this.flags = { other: { keep: true } };
    this.system = pools([0, 6], [0, 10], [0, 2]);
    this.items = [];
    this.updates = [];
  }
  async _preCreate() {}
  updateSource(patch) {
    this.source = structuredClone(patch);
    if (patch.flags) this.flags = structuredClone(patch.flags);
  }
  async update(patch) {
    for (const [path, value] of Object.entries(patch)) {
      const keys = path.split(".");
      let target = this;
      for (const key of keys.slice(0, -1)) target = target[key] ??= {};
      target[keys.at(-1)] = structuredClone(value);
    }
    this.updates.push(patch);
    return this;
  }
};
globalThis.game = { user: { isGM: true }, settings: { get: () => undefined }, time: { worldTime: 0 } };
globalThis.foundry = { utils: { randomID: () => "id" } };
globalThis.ui = { notifications: { warn: () => null } };
const { SpycraftActor } = await import("../module/documents/actor.mjs");
const { followPoolMax } = await import("../module/apps/pool-max.mjs");

test("new/imported agent creation records empty pools, preserves other flags and strips copied resource locks in the same source update", async () => {
  const a = new SpycraftActor(),
    data = {
      type: "agent",
      flags: { other: { keep: 2 }, spycraft2: { qa: { proof: 1 }, poolMax: { vitality: 40 } } },
      items: [
        { _id: "sc2ResourceLock1", flags: { spycraft2: { resourceLock: { token: "old" } } } },
        { _id: "gear", name: "Gear" }
      ]
    };
  await a._preCreate(data, {}, {});
  assert.deepEqual(data.flags.spycraft2.poolMax, { vitality: 0, wounds: 0, actionDice: 0 });
  assert.equal(data.flags.spycraft2.startingDiceCreation, undefined);
  assert.deepEqual(data.flags.spycraft2.qa, { proof: 1 });
  assert.deepEqual(data.flags.other, { keep: 2 });
  assert.deepEqual(a.source.items, [{ _id: "gear", name: "Gear" }]);
  assert.deepEqual(a.source.flags, data.flags);
});

test("a new or imported agent starts with a zero stress and subdual ledger, and keeps one it already has", async () => {
  const a = new SpycraftActor();
  a.system.accumulatedDamage = null;
  a._source = { system: { keep: 1, accumulatedDamage: null } };
  await a._preCreate({ type: "agent" }, {}, {});
  assert.equal(a.source.system.keep, 1);
  assert.deepEqual(a.source.system.accumulatedDamage, {
    version: 1,
    revision: 1,
    stress: 0,
    subdual: 0,
    pending: [],
    lastReview: null
  });
  const b = new SpycraftActor(),
    ledger = { version: 1, revision: 4, stress: 3, subdual: 9, pending: [] };
  b.system.accumulatedDamage = ledger;
  await b._preCreate({ type: "agent", system: { accumulatedDamage: ledger } }, {}, {});
  assert.equal(b.source.system, undefined);
});

test("a created agent fills to its maximums once, then follows a new class level by the same amount", async () => {
  const a = new SpycraftActor();
  await a._preCreate({ type: "agent" }, {}, {});
  await followPoolMax(a);
  assert.deepEqual([a.system.vitality.value, a.system.wounds.value, a.system.actionDice.value], [6, 10, 2]);
  assert.equal(await followPoolMax(a), null);
  a.system.vitality.value = 2; // hurt in play
  a.system.vitality.max = 15;
  a.system.actionDice.max = 3;
  await followPoolMax(a);
  assert.deepEqual([a.system.vitality.value, a.system.actionDice.value], [11, 3]);
  assert.equal(a.updates.length, 2);
  // Non-owners never write.
  const b = new SpycraftActor();
  b.isOwner = false;
  assert.equal(followPoolMax(b), null);
});
