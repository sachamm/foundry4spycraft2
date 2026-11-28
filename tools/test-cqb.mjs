import test from "node:test";
import assert from "node:assert/strict";
import { cqbRangePlan as plan, cqbRangedWeapon } from "../module/rules/cqb.mjs";
import { weaponAttack, weaponDamage } from "../module/rules/gear.mjs";
import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
import { standardAttackContextInput } from "../module/apps/standard-attack-context.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import "./fixtures/fatigue-actor.mjs"; // sets up the Foundry stand-ins this file relies on

const { SpycraftActor } = await import("../module/documents/actor.mjs");
const sys = () => ({
    activeFeatNames: ["CQB Basics", "CQB Mastery"],
    cqbRange: 30,
    bab: 6,
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 14, mod: 2 }])),
    conditionContext: {},
    proficiencyTotals: Object.fromEntries(Object.keys(cfg.proficiencies).map(k => [k, { proficient: true }])),
    classLevels: {},
    classOptionSelections: [],
    unarmed: { die: 3, damageBonus: 2 }
  }),
  weapon = (proficiency = "handgun") => ({
    proficiency,
    weaponCategory: "servicePistol",
    sizeHands: "D/1h",
    range: 50,
    fireModes: ["single"],
    fireMode: "single",
    recoil: 0,
    errorThreat: "1/20",
    damage: "1d6"
  });
test("CQB range includes its exact boundary, respects actual prepared extended range and never guesses unknown distance or opponent-only Mastery", () => {
  for (const range of [30, 60])
    for (const distanceFeet of [0, range, range + 0.001]) {
      const p = plan({ ...sys(), cqbRange: range }, weapon(), { distanceFeet, targetOpponentConfirmed: true }),
        within = distanceFeet <= range;
      assert.equal(p.attackBonus, within ? 1 : 0);
      assert.equal(p.damageBonus, within ? 1 : 0);
      assert.equal(p.threatIncrease, within ? 1 : 0);
    }
  for (const distanceFeet of [undefined, null, "", "  "]) {
    const p = plan(sys(), weapon(), { distanceFeet, targetOpponentConfirmed: true });
    assert.equal(p.known, false);
    assert.equal(p.attackBonus, 0);
    assert.equal(p.threatIncrease, 0);
  }
  assert.equal(plan(sys(), weapon(), { distanceFeet: 10, targetOpponentConfirmed: false }).threatIncrease, 0);
  assert.equal(standardAttackContextInput({ targetOpponentConfirmed: true }).targetOpponentConfirmed, true);
  for (const distanceFeet of [-1, true, Infinity, "oops"]) assert.throws(() => plan(sys(), weapon(), { distanceFeet }));
});
test("every ranged proficiency gains exactly one attack/damage bonus and one opponent threat increase, while melee/unarmed and explosive placement checks remain unchanged", () => {
  for (const key of Object.keys(cfg.proficiencies)) {
    const w = weapon(key),
      s = sys(),
      base = { ...s, activeFeatNames: [] },
      o = { distanceFeet: 10, targetOpponentConfirmed: true, attackAction: "standard" },
      a = weaponAttack(s, w, cfg, "agent", o),
      b = weaponAttack(base, w, cfg, "agent", o),
      d = weaponDamage(s, w, o),
      e = weaponDamage(base, w, o),
      ranged = cqbRangedWeapon(w);
    assert.equal(a.total - b.total, ranged ? 1 : 0, key);
    assert.equal(d.bonus - e.bonus, ranged ? 1 : 0, key);
    assert.equal(b.threat - a.threat, ranged ? 1 : 0, key);
    assert.equal(a.error, b.error, key);
  }
});
test("CQB bonuses combine once with actual forte and unrelated animal/flanking threat effects; source removal immediately removes only its range benefits", () => {
  const s = sys();
  s.proficiencyTotals.handgun.forte = true;
  s.classOptionSelections = [{ classId: "scout", name: "Game Hunter" }];
  const o = { distanceFeet: 10, targetOpponentConfirmed: true, targetAnimal: true, attackAction: "standard" },
    a = weaponAttack(s, weapon(), cfg, "agent", o),
    b = weaponAttack({ ...s, activeFeatNames: [] }, weapon(), cfg, "agent", o);
  assert.equal(a.total, b.total + 1);
  assert.equal(a.threat, b.threat - 1);
  assert.equal(a.threat, 16);
  assert.equal(a.error, b.error);
  assert.equal(weaponAttack(s, weapon(), cfg, "agent", { ...o, distanceFeet: 31 }).total, b.total);
});
let response = null,
  dialogs = 0;
foundry.utils.escapeHTML = String;
foundry.applications.api.DialogV2.input = async () => {
  dialogs++;
  return response;
};
game.user = { isGM: true, targets: new Set() };
game.actors = [];
function actor() {
  dialogs = 0;
  response = null;
  const a = {
    uuid: "Actor.cqb",
    type: "agent",
    isOwner: true,
    system: sys(),
    items: [{ id: "gun", uuid: "Actor.cqb.Item.gun", name: "Handgun", type: "weapon", system: weapon() }],
    weaponContext: (w, o) => o,
    getRollData: () => ({})
  };
  a.items.get = id => a.items.find(i => i.id === id);
  a.weaponAttack = (w, o) => weaponAttack(a.system, w.system, cfg, "agent", o);
  a.rollCheck = async (formula, data, options) => {
    await options.validateCQBRange?.();
    await a.hook?.();
    await options.validateCQBRange?.();
    return { formula, data, options };
  };
  a.rollAttack = (w, o) => SpycraftActor.prototype.rollAttack.call(a, w, o);
  a.rollDamage = (w, o) => SpycraftActor.prototype.rollDamage.call(a, w, o);
  return a;
}
test("the real attack forwards its exact CQB context, only confirmed opponents gain Mastery threat, and valid parsed range stays independent of target Defense", async () => {
  const a = actor(),
    m = await a.rollAttack(a.items[0], {
      attackAction: "standard",
      distanceFeet: 30,
      targetOpponentConfirmed: true,
      targetAnimal: false
    });
  assert.equal(m.data.total, 9);
  assert.equal(m.options.threat, 19);
  assert.equal(m.options.attackContext.cqbRange.attackBonus, 1);
  assert.equal(m.options.attackContext.cqbRange.threatIncrease, 1);
  const object = await a.rollAttack(a.items[0], {
    attackAction: "standard",
    distanceFeet: 30,
    targetOpponentConfirmed: false,
    targetAnimal: false
  });
  assert.equal(object.data.total, 9);
  assert.equal(object.options.threat, 20);
});
test("damage asks for missing CQB distance, applies one bonus inside range and none outside, and never posts on cancellation or invalid input", async () => {
  let a = actor();
  assert.equal(await a.rollDamage(a.items[0], { includeSneakAttack: false }), null);
  assert.equal(dialogs, 1);
  a = actor();
  response = { distanceFeet: "30" };
  const m = await a.rollDamage(a.items[0], { includeSneakAttack: false });
  assert.equal(m.options.cqbRange.damageBonus, 1);
  assert.equal(m.options.cqbRange.kind, "damage");
  assert.equal(m.options.cqbRange.notes.join(" ").includes("threat"), false);
  assert.equal(m.options.cqbRange.distanceFeet, 30);
  assert.match(m.formula, /\(1\)/);
  const outside = await a.rollDamage(a.items[0], { includeSneakAttack: false, distanceFeet: 31 });
  assert.equal(outside.options.cqbRange.damageBonus, 0);
  assert.equal(dialogs, 1);
  for (const distanceFeet of ["", false, -1, Infinity]) {
    a = actor();
    response = { distanceFeet };
    // Refused on screen, with nothing posted.
    assert.equal(await a.rollDamage(a.items[0], { includeSneakAttack: false }), false);
  }
});
test("source, weapon and prepared CQB-range changes during RNG reject stale attack and damage benefits before posting", async () => {
  for (const kind of ["attack", "damage"])
    for (const change of [
      a => (a.system.activeFeatNames = []),
      a => a.items.splice(0),
      a => (a.system.cqbRange = 60)
    ]) {
      const a = actor(),
        w = a.items[0];
      a.hook = () => change(a);
      await assert.rejects(
        kind === "attack"
          ? a.rollAttack(w, {
              attackAction: "standard",
              distanceFeet: 10,
              targetOpponentConfirmed: true,
              targetAnimal: false
            })
          : a.rollDamage(w, { includeSneakAttack: false, distanceFeet: 10 }),
        /CQB/
      );
    }
});
test("attack and damage evidence freeze the range, source and opponent eligibility without accepting edited optional contexts through legacy evidence", async () => {
  const a = actor(),
    attack = await a.rollAttack(a.items[0], {
      attackAction: "standard",
      distanceFeet: 10,
      targetOpponentConfirmed: true,
      targetAnimal: false
    }),
    damage = await a.rollDamage(a.items[0], { includeSneakAttack: false, distanceFeet: 10 });
  for (const c of [attack.options, damage.options]) {
    const e = rollEvidence(c),
      p = c.cqbRange ?? c.attackContext.cqbRange;
    p.range = 60;
    assert.equal(rollEvidenceMatches(e, c), false);
  }
});

test("the actual ordinary Gear attack context collects CQB range/opponent inputs before rolling and cancels or rejects missing distance cleanly", async () => {
  let a = actor();
  assert.equal(await a.rollAttack(a.items[0], { askContext: true }), null);
  a = actor();
  response = { distanceFeet: "30", targetOpponentConfirmed: true, targetAnimal: false };
  const m = await a.rollAttack(a.items[0], { askContext: true });
  assert.equal(m.data.total, 9);
  assert.equal(m.options.threat, 19);
  assert.equal(m.options.attackContext.cqbRange.distanceFeet, 30);
  a = actor();
  response = { distanceFeet: "", targetOpponentConfirmed: true };
  await assert.rejects(a.rollAttack(a.items[0], { askContext: true }), /actual finite/);
});

test("class/API attack entries automatically collect missing range or opponent facts while fully specified and outside-range checks avoid an unnecessary dialog", async () => {
  let a = actor();
  response = { distanceFeet: "30", targetOpponentConfirmed: true, targetAnimal: false };
  const m = await a.rollAttack(a.items[0], {});
  assert.equal(dialogs, 1);
  assert.equal(m.data.total, 9);
  assert.equal(m.options.threat, 19);
  a = actor();
  response = { distanceFeet: "30", targetOpponentConfirmed: true, targetAnimal: false };
  const known = await a.rollAttack(a.items[0], { distanceFeet: 30 });
  assert.equal(dialogs, 1);
  assert.equal(known.options.threat, 19);
  a = actor();
  await a.rollAttack(a.items[0], { distanceFeet: 31, targetAnimal: false });
  assert.equal(dialogs, 0);
});
test("cancelling an automatically requested attack context restores all actually reserved class counters instead of treating null as a completed use", async () => {
  const a = actor();
  a.flags = {};
  a.system.resourceUses = { unrelated: { epoch: "keep", used: 3 } };
  a.system.limitedUses = [
    { id: "first", name: "First", period: "session", limit: 2, cost: 0, workflow: "test" },
    { id: "second", name: "Second", period: "session", limit: 1, cost: 0, workflow: "test" }
  ];
  a.usagePeriods = { session: "s" };
  a.actionDiceFundingSystem = a.system;
  a.useLimitedAbility = SpycraftActor.prototype.useLimitedAbility;
  a.update = async patch => {
    for (const [path, value] of Object.entries(patch)) {
      const keys = path.split(".");
      let o = a;
      for (const k of keys.slice(0, -1)) o = o[k] ??= {};
      const k = keys.at(-1);
      if (k.startsWith("-=")) delete o[k.slice(2)];
      else o[k] = structuredClone(value);
    }
  };
  const result = await a.useLimitedAbility("first", () => a.rollAttack(a.items[0], {}), {
    workflow: "test",
    additionalUses: [{ id: "second", workflow: "test" }]
  });
  assert.equal(result, null);
  assert.equal(dialogs, 1);
  assert.deepEqual(a.system.resourceUses, { unrelated: { epoch: "keep", used: 3 } });
  response = { distanceFeet: "30", targetOpponentConfirmed: true, targetAnimal: false };
  const m = await a.useLimitedAbility("first", () => a.rollAttack(a.items[0], {}), {
    workflow: "test",
    additionalUses: [{ id: "second", workflow: "test" }]
  });
  assert.equal(m.options.threat, 19);
  assert.equal(a.system.resourceUses.first.used, 1);
  assert.equal(a.system.resourceUses.second.used, 1);
});
test("Shift-click damage skips the optional benefits dialog and adds no optional extras", async () => {
  let a = actor();
  a.system.activeFeatNames.push("Horde Supremacy");
  assert.equal(await a.rollDamage(a.items[0], { distanceFeet: 10 }), null, "a plain click asks");
  assert.equal(dialogs, 1);
  a = actor();
  a.system.activeFeatNames.push("Horde Supremacy");
  const m = await a.rollDamage(a.items[0], { quick: true, distanceFeet: 10 });
  assert.equal(dialogs, 0);
  assert.ok(m);
});
