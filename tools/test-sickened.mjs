import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { conditionRollPenalties } from "../module/rules/attributes.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { weaponAttack, weaponDamage } from "../module/rules/gear.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { resolveKnowledgeCheck } from "../module/rules/knowledge.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const defs = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))),
  c = defs.find(c => c.key === "soldier"),
  cls = { id: c.key, name: c.name, type: "class", system: { ...c, identifier: c.key, vitalityDie: c.vitality } },
  source = () => ({
    conditionContext: {},
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
    progression: Array.from({ length: 4 }, () => ({ classId: "soldier", vitality: 6, skills: {} })),
    actionDice: { value: 2 },
    vitality: { value: 4 },
    wounds: { value: 4 }
  }),
  compute = (sickened = false) => {
    const s = source();
    s.conditionContext.sickened = sickened;
    return computeAgent(s, [cls], cfg);
  };
test("Sickened is one explicit −2 penalty without inventing poison, nausea, attribute loss or a stacking counter", () => {
  for (const flag of [false, null, undefined, "true", 2])
    assert.equal(conditionRollPenalties({ conditionContext: { sickened: flag } }).damage, 0);
  assert.deepEqual(conditionRollPenalties({ conditionContext: { sickened: true } }), {
    sprawled: false,
    prone: false,
    meleeAttack: 0,
    sickened: true,
    bound: false,
    entangled: false,
    attack: -2,
    skill: -2,
    save: -2,
    damage: -2,
    dexSkill: 0
  });
  assert.equal(conditionRollPenalties({ conditionContext: { poisoned: true, nauseated: true } }).attack, 0);
});
test("all thirty skills and their alternate attributes, every named check, Knowledge and all three saves receive exactly −2 while ranks/caps/resources stay unchanged", () => {
  const a = compute(),
    b = compute(true);
  for (const key of Object.keys(cfg.skills)) {
    assert.equal(b.skillTotals[key].bonus, a.skillTotals[key].bonus - 2, key);
    assert.equal(b.skillTotals[key].ranks, a.skillTotals[key].ranks, key);
    assert.equal(b.skillTotals[key].cap, a.skillTotals[key].cap, key);
    for (const t of a.skillTotals[key].totals)
      assert.equal(b.skillTotals[key].totals.find(v => v.ability === t.ability).total, t.total - 2);
    for (const check of cfg.skills[key].checks ?? []) {
      const opts = { gearStatus: "available", synergySkill: "none" };
      const normal = resolveSkillCheck(a, key, check, opts),
        sick = resolveSkillCheck(b, key, check, opts);
      if (Number.isFinite(normal.total) && Number.isFinite(sick.total))
        assert.equal(sick.total, normal.total - 2, key + "/" + check.id);
    }
    assert.equal(
      resolveKnowledgeCheck(b, { skill: key }).total,
      resolveKnowledgeCheck(a, { skill: key }).total - 2,
      key + "/Knowledge"
    );
  }
  for (const save of ["fort", "ref", "will"]) assert.equal(b.saves[save].total, a.saves[save].total - 2);
  for (const attack of ["unarmed", "melee", "ranged"]) assert.equal(b.attack[attack], a.attack[attack] - 2);
  assert.deepEqual(b.skillPoints, a.skillPoints);
  assert.equal(b.defense.total, a.defense.total);
  assert.equal(b.speed, a.speed);
  assert.equal(b.actionDice.value, 2);
  assert.equal(b.wounds.value, 4);
});
test("every catalog attack formula and every implemented damage formula receives one Sickened penalty with all existing weapon restrictions retained", () => {
  const equipment = JSON.parse(readFileSync(new URL("../src/data/equipment.json", import.meta.url))),
    a = compute(),
    b = compute(true);
  let attacks = 0,
    damage = 0;
  for (const w of equipment.weapons) {
    const x = weaponAttack(a, w, cfg),
      y = weaponAttack(b, w, cfg);
    assert.equal(y.total, x.total - 2, w.name);
    assert.equal(y.blocked, x.blocked, w.name);
    attacks++;
    const dx = weaponDamage(a, w),
      dy = weaponDamage(b, w);
    if (dx?.formula && dy?.formula) {
      assert.equal(dy.bonus, dx.bonus - 2, w.name);
      assert.equal(dy.min, dx.min, w.name);
      damage++;
    }
  }
  assert.equal(attacks, 458);
  assert.ok(damage > 350, damage);
});
let formulas = [],
  input = null;
globalThis.Actor = class {};
globalThis.CONFIG = {
  SPYCRAFT: cfg,
  statusEffects: [{ id: "sickened", name: "Sickened", img: "icons/svg/downgrade.svg" }]
};
globalThis.game = { user: { isGM: true }, i18n: { localize: s => s, format: s => s }, settings: { get: () => ({}) } };
globalThis.foundry = {
  utils: { escapeHTML: s => String(s) },
  applications: { api: { DialogV2: { input: async () => input } } }
};
globalThis.ui = { notifications: { warn: () => null } };
globalThis.ChatMessage = { getSpeaker: () => ({}) };
globalThis.Roll = class {
  constructor(formula, data = {}) {
    this.formula = formula;
    this.data = data;
    formulas.push(formula);
  }
  async evaluate() {
    const text = this.formula
      .replace(/@total/g, String(this.data.total ?? 0))
      .replace(/\b\d*d\d+\b/g, "3")
      .replace(/max\(/g, "Math.max(");
    this.total = Function("return (" + text + ")")();
    this.dice = /d\d+/.test(this.formula) ? [{ total: 3 }] : [];
    return this;
  }
  async toMessage(data) {
    return { ...data, rolls: [this] };
  }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");
function actor() {
  formulas = [];
  input = null;
  const a = new SpycraftActor();
  Object.assign(a, {
    uuid: "Actor.sickened",
    type: "agent",
    isOwner: true,
    system: compute(true),
    items: [],
    statuses: new Set(["sickened"])
  });
  a.getRollData = () => ({});
  a.weaponContext = () => ({});
  a.weaponAttack = item => weaponAttack(a.system, item.system, cfg);
  const effect = data => ({
    ...data,
    id: data._id,
    statuses: new Set(data.statuses),
    active: !data.disabled,
    changes: data.changes ?? [],
    toObject() {
      return { ...data, statuses: [...this.statuses] };
    }
  });
  a.effects = [effect({ _id: "original", name: "Sickened", statuses: ["sickened"] })];
  Object.defineProperty(a, "appliedEffects", { get: () => a.effects.filter(e => e.active) });
  const refresh = () => {
    a.statuses = new Set(a.effects.filter(e => e.active).flatMap(e => [...e.statuses]));
    a.system = compute(a.statuses.has("sickened"));
  };
  a.createEmbeddedDocuments = async (_type, data) => {
    const made = data.map((d, i) => effect({ ...d, _id: d._id ?? "new" + i }));
    a.effects.push(...made);
    refresh();
    return made;
  };
  a.deleteEmbeddedDocuments = async (_type, ids) => {
    a.effects = a.effects.filter(e => !ids.includes(e.id));
    refresh();
    return ids;
  };
  a.updateEmbeddedDocuments = async (_type, data) => {
    for (const d of data) {
      const e = a.effects.find(e => e.id === d._id);
      e.statuses = new Set(d.statuses);
    }
    refresh();
    return data;
  };
  return a;
}
test("weapon damage, knuckle/finesse/improvised bonuses and separate stress damage preserve damage minima without applying Sickened twice", async () => {
  const a = actor(),
    blade = {
      id: "blade",
      uuid: "Item.blade",
      name: "Blade",
      type: "weapon",
      system: { proficiency: "edged", damage: "1d6", sizeHands: "S/1h", qualities: "" }
    };
  a.system.proficiencyTotals.edged = { proficient: true };
  const m = await a.rollDamage(blade);
  assert.equal(m.rolls[0].total, 2);
  assert.equal(m.flags.spycraft2.conditionDamagePenalty, -2);
  assert.equal(formulas.length, 1);
  assert.ok(!formulas[0].startsWith("max(0"));
  const stress = await a.rollCheck("1d4", {}, { checkKind: "damage" });
  assert.equal(stress.rolls[0].total, 1);
  assert.equal(stress.flags.spycraft2.conditionDamagePenalty, -2);
  const low = await a.rollCheck("1", {}, { checkKind: "damage" });
  assert.equal(low.rolls[0].total, 0);
  for (const patch of [{ qualities: "FIN", useFinesse: true }, { qualities: "NKL" }, { improvised: true }]) {
    const normal = compute(),
      sick = compute(true);
    const w = { ...blade.system, ...patch };
    assert.equal(weaponDamage(sick, w).bonus, weaponDamage(normal, w).bonus - 2);
  }
  assert.equal(a.system.actionDice.value, 2);
  assert.equal(a.system.wounds.value, 4);
});
test("Sickened condition controls require explicit GC declaration, persist only the chosen status, and clearing restores all derived totals", async () => {
  const a = actor(),
    before = a.system.saves.fort.total;
  assert.equal(await a.setSickened(), null);
  assert.equal(await a.setSickened({ active: false }), null);
  assert.equal(await a.setSickened({ active: "false", confirmed: true }), null);
  await a.setSickened({ active: false, confirmed: true });
  assert.equal(a.statuses.has("sickened"), false);
  assert.equal(a.system.saves.fort.total, before + 2);
  await a.setSickened({ active: true, confirmed: true });
  assert.equal(a.statuses.has("sickened"), true);
  assert.equal(a.system.saves.fort.total, before);
  assert.equal(a.system.actionDice.value, 2);
  assert.equal(a.system.wounds.value, 4);
});
