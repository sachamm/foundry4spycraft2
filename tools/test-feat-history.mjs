import test from "node:test";
import assert from "node:assert/strict";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import {
  featAcquisitionSignature,
  historicalFeatEligibility,
  captureFeatAcquisition
} from "../module/rules/feat-acquisition.mjs";
const cls = {
  id: "test",
  name: "Test",
  type: "class",
  system: { identifier: "test", classSkills: [], table: [], skillPoints: 4, vitalityDie: 6 }
};
const system = level => ({
  abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(key => [key, { base: 10 }])),
  progression: Array.from({ length: level }, () => ({ classId: "test", vitality: 1, skills: {} })),
  skills: {},
  focuses: {},
  misc: {}
});
const feat = patch => ({
  id: "feat",
  name: "Example feat",
  type: "feat",
  system: {
    tree: "basicCombat",
    acquiredAtLevel: 1,
    prerequisites: { type: "level", min: 3 },
    bonuses: [{ target: "wounds", value: "10" }],
    ...patch
  }
});

test("failed acquisition eligibility does not become valid merely by leveling up", () => {
  const item = feat();
  item.system.acquisitionCheck = {
    ok: false,
    unmet: ["Career level 3+"],
    level: 1,
    signature: featAcquisitionSignature(item.system)
  };
  const sys = computeAgent(system(6), [cls, item], cfg);
  assert.equal(sys.featStatus.feat.ok, false);
  assert.equal(sys.wounds.max, 10);
});

test("valid acquisition history does not waive prerequisites lost after acquisition", () => {
  const item = feat({ acquiredAtLevel: 3, prerequisites: { type: "ability", key: "str", min: 13 } });
  item.system.acquisitionCheck = { ok: true, level: 3, signature: featAcquisitionSignature(item.system) };
  const sys = computeAgent(system(6), [cls, item], cfg);
  assert.equal(sys.featStatus.feat.ok, false);
});

test("changed prerequisite, source, tree or acquisition level invalidates the prior snapshot", () => {
  const data = feat().system;
  data.acquisitionCheck = { ok: true, level: 1, signature: featAcquisitionSignature(data) };
  assert.equal(historicalFeatEligibility(data).ok, true);
  for (const patch of [
    { prerequisites: { type: "level", min: 4 } },
    { tree: "gear" },
    { acquisitionSource: "new-source" },
    { acquiredAtLevel: 2 }
  ])
    assert.equal(historicalFeatEligibility({ ...data, ...patch }).ok, false);
  assert.equal(historicalFeatEligibility({ ...data, acquisitionCheck: null }).unknown, true);
});

test("a granted temporary feat must still satisfy prerequisites", () => {
  const item = feat({ granted: true, featKind: "temporary", prerequisites: { type: "ability", key: "str", min: 20 } });
  const sys = computeAgent(system(6), [cls, item], cfg);
  assert.equal(sys.featStatus.feat.ok, false);
  assert.equal(sys.wounds.max, 10);
  assert.equal(sys.feats.any.spent, 0);
});

globalThis.foundry = { utils: { randomID: () => "client", deepClone: structuredClone } };
globalThis.Item = class {
  constructor(data, parent) {
    Object.assign(this, data);
    this.parent = parent;
  }
  async _preCreate() {}
  async _preUpdate() {}
  updateSource(changes) {
    this.changes = changes;
  }
};
globalThis.Actor = class {};
globalThis.CONFIG = { SPYCRAFT: cfg };
const { SpycraftItem } = await import("../module/documents/item.mjs");
const { SpycraftActor } = await import("../module/documents/actor.mjs");

test("item creation records current acquisition eligibility and updates invalidate old historical attestations", async () => {
  const parent = {
    type: "agent",
    system: { level: 3 },
    checkPrerequisites: () => ({ ok: false, unmet: ["missing prerequisite"] })
  };
  const item = new SpycraftItem({ id: "new", type: "feat", system: feat({ acquiredAtLevel: 3 }).system }, parent);
  await item._preCreate({}, {});
  assert.equal(item.changes["system.acquisitionCheck"].ok, false);
  assert.equal(item.changes["system.acquisitionCheck"].level, 3);
  item.system = { ...item.system, acquiredAtLevel: 1, historicalPrerequisitesConfirmed: true };
  const changed = { "system.prerequisites": { type: "level", min: 8 } };
  await item._preUpdate(changed, {});
  assert.equal(changed["system.acquisitionCheck"].needsReview, true);
  assert.equal(changed["system.acquisitionCheck"].ok, false);
  assert.equal(changed["system.historicalPrerequisitesConfirmed"], false);
});

test("a feat moved from a token's own copy to its character keeps its saved acquisition check", async () => {
  const parent = {
    type: "agent",
    system: { level: 3 },
    items: [],
    checkPrerequisites: () => ({ ok: false, unmet: ["missing prerequisite"] })
  };
  const saved = { level: 3, ok: true };
  const item = new SpycraftItem(
    { id: "moved", type: "feat", system: feat({ acquiredAtLevel: 3, acquisitionCheck: saved }).system },
    parent
  );
  item.changes = undefined;
  await item._preCreate({}, { spycraft2TokenLink: true });
  assert.equal(item.changes, undefined);
  assert.deepEqual(item.system.acquisitionCheck, saved);
});

test("snapshot qualification excludes the candidate feat’s own bonuses", () => {
  const actor = new SpycraftActor(),
    item = feat({ granted: true, prerequisites: null, bonuses: [{ target: "abilities.str", value: "5" }] });
  actor.items = [cls, item];
  actor.system = computeAgent(system(3), actor.items, cfg);
  assert.equal(actor.system.abilities.str.value, 15);
  const candidate = { ...item.system, granted: false, prerequisites: { type: "ability", key: "str", min: 13 } };
  assert.equal(captureFeatAcquisition(actor, candidate, item.id).ok, false);
});

import { CONTACT_FEATS } from "../module/rules/contact-feats.mjs";
function contactItem(name = "Media Contacts") {
  return new SpycraftItem(
    {
      id: "contact",
      name,
      type: "feat",
      system: {
        ...feat({ acquiredAtLevel: 3 }).system,
        acquisitionSource: "",
        manualPrerequisitesConfirmed: false,
        featKind: "permanent",
        granted: false,
        historicalPrerequisitesConfirmed: false,
        choice: "Ada",
        contactGrantMode: "associate",
        contactTheme: "media",
        contactThemeConfirmed: true
      }
    },
    { type: "agent", system: { level: 4 } }
  );
}
test("all contact feat bindings clear old GC approval after changed choice, theme, mode or name, including full form checkbox values", async () => {
  for (const name of Object.keys(CONTACT_FEATS))
    for (const nested of [false, true])
      for (const [key, value] of [
        ["choice", "Bob"],
        ["contactTheme", "different theme"],
        ["contactGrantMode", "improve"]
      ]) {
        const a = contactItem(name),
          changed = nested
            ? { system: { [key]: value, contactThemeConfirmed: true } }
            : { ["system." + key]: value, "system.contactThemeConfirmed": true };
        await a._preUpdate(changed, {});
        assert.equal(changed["system.contactThemeConfirmed"], false);
        if (nested) assert.equal(changed.system.contactThemeConfirmed, false);
      }
  const a = contactItem(),
    changed = { name: "Academic Contacts" };
  await a._preUpdate(changed, {});
  assert.equal(changed["system.contactThemeConfirmed"], false);
});
test("unchanged binding fields and a subsequent explicit confirmation preserve contact approval", async () => {
  const a = contactItem(),
    same = {
      system: { choice: "Ada", contactTheme: "media", contactGrantMode: "associate", contactThemeConfirmed: true }
    };
  await a._preUpdate(same, {});
  assert.equal(same.system.contactThemeConfirmed, true);
  assert.equal(Object.hasOwn(same, "system.contactThemeConfirmed"), false);
  a.system.contactThemeConfirmed = false;
  const confirm = { "system.contactThemeConfirmed": true };
  await a._preUpdate(confirm, {});
  assert.equal(confirm["system.contactThemeConfirmed"], true);
});
test("editing a contact binding through a full item form retains the earlier prerequisite snapshot when acquisition fields are unchanged", async () => {
  const a = contactItem();
  a.system.acquisitionCheck = { ok: true, unmet: [], level: 3, signature: featAcquisitionSignature(a.system) };
  const keys = [
      "acquiredAtLevel",
      "acquisitionSource",
      "prerequisites",
      "manualPrerequisitesConfirmed",
      "featKind",
      "granted",
      "historicalPrerequisitesConfirmed"
    ],
    changed = { system: Object.fromEntries(keys.map(k => [k, structuredClone(a.system[k])])) };
  changed.system.contactGrantMode = "improve";
  changed.system.contactThemeConfirmed = true;
  await a._preUpdate(changed, {});
  assert.equal(changed["system.contactThemeConfirmed"], false);
  assert.equal(Object.hasOwn(changed, "system.acquisitionCheck"), false);
  assert.equal(Object.hasOwn(changed.system, "acquisitionCheck"), false);
});

function applyItemChange(item, changed) {
  for (const [k, v] of Object.entries(changed.system ?? {})) item.system[k] = structuredClone(v);
  for (const [k, v] of Object.entries(changed))
    if (k.startsWith("system.")) item.system[k.slice(7)] = structuredClone(v);
}
function historicalItem(patch = {}) {
  return new SpycraftItem(
    {
      id: "feat",
      name: "Example feat",
      type: "feat",
      system: {
        ...feat({ acquiredAtLevel: 1 }).system,
        acquisitionSource: "",
        manualPrerequisitesConfirmed: false,
        featKind: "permanent",
        granted: false,
        historicalPrerequisitesConfirmed: false,
        ...patch
      }
    },
    { type: "agent", system: { level: 6 }, checkPrerequisites: () => ({ ok: true, unmet: [] }) }
  );
}
test("changing an older feat’s prerequisites cannot erase failed history and activate it using current eligibility", async () => {
  const a = historicalItem();
  a.system.acquisitionCheck = {
    ok: false,
    unmet: ["Career level 3 required at acquisition"],
    level: 1,
    signature: featAcquisitionSignature(a.system)
  };
  const changed = { "system.prerequisites": { type: "level", min: 4 } };
  await a._preUpdate(changed, {});
  applyItemChange(a, changed);
  const s = computeAgent(system(6), [cls, { id: a.id, name: a.name, type: a.type, system: a.system }], cfg);
  assert.equal(s.featStatus.feat.ok, false);
  assert.equal(s.wounds.max, 10);
  assert.equal(a.system.acquisitionCheck.needsReview, true);
});
test("old historical checkbox values cannot approve changed criteria in the same full form update", async () => {
  for (const nested of [false, true]) {
    const a = historicalItem({ historicalPrerequisitesConfirmed: true });
    a.system.acquisitionCheck = {
      ok: true,
      unmet: [],
      level: 1,
      signature: featAcquisitionSignature(a.system),
      manual: true
    };
    const changed = nested
      ? { system: { prerequisites: { type: "level", min: 4 }, historicalPrerequisitesConfirmed: true } }
      : { "system.prerequisites": { type: "level", min: 4 }, "system.historicalPrerequisitesConfirmed": true };
    await a._preUpdate(changed, {});
    applyItemChange(a, changed);
    assert.equal(a.system.historicalPrerequisitesConfirmed, false);
    assert.equal(a.system.acquisitionCheck.ok, false);
    assert.equal(a.system.acquisitionCheck.needsReview, true);
  }
});
test("a separate fresh GC review resolves the committed pending criteria, while current prerequisites still apply", async () => {
  const a = historicalItem({ prerequisites: { type: "ability", key: "str", min: 10 } }),
    changed = { "system.acquiredAtLevel": 2 };
  await a._preUpdate(changed, {});
  applyItemChange(a, changed);
  assert.equal(a.system.acquisitionCheck.needsReview, true);
  const confirm = { "system.historicalPrerequisitesConfirmed": true };
  await a._preUpdate(confirm, {});
  applyItemChange(a, confirm);
  assert.equal(a.system.acquisitionCheck.ok, true);
  assert.equal(a.system.acquisitionCheck.manual, true);
  assert.equal(a.system.acquisitionCheck.level, 2);
  assert.equal(a.system.acquisitionCheck.signature, featAcquisitionSignature(a.system));
  assert.equal(historicalFeatEligibility(a.system).ok, true);
  const s = computeAgent(system(6), [cls, { id: a.id, name: a.name, type: a.type, system: a.system }], cfg);
  assert.equal(s.featStatus.feat.ok, true);
});
test("newly added backdated feats without a matching acquisition record wait for review rather than becoming legacy-qualified", async () => {
  const a = historicalItem({ prerequisites: { type: "ability", key: "str", min: 10 } });
  await a._preCreate({}, {});
  applyItemChange(a, a.changes);
  assert.equal(a.system.acquisitionCheck.ok, false);
  assert.equal(a.system.acquisitionCheck.needsReview, true);
  const s = computeAgent(system(6), [cls, { id: a.id, name: a.name, type: a.type, system: a.system }], cfg);
  assert.equal(s.featStatus.feat.ok, false);
});
test("matching imported acquisition records are retained; mismatched imported records require review", async () => {
  for (const ok of [false, true]) {
    const a = historicalItem();
    a.system.acquisitionCheck = {
      ok,
      unmet: ok ? [] : ["Previously failed"],
      level: 1,
      signature: featAcquisitionSignature(a.system)
    };
    const before = structuredClone(a.system.acquisitionCheck);
    await a._preCreate({}, {});
    applyItemChange(a, a.changes);
    assert.deepEqual(a.system.acquisitionCheck, before);
  }
  const a = historicalItem();
  a.system.acquisitionCheck = { ok: true, level: 1, signature: "old criteria" };
  await a._preCreate({}, {});
  applyItemChange(a, a.changes);
  assert.equal(a.system.acquisitionCheck.needsReview, true);
});
test("future planned selections stay inactive and can still receive an ordinary current-level acquisition record when earned", async () => {
  const a = historicalItem({ acquiredAtLevel: 9, prerequisites: { type: "level", min: 9 } });
  await a._preCreate({}, {});
  applyItemChange(a, a.changes);
  assert.equal(a.system.acquisitionCheck ?? null, null);
  assert.equal(
    computeAgent(system(6), [cls, { id: a.id, name: a.name, type: a.type, system: a.system }], cfg).featStatus.feat.ok,
    false
  );
  a.parent.system.level = 9;
  const captured = captureFeatAcquisition(a.parent, a.system, a.id);
  assert.equal(captured.ok, true);
  assert.equal(captured.level, 9);
});
test("temporary granted feats capture real current eligibility while permanent prerequisite-exempt grants remain exempt", async () => {
  const a = historicalItem({ acquiredAtLevel: 6, granted: true, featKind: "temporary" });
  a.parent.checkPrerequisites = () => ({ ok: false, unmet: ["Missing actual requirement"] });
  await a._preCreate({}, {});
  applyItemChange(a, a.changes);
  assert.equal(a.system.acquisitionCheck.ok, false);
  const b = historicalItem({ granted: true, featKind: "permanent" });
  await b._preCreate({}, {});
  assert.equal(b.changes?.["system.acquisitionCheck"] ?? null, null);
});

test("JSON property reordering neither invalidates matching legacy signatures nor erases history through an item form", async () => {
  const a = historicalItem({ prerequisites: { type: "ability", key: "str", min: 10 } });
  a.system.acquisitionCheck = {
    ok: true,
    level: 1,
    signature: JSON.stringify({
      prerequisites: { type: "ability", key: "str", min: 10 },
      tree: a.system.tree,
      source: ""
    })
  };
  assert.equal(historicalFeatEligibility(a.system).ok, true);
  const changed = { "system.prerequisites": { min: 10, key: "str", type: "ability" } };
  await a._preUpdate(changed, {});
  assert.equal(Object.hasOwn(changed, "system.acquisitionCheck"), false);
  assert.equal(historicalFeatEligibility({ ...a.system, prerequisites: changed["system.prerequisites"] }).ok, true);
  assert.equal(
    historicalFeatEligibility({ ...a.system, prerequisites: { min: 11, key: "str", type: "ability" } }).ok,
    false
  );
});

test("Candidate captures original non-Candidate scores on first-level creation and choice edits but never silently replaces later history", async () => {
  const scores = Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, 14])),
    parent = {
      type: "agent",
      system: { level: 1, candidateScores: scores },
      checkPrerequisites: () => ({ ok: true, unmet: [] })
    },
    data = {
      ...feat({ acquiredAtLevel: 1, tree: "tradecraft", prerequisites: { type: "level", eq: 1 } }),
      name: "Candidate"
    };
  data.system.choice = "str,dex";
  const item = new SpycraftItem(data, parent);
  await item._preCreate({}, {});
  const basis = item.changes["system.candidateBasis"];
  assert.deepEqual(basis.scores, scores);
  assert.equal(basis.choice, "str,dex");
  item.system.candidateBasis = basis;
  const change = { "system.choice": "int,wis" };
  await item._preUpdate(change, {});
  assert.equal(change["system.candidateBasis"].choice, "int,wis");
  parent.system.level = 5;
  const later = { "system.choice": "int,cha" };
  await item._preUpdate(later, {});
  assert.equal(later["system.candidateBasis"], undefined);
  const unchanged = new SpycraftItem(
    {
      ...data,
      system: {
        ...data.system,
        candidateBasis: basis,
        acquisitionCheck: { ok: true, level: 1, signature: featAcquisitionSignature(data.system) }
      }
    },
    parent
  );
  await unchanged._preCreate({}, {});
  assert.equal(unchanged.changes["system.candidateBasis"], undefined);
});
