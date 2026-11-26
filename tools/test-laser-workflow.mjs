import test from "node:test";
import assert from "node:assert/strict";
import { weaponDamage } from "../module/rules/gear.mjs";
import { criticalPlan } from "../module/rules/criticals.mjs";
import { incomingDefensePlan } from "../module/rules/defense.mjs";
import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
import "./fixtures/fatigue-actor.mjs";
const { SpycraftActor } = await import("../module/documents/actor.mjs");
foundry.utils.escapeHTML = String;
const system = () => ({
  activeFeatNames: [],
  classLevels: {},
  abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 14, mod: 2 }])),
  proficiencyTotals: { rifle: { proficient: true } },
  defense: { total: 18, dexterity: 2, dodgeBonuses: 3 }
});
const weapon = { proficiency: "rifle", damage: "3d6 laser", range: 50, sizeHands: "M/2h" };
test("laser weapon damage loses intrinsic dice at exact measured increment boundaries and can reach zero", () => {
  const s = system();
  for (const [distance, dice] of [
    [0, 3],
    [50, 3],
    [50.01, 2],
    [100, 2],
    [150, 1],
    [150.01, 0],
    [300, 0]
  ]) {
    const d = weaponDamage(s, weapon, { distanceFeet: distance });
    assert.equal(d.laserDamage.dice, dice);
    assert.equal(d.formula, dice ? `max(1, ${dice}d6 + (0))` : "0");
  }
  assert.equal(weaponDamage(s, weapon).blocked, true);
  assert.equal(weaponDamage(s, weapon, { distanceFeet: 100, laserRangeIncrement: 100 }).laserDamage.dice, 3);
});
test("laser attacks remove positive dodge without removing Dexterity or adding conditional Foibles dodge", () => {
  const s = system();
  s.weaponSpecialist = { abilities: ["Foibles"], proficiencies: ["rifle"] };
  const plain = incomingDefensePlan(s, { weaponProficiency: "rifle" });
  const laser = incomingDefensePlan(s, { weaponProficiency: "rifle", damageType: "laser", anticipateDodge: 4 });
  assert.equal(plain.total, 19);
  assert.equal(laser.total, 15);
  assert.equal(laser.dexterity, 2);
  assert.equal(laser.specialistDodge, 0);
});
test("laser critical discount reaches zero and its type cannot change after captured roll evidence", () => {
  const check = {
    checkKind: "attack",
    weaponProficiency: "rifle",
    threatConfirmed: true,
    attackContext: { damageType: "laser" }
  };
  const options = { effect: "Damage to wounds", effectConfirmed: true, beforeDamage: true, baseCost: 1, available: 0 };
  assert.equal(criticalPlan({}, check, options).cost, 0);
  const proof = rollEvidence(check);
  check.attackContext.damageType = "fire";
  assert.equal(rollEvidenceMatches(check, proof), false);
  assert.equal(criticalPlan({}, check, options).blocked, true);
});
test("real damage dispatch reuses original range, asks for an unknown distance, and does not roll on cancellation", async () => {
  const item = { id: "laser", uuid: "Actor.laser.Item.laser", name: "Laser", type: "weapon", system: weapon };
  const a = {
    uuid: "Actor.laser",
    type: "agent",
    isOwner: true,
    system: system(),
    items: [item],
    weaponContext: (_w, o) => o,
    getRollData: () => ({}),
    weaponAttack: () => ({ range: 50 }),
    rollCheck: async (formula, _data, options) => ({ formula, options })
  };
  a.items.get = id => a.items.find(i => i.id === id);
  const before = globalThis.fromUuidSync,
    beforeInput = foundry.applications.api.DialogV2.input;
  globalThis.fromUuidSync = uuid =>
    uuid === "ChatMessage.laser"
      ? { flags: { spycraft2: { attackContext: { rangeKnown: true, distanceFeet: 100, rangeIncrement: 100 } } } }
      : null;
  try {
    const d = await SpycraftActor.prototype.rollDamage.call(a, item, {
      includeSneakAttack: false,
      sourceAttack: { uuid: "ChatMessage.laser" }
    });
    assert.equal(d.formula, "max(1, 3d6 + (0))");
    foundry.applications.api.DialogV2.input = async () => null;
    assert.equal(await SpycraftActor.prototype.rollDamage.call(a, item, { includeSneakAttack: false }), null);
    foundry.applications.api.DialogV2.input = async () => ({ distanceFeet: "150" });
    assert.equal(
      (await SpycraftActor.prototype.rollDamage.call(a, item, { includeSneakAttack: false })).formula,
      "max(1, 1d6 + (0))"
    );
  } finally {
    globalThis.fromUuidSync = before;
    foundry.applications.api.DialogV2.input = beforeInput;
  }
});
