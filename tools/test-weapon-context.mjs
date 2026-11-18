import test from "node:test";
import assert from "node:assert/strict";
import { weaponAttack, weaponDamage, weaponGrip } from "../module/rules/gear.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const system = () => ({
  size: "Medium",
  bab: 3,
  abilities: { str: { value: 14, mod: 2 }, dex: { value: 18, mod: 4 } },
  proficiencyTotals: { edged: { proficient: true }, blunt: { proficient: true } },
  activeFeatNames: [],
  classLevels: {}
});
const blade = { proficiency: "edged", damage: "1d6", errorThreat: "1/20", sizeHands: "S/1h", qualities: "FIN" };
test("RAW pp.347,349: Small characters must use both hands for a one-handed weapon and cannot use two-handed weapons", () => {
  const sys = { ...system(), size: "Small" };
  assert.equal(weaponGrip(sys, blade).hands, 2);
  assert.equal(weaponAttack(sys, blade, cfg).blocked, false);
  assert.equal(weaponAttack(sys, { ...blade, useHands: 1 }, cfg).blocked, true);
  assert.equal(weaponAttack(sys, { ...blade, sizeHands: "M/2h" }, cfg).blocked, true);
  assert.equal(weaponDamage(sys, { ...blade, sizeHands: "M/2h" }).blocked, true);
});
test("RAW p.347: two-handed weapons used in one hand suffer -4; both hands on a one-handed weapon increase damage Strength by four and cost Initiative", () => {
  const sys = system();
  const heavy = { ...blade, sizeHands: "M/2h", useHands: 1 };
  assert.equal(weaponAttack(sys, heavy, cfg).total, 1);
  const grip = weaponAttack(sys, { ...blade, useHands: 2 }, cfg);
  assert.equal(grip.initiativeLoss, 2);
  assert.equal(grip.strengthIncrease, 4);
  assert.equal(weaponDamage(sys, { ...blade, useHands: 2 }).bonus, 4);
  assert.equal(weaponDamage(sys, { ...blade, sizeHands: "M/2h" }).bonus, 2);
});
test("RAW p.301: finesse requires FIN and trained use; it replaces Strength and gains no two-hand damage benefit", () => {
  const sys = system();
  assert.equal(weaponDamage(sys, { ...blade, useHands: 2, useFinesse: true }).bonus, 4);
  sys.abilities.dex.mod = 5;
  assert.equal(weaponDamage(sys, { ...blade, useHands: 2, useFinesse: true }).bonus, 5);
  assert.equal(weaponDamage(sys, { ...blade, qualities: "", useFinesse: true }).bonus, 2);
  sys.proficiencyTotals = {};
  assert.equal(weaponDamage(sys, { ...blade, useFinesse: true }).bonus, 2);
  assert.equal(weaponDamage(sys, { ...blade, useFinesse: true }, {}, "npc").bonus, 5);
});
test("RAW pp.64,175,347: improvised penalties, error increase, Strength exclusion and Basics exception apply independently", () => {
  const sys = system(),
    weapon = { ...blade, qualities: "", improvised: true };
  assert.equal(weaponAttack(sys, weapon, cfg).total, 3);
  assert.equal(weaponAttack(sys, weapon, cfg).error, 2);
  assert.equal(weaponDamage(sys, weapon).bonus, -2);
  sys.activeFeatNames = ["Improvised Weapon Basics"];
  assert.equal(weaponAttack(sys, weapon, cfg).total, 5);
  assert.equal(weaponAttack(sys, weapon, cfg).error, 2);
  assert.equal(weaponDamage(sys, weapon).bonus, 0);
  sys.classLevels = { brawler: 1 };
  assert.equal(weaponDamage(sys, weapon).bonus, 1);
  sys.classLevels = {};
  sys.abilities.str.mod = -1;
  sys.activeFeatNames = [];
  assert.equal(weaponDamage(sys, weapon).bonus, -3);
  assert.equal(weaponAttack(sys, { ...weapon, destroyed: true }, cfg).blocked, true);
});
test("an unarmed non-Strength replacement retains its bonus when a knuckle weapon is improvised", () => {
  const sys = system();
  sys.unarmed = { die: 6, damageBonus: 4, strengthComponent: 0, usesStrength: false };
  sys.activeFeatNames = ["Improvised Weapon Basics"];
  assert.equal(
    weaponDamage(sys, {
      ...blade,
      proficiency: "blunt",
      qualities: "NKL",
      damage: "+1d4",
      improvised: true,
      useHands: 2
    }).bonus,
    4
  );
});

globalThis.Actor = class {
  constructor() {
    this.uuid = "Actor.test";
    this.isOwner = true;
    this.type = "agent";
    this.system = {
      ...system(),
      resourceUses: {},
      actionDice: { value: 1 },
      limitedUses: [
        {
          id: "perfect",
          name: "Perfect Skill Mastery",
          period: "session",
          limit: 3,
          cost: 0,
          workflow: "reroll",
          mastery: "Perfect Skill Mastery"
        }
      ]
    };
  }
  async update(data) {
    for (const [path, value] of Object.entries(data)) {
      const keys = path.replace(/^system\./, "").split(".");
      let target = this.system;
      for (const key of keys.slice(0, -1)) target = target[key] ??= {};
      const key = keys.at(-1);
      if (key.startsWith("-=")) delete target[key.slice(2)];
      else target[key] = value;
    }
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = { settings: { get: () => ({}) }, i18n: { localize: s => s, format: s => s } };
globalThis.foundry = { utils: { escapeHTML: s => s } };
globalThis.ChatMessage = { getSpeaker: () => ({}) };
globalThis.ui = { notifications: { warn: () => null } };
let natural = 1,
  index = 0;
const weaponContextMessages = new Map();
globalThis.Roll = class {
  constructor(formula, data) {
    this.dice = [{ total: natural }];
    this.total = natural + data.total;
  }
  async evaluate() {
    return this;
  }
  async toMessage(data) {
    const message = {
      uuid: "ChatMessage." + ++index,
      flags: data.flags,
      async update(patch) {
        for (const [key, value] of Object.entries(patch))
          if (key === "flags.spycraft2") this.flags.spycraft2 = value;
          else if (key.startsWith("flags.spycraft2."))
            this.flags.spycraft2[key.slice("flags.spycraft2.".length)] = value;
          else this[key] = value;
      },
      async delete() {
        this.deleted = true;
      }
    };
    weaponContextMessages.set(message.uuid, message);
    return message;
  }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");
test("an improvised error destroys its weapon; a legal reroll replacing that error reverses only destruction caused by that roll", async () => {
  const actor = new SpycraftActor();
  const item = {
    id: "weapon",
    type: "weapon",
    name: "Improvised blade",
    uuid: "Actor.test.Item.weapon",
    system: { ...blade, qualities: "", improvised: true },
    async update(patch) {
      for (const [key, value] of Object.entries(patch)) this.system[key.slice(7)] = value;
    }
  };
  globalThis.fromUuidSync = uuid => (uuid === item.uuid ? item : (weaponContextMessages.get(uuid) ?? null));
  actor.items = new Map([[item.id, item]]);
  const first = await actor.rollAttack(item);
  assert.equal(item.system.destroyed, undefined);
  await actor.confirmCheckOutcome(first, { succeeded: false });
  assert.equal(item.system.destroyed, true);
  assert.equal(item.system.destroyedByRoll, first.uuid);
  natural = 10;
  await actor.rerollCheck(first, { resource: "perfect", failed: true });
  assert.equal(item.system.destroyed, false);
  assert.equal(item.system.destroyedByRoll, "");
  assert.equal(first.flags.spycraft2.resolved, true);
});

test("RAW p.347: ordinary saves never generate threats or errors, including natural 1 and 20", async () => {
  const actor = new SpycraftActor();
  actor.system.saves = { fort: { total: 3 }, ref: { total: 4 }, will: { total: 5 } };
  for (const key of ["fort", "ref", "will"])
    for (const die of [1, 20]) {
      natural = die;
      const message = await actor.rollSave(key);
      assert.equal(message.flags.spycraft2.threat, 0);
      assert.equal(message.flags.spycraft2.error, 0);
      assert.equal(message.flags.spycraft2.checkKind, "save");
    }
});

test("Hulking Large characters retain Medium-or-larger one-hand options despite the one-square size annotation", () => {
  const sys = { ...system(), size: "Large (1×1)", sizeModifier: -1 };
  assert.equal(weaponAttack(sys, { ...blade, sizeHands: "M/2h", useHands: 1 }, cfg).blocked, false);
});

test("destroyed, reserved, depleted and ammunition-only items cannot attack or roll independent damage, including legacy arrow references", () => {
  const sys = {
    bab: 1,
    abilities: { str: { mod: 2 } },
    proficiencyTotals: { edged: { proficient: true } },
    size: "Medium"
  };
  const base = { name: "Sword", proficiency: "edged", damage: "1d6", sizeHands: "S/1h" };
  for (const patch of [
    { destroyed: true },
    { reserve: true },
    { quantity: 0 },
    { ammunitionOnly: true },
    { name: "Standard arrow" }
  ]) {
    assert.equal(weaponAttack(sys, { ...base, ...patch }, cfg).blocked, true);
    assert.equal(weaponDamage(sys, { ...base, ...patch }).blocked, true);
  }
});
test("RAW pp.304–305: Dart and Shuriken never apply a Strength modifier to damage", () => {
  for (const modifier of [-2, 3])
    for (const name of ["Dart", "Shuriken"]) {
      const sys = { abilities: { str: { mod: modifier } }, size: "Medium" },
        result = weaponDamage(sys, { name, proficiency: "hurled", damage: "1d3", sizeHands: "N/1h" });
      assert.equal(result.bonus, 0);
    }
});

test("RAW pp.274–275,319: bows use arrow damage and relative error modifiers; crossbows require bolts with the same statistics", () => {
  const sys = system();
  sys.proficiencyTotals.exoticHurled = { proficient: true };
  const bow = {
    name: "Longbow",
    proficiency: "exoticHurled",
    damage: "as arrow**",
    errorThreat: "1/19–20",
    sizeHands: "M/2h"
  };
  const arrow = {
    name: "Standard arrow",
    ammunitionOnly: true,
    ammunitionKind: "arrow",
    damage: "1d6+1",
    errorThreat: "—/—",
    quantity: 1
  };
  assert.equal(weaponAttack(sys, bow, cfg).blocked, true);
  assert.equal(weaponDamage(sys, bow).blocked, true);
  assert.equal(weaponAttack(sys, bow, cfg, "agent", { ammunition: arrow }).error, 1);
  assert.equal(weaponAttack(sys, bow, cfg, "agent", { ammunition: arrow }).threat, 19);
  const normal = weaponDamage(sys, bow, { ammunition: arrow });
  assert.equal(normal.damageText, "1d6+1");
  assert.equal(normal.bonus, 2);
  const explosive = {
    ...arrow,
    name: "Explosive arrow",
    damage: "2d8+1",
    errorThreat: "+2/—",
    explosiveAmmunition: true
  };
  assert.equal(weaponAttack(sys, bow, cfg, "agent", { ammunition: explosive }).error, 3);
  assert.equal(weaponDamage(sys, bow, { ammunition: explosive }).bonus, 0);
  const crossbow = { ...bow, name: "Crossbow", damage: "as bolt**" };
  assert.equal(weaponAttack(sys, crossbow, cfg, "agent", { ammunition: arrow }).blocked, true);
  assert.equal(
    weaponAttack(sys, crossbow, cfg, "agent", { ammunition: { ...arrow, ammunitionKind: "bolt" } }).blocked,
    false
  );
  for (const patch of [{ reserve: true }, { destroyed: true }, { quantity: 0 }])
    assert.equal(weaponAttack(sys, bow, cfg, "agent", { ammunition: { ...arrow, ...patch } }).blocked, true);
});
test("an untrained attack increases a zero base error range by two; Bleed does not remove Strength from a hurled weapon", () => {
  const sys = system();
  assert.equal(weaponAttack(sys, { ...blade, errorThreat: "—/20" }, cfg).error, 0);
  sys.proficiencyTotals = {};
  assert.equal(weaponAttack(sys, { ...blade, errorThreat: "—/20" }, cfg).error, 2);
  assert.equal(
    weaponDamage(sys, {
      name: "Throwing blade",
      proficiency: "hurled",
      damage: "1d6",
      qualities: "BLD",
      sizeHands: "S/1h"
    }).bonus,
    2
  );
});
test("document attack and damage controls resolve the actor’s linked projectile item and preserve the actual ammunition in chat", async () => {
  const actor = new SpycraftActor();
  actor.system.proficiencyTotals.exoticHurled = { proficient: true };
  const ammo = {
    id: "ammo",
    name: "Explosive arrow",
    system: {
      ammunitionOnly: true,
      ammunitionKind: "arrow",
      damage: "2d8+1",
      errorThreat: "+2/—",
      explosiveAmmunition: true,
      quantity: 1
    }
  };
  const bow = {
    id: "bow",
    type: "weapon",
    uuid: "Actor.test.Item.bow",
    name: "Longbow",
    system: {
      proficiency: "exoticHurled",
      damage: "as arrow**",
      errorThreat: "1/19–20",
      sizeHands: "M/2h",
      loadedAmmoId: "ammo"
    }
  };
  actor.items = new Map([
    ["ammo", ammo],
    ["bow", bow]
  ]);
  const attack = await actor.rollAttack(bow);
  assert.equal(attack.flags.spycraft2.error, 3);
  assert.match(attack.flags.spycraft2.baseFlavor, /Explosive arrow/);
  actor.getRollData = () => ({});
  let result;
  actor.rollCheck = async (formula, _data, options) => {
    result = { formula, ...options };
    return result;
  };
  await actor.rollDamage(bow);
  assert.match(result.formula, /2d8\+1/);
  assert.match(result.flavor, /2d8\+1/);
  assert.match(result.flavor, /Explosive arrow/);
  ammo.system.ammunitionKind = "bolt";
  assert.equal(await actor.rollDamage(bow), null);
});

test("the measured-attack document control applies exact range and blocks a roll beyond maximum distance", async () => {
  const actor = new SpycraftActor();
  actor.system.proficiencyTotals.rifle = { proficient: true };
  const item = {
    name: "QA rifle",
    uuid: "Actor.test.Item.rifle",
    system: {
      proficiency: "rifle",
      weaponCategory: "assaultRifle",
      range: 25,
      recoil: 13,
      fireMode: "single",
      damage: "4d4",
      errorThreat: "1/20",
      sizeHands: "S/2h"
    }
  };
  let count = 0;
  actor.rollCheck = async (_formula, data, options) => {
    count++;
    return { data, options };
  };
  const result = await actor.rollRangedAttack(item, { distanceFeet: 80 });
  assert.equal(result.data.total, 1);
  assert.match(result.options.flavor, /range penalty -6/);
  assert.equal(await actor.rollRangedAttack(item, { distanceFeet: 251 }), null);
  assert.equal(count, 1);
  assert.equal(await actor.rollRangedAttack(item, { distanceFeet: "" }), null);
  assert.equal(count, 1);
});

test("RAW p.182: Rock and Roll permits a rifle or machine gun in one hand at minus two, including its explicit Small-character exception", () => {
  for (const size of ["Medium", "Small"]) {
    const sys = { ...system(), size, activeFeatNames: ["Rock and Roll!"] },
      rifle = { proficiency: "rifle", sizeHands: "S/2h", useHands: 1, damage: "4d4" };
    assert.equal(weaponGrip(sys, rifle).blocked, false);
    assert.equal(weaponGrip(sys, rifle).attackPenalty, -2);
    assert.equal(weaponAttack(sys, { ...rifle, destroyed: true }, cfg).blocked, true);
    assert.equal(
      weaponGrip(sys, { ...rifle, proficiency: "tactical", weaponCategory: "grenadeLauncher" }).blocked,
      size === "Small"
    );
  }
});

test("Brace Reflex penalty applies only to Reflex and uses the active Marksmanship Basics exception", async () => {
  const actor = new SpycraftActor();
  actor.system.saves = { ref: { total: 4 }, fort: { total: 3 } };
  let message = await actor.rollSave("ref", { braced: true });
  assert.equal(message.flags.spycraft2.rollData.total, 0);
  actor.system.activeFeatNames = ["Marksmanship Basics"];
  message = await actor.rollSave("ref", { braced: true });
  assert.equal(message.flags.spycraft2.rollData.total, 3);
  message = await actor.rollSave("fort", { braced: true });
  assert.equal(message.flags.spycraft2.rollData.total, 3);
});

test("attack chat snapshots maintained personal-weapon error protection and never gives it to unclassified mission gear", async () => {
  const actor = new SpycraftActor();
  actor.system.activeFeatNames = ["Clean and Polished"];
  const item = {
    id: "personal",
    type: "weapon",
    name: "Personal blade",
    uuid: "Actor.test.Item.personal",
    system: { ...blade, possessionSource: "wealth", possessionApproved: true, cleanAndPolishedReady: true }
  };
  actor.items = new Map([[item.id, item]]);
  const personal = await actor.rollAttack(item);
  assert.equal(personal.flags.spycraft2.cleanAndPolished, true);
  assert.equal(personal.flags.spycraft2.gearUuid, item.uuid);
  item.system.possessionSource = "";
  const ordinary = await actor.rollAttack(item);
  assert.equal(ordinary.flags.spycraft2.cleanAndPolished, false);
});

test("mounted platform declarations are frozen on measured attacks without changing attack math; a basic attack may remain explicitly unrecorded for later declaration", async () => {
  const a = new SpycraftActor();
  a.system.proficiencyTotals.rifle = { proficient: true };
  const item = {
    name: "QA mounted rifle",
    uuid: "Actor.test.Item.rifle",
    system: {
      proficiency: "rifle",
      weaponCategory: "assaultRifle",
      range: 25,
      recoil: 13,
      fireMode: "single",
      damage: "4d4",
      errorThreat: "1/20",
      sizeHands: "S/2h"
    }
  };
  a.rollCheck = async (_formula, data, options) => ({ data, options });
  const mounted = await a.rollRangedAttack(item, { distanceFeet: 25, vehicleMounted: true }),
    unmounted = await a.rollRangedAttack(item, { distanceFeet: 25, vehicleMounted: false });
  assert.equal(mounted.options.attackContext.vehicleMounted, true);
  assert.equal(unmounted.options.attackContext.vehicleMounted, false);
  assert.equal(mounted.data.total, unmounted.data.total);
  const basic = await a.rollAttack(item);
  assert.equal(basic.options.attackContext.vehicleMounted, undefined);
});

test("Gunnery changes only a mounted weapon’s full-action or two-half-action firing operation and records its source time", async () => {
  const { vehicleWeaponOperationPlan } = await import("../module/rules/gear.mjs");
  const sys = { ...system(), classOptionSelections: [{ classId: "wheelman", name: "Gunnery" }] };
  for (const time of ["half", "full", "twoHalf"]) {
    const r = vehicleWeaponOperationPlan(sys, { vehicleMounted: true, weaponOperationTime: time });
    assert.equal(r.requiredTime, "1 half action");
    assert.equal(r.gunnery, time !== "half");
  }
  assert.equal(
    vehicleWeaponOperationPlan(
      { ...sys, classOptionSelections: [] },
      { vehicleMounted: true, weaponOperationTime: "full" }
    ).requiredTime,
    "1 full action"
  );
  assert.equal(vehicleWeaponOperationPlan(sys, { weaponOperationTime: "full" }).blocked, true);
  assert.equal(vehicleWeaponOperationPlan(sys, { vehicleMounted: true, weaponOperationTime: "free" }).blocked, true);
  assert.equal(vehicleWeaponOperationPlan(sys).requiredTime, null);
  const a = new SpycraftActor();
  a.system.classOptionSelections = sys.classOptionSelections;
  a.system.proficiencyTotals.rifle = { proficient: true };
  const item = {
    name: "Mounted rifle",
    uuid: "Actor.test.Item.rifle",
    system: {
      proficiency: "rifle",
      weaponCategory: "assaultRifle",
      range: 25,
      recoil: 13,
      damage: "4d4",
      errorThreat: "1/20",
      sizeHands: "S/2h"
    }
  };
  a.rollCheck = async (_f, data, options) => ({ data, options });
  const result = await a.rollAttack(item, { vehicleMounted: true, weaponOperationTime: "twoHalf" });
  assert.equal(result.options.attackContext.weaponOperation.requiredTime, "1 half action");
  assert.equal(result.options.attackContext.weaponOperation.baseTime, "2 half actions");
  assert.match(result.options.flavor, /Gunnery/);
  assert.equal(await a.rollAttack(item, { vehicleMounted: false, weaponOperationTime: "full" }), null);
});
