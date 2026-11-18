import { finishGearAcquisition as finishAcquisition } from "../module/apps/gear-acquisition.mjs";
import { masterPlanPool, masterPlanGainPlan } from "../module/rules/bonus-pools.mjs";
import { requestSources, priorityRequestBonus } from "../module/rules/requests.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {
  PICK_CATEGORIES,
  DELIVERY,
  reserveInitialization,
  gearAcquisitionPlan,
  acquisitionOutcome,
  reserveAllocations,
  managedAcquisition
} from "../module/rules/gear-acquisition.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const system = () => ({
  affiliationType: "faction",
  usagePeriods: { mission: "mission1" },
  gearPicks: Object.fromEntries(PICK_CATEGORIES.map(k => [k, { remaining: 3 }])),
  commonItems: { count: 10, perMission: 4 },
  reserveCapacity: 4,
  requestCheck: 9,
  gearCheck: 7,
  actionDice: { value: 5, die: 4 }
});
const initialize = { picks: { R: 1, E: 1 }, common: 1, caliber: 2, intelComplete: true };
const request = {
  kind: "request",
  pick: "R",
  category: "R",
  caliber: 2,
  name: "Bag full of guns",
  location: "nearCity",
  rapidCommunication: true,
  minuteAvailable: true,
  categoryConfirmed: true,
  notIntel: true
};
test("RAW p.219: only unchosen picks and Common Items may be reserved, up to Wisdom’s modifier, once per mission", () => {
  const sys = system(),
    record = reserveInitialization(sys, [], initialize);
  assert.equal(record.picks.R, 1);
  assert.equal(record.common, 1);
  for (const patch of [
    { intelComplete: false },
    { picks: { R: 4 } },
    { common: 14 },
    { common: 1.5 },
    { common: 3 },
    { caliber: 6 }
  ])
    assert.throws(() => reserveInitialization(sys, [], { ...initialize, ...patch }));
  assert.throws(() => reserveInitialization(sys, [{ type: "gear", system: { reserve: true } }], initialize), /legacy/);
  sys.missionReserves = record;
  assert.throws(() => reserveInitialization(sys, [], initialize), /already/);
  sys.usagePeriods.mission = "next";
  assert.doesNotThrow(() => reserveInitialization(sys, [], initialize));
});
test("Charisma reserve categories are fixed during Intel and obey all affiliation category restrictions", () => {
  for (const [affiliationType, allowed] of [
    ["faction", ["G", "T", "V", "R"]],
    ["freelance", ["E", "S", "V", "W"]]
  ])
    for (const category of PICK_CATEGORIES.filter(k => k !== "CHA")) {
      const sys = { ...system(), affiliationType };
      const options = {
        picks: { CHA: 1 },
        charismaPicks: { [category]: 1 },
        common: 0,
        caliber: 1,
        intelComplete: true
      };
      if (allowed.includes(category)) {
        const record = reserveInitialization(sys, [], options);
        sys.missionReserves = record;
        assert.equal(
          gearAcquisitionPlan(sys, { ...request, pick: "CHA", category, caliber: 1 }).record.charismaPicks[category],
          0
        );
      } else assert.throws(() => reserveInitialization(sys, [], options));
    }
  assert.throws(() => reserveInitialization(system(), [], { ...initialize, picks: { CHA: 1 } }), /Assign every/);
});
test("Request costs equal requested Caliber, consume a matching pick before rolling and retain allocations after expenditure", () => {
  const sys = system();
  sys.missionReserves = reserveInitialization(sys, [], initialize);
  const plan = gearAcquisitionPlan(sys, request);
  assert.equal(plan.cost, 2);
  assert.equal(plan.dc, 20);
  assert.equal(plan.bonus, 9);
  assert.equal(plan.record.picks.R, 0);
  assert.equal(plan.record.spent.R, 1);
  sys.missionReserves = plan.record;
  assert.equal(reserveAllocations(sys).R, 1);
  assert.throws(() => gearAcquisitionPlan(sys, request), /available Reserve/);
});
test("Requests enforce Calibers I–IV, mission ceiling, matching categories, communication time and available dice", () => {
  for (const patch of [
    { caliber: 0 },
    { caliber: 5 },
    { caliber: 3 },
    { category: "W" },
    { categoryConfirmed: false },
    { rapidCommunication: false },
    { minuteAvailable: false },
    { notIntel: false },
    { location: "unknown" }
  ]) {
    const sys = system();
    sys.missionReserves = reserveInitialization(sys, [], initialize);
    assert.throws(() => gearAcquisitionPlan(sys, { ...request, ...patch }));
  }
  const sys = system();
  sys.missionReserves = reserveInitialization(sys, [], initialize);
  sys.actionDice.value = 1;
  assert.throws(() => gearAcquisitionPlan(sys, request), /Not enough/);
});
test("Gear checks consume one Reserve Common Item on any result, and require strictly above twenty", () => {
  const sys = system();
  sys.missionReserves = reserveInitialization(sys, [], initialize);
  const plan = gearAcquisitionPlan(sys, { kind: "common", name: "Flashlight", commonConfirmed: true, notIntel: true });
  assert.equal(plan.cost, 0);
  assert.equal(plan.record.common, 0);
  assert.equal(plan.record.spentCommon, 1);
  assert.equal(plan.dc, 21);
  assert.equal(plan.bonus, 7);
  assert.equal(acquisitionOutcome(plan, 20).success, false);
  assert.equal(acquisitionOutcome(plan, 21).success, true);
  assert.equal(acquisitionOutcome({ ...plan, dc: 20 }, 20).success, true);
  assert.throws(() => acquisitionOutcome(plan, NaN));
  assert.deepEqual(
    Object.values(DELIVERY).map(d => [d.formula, d.unit]),
    [
      ["3d20", "minutes"],
      ["1d6", "hours"],
      ["2d6", "hours"],
      ["3d6", "hours"],
      ["4d6", "hours"]
    ]
  );
});
test("claimed Request gear is not counted twice, while forged acquisition references still consume a pick", () => {
  const record = {
    epoch: "mission1",
    picks: { R: 0 },
    spent: { R: 1 },
    common: 0,
    attempts: { a: { id: "a", epoch: "mission1", kind: "request", pick: "R", success: true, claimedItemId: "gear" } }
  };
  const cls = {
    id: "cls",
    type: "class",
    name: "Test",
    system: { identifier: "test", vitalityDie: 6, skillPoints: 4, classSkills: [], table: [{ level: 1, gearR: 3 }] }
  };
  const item = {
    id: "gear",
    name: "Requested resource",
    type: "gear",
    system: { pick: "R", gearCategory: "R", reserveAcquisition: { epoch: "mission1", attemptId: "a" } }
  };
  const sys = {
    abilities: Object.fromEntries(
      ["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: k === "wis" ? 18 : 10 }])
    ),
    progression: [{ classId: "test", skills: {}, vitality: 1 }],
    usagePeriods: { mission: "mission1" },
    missionReserves: record
  };
  assert.equal(managedAcquisition(sys, item), true);
  computeAgent(sys, [cls, item], cfg);
  assert.equal(sys.gearPicks.R.spent, 1);
  assert.equal(sys.reserveUsed, 0);
  item.id = "forged";
  assert.equal(managedAcquisition(sys, item), false);
  computeAgent(sys, [cls, item], cfg);
  assert.equal(sys.gearPicks.R.spent, 2);
  assert.ok(sys.warnings.some(w => w.includes("reserve-acquisition reference")));
});
function merge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (key.startsWith("-=")) {
      delete target[key.slice(2)];
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== "object") target[key] = {};
      merge(target[key], value);
    } else target[key] = value;
  }
}
function update(object, data) {
  for (const [path, value] of Object.entries(data)) {
    const keys = path.split(".");
    let o = object;
    for (const key of keys.slice(0, -1)) o = o[key] ??= {};
    merge(o, { [keys.at(-1)]: value });
  }
}
globalThis.Actor = class {
  constructor() {
    this.uuid = "Actor.test";
    this.type = "agent";
    this.isOwner = true;
    this.system = system();
    this.items = [];
  }
  async update(data) {
    update(this, data);
  }
  async createEmbeddedDocuments(_type, data) {
    const docs = data.map((d, i) => ({ ...d, id: "item" + (this.items.length + i) }));
    this.items.push(...docs);
    return docs;
  }
  async deleteEmbeddedDocuments(_type, ids) {
    this.items = this.items.filter(i => !ids.includes(i.id));
  }
};
let serial = 0,
  rollTotal = 20,
  postFails = false;
globalThis.game = { user: { isGM: true } };
globalThis.ui = { notifications: { warn: () => null } };
globalThis.foundry = { utils: { randomID: () => String(++serial), escapeHTML: s => s } };
globalThis.ChatMessage = { getSpeaker: () => ({}) };
globalThis.Roll = class {
  constructor(formula) {
    this.total = formula.includes("1d20") ? rollTotal : 7;
    this.dice = [{ total: 1 }];
  }
  async evaluate() {
    return this;
  }
  async toMessage(data) {
    if (postFails) throw Error("post failed");
    return {
      ...data,
      uuid: "ChatMessage." + serial,
      async update(patch) {
        update(this, patch);
      }
    };
  }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");
test("actual document workflow defers success until boosts are finished, rolls delivery only on success, and claims the exact item once", async () => {
  const actor = new SpycraftActor();
  await actor.allocateMissionReserves(initialize);
  const msg = await actor.rollGearAcquisition(request);
  assert.equal(actor.system.actionDice.value, 3);
  assert.equal(actor.system.missionReserves.picks.R, 0);
  assert.equal(msg.flags.spycraft2.error, 0);
  assert.equal(msg.flags.spycraft2.threat, 0);
  const id = msg.flags.spycraft2.gearAttempt.id;
  assert.equal(actor.system.missionReserves.attempts[id].status, "pending");
  const result = await actor.finishCheck(msg);
  assert.equal(result.success, true);
  assert.equal(result.delivery.total, 7);
  assert.equal(result.delivery.unit, "hours");
  assert.equal(msg.flags.spycraft2.resolved, true);
  const itemData = { name: request.name, type: "gear", system: { gearCategory: "R", caliber: 2 } };
  await assert.rejects(
    actor.claimGearAcquisition({ attemptId: id, itemData, delivered: false, gcConfirmed: true }),
    /delivery/
  );
  const item = await actor.claimGearAcquisition({ attemptId: id, itemData, delivered: true, gcConfirmed: true });
  assert.equal(item.system.pick, "R");
  assert.equal(item.system.reserve, false);
  assert.equal(item.system.reserveAcquisition.attemptId, id);
  await assert.rejects(
    actor.claimGearAcquisition({ attemptId: id, itemData, delivered: true, gcConfirmed: true }),
    /already claimed/
  );
  assert.equal(actor.items.length, 1);
});
test("a failed field check still consumes its reserve, while a technical posting failure refunds dice and removes its new ObjectField attempt", async () => {
  const actor = new SpycraftActor();
  await actor.allocateMissionReserves(initialize);
  rollTotal = 19;
  const failed = await actor.rollGearAcquisition(request);
  const result = await actor.finishCheck(failed);
  assert.equal(result.success, false);
  assert.equal(result.delivery, null);
  assert.equal(actor.system.actionDice.value, 3);
  assert.equal(actor.system.missionReserves.picks.R, 0);
  const retry = new SpycraftActor();
  await retry.allocateMissionReserves(initialize);
  postFails = true;
  await assert.rejects(retry.rollGearAcquisition(request), /post failed/);
  postFails = false;
  assert.equal(retry.system.actionDice.value, 5);
  assert.equal(retry.system.missionReserves.picks.R, 1);
  assert.deepEqual(retry.system.missionReserves.attempts, {});
});
test("a Common Item result of twenty fails, can instead succeed after a boost, and spends no Request action dice", async () => {
  const actor = new SpycraftActor();
  await actor.allocateMissionReserves(initialize);
  rollTotal = 20;
  const msg = await actor.rollGearAcquisition({
    kind: "common",
    name: "Flashlight",
    commonConfirmed: true,
    notIntel: true
  });
  assert.equal(actor.system.actionDice.value, 5);
  msg.flags.spycraft2.effectiveTotal = 21;
  const result = await actor.finishCheck(msg);
  assert.equal(result.success, true);
  assert.equal(result.delivery, null);
  assert.equal(actor.system.missionReserves.common, 0);
  const id = msg.flags.spycraft2.gearAttempt.id;
  await actor.claimGearAcquisition({
    attemptId: id,
    gcConfirmed: true,
    itemData: { name: "Flashlight", type: "gear", system: { common: true, caliber: 0, weight: 1 } }
  });
  assert.equal(actor.items[0].system.common, true);
  assert.equal(actor.items[0].system.pick, "");
});

test("RAW pp.30,38: Procure adds two reserves when used during Intel in a qualifying city, raises Request Caliber only there, and halves delivery", () => {
  const sys = system();
  sys.reserveCapacity = 0;
  sys.classOptionSelections = [{ classId: "intruder", name: "Procure" }];
  sys.missionReserves = reserveInitialization(sys, [], {
    picks: { R: 2 },
    caliber: 1,
    intelComplete: true,
    procureAtIntel: true
  });
  assert.equal(sys.missionReserves.picks.R, 2);
  const plan = gearAcquisitionPlan(sys, { ...request, location: "largeCity", useProcure: true });
  assert.equal(plan.caliber, 2);
  assert.equal(plan.deliveryMultiplier, 0.5);
  assert.throws(() => gearAcquisitionPlan(sys, { ...request, location: "nearCity", useProcure: true }), /city/);
  assert.throws(() => gearAcquisitionPlan(sys, { ...request, location: "largeCity", useProcure: true, caliber: 5 }));
  sys.classOptionSelections = [];
  assert.throws(() => gearAcquisitionPlan(sys, { ...request, location: "largeCity", useProcure: true }), /earned/);
  assert.throws(
    () =>
      reserveInitialization({ ...system(), reserveCapacity: 0 }, [], {
        picks: { R: 1 },
        intelComplete: true,
        procureAtIntel: true
      }),
    /earned/
  );
});

test("RAW p.219: Request funders split exactly the Caliber cost; only one pick and one unboosted check are used", async () => {
  const actor = new SpycraftActor(),
    teammate = new SpycraftActor();
  teammate.uuid = "Actor.teammate";
  actor.system.actionDice.value = 1;
  teammate.system.actionDice.value = 1;
  await actor.allocateMissionReserves(initialize);
  rollTotal = 20;
  const msg = await actor.rollGearAcquisition({
    ...request,
    teammatesConfirmed: true,
    funding: [
      { actor, count: 1 },
      { actor: teammate, count: 1 }
    ]
  });
  assert.equal(actor.system.actionDice.value, 0);
  assert.equal(teammate.system.actionDice.value, 0);
  assert.equal(actor.system.missionReserves.spent.R, 1);
  assert.equal(msg.flags.spycraft2.rawTotal, 20);
  const attempt = actor.system.missionReserves.attempts[msg.flags.spycraft2.gearAttempt.id];
  assert.deepEqual(attempt.funding, [
    { actorUuid: actor.uuid, count: 1 },
    { actorUuid: teammate.uuid, count: 1 }
  ]);
});
test("failed shared funding refunds earlier payers and reserves, and requests cannot overdraw a teammate", async () => {
  const actor = new SpycraftActor(),
    teammate = new SpycraftActor();
  teammate.uuid = "Actor.teammate";
  await actor.allocateMissionReserves(initialize);
  const options = {
    ...request,
    teammatesConfirmed: true,
    funding: [
      { actor, count: 1 },
      { actor: teammate, count: 1 }
    ]
  };
  teammate.update = async () => {
    throw Error("payment rejected");
  };
  await assert.rejects(actor.rollGearAcquisition(options), /payment rejected/);
  assert.equal(actor.system.actionDice.value, 5);
  assert.equal(actor.system.missionReserves.picks.R, 1);
  assert.deepEqual(actor.system.missionReserves.attempts, {});
  teammate.system.actionDice.value = 0;
  await assert.rejects(actor.rollGearAcquisition(options), /no longer/);
  assert.equal(actor.system.missionReserves.picks.R, 1);
  await assert.rejects(actor.rollGearAcquisition({ ...options, teammatesConfirmed: false }), /teammates/);
  await assert.rejects(actor.rollGearAcquisition({ ...options, funding: [{ actor, count: 1 }] }), /total/);
});
test("Procure’s delivery rounds a halved odd result up in the document workflow", async () => {
  const actor = new SpycraftActor();
  actor.system.classOptionSelections = [{ classId: "intruder", name: "Procure" }];
  await actor.allocateMissionReserves({ ...initialize, caliber: 1, procureAtIntel: true });
  rollTotal = 20;
  const msg = await actor.rollGearAcquisition({ ...request, location: "largeCity", useProcure: true });
  const result = await actor.finishCheck(msg);
  assert.equal(result.delivery.total, 4);
  assert.equal(result.delivery.unit, "minutes");
});

test("starting a new mission archives the old ledger and explicitly deletes merged ObjectField attempts", async () => {
  const actor = new SpycraftActor();
  await actor.allocateMissionReserves(initialize);
  rollTotal = 20;
  const msg = await actor.rollGearAcquisition(request);
  await actor.finishCheck(msg);
  const id = msg.flags.spycraft2.gearAttempt.id;
  actor.system.usagePeriods.mission = "mission2";
  await actor.allocateMissionReserves(initialize);
  assert.deepEqual(actor.system.missionReserves.attempts, {});
  assert.equal(actor.system.missionReserveHistory.length, 1);
  assert.equal(actor.system.missionReserveHistory[0].attempts[id].success, true);
  await assert.rejects(actor.finishCheck(msg), /earlier mission/);
  await assert.rejects(
    actor.claimGearAcquisition({
      attemptId: id,
      itemData: { name: request.name, type: "gear", system: { gearCategory: "R", caliber: 2 } },
      delivered: true,
      gcConfirmed: true
    }),
    /this mission/
  );
});

test("claiming a canonical weapon uses the actual weapons pack and retains its complete statistics", async () => {
  const actor = new SpycraftActor();
  await actor.allocateMissionReserves({ picks: { W: 1 }, caliber: 1, intelComplete: true });
  rollTotal = 20;
  const msg = await actor.rollGearAcquisition({
    ...request,
    pick: "W",
    category: "W",
    caliber: 1,
    name: "Canonical weapon"
  });
  await actor.finishCheck(msg);
  const data = {
    name: "Canonical weapon",
    type: "weapon",
    system: { gearCategory: "W", caliber: 1, damage: "1d8", proficiency: "edged" }
  };
  game.packs = {
    get: key =>
      key === "spycraft2.weapons"
        ? {
            getIndex: async () => [{ _id: "canonical", name: data.name }],
            getDocument: async () => ({ system: data.system, toObject: () => structuredClone(data) })
          }
        : undefined
  };
  const item = await actor.claimGearAcquisition({
    attemptId: msg.flags.spycraft2.gearAttempt.id,
    delivered: true,
    gcConfirmed: true
  });
  assert.equal(item.type, "weapon");
  assert.equal(item.system.damage, "1d8");
  assert.equal(item.system.proficiency, "edged");
  assert.equal(item.system.pick, "W");
  delete game.packs;
});

test("ammunition stockpiles cannot bypass their multi-upgrade/Common Item costs through a single Reserve acquisition", () => {
  const sys = system();
  sys.missionReserves = reserveInitialization(sys, [], initialize);
  for (const name of ["Standard arrow", "Explosive arrow"])
    for (const kind of ["request", "common"])
      assert.throws(() => gearAcquisitionPlan(sys, { ...request, kind, name, commonConfirmed: true }), /stockpiles/);
});

test("a field acquisition cannot change its quantity after rolling; Grenade Basics adds exactly one source-granted grenade", async () => {
  const actor = new SpycraftActor();
  actor.system.activeFeatNames = ["Grenade Basics"];
  await actor.allocateMissionReserves({ picks: { W: 1 }, caliber: 1, intelComplete: true });
  rollTotal = 20;
  const msg = await actor.rollGearAcquisition({
    ...request,
    pick: "W",
    category: "W",
    caliber: 1,
    name: "Fragmentation grenade"
  });
  await actor.finishCheck(msg);
  const attemptId = msg.flags.spycraft2.gearAttempt.id;
  const data = {
    name: "Fragmentation grenade",
    type: "weapon",
    system: { gearCategory: "W", caliber: 1, proficiency: "hurled", bundleSize: 3, quantity: 3 }
  };
  await assert.rejects(
    actor.claimGearAcquisition({
      attemptId,
      itemData: { ...data, system: { ...data.system, quantity: 6 } },
      delivered: true,
      gcConfirmed: true
    }),
    /cannot be increased/
  );
  const item = await actor.claimGearAcquisition({ attemptId, itemData: data, delivered: true, gcConfirmed: true });
  assert.equal(item.system.quantity, 4);
  assert.equal(item.system.pickCount, 1);
  assert.equal(item.system.reserveAcquisition.bonusQuantity, 1);
});

const requestOrigins = () => [
  { name: "Veteran", type: "origin", system: { originType: "talent" } },
  { name: "Geek", type: "origin", system: { originType: "specialty" } }
];
const withRequestBenefits = () => {
  const s = system();
  s.classLevels = { politico: 10 };
  s.resourceUses = {};
  s.usagePeriods.session = "session1";
  s.actionDice.value = 0;
  s.limitedUses = requestSources(s, requestOrigins());
  s.missionReserves = reserveInitialization(s, [], initialize);
  return s;
};
test("all three Request sources enforce actual origin types, class milestone, unique copies and independent limits", () => {
  const items = requestOrigins(),
    specs = requestSources({ classLevels: { politico: 10 } }, [...items, ...items]);
  assert.deepEqual(
    specs.map(s => [s.id, s.period, s.limit]),
    [
      ["requestVeteran", "session", 1],
      ["requestGeek", "session", 1],
      ["requestExecutiveDecision", "mission", 1]
    ]
  );
  assert.equal(
    requestSources(
      { classLevels: { politico: 9 } },
      items.map(i => ({ ...i, type: "gear" }))
    ).length,
    0
  );
  assert.equal(
    requestSources(
      {},
      items.map(i => ({ ...i, system: { originType: "wrong" } }))
    ).length,
    0
  );
});
test("Veteran waives only the cost; Geek requires Electronics; both retain normal Request category, reserve, timing and Caliber limits", () => {
  const s = withRequestBenefits();
  for (const [id, category] of [
    ["requestVeteran", "R"],
    ["requestGeek", "E"]
  ]) {
    const p = gearAcquisitionPlan(s, { ...request, requestAbility: id, pick: category, category });
    assert.equal(p.cost, 0);
    assert.equal(p.automatic, false);
    assert.equal(p.record.picks[category], 0);
    assert.equal(p.abilityRecord.used, 1);
    assert.equal(p.abilityRecord.epoch, "session1");
  }
  for (const patch of [
    { requestAbility: "requestGeek" },
    { requestAbility: "invalid" },
    { rapidCommunication: false },
    { minuteAvailable: false },
    { caliber: 3 },
    { pick: "W", category: "W" },
    { kind: "common", commonConfirmed: true }
  ])
    assert.throws(() => gearAcquisitionPlan(s, { ...request, requestAbility: "requestVeteran", ...patch }));
  s.resourceUses.requestVeteran = { epoch: "session1", used: 1 };
  assert.throws(() => gearAcquisitionPlan(s, { ...request, requestAbility: "requestVeteran" }), /no uses/);
  s.usagePeriods.session = "session2";
  assert.equal(gearAcquisitionPlan(s, { ...request, requestAbility: "requestVeteran" }).cost, 0);
});
test("Executive Decision automatically Requests up to IV above mission Caliber, subject to network confirmation and ordinary reserve/category/communication limits", () => {
  const s = withRequestBenefits();
  s.missionReserves.caliber = 1;
  const input = { ...request, caliber: 4, requestAbility: "requestExecutiveDecision", networkConfirmed: true };
  const p = gearAcquisitionPlan(s, input);
  assert.equal(p.cost, 0);
  assert.equal(p.automatic, true);
  assert.equal(p.dc, 40);
  assert.equal(p.abilityRecord.epoch, "mission1");
  assert.equal(p.record.picks.R, 0);
  for (const patch of [
    { caliber: 5 },
    { networkConfirmed: false },
    { minuteAvailable: false },
    { categoryConfirmed: false },
    { pick: "E", category: "R" }
  ])
    assert.throws(() => gearAcquisitionPlan(s, { ...input, ...patch }));
  s.resourceUses.requestExecutiveDecision = { epoch: "mission1", used: 1 };
  s.usagePeriods.session = "another";
  assert.throws(() => gearAcquisitionPlan(s, input), /no uses/);
});
test("free rolled Request consumes one use/pick even on failure; posting failures restore both and cannot charge shared funding", async () => {
  const a = new SpycraftActor();
  a.system = withRequestBenefits();
  rollTotal = 1;
  const m = await a.rollGearAcquisition({ ...request, requestAbility: "requestVeteran" });
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.resourceUses.requestVeteran.used, 1);
  assert.equal((await a.finishCheck(m)).success, false);
  assert.equal(a.system.missionReserves.picks.R, 0);
  const b = new SpycraftActor();
  b.system = withRequestBenefits();
  postFails = true;
  await assert.rejects(
    b.rollGearAcquisition({ ...request, requestAbility: "requestGeek", pick: "E", category: "E" }),
    /post failed/
  );
  postFails = false;
  assert.equal(b.system.resourceUses.requestGeek, undefined);
  assert.equal(b.system.missionReserves.picks.E, 1);
  assert.deepEqual(b.system.missionReserves.attempts, {});
  await assert.rejects(
    b.rollGearAcquisition({ ...request, requestAbility: "requestVeteran", funding: [{ actor: b, count: 1 }] }),
    /total/
  );
});
test("automatic Request rolls delivery, consumes one use and pick, is immediately claimable after delivery, and duplicate use is blocked", async () => {
  const a = new SpycraftActor();
  a.system = withRequestBenefits();
  a.system.missionReserves.caliber = 1;
  let posts = 0;
  ChatMessage.create = async data => {
    posts++;
    return { ...data, uuid: "ChatMessage.auto" };
  };
  const input = { ...request, caliber: 4, requestAbility: "requestExecutiveDecision", networkConfirmed: true };
  const m = await a.rollGearAcquisition(input),
    id = m.flags.spycraft2.gearAttempt.id,
    attempt = a.system.missionReserves.attempts[id];
  assert.equal(m.flags.spycraft2.resolved, true);
  assert.equal(m.flags.spycraft2.actionDiceAllowed, false);
  assert.equal(m.flags.spycraft2.rawTotal, undefined);
  assert.equal(attempt.success, true);
  assert.equal(attempt.status, "succeeded");
  assert.equal(attempt.delivery.total, 7);
  assert.equal(a.system.resourceUses.requestExecutiveDecision.used, 1);
  assert.equal(a.system.actionDice.value, 0);
  await assert.rejects(a.rollGearAcquisition(input), /no uses/);
  assert.equal(posts, 1);
  const item = await a.claimGearAcquisition({
    attemptId: id,
    itemData: { name: request.name, type: "gear", system: { gearCategory: "R", caliber: 4 } },
    gcConfirmed: true,
    delivered: true
  });
  assert.equal(item.system.reserveAcquisition.attemptId, id);
});
test("failed automatic posting refunds the use and reserve; a failed supplementary chat-link write preserves the committed acquisition", async () => {
  const input = { ...request, requestAbility: "requestExecutiveDecision", networkConfirmed: true };
  const a = new SpycraftActor();
  a.system = withRequestBenefits();
  ChatMessage.create = async () => {
    throw Error("automatic post failed");
  };
  await assert.rejects(a.rollGearAcquisition(input), /automatic post failed/);
  assert.equal(a.system.resourceUses.requestExecutiveDecision, undefined);
  assert.equal(a.system.missionReserves.picks.R, 1);
  assert.deepEqual(a.system.missionReserves.attempts, {});
  ChatMessage.create = async data => ({ ...data, uuid: "ChatMessage.auto" });
  const update = a.update.bind(a);
  a.update = async data => {
    if (Object.keys(data).some(k => k.endsWith(".messageUuid"))) throw Error("link failed");
    return update(data);
  };
  const m = await a.rollGearAcquisition(input);
  assert.ok(m);
  assert.equal(a.system.resourceUses.requestExecutiveDecision.used, 1);
  assert.equal(Object.values(a.system.missionReserves.attempts)[0].success, true);
  assert.equal(a.system.missionReserves.picks.R, 0);
});

test("Priority Request checks all Cleaner/Field Analyst levels and all seven categories, using only the best applicable same-named class bonus", () => {
  for (const [classId, early, late] of [
    ["cleaner", ["V", "W"], ["G", "T"]],
    ["fieldAnalyst", ["E", "R"], ["T", "V"]]
  ])
    for (let level = 0; level <= 10; level++)
      for (const category of PICK_CATEGORIES.filter(k => k !== "CHA")) {
        const result = priorityRequestBonus({ classLevels: { [classId]: level } }, category),
          expected = (level >= 2 && early.includes(category)) || (level >= 7 && late.includes(category)) ? level : 0;
        assert.equal(result.bonus, expected, `${classId} ${level} ${category}`);
      }
  const s = withRequestBenefits();
  s.classLevels = { cleaner: 7, fieldAnalyst: 7 };
  s.missionReserves.picks.V = 1;
  s.actionDice.value = 2;
  const p = gearAcquisitionPlan(s, { ...request, pick: "V", category: "V" });
  assert.equal(p.bonus, s.requestCheck + 7);
  assert.equal(p.bonusSources.length, 1);
  assert.equal(priorityRequestBonus(s, "V").options.length, 2);
  assert.equal(priorityRequestBonus(s, "S").bonus, 0);
});

test("Behind the Scenes checks every native grade and inherited grade cap, sharing one starting-dice mission pool", () => {
  for (let level = 0; level <= 20; level++) {
    const system = { classLevels: { advocate: level }, actionDice: { max: 4 } },
      source = requestSources(system).find(s => s.id === "requestBehindScenes");
    if (level < 2) assert.equal(source, undefined);
    else {
      assert.equal(source.maximumDC, level >= 19 ? 40 : level >= 11 ? 30 : 20);
      assert.equal(source.limit, 4);
      assert.equal(source.period, "mission");
      assert.equal(source.city, true);
      assert.equal(source.hour, true);
    }
  }
  const entries = [{ name: "Advocate: Behind the scenes I" }, { name: "Advocate: Behind the scenes I" }];
  assert.equal(requestSources({ inheritedClassChoices: entries, actionDice: { max: 3 } })[0].maximumDC, 20);
  assert.equal(
    requestSources({ classLevels: { advocate: 1 }, inheritedClassChoices: entries, actionDice: { max: 3 } })[0]
      .maximumDC,
    30
  );
  assert.equal(
    requestSources({ classLevels: { advocate: 11 }, inheritedClassChoices: entries, actionDice: { max: 3 } })[0]
      .maximumDC,
    30
  );
});
const behindSystem = (level = 2) => {
  const s = withRequestBenefits();
  s.classLevels = { advocate: level };
  s.actionDice.max = 3;
  s.limitedUses = requestSources(s, []);
  return s;
};
const behindInput = {
  ...request,
  requestAbility: "requestBehindScenes",
  location: "largeCity",
  hourAvailable: true,
  networkConfirmed: true
};
test("Behind the Scenes enforces city, hour, DC, normal mission Caliber, reserves and Request communication rather than copying Executive Decision exemptions", () => {
  const s = behindSystem(),
    plan = gearAcquisitionPlan(s, behindInput);
  assert.equal(plan.cost, 0);
  assert.equal(plan.automatic, true);
  assert.equal(plan.preparationHours, 1);
  assert.match(plan.abilityName, /Behind the Scenes I/);
  assert.equal(plan.record.picks.R, 0);
  for (const patch of [
    { hourAvailable: false },
    { location: "smallCity" },
    { location: "nearCity" },
    { rapidCommunication: false },
    { minuteAvailable: false },
    { caliber: 3 },
    { networkConfirmed: false },
    { kind: "common" }
  ])
    assert.throws(() => gearAcquisitionPlan(s, { ...behindInput, ...patch }));
  s.missionReserves.caliber = 1;
  assert.throws(() => gearAcquisitionPlan(s, behindInput), /mission Caliber/);
  s.classLevels.advocate = 19;
  s.limitedUses = requestSources(s, []);
  s.missionReserves.caliber = 4;
  assert.equal(gearAcquisitionPlan(s, { ...behindInput, caliber: 4 }).dc, 40);
});
test("Behind the Scenes records automatic success and preparation, refunds failed posting, and never charges ordinary dice", async () => {
  const a = new SpycraftActor();
  a.system = behindSystem();
  ChatMessage.create = async () => {
    throw Error("behind post failed");
  };
  await assert.rejects(a.rollGearAcquisition(behindInput), /behind post failed/);
  assert.equal(a.system.resourceUses.requestBehindScenes, undefined);
  assert.equal(a.system.missionReserves.picks.R, 1);
  ChatMessage.create = async data => ({ ...data, uuid: "ChatMessage.behind" });
  const m = await a.rollGearAcquisition(behindInput),
    attempt = a.system.missionReserves.attempts[m.flags.spycraft2.gearAttempt.id];
  assert.equal(attempt.success, true);
  assert.equal(attempt.preparationHours, 1);
  assert.match(m.content, /Behind the Scenes I/);
  assert.doesNotMatch(m.content, /Executive Decision/);
  assert.equal(attempt.delivery.unit, "minutes");
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.resourceUses.requestBehindScenes.used, 1);
  a.system.missionReserves.picks.R = 3;
  await Promise.all([a.rollGearAcquisition(behindInput), a.rollGearAcquisition(behindInput)]);
  assert.equal(a.system.resourceUses.requestBehindScenes.used, 3);
  await assert.rejects(a.rollGearAcquisition(behindInput), /no uses/);
  a.system.usagePeriods.session = "next";
  await assert.rejects(a.rollGearAcquisition(behindInput), /no uses/);
});

test("Local Hero adds all possessed Terrain feats to Requests only inside confirmed home turf, alongside Priority Request", () => {
  const s = system();
  s.activeFeatNames = ["Local Hero", "Home Turf", "Night Training", "Urban Training"];
  s.activeFeatSelections = s.activeFeatNames.map(name => ({ name, tree: "terrain" }));
  s.activeFeatSelections.push({ name: "Investigator", tree: "basicSkill" });
  s.classLevels = { fieldAnalyst: 2 };
  s.missionReserves = reserveInitialization(s, [], initialize);
  const base = gearAcquisitionPlan(s, { ...request, pick: "E", category: "E" }),
    home = gearAcquisitionPlan(s, { ...request, pick: "E", category: "E", homeTurf: true });
  assert.equal(base.bonus, 11);
  assert.equal(home.bonus, 15);
  assert.equal(home.cost, 2);
  assert.equal(home.localHeroFeats.length, 4);
  assert.equal(home.bonusSources.length, 2);
  assert.equal(gearAcquisitionPlan(s, { ...request, homeTurf: "true" }).bonus, 11);
  s.activeFeatNames = [];
  assert.equal(gearAcquisitionPlan(s, { ...request, homeTurf: true }).bonus, 11);
});
test("Local Hero never modifies Common Item Gear checks and re-derives the count when a Terrain feat is lost", () => {
  const s = system();
  s.activeFeatNames = ["Local Hero"];
  s.activeFeatSelections = [
    { name: "Local Hero", tree: "terrain" },
    { name: "Tracking Basics", tree: "terrain" }
  ];
  s.missionReserves = reserveInitialization(s, [], initialize);
  assert.equal(gearAcquisitionPlan(s, { ...request, homeTurf: true }).bonus, 11);
  s.activeFeatSelections.pop();
  assert.equal(gearAcquisitionPlan(s, { ...request, homeTurf: true }).bonus, 10);
  const common = gearAcquisitionPlan(s, {
    kind: "common",
    name: "Batteries",
    notIntel: true,
    commonConfirmed: true,
    homeTurf: true
  });
  assert.equal(common.bonus, 7);
  assert.equal(common.cost, 0);
});

test("field acquisition claims a kit from the new catalog through any actual gear category, retaining grade, size and weight", async () => {
  const actor = new SpycraftActor();
  actor.system = system();
  actor.system.missionReserves = reserveInitialization(actor.system, [], { ...initialize, picks: { E: 1 } });
  const req = { ...request, name: "Appraisal Kit II", pick: "E", category: "E" },
    m = await actor.rollGearAcquisition(req);
  m.flags.spycraft2.effectiveTotal = 25;
  await actor.finishCheck(m);
  const data = {
    name: req.name,
    type: "gear",
    system: {
      kitType: "Appraisal Kit",
      kitGrade: 2,
      kitSize: "Medium",
      weight: 20,
      caliber: 2,
      quantity: 1,
      gearCategory: ""
    }
  };
  const doc = { name: req.name, system: data.system, type: "gear", toObject: () => structuredClone(data) };
  game.packs = new Map([
    [
      "spycraft2.kits",
      {
        async getIndex() {
          return [{ _id: "kit", name: req.name }];
        },
        async getDocument() {
          return doc;
        }
      }
    ]
  ]);
  try {
    const k = await actor.claimGearAcquisition({
      attemptId: m.flags.spycraft2.gearAttempt.id,
      delivered: true,
      gcConfirmed: true
    });
    assert.equal(k.system.kitGrade, 2);
    assert.equal(k.system.kitSize, "Medium");
    assert.equal(k.system.weight, 20);
    assert.equal(k.system.gearCategory, "E");
    assert.equal(k.system.pick, "E");
  } finally {
    delete game.packs;
  }
});
test("claiming a non-portable kit requires a fixed location before it enters inventory and cannot grant a grade above its Caliber", async () => {
  const actor = new SpycraftActor();
  actor.system = system();
  actor.system.missionReserves = reserveInitialization(actor.system, [], { ...initialize, caliber: 3 });
  const m = await actor.rollGearAcquisition({ ...request, name: "Appraisal Kit III", caliber: 3 });
  m.flags.spycraft2.effectiveTotal = 35;
  await actor.finishCheck(m);
  const attemptId = m.flags.spycraft2.gearAttempt.id,
    itemData = {
      name: "Appraisal Kit III",
      type: "gear",
      system: { kitType: "Appraisal Kit", kitGrade: 3, kitNonPortable: true, carried: true, weight: 0, caliber: 3 }
    };
  await assert.rejects(
    actor.claimGearAcquisition({ attemptId, itemData, delivered: true, gcConfirmed: true }),
    /fixed location/
  );
  assert.equal(actor.items.length, 0);
  await assert.rejects(
    actor.claimGearAcquisition({
      attemptId,
      itemData: { ...itemData, system: { ...itemData.system, caliber: 2 } },
      kitLocation: "Base",
      delivered: true,
      gcConfirmed: true
    }),
    /Caliber/
  );
  const k = await actor.claimGearAcquisition({
    attemptId,
    itemData,
    kitLocation: "Base laboratory",
    delivered: true,
    gcConfirmed: true
  });
  assert.equal(k.system.kitLocation, "Base laboratory");
  assert.equal(k.system.carried, false);
});

test("Sleuth Sources checks all native grades and borrowed grade I, using one starting-dice session pool", () => {
  for (let level = 0; level <= 20; level++) {
    const s = { classLevels: { sleuth: level }, actionDice: { max: 4 } },
      r = requestSources(s).find(r => r.id === "requestSources");
    if (level < 2) assert.equal(r, undefined);
    else {
      assert.deepEqual(r.requestOptions, [
        "dossier",
        ...(level >= 11 ? ["skillTraining"] : []),
        ...(level >= 19 ? ["legalImmunity"] : [])
      ]);
      assert.equal(r.requestLevel, level);
      assert.equal(r.limit, 4);
      assert.equal(r.period, "session");
      assert.equal(r.outsideFaction, true);
      assert.equal(r.category, "R");
    }
  }
  const inherited = requestSources({
    classLevels: {},
    inheritedClassChoices: [{ name: "Sleuth: Sources I" }],
    actionDice: { max: 3 }
  }).find(r => r.id === "requestSources");
  assert.equal(inherited.requestLevel, 2);
  assert.deepEqual(inherited.requestOptions, ["dossier"]);
});
const sourcesSystem = (sleuth = 2, level = 6) => {
  const s = system();
  s.level = level;
  s.requestCheck = level + 3;
  s.classLevels = { sleuth };
  s.actionDice = { ...s.actionDice, value: 0, max: 3 };
  s.limitedUses = requestSources(s);
  s.usagePeriods.session = "s";
  s.missionReserves = reserveInitialization(s, [], initialize);
  return s;
};
const sourcesInput = {
  ...request,
  requestAbility: "requestSources",
  hourAvailable: true,
  sourcesOption: "dossier",
  sourcesOptionConfirmed: true,
  rapidCommunication: false,
  minuteAvailable: false,
  categoryConfirmed: false
};
test("Sources replaces Career Level with effective Sleuth level, allows one-hour in-person consultation, and enforces its exact options without waiving reserves or mission Caliber", () => {
  for (const level of [2, 11, 19])
    for (const sourcesOption of ["dossier", "skillTraining", "legalImmunity"]) {
      const s = sourcesSystem(level, 20),
        input = { ...sourcesInput, sourcesOption };
      if ((level < 11 && sourcesOption === "skillTraining") || (level < 19 && sourcesOption === "legalImmunity"))
        assert.throws(() => gearAcquisitionPlan(s, input), /Sources grade/);
      else {
        const p = gearAcquisitionPlan(s, input);
        assert.equal(p.cost, 0);
        assert.equal(p.bonus, level + 3);
        assert.equal(p.requestLevel, level);
        assert.equal(p.outsideFaction, true);
        assert.equal(p.automatic, false);
        assert.equal(p.preparationHours, 1);
        assert.equal(p.record.picks.R, 0);
      }
    }
  const s = sourcesSystem();
  for (const patch of [
    { sourcesOption: "weapon" },
    { sourcesOptionConfirmed: false },
    { hourAvailable: false },
    { category: "E", pick: "E" },
    { caliber: 3 },
    { kind: "common" }
  ])
    assert.throws(() => gearAcquisitionPlan(s, { ...sourcesInput, ...patch }));
  s.missionReserves.picks.R = 0;
  assert.throws(() => gearAcquisitionPlan(s, sourcesInput), /Reserve/);
});
test("actual Sources Request spends its session use and Reserve pick once, records its outside-Faction scope, and refunds failed posting", async () => {
  const a = new SpycraftActor();
  a.system = sourcesSystem();
  postFails = true;
  await assert.rejects(a.rollGearAcquisition(sourcesInput), /post failed/);
  assert.equal(a.system.resourceUses?.requestSources, undefined);
  assert.equal(a.system.missionReserves.picks.R, 1);
  postFails = false;
  const m = await a.rollGearAcquisition(sourcesInput),
    attempt = a.system.missionReserves.attempts[m.flags.spycraft2.gearAttempt.id];
  assert.equal(m.flags.spycraft2.rollData.total, 5);
  assert.equal(attempt.sourcesOption, "dossier");
  assert.equal(attempt.outsideFaction, true);
  assert.equal(attempt.requestLevel, 2);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.resourceUses.requestSources.used, 1);
  assert.match(m.flags.spycraft2.baseFlavor, /class level 2 replaces Career Level/);
  a.system.missionReserves.picks.R = 3;
  await Promise.all([a.rollGearAcquisition(sourcesInput), a.rollGearAcquisition(sourcesInput)]);
  assert.equal(a.system.resourceUses.requestSources.used, 3);
  await assert.rejects(a.rollGearAcquisition(sourcesInput), /no uses/);
  a.system.usagePeriods.session = "new";
  await a.rollGearAcquisition(sourcesInput);
  assert.equal(a.system.resourceUses.requestSources.used, 1);
});

function requestPool(a, id = "mp", remaining = 2) {
  a.system.worldTime = 0;
  a.system.usagePeriods = { mission: "mission1", scene: "scene", session: "session" };
  a.system.classLevels = { schemer: 8 };
  a.system.abilities = { int: { mod: 2 } };
  a.system.bonusActionDice = {
    [id]: { ...masterPlanPool(a.system, masterPlanGainPlan(a.system), { id, periods: a.usagePeriods }), remaining }
  };
  a.system.actionDice.value = 0;
}
test("ordinary Requests can spend the exact cost from an unrestricted grant with no ordinary dice", async () => {
  const a = new SpycraftActor();
  requestPool(a);
  await a.allocateMissionReserves(initialize);
  const m = await a.rollGearAcquisition({ ...request, bonusPoolId: "mp" });
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.bonusActionDice.mp.remaining, 0);
  assert.equal(a.system.missionReserves.picks.R, 0);
  assert.equal(a.system.missionReserves.attempts[m.flags.spycraft2.gearAttempt.id].funding[0].bonusPoolId, "mp");
});
test("shared Requests preserve each funder source and refund their exact pools on rejected posts", async () => {
  const a = new SpycraftActor(),
    b = new SpycraftActor();
  b.uuid = "Actor.peer";
  requestPool(a, "one", 1);
  requestPool(b, "two", 1);
  await a.allocateMissionReserves(initialize);
  const input = {
    ...request,
    teammatesConfirmed: true,
    funding: [
      { actor: a, count: 1, bonusPoolId: "one" },
      { actor: b, count: 1, bonusPoolId: "two" }
    ]
  };
  postFails = true;
  try {
    await assert.rejects(a.rollGearAcquisition(input), /post failed/);
  } finally {
    postFails = false;
  }
  assert.equal(a.system.bonusActionDice.one.remaining, 1);
  assert.equal(b.system.bonusActionDice.two.remaining, 1);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(b.system.actionDice.value, 0);
  assert.equal(a.system.missionReserves.picks.R, 1);
  await a.rollGearAcquisition(input);
  assert.equal(a.system.bonusActionDice.one.remaining, 0);
  assert.equal(b.system.bonusActionDice.two.remaining, 0);
});
test("expired, check-bound, foreign and malformed Request funding cannot consume a reserve or another pool", async () => {
  for (const kind of ["expired", "bound", "foreign", "malformed"]) {
    const a = new SpycraftActor();
    requestPool(a);
    await a.allocateMissionReserves(initialize);
    let bonusPoolId = "mp";
    if (kind === "expired") a.system.bonusActionDice.mp.session = "other";
    if (kind === "bound") a.system.bonusActionDice.mp.source = "iKnowWhatDoing";
    if (kind === "foreign") bonusPoolId = "other";
    if (kind === "malformed") bonusPoolId = { id: "mp" };
    await assert.rejects(a.rollGearAcquisition({ ...request, bonusPoolId }));
    assert.equal(a.system.missionReserves.picks.R, 1);
    assert.equal(a.system.bonusActionDice.mp.remaining, 2);
  }
});
test("a Request post that committed before reporting failure retains one selected payment and reserve", async () => {
  const a = new SpycraftActor();
  requestPool(a);
  await a.allocateMissionReserves(initialize);
  const roll = a.rollCheck.bind(a),
    old = game.messages;
  game.messages = [];
  try {
    a.rollCheck = async (...args) => {
      const m = await roll(...args);
      game.messages.push(m);
      throw Error("post committed");
    };
    const m = await a.rollGearAcquisition({ ...request, bonusPoolId: "mp" });
    assert.equal(game.messages.length, 1);
    assert.equal(a.system.bonusActionDice.mp.remaining, 0);
    assert.equal(a.system.missionReserves.picks.R, 0);
    assert.equal(a.system.missionReserves.attempts[m.flags.spycraft2.gearAttempt.id].messageUuid, m.uuid);
  } finally {
    game.messages = old;
  }
});

async function claimFixture() {
  const a = new SpycraftActor();
  await a.allocateMissionReserves(initialize);
  rollTotal = 25;
  const m = await a.rollGearAcquisition(request);
  await a.finishCheck(m);
  return {
    a,
    options: {
      attemptId: m.flags.spycraft2.gearAttempt.id,
      itemData: { name: request.name, type: "gear", system: { gearCategory: "R", caliber: 2 } },
      delivered: true,
      gcConfirmed: true
    }
  };
}
test("committed acquisition creation and parent receipt errors introduce and link one item", async () => {
  for (const boundary of ["create", "receipt"]) {
    const { a, options } = await claimFixture(),
      create = a.createEmbeddedDocuments.bind(a),
      update = a.update.bind(a);
    let fired = false;
    a.createEmbeddedDocuments = async (...args) => {
      const docs = await create(...args);
      if (boundary === "create" && !fired) {
        fired = true;
        throw Error("creation committed");
      }
      return docs;
    };
    a.update = async patch => {
      await update(patch);
      if (boundary === "receipt" && Object.keys(patch).some(p => p.endsWith(".claimedItemId")) && !fired) {
        fired = true;
        throw Error("receipt committed");
      }
    };
    const item = await a.claimGearAcquisition(options);
    assert.equal(a.items.length, 1);
    assert.equal(a.system.missionReserves.attempts[options.attemptId].claimedItemId, item.id);
    await assert.rejects(a.claimGearAcquisition(options), /already claimed/);
    assert.equal(a.items.length, 1);
  }
});
test("a rejected acquisition parent receipt retains one stamped item and retries only its linkage", async () => {
  const { a, options } = await claimFixture(),
    update = a.update.bind(a);
  a.update = async patch => {
    if (Object.keys(patch).some(p => p.endsWith(".claimedItemId"))) throw Error("receipt rejected");
    return update(patch);
  };
  await assert.rejects(a.claimGearAcquisition(options), /receipt rejected/);
  assert.equal(a.items.length, 1);
  const id = a.items[0].id;
  assert.equal(a.system.missionReserves.attempts[options.attemptId].claimedItemId, "");
  a.update = update;
  const item = await a.claimGearAcquisition(options);
  assert.equal(item.id, id);
  assert.equal(a.items.length, 1);
  assert.equal(a.system.missionReserves.attempts[options.attemptId].claimedItemId, id);
});
test("failed item creation introduces nothing; duplicate acquisition references block further introductions", async () => {
  const { a, options } = await claimFixture(),
    create = a.createEmbeddedDocuments.bind(a);
  a.createEmbeddedDocuments = async () => {
    throw Error("creation rejected");
  };
  await assert.rejects(a.claimGearAcquisition(options), /creation rejected/);
  assert.equal(a.items.length, 0);
  a.createEmbeddedDocuments = create;
  const stamp = { epoch: a.system.missionReserves.epoch, attemptId: options.attemptId };
  a.items.push(
    { id: "one", type: "gear", system: { reserveAcquisition: stamp } },
    { id: "two", type: "gear", system: { reserveAcquisition: stamp } }
  );
  await assert.rejects(a.claimGearAcquisition(options), /Multiple items/);
  assert.equal(a.items.length, 2);
});

test("acquisition settlement reconciles rejected/committed chat writes without rolling back a committed result", async () => {
  for (const failure of ["before", "after"]) {
    const a = new SpycraftActor();
    await a.allocateMissionReserves(initialize);
    const m = await a.rollGearAcquisition(request),
      id = m.flags.spycraft2.gearAttempt.id,
      original = m.update.bind(m);
    let injected = false;
    m.update = async patch => {
      if (!injected) {
        injected = true;
        if (failure === "before") throw Error("chat rejected");
        await original(patch);
        throw Error("chat committed error");
      }
      return original(patch);
    };
    if (failure === "before") {
      await assert.rejects(a.finishCheck(m), /chat rejected/);
      assert.notEqual(m.flags.spycraft2.resolved, true);
      assert.equal(a.system.missionReserves.attempts[id].status, "pending");
    } else {
      const result = await a.finishCheck(m);
      assert.equal(result.status, "succeeded");
      assert.equal(m.flags.spycraft2.resolved, true);
    }
    const result = await a.finishCheck(m);
    assert.equal(result.status, "succeeded");
    assert.equal(result.delivery.total, 7);
    assert.equal(a.system.actionDice.value, 3);
    assert.equal(a.system.missionReserves.spent.R, 1);
  }
});
test("actor settlement errors preserve the final chat result and one frozen delivery; retry completes only the same record", async () => {
  for (const failure of ["before", "after"]) {
    const a = new SpycraftActor();
    await a.allocateMissionReserves(initialize);
    const m = await a.rollGearAcquisition(request),
      id = m.flags.spycraft2.gearAttempt.id,
      original = a.update.bind(a),
      evaluate = Roll.prototype.evaluate;
    let injected = false,
      deliveries = 0;
    Roll.prototype.evaluate = async function () {
      deliveries++;
      return evaluate.call(this);
    };
    a.update = async patch => {
      if (!injected && patch[`system.missionReserves.attempts.${id}`]?.settlementId) {
        injected = true;
        if (failure === "before") throw Error("actor rejected");
        await original(patch);
        throw Error("actor committed error");
      }
      return original(patch);
    };
    try {
      if (failure === "before") {
        await assert.rejects(a.finishCheck(m), /Retry Finish/);
        assert.equal(a.system.missionReserves.attempts[id].status, "pending");
        assert.equal(m.flags.spycraft2.resolved, true);
        assert.equal(await a.boostCheck(m, { count: 1 }), null);
      } else assert.equal((await a.finishCheck(m)).status, "succeeded");
      const receipt = structuredClone(m.flags.spycraft2.gearAttempt.settlement),
        result = await a.finishCheck(m);
      assert.equal(result.settlementId, receipt.id);
      assert.equal(deliveries, 1);
      assert.deepEqual(result.delivery, receipt.next.delivery);
      assert.deepEqual((await a.finishCheck(m)).delivery, result.delivery);
      assert.equal(deliveries, 1);
      assert.equal(a.system.actionDice.value, 3);
    } finally {
      Roll.prototype.evaluate = evaluate;
    }
  }
});
test("failed/Common Item settlements need no delivery roll and remain final after a failed actor write", async () => {
  for (const kind of ["failed", "common"]) {
    const a = new SpycraftActor();
    await a.allocateMissionReserves(initialize);
    rollTotal = kind === "common" ? 21 : 1;
    const m = await a.rollGearAcquisition(
        kind === "common" ? { kind: "common", name: "Flashlight", commonConfirmed: true, notIntel: true } : request
      ),
      id = m.flags.spycraft2.gearAttempt.id,
      original = a.update.bind(a),
      evaluate = Roll.prototype.evaluate;
    let deliveries = 0,
      inject = true;
    Roll.prototype.evaluate = async function () {
      deliveries++;
      return evaluate.call(this);
    };
    a.update = async patch => {
      if (inject && patch[`system.missionReserves.attempts.${id}`]?.settlementId) {
        inject = false;
        throw Error("actor rejected");
      }
      return original(patch);
    };
    try {
      await assert.rejects(a.finishCheck(m), /Retry Finish/);
      assert.equal(m.flags.spycraft2.resolved, true);
      const result = await a.finishCheck(m);
      assert.equal(result.success, kind === "common");
      assert.equal(result.delivery, null);
      assert.equal(deliveries, 0);
    } finally {
      Roll.prototype.evaluate = evaluate;
      rollTotal = 20;
    }
  }
});
test("replaced/secret/wrong-epoch acquisition checks cannot settle, and a changed source record is preserved", async () => {
  for (const change of ["replaced", "secret", "epoch", "record"]) {
    const a = new SpycraftActor();
    await a.allocateMissionReserves(initialize);
    const m = await a.rollGearAcquisition(request),
      id = m.flags.spycraft2.gearAttempt.id;
    if (change === "replaced") m.flags.spycraft2.superseded = "ChatMessage.replacement";
    if (change === "secret") {
      m.blind = true;
      game.user.isGM = false;
    }
    if (change === "epoch") m.flags.spycraft2.gearAttempt.epoch = "other";
    try {
      if (change === "record") {
        const original = m.update.bind(m);
        m.update = async patch => {
          await original(patch);
          a.system.missionReserves.attempts[id].name = "Independent newer name";
        };
      }
      await assert.rejects(
        finishAcquisition(a, m),
        change === "record" ? /record changed/ : /replacement|secret|earlier/
      );
      assert.equal(a.system.missionReserves.attempts[id].status, "pending");
      if (change === "record") assert.equal(a.system.missionReserves.attempts[id].name, "Independent newer name");
    } finally {
      game.user.isGM = true;
    }
  }
});
test("a changed frozen roll or malformed delivery receipt cannot be replayed into the actor", async () => {
  for (const change of ["roll", "delivery", "message", "identity"]) {
    const a = new SpycraftActor();
    await a.allocateMissionReserves(initialize);
    const m = await a.rollGearAcquisition(request),
      id = m.flags.spycraft2.gearAttempt.id,
      original = a.update.bind(a);
    let inject = true;
    a.update = async patch => {
      if (inject && patch[`system.missionReserves.attempts.${id}`]?.settlementId) {
        inject = false;
        throw Error("rejected");
      }
      return original(patch);
    };
    await assert.rejects(a.finishCheck(m), /Retry Finish/);
    const receipt = m.flags.spycraft2.gearAttempt.settlement;
    if (change === "roll") m.flags.spycraft2.effectiveTotal++;
    if (change === "delivery") {
      receipt.next.delivery.total = 0;
      m.flags.spycraft2.gearAttempt.delivery.total = 0;
    }
    if (change === "message") receipt.messageUuid = "ChatMessage.other";
    if (change === "identity") receipt.next.id = "other";
    await assert.rejects(a.finishCheck(m), /changed|review/);
    assert.equal(a.system.missionReserves.attempts[id].status, "pending");
    assert.equal(a.system.actionDice.value, 3);
  }
});
test("settlement retries preserve a claimed item link and never issue another delivery roll or gear item", async () => {
  const a = new SpycraftActor();
  await a.allocateMissionReserves(initialize);
  const m = await a.rollGearAcquisition(request),
    result = await a.finishCheck(m),
    id = result.id,
    item = await a.claimGearAcquisition({
      attemptId: id,
      itemData: { name: request.name, type: "gear", system: { gearCategory: "R", caliber: 2 } },
      delivered: true,
      gcConfirmed: true
    });
  const next = await a.finishCheck(m);
  assert.equal(next.claimedItemId, item.id);
  assert.equal(a.items.length, 1);
  assert.equal(next.settlementId, result.settlementId);
});

import { getReserveReview } from "../module/rules/reserve-transactions.mjs";
const reserveActor = () => {
  const a = new SpycraftActor();
  a.uuid = "Actor.reserve" + ++serial;
  return a;
};
test("Reserve reservation rejects before commitment without spending and continues after a proven committed error exactly once", async () => {
  for (const failure of ["before", "after"]) {
    const a = reserveActor();
    await a.allocateMissionReserves(initialize);
    const original = a.update.bind(a);
    let injected = false;
    a.update = async patch => {
      if (
        !injected &&
        patch["system.missionReserves"] &&
        Object.keys(patch["system.missionReserves"].attempts).length
      ) {
        injected = true;
        if (failure === "before") throw Error("reservation rejected");
        await original(patch);
        throw Error("reservation committed error");
      }
      return original(patch);
    };
    if (failure === "before") {
      await assert.rejects(a.rollGearAcquisition(request), /reservation rejected/);
      assert.equal(a.system.missionReserves.picks.R, 1);
      assert.equal(a.system.actionDice.value, 5);
      assert.equal(getReserveReview(a).needsReview, undefined);
    } else {
      const m = await a.rollGearAcquisition(request);
      assert.ok(m);
      assert.equal(a.system.actionDice.value, 3);
      assert.equal(a.system.missionReserves.picks.R, 0);
      assert.equal(Object.keys(a.system.missionReserves.attempts).length, 1);
    }
  }
});
test("failed posting restores only its own Reserve deltas and attempt, preserving independent balances, metadata and acquisitions", async () => {
  const a = reserveActor();
  await a.allocateMissionReserves(initialize);
  a.rollCheck = async () => {
    a.system.missionReserves.common += 2;
    a.system.missionReserves.picks.R += 1;
    a.system.missionReserves.notes = "Independent update";
    a.system.missionReserves.attempts.other = { id: "other", name: "Other independent acquisition" };
    throw Error("post rejected");
  };
  await assert.rejects(a.rollGearAcquisition(request), /post rejected/);
  assert.equal(a.system.missionReserves.picks.R, 2);
  assert.equal(a.system.missionReserves.spent.R, 0);
  assert.equal(a.system.missionReserves.common, 3);
  assert.equal(a.system.missionReserves.notes, "Independent update");
  assert.deepEqual(Object.keys(a.system.missionReserves.attempts), ["other"]);
  assert.equal(a.system.actionDice.value, 5);
  assert.equal(Object.values(a.flags.spycraft2.reserveRollbacks)[0].restored, true);
});
test("committed rollback errors are proven by the atomic rollback receipt without a second refund or a held review", async () => {
  const a = reserveActor();
  await a.allocateMissionReserves(initialize);
  const original = a.update.bind(a);
  a.update = async patch => {
    await original(patch);
    if (Object.keys(patch).some(k => k.startsWith("flags.spycraft2.reserveRollbacks.")))
      throw Error("committed rollback error");
  };
  a.rollCheck = async () => {
    throw Error("post rejected");
  };
  await assert.rejects(a.rollGearAcquisition(request), /post rejected/);
  assert.equal(a.system.actionDice.value, 5);
  assert.equal(a.system.missionReserves.picks.R, 1);
  assert.equal(a.system.missionReserves.spent.R, 0);
  assert.equal(getReserveReview(a).needsReview, undefined);
  assert.deepEqual(a.system.missionReserves.attempts, {});
});
async function heldReserve() {
  const a = reserveActor();
  await a.allocateMissionReserves(initialize);
  const original = a.update.bind(a);
  a.update = async patch => {
    if (Object.keys(patch).some(k => k.startsWith("flags.spycraft2.reserveRollbacks.")))
      throw Error("rollback rejected");
    return original(patch);
  };
  a.rollCheck = async () => {
    throw Error("post rejected");
  };
  await assert.rejects(a.rollGearAcquisition(request), /GC review/);
  a.update = original;
  return a;
}
test("uncertain restoration holds the Reserve across new attempts, allocation, claims and GC recovery; committed review errors keep the final absolute balances", async () => {
  const a = await heldReserve(),
    review = getReserveReview(a);
  assert.equal(review.needsReview, true);
  assert.equal(a.system.actionDice.value, 5);
  assert.equal(a.system.missionReserves.picks.R, 0);
  await assert.rejects(a.rollGearAcquisition(request), /review/);
  await assert.rejects(a.allocateMissionReserves(initialize), /review/);
  const original = a.update.bind(a);
  a.update = async patch => {
    await original(patch);
    if (patch["flags.spycraft2.reserveTransactionReview"]?.needsReview === false) throw Error("committed review error");
  };
  const result = await a.reviewReserveTransaction({
    values: review.fields.map(f => f.before),
    messageUuid: "",
    resolution: "No posted check; restore Reserve after confirmed refund",
    fundersSettled: true,
    confirmed: true
  });
  assert.equal(result.status, "cancelled");
  assert.equal(a.system.missionReserves.picks.R, 1);
  assert.equal(a.system.missionReserves.spent.R, 0);
  assert.equal(getReserveReview(a).needsReview, false);
  assert.equal(a.system.actionDice.value, 5);
  assert.equal(await a.reviewReserveTransaction({}), null);
});
test("changed ability use or acquisition source blocks restoration without erasing newer data", async () => {
  for (const change of ["use", "attempt"]) {
    const a = reserveActor();
    a.system = withRequestBenefits();
    const spec = { ...request, pick: "E", category: "E", requestAbility: "requestGeek" };
    a.rollCheck = async () => {
      const id = Object.keys(a.system.missionReserves.attempts)[0];
      if (change === "use") a.system.resourceUses.requestGeek.used += 1;
      else a.system.missionReserves.attempts[id].name = "Independent revised acquisition";
      throw Error("post rejected");
    };
    await assert.rejects(a.rollGearAcquisition(spec), /GC review/);
    assert.equal(getReserveReview(a).needsReview, true);
    assert.equal(a.system.missionReserves.picks.E, 0);
    if (change === "use") assert.equal(a.system.resourceUses.requestGeek.used, 2);
    else assert.equal(Object.values(a.system.missionReserves.attempts)[0].name, "Independent revised acquisition");
  }
});
test("Common Item and Charisma reservation rollbacks restore their exact counters and preserve unrelated categories", async () => {
  for (const kind of ["common", "charisma"]) {
    const a = reserveActor();
    await a.allocateMissionReserves(
      kind === "common"
        ? initialize
        : { picks: { CHA: 1 }, charismaPicks: { R: 1 }, common: 0, caliber: 2, intelComplete: true }
    );
    a.rollCheck = async () => {
      a.system.missionReserves.charismaPicks.T = 2;
      throw Error("post rejected");
    };
    await assert.rejects(
      a.rollGearAcquisition(
        kind === "common"
          ? { kind: "common", name: "Flashlight", commonConfirmed: true, notIntel: true }
          : { ...request, pick: "CHA" }
      ),
      /post rejected/
    );
    assert.equal(a.system.missionReserves.charismaPicks.T, 2);
    if (kind === "common") {
      assert.equal(a.system.missionReserves.common, 1);
      assert.equal(a.system.missionReserves.spentCommon, 0);
    } else {
      assert.equal(a.system.missionReserves.picks.CHA, 1);
      assert.equal(a.system.missionReserves.charismaPicks.R, 1);
      assert.equal(a.system.missionReserves.spent.CHA, 0);
    }
    assert.equal(a.system.actionDice.value, 5);
  }
});
test("GC Reserve reviews reject stale sources, changed roles and unconfirmed or malformed final balances", async () => {
  const a = await heldReserve(),
    review = getReserveReview(a),
    options = {
      values: review.fields.map(f => f.before),
      resolution: "Reviewed",
      fundersSettled: true,
      confirmed: true
    };
  for (const patch of [
    { confirmed: false },
    { fundersSettled: false },
    { values: [-1, 0] },
    { values: [true, 0] },
    { resolution: "" }
  ])
    await assert.rejects(a.reviewReserveTransaction({ ...options, ...patch }), /Confirm/);
  const previous = foundry.applications;
  foundry.applications = {
    api: {
      DialogV2: {
        input: async () => {
          a.system.missionReserves.picks.R++;
          return { ...options, field_0: 1, field_1: 0 };
        }
      }
    }
  };
  try {
    await assert.rejects(a.reviewReserveTransaction(), /sources changed/);
    assert.equal(getReserveReview(a).needsReview, true);
  } finally {
    foundry.applications = previous;
  }
  game.user.isGM = false;
  try {
    await assert.rejects(a.reviewReserveTransaction(options), /Only the GC/);
  } finally {
    game.user.isGM = true;
  }
});

test("Reserve setup distinguishes rejected writes from committed allocation errors and never allocates a second time", async () => {
  for (const failure of ["before", "after"]) {
    const a = reserveActor(),
      original = a.update.bind(a);
    a.update = async patch => {
      if (failure === "before") throw Error("allocation rejected");
      await original(patch);
      throw Error("allocation committed error");
    };
    if (failure === "before") {
      await assert.rejects(a.allocateMissionReserves(initialize), /allocation rejected/);
      assert.equal(a.system.missionReserves, undefined);
    } else {
      const record = await a.allocateMissionReserves(initialize);
      assert.deepEqual(a.system.missionReserves, record);
      assert.equal(a.system.actionDice.value, 5);
      await assert.rejects(a.allocateMissionReserves(initialize), /already/);
    }
  }
});

const shakenRequester = async (grade = 2) => {
  const a = reserveActor();
  a.flags = {};
  a.name = "QA requester";
  a.system.conditionContext = { shakenGrade: grade };
  a.system.worldTime = 0;
  a.system.vitality = { value: 4, max: 10 };
  a.system.wounds = { value: 4, max: 10 };
  await a.allocateMissionReserves(initialize);
  return a;
};
const grantRequestPool = a => {
  a.system.classLevels = { schemer: 8 };
  a.system.abilities = { int: { mod: 2 } };
  a.system.bonusActionDice = { mp: masterPlanPool(a.system, masterPlanGainPlan(a.system), { id: "mp" }) };
};
test("Request costs apply Shaken after ordinary, Veteran, Geek and Executive Decision base waivers; Common Item checks remain free", () => {
  for (const grade of [2, 3, 4]) {
    const s = withRequestBenefits();
    s.conditionContext = { shakenGrade: grade };
    const fee = grade === 2 ? 1 : 2;
    const ordinary = gearAcquisitionPlan(s, { ...request, availableFunding: 2 + fee });
    assert.equal(ordinary.baseCost, 2);
    assert.equal(ordinary.surcharge, fee);
    assert.equal(ordinary.cost, 2 + fee);
    for (const requestAbility of ["requestVeteran", "requestGeek", "requestExecutiveDecision"]) {
      const category = requestAbility === "requestGeek" ? "E" : "R",
        p = gearAcquisitionPlan(s, {
          ...request,
          pick: category,
          category,
          requestAbility,
          networkConfirmed: true,
          availableFunding: fee
        });
      assert.equal(p.baseCost, 0);
      assert.equal(p.surcharge, fee);
      assert.equal(p.cost, fee);
      assert.equal(p.automatic, requestAbility === "requestExecutiveDecision");
    }
    assert.equal(
      gearAcquisitionPlan(s, { kind: "common", name: "Flashlight", commonConfirmed: true, notIntel: true }).cost,
      0
    );
  }
});
test("actual Shaken Request funding can combine two wallets on one payer without nested same-Actor reservations", async () => {
  const a = await shakenRequester(2);
  grantRequestPool(a);
  a.system.actionDice.value = 1;
  const m = await a.rollGearAcquisition({
    ...request,
    funding: [
      { actor: a, count: 1 },
      { actor: a, count: 2, bonusPoolId: "mp" }
    ]
  });
  const attempt = a.system.missionReserves.attempts[m.flags.spycraft2.gearAttempt.id];
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.bonusActionDice.mp.remaining, 0);
  assert.equal(attempt.cost, 3);
  assert.equal(attempt.baseCost, 2);
  assert.equal(attempt.surcharge, 1);
  assert.equal(attempt.funding.length, 2);
  const record = Object.values(a.flags.spycraft2.actionDiePayments)[0];
  assert.equal(record.state, "spent");
  assert.equal(record.payments.length, 2);
  assert.equal(record.details.attemptId, attempt.id);
});
test("a Request charges the beneficiary’s fee once; a Shaken teammate may fund it without adding a donor surcharge", async () => {
  const a = await shakenRequester(2),
    b = reserveActor();
  b.system.conditionContext = { shakenGrade: 3 };
  a.system.actionDice.value = 1;
  b.system.actionDice.value = 2;
  await a.rollGearAcquisition({
    ...request,
    teammatesConfirmed: true,
    funding: [
      { actor: a, count: 1 },
      { actor: b, count: 2 }
    ]
  });
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(b.system.actionDice.value, 0);
  assert.equal(a.system.missionReserves.picks.R, 0);
});
test("Shaken IV beneficiaries may receive fully teammate-funded Requests but cannot contribute their own dice", async () => {
  const a = await shakenRequester(4),
    b = reserveActor();
  a.system.actionDice.value = 4;
  b.system.actionDice.value = 4;
  await assert.rejects(a.rollGearAcquisition(request), /Shaken IV/);
  assert.equal(a.system.actionDice.value, 4);
  assert.equal(a.system.missionReserves.picks.R, 1);
  const m = await a.rollGearAcquisition({ ...request, teammatesConfirmed: true, funding: [{ actor: b, count: 4 }] });
  assert.ok(m);
  assert.equal(a.system.actionDice.value, 4);
  assert.equal(b.system.actionDice.value, 0);
  const attempt = Object.values(a.system.missionReserves.attempts)[0];
  assert.equal(attempt.cost, 4);
  assert.equal(attempt.surcharge, 2);
});
test("Shaken IV funders and insufficient combined budgets are rejected before reserving gear or ability uses", async () => {
  const a = await shakenRequester(2),
    b = reserveActor();
  b.system.actionDice.value = 3;
  b.system.conditionContext = { shakenGrade: 4 };
  await assert.rejects(
    a.rollGearAcquisition({ ...request, teammatesConfirmed: true, funding: [{ actor: b, count: 3 }] }),
    /Shaken IV/
  );
  assert.equal(a.system.missionReserves.picks.R, 1);
  assert.deepEqual(a.system.missionReserves.attempts, {});
  a.system.actionDice.value = 2;
  await assert.rejects(a.rollGearAcquisition(request), /funder/);
  assert.equal(a.system.actionDice.value, 2);
  await assert.rejects(a.rollGearAcquisition({ ...request, funding: [{ actor: a, count: 2 }] }), /total/);
});
test("actual waived rolled Requests pay only the Shaken fee and retain a single use and pick", async () => {
  const a = reserveActor();
  a.flags = {};
  a.system = withRequestBenefits();
  a.system.conditionContext = { shakenGrade: 2 };
  a.system.actionDice.value = 1;
  const m = await a.rollGearAcquisition({ ...request, requestAbility: "requestVeteran" });
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.resourceUses.requestVeteran.used, 1);
  const attempt = a.system.missionReserves.attempts[m.flags.spycraft2.gearAttempt.id];
  assert.equal(attempt.baseCost, 0);
  assert.equal(attempt.surcharge, 1);
  assert.equal(attempt.cost, 1);
  assert.equal(attempt.automatic, false);
});
test("Executive Decision remains automatic while paying its post-waiver surcharge and rolling only delivery", async () => {
  const a = reserveActor();
  a.flags = {};
  a.system = withRequestBenefits();
  a.system.conditionContext = { shakenGrade: 3 };
  a.system.actionDice.value = 2;
  const original = ChatMessage.create;
  let posts = 0;
  ChatMessage.create = async data => {
    posts++;
    return { ...data, uuid: "ChatMessage.executiveShaken" };
  };
  try {
    const m = await a.rollGearAcquisition({
      ...request,
      requestAbility: "requestExecutiveDecision",
      networkConfirmed: true
    });
    const attempt = a.system.missionReserves.attempts[m.flags.spycraft2.gearAttempt.id];
    assert.equal(posts, 1);
    assert.equal(m.flags.spycraft2.resolved, true);
    assert.equal(m.flags.spycraft2.rawTotal, undefined);
    assert.equal(attempt.success, true);
    assert.equal(attempt.baseCost, 0);
    assert.equal(attempt.surcharge, 2);
    assert.equal(attempt.cost, 2);
    assert.equal(attempt.delivery.total, 7);
    assert.equal(a.system.actionDice.value, 0);
    assert.equal(a.system.resourceUses.requestExecutiveDecision.used, 1);
    assert.match(m.content, /2 action dice spent \(2 Shaken surcharge\)/);
  } finally {
    ChatMessage.create = original;
  }
});
test("rejected Shaken Request posts refund all wallets and restore only their own Reserve/use changes", async () => {
  const a = await shakenRequester(2);
  grantRequestPool(a);
  a.system.actionDice.value = 1;
  a.rollCheck = async () => {
    a.system.missionReserves.picks.E--;
    throw Error("Request post rejected");
  };
  await assert.rejects(
    a.rollGearAcquisition({
      ...request,
      funding: [
        { actor: a, count: 1 },
        { actor: a, count: 2, bonusPoolId: "mp" }
      ]
    }),
    /post rejected/
  );
  assert.equal(a.system.actionDice.value, 1);
  assert.equal(a.system.bonusActionDice.mp.remaining, 2);
  assert.equal(a.system.missionReserves.picks.R, 1);
  assert.equal(a.system.missionReserves.picks.E, 0);
  assert.deepEqual(a.system.missionReserves.attempts, {});
  assert.equal(Object.values(a.flags.spycraft2.actionDiePayments)[0].state, "refunded");
});
test("failed shared Request refunds hold every unsettled payer and the beneficiary Reserve rather than repeating the request", async () => {
  const a = await shakenRequester(2),
    b = reserveActor();
  a.system.actionDice.value = 1;
  b.system.actionDice.value = 2;
  a.rollCheck = async () => {
    throw Error("post rejected");
  };
  const original = b.update.bind(b);
  b.update = async patch => {
    if (Object.values(patch).some(v => v?.state === "refunded")) throw Error("refund rejected");
    return original(patch);
  };
  await assert.rejects(
    a.rollGearAcquisition({
      ...request,
      teammatesConfirmed: true,
      funding: [
        { actor: a, count: 1 },
        { actor: b, count: 2 }
      ]
    })
  );
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(b.system.actionDice.value, 0);
  assert.equal(a.flags.spycraft2.actionDiceSettlementReview.needsReview, true);
  assert.equal(b.flags.spycraft2.actionDiceSettlementReview.needsReview, true);
  assert.equal(getReserveReview(a).needsReview, true);
  assert.equal(a.system.missionReserves.picks.R, 0);
});
test("a posted Request remains consumed when its final payer marker fails; its recovered review includes the attempt", async () => {
  const a = await shakenRequester(2),
    original = a.update.bind(a);
  a.update = async patch => {
    if (Object.values(patch).some(v => v?.state === "spent")) throw Error("final marker rejected");
    return original(patch);
  };
  const m = await a.rollGearAcquisition(request);
  assert.ok(m);
  assert.equal(a.system.actionDice.value, 2);
  assert.equal(a.system.missionReserves.picks.R, 0);
  assert.equal(a.flags.spycraft2.actionDiceSettlementReview.needsReview, true);
  assert.equal(a.flags.spycraft2.actionDiceSettlementReview.recipientActorUuid, a.uuid);
  assert.equal(a.flags.spycraft2.actionDiceSettlementReview.attemptId, m.flags.spycraft2.gearAttempt.id);
  assert.equal(a.flags.spycraft2.actionDiceSettlementReview.callbackCompleted, true);
});

import { gearCheckPlan } from "../module/rules/gear-checks.mjs";
import { improvisedSearchPlan } from "../module/rules/improvised-weapons.mjs";
import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
function withStash(s) {
  s.activeFeatNames = ["Pack Rat", "Personal Stash"];
  s.activeFeatSelections = [
    { name: "Pack Rat", tree: "gear", choice: "" },
    { name: "Personal Stash", tree: "gear", choice: "" }
  ];
  return s;
}
const homeCommon = { kind: "common", name: "Flashlight", commonConfirmed: true, notIntel: true, atHome: true };
test("Personal Stash counts every active Gear feat selection only inside the home, independent of the wider Home Turf area", () => {
  for (let extra = 0; extra <= 12; extra++) {
    const s = withStash(system());
    s.activeFeatSelections.push(
      ...Array.from({ length: extra }, (_, i) => ({ name: "Favored Gear", tree: "gear", choice: "Item " + i })),
      { name: "Scholar", tree: "basicSkill" },
      { name: "Home Turf", tree: "terrain" }
    );
    const before = structuredClone(s),
      p = gearCheckPlan(s, { atHome: true });
    assert.equal(p.personalStashBonus, 2 + extra);
    assert.equal(p.bonus, 9 + extra);
    assert.deepEqual(s, before);
    for (const atHome of [false, "true", 1, undefined])
      assert.equal(gearCheckPlan(s, { atHome, homeTurf: true }).bonus, 7);
  }
  const s = withStash(system());
  s.activeFeatNames = ["Pack Rat"];
  assert.equal(gearCheckPlan(s, { atHome: true }).bonus, 7);
  s.activeFeatNames.push("Personal Stash");
  s.activeFeatSelections = [];
  assert.throws(() => gearCheckPlan(s, { atHome: true }), /active Gear feat/);
});
test("the same home Gear bonus applies to Common Item and improvised checks, stacks with Basics and never changes a Request bonus", () => {
  const s = withStash(system());
  s.missionReserves = reserveInitialization(s, [], initialize);
  assert.equal(gearAcquisitionPlan(s, homeCommon).bonus, 9);
  assert.equal(gearAcquisitionPlan(s, { ...homeCommon, atHome: false }).bonus, 7);
  assert.equal(gearAcquisitionPlan(s, { ...request, atHome: true }).bonus, 9);
  assert.equal(gearAcquisitionPlan(s, { ...request, atHome: true }).gearCheckContext, undefined);
  s.activeFeatNames.push("Improvised Weapon Basics");
  assert.equal(improvisedSearchPlan(s, { nonBarrenConfirmed: true, atHome: true }).bonus, 12);
  assert.equal(improvisedSearchPlan(s, { nonBarrenConfirmed: true }).bonus, 10);
});
test("actual Common Item checks save the home bonus and preserve ordinary Reserve and action-die costs", async () => {
  const a = reserveActor();
  withStash(a.system);
  await a.allocateMissionReserves(initialize);
  const m = await a.rollGearAcquisition(homeCommon),
    c = m.flags.spycraft2;
  assert.equal(c.rollData.total, 9);
  assert.equal(c.gearCheckContext.personalStashBonus, 2);
  assert.equal(a.system.actionDice.value, 5);
  assert.equal(a.system.missionReserves.common, 0);
  assert.equal(a.system.missionReserves.spentCommon, 1);
  assert.equal(a.system.missionReserves.attempts[c.gearAttempt.id].gearCheckContext.atHome, true);
  const e = rollEvidence(c),
    changed = structuredClone(c);
  changed.gearCheckContext.atHome = false;
  assert.equal(rollEvidenceMatches(e, changed), false);
});
test("losing the home feat or changing its Gear selection count during actual RNG prevents posting and restores the reserved Common Item", async () => {
  for (const kind of ["source", "count"]) {
    const a = reserveActor();
    withStash(a.system);
    await a.allocateMissionReserves(initialize);
    const evaluate = Roll.prototype.evaluate;
    Roll.prototype.evaluate = async function (...args) {
      const r = await evaluate.apply(this, args);
      if (kind === "source") a.system.activeFeatNames = ["Pack Rat"];
      else a.system.activeFeatSelections.push({ name: "Favored Gear", tree: "gear", choice: "New item" });
      return r;
    };
    try {
      await assert.rejects(a.rollGearAcquisition(homeCommon), /home Gear check bonus/);
      assert.equal(a.system.missionReserves.common, 1);
      assert.equal(a.system.missionReserves.spentCommon, 0);
      assert.equal(a.system.actionDice.value, 5);
      assert.equal(Object.keys(a.system.missionReserves.attempts).length, 0);
    } finally {
      Roll.prototype.evaluate = evaluate;
    }
  }
});

import { limitedUseAbilities } from "../module/rules/limited-uses.mjs";
function stashSystem() {
  const s = withStash(system());
  s.resourceUses = {};
  s.actionDice.value = 0;
  s.limitedUses = limitedUseAbilities(s, [], cfg);
  s.missionReserves = reserveInitialization(s, [], { picks: {}, common: 0, caliber: 1, intelComplete: true });
  return s;
}
const stashUse = { ...homeCommon, usePersonalStash: true };
test("Personal Stash waives only one Common Item check per session inside home, including an empty Reserve and no action dice", () => {
  const s = stashSystem(),
    p = gearAcquisitionPlan(s, stashUse);
  assert.equal(p.commonCost, 0);
  assert.equal(p.cost, 0);
  assert.equal(p.record.common, 0);
  assert.equal(p.record.spentCommon, 0);
  assert.equal(p.abilityId, "personalStash");
  assert.equal(p.abilityRecord.used, 1);
  assert.equal(p.abilityRecord.epoch, "initial");
  for (const patch of [{ atHome: false }, { atHome: "true" }, { commonConfirmed: false }, { usePersonalStash: "true" }])
    assert.throws(() => gearAcquisitionPlan(s, { ...stashUse, ...patch }));
  assert.throws(() => gearAcquisitionPlan(s, { ...request, usePersonalStash: true }), /not a Request/);
  s.resourceUses.personalStash = p.abilityRecord;
  assert.throws(() => gearAcquisitionPlan(s, stashUse), /no uses/);
  s.usagePeriods.mission = "another";
  s.missionReserves.epoch = "another";
  assert.throws(() => gearAcquisitionPlan(s, stashUse), /no uses/);
  s.usagePeriods.session = "next";
  assert.equal(gearAcquisitionPlan(s, stashUse).abilityRecord.used, 1);
});
test("actual waived Common Item checks consume the session allowance on failure too, preserve all Reserve balances and add no Shaken fee", async () => {
  for (const grade of [0, 2, 3, 4]) {
    const a = reserveActor();
    a.system = stashSystem();
    a.system.conditionContext = { shakenGrade: grade };
    rollTotal = 20;
    const m = await a.rollGearAcquisition(stashUse);
    assert.equal(m.flags.spycraft2.gearAllowance.commonCost, 0);
    assert.equal(a.system.resourceUses.personalStash.used, 1);
    assert.equal(a.system.missionReserves.common, 0);
    assert.equal(a.system.missionReserves.spentCommon, 0);
    assert.equal(a.system.actionDice.value, 0);
    const result = await a.finishCheck(m);
    assert.equal(result.success, false);
    await assert.rejects(a.rollGearAcquisition(stashUse), /no uses/);
  }
});
test("concurrent Stash searches reserve one session allowance and leave zero-Reserve balances unchanged", async () => {
  const a = reserveActor();
  a.system = stashSystem();
  const r = await Promise.allSettled([a.rollGearAcquisition(stashUse), a.rollGearAcquisition(stashUse)]);
  assert.equal(r.filter(x => x.status === "fulfilled").length, 1);
  assert.equal(a.system.resourceUses.personalStash.used, 1);
  assert.equal(Object.keys(a.system.missionReserves.attempts).length, 1);
  assert.equal(a.system.missionReserves.spentCommon, 0);
});
test("failed posts, lost home sources and native-style nonreceipt returns restore the Stash allowance as well as its pending attempt", async () => {
  for (const kind of ["post", "source", "notification"]) {
    const a = reserveActor();
    a.system = stashSystem();
    const evaluate = Roll.prototype.evaluate;
    if (kind === "post") postFails = true;
    if (kind === "source")
      Roll.prototype.evaluate = async function (...args) {
        const r = await evaluate.apply(this, args);
        a.system.activeFeatNames = ["Pack Rat"];
        return r;
      };
    if (kind === "notification") a.rollCheck = async () => ({ id: "native-notification" });
    try {
      await assert.rejects(a.rollGearAcquisition(stashUse), /post failed|home Gear check|did not post/);
      assert.equal(a.system.resourceUses.personalStash, undefined);
      assert.equal(Object.keys(a.system.missionReserves.attempts).length, 0);
      assert.equal(a.system.missionReserves.common, 0);
      assert.equal(a.system.missionReserves.spentCommon, 0);
    } finally {
      postFails = false;
      Roll.prototype.evaluate = evaluate;
    }
  }
});
test("Stash source reacquisition cannot refresh its spent use, and saved allowance evidence cannot change while outcomes are pending", async () => {
  const a = reserveActor();
  a.system = stashSystem();
  const m = await a.rollGearAcquisition(stashUse),
    e = rollEvidence(m.flags.spycraft2);
  a.system.activeFeatNames = ["Pack Rat"];
  a.system.limitedUses = limitedUseAbilities(a.system, [], cfg);
  withStash(a.system);
  a.system.limitedUses = limitedUseAbilities(a.system, [], cfg);
  await assert.rejects(a.rollGearAcquisition(stashUse), /no uses/);
  const changed = structuredClone(m.flags.spycraft2);
  changed.gearAllowance.commonCost = 1;
  assert.equal(rollEvidenceMatches(e, changed), false);
});

test("a free Stash check can begin without an allocation, while ordinary checks cannot treat its claim ledger as allocated Reserves", () => {
  const s = stashSystem();
  delete s.missionReserves;
  const p = gearAcquisitionPlan(s, stashUse);
  assert.equal(p.provisionalCreated, true);
  assert.equal(p.record.initialized, false);
  assert.equal(p.record.common, 0);
  assert.equal(p.commonCost, 0);
  assert.equal(p.record.initializationSource, "personalStash");
  for (const input of [request, homeCommon, { ...stashUse, atHome: false }])
    assert.throws(() => gearAcquisitionPlan(s, input));
  s.missionReserves = p.record;
  assert.throws(() => gearAcquisitionPlan(s, request), /Allocate/);
  assert.throws(() => gearAcquisitionPlan(s, homeCommon), /Allocate/);
  for (const tamper of [
    r => (r.common = 1),
    r => (r.picks.R = 1),
    r => (r.spentCommon = 1),
    r => (r.initializationSource = "intel"),
    r => (r.attempts.forged = { id: "forged", epoch: r.epoch, kind: "request", cost: 0 })
  ]) {
    const bad = structuredClone(p.record);
    tamper(bad);
    assert.throws(
      () =>
        reserveInitialization({ ...s, missionReserves: bad }, [], {
          picks: {},
          common: 0,
          caliber: 1,
          intelComplete: true
        }),
      /provisional/
    );
  }
});
test("an unallocated Stash success can settle and claim, then ordinary allocation preserves its attempt, item reference and used allowance", async () => {
  const a = reserveActor();
  a.system = stashSystem();
  delete a.system.missionReserves;
  rollTotal = 21;
  const m = await a.rollGearAcquisition(stashUse),
    id = m.flags.spycraft2.gearAttempt.id;
  assert.equal(a.system.missionReserves.initialized, false);
  assert.equal(a.system.resourceUses.personalStash.used, 1);
  await a.finishCheck(m);
  const item = await a.claimGearAcquisition({
    attemptId: id,
    gcConfirmed: true,
    itemData: { name: "Flashlight", type: "gear", system: { common: true, caliber: 0, weight: 1 } }
  });
  await a.allocateMissionReserves({ picks: { R: 1 }, common: 1, caliber: 1, intelComplete: true });
  assert.equal(a.system.missionReserves.initialized, true);
  assert.equal(a.system.missionReserves.attempts[id].claimedItemId, item.id);
  assert.equal(managedAcquisition(a.system, item), true);
  assert.equal(a.system.resourceUses.personalStash.used, 1);
  assert.equal(a.system.missionReserves.common, 1);
  await assert.rejects(a.allocateMissionReserves(initialize), /already/);
});
test("a failed first Stash post restores the use and leaves only an empty nonallocated ledger that may still be allocated normally", async () => {
  const a = reserveActor();
  a.system = stashSystem();
  delete a.system.missionReserves;
  postFails = true;
  try {
    await assert.rejects(a.rollGearAcquisition(stashUse), /post failed/);
  } finally {
    postFails = false;
  }
  assert.equal(a.system.resourceUses.personalStash, undefined);
  assert.equal(a.system.missionReserves.initialized, false);
  assert.deepEqual(a.system.missionReserves.attempts, {});
  await a.allocateMissionReserves(initialize);
  assert.equal(a.system.missionReserves.initialized, true);
});
test("a rejected bootstrap write proves its prior empty ledger and does not create a false interrupted-Reserve review", async () => {
  const a = reserveActor();
  a.system = stashSystem();
  delete a.system.missionReserves;
  const update = a.update.bind(a);
  a.update = async patch => {
    if (patch["system.missionReserves"]?.initialized === false) throw Error("Bootstrap write rejected");
    return update(patch);
  };
  await assert.rejects(a.rollGearAcquisition(stashUse), /Bootstrap write rejected/);
  assert.equal(a.system.missionReserves, undefined);
  assert.equal(a.system.resourceUses.personalStash, undefined);
  assert.equal(a.flags?.spycraft2?.reserveTransactionReview?.needsReview ?? false, false);
});
test("bootstrapping a new mission archives its previous ledger and removes old attempt keys without losing the new Stash claim", async () => {
  const a = reserveActor();
  a.system = stashSystem();
  const old = structuredClone(a.system.missionReserves);
  old.attempts.old = { id: "old", epoch: old.epoch, kind: "request", name: "Old mission record" };
  const oldSnapshot = structuredClone(old);
  a.system.missionReserves = old;
  a.system.usagePeriods.mission = "new-mission";
  const m = await a.rollGearAcquisition(stashUse),
    id = m.flags.spycraft2.gearAttempt.id;
  assert.equal(a.system.missionReserveHistory.length, 1);
  assert.deepEqual(a.system.missionReserveHistory[0], oldSnapshot);
  assert.deepEqual(Object.keys(a.system.missionReserves.attempts), [id]);
  await a.allocateMissionReserves(initialize);
  assert.equal(a.system.missionReserveHistory.length, 1);
  assert.deepEqual(Object.keys(a.system.missionReserves.attempts), [id]);
});

const officeSystem = (count = 2) => {
  const s = system();
  s.activeFeatNames = ["Office Gossip", "Career Agent"];
  s.activeFeatSelections = Array.from({ length: count }, (_, i) => ({
    name: i === 0 ? "Office Gossip" : i === 1 ? "Career Agent" : "Other Tradecraft " + i,
    tree: "tradecraft"
  }));
  s.resourceUses = {};
  s.actionDice.value = 0;
  s.limitedUses = requestSources(s);
  return s;
};
test("Office Gossip has one mission Request waiver per active Tradecraft selection, including itself and independent repeated selections", () => {
  for (let count = 0; count <= 20; count++) {
    const s = officeSystem(count);
    s.activeFeatSelections.push({ name: "Unrelated", tree: "gear" });
    const source = requestSources(s).find(r => r.id === "requestOfficeGossip");
    assert.equal(source.limit, count);
    assert.equal(source.period, "mission");
    assert.equal(source.cost, 0);
    assert.equal(source.automatic, undefined);
    s.missionReserves = reserveInitialization(s, [], initialize);
    if (count) {
      const p = gearAcquisitionPlan(s, { ...request, requestAbility: source.id });
      assert.equal(p.cost, 0);
      assert.equal(p.automatic, false);
      assert.equal(p.record.picks.R, 0);
      assert.equal(p.requestBenefit.source.limit, count);
    } else assert.throws(() => gearAcquisitionPlan(s, { ...request, requestAbility: source.id }), /no uses/);
  }
  const s = officeSystem();
  s.activeFeatNames = [];
  assert.equal(
    requestSources(s).some(r => r.id === "requestOfficeGossip"),
    false
  );
});
test("Office Gossip actual Requests retain used history across source reacquisition and consume Reserve picks even on a failed final result", async () => {
  const a = reserveActor();
  a.system = officeSystem();
  await a.allocateMissionReserves({ picks: { R: 3 }, common: 0, caliber: 2, intelComplete: true });
  const input = { ...request, requestAbility: "requestOfficeGossip" };
  rollTotal = 1;
  for (let n = 1; n <= 2; n++) {
    const m = await a.rollGearAcquisition(input);
    assert.equal(m.flags.spycraft2.requestBenefit.id, "requestOfficeGossip");
    assert.equal(a.system.resourceUses.requestOfficeGossip.used, n);
    assert.equal(a.system.actionDice.value, 0);
    const settled = await a.finishCheck(m);
    assert.equal(settled.success, false);
  }
  assert.equal(a.system.missionReserves.picks.R, 1);
  a.system.limitedUses = [];
  await assert.rejects(a.rollGearAcquisition(input), /not currently/);
  a.system.limitedUses = requestSources(a.system);
  await assert.rejects(a.rollGearAcquisition(input), /no uses/);
  assert.equal(a.system.missionReserves.picks.R, 1);
});
test("Office Gossip quotes one Shaken surcharge per Request after its base waiver, including when teammates must fund Shaken IV", () => {
  for (const [grade, fee] of [
    [0, 0],
    [1, 0],
    [2, 1],
    [3, 2],
    [4, 2]
  ]) {
    const s = officeSystem();
    s.conditionContext = { shakenGrade: grade };
    s.actionDice.value = 3;
    s.missionReserves = reserveInitialization(s, [], initialize);
    {
      const p = gearAcquisitionPlan(s, { ...request, requestAbility: "requestOfficeGossip" });
      assert.equal(p.baseCost, 0);
      assert.equal(p.cost, fee);
      assert.equal(p.surcharge, fee);
    }
  }
});
test("Request benefit source or allowance changes during RNG refund the waiver and Reserve, with no receipt posted", async () => {
  const original = Roll.prototype.evaluate;
  for (const phase of ["source", "count", "period"]) {
    const a = reserveActor();
    a.system = officeSystem();
    await a.allocateMissionReserves(initialize);
    let posted = false;
    const toMessage = Roll.prototype.toMessage;
    Roll.prototype.toMessage = async function (...args) {
      posted = true;
      return toMessage.apply(this, args);
    };
    Roll.prototype.evaluate = async function () {
      if (phase === "source") a.system.limitedUses = [];
      if (phase === "count") a.system.limitedUses[0].limit++;
      if (phase === "period") a.system.usagePeriods.mission = "later";
      return this;
    };
    try {
      await assert.rejects(
        a.rollGearAcquisition({ ...request, requestAbility: "requestOfficeGossip" }),
        /Request benefit|no longer/
      );
      assert.equal(posted, false);
      assert.equal(a.system.resourceUses.requestOfficeGossip?.used ?? 0, 0);
      assert.equal(a.system.missionReserves.picks.R, 1);
      assert.deepEqual(a.system.missionReserves.attempts, {});
    } finally {
      Roll.prototype.evaluate = original;
      Roll.prototype.toMessage = toMessage;
    }
  }
});

test("settled Request replay rejects newly added modern source markers without rerolling delivery or changing reserves/payment", async () => {
  for (const patch of [
    { trackingFeat: { version: 1 } },
    { trackingMasteryTask: { version: 1 } },
    { criticalActivation: { jinx: { version: 1 } } },
    { terrainSaveSource: { version: 1 } },
    { oldSchool: { version: 1 } }
  ]) {
    const a = new SpycraftActor();
    await a.allocateMissionReserves(initialize);
    rollTotal = 25;
    const m = await a.rollGearAcquisition(request);
    await a.finishCheck(m);
    const before = structuredClone(a.system.missionReserves),
      dice = a.system.actionDice.value,
      receipt = structuredClone(m.flags.spycraft2.gearAttempt.settlement);
    Object.assign(m.flags.spycraft2, patch);
    await assert.rejects(() => a.finishCheck(m), /changed|invalid receipt/);
    assert.deepEqual(a.system.missionReserves, before);
    assert.equal(a.system.actionDice.value, dice);
    assert.deepEqual(m.flags.spycraft2.gearAttempt.settlement, receipt);
    assert.equal(a.items.length, 0);
  }
});
test("Political Clout, Favors and Immunity: once per mission, automatic, no action dice and immediately available", async () => {
  const { IMMEDIATE_DELIVERY } = await import("../module/rules/gear-acquisition.mjs");
  const feats = ["Political Clout", "Political Favors", "Political Immunity"],
    specs = requestSources({ activeFeatNames: feats }, []);
  assert.deepEqual(
    specs.map(s => [s.id, s.category, s.period, s.limit, s.automatic, s.immediate]),
    [
      ["requestPoliticalClout", "S", "mission", 1, true, true],
      ["requestPoliticalFavors", "R", "mission", 1, true, true],
      ["requestPoliticalImmunity", "R", "mission", 1, true, true]
    ]
  );
  assert.match(specs[1].name, /extradition Resource \(Power Rating 6\)/);
  assert.equal(requestSources({ activeFeatNames: [] }, []).length, 0);
  const s = system();
  s.activeFeatNames = feats;
  s.resourceUses = {};
  s.limitedUses = requestSources(s, []);
  s.missionReserves = reserveInitialization(s, [], initialize);
  s.actionDice.value = 0;
  const input = { ...request, requestAbility: "requestPoliticalImmunity", networkConfirmed: true };
  const p = gearAcquisitionPlan(s, input);
  assert.equal(p.cost, 0);
  assert.equal(p.automatic, true);
  assert.equal(p.delivery, IMMEDIATE_DELIVERY);
  assert.equal(p.abilityRecord.epoch, "mission1");
  assert.throws(() => gearAcquisitionPlan(s, { ...input, requestAbility: "requestPoliticalClout" }), /category/);
  s.resourceUses.requestPoliticalImmunity = { epoch: "mission1", used: 1 };
  assert.throws(() => gearAcquisitionPlan(s, input), /no uses/);
  assert.equal(DELIVERY.largeCity.formula, "3d20", "ordinary delivery is unchanged");
});
