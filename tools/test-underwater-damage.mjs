import test from "node:test";
import assert from "node:assert/strict";
import { weaponDamage } from "../module/rules/gear.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import "./fixtures/fatigue-actor.mjs";
const { SpycraftActor } = await import("../module/documents/actor.mjs");
foundry.utils.escapeHTML = String;
const system = () => ({
  activeFeatNames: [],
  classLevels: {},
  abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 14, mod: 2 }])),
  proficiencyTotals: Object.fromEntries(Object.keys(cfg.proficiencies).map(k => [k, { proficient: true }]))
});
const weapon = (patch = {}) => ({ proficiency: "edged", damage: "1d6", sizeHands: "D/1h", ...patch });
test("underwater halves standard Strength-based melee weapon damage, rounding up", () => {
  for (const strength of [-2, 0, 3]) {
    const s = system();
    s.abilities.str.mod = strength;
    const dry = weaponDamage(s, weapon()),
      wet = weaponDamage(s, weapon(), { underwater: true });
    assert.equal(wet.formula, `ceil((${dry.formula}) / 2)`);
    assert.equal(wet.underwaterDamage, true);
  }
});
test("unarmed, ranged and Dexterity-substituted finesse damage retain their ordinary formula", () => {
  for (const [w, options] of [
    [weapon({ proficiency: "unarmed" }), {}],
    [weapon({ proficiency: "rifle" }), {}],
    [weapon({ qualities: "FIN" }), { finesse: true }]
  ]) {
    const s = system();
    assert.equal(weaponDamage(s, w, { ...options, underwater: true }).formula, weaponDamage(s, w, options).formula);
  }
});
test("rolled bonus damage is added after underwater halving, while flat Strength stays inside", () => {
  const s = system();
  s.weaponSpecialist = { abilities: ["Killer Instinct"], proficiencies: ["edged"] };
  const wet = weaponDamage(s, weapon(), { underwater: true });
  assert.equal(wet.formula, "ceil((max(1, 1d6 + (2))) / 2) + 1d4");
  assert.equal(weaponDamage(s, weapon()).formula, "max(1, 1d6 + 1d4 + (2))");
});
test("the real damage workflow carries the attack's underwater declaration and permits an explicit correction", async () => {
  const item = { id: "blade", uuid: "Actor.swimmer.Item.blade", name: "Blade", type: "weapon", system: weapon() };
  const a = {
    uuid: "Actor.swimmer",
    type: "agent",
    isOwner: true,
    system: system(),
    items: [item],
    weaponContext: (_item, options) => options,
    getRollData: () => ({}),
    weaponAttack: () => ({ range: 0 }),
    rollCheck: async (formula, _data, options) => ({ formula, options })
  };
  a.items.get = id => a.items.find(i => i.id === id);
  const before = globalThis.fromUuidSync;
  globalThis.fromUuidSync = uuid =>
    uuid === "ChatMessage.underwater" ? { flags: { spycraft2: { attackContext: { underwater: true } } } } : null;
  try {
    const options = { includeSneakAttack: false, sourceAttack: { uuid: "ChatMessage.underwater" } };
    const wet = await SpycraftActor.prototype.rollDamage.call(a, item, options);
    assert.match(wet.formula, /^ceil\(/);
    assert.equal(wet.options.underwaterDamage, true);
    const corrected = await SpycraftActor.prototype.rollDamage.call(a, item, { ...options, underwater: false });
    assert.ok(!corrected.formula.startsWith("ceil("));
  } finally {
    globalThis.fromUuidSync = before;
  }
});
