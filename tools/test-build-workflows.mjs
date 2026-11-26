import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
const origins = JSON.parse(readFileSync(new URL("../src/data/origins.json", import.meta.url))),
  classes = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url)));
function compute(origin, forteFocus) {
  const system = {
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 10 }])),
    progression: [{ classId: "test", skills: {}, vitality: 1 }],
    skills: {},
    focuses: { [origin.skill]: [origin.focus, forteFocus] },
    skillFortes: [{ skill: origin.skill, focus: forteFocus, forte: "Specialty" }],
    misc: {}
  };
  const source = [...origins.talents, ...origins.specialties].find(item => item.name === origin.name);
  return computeAgent(
    system,
    [
      {
        id: "test",
        type: "class",
        name: "Test",
        system: { identifier: "test", table: [], classSkills: [], vitalityDie: 6, skillPoints: 4 }
      },
      {
        id: "origin",
        name: origin.name,
        type: "origin",
        system: { ...source, originChoices: { grantedFocus: origin.focus } }
      }
    ],
    cfg
  );
}

test("all five restricted origin fortes must relate to that origin’s exact granted focus", () => {
  for (const [name, skill, focus, other] of [
    ["Authority", "profession", "Engineer", "Artist"],
    ["Hot Rodder", "drive", "Standard Ground Vehicles", "Personal Aircraft"],
    ["Pilot", "drive", "Performance Aircraft", "Rotary-Wing Aircraft"],
    ["Sailor", "drive", "Ships", "Submarines"],
    ["Thrill-Seeker", "drive", "Personal Watercraft", "Personal Aircraft"]
  ]) {
    const rule = { name, skill, focus },
      valid = compute(rule, focus),
      invalid = compute(rule, other);
    assert.ok(!valid.todo.some(row => row.text.startsWith(name + ": choose its granted forte")), name);
    assert.ok(
      invalid.todo.some(row => row.text.startsWith(name + ": choose its granted forte")),
      name
    );
  }
});

globalThis.Actor = class {
  constructor() {
    this.type = "agent";
    this.isOwner = true;
    this.items = [];
    this.system = {};
  }
  async update(data) {
    for (const [key, value] of Object.entries(data)) this.system[key.replace(/^system\./, "")] = value;
    return this;
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = { i18n: { localize: s => s, format: s => s } };
globalThis.ui = { notifications: { warn: () => null } };
globalThis.foundry = { utils: { deepClone: structuredClone, randomID: () => "career-entry-test" } };
const { SpycraftActor } = await import("../module/documents/actor.mjs");

test("first-play resources initialize exactly once according to affiliation", async () => {
  for (const [affiliation, reputation, netWorth] of [
    ["faction", 2, 0],
    ["freelance", 0, 100000]
  ]) {
    const actor = new SpycraftActor();
    actor.system = { affiliationType: affiliation, reputation: 2, netWorth: 0, resourcesInitialized: false };
    await actor.initializeStartingResources();
    assert.equal(actor.system.reputation, reputation);
    assert.equal(actor.system.netWorth, netWorth);
    assert.equal(actor.system.resourcesInitialized, true);
    actor.system.reputation = 9;
    await actor.initializeStartingResources();
    assert.equal(actor.system.reputation, 9);
  }
});

test("existing earned resources are never overwritten by first-play setup", async () => {
  const actor = new SpycraftActor();
  actor.system = { affiliationType: "freelance", reputation: 9, netWorth: 400000, resourcesInitialized: false };
  await actor.initializeStartingResources();
  assert.equal(actor.system.resourcesInitialized, false);
  assert.equal(actor.system.netWorth, 400000);
  await actor.initializeStartingResources({ keepCurrent: true });
  assert.equal(actor.system.resourcesInitialized, true);
  assert.equal(actor.system.reputation, 9);
  assert.equal(actor.system.netWorth, 400000);
});

test("adding a level snapshots permanent INT after its class increase while excluding temporary misc changes", async () => {
  const actor = new SpycraftActor(),
    c = classes.find(c => c.key === "scientist"),
    cls = { id: "sci", type: "class", name: c.name, system: { ...c, identifier: c.key, vitalityDie: c.vitality } };
  actor.items = [cls];
  actor.system = {
    abilities: Object.fromEntries(
      ["str", "dex", "con", "int", "wis", "cha"].map(k => [
        k,
        { base: k === "int" ? 13 : 10, misc: k === "int" ? 6 : 0 }
      ])
    ),
    progression: Array.from({ length: 5 }, () => ({
      classId: "scientist",
      vitality: 1,
      skills: {},
      intelligenceModifier: 1
    })),
    skills: {},
    focuses: {},
    misc: {}
  };
  computeAgent(actor.system, actor.items, cfg);
  actor.syncGrantedFeats = async () => {};
  await actor.addClassLevel(cls, { promptVitality: false });
  assert.equal(actor.system.progression[5].careerEntryId, "career-entry-test");
  assert.equal(actor.system.progression[5].intelligenceModifier, 2);
  assert.equal(actor.system.progression[0].intelligenceModifier, 1);
});

test("an expert class stops at its tenth level", async () => {
  const actor = new SpycraftActor();
  const c = classes.find(c => c.key === "sniper");
  const sniper = { id: "sniper", name: c.name, type: "class", system: { ...c, identifier: c.key } };
  actor.items = [sniper];
  actor.system = { level: 14, progression: Array.from({ length: 14 }, () => ({})), classLevels: { sniper: 10 } };
  let updated = 0;
  actor.update = async () => {
    updated++;
  };
  assert.equal(await actor.addClassLevel(sniper, { promptVitality: false }), null);
  assert.equal(updated, 0);
});

test("Fast Attributes level-up snapshots Intelligence from the campaign milestone before awarding new skill points", async () => {
  const savedSettings = game.settings;
  game.settings = { get: (_system, key) => (key === "campaign" ? { qualities: ["fast-attributes"] } : {}) };
  try {
    const actor = new SpycraftActor();
    const c = classes.find(c => c.key === "soldier");
    const cls = {
      id: "soldier",
      type: "class",
      name: c.name,
      system: { ...c, identifier: c.key, vitalityDie: c.vitality }
    };
    actor.items = [cls];
    actor.system = {
      abilities: Object.fromEntries(
        ["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: k === "int" ? 13 : 10 }])
      ),
      abilityIncreases: { l3: "int" },
      progression: Array.from({ length: 2 }, () => ({
        classId: "soldier",
        vitality: 1,
        skills: {},
        intelligenceModifier: 1
      })),
      skills: {},
      focuses: {},
      misc: {}
    };
    computeAgent(actor.system, actor.items, cfg, { campaignEffects: { attributeInterval: 3 } });
    actor.syncGrantedFeats = async () => {};
    await actor.addClassLevel(cls, { promptVitality: false });
    assert.equal(actor.system.progression[2].intelligenceModifier, 2);
    assert.equal(actor.system.progression[0].intelligenceModifier, 1);
  } finally {
    game.settings = savedSettings;
  }
});

test("expert entry is blocked before item creation and cannot use its own BAB to qualify", async () => {
  const actor = new SpycraftActor();
  actor.items = [];
  actor.system = { level: 3, progression: [], classLevels: {} };
  let created = 0;
  actor.createEmbeddedDocuments = async () => {
    created++;
    return [];
  };
  const expert = {
    name: "Expert",
    type: "class",
    system: { identifier: "expert", expert: true, requirements: { type: "base", key: "bab", min: 5 } }
  };
  await actor.addClassLevel(expert, { promptVitality: false });
  assert.equal(created, 0);
  const c = classes.find(c => c.key === "soldier"),
    soldier = {
      id: "soldier",
      name: c.name,
      type: "class",
      system: { ...c, identifier: c.key, vitalityDie: c.vitality }
    };
  actor.items = [soldier];
  actor.system = {
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 10 }])),
    progression: Array.from({ length: 4 }, () => ({ classId: "soldier", skills: {}, vitality: 1 })),
    skills: {},
    focuses: {},
    misc: {}
  };
  computeAgent(actor.system, actor.items, cfg);
  assert.equal(actor.system.bab, 4);
  await actor.addClassLevel(expert, { promptVitality: false });
  assert.equal(created, 0);
  assert.equal(actor.system.progression.length, 4);
});
