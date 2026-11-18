import test from "node:test";
import assert from "node:assert/strict";
import { startingDiceEntryPlan } from "../module/rules/starting-dice.mjs";
let sequence = 0,
  periods = { session: "s" };
const system = () => ({
    level: 1,
    actionDice: { value: 0, max: 3, die: 4 },
    actionDieAwards: {},
    resourceUses: {},
    xp: 10,
    vitality: { value: 4 },
    wounds: { value: 4 }
  }),
  creation = () => ({ id: "creation", session: "s", at: 0, claimed: false });
test("new creation entry uses the derived starting count and die once without treating that count as a cap", () => {
  for (const max of [0, 3, 7])
    for (const die of [4, 6, 8, 10, 12]) {
      const s = system();
      s.actionDice.max = max;
      s.actionDice.die = die;
      const p = startingDiceEntryPlan(s, creation(), { session: "s" });
      assert.equal(p.blocked, false);
      assert.equal(p.value, max);
      assert.equal(p.die, die);
    }
  const s = system();
  s.actionDice.value = 9;
  assert.equal(startingDiceEntryPlan(s, creation(), { session: "s" }).blocked, true);
  assert.equal(s.actionDice.value, 9);
});
test("legacy actors, consumed entries, expired creation sessions and invalid level/count/type never become automatic refills", () => {
  for (const entry of [
    null,
    {},
    { ...creation(), claimed: true },
    { ...creation(), claimed: "false" },
    { ...creation(), id: "" },
    { ...creation(), session: "old" }
  ])
    assert.equal(startingDiceEntryPlan(system(), entry, { session: "s" }).blocked, true);
  for (const patch of [
    { level: 0 },
    { level: 21 },
    { actionDice: { value: 0, max: -1, die: 4 } },
    { actionDice: { value: 0, max: 1.5, die: 4 } },
    { actionDice: { value: 0, max: 3, die: 20 } }
  ])
    assert.equal(startingDiceEntryPlan({ ...system(), ...patch }, creation(), { session: "s" }).blocked, true);
  assert.equal(
    startingDiceEntryPlan(system(), creation(), { session: "s", resetReceipt: { session: "s" } }).blocked,
    true
  );
});
test("current-session awards and interrupted history require review; free ability uses do not count as an ordinary starting grant", () => {
  for (const key of ["actionDieAwardReview", "actionDiceSettlementReview", "missionXPReview"])
    assert.equal(
      startingDiceEntryPlan({ ...system(), [key]: { needsReview: true } }, creation(), { session: "s" }).blocked,
      true
    );
  for (const record of [{ count: 1 }, { count: 1, events: [{ session: "s" }] }])
    assert.equal(
      startingDiceEntryPlan({ ...system(), actionDieAwards: { m: record } }, creation(), { session: "s" }).blocked,
      true
    );
  assert.equal(
    startingDiceEntryPlan({ ...system(), resourceUses: { used: { epoch: "s", used: 1 } } }, creation(), {
      session: "s"
    }).blocked,
    false
  );
  assert.equal(
    startingDiceEntryPlan(
      {
        ...system(),
        actionDieAwards: { m: { count: 1, events: [{ session: "old" }] } },
        resourceUses: { used: { epoch: "old", used: 1 } }
      },
      creation(),
      { session: "s" }
    ).blocked,
    false
  );
});
globalThis.Actor = class {
  constructor() {
    this.uuid = "Actor.starting";
    this.type = "agent";
    this.isOwner = true;
    this.flags = { other: { keep: true }, spycraft2: { startingDiceCreation: creation() } };
    this.system = system();
    this.items = [];
    this.updates = [];
    this.fail = null;
  }
  async _preCreate() {}
  updateSource(patch) {
    this.source = structuredClone(patch);
    if (patch.flags) this.flags = structuredClone(patch.flags);
  }
  async update(patch) {
    if (this.fail === "before") throw Error("entry write failed");
    for (const [path, value] of Object.entries(patch)) {
      const keys = path.split(".");
      let target = this;
      for (const key of keys.slice(0, -1)) target = target[key] ??= {};
      const key = keys.at(-1);
      if (key.startsWith("-=")) delete target[key.slice(2)];
      else target[key] = structuredClone(value);
    }
    this.updates.push(patch);
    if (this.fail === "after") throw Error("entry committed then failed");
    return this;
  }
};
globalThis.game = {
  user: { isGM: true },
  settings: {
    get: (_s, key) =>
      key === "usagePeriods" ? periods : key === "gcActionDice" ? { session: "s", value: 7 } : undefined
  },
  time: { worldTime: 0 }
};
globalThis.foundry = { utils: { randomID: () => `id${++sequence}` } };
globalThis.ui = { notifications: { warn: () => null } };
const { SpycraftActor } = await import("../module/documents/actor.mjs");
test("new/imported agent creation tags the actual session, preserves other flags and strips copied resource locks in the same source update", async () => {
  const a = new SpycraftActor(),
    data = {
      type: "agent",
      flags: {
        other: { keep: 2 },
        spycraft2: { qa: { proof: 1 }, startingDiceCreation: { id: "old", claimed: true, session: "old" } }
      },
      items: [
        { _id: "sc2ResourceLock1", flags: { spycraft2: { resourceLock: { token: "old" } } } },
        { _id: "gear", name: "Gear" }
      ]
    };
  await a._preCreate(data, {}, {});
  assert.equal(data.flags.spycraft2.startingDiceCreation.session, "s");
  assert.equal(data.flags.spycraft2.startingDiceCreation.claimed, false);
  assert.notEqual(data.flags.spycraft2.startingDiceCreation.id, "old");
  assert.deepEqual(data.flags.spycraft2.qa, { proof: 1 });
  assert.deepEqual(data.flags.other, { keep: 2 });
  assert.deepEqual(a.source.items, [{ _id: "gear", name: "Gear" }]);
  assert.deepEqual(a.source.flags, data.flags);
});
test("actual first entry grants one starting balance and freezes its receipt without GC dice, award XP, healing or repeat credit", async () => {
  const a = new SpycraftActor(),
    r = await a.initializeStartingDice();
  assert.equal(r.claimed, true);
  assert.equal(r.starting, 3);
  assert.equal(a.system.actionDice.value, 3);
  assert.equal(a.flags.other.keep, true);
  assert.equal(a.system.xp, 10);
  assert.equal(a.system.vitality.value, 4);
  assert.equal(a.system.wounds.value, 4);
  assert.deepEqual(a.system.actionDieAwards, {});
  assert.equal(game.settings.get("spycraft2", "gcActionDice").value, 7);
  a.system.actionDice.value = 0;
  assert.equal(await a.initializeStartingDice(), null);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.updates.length, 1);
});
test("competing first-entry requests commit once; unowned and untagged legacy characters cannot claim", async () => {
  const a = new SpycraftActor(),
    results = await Promise.all([a.initializeStartingDice(), a.initializeStartingDice()]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(a.updates.length, 1);
  const b = new SpycraftActor();
  delete b.flags.spycraft2.startingDiceCreation;
  assert.equal(await b.initializeStartingDice(), null);
  assert.equal(b.system.actionDice.value, 0);
  const c = new SpycraftActor();
  c.isOwner = false;
  assert.equal(await c.initializeStartingDice(), null);
  assert.equal(c.updates.length, 0);
});
test("failed first-entry writes retry before commitment and recover a committed receipt without another starting grant", async () => {
  for (const boundary of ["before", "after"]) {
    const a = new SpycraftActor();
    a.fail = boundary;
    if (boundary === "before") await assert.rejects(a.initializeStartingDice(), /write failed/);
    else assert.equal((await a.initializeStartingDice()).claimed, true);
    assert.equal(a.system.actionDice.value, boundary === "before" ? 0 : 3);
    a.fail = null;
    await a.initializeStartingDice();
    assert.equal(a.system.actionDice.value, 3);
    assert.equal(a.updates.length, 1);
  }
});
test("awards cannot precede a new character’s starting entry and a normal new session makes an old unclaimed entry ineligible", async () => {
  const a = new SpycraftActor();
  await assert.rejects(a.awardActionDice({ count: 1, reason: "Too early" }), /starting dice before recording awards/);
  assert.equal(a.updates.length, 0);
  periods = { session: "new" };
  try {
    assert.equal(await a.initializeStartingDice(), null);
    assert.equal(a.system.actionDice.value, 0);
  } finally {
    periods = { session: "s" };
  }
});
