import test from "node:test";
import assert from "node:assert/strict";
import { defaultNpcProfile } from "../module/rules/npcs.mjs";
import { SPYCRAFT } from "../module/config.mjs";
import { creationPolicyRecord } from "../module/rules/creation-policy.mjs";
import { startingAttributeRecord } from "../module/rules/starting-attributes.mjs";
class StubSheet {
  constructor(actor) {
    this.actor = actor;
    this.isEditable = true;
  }
  _prepareSubmitData(_e, _f, form) {
    return form.object;
  }
}
class Field {
  constructor(options) {
    this.options = options;
  }
}
globalThis.foundry = {
  applications: {
    api: { HandlebarsApplicationMixin: B => B, ApplicationV2: StubSheet },
    sheets: { ActorSheetV2: StubSheet }
  },
  abstract: { TypeDataModel: class {} },
  data: {
    fields: Object.fromEntries(
      ["ArrayField", "BooleanField", "HTMLField", "NumberField", "ObjectField", "SchemaField", "StringField"].map(k => [
        k,
        Field
      ])
    )
  }
};
globalThis.CONFIG = { SPYCRAFT };
const { SpycraftNpcSheet } = await import("../module/sheets/actor-sheet.mjs");
const { NpcData } = await import("../module/data/actor.mjs");
const { damageSaveState } = await import("../module/apps/gc/npc-play.mjs");
const make = () => ({
  npcProfile: { ...defaultNpcProfile(), enabled: true },
  threatLevel: 7,
  npcType: "standard",
  abilities: Object.fromEntries(
    ["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: k === "dex" ? 14 : 10 }])
  ),
  vitality: { value: 0, max: 0 },
  wounds: { value: 0, max: 0 },
  saves: { fort: { base: 0 }, ref: { base: 0 }, will: { base: 0 } },
  defense: { bonus: 0 },
  initiative: { bonus: 0 }
});

test("standard and animal NPC feat health changes reach the actual Damage save without altering stored bonuses", () => {
  for (const enabled of [true, false]) {
    for (const npcType of ["standard", "animal"]) {
      const model = Object.assign(new NpcData(), make(), { npcType, manualDamageSave: 8, damageSaveAdjust: 0 });
      model.npcProfile.enabled = enabled;
      const feat = {
        type: "feat",
        name: "Health fixture",
        system: {
          bonuses: [
            { target: "vitality", value: "5" },
            { target: "wounds", value: "-1" }
          ]
        }
      };
      model.parent = { items: [feat], flags: {} };
      model.prepareDerivedData();
      const base = model.damageSave;
      assert.equal(model.featEffects.damageSaveHealth.applied, 1);
      assert.equal(damageSaveState({ system: model }).bonus, base + 1);
      model.prepareDerivedData();
      assert.equal(damageSaveState({ system: model }).bonus, base + 1, "preparation does not accumulate the bonus");
      assert.equal(model.damageSaveAdjust, 0);
      model.parent.items = [];
      model.prepareDerivedData();
      assert.equal(damageSaveState({ system: model }).bonus, base, "removing the source removes its bonus");
    }
  }
});

test("legacy manual adjustments require review before feat health bonuses are added twice", () => {
  const model = Object.assign(new NpcData(), make(), { damageSaveAdjust: 2 });
  model.parent = {
    items: [{ type: "feat", name: "Health fixture", system: { bonuses: [{ target: "vitality", value: "5" }] } }],
    flags: {}
  };
  model.prepareDerivedData();
  const base = model.damageSave;
  assert.equal(model.featEffects.damageSaveHealth.needsReview, true);
  assert.ok(model.warnings.some(s => s.includes("manual Damage save")));
  assert.equal(damageSaveState({ system: model }).bonus, base + 2);
  model.damageSaveHealthMode = "automatic";
  model.prepareDerivedData();
  assert.equal(damageSaveState({ system: model }).bonus, base + 4);
  assert.equal(model.featEffects.damageSaveHealth.needsReview, false);
  model.damageSaveHealthMode = "manual";
  model.prepareDerivedData();
  assert.equal(damageSaveState({ system: model }).bonus, base + 2);
  model.npcType = "special";
  model.prepareDerivedData();
  assert.equal(model.featEffects.damageSaveHealth, undefined);
  assert.equal(model.featEffects.healthApplied, true);
});

test("both graded and manual NPCs retain their recorded creation cap across seasons and require unknown history review", () => {
  globalThis.game = { settings: { get: (_id, key) => (key === "campaign" ? { qualities: ["small-screen"] } : {}) } };
  try {
    for (const enabled of [false, true]) {
      const model = Object.assign(new NpcData(), make());
      model.npcProfile.enabled = enabled;
      model.parent = { items: [], flags: {} };
      model.prepareDerivedData();
      assert.equal(model.creationPolicyStatus.needsReview, true);
      assert.equal(model.startingAttributeReview.needsReview, true);
      const creationPolicy = creationPolicyRecord(
        { creationPointBuy: 32, startingAttributeCap: 18 },
        { role: "standard", confirmed: true, note: "Original season checked" }
      );
      const creationAttributes = startingAttributeRecord(model, [], {
        cap: 18,
        confirmed: true,
        note: "Original NPC record checked",
        scores: Object.fromEntries(Object.entries(model.abilities).map(([k, a]) => [k, a.value]))
      });
      model.parent.flags.spycraft2 = { creationPolicy, creationAttributes };
      game.settings = { get: () => ({}) };
      model.abilities.str.value = 22;
      model.prepareDerivedData();
      assert.equal(model.campaignEffects.startingAttributeCap, 18);
      assert.equal(model.startingAttributeReview.needsReview, false);
      assert.deepEqual(model.startingAttributeReview.violations, []);
      assert.equal(model.abilities.str.value, 22);
      game.settings = { get: (_id, key) => (key === "campaign" ? { qualities: ["small-screen"] } : {}) };
    }
  } finally {
    delete globalThis.game;
  }
});
test("NPC sheet persists skills, quality parameters and equipment arrays without mutating source", () => {
  const sys = make();
  sys.npcProfile.skills = [{ key: "science", grade: 1 }];
  sys.npcProfile.qualities = [{ id: "feat", units: 1, details: "" }];
  const sheet = new SpycraftNpcSheet({ system: sys });
  const data = sheet._prepareSubmitData(
    null,
    null,
    {
      object: {
        "npcSkill.0.key": "notice",
        "npcSkill.0.grade": "7",
        "npcQuality.0.id": "natural-attack",
        "npcQuality.0.caliber": "5",
        "npcQuality.0.units": "2",
        "npcQuality.0.details": "claws",
        "npcPick.weapons.0": "3",
        "system.threatLevel": "12"
      }
    },
    {}
  );
  assert.deepEqual(data["system.npcProfile.skills"], [{ key: "notice", grade: 7 }]);
  assert.deepEqual(data["system.npcProfile.equipment"].weapons, [3]);
  assert.equal(data["system.npcProfile.qualities"][0].caliber, 5);
  assert.equal(data["system.npcProfile.qualities"][0].units, 2);
  assert.equal(sys.npcProfile.skills[0].grade, 1);
  assert.ok(!Object.keys(data).some(k => /^npc(Skill|Quality|Pick)/.test(k)));
});
test("graded model uses independent table values and adds attribute modifiers exactly once", () => {
  const model = Object.assign(new NpcData(), make());
  model.npcProfile.grades = {
    initiative: 5,
    attack: 5,
    defense: 5,
    resilience: 5,
    health: 5,
    competence: 5,
    wealth: 1
  };
  model.prepareDerivedData();
  assert.equal(model.bab, 5);
  assert.equal(model.attack.ranged, 7);
  assert.equal(model.initiative.total, 6);
  assert.equal(model.defense.total, 16);
  assert.equal(model.saves.fort.total, 4);
  assert.equal(model.saves.ref.total, 6);
  assert.equal(model.damageSave, 8);
  assert.equal(model.vitality.max, 0);
  model.npcType = "special";
  model.prepareDerivedData();
  assert.equal(model.vitality.max, 35);
  assert.equal(model.wounds.max, 18);
  assert.equal(model.damageSave, null);
});
test("legacy manual NPCs retain existing stats and resources", () => {
  const sys = make();
  sys.npcProfile.enabled = false;
  sys.bab = 8;
  sys.vitality.max = 50;
  sys.wounds.max = 16;
  const model = Object.assign(new NpcData(), sys);
  model.prepareDerivedData();
  assert.equal(model.bab, 8);
  assert.equal(model.vitality.max, 50);
  assert.equal(model.wounds.max, 16);
});
test("NPC add/remove actions refuse changes on read-only sheets", async () => {
  const sheet = new SpycraftNpcSheet({ system: make(), update: () => assert.fail("Read-only mutation") });
  sheet.isEditable = false;
  for (const action of ["npcEnable", "npcAddSkill", "npcAddQuality", "npcAddPick", "npcRemoveRow"])
    await SpycraftNpcSheet.DEFAULT_OPTIONS.actions[action].call(sheet, null, {
      dataset: { category: "gear", list: "skills", index: "0" }
    });
});
test("NPC context exposes quality costs and all level columns for reference tables", () => {
  const sheet = new SpycraftNpcSheet({ system: make() });
  const ctx = sheet._npcContext();
  assert.equal(ctx.referenceTables.length, 8);
  assert.equal(ctx.levels.length, 20);
  assert.ok(Object.keys(ctx.qualityOptions).length > 30);
  assert.equal(ctx.grades.length, 7);
});

test("graded NPC and legacy manual combat values apply Shaken save/initiative/attack modifiers without changing grades, reward or health", () => {
  for (const enabled of [false, true]) {
    const model = Object.assign(new NpcData(), make());
    model.npcProfile.enabled = enabled;
    model.bab = 5;
    model.parent = { effects: [], statuses: new Set() };
    model.prepareDerivedData();
    const before = {
      attack: model.attack.ranged,
      initiative: model.initiative.total,
      ref: model.saves.ref.total,
      will: model.saves.will.total,
      fort: model.saves.fort.total,
      health: model.damageSave,
      xp: model.npcBuild?.xp
    };
    for (let grade = 1; grade <= 4; grade++) {
      model.parent.effects = [
        {
          id: "shaken",
          name: "Shaken",
          active: true,
          statuses: new Set(["shaken-" + grade]),
          flags: { spycraft2: { shakenGrade: grade } }
        }
      ];
      model.parent.statuses = new Set(["shaken-" + grade]);
      model.prepareDerivedData();
      assert.equal(model.attack.ranged, before.attack + (grade === 4 ? -4 : 0));
      assert.equal(model.initiative.total, before.initiative + (grade >= 2 ? -4 : 0));
      assert.equal(model.saves.ref.total, before.ref + (grade >= 3 ? -4 : 0));
      assert.equal(model.saves.will.total, before.will + (grade >= 3 ? -4 : 0));
      assert.equal(model.saves.fort.total, before.fort);
      assert.equal(model.damageSave, before.health);
      assert.equal(model.npcBuild?.xp, before.xp);
    }
  }
});
