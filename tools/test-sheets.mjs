import test from "node:test";
import assert from "node:assert/strict";

// Lightweight sheet harness; Foundry's rendering engine is not available in CI.
class StubSheet {
  constructor(doc) {
    this.actor = doc;
    this.item = doc;
  }
  _prepareSubmitData(_event, _form, formData) {
    return formData.object;
  }
  async _processSubmitData(_event, _form, submitData) {
    return { updated: submitData };
  }
}
globalThis.foundry = {
  applications: {
    api: { HandlebarsApplicationMixin: Base => Base, ApplicationV2: StubSheet },
    sheets: { ActorSheetV2: StubSheet, ItemSheetV2: StubSheet }
  }
};
Math.clamp ??= (n, low, high) => Math.max(low, Math.min(high, n));
const { SpycraftAgentSheet } = await import("../module/sheets/actor-sheet.mjs");
const { SpycraftItemSheet } = await import("../module/sheets/item-sheet.mjs");
const { SpycraftBrowser } = await import("../module/apps/browser.mjs");

test("continuing setup enters Edit at the requested skill level and focuses the purchase field", async () => {
  const sheet = new SpycraftAgentSheet({}),
    visits = [];
  const field = {
    tagName: "INPUT",
    disabled: false,
    parentElement: null,
    scrollIntoView: () => visits.push("reveal"),
    focus: () => visits.push("focus")
  };
  sheet.isEditable = true;
  sheet.changeTab = (tab, group) => visits.push([tab, group]);
  sheet.element = {
    querySelector: selector => {
      // A build step is looked up by its pane, which several steps may share a tab with.
      assert.equal(selector, '[data-pane="skills"]');
      return {
        querySelectorAll: selector => {
          assert.equal(selector, '[name^="skillpts."]');
          return [field];
        }
      };
    }
  };
  sheet.render = async () => {
    assert.equal(sheet._editMode, true);
    assert.equal(sheet._skillLevel, 4);
    visits.push("render");
  };
  await SpycraftAgentSheet.DEFAULT_OPTIONS.actions.setupTask.call(sheet, null, {
    dataset: { tab: "skills", skillLevel: "4", order: "30" }
  });
  assert.deepEqual(visits, [["skills", "primary"], "render", "reveal", "focus"]);
  assert.equal(sheet._open.todo, false);
});

test("read-only sheets cannot enter character setup through a reminder", async () => {
  const sheet = new SpycraftAgentSheet({});
  sheet.isEditable = false;
  sheet.render = () => {
    throw new Error("Unexpected render");
  };
  await SpycraftAgentSheet.DEFAULT_OPTIONS.actions.setupTask.call(sheet, null, { dataset: { tab: "skills" } });
  assert.ok(!sheet._editMode);
});

test("an origin reminder opens its filtered choice browser after entering the destination in Edit", async () => {
  const sheet = new SpycraftAgentSheet({}),
    visits = [],
    original = SpycraftBrowser.prototype.render;
  sheet.isEditable = true;
  sheet.changeTab = (tab, group) => visits.push([tab, group]);
  sheet.element = { querySelector: () => null };
  sheet.render = async () => {
    assert.equal(sheet._editMode, true);
    visits.push("sheet");
  };
  SpycraftBrowser.prototype.render = function (force) {
    assert.equal(force, true);
    assert.equal(this.actor, sheet.actor);
    visits.push([this.itemType, this.filters.group]);
    return this;
  };
  try {
    await SpycraftAgentSheet.DEFAULT_OPTIONS.actions.setupTask.call(sheet, null, {
      dataset: { tab: "main", order: "1", type: "origin", originType: "talent" }
    });
    assert.deepEqual(visits, [["play", "primary"], "sheet", ["origin", "talent"]]);
  } finally {
    if (original) SpycraftBrowser.prototype.render = original;
    else delete SpycraftBrowser.prototype.render;
  }
});

test("agent sheet maps per-level skills, contacts and class selections into updates", async () => {
  const calls = [];
  const actor = {
    isOwner: true,
    uuid: "Actor.sheet",
    system: {
      level: 2,
      progression: [
        { classId: "pointman", skills: { bluff: 1 }, vitality: 0 },
        { classId: "pointman", skills: {}, vitality: 5 }
      ],
      contacts: [{ name: "Old", rank: 1, notes: "" }],
      subplots: []
    },
    updateEmbeddedDocuments: async (_type, updates) => {
      calls.push(updates);
    }
  };
  const sheet = new SpycraftAgentSheet(actor);
  sheet._skillLevel = 1;
  const formData = {
    object: {
      "skillpts.bluff": 2,
      "progression.1.vitality": 7,
      "contacts.0.name": "Madeleine",
      "choice.classitem.0": "3",
      "system.skills.bluff.misc": "1"
    }
  };
  const update = sheet._prepareSubmitData(null, null, formData, {});
  assert.equal(update["system.progression"][0].skills.bluff, 2);
  assert.equal(update["system.progression"][1].vitality, 5);
  assert.equal(update["system.contacts"][0].name, "Madeleine");
  assert.equal(update["system.skills.bluff.misc"], "1");
  assert.ok(!("choice.classitem.0" in update));
  await sheet._processSubmitData(null, null, update, {});
  assert.deepEqual(calls, [[{ _id: "classitem", "system.choices.0": 3 }]]);
});

test("item sheet saves structured bonuses and prerequisites from text fields", () => {
  const item = { system: { bonuses: [{ target: "defense", value: "1", level: 0 }] } };
  const sheet = new SpycraftItemSheet(item);
  const data = {
    object: {
      "bonuses.0.target": "saves.ref",
      "bonuses.0.value": "2",
      "bonuses.0.level": "3",
      prereqJSON: '{"type":"level","min":4}'
    }
  };
  const out = sheet._prepareSubmitData(null, null, data, {});
  assert.deepEqual(out["system.bonuses"], [{ target: "saves.ref", value: "2", level: 3 }]);
  assert.deepEqual(out["system.prerequisites"], { type: "level", min: 4 });
});

test("equipping armor unequips the previous armor in one batch", async () => {
  const first = { id: "a", type: "armor", system: { equipped: true } };
  const second = { id: "b", type: "armor", system: { equipped: false } };
  let updates = null;
  const actor = {
    items: {
      get: id => (id === "a" ? first : second),
      filter: fn => [first, second].filter(fn)
    },
    updateEmbeddedDocuments: async (_type, batch) => {
      updates = batch;
    }
  };
  const sheet = new SpycraftAgentSheet(actor);
  const target = { closest: () => ({ dataset: { itemId: "b" } }) };
  await SpycraftAgentSheet.DEFAULT_OPTIONS.actions.itemEquip.call(sheet, null, target);
  assert.deepEqual(updates, [
    { _id: "a", "system.equipped": false },
    { _id: "b", "system.equipped": true }
  ]);
});

test("Main origin selections are persisted to their embedded origin item", async () => {
  let updates;
  const actor = {
    system: { level: 1, progression: [], contacts: [], subplots: [] },
    updateEmbeddedDocuments: async (_type, value) => {
      updates = value;
    }
  };
  const sheet = new SpycraftAgentSheet(actor);
  const out = sheet._prepareSubmitData(
    null,
    null,
    { object: { "originChoice.origin1.up": "dex", "originChoice.origin1.threatSkill": "notice" } },
    {}
  );
  assert.deepEqual(out, {});
  await sheet._processSubmitData(null, null, out, {});
  assert.deepEqual(updates, [
    { _id: "origin1", "system.originChoices.up": "dex", "system.originChoices.threatSkill": "notice" }
  ]);
});

test("class skill target fields persist as embedded class choices", () => {
  const actor = { system: { level: 4, progression: [], contacts: [], subplots: [] } };
  const sheet = new SpycraftAgentSheet(actor);
  const data = {
    object: { "classSkillChoice.adv.byAnyMeans4": "acrobatics", "classSkillChoice.face.choice0": "bluff" }
  };
  const out = sheet._prepareSubmitData(null, null, data, {});
  assert.deepEqual(out, {});
  assert.deepEqual(sheet._pendingItemUpdates, {
    adv: { "system.skillChoices.byAnyMeans4": "acrobatics" },
    face: { "system.skillChoices.choice0": "bluff" }
  });
});

test("inherited class subchoices persist their option and skill on the owning item", () => {
  const actor = { system: { level: 6, progression: [], contacts: [], subplots: [] } },
    sheet = new SpycraftAgentSheet(actor);
  const out = sheet._prepareSubmitData(
    null,
    null,
    { object: { "inheritedChoice.pointman.cross0.option": "9", "inheritedChoice.pointman.cross0.skill": "bluff" } },
    {}
  );
  assert.deepEqual(out, {});
  assert.deepEqual(sheet._pendingItemUpdates, {
    pointman: { "system.inheritedChoices.cross0.option": 9, "system.inheritedChoices.cross0.skill": "bluff" }
  });
});

test("Weapon Specialist mode and proficiency persist on the embedded Soldier item", async () => {
  const actor = {
    system: { progression: [], contacts: [], subplots: [] },
    async updateEmbeddedDocuments(type, updates) {
      this.updates = updates;
    }
  };
  const sheet = new SpycraftAgentSheet(actor);
  const form = {
    object: { "specialistChoice.soldier.9.mode": "proficiency", "specialistChoice.soldier.9.proficiency": "edged" }
  };
  const update = sheet._prepareSubmitData(null, null, form, {});
  await sheet._processSubmitData(null, null, update, {});
  assert.deepEqual(actor.updates, [
    {
      _id: "soldier",
      "system.weaponSpecialist.9.mode": "proficiency",
      "system.weaponSpecialist.9.proficiency": "edged"
    }
  ]);
});

test("auto-submit cannot overwrite dice or health with stale inputs when another field is edited", async () => {
  const sheet = new SpycraftAgentSheet({ uuid: "Actor.sheet" }),
    data = {
      "system.codename": "New",
      "system.actionDice.value": 4,
      "system.vitality.value": 9,
      system: { wounds: { value: 8 }, netWorth: 100000 }
    };
  const result = await sheet._processSubmitData({ target: { name: "system.codename" } }, null, data, {});
  assert.equal(result.updated["system.codename"], "New");
  assert.equal(Object.hasOwn(result.updated, "system.actionDice.value"), false);
  assert.equal(Object.hasOwn(result.updated, "system.vitality.value"), false);
  assert.equal(Object.hasOwn(result.updated.system.wounds, "value"), false);
  assert.equal(Object.hasOwn(result.updated.system, "netWorth"), false);
});
test("an explicitly edited resource retains its requested value while unrelated stale resources are discarded", async () => {
  const sheet = new SpycraftAgentSheet({ uuid: "Actor.sheet" }),
    data = { "system.actionDice.value": 2, "system.wounds.value": 8 };
  const result = await sheet._processSubmitData({ target: { name: "system.actionDice.value" } }, null, data, {});
  assert.equal(result.updated["system.actionDice.value"], 2);
  assert.equal(Object.hasOwn(result.updated, "system.wounds.value"), false);
});

function careerSheet() {
  return new SpycraftAgentSheet({
    uuid: "Actor.career",
    isOwner: true,
    system: {
      level: 2,
      progression: [
        { classId: "soldier", careerEntryId: "first", vitality: 0, intelligenceModifier: 2, skills: { athletics: 4 } },
        { classId: "soldier", careerEntryId: "second", vitality: 0, intelligenceModifier: 2, skills: { notice: 1 } }
      ],
      contacts: [],
      subplots: []
    }
  });
}
test("queued skill edits merge fresh vitality, correction references and unrelated skill purchases", async () => {
  const sheet = careerSheet();
  sheet._skillLevel = 2;
  const data = sheet._prepareSubmitData(null, null, { object: { "skillpts.notice": 2 } }, {});
  let release;
  sheet.actor._actionDieQueue = new Promise(r => (release = r));
  const pending = sheet._processSubmitData({ target: { name: "skillpts.notice" } }, null, data, {});
  const row = sheet.actor.system.progression[1];
  Object.assign(row, { vitality: 9, vitalityRollId: "original", vitalityReviewId: "review" });
  row.skills.resolve = 1;
  release();
  const result = await pending,
    final = result.updated["system.progression"][1];
  assert.equal(final.vitality, 9);
  assert.equal(final.vitalityRollId, "original");
  assert.equal(final.vitalityReviewId, "review");
  assert.deepEqual(final.skills, { notice: 2, resolve: 1 });
  assert.equal(row.skills.notice, 1);
});
test("a stale edit cannot replace a changed skill field, a removed/replaced career row or lost ownership", async () => {
  for (const change of [
    a => (a.system.progression[1].skills.notice = 3),
    a => a.system.progression.pop(),
    a => (a.system.progression[1].careerEntryId = "replacement"),
    a => (a.isOwner = false)
  ]) {
    const sheet = careerSheet();
    sheet._skillLevel = 2;
    const data = sheet._prepareSubmitData(null, null, { object: { "skillpts.notice": 2 } }, {});
    change(sheet.actor);
    await assert.rejects(sheet._processSubmitData(null, null, data, {}), /changed|own/);
  }
});
test("unchanged skill auto-submit and ignored raw vitality fields cannot replay a whole old career array", async () => {
  const sheet = careerSheet();
  sheet._skillLevel = 2;
  const data = sheet._prepareSubmitData(
    null,
    null,
    { object: { "skillpts.notice": 1, "progression.1.vitality": 12 } },
    {}
  );
  sheet.actor.system.progression[1].skills.notice = 3;
  sheet.actor.system.progression[1].vitality = 8;
  const result = await sheet._processSubmitData(null, null, data, {});
  assert.equal(Object.hasOwn(result.updated, "system.progression"), false);
  const raw = sheet._prepareSubmitData(null, null, { object: { "progression.1.vitality": 12 } }, {});
  assert.equal(Object.hasOwn(raw, "system.progression"), false);
});
test("historical Intelligence edits retain fresh class gains; invalid or unplanned career edits fail explicitly", async () => {
  const sheet = careerSheet(),
    data = sheet._prepareSubmitData(null, null, { object: { "progression.1.intelligenceModifier": 3 } }, {});
  sheet.actor.system.progression[1].vitality = 6;
  const result = await sheet._processSubmitData(null, null, data, {});
  assert.equal(result.updated["system.progression"][1].vitality, 6);
  assert.equal(result.updated["system.progression"][1].intelligenceModifier, 3);
  for (const value of ["bad", -1, 0.5])
    assert.throws(
      () => sheet._prepareSubmitData(null, null, { object: { "skillpts.notice": value } }, {}),
      /nonnegative whole/
    );
  assert.throws(
    () => sheet._prepareSubmitData(null, null, { object: { "progression.1.intelligenceModifier": "bad" } }, {}),
    /whole number/
  );
  await assert.rejects(sheet._processSubmitData(null, null, { "system.progression": [] }, {}), /career form/);
});
