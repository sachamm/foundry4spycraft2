import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { burrowCapabilities, burrowMaterialPlan } from "../module/rules/environment.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { checkBurrowMaterial } from "../module/apps/burrow-material.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const state = strength => ({ originEffects: [{ qualityKey: "burrow" }], abilities: { str: { value: strength } } });
test("Burrow uses rounded-up half of the actual Strength score for every boundary and never permits Run actions", () => {
  for (let strength = 0; strength <= 60; strength++) {
    const s = state(strength),
      cap = burrowCapabilities(s);
    assert.equal(cap.maximumMaterialSave, Math.ceil(strength / 2));
    for (const bonus of [-2, 0, 6, 7, cap.maximumMaterialSave, cap.maximumMaterialSave + 1]) {
      const p = burrowMaterialPlan(s, { damageSaveBonus: bonus });
      assert.equal(p.allowed, bonus <= Math.ceil(strength / 2));
      assert.equal(p.materialAllowed, bonus <= Math.ceil(strength / 2));
      assert.equal(burrowMaterialPlan(s, { damageSaveBonus: bonus, action: "run" }).allowed, false);
    }
  }
  assert.equal(burrowCapabilities({ originEffects: [{ details: "Burrow" }], abilities: { str: { value: 13 } } }), null);
  for (const bad of [-1, NaN, Infinity, "13", 13.5]) assert.equal(burrowCapabilities(state(bad)), null);
  for (const value of [null, undefined, "6", 1.5, Infinity])
    assert.throws(() => burrowMaterialPlan(state(13), { damageSaveBonus: value }), /whole/);
  assert.throws(() => burrowMaterialPlan(state(13), { damageSaveBonus: 6, action: "teleport" }), /movement/);
  assert.throws(() => burrowMaterialPlan(state(13), { damageSaveBonus: 6, followerHasBurrow: "true" }), /follower/);
});
test("the pursuit prohibition applies to material at +6 or less, preserves the follower’s separate Burrow limits and never claims a passage when movement is blocked", () => {
  for (const bonus of [-2, 0, 5, 6, 7, 8])
    for (const has of [true, false]) {
      const p = burrowMaterialPlan(state(15), { damageSaveBonus: bonus, followerHasBurrow: has });
      assert.equal(p.ordinaryFollowersBlocked, bonus <= 6);
      assert.equal(p.selectedFollowerBlocked, bonus <= 6 && !has);
      if (has) assert.match(p.notes.at(-1), /separately/);
    }
  const blocked = burrowMaterialPlan(state(10), { damageSaveBonus: 6 });
  assert.equal(blocked.ordinaryFollowersBlocked, false);
  assert.equal(blocked.allowed, false);
  assert.match(burrowMaterialPlan(state(13), { damageSaveBonus: 7 }).notes[0], /does not prohibit/);
});
test("the real Test Subject source derives Burrow once, updates with Strength and source removal, and leaves movement speed/resources intact", () => {
  const origins = JSON.parse(readFileSync(new URL("../src/data/origins.json", import.meta.url))),
    subject = origins.specialties.find(o => o.name === "Test Subject"),
    cls = {
      id: "s",
      name: "Test",
      type: "class",
      system: { identifier: "test", classSkills: [], skillPoints: 4, vitalityDie: 6, proficiencies: 0, table: [] }
    },
    o = {
      id: "o",
      name: subject.name,
      type: "origin",
      system: { ...subject, originChoices: { npcQuality0: "burrow", npcQuality1: "aquatic", up: "con", down: "int" } }
    },
    source = () => ({
      abilities: Object.fromEntries(
        ["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: k === "str" ? 13 : 12 }])
      ),
      progression: [{ classId: "test", vitality: 6, skills: {} }],
      actionDice: { value: 0 }
    }),
    s = computeAgent(source(), [cls, o], cfg);
  assert.equal(s.burrowCapabilities.maximumMaterialSave, 7);
  assert.equal(s.speed, 30);
  assert.equal(s.actionDice.value, 0);
  const changed = source();
  changed.abilities.str.misc = 2;
  assert.equal(computeAgent(changed, [cls, o], cfg).burrowCapabilities.maximumMaterialSave, 8);
  o.system.originChoices.npcQuality0 = "fearless";
  assert.equal(computeAgent(source(), [cls, o], cfg).burrowCapabilities, null);
});
let responses = [],
  messages = [],
  warnings = [],
  change = null;
globalThis.foundry = {
  utils: { escapeHTML: s => String(s) },
  applications: {
    api: {
      DialogV2: {
        async input(options) {
          messages.push(options);
          change?.();
          return responses.shift() ?? null;
        }
      }
    }
  }
};
globalThis.ui = { notifications: { warn: s => warnings.push(s) } };
test("the calculator is read-only, validates native inputs, cancels cleanly and rechecks a source lost while choosing a material", async () => {
  const a = {
      type: "agent",
      isOwner: true,
      system: { ...state(13), actionDice: { value: 3 }, progression: [], token: { x: 20, y: 40 } }
    },
    before = structuredClone(a.system);
  responses = [{ damageSaveBonus: "6", action: "move", followerHasBurrow: false }, {}];
  messages = [];
  const p = await checkBurrowMaterial(a);
  assert.equal(p.allowed, true);
  assert.equal(p.selectedFollowerBlocked, true);
  assert.match(messages[1].content, /fills in behind/);
  assert.deepEqual(a.system, before);
  responses = [null];
  assert.equal(await checkBurrowMaterial(a), null);
  for (const value of ["", " ", 1.5, "wrong"]) {
    responses = [{ damageSaveBonus: value, action: "move" }];
    assert.equal(await checkBurrowMaterial(a), null);
  }
  responses = [{ damageSaveBonus: "7", action: "run" }];
  assert.equal((await checkBurrowMaterial(a)).allowed, false);
  responses = [{ damageSaveBonus: "6", action: "move" }];
  change = () => {
    a.system.originEffects = [];
  };
  assert.equal(await checkBurrowMaterial(a), null);
  change = null;
  assert.ok(warnings.length >= 5);
});
