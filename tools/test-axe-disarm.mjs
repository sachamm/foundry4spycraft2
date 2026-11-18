import test from "node:test";
import assert from "node:assert/strict";
import { axeDisarmPlan, validateAxeDisarmProof as validate } from "../module/rules/axe-disarm.mjs";

import { weaponAttack } from "../module/rules/gear.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
const held = (id = "axe") => ({
    id,
    name: "Reviewed axe",
    family: "axe",
    proficiency: "edged",
    hands: 1,
    requiredHands: 1
  }),
  state = (active = true) => ({
    size: "Medium",
    bab: 4,
    abilities: { str: { value: 14, mod: 2 }, dex: { value: 12, mod: 1 } },
    conditionContext: {},
    activeFeatNames: active ? ["Axe Basics"] : [],
    readiedMeleeWeapons: [held()],
    proficiencyTotals: { edged: { proficient: true }, unarmed: { proficient: true }, handgun: { proficient: true } }
  }),
  weapon = (proficiency = "edged") => ({
    proficiency,
    sizeHands: "S/1h",
    equipped: true,
    carried: true,
    quantity: 1,
    qualities: "",
    error: 1,
    threat: 20,
    damage: "1d6",
    range: proficiency === "handgun" ? 50 : 0
  }),
  context = {
    confirmed: true,
    lineOfSightConfirmed: true,
    rangeConfirmed: true,
    opponentArmedConfirmed: true,
    opponentWeaponSize: "Small",
    opponentLabel: "Opponent"
  };
const attack = (s = state(), proficiency = "edged", disarm = context) =>
  weaponAttack(s, weapon(proficiency), cfg, "agent", { attackAction: "standard", disarm });
test("Axe Basics adds one gear point to melee Disarm attacks with any attacking weapon, including unarmed, but never ranged or ordinary attacks", () => {
  for (const p of ["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged"]) {
    const s = state(),
      a = attack(s, p),
      b = attack(state(false), p);
    assert.equal(a.total - b.total, 1, p);
    assert.equal(a.disarm.axeBasics.gearBonus, 1);
    assert.equal(a.disarm.axeBasics.source.weapons[0].id, "axe");
  }
  assert.equal(attack().total - attack(state(false)).total, 1);
  assert.equal(attack(state(), "handgun").total, attack(state(false), "handgun").total);
  assert.equal(Object.hasOwn(attack(state(), "handgun").disarm, "axeBasics"), false);
  assert.equal(attack(state(), "edged", null).total, attack(state(false), "edged", null).total);
  assert.equal(
    axeDisarmPlan(
      {
        get activeFeatNames() {
          throw Error("Unused");
        }
      },
      { ranged: true }
    ),
    null
  );
});
test("actual qualification and held family/grip gate the benefit and multiple readied axes do not multiply it", () => {
  const s = state();
  s.readiedMeleeWeapons.push(held("second"));
  assert.equal(attack(s).total - attack(state(false)).total, 1);
  assert.equal(attack(s).disarm.axeBasics.source.weapons.length, 2);
  for (const change of [
    x => (x.activeFeatNames = []),
    x => (x.readiedMeleeWeapons = []),
    x => (x.readiedMeleeWeapons[0].family = "spear")
  ]) {
    const n = state();
    change(n);
    assert.equal(attack(n).disarm.axeBasics.gearBonus, 0);
  }
  const n = state();
  n.readiedMeleeWeapons[0].hands = 0;
  assert.equal(attack(n).blocked, true);
});
test("the gear point stays independent of Size/two-hand/Expert Disarm/error and introduces no armor-piercing or weapon mutation", () => {
  const s = state(),
    w = weapon();
  s.activeFeatNames.push("Expert Disarm");
  w.sizeHands = "M/2h";
  const before = structuredClone(w),
    a = weaponAttack(s, w, cfg, "agent", { attackAction: "standard", disarm: context }),
    b = weaponAttack({ ...s, activeFeatNames: ["Expert Disarm"] }, w, cfg, "agent", {
      attackAction: "standard",
      disarm: context
    });
  assert.equal(a.total - b.total, 1);
  for (const k of ["sizeBonus", "twoHandBonus", "expertBonus", "errorIncrease"]) assert.equal(a.disarm[k], b.disarm[k]);
  assert.equal(a.error, b.error);
  assert.equal(a.weaponQualities, b.weaponQualities);
  assert.deepEqual(w, before);
});
test("new proof binds zero-source gain/loss and exact current identity/grip; absent old disarm markers retain historical compatibility", () => {
  const s = state(),
    d = attack(s).disarm,
    c = { checkKind: "attack", weaponProficiency: "edged" };
  validate(s, d, c);
  for (const change of [
    x => (x.activeFeatNames = []),
    x => (x.readiedMeleeWeapons = []),
    x => (x.readiedMeleeWeapons[0].id = "new"),
    x => (x.readiedMeleeWeapons[0].hands = 2)
  ]) {
    const n = state();
    change(n);
    assert.throws(() => validate(n, d, c), /changed/);
  }
  assert.throws(() => validate(s, attack(state(false)).disarm, c), /changed/);
  assert.throws(() => validate(s, d, { ...c, checkKind: "damage" }), /changed/);
  assert.throws(() => validate(s, d, { ...c, weaponProficiency: "handgun" }), /changed/);
  validate(s, { active: true }, c);
  const reverse = v =>
    Array.isArray(v)
      ? v.map(reverse)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .reverse()
              .map(([k, x]) => [k, reverse(x)])
          )
        : v;
  validate(s, reverse(d), c);
});
test("existing Disarm receipt evidence freezes the added gear/source details without a new prefix or changing old contexts", () => {
  const c = { checkKind: "attack", attackContext: { disarm: attack().disarm } },
    e = rollEvidence(c);
  assert.equal(rollEvidenceMatches(e, c), true);
  for (const change of [
    x => delete x.attackContext.disarm.axeBasics,
    x => (x.attackContext.disarm.axeBasics.gearBonus = 99),
    x => (x.attackContext.disarm.axeBasics.source.weapons[0].id = "new")
  ]) {
    const n = structuredClone(c);
    change(n);
    assert.equal(rollEvidenceMatches(e, n), false);
  }
  const legacy = structuredClone(c);
  delete legacy.attackContext.disarm.axeBasics;
  assert.equal(rollEvidenceMatches(rollEvidence(legacy), legacy), true);
});
const { makeFatigueActor } = await import("./fixtures/fatigue-actor.mjs");
const { rollDisarm } = await import("../module/apps/disarm.mjs");
foundry.utils.escapeHTML = String;
function actor() {
  const a = makeFatigueActor();
  a.system = state();
  a.items = [{ id: "blade", uuid: "Item.blade", name: "Separate sword", type: "weapon", system: weapon() }];
  a.items.get = id => a.items.find(i => i.id === id);
  a.flags = {};
  Object.defineProperty(a, "participatingCombat", { value: null });
  a.weaponAttack = (item, opts) => weaponAttack(a.system, item.system, cfg, "agent", opts);
  return a;
}
test("actual Disarm controller rejects qualified source gain/loss and held axe identity/grip drift even when the attacking weapon is unchanged", async () => {
  for (const change of ["gain", "loss", "identity", "grip"]) {
    const a = actor();
    if (change === "gain") a.system.activeFeatNames = [];
    a.rollAttack = async (_i, opts) => {
      await opts.validateAttackContext();
      if (change === "gain") a.system.activeFeatNames = ["Axe Basics"];
      if (change === "loss") a.system.activeFeatNames = [];
      if (change === "identity") a.system.readiedMeleeWeapons[0].id = "different";
      if (change === "grip") a.system.readiedMeleeWeapons[0].hands = 2;
      await opts.validateAttackContext();
    };
    await assert.rejects(rollDisarm(a, { weaponId: "blade", ...context }), /changed/);
  }
});
let hook = async () => {},
  posts = 0,
  rolls = 0;
globalThis.ChatMessage = { getSpeaker: () => ({}) };
globalThis.Roll = class {
  constructor(_f, data) {
    this.total = 12 + (data.total ?? 0);
    this.dice = [{ total: 12 }];
  }
  async evaluate() {
    rolls++;
    await hook();
    return this;
  }
  async toMessage(d) {
    posts++;
    return d;
  }
};
test("actual pre/post RNG and replacement checks enforce source proof even without a retained controller closure", async () => {
  for (const change of ["gain", "loss", "identity"]) {
    const a = actor();
    if (change === "gain") a.system.activeFeatNames = [];
    const d = attack(a.system).disarm;
    posts = 0;
    hook = async () => {
      if (change === "gain") a.system.activeFeatNames = ["Axe Basics"];
      if (change === "loss") a.system.activeFeatNames = [];
      if (change === "identity") a.system.readiedMeleeWeapons[0].id = "different";
    };
    await assert.rejects(
      a.rollCheck("1d20", {}, { checkKind: "attack", weaponProficiency: "edged", attackContext: { disarm: d } }),
      /changed/
    );
    assert.equal(posts, 0);
  }
  hook = async () => {};
  const a = actor(),
    d = attack().disarm;
  a.system.activeFeatNames = [];
  rolls = 0;
  await assert.rejects(
    a.rollCheck("1d20", {}, { checkKind: "attack", weaponProficiency: "edged", attackContext: { disarm: d } }),
    /changed/
  );
  assert.equal(rolls, 0);
});
