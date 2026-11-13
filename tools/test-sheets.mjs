import test from "node:test";
import assert from "node:assert/strict";

// Lightweight sheet harness; Foundry's rendering engine is not available in CI.
class StubSheet {
  constructor(doc) { this.actor = doc; this.item = doc; }
  _prepareSubmitData(_event, _form, formData) { return formData.object; }
  async _processSubmitData(_event, _form, submitData) { return { updated: submitData }; }
}
globalThis.foundry = {
  applications: {
    api: { HandlebarsApplicationMixin: Base => Base },
    sheets: { ActorSheetV2: StubSheet, ItemSheetV2: StubSheet }
  }
};
Math.clamp ??= (n, low, high) => Math.max(low, Math.min(high, n));
const { SpycraftAgentSheet } = await import("../module/sheets/actor-sheet.mjs");
const { SpycraftItemSheet } = await import("../module/sheets/item-sheet.mjs");

test("agent sheet maps per-level skills, contacts and class selections into updates", async () => {
  const calls = [];
  const actor = {
    system: {
      level: 2, progression: [
        { classId:"pointman", skills:{bluff:1}, vitality:0 },
        { classId:"pointman", skills:{}, vitality:5 }
      ],
      contacts:[{name:"Old", rank:1, notes:""}], subplots:[]
    },
    updateEmbeddedDocuments: async (_type, updates) => { calls.push(updates); }
  };
  const sheet = new SpycraftAgentSheet(actor);
  sheet._skillLevel = 1;
  const formData = {object: {
    "skillpts.bluff": 2, "progression.1.vitality": 7,
    "contacts.0.name": "Madeleine", "choice.classitem.0": "3",
    "system.skills.bluff.misc": "1"
  }};
  const update = sheet._prepareSubmitData(null,null,formData,{});
  assert.equal(update["system.progression"][0].skills.bluff,2);
  assert.equal(update["system.progression"][1].vitality,7);
  assert.equal(update["system.contacts"][0].name,"Madeleine");
  assert.equal(update["system.skills.bluff.misc"],"1");
  assert.ok(!("choice.classitem.0" in update));
  await sheet._processSubmitData(null,null,update,{});
  assert.deepEqual(calls,[[{_id:"classitem","system.choices.0":3}]]);
});

test("item sheet saves structured bonuses and prerequisites from text fields", () => {
  const item = {system:{bonuses:[{target:"defense",value:"1",level:0}]}};
  const sheet = new SpycraftItemSheet(item);
  const data = {object:{
    "bonuses.0.target":"saves.ref",
    "bonuses.0.value":"2",
    "bonuses.0.level":"3",
    "prereqJSON":'{"type":"level","min":4}'
  }};
  const out = sheet._prepareSubmitData(null,null,data,{});
  assert.deepEqual(out["system.bonuses"],[{target:"saves.ref",value:"2",level:3}]);
  assert.deepEqual(out["system.prerequisites"],{type:"level",min:4});
});
