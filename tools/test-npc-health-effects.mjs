import test from "node:test";
import assert from "node:assert/strict";
import { npcFeatEffects, npcHealthSaveAdjustment } from "../module/rules/npc-feat-effects.mjs";

globalThis.game = { ready: false };
globalThis.Actor = class {
  constructor() {
    this.type = "npc";
    this.effects = [];
    this.items = [];
    this._source = { system: { vitality: { max: 0 }, wounds: { max: 0 } } };
    this.system = { npcProfile: { enabled: true }, vitality: { max: 0 }, wounds: { max: 0 }, damageSaveAdjust: 0 };
  }
  prepareData() {
    const s = this.system;
    s.vitality.max = s.wounds.max = 0;
    this.applyActiveEffects("initial");
    s.damageSave = 10;
    if (s.npcProfile.enabled) s.vitality.max = s.wounds.max = 0;
    s.featEffects = npcFeatEffects(this.items);
    s.featEffects.damageSaveHealth = npcHealthSaveAdjustment(s.featEffects, s);
    s.warnings = [];
    this.applyActiveEffects("final");
  }
  applyActiveEffects(phase) {
    for (const effect of this.effects.filter(e => !e.disabled && e.phase === phase))
      this.system[effect.pool].max += effect.value;
  }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");

test("both effect phases contribute to standard NPC saves and disappear with their source without creating health pools", () => {
  for (const enabled of [true, false]) {
    const actor = new SpycraftActor();
    actor.system.npcProfile.enabled = enabled;
    actor.items = [
      {
        type: "feat",
        name: "Health fixture",
        system: {
          bonuses: [
            { target: "vitality", value: "5" },
            { target: "wounds", value: "-1" }
          ]
        }
      }
    ];
    actor.effects = [
      { phase: "initial", pool: "vitality", value: 4 },
      { phase: "final", pool: "wounds", value: 2 }
    ];
    actor.prepareData();
    assert.equal(actor.system.featEffects.damageSaveHealth.applied, 5);
    assert.equal(actor.system.vitality.max, 0);
    assert.equal(actor.system.wounds.max, 0);
    actor.prepareData();
    assert.equal(actor.system.featEffects.damageSaveHealth.applied, 5, "no preparation accumulation");
    actor.effects[0].disabled = true;
    actor.prepareData();
    assert.equal(actor.system.featEffects.damageSaveHealth.applied, 3);
    actor.effects = [];
    actor.prepareData();
    assert.equal(actor.system.featEffects.damageSaveHealth.applied, 1);
    assert.equal(
      actor.system.featEffects.rows.some(row => row.name === "Active Effects"),
      false
    );
    actor.items = [];
    actor.effects = [
      { phase: "initial", pool: "vitality", value: -4 },
      { phase: "final", pool: "wounds", value: -2 }
    ];
    actor.prepareData();
    assert.equal(actor.system.featEffects.damageSaveHealth.applied, -4);
  }
});

test("temporary effects respect legacy accounting review and keep manual maximums unchanged", () => {
  const actor = new SpycraftActor();
  actor.system.damageSaveAdjust = 2;
  actor.effects = [{ phase: "final", pool: "vitality", value: 4 }];
  actor.prepareData();
  assert.equal(actor.system.featEffects.damageSaveHealth.needsReview, true);
  assert.equal(actor.system.featEffects.damageSaveHealth.applied, 0);
  assert.equal(actor.system.warnings.length, 1);
  actor.system.damageSaveHealthMode = "automatic";
  actor.prepareData();
  assert.equal(actor.system.featEffects.damageSaveHealth.applied, 2);
  assert.deepEqual(actor.system.warnings, []);
});
