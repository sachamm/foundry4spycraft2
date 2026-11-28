import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toolShedSource, toolShedPlan, toolShedKitState } from "../module/rules/tool-shed.mjs";
import { managedClassGearGrant } from "../module/rules/class-gear.mjs";
import { limitedUseAbilities } from "../module/rules/limited-uses.mjs";
import { skillGearPlan } from "../module/rules/skill-gear.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const catalog = JSON.parse(readFileSync(new URL("../src/data/kits.json", import.meta.url))).map((k, i) => ({
    id: "kit" + i,
    uuid: "Compendium.spycraft2.kits.Item.kit" + i,
    name: k.name,
    type: "gear",
    system: {
      kitType: k.kitType,
      kitGrade: k.grade,
      kitSize: k.size,
      kitNonPortable: k.nonPortable,
      weight: k.weight ?? 0,
      gearCategory: "T",
      caliber: k.grade,
      quantity: 1
    }
  })),
  third = catalog.filter(k => k.system.kitGrade === 3),
  source = (n = 1) => ({
    activeFeatNames: ["Home Sweet Home", ...Array(n).fill("Tool Shed")],
    activeFeatSelections: [
      { name: "Home Sweet Home", tree: "gear" },
      ...Array.from({ length: n }, () => ({ name: "Tool Shed", tree: "gear" }))
    ],
    classGearGrants: {},
    resourceUses: {},
    usagePeriods: { mission: "m" },
    actionDice: { max: 3, value: 0 },
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 12, mod: 1 }]))
  }),
  facts = { atHome: true, hourCompletedConfirmed: true, home: "QA home", id: "grant" };
function grant(s = source(), kit = third[0]) {
  const p = toolShedPlan(s, kit, facts),
    item = { ...p.data, id: "owned", uuid: "Item.owned" };
  s.classGearGrants.grant = { ...p.record, itemId: item.id };
  return { s, p, item };
}
test("all sixteen Grade III kits retain their source specifications, fixed locations and one-object grant without spending a pick", () => {
  assert.equal(third.length, 16);
  for (const kit of third) {
    const before = structuredClone(kit),
      p = toolShedPlan(source(), kit, facts);
    assert.equal(p.data.system.kitGrade, 3);
    assert.equal(p.data.system.caliber, 3);
    assert.equal(p.data.system.quantity, 1);
    assert.equal(p.data.system.carried, false);
    assert.equal(p.data.system.common, false);
    assert.equal(p.data.system.pick, "");
    assert.equal(p.data.system.kitLocation, kit.system.kitNonPortable ? "QA home" : "");
    assert.equal(p.data.system.weight, kit.system.weight);
    assert.deepEqual(kit, before);
  }
});
test("Tool Shed requires an active selection, each one-hour action, actual home declaration, a canonical kit grade and unique receipt", () => {
  for (let n = 0; n <= 10; n++) assert.equal(toolShedSource(source(n))?.limit ?? 0, n);
  for (const patch of [
    { atHome: false },
    { atHome: "true" },
    { hourCompletedConfirmed: false },
    { home: "" },
    { id: "unsafe.path" }
  ])
    assert.throws(() => toolShedPlan(source(), third[0], { ...facts, ...patch }));
  for (const kit of catalog.filter(k => k.system.kitGrade !== 3))
    assert.throws(() => toolShedPlan(source(), kit, facts), /Grade III/);
  const s = source();
  s.activeFeatNames = [];
  assert.throws(() => toolShedPlan(s, third[0], facts), /active/);
});
test("physical kit provenance survives feat loss, rejects changed specifications and expires exactly with its mission", () => {
  const { s, item } = grant();
  assert.equal(managedClassGearGrant(s, item), true);
  s.activeFeatNames = [];
  s.activeFeatSelections = [];
  assert.equal(toolShedKitState(s, item).valid, true);
  item.system.carried = true;
  assert.equal(toolShedKitState(s, item).valid, true);
  for (const [key, value] of [
    ["quantity", 2],
    ["kitGrade", 2],
    ["kitType", "Other Kit"],
    ["weight", 100],
    ["pick", "T"],
    ["reserve", true],
    ["kitLocation", "Another lab"]
  ]) {
    const changed = structuredClone(item);
    changed.system[key] = value;
    assert.equal(toolShedKitState(s, changed).valid, false, key);
  }
  s.usagePeriods.mission = "next";
  assert.equal(toolShedKitState(s, item).expired, true);
});
test("every active Tool Shed kit supplies its grade benefits, while expired or unrecorded kits cannot supply any skill gear benefit", () => {
  for (const kit of third) {
    const { s, item } = grant(source(), kit),
      check = { tags: `Gear (${kit.system.kitType})` },
      p = skillGearPlan(check, { system: s, gearItem: item, kitAtLocation: true });
    assert.equal(p.capIncrease, 5, kit.name);
    assert.equal(p.bonuses[0].value, 1, kit.name);
    assert.equal(p.toolShedKit.id, "grant");
    s.usagePeriods.mission = "next";
    const lost = skillGearPlan(check, { system: s, gearItem: item, kitAtLocation: true });
    assert.match(lost.blockedReason, /lost/);
    assert.equal(lost.capIncrease, 0);
    assert.equal(lost.bonuses.length, 0);
  }
});
test("mission expiry removes heavy kit weight and classification costs without deleting or changing the saved item", () => {
  const { s, item } = grant(
    source(),
    third.find(k => k.system.kitType === "Mechanics Kit")
  );
  item.system.carried = true;
  const before = structuredClone(item),
    cls = {
      id: "test",
      name: "Test",
      type: "class",
      system: { identifier: "test", skillPoints: 4, vitalityDie: 6, classSkills: [], table: [] }
    },
    raw = {
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
      progression: [{ classId: "test", vitality: 1, skills: {} }],
      classGearGrants: s.classGearGrants
    };
  const active = computeAgent({ ...structuredClone(raw), usagePeriods: { mission: "m" } }, [cls, item], cfg),
    lost = computeAgent({ ...structuredClone(raw), usagePeriods: { mission: "next" } }, [cls, item], cfg);
  assert.equal(active.encumbrance.weight, 4000);
  assert.equal(lost.encumbrance.weight, 0);
  assert.equal(active.wealth.possessions.budget.unclassified, 0);
  assert.match(lost.warnings.join(" "), /lost at the end/);
  assert.deepEqual(item, before);
});
let serial = 0,
  mission = "m",
  posts = [],
  failCreate = false,
  failLedger = false,
  failPost = false,
  failDelete = false,
  creationHook = null,
  ledgerHook = null;
globalThis.Actor = class {
  constructor() {
    this.uuid = "Actor.shed";
    this.type = "agent";
    this.isOwner = true;
    this.flags = {};
    this.system = source(2);
    this.system.limitedUses = limitedUseAbilities(this.system, [], cfg);
    this.items = new Map();
  }
  async update(patch) {
    for (const [path, value] of Object.entries(patch)) {
      if (failLedger && path.startsWith("system.classGearGrants.") && !path.includes(".-="))
        throw Error("ledger failed");
      const keys = path.split(".");
      let o = this;
      for (const k of keys.slice(0, -1)) o = o[k] ??= {};
      const k = keys.at(-1);
      if (k.startsWith("-=")) delete o[k.slice(2)];
      else o[k] = structuredClone(value);
      if (path.startsWith("system.classGearGrants.") && !path.includes(".-=")) await ledgerHook?.();
    }
  }
  async createEmbeddedDocuments(_type, docs) {
    if (failCreate) throw Error("create failed");
    const made = docs.map(d => ({ ...structuredClone(d), id: "owned" + ++serial, uuid: "Item.owned" + serial }));
    for (const d of made) this.items.set(d.id, d);
    await creationHook?.(this, made);
    return made;
  }
  async deleteEmbeddedDocuments(_type, ids) {
    if (failDelete) throw Error("delete failed");
    for (const id of ids) this.items.delete(id);
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = {
  user: { isGM: true },
  time: { worldTime: 126 },
  settings: { get: () => ({ mission }) },
  packs: { get: () => ({ getDocuments: async () => catalog, getDocument: async id => catalog.find(k => k.id === id) }) }
};
globalThis.foundry = {
  utils: {
    randomID: () => `grant${++serial}`,
    escapeHTML: s => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  },
  applications: { api: { DialogV2: { input: async () => null } } }
};
globalThis.ui = { notifications: { warn: () => ({ id: "native-warning" }) } };
globalThis.ChatMessage = {
  getSpeaker: () => ({}),
  create: async d => {
    if (failPost) throw Error("post failed");
    posts.push(d);
    return d;
  }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");
const input = { kitId: third[0].id, atHome: true, hourCompletedConfirmed: true, home: "<b>QA home</b>" };
function actor() {
  mission = "m";
  posts = [];
  failCreate = false;
  failLedger = false;
  failPost = false;
  failDelete = false;
  creationHook = null;
  ledgerHook = null;
  return new SpycraftActor();
}
test("actual grants use one mission allowance each, cost no dice or reserves, and retain their spent history after deletion", async () => {
  const a = actor(),
    kit = await a.useToolShed(input);
  assert.equal(kit.system.kitGrade, 3);
  assert.equal(a.system.resourceUses.toolShed.used, 1);
  assert.equal(managedClassGearGrant({ ...a.system, usagePeriods: a.usagePeriods }, kit), true);
  assert.equal(a.system.actionDice.value, 0);
  assert.match(posts[0].content, /&lt;b&gt;/);
  await a.useToolShed(input);
  assert.equal(a.system.resourceUses.toolShed.used, 2);
  await a.deleteEmbeddedDocuments("Item", [...a.items.keys()]);
  await a.useToolShed(input);
  assert.equal(posts.length, 2);
  assert.equal(a.system.resourceUses.toolShed.used, 2);
  mission = "next";
  await a.useToolShed(input);
  assert.equal(posts.length, 3);
  assert.equal(a.system.resourceUses.toolShed.used, 1);
});
test("creation, ledger, posting and changing-source failures remove partial kits and refund the mission use", async () => {
  for (const failure of ["create", "ledger", "post", "source"]) {
    const a = actor();
    failCreate = failure === "create";
    failLedger = failure === "ledger";
    failPost = failure === "post";
    if (failure === "source")
      creationHook = a => {
        a.system.activeFeatNames = [];
      };
    await assert.rejects(a.useToolShed(input), /failed|changed/);
    assert.equal(a.items.size, 0);
    assert.equal(Object.keys(a.system.classGearGrants).length, 0);
    assert.equal(a.system.resourceUses.toolShed?.used ?? 0, 0);
  }
});
test("cancellation spends nothing and failed object cleanup retains the spent allowance to prevent extra kits", async () => {
  const a = actor();
  assert.equal(await a.useToolShed(), null);
  assert.equal(a.system.resourceUses.toolShed, undefined);
  failPost = true;
  failDelete = true;
  const item = await a.useToolShed(input);
  assert.ok(item);
  assert.equal(a.items.size, 1);
  assert.equal(a.system.resourceUses.toolShed.used, 1);
});

test("committed then rejected creation and ledger writes recover the stamped kit and preserve the available use", async () => {
  for (const phase of ["creation", "ledger"]) {
    const a = actor();
    if (phase === "creation")
      creationHook = () => {
        throw Error("creation committed then failed");
      };
    else
      ledgerHook = () => {
        throw Error("ledger committed then failed");
      };
    await assert.rejects(a.useToolShed(input), /committed then failed/);
    assert.equal(a.items.size, 0);
    assert.equal(Object.keys(a.system.classGearGrants).length, 0);
    assert.equal(a.system.resourceUses.toolShed?.used ?? 0, 0);
  }
});
test("simultaneous grants are serialized against the shared mission allowance", async () => {
  const a = actor();
  await Promise.all([a.useToolShed(input), a.useToolShed(input), a.useToolShed(input)]);
  assert.equal(a.items.size, 2);
  assert.equal(posts.length, 2);
  assert.equal(a.system.resourceUses.toolShed.used, 2);
});

test("expired kit warnings survive the feat prerequisite convergence passes", () => {
  const { s, item } = grant();
  const raw = {
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
    progression: [{ classId: "test", vitality: 1, skills: {} }],
    classGearGrants: s.classGearGrants,
    usagePeriods: { mission: "next" }
  };
  const cls = {
      id: "test",
      name: "Test",
      type: "class",
      system: { identifier: "test", skillPoints: 4, vitalityDie: 6, classSkills: [], table: [] }
    },
    feat = {
      id: "home",
      name: "Home Sweet Home",
      type: "feat",
      system: { tree: "gear", acquiredAtLevel: 1, bonuses: [], prerequisites: null }
    };
  const out = computeAgent(raw, [cls, feat, item], cfg);
  assert.ok(out.activeFeatNames.includes("Home Sweet Home"));
  assert.match(out.warnings.join(" "), /lost at the end/);
});
test("skill posting re-fetches the owned kit after RNG and rejects deletion before the receipt is posted", async () => {
  const a = actor(),
    { item } = grant(
      a.system,
      third.find(k => k.system.kitType === "Authentication Kit")
    );
  a.items.set(item.id, item);
  a.system.skillTotals = {
    analysis: {
      name: "Analysis",
      ranks: 1,
      cap: 20,
      threat: 20,
      bonusEntries: [],
      totals: [{ ability: "int", total: 2 }]
    }
  };
  let posted = 0;
  globalThis.Roll = class {
    constructor() {
      this.total = 10;
      this.dice = [{ total: 7 }];
    }
    async evaluate() {
      a.items.delete(item.id);
      return this;
    }
    async toMessage(data) {
      posted++;
      return data;
    }
  };
  await assert.rejects(
    a.rollSkill("analysis", "int", {
      check: "authenticate",
      gearStatus: "available",
      gearItem: item.id,
      kitAtLocation: true
    }),
    /changed/
  );
  assert.equal(posted, 0);
});
