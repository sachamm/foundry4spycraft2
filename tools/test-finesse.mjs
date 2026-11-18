import test from "node:test";
import assert from "node:assert/strict";
import { finesseThreatIncrease, finesseCriticalEligible } from "../module/rules/finesse.mjs";
import { weaponAttack, weaponDamage } from "../module/rules/gear.mjs";
import { criticalPlan } from "../module/rules/criticals.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
import "./fixtures/fatigue-actor.mjs"; // sets up the Foundry stand-ins this file relies on

const { SpycraftActor } = await import("../module/documents/actor.mjs");
foundry.utils.escapeHTML = String;
game.user = { isGM: true, targets: new Set() };
const melee = new Set(["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged"]);
const system = (activeFeatNames = []) => ({
  activeFeatNames,
  bab: 12,
  abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 14, mod: 2 }])),
  proficiencyTotals: Object.fromEntries(Object.keys(cfg.proficiencies).map(k => [k, { proficient: true }])),
  unarmed: { die: 3, damageBonus: 2 },
  conditionContext: {},
  classLevels: {},
  classOptionSelections: []
});
const weapon = proficiency => ({
  proficiency,
  sizeHands: "S/1h",
  damage: "1d6",
  errorThreat: "1/20",
  fireModes: ["single"],
  fireMode: "single",
  recoil: 0,
  range: 50
});
const options = {
  baseCost: 1,
  effect: "Damage applies to wounds",
  effectConfirmed: true,
  beforeDamage: true,
  available: 4
};
test("Mastery and Supremacy add one melee threat increment each across every proficiency, never adding attack/damage/error bonuses", () => {
  for (const names of [
    [],
    ["Finesse Basics"],
    ["Finesse Mastery"],
    ["Finesse Supremacy"],
    ["Finesse Mastery", "Finesse Supremacy"]
  ])
    for (const key of Object.keys(cfg.proficiencies)) {
      const s = system(names),
        base = system(),
        w = weapon(key),
        count = melee.has(key)
          ? Number(names.includes("Finesse Mastery")) + Number(names.includes("Finesse Supremacy"))
          : 0,
        a = weaponAttack(s, w, cfg),
        b = weaponAttack(base, w, cfg);
      assert.equal(finesseThreatIncrease(s, w), count, key);
      assert.equal(a.threat, b.threat - count, key);
      assert.equal(a.total, b.total, key);
      assert.equal(a.error, b.error, key);
      assert.equal(weaponDamage(s, w).bonus, weaponDamage(base, w).bonus, key);
    }
});
test("threat increases combine once with existing melee threat sources, preserve no-threat attacks and stop at natural one", () => {
  const s = system(["Finesse Mastery", "Finesse Supremacy"]);
  s.classOptionSelections = [{ classId: "scout", name: "Game Hunter" }];
  const w = weapon("edged"),
    a = weaponAttack(s, w, cfg, "agent", { targetAnimal: true });
  assert.equal(a.threat, 15);
  assert.equal(a.finesseThreatIncrease, 2);
  assert.match(a.notes, /Finesse feats/);
  assert.equal(weaponAttack(s, { ...w, errorThreat: "1/—", threat: 0 }, cfg).threat, 0);
  assert.equal(weaponAttack(s, { ...w, errorThreat: "1/2" }, cfg).threat, 1);
  assert.equal(weaponAttack({ ...s, activeFeatNames: [] }, w, cfg, "agent", { targetAnimal: true }).threat, 17);
});
test("Supremacy discounts confirmed melee critical hits by one with minimum zero, including unarmed but excluding all ranged and hurled attacks", () => {
  const s = system(["Finesse Supremacy"]);
  for (const key of Object.keys(cfg.proficiencies)) {
    const check = { checkKind: "attack", weaponProficiency: key, threatConfirmed: true },
      plan = criticalPlan(s, check, options);
    assert.equal(plan.cost, melee.has(key) ? 0 : 1, key);
    assert.equal(plan.sources.includes("Finesse Supremacy –1"), melee.has(key), key);
  }
  for (const baseCost of [1, 2, 3, 4])
    assert.equal(
      criticalPlan(
        s,
        { checkKind: "attack", weaponProficiency: "edged", threatConfirmed: true },
        { ...options, baseCost, available: baseCost - 1 }
      ).cost,
      baseCost - 1
    );
});
test("recorded attack classification governs scope; unknown legacy attacks never invent melee and a recorded ranged attack overrides a melee proficiency label", () => {
  assert.equal(
    finesseCriticalEligible({ checkKind: "attack", weaponProficiency: "edged", attackContext: { ranged: true } }),
    false
  );
  assert.equal(
    finesseCriticalEligible({ checkKind: "attack", weaponProficiency: "rifle", attackContext: { ranged: false } }),
    true
  );
  for (const check of [
    { checkKind: "attack" },
    { checkKind: "skill", weaponProficiency: "edged" },
    { checkKind: "save", attackContext: { ranged: false } }
  ])
    assert.equal(finesseCriticalEligible(check), false);
  const s = system(["Finesse Supremacy"]);
  assert.equal(criticalPlan(s, { checkKind: "attack", threatConfirmed: true }, options).cost, 1);
});
test("discount stacks with applicable critical sources, does not affect errors or saves, and still requires a successful threat before damage", () => {
  const s = {
      ...system(["Finesse Supremacy", "Expert Disarm"]),
      weaponSpecialist: { proficiencies: ["edged"], abilities: ["Most Deadly"] }
    },
    check = {
      checkKind: "attack",
      weaponProficiency: "edged",
      threatConfirmed: true,
      attackContext: { ranged: false, disarm: { active: true } }
    };
  const p = criticalPlan(s, check, { ...options, baseCost: 3, available: 0 });
  assert.equal(p.cost, 0);
  assert.equal(p.sources.length, 3);
  assert.equal(criticalPlan(s, check, { ...options, available: 0 }).cost, 0);
  for (const patch of [{ threatConfirmed: false }, { resolved: true }, { superseded: true }])
    assert.equal(criticalPlan(s, { ...check, ...patch }, options).blocked, true);
  assert.equal(criticalPlan(s, check, { ...options, beforeDamage: false }).blocked, true);
  assert.equal(
    criticalPlan(
      s,
      { checkKind: "attack", weaponProficiency: "edged", errorConfirmed: true },
      { ...options, kind: "failure", samePayer: false, opponent: true, lineOfSight: true }
    ).cost,
    1
  );
  assert.equal(criticalPlan(s, { checkKind: "save", checkId: "fort", threatConfirmed: true }, options).blocked, true);
});
function actor() {
  const a = {
    uuid: "Actor.finesse",
    type: "agent",
    isOwner: true,
    system: system(["Finesse Basics", "Finesse Mastery", "Finesse Supremacy"]),
    items: [{ id: "blade", uuid: "Actor.finesse.Item.blade", type: "weapon", name: "Blade", system: weapon("edged") }],
    weaponContext: (_w, o) => o,
    getRollData: () => ({})
  };
  a.items.get = id => a.items.find(i => i.id === id);
  a.weaponAttack = (w, o) => weaponAttack(a.system, w.system, cfg, "agent", o);
  a.rollCheck = async (formula, data, options) => {
    await options.validateAttackContext?.();
    await a.hook?.();
    await options.validateAttackContext?.();
    return { formula, data, options };
  };
  a.rollAttack = (w, o) => SpycraftActor.prototype.rollAttack.call(a, w, o);
  return a;
}
test("actual Actor attack records the melee threat source and rejects changed feat/classification/weapon during RNG without losing existing validators", async () => {
  const a = actor();
  let calls = 0;
  const result = await a.rollAttack(a.items[0], { targetAnimal: false, validateAttackContext: () => calls++ });
  assert.equal(result.options.threat, 18);
  assert.equal(result.options.attackContext.finesseThreatIncrease, 2);
  assert.equal(result.options.attackContext.ranged, false);
  assert.equal(calls, 2);
  for (const change of [
    a => (a.system.activeFeatNames = ["Finesse Basics"]),
    a => (a.items[0].system.proficiency = "hurled"),
    a => a.items.splice(0)
  ]) {
    const b = actor();
    b.hook = () => change(b);
    await assert.rejects(b.rollAttack(b.items[0], { targetAnimal: false }), /Finesse threat source|no longer exists/);
  }
});
test("outcome evidence freezes both melee scope and the exact threat increment", async () => {
  const a = actor(),
    r = await a.rollAttack(a.items[0], { targetAnimal: false }),
    e = rollEvidence(r.options);
  r.options.attackContext.finesseThreatIncrease = 1;
  assert.equal(rollEvidenceMatches(e, r.options), false);
  r.options.attackContext.finesseThreatIncrease = 2;
  r.options.attackContext.ranged = true;
  assert.equal(rollEvidenceMatches(e, r.options), false);
});

test("Basics optionally grants FIN only to one-handed melee weapons and preserves original data and intrinsic qualities", async () => {
  const { finesseWeaponPlan } = await import("../module/rules/finesse.mjs");
  for (const key of Object.keys(cfg.proficiencies))
    for (const sizeHands of ["S/1h", "M/2h", ""]) {
      const s = system(["Finesse Basics"]),
        w = { ...weapon(key), sizeHands, qualities: "AP (1)", grantFinesse: true },
        before = structuredClone(w),
        p = finesseWeaponPlan(s, w),
        eligible = melee.has(key) && key !== "unarmed" && sizeHands === "S/1h";
      assert.equal(p.granted, eligible, key + "/" + sizeHands);
      assert.equal(/\bFIN\b/.test(weaponAttack(s, w, cfg).effectiveQualities), eligible);
      assert.deepEqual(w, before);
      assert.equal(finesseWeaponPlan({ ...s, activeFeatNames: [] }, w).granted, false);
      assert.equal(finesseWeaponPlan(s, { ...w, grantFinesse: false }).granted, false);
    }
  const s = system(["Finesse Basics"]);
  assert.equal(
    finesseWeaponPlan(s, { ...weapon("edged"), qualities: "FIN", grantFinesse: true }).effectiveQualities,
    "FIN"
  );
  assert.equal(finesseWeaponPlan(system(), { ...weapon("edged"), qualities: "FIN" }).intrinsic, true);
});
test("granting the quality and choosing Dexterity damage are independent; trained FIN damage replaces Strength and every two-hand bonus", () => {
  const s = system(["Finesse Basics"]);
  s.abilities.str = { value: 12, mod: 1 };
  s.abilities.dex = { value: 20, mod: 5 };
  const w = { ...weapon("edged"), qualities: "", grantFinesse: true },
    normal = weaponDamage(s, w);
  assert.equal(normal.bonus, 1);
  assert.equal(normal.finesseBasic.granted, true);
  assert.equal(normal.finesse, false);
  assert.equal(weaponDamage(s, { ...w, useFinesse: true }).bonus, 5);
  assert.equal(weaponDamage(s, { ...w, useFinesse: true, useHands: 2 }).bonus, 5);
  assert.equal(weaponDamage(s, { ...w, useHands: 2 }).bonus, 3);
  assert.equal(weaponDamage({ ...s, size: "Small" }, { ...w, useFinesse: true }).bonus, 5);
  assert.equal(weaponDamage({ ...s, proficiencyTotals: {} }, { ...w, useFinesse: true }).bonus, 1);
  assert.equal(weaponDamage({ ...s, activeFeatNames: [] }, { ...w, useFinesse: true }).bonus, 1);
  assert.equal(weaponAttack(s, { ...w, useFinesse: true }, cfg).total, weaponAttack(s, w, cfg).total);
});
test("Massive uses actual Strength14 versus15, preserves its attack penalty under Basics, and waives Initiative loss only for an intrinsically two-handed melee weapon", async () => {
  const { massiveWeaponPlan } = await import("../module/rules/finesse.mjs");
  for (let strength = 1; strength <= 30; strength++) {
    const s = system(["Finesse Basics"]);
    s.abilities.str = { value: strength, mod: Math.floor((strength - 10) / 2) };
    for (const key of ["blunt", "edged", "unarmed", "hurled", "rifle"])
      for (const sizeHands of ["S/1h", "M/2h"]) {
        const w = { ...weapon(key), qualities: "MAS", sizeHands },
          p = massiveWeaponPlan(s, w),
          waived = melee.has(key) && key !== "unarmed" && sizeHands === "M/2h";
        assert.equal(p.attackPenalty, strength <= 14 ? -4 : 0);
        assert.equal(p.waived, waived);
        assert.equal(p.listedInitiativeLoss, Math.max(0, 4 - s.abilities.str.mod));
        assert.equal(p.initiativeLoss, waived ? 0 : p.listedInitiativeLoss);
        const without = weaponAttack({ ...s, activeFeatNames: [] }, w, cfg),
          withFeat = weaponAttack(s, w, cfg);
        assert.equal(withFeat.total, without.total);
        assert.equal(without.initiativeLoss - withFeat.initiativeLoss, waived ? p.listedInitiativeLoss : 0);
      }
  }
  assert.throws(() => massiveWeaponPlan({ abilities: { str: { mod: 2 } } }, { qualities: "MAS" }), /actual Strength/);
});
test("Massive, untrained and grip Initiative losses remain separate; Basics never waives the other sources or a one-handed Massive weapon held in both hands", () => {
  const s = system(["Finesse Basics"]);
  s.abilities.str = { value: 14, mod: 2 };
  const w = { ...weapon("edged"), qualities: "MAS", sizeHands: "M/2h" },
    untrained = weaponAttack({ ...s, proficiencyTotals: {} }, w, cfg);
  assert.equal(untrained.massive.initiativeLoss, 0);
  assert.equal(untrained.initiativeLoss, 4);
  assert.deepEqual(untrained.initiativeLossComponents, { grip: 0, massive: 0, untrained: 4 });
  const held = weaponAttack(s, { ...w, sizeHands: "S/1h", useHands: 2 }, cfg);
  assert.equal(held.massive.waived, false);
  assert.equal(held.initiativeLoss, 4);
  assert.deepEqual(held.initiativeLossComponents, { grip: 2, massive: 2, untrained: 0 });
  const oneHand = weaponAttack(s, { ...w, useHands: 1 }, cfg);
  assert.equal(oneHand.massive.waived, true);
  assert.equal(oneHand.grip.attackPenalty, -4);
});
test("actual attack roots record effective FIN and Massive source evidence, and changed grant/Strength sources invalidate the rolled context", async () => {
  const a = actor();
  a.items[0].system = { ...weapon("edged"), qualities: "MAS", sizeHands: "M/2h" };
  const r = await a.rollAttack(a.items[0], { targetAnimal: false });
  assert.equal(r.options.attackContext.massive.waived, true);
  assert.equal(r.options.attackContext.massive.attackPenalty, -4);
  const e = rollEvidence(r.options);
  r.options.attackContext.massive.waived = false;
  assert.equal(rollEvidenceMatches(e, r.options), false);
  for (const change of [
    a => (a.system.activeFeatNames = ["Finesse Mastery", "Finesse Supremacy"]),
    a => (a.system.abilities.str.value = 15)
  ]) {
    const b = actor();
    b.items[0].system = { ...weapon("edged"), qualities: "MAS", sizeHands: "M/2h" };
    b.hook = () => change(b);
    await assert.rejects(b.rollAttack(b.items[0], { targetAnimal: false }), /source changed/);
  }
  const b = actor();
  b.items[0].system = { ...weapon("edged"), qualities: "", grantFinesse: true };
  const granted = await b.rollAttack(b.items[0], { targetAnimal: false });
  assert.equal(granted.options.weaponQualities, "FIN");
  assert.equal(granted.options.attackContext.finesseBasic.granted, true);
});
test("actual damage roots retain trained finesse evidence and reject changed quality choice, source or Dexterity during RNG", async () => {
  function damageActor() {
    const a = actor();
    a.system.abilities.dex = { value: 20, mod: 5 };
    a.items[0].system = { ...weapon("edged"), qualities: "", grantFinesse: true, useFinesse: true };
    a.rollDamage = (w, o) => SpycraftActor.prototype.rollDamage.call(a, w, o);
    return a;
  }
  const a = damageActor(),
    r = await a.rollDamage(a.items[0], { includeSneakAttack: false });
  assert.equal(r.options.finesseDamage.used, true);
  assert.equal(r.options.finesseDamage.bonus, 5);
  assert.equal(r.options.weaponQualities, "FIN");
  const e = rollEvidence(r.options);
  r.options.finesseDamage.used = false;
  assert.equal(rollEvidenceMatches(e, r.options), false);
  for (const change of [
    a => (a.items[0].system.grantFinesse = false),
    a => (a.system.activeFeatNames = []),
    a => (a.system.abilities.dex.mod = 4)
  ]) {
    const b = damageActor();
    b.hook = () => change(b);
    await assert.rejects(b.rollDamage(b.items[0], { includeSneakAttack: false }), /finesse damage source/);
  }
});
