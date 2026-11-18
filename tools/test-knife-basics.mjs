import test from "node:test";
import assert from "node:assert/strict";
import { actor, controls, opts } from "./fixtures/side-stance.mjs";
import { prep } from "./fixtures/feint.mjs";
import { knifeBasicsPlan, circlingDefensePlan } from "../module/rules/knife-basics.mjs";
import { COMBAT_STANCES, combatStanceDeclaration, combatStanceState } from "../module/rules/combat-stance.mjs";
import { incomingDefensePlan } from "../module/rules/defense.mjs";
import { MELEE_ATTACK_TRICKS, validRecordedMeleeTrick } from "../module/rules/melee-tricks.mjs";
import { MELEE_SKILL_FAMILIES, meleeFamilyProficiency, readiedMeleeWeapons } from "../module/rules/readied-weapons.mjs";
import { sneakAttackSources, sneakAttackCapacity } from "../module/rules/sneak-attack.mjs";
import { meleeTrickContent, meleeTrickInput } from "../module/apps/standard-attack-context.mjs";
import { combatStanceContent } from "../module/apps/combat-stance.mjs";
import { validateTrickSneakSource } from "../module/apps/attack-damage-benefits.mjs";
import { weaponDamage } from "../module/rules/gear.mjs";
import { limitedUseAbilities } from "../module/rules/limited-uses.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const make = (feats = ["Knife Basics"]) => {
    const a = actor(),
      w = a.items[0];
    Object.assign(w.system, {
      proficiency: "edged",
      meleeFamily: "knife",
      sizeHands: "D/1h",
      useHands: 1,
      qualities: "",
      damage: "1d6"
    });
    a.system.combatStance = null;
    a.system.activeFeatNames.push(...feats);
    a.system = prep(a.system, a.items);
    return a;
  },
  input = () => ({
    ...opts(),
    meleeTrick: "betweenRibs",
    meleeTrickFullActionConfirmed: true,
    meleeTrickOnlyConfirmed: true
  }),
  attack = (a, extra = {}) => a.rollAttack(a.items[0], { ...input(), ...extra }),
  hit = async (extra = {}, feats) => {
    const a = make(feats),
      m = await attack(a, extra);
    Object.assign(m.flags.spycraft2, { resolved: true, successConfirmed: true });
    return { a, m };
  };
const sneakOptions = {
    includeSneakAttack: true,
    successfulStandardAttack: true,
    targetCharacter: true,
    targetVulnerable: true,
    targetVitalsConfirmed: true,
    targetActorUuid: "Actor.target"
  },
  damage = (a, m, extra = {}) =>
    a.rollDamage(a.items[0], { ...sneakOptions, attackDamageSourceUuid: m.uuid, ...extra });
const knife = (id, system = {}) => ({
  id,
  uuid: "Item." + id,
  name: "Knife " + id,
  type: "weapon",
  system: {
    proficiency: "edged",
    meleeFamily: "knife",
    sizeHands: "D/1h",
    equipped: false,
    carried: true,
    quantity: 1,
    damage: "1d6",
    ...system
  }
});
const circlingSystem = (key = "circling", feats = ["Knife Basics"]) => ({
  activeFeatNames: feats,
  combatStance: { version: 1, id: "s1", key },
  conditionContext: {},
  abilities: { dex: { mod: 0 } }
});
const defender = (dodge = 4, extra = {}) => ({
  defense: { total: 20 + dodge, dodgeBonuses: dodge, dodgeLost: 0, dexterity: 2 },
  abilities: {
    dex: { mod: 2, value: 14 },
    str: { mod: 0 },
    con: { mod: 0 },
    wis: { mod: 0 },
    int: { mod: 0 },
    cha: { mod: 0 }
  },
  conditionContext: {},
  classLevels: {},
  activeFeatNames: [],
  sizeModifier: 0,
  ...extra
});

test("knife is a GC-reviewed family limited to Edged and Hurled proficiencies and is offered on the weapon data model", async () => {
  assert.ok(MELEE_SKILL_FAMILIES.includes("knife"));
  for (const key of Object.keys(cfg.proficiencies))
    assert.equal(
      meleeFamilyProficiency("knife", key),
      ["edged", "exoticEdged", "hurled", "exoticHurled"].includes(key),
      key
    );
  const { readFile } = await import("node:fs/promises");
  assert.match(await readFile(new URL("../module/data/item.mjs", import.meta.url), "utf8"), /"flail",\s*"knife"[,\s]/);
  assert.match(
    await readFile(new URL("../module/sheets/item-sheet.mjs", import.meta.url), "utf8"),
    /knife:\s*(?:"Knife"|loc`Knife`)/
  );
});
test("every carried reviewed knife is considered readied; holding stays a separate fact and non-knives, dropped, destroyed or empty stacks are excluded", () => {
  const items = [
    knife("a"),
    knife("b", { equipped: true }),
    knife("c", { carried: false }),
    knife("d", { quantity: 0 }),
    knife("e", { destroyed: true }),
    knife("f", { meleeFamily: "axe" }),
    knife("g", { meleeFamily: "" }),
    knife("h", { proficiency: "hurled" }),
    knife("i", { proficiency: "blunt" }),
    { ...knife("j"), type: "gear" }
  ];
  const plan = knifeBasicsPlan({ activeFeatNames: ["Knife Basics"] }, items);
  assert.equal(plan.active, true);
  assert.equal(plan.freeDraw, true);
  assert.deepEqual(
    plan.knives.map(k => k.id),
    ["a", "b", "h"]
  );
  assert.deepEqual(
    plan.knives.map(k => k.held),
    [false, true, false]
  );
  assert.ok(plan.knives.every(k => k.consideredReadied));
  assert.match(plan.notes[0], /free action.*counts as readied.*does not spend Quick Draw/);
  const none = knifeBasicsPlan({ activeFeatNames: [] }, items);
  assert.equal(none.active, false);
  assert.equal(none.freeDraw, false);
  assert.deepEqual(none.knives, []);
  assert.deepEqual(none.notes, []);
});
test("considered-readied knives occupy no hand: physical readied-weapon lists still require an equipped held knife", () => {
  const system = { activeFeatNames: ["Knife Basics"], size: "Medium" },
    carried = [knife("a"), knife("b"), knife("c")];
  assert.deepEqual(readiedMeleeWeapons(system, carried), []);
  assert.equal(knifeBasicsPlan(system, carried).knives.length, 3);
  const held = readiedMeleeWeapons(system, [knife("a", { equipped: true }), knife("b")]);
  assert.deepEqual(
    held.map(w => [w.id, w.family, w.hands]),
    [["a", "knife", 1]]
  );
});
test("the real engine exposes the plan and Quick Draw keeps its own two uses per round", async () => {
  const { computeAgent } = await import("../module/rules/engine.mjs"),
    { readFile } = await import("node:fs/promises"),
    definitions = JSON.parse(await readFile(new URL("../src/data/classes.json", import.meta.url), "utf8"));
  const soldier = {
      id: "soldier",
      name: "soldier",
      type: "class",
      system: { ...definitions.find(c => c.key === "soldier"), identifier: "soldier", vitalityDie: 12 }
    },
    feat = name => ({
      id: name,
      name,
      type: "feat",
      system: { tree: "meleeCombat", acquiredAtLevel: 1, granted: true, prerequisites: null }
    }),
    build = items =>
      computeAgent(
        {
          abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
          progression: [{ classId: "soldier", vitality: 12, skills: {} }],
          misc: {}
        },
        [soldier, ...items],
        cfg
      );
  const s = build([
    feat("Knife Basics"),
    feat("Quick Draw"),
    knife("a"),
    knife("b", { equipped: true }),
    knife("c", { meleeFamily: "" })
  ]);
  assert.ok(s.activeFeatNames.includes("Knife Basics"));
  assert.equal(s.knifeBasics.active, true);
  assert.deepEqual(
    s.knifeBasics.knives.map(k => [k.id, k.held]),
    [
      ["a", false],
      ["b", true]
    ]
  );
  assert.deepEqual(
    s.readiedMeleeWeapons.filter(w => w.family === "knife").map(w => w.id),
    ["b"]
  );
  assert.equal(s.limitedUses.find(x => x.id === "quickDraw").limit, 2);
  const none = build([knife("a")]);
  assert.equal(none.knifeBasics.active, false);
  assert.deepEqual(none.knifeBasics.knives, []);
  assert.equal(
    limitedUseAbilities(none, [], cfg).some(x => x.id === "quickDraw"),
    false
  );
});
test("Circling Stance uses the shared half-action stance lifecycle, has no movement cap and requires the earned feat", () => {
  assert.deepEqual(COMBAT_STANCES.circling, { name: "Circling Stance", feat: "Knife Basics", page: 179 });
  const base = { activeFeatNames: ["Knife Basics"], conditionContext: {}, abilities: {} };
  assert.deepEqual(combatStanceDeclaration(base, "circling", { halfActionConfirmed: true, legalConfirmed: true }), {
    version: 1,
    key: "circling"
  });
  assert.throws(() => combatStanceDeclaration(base, "circling", { legalConfirmed: true }), /half action/);
  assert.throws(
    () =>
      combatStanceDeclaration({ ...base, activeFeatNames: [] }, "circling", {
        halfActionConfirmed: true,
        legalConfirmed: true
      }),
    /earned/
  );
  assert.equal(combatStanceState(circlingSystem()).name, "Circling Stance");
  assert.equal(combatStanceState(circlingSystem("circling", [])), null);
  const a = make();
  assert.match(combatStanceContent(a), /Circling Stance<\/option>/);
  assert.match(combatStanceContent(a), /keeps only half its dodge bonus to Defense \(rounded up\)/);
  assert.doesNotMatch(combatStanceContent(make([])), /Circling Stance<\/option>/);
});
test("Circling halves a positive dodge bonus rounding up, for every bonus from 0 to 12", () => {
  for (let dodge = 0; dodge <= 12; dodge++) {
    const p = circlingDefensePlan({
      attackerSystem: circlingSystem(),
      ranged: false,
      unoccupiedAdjacentConfirmed: true,
      dodgeBonus: dodge
    });
    assert.equal(p.retainedDodgeBonus, Math.ceil(dodge / 2), String(dodge));
    assert.equal(p.dodgeReduction, Math.floor(dodge / 2));
    assert.equal(p.active, dodge > 0);
  }
  assert.equal(
    circlingDefensePlan({ attackerSystem: circlingSystem(), unoccupiedAdjacentConfirmed: true, dodgeBonus: -2 })
      .dodgeReduction,
    0
  );
  assert.deepEqual(circlingDefensePlan({}), { active: false, dodgeReduction: 0 });
});
test("Circling needs the actual stance, a melee attack and the unoccupied adjacent square; malformed declarations reject", () => {
  const ok = { attackerSystem: circlingSystem(), ranged: false, unoccupiedAdjacentConfirmed: true, dodgeBonus: 4 };
  assert.equal(circlingDefensePlan(ok).dodgeReduction, 2);
  assert.equal(circlingDefensePlan({ ...ok, unoccupiedAdjacentConfirmed: false }).dodgeReduction, 0);
  assert.throws(() => circlingDefensePlan({ ...ok, ranged: true }), /melee/);
  for (const attackerSystem of [
    circlingSystem("side", ["Knife Basics", "Fencing Basics"]),
    circlingSystem("circling", []),
    { ...circlingSystem(), combatStance: null },
    { ...circlingSystem(), conditionContext: { prone: true } }
  ])
    assert.throws(() => circlingDefensePlan({ ...ok, attackerSystem }), /not in Circling Stance/);
  for (const patch of [{ unoccupiedAdjacentConfirmed: "true" }, { ranged: 1 }, { dodgeBonus: NaN }])
    assert.throws(() => circlingDefensePlan({ ...ok, ...patch }));
});
test("the incoming-attack Defense preview removes exactly the halved dodge, leaves other attackers unchanged and never double-counts lost dodge", () => {
  for (const dodge of [0, 1, 2, 3, 5, 8]) {
    const d = defender(dodge),
      plain = incomingDefensePlan(d, {}),
      circled = incomingDefensePlan(d, {
        circling: { attackerSystem: circlingSystem(), unoccupiedAdjacentConfirmed: true }
      });
    assert.equal(plain.total - circled.total, Math.floor(dodge / 2), String(dodge));
    assert.equal(plain.circling.dodgeReduction, 0);
    assert.equal(circled.circling.stance, true);
    assert.match(circled.notes.join(" "), /Circling Stance/);
    assert.equal(
      incomingDefensePlan(d, { circling: { attackerSystem: circlingSystem(), unoccupiedAdjacentConfirmed: false } })
        .total,
      plain.total
    );
  }
  const d = defender(4),
    flat = incomingDefensePlan(d, { flatFooted: true }),
    flatCircled = incomingDefensePlan(d, {
      flatFooted: true,
      circling: { attackerSystem: circlingSystem(), unoccupiedAdjacentConfirmed: true }
    });
  assert.equal(flat.vulnerable, true);
  assert.equal(flatCircled.total, flat.total);
  assert.equal(flatCircled.circling.dodgeReduction, 0);
  assert.throws(
    () =>
      incomingDefensePlan(d, {
        ranged: true,
        circling: { attackerSystem: circlingSystem(), unoccupiedAdjacentConfirmed: true }
      }),
    /melee/
  );
});
test("adjacent Eye of the Storm dodge is part of the halved dodge bonus", () => {
  const d = defender(2, { classLevels: { triggerman: 4 } }),
    plain = incomingDefensePlan(d, { adjacent: true }),
    circled = incomingDefensePlan(d, {
      adjacent: true,
      circling: { attackerSystem: circlingSystem(), unoccupiedAdjacentConfirmed: true }
    });
  assert.equal(plain.eyeOfStorm, 3);
  assert.equal(circled.circling.originalDodgeBonus, 5);
  assert.equal(circled.circling.retainedDodgeBonus, 3);
  assert.equal(plain.total - circled.total, 2);
});
test("a melee attack made in Circling Stance carries its target-Defense and automatic-move reminder; ranged attacks and other stances do not", () => {
  const a = make();
  a.system.combatStance = { version: 1, id: "c1", key: "circling" };
  assert.match(
    a.weaponAttack(a.items[0], opts()).notes,
    /Circling Stance:.*halved \(rounded up\).*automatically move into an unoccupied adjacent square/
  );
  a.system.combatStance = null;
  assert.doesNotMatch(a.weaponAttack(a.items[0], opts()).notes, /Circling Stance/);
});
test("Between the Ribs is a full-action knife trick with no attack, damage or threat change and one sneak die", () => {
  const d = MELEE_ATTACK_TRICKS.betweenRibs;
  assert.deepEqual(
    { ...d },
    {
      source: "Between the Ribs",
      feat: "Knife Basics",
      family: "knife",
      weaponLabel: "knife",
      attackBonus: 0,
      damageBonus: 0,
      threatIncrease: 0,
      sneakDice: 1
    }
  );
  assert.notEqual(d.fullAction, false);
  const a = make(),
    ui = meleeTrickContent(a);
  assert.match(ui, /Between the Ribs — knife, full action, hit inflicts 1 die of sneak attack damage/);
  assert.doesNotMatch(ui, />Chop!|>Hack!/);
  assert.equal(meleeTrickInput({ meleeTrick: "betweenRibs" }).meleeTrick, "betweenRibs");
  assert.equal(meleeTrickContent(make([])), "");
});
test("the actual attack is unchanged numerically and records the trick; its hit supplies exactly one sneak die inside the same damage roll", async () => {
  const a = make(),
    w = a.items[0],
    raw = structuredClone(w.system),
    normal = a.weaponAttack(w, opts()),
    base = weaponDamage(a.system, w.system),
    m = await attack(a),
    c = m.flags.spycraft2;
  assert.equal(c.rawTotal, 12 + normal.total);
  assert.equal(c.threat, normal.threat);
  assert.equal(c.error, normal.error);
  assert.equal(c.attackContext.meleeTrick.key, "betweenRibs");
  assert.equal(c.attackContext.meleeTrick.sneakDice, 1);
  assert.equal(c.attackContext.meleeTrick.fullActionConfirmed, true);
  assert.ok(validRecordedMeleeTrick(c.attackContext.meleeTrick, c.attackContext));
  assert.match(c.baseFlavor ?? c.flavor ?? "", /Between the Ribs/);
  Object.assign(c, { resolved: true, successConfirmed: true });
  const d = await damage(a, m),
    dc = d.flags.spycraft2;
  assert.equal(dc.attackDamageBenefit.sneakDice, 1);
  assert.equal(dc.attackDamageBenefit.sneakSource, "Between the Ribs");
  assert.equal(dc.attackDamageBenefit.bonus, 0);
  assert.equal(dc.finesseDamage.bonus, base.bonus);
  assert.deepEqual(dc.sneakAttack.sources, [{ source: "Between the Ribs", dice: 1 }]);
  assert.equal(dc.sneakAttack.dice, 1);
  assert.match(dc.formula, /\+ 1d6$/);
  assert.deepEqual(w.system, raw);
  await assert.rejects(damage(a, m), /already has damage/);
});
test("the trick die combines once with other earned sneak dice and Deadly Precision", async () => {
  const { a, m } = await hit({}, ["Knife Basics", "Ambush Basics", "Deadly Precision"]),
    d = await damage(a, m),
    s = d.flags.spycraft2.sneakAttack;
  assert.deepEqual(s.sources.map(r => r.source).sort(), ["Ambush Basics", "Between the Ribs"]);
  assert.equal(s.dice, 2);
  assert.equal(s.bonus, 2);
  assert.match(d.flags.spycraft2.formula, /\+ 2d6 \+ 2$/);
});
test("general sneak attack conditions still gate the die; declining sneak damage rolls plain weapon damage", async () => {
  {
    const { a, m } = await hit();
    await assert.rejects(damage(a, m, { targetVulnerable: false }), /flanked, helpless or vulnerable/);
    await assert.rejects(damage(a, m, { targetCharacter: false }), /characters/);
    await assert.rejects(damage(a, m, { targetVitalsConfirmed: false }), /vitals/);
    assert.equal(a.system.attackDamageUses?.length ?? 0, 0);
  }
  {
    const { a, m } = await hit(),
      d = await damage(a, m, { includeSneakAttack: false });
    assert.equal(d.flags.spycraft2.sneakAttack, null);
    assert.equal(d.flags.spycraft2.attackDamageBenefit.sneakDice, 1);
    assert.doesNotMatch(d.flags.spycraft2.formula, /d6 \+ 1d6|\+ 1d6$/);
  }
});
test("ordinary knife damage, a miss, another weapon or raw caller options never obtain the trick die", async () => {
  {
    const a = make();
    await assert.rejects(
      a.rollDamage(a.items[0], { ...sneakOptions, trickSneak: { source: "Between the Ribs", dice: 1 } }),
      /no earned sneak attack dice/
    );
  }
  {
    const a = make(),
      m = await attack(a);
    Object.assign(m.flags.spycraft2, { resolved: true, successConfirmed: false });
    await assert.rejects(damage(a, m), /resolved successful/);
  }
  {
    const a = make(),
      m = await a.rollAttack(a.items[0], opts());
    Object.assign(m.flags.spycraft2, { resolved: true, successConfirmed: true });
    await assert.rejects(damage(a, m), /resolved successful|earned damage bonus/);
  }
  assert.throws(
    () => validateTrickSneakSource(null, { sources: [{ source: "Between the Ribs", dice: 1 }] }),
    /exact recorded knife hit/
  );
  assert.throws(
    () =>
      validateTrickSneakSource(
        { sneakDice: 1, sneakSource: "Between the Ribs" },
        { sources: [{ source: "Between the Ribs", dice: 2 }] }
      ),
    /exact recorded/
  );
  validateTrickSneakSource(
    { sneakDice: 1, sneakSource: "Between the Ribs" },
    {
      sources: [
        { source: "Between the Ribs", dice: 1 },
        { source: "Ambush Basics", dice: 1 }
      ]
    }
  );
  validateTrickSneakSource(null, { sources: [{ source: "Ambush Basics", dice: 1 }] });
  validateTrickSneakSource(null, null);
  for (const weapon of [
    { proficiency: "unarmed" },
    { proficiency: "rifle" },
    { proficiency: "edged", qualities: "NKL" }
  ])
    assert.throws(
      () =>
        sneakAttackSources({ activeFeatNames: [] }, weapon, { trickSneak: { source: "Between the Ribs", dice: 1 } }),
      /Review/
    );
  for (const trickSneak of [
    { source: "Other", dice: 1 },
    { source: "Between the Ribs", dice: 2 }
  ])
    assert.throws(
      () => sneakAttackSources({ activeFeatNames: [] }, { proficiency: "edged" }, { trickSneak }),
      /Review/
    );
});
test("wrong family, unheld knife, thrown use or incomplete declarations reject before any roll", async () => {
  for (const change of [
    a => (a.items[0].system.meleeFamily = "axe"),
    a => (a.items[0].system.equipped = false),
    a => (a.items[0].system.proficiency = "hurled"),
    a => {
      a.system.activeFeatNames = a.system.activeFeatNames.filter(n => n !== "Knife Basics");
    }
  ]) {
    const a = make();
    change(a);
    a.system = prep(a.system, a.items);
    let draws = 0;
    controls.draw = async () => draws++;
    await attack(a);
    assert.equal(draws, 0);
    assert.equal(game.messages.length, 0);
  }
  for (const extra of [
    { attackAction: "other" },
    { meleeTrickFullActionConfirmed: false },
    { meleeTrickOnlyConfirmed: false },
    { meleeFeatTrick: "chop" }
  ]) {
    const a = make();
    await attack(a, extra);
    assert.equal(game.messages.length, 0);
  }
  {
    const a = make();
    await assert.rejects(attack(a, { freeFinalAttack: true }), /final-attack/);
    assert.equal(game.messages.length, 0);
  }
});
test('Knife Basics alone does not satisfy "ability to inflict sneak attack damage" prerequisites', () => {
  assert.equal(sneakAttackCapacity({ activeFeatNames: ["Knife Basics"], classLevels: {} }), 0);
  assert.equal(
    sneakAttackSources({ activeFeatNames: ["Knife Basics"], classLevels: {} }, { proficiency: "edged" }, {}).length,
    0
  );
});
