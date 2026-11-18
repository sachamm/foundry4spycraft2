import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  hasImprovisation,
  improvisationPlan,
  managedClassGearGrant,
  classGearWarnings
} from "../module/rules/class-gear.mjs";
import { reserveInitialization } from "../module/rules/gear-acquisition.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const state = () => ({
  classOptionSelections: [{ classId: "intruder", name: "Improvisation" }],
  classGearGrants: {},
  resourceUses: {},
  usagePeriods: { mission: "m" },
  actionDice: { max: 2, value: 0 },
  limitedUses: [
    { id: "improvisation", name: "Improvisation", limit: 2, cost: 0, period: "mission", workflow: "improvisation" }
  ]
});
const input = { name: "Lockpick", weight: 0.1, commonConfirmed: true, fullActionConfirmed: true };
test("RAW p.38 Improvisation requires its actual earned option, Common Item confirmation and a full action", () => {
  assert.equal(hasImprovisation(state()), true);
  assert.equal(hasImprovisation({ classLevels: { intruder: 20 } }), false);
  for (const patch of [
    { name: "" },
    { weight: -1 },
    { weight: Infinity },
    { commonConfirmed: false },
    { commonConfirmed: "yes" },
    { fullActionConfirmed: false },
    { id: "bad.path" }
  ])
    assert.throws(() => improvisationPlan(state(), { ...input, id: "new", ...patch }));
  assert.throws(() => improvisationPlan({}, { ...input, id: "new" }), /earned/);
  const s = state();
  s.classGearGrants.new = {};
  assert.throws(() => improvisationPlan(s, { ...input, id: "new" }), /unique/);
});
test("physical class-granted objects retain provenance after the source is lost, while changed quantities/acquisitions or an old mission require review", () => {
  const s = state(),
    p = improvisationPlan(s, { ...input, id: "grant" }),
    item = {
      id: "item",
      name: "Lockpick",
      type: "gear",
      system: { common: true, caliber: 0, quantity: 1, classGearGrant: p.stamp }
    };
  s.classGearGrants.grant = { ...p.record, itemId: item.id };
  assert.equal(managedClassGearGrant(s, item), true);
  s.classOptionSelections = [];
  assert.equal(managedClassGearGrant(s, item), true);
  assert.equal(classGearWarnings(s, [item]).length, 0);
  s.usagePeriods.mission = "next";
  assert.match(classGearWarnings(s, [item]).join(""), /earlier mission/);
  for (const patch of [
    { quantity: 2 },
    { pick: "S" },
    { possessionSource: "wealth" },
    { reserveAcquisition: {} },
    { reserve: true },
    { caliber: 1 }
  ])
    assert.equal(managedClassGearGrant(s, { ...item, system: { ...item.system, ...patch } }), false);
  assert.equal(managedClassGearGrant(s, { ...item, id: "copied" }), false);
});
test("improvised Common Items do not spend the ordinary Intel Common Item allowance or reduce available foresight reserves", () => {
  const s = {
      ...state(),
      gearPicks: Object.fromEntries(["R", "T", "V", "S", "G", "W", "E", "CHA"].map(k => [k, { remaining: 0 }])),
      commonItems: { count: 0, perMission: 1 },
      reserveCapacity: 1
    },
    p = improvisationPlan(state(), { ...input, id: "grant" }),
    item = { id: "item", type: "gear", system: { common: true, caliber: 0, quantity: 1, classGearGrant: p.stamp } };
  s.classGearGrants.grant = { ...p.record, itemId: "item" };
  assert.equal(reserveInitialization(s, [item], { common: 1, intelComplete: true }).common, 1);
  assert.throws(
    () =>
      reserveInitialization(s, [{ ...item, system: { ...item.system, classGearGrant: null } }], {
        common: 1,
        intelComplete: true
      }),
    /Common Items/
  );
});
let serial = 0,
  mission = "m",
  posts = [],
  warnings = [],
  failCreate = false,
  failLedger = false,
  failPost = false,
  failDelete = false;
const copy = structuredClone;
globalThis.Actor = class {
  constructor() {
    this.uuid = "Actor.improv";
    this.type = "agent";
    this.isOwner = true;
    this.system = state();
    this.items = new Map();
  }
  async update(data) {
    if (failLedger && Object.keys(data).some(k => k.startsWith("system.classGearGrants.") && !k.includes(".-="))) {
      failLedger = false;
      throw Error("ledger failed");
    }
    for (const [path, value] of Object.entries(data)) {
      const keys = path.replace(/^system\./, "").split(".");
      let target = this.system;
      for (const key of keys.slice(0, -1)) target = target[key] ??= {};
      const key = keys.at(-1);
      if (key.startsWith("-=")) delete target[key.slice(2)];
      else target[key] = copy(value);
    }
  }
  async createEmbeddedDocuments(_type, docs) {
    if (failCreate) throw Error("create failed");
    return docs.map(data => {
      const id = "item" + ++serial,
        item = { ...copy(data), id, uuid: this.uuid + ".Item." + id };
      this.items.set(id, item);
      return item;
    });
  }
  async deleteEmbeddedDocuments(_type, ids) {
    if (failDelete) throw Error("delete failed");
    for (const id of ids) this.items.delete(id);
  }
};
globalThis.game = { settings: { get: () => ({ mission }) }, user: { isGM: true } };
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.foundry = {
  utils: {
    randomID: () => `grant${++serial}`,
    escapeHTML: s => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  }
};
globalThis.ChatMessage = {
  getSpeaker: () => ({}),
  create: async data => {
    if (failPost) throw Error("post failed");
    posts.push(data);
    return data;
  }
};
globalThis.ui = {
  notifications: {
    warn: s => {
      warnings.push(s);
      return null;
    }
  }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");
function reset() {
  mission = "m";
  posts = [];
  warnings = [];
  failCreate = false;
  failLedger = false;
  failPost = false;
  failDelete = false;
}
test("document control creates one recorded object with no reserve, check or action-die cost and escapes description/chat", async () => {
  reset();
  const a = new SpycraftActor(),
    item = await a.improviseCommonItem({ ...input, name: "<b>Pick</b>", description: "<img onerror=bad>" });
  assert.equal(item.type, "gear");
  assert.equal(item.system.quantity, 1);
  assert.equal(item.system.weight, 0.1);
  assert.equal(item.system.common, true);
  assert.equal(item.system.pick, "");
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.resourceUses.improvisation.used, 1);
  assert.equal(managedClassGearGrant(a.system, item), true);
  assert.doesNotMatch(posts[0].content, /<b>/);
  assert.match(item.system.description, /&lt;img/);
});
test("mission limit survives deletion, simultaneous calls cannot exceed it, and a new mission grants a new pool", async () => {
  reset();
  const a = new SpycraftActor();
  await Promise.all([a.improviseCommonItem(input), a.improviseCommonItem(input), a.improviseCommonItem(input)]);
  assert.equal(posts.length, 2);
  assert.equal(a.items.size, 2);
  assert.equal(a.system.resourceUses.improvisation.used, 2);
  await a.deleteEmbeddedDocuments("Item", [...a.items.keys()]);
  assert.equal(await a.improviseCommonItem(input), null);
  assert.equal(a.system.resourceUses.improvisation.used, 2);
  mission = "next";
  const next = await a.improviseCommonItem(input);
  assert.equal(next.system.classGearGrant.epoch, "next");
  assert.equal(a.system.resourceUses.improvisation.used, 1);
});
test("creation, ledger and posting failures remove the partial object/record and refund the mission use", async () => {
  for (const failure of ["create", "ledger", "post"]) {
    reset();
    const a = new SpycraftActor();
    failCreate = failure === "create";
    failLedger = failure === "ledger";
    failPost = failure === "post";
    await assert.rejects(a.improviseCommonItem(input), new RegExp(failure + " failed"));
    assert.equal(a.items.size, 0);
    assert.equal(Object.keys(a.system.classGearGrants).length, 0);
    assert.equal(Object.hasOwn(a.system.resourceUses, "improvisation"), false);
    assert.equal(a.system.actionDice.value, 0);
  }
});
test("failed cleanup keeps the use spent while a created object may still exist and explicitly requires GC review", async () => {
  reset();
  const a = new SpycraftActor();
  failPost = true;
  failDelete = true;
  const item = await a.improviseCommonItem(input);
  assert.equal(a.items.size, 1);
  assert.equal(item.system.common, true);
  assert.equal(a.system.resourceUses.improvisation.used, 1);
  assert.match(warnings.join(""), /use remains spent/);
});
test("invalid declarations or missing ownership spend nothing", async () => {
  reset();
  const a = new SpycraftActor();
  await assert.rejects(a.improviseCommonItem({ ...input, fullActionConfirmed: false }), /full action/);
  assert.equal(a.items.size, 0);
  assert.equal(Object.hasOwn(a.system.resourceUses, "improvisation"), false);
  a.isOwner = false;
  await assert.rejects(a.improviseCommonItem(input), /own the agent/);
});
test("engine registers the correct mission limit only for an earned Improvisation option and removes it immediately when deselected", () => {
  const data = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))).find(
      c => c.key === "intruder"
    ),
    cls = {
      id: "intruder",
      name: "Intruder",
      type: "class",
      system: { ...copy(data), identifier: "intruder", vitalityDie: 8, choices: {} }
    };
  const list = cls.system.choiceLists.find(l => l.options.some(o => o.name === "Improvisation")),
    index = cls.system.choiceSchedule.findIndex(s => s.list === list.key);
  cls.system.choices[index] = list.options.find(o => o.name === "Improvisation").index;
  const s = {
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 10 }])),
    progression: Array.from({ length: 6 }, () => ({ classId: "intruder", vitality: 4, skills: {} })),
    misc: {}
  };
  computeAgent(s, [cls], cfg);
  let spec = s.limitedUses.find(s => s.id === "improvisation");
  assert.equal(spec.period, "mission");
  assert.equal(spec.cost, 0);
  assert.equal(spec.limit, s.actionDice.max);
  cls.system.choices[index] = null;
  computeAgent(s, [cls], cfg);
  assert.equal(
    s.limitedUses.some(s => s.id === "improvisation"),
    false
  );
});
