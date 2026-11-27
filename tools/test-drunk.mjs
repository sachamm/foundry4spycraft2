import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { conditionAbilityPenalty } from "../module/rules/attributes.mjs";
import { isolatedClassAbilityCalculation as computeAgent } from "./lib/class-ability-fixture.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { resolveKnowledgeCheck } from "../module/rules/knowledge.mjs";
import { weaponAttack, weaponDamage } from "../module/rules/gear.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const defs = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))),
  equipment = JSON.parse(readFileSync(new URL("../src/data/equipment.json", import.meta.url))),
  keys = ["str", "dex", "con", "int", "wis", "cha"],
  items = ["soldier", "schemer"].map(key => {
    const c = defs.find(c => c.key === key);
    return { id: key, name: c.name, type: "class", system: { ...c, identifier: key, vitalityDie: c.vitality } };
  }),
  source = () => ({
    conditionContext: {},
    abilities: Object.fromEntries(keys.map(key => [key, { base: 14 }])),
    progression: [
      ...Array.from({ length: 4 }, () => ({ classId: "soldier", vitality: 6, skills: {} })),
      ...Array.from({ length: 4 }, () => ({ classId: "schemer", vitality: 6, skills: {} }))
    ],
    actionDice: { value: 0 },
    vitality: { value: 4 },
    wounds: { value: 4 }
  }),
  compute = (conditions = {}) =>
    computeAgent({ ...source(), conditionContext: conditions }, structuredClone(items), cfg),
  opts = { gearStatus: "available", synergySkill: "none", trackingSurface: "verySoft" };
test("Drunk applies exactly one −2 to DEX/WIS checks and does not accept a truthy non-boolean condition", () => {
  for (const drunk of [false, undefined, "true", 2, true])
    for (const key of keys)
      assert.equal(
        conditionAbilityPenalty({ conditionContext: { drunk } }, key),
        drunk === true && ["dex", "wis"].includes(key) ? -2 : 0
      );
});
test("every skill, alternate ability and named use follows its resolved DEX/WIS ability without changing attributes, ranks, caps, Knowledge or resources", () => {
  const a = compute(),
    b = compute({ drunk: true });
  for (const [key, skill] of Object.entries(cfg.skills)) {
    for (const t of a.skillTotals[key].totals)
      assert.equal(
        b.skillTotals[key].totals.find(v => v.ability === t.ability).total,
        t.total - (["dex", "wis"].includes(t.ability) ? 2 : 0),
        key + "/" + t.ability
      );
    for (const check of skill.checks)
      for (const ability of check.attributes) {
        const x = resolveSkillCheck(a, key, check, { ...opts, ability }),
          y = resolveSkillCheck(b, key, check, { ...opts, ability });
        assert.equal(
          y.total,
          x.total - (["dex", "wis"].includes(y.ability) ? 2 : 0),
          key + "/" + check.id + "/" + ability
        );
        assert.equal(y.cap, x.cap);
      }
    assert.equal(b.skillTotals[key].ranks, a.skillTotals[key].ranks);
  }
  for (const key of keys) assert.equal(b.abilities[key].value, a.abilities[key].value);
  assert.equal(
    resolveKnowledgeCheck(b, { skill: "analysis" }).total,
    resolveKnowledgeCheck(a, { skill: "analysis" }).total
  );
  assert.equal(b.speed, a.speed);
  assert.equal(b.defense.total, a.defense.total);
  assert.equal(b.actionDice.value, 0);
  assert.equal(b.wounds.value, 4);
  assert.deepEqual(b.skillPoints, a.skillPoints);
});
test("Reflex, Will, Initiative and ranged Main totals take −2 while Fortitude, Strength attacks and damage remain unchanged", () => {
  const a = compute(),
    b = compute({ drunk: true });
  for (const key of ["ref", "will"]) {
    assert.equal(b.saves[key].total, a.saves[key].total - 2);
    assert.ok(b.saves[key].bonusEntries.some(e => e.name === "Drunk" || e.source === "Drunk"));
  }
  assert.equal(b.saves.fort.total, a.saves.fort.total);
  assert.equal(b.initiative.total, a.initiative.total - 2);
  assert.equal(b.attack.ranged, a.attack.ranged - 2);
  for (const key of ["unarmed", "melee"]) assert.equal(b.attack[key], a.attack[key]);
  assert.equal(b.unarmed.damageBonus, a.unarmed.damageBonus);
});
test("every catalog attack uses its actual resolved ability, including launcher substitutions, and Drunk never changes weapon damage", () => {
  const a = compute(),
    b = compute({ drunk: true });
  let count = 0;
  for (const w of equipment.weapons) {
    for (const options of [{}, { indirectFire: true }]) {
      const x = weaponAttack(a, w, cfg, "agent", options),
        y = weaponAttack(b, w, cfg, "agent", options);
      assert.equal(y.total, x.total - (["dex", "wis"].includes(y.ability) ? 2 : 0), w.name);
      assert.equal(y.blocked, x.blocked, w.name);
    }
    const x = weaponDamage(a, w),
      y = weaponDamage(b, w);
    if (x?.formula && y?.formula) assert.equal(y.bonus, x.bonus, w.name);
    count++;
  }
  assert.equal(count, 458);
});
test("Intelligence substitution removes the original Drunk penalty while independent Entangled/Sickened penalties keep their proper scopes", () => {
  const a = compute(),
    b = compute({ drunk: true, entangled: true, sickened: true }),
    balance = cfg.skills.acrobatics.checks.find(c => c.id === "balance"),
    x = resolveSkillCheck(a, "acrobatics", balance, opts),
    y = resolveSkillCheck(b, "acrobatics", balance, opts),
    normalInt = resolveSkillCheck(a, "acrobatics", balance, { ...opts, allAccordingToPlan: true }),
    sub = resolveSkillCheck(b, "acrobatics", balance, { ...opts, allAccordingToPlan: true });
  assert.equal(y.total, x.total - 8);
  assert.equal(sub.total, normalInt.total - 2);
  assert.equal(sub.ability, "int");
  assert.match(y.notes, /Drunk/);
  assert.match(y.notes, /Entangled/);
  assert.ok(!sub.notes.includes("Drunk:"));
  assert.ok(!sub.notes.includes("Entangled/Bound: Dexterity"));
});
globalThis.Actor = class {};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = { user: { isGM: true }, i18n: { localize: s => s }, settings: { get: () => false } };
globalThis.ui = { notifications: { warn: () => null } };
globalThis.foundry = { utils: { escapeHTML: s => String(s) } };
const { SpycraftActor } = await import("../module/documents/actor.mjs");
function actor() {
  const a = new SpycraftActor();
  Object.assign(a, {
    type: "agent",
    uuid: "Actor.drunk",
    isOwner: true,
    system: compute({ drunk: true }),
    items: [],
    statuses: new Set(["drunk"])
  });
  a.rollCheck = async (formula, data, options) => ({ formula, data, options });
  return a;
}
test("actual ability/save/attack entries freeze the scoped Drunk adjustment and keep health and dice intact", async () => {
  const a = actor();
  for (const ability of keys) {
    const m = await a.rollAbility(ability);
    assert.equal(m.data.mod, a.system.abilities[ability].mod - (["dex", "wis"].includes(ability) ? 2 : 0));
    assert.equal(m.options.checkKind, "ability");
    assert.equal(m.options.ability, ability);
    assert.equal(m.options.conditionAbilityAdjustment, ["dex", "wis"].includes(ability) ? -2 : 0);
  }
  for (const save of ["fort", "ref", "will"])
    assert.equal((await a.rollSave(save)).data.total, a.system.saves[save].total);
  const item = {
    name: "QA Rifle",
    uuid: "Item.rifle",
    type: "weapon",
    system: {
      proficiency: "rifle",
      weaponCategory: "assaultRifle",
      sizeHands: "S/2h",
      range: 100,
      recoil: 1,
      errorThreat: "1/20",
      fireMode: "single",
      fireModes: ["single"]
    }
  };
  const m = await a.rollAttack(item, {});
  assert.equal(m.options.attackContext.conditionAttackPenalty, -2);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.wounds.value, 4);
});
test("ordinary ability checks reject invalid abilities and no-action incapacities, with explicit purely mental confirmation under paralysis", async () => {
  const a = actor();
  assert.equal(await a.rollAbility("invalid"), null);
  for (const key of ["dead", "dazed", "stunned", "unconscious"]) {
    a.system.conditionContext = { [key]: true };
    assert.equal(await a.rollAbility("wis"), false, key);
  }
  a.system.conditionContext = { paralyzed: true };
  assert.equal(await a.rollAbility("dex", { purelyMentalConfirmed: true }), false);
  assert.equal(await a.rollAbility("str", { purelyMentalConfirmed: true }), false);
  assert.equal(await a.rollAbility("int"), false);
  assert.ok(await a.rollAbility("int", { purelyMentalConfirmed: true }));
});
