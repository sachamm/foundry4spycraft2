import test from "node:test";
import assert from "node:assert/strict";
import { actor, opts } from "./fixtures/side-stance.mjs";
import { prep } from "./fixtures/feint.mjs";
import { COMBAT_STANCES, combatStanceDeclaration } from "../module/rules/combat-stance.mjs";
import { MELEE_ATTACK_TRICKS, validRecordedMeleeTrick } from "../module/rules/melee-tricks.mjs";
import { MELEE_SKILL_FAMILIES, meleeFamilyProficiency } from "../module/rules/readied-weapons.mjs";
import { meleeTrickContent } from "../module/apps/standard-attack-context.mjs";
import { combatStanceContent } from "../module/apps/combat-stance.mjs";
import {
  damageConversionPlan,
  conversionEligible,
  normalDamageType,
  DAMAGE_CONVERSION_PENALTY
} from "../module/rules/damage-conversion.mjs";
import { furiousMeleeAttackCount, furiousStanceRoundPlan } from "../module/rules/furious-stance.mjs";
import { rollPipeline } from "../module/rules/roll-pipeline.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";

const make = (feats = ["Club Basics"], system = {}) => {
    const a = actor(),
      w = a.items[0];
    Object.assign(w.system, {
      proficiency: "blunt",
      meleeFamily: "club",
      sizeHands: "S/1h",
      useHands: 1,
      qualities: "",
      damage: "1d6",
      ...system
    });
    a.system.combatStance = null;
    a.system.activeFeatNames.push(...feats);
    a.system = prep(a.system, a.items);
    return a;
  },
  trick = () => ({
    ...opts(),
    meleeTrick: "outOfThePark",
    meleeTrickFullActionConfirmed: true,
    meleeTrickOnlyConfirmed: true
  });

test("club is a GC-reviewed melee family limited to Blunt proficiencies and offered on the weapon data model", async () => {
  assert.ok(MELEE_SKILL_FAMILIES.includes("club"));
  assert.ok(meleeFamilyProficiency("club", "blunt"));
  assert.ok(meleeFamilyProficiency("club", "exoticBlunt"));
  for (const p of ["edged", "hurled", "unarmed", "handgun"]) assert.equal(meleeFamilyProficiency("club", p), false);
  const { readFile } = await import("node:fs/promises");
  assert.match(await readFile(new URL("../module/data/item.mjs", import.meta.url), "utf8"), /"knife",\s*"club"\s*\]/);
  assert.match(
    await readFile(new URL("../module/sheets/item-sheet.mjs", import.meta.url), "utf8"),
    /club:\s*loc`Club`/
  );
  const a = make();
  assert.deepEqual(
    a.system.readiedMeleeWeapons.map(w => w.family),
    ["club"]
  );
});

test("Out of the Park is a full-action club trick: +2 attack, +2 recorded-hit damage, +2 threat range", async () => {
  const d = MELEE_ATTACK_TRICKS.outOfThePark;
  assert.equal(d.feat, "Club Basics");
  assert.equal(d.family, "club");
  assert.deepEqual([d.attackBonus, d.damageBonus, d.threatIncrease], [2, 2, 2]);
  assert.notEqual(d.fullAction, false);
  assert.match(meleeTrickContent(make()), /Out of the Park/);
  assert.equal(meleeTrickContent(make([])), "");
  const a = make(),
    w = a.items[0],
    normal = a.weaponAttack(w, opts()),
    planned = a.weaponAttack(w, trick());
  assert.equal(planned.total, normal.total + 2);
  assert.equal(planned.threat, normal.threat - 2);
  assert.match(
    planned.notes,
    /Out of the Park: full-action Standard Attack; \+2 attack, \+2 recorded-hit damage, \+2 threat range \(p\.177\)/
  );
  const m = await a.rollAttack(w, trick()),
    c = m.flags.spycraft2;
  assert.equal(c.attackContext.meleeTrick.key, "outOfThePark");
  assert.equal(c.attackContext.meleeTrick.damageBonus, 2);
  assert.ok(validRecordedMeleeTrick(c.attackContext.meleeTrick, c.attackContext));
});

test("Out of the Park needs the earned feat, a readied club and a full action", () => {
  const blocked = (a, extra = {}) => a.weaponAttack(a.items[0], { ...trick(), ...extra });
  assert.ok(blocked(make([])).blocked);
  assert.ok(blocked(make(["Club Basics"], { meleeFamily: "hammer" })).blocked);
  assert.ok(blocked(make(), { meleeTrickFullActionConfirmed: false }).blocked);
  assert.ok(blocked(make(), { meleeTrickOnlyConfirmed: false }).blocked);
  assert.ok(blocked(make(["Club Basics"], { equipped: false })).blocked);
  assert.equal(blocked(make()).blocked, false);
});

test("Club Basics removes the improvised penalty only for an improvised weapon classed as a club", () => {
  const row = a =>
    a.weaponAttack(a.items[0], opts()).modifiers.find(m => /Improvised weapon/.test(m.label))?.value ?? 0;
  assert.equal(row(make([], { improvised: true })), -2);
  assert.equal(row(make(["Club Basics"], { improvised: true })), 0);
  assert.equal(row(make(["Club Basics"], { improvised: true, meleeFamily: "" })), -2);
  assert.equal(row(make(["Club Basics"], { improvised: true, meleeFamily: "hammer" })), -2);
  assert.equal(row(make(["Improvised Weapon Basics"], { improvised: true, meleeFamily: "" })), 0);
});

test("damage conversion is open to unarmed, melee and hurled attacks only, and flips the weapon's own damage type", () => {
  for (const p of ["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged", "hurled", "exoticHurled"])
    assert.ok(conversionEligible({ proficiency: p }), p);
  for (const p of ["handgun", "rifle", "tactical", "", undefined])
    assert.equal(conversionEligible({ proficiency: p }), false);
  assert.equal(normalDamageType({ damage: "1d4 subdual" }), "subdual");
  assert.equal(normalDamageType({ damage: "1d6" }), "lethal");
  const sys = { activeFeatNames: [] };
  assert.equal(damageConversionPlan(sys, { proficiency: "blunt" }, { id: "w" }, {}), null);
  assert.deepEqual(damageConversionPlan(sys, { proficiency: "blunt", damage: "1d6" }, { id: "w" }, { convert: true }), {
    blocked: false,
    version: 1,
    from: "lethal",
    to: "subdual",
    attackPenalty: DAMAGE_CONVERSION_PENALTY,
    waivedBy: null
  });
  assert.equal(
    damageConversionPlan(sys, { proficiency: "unarmed", damage: "1d4 subdual" }, { id: "w" }, { convert: true }).to,
    "lethal"
  );
  assert.ok(damageConversionPlan(sys, { proficiency: "handgun" }, { id: "w" }, { convert: true }).blocked);
});

test("an attack that converts its damage takes −4, waived by Bludgeon or by attacking with the readied club under Club Basics", () => {
  // A waived penalty is a zero row, which the modifier list leaves out.
  const row = (a, extra = {}) =>
    a
      .weaponAttack(a.items[0], { ...opts(), damageConversion: true, ...extra })
      .modifiers.find(m => /Damage conversion/.test(m.label))?.value ?? 0;
  const plain = make([]),
    base = plain.weaponAttack(plain.items[0], opts()).total,
    converted = plain.weaponAttack(plain.items[0], { ...opts(), damageConversion: true });
  assert.equal(row(plain), -4);
  assert.equal(converted.total, base - 4);
  assert.match(converted.notes, /subdual damage instead of lethal, at −4 to the attack \(p\.345\)/);
  assert.equal(row(make()), 0);
  assert.match(
    make().weaponAttack(make().items[0], { ...opts(), damageConversion: true }).notes,
    /Club Basics removes/
  );
  assert.equal(row(make(["Club Basics"], { meleeFamily: "hammer" })), -4, "another weapon is not the readied club");
  assert.equal(row(make(["Club Basics"], { equipped: false })), -4, "an unheld club does not qualify");
  assert.equal(row(make(["Bludgeon"], { meleeFamily: "" })), 0);
  const ranged = make([], { proficiency: "handgun", meleeFamily: "" });
  assert.ok(ranged.weaponAttack(ranged.items[0], { ...opts(), damageConversion: true }).blocked);
});

test("the attack and ranged-attack dialogs offer conversion only where it is legal and read it back", () => {
  const html = (dialog, system) =>
    rollPipeline.dialog({
      dialog,
      actor: make([]),
      item: { system },
      options: {},
      preview: { range: 10 },
      esc: s => s
    });
  assert.match(html("attack", { proficiency: "blunt", damage: "1d6" }), /name="damageConversion"/);
  assert.doesNotMatch(html("attack", { proficiency: "handgun", damage: "2d6" }), /name="damageConversion"/);
  assert.match(html("rangedAttack", { proficiency: "hurled", damage: "1d6" }), /name="damageConversion"/);
  assert.doesNotMatch(html("rangedAttack", { proficiency: "blunt", damage: "1d6" }), /name="damageConversion"/);
  assert.equal(
    rollPipeline.read(
      { dialog: "attack", actor: make([]), item: make([]).items[0], entered: { damageConversion: true } },
      {}
    ).damageConversion,
    true
  );
});

test("Furious Stance is the Club Basics stance and joins the shared stance lifecycle", () => {
  assert.deepEqual(COMBAT_STANCES.furious, { name: "Furious Stance", feat: "Club Basics", page: 177 });
  assert.deepEqual(
    combatStanceDeclaration({ activeFeatNames: ["Club Basics"], conditionContext: {} }, "furious", {
      halfActionConfirmed: true,
      legalConfirmed: true
    }),
    { version: 1, key: "furious" }
  );
  assert.throws(() =>
    combatStanceDeclaration({ activeFeatNames: [], conditionContext: {} }, "furious", {
      halfActionConfirmed: true,
      legalConfirmed: true
    })
  );
  assert.match(combatStanceContent(make()), /Furious Stance/);
});

test("Furious Stance counts each original melee attack the character made in that round", () => {
  const at = (extra = {}, context = {}) => ({
    checkKind: "attack",
    actorUuid: "Actor.a",
    rollCombat: { id: "c1", round: 2, combatantId: "x" },
    attackContext: { ranged: false, ...context },
    ...extra
  });
  const records = [
    at(),
    at(),
    at({ rerollOf: "ChatMessage.m1" }),
    at({}, { ranged: true }),
    at({}, { disarm: { role: "defender" } }),
    at({ actorUuid: "Actor.b" }),
    at({ rollCombat: { id: "c1", round: 3 } }),
    at({ rollCombat: { id: "c2", round: 2 } }),
    at({ checkKind: "damage" }),
    { checkKind: "attack", actorUuid: "Actor.a", attackContext: { ranged: false } }
  ];
  assert.equal(furiousMeleeAttackCount(records, { actorUuid: "Actor.a", combatId: "c1", round: 2 }), 2);
});

test("at the end of a round in Furious Stance the Count rises by that count, once per round, and only in the stance", () => {
  const sys = (key = "furious", feats = ["Club Basics"]) => ({
    activeFeatNames: feats,
    combatStance: { version: 1, id: "s1", key },
    conditionContext: {}
  });
  const plan = furiousStanceRoundPlan(sys(), { initiative: 14, combatId: "c1", round: 2, count: 3 });
  assert.deepEqual(plan, {
    initiative: 17,
    record: { version: 1, combatId: "c1", round: 2, added: 3, stanceId: "s1" }
  });
  assert.equal(furiousStanceRoundPlan(sys(), { initiative: 14, combatId: "c1", round: 2, count: 0 }).initiative, 14);
  assert.equal(furiousStanceRoundPlan(sys("power"), { initiative: 14, combatId: "c1", round: 2, count: 3 }), null);
  assert.equal(
    furiousStanceRoundPlan(sys("furious", []), { initiative: 14, combatId: "c1", round: 2, count: 3 }),
    null
  );
  assert.equal(
    furiousStanceRoundPlan(sys(), { initiative: 17, combatId: "c1", round: 2, count: 3, record: plan.record }),
    null,
    "a round is never counted twice"
  );
  assert.equal(
    furiousStanceRoundPlan(sys(), {
      initiative: 17,
      combatId: "c1",
      round: 1,
      count: 3,
      record: plan.record
    }),
    null,
    "a rewound round is skipped"
  );
  assert.equal(
    furiousStanceRoundPlan(sys(), {
      initiative: 17,
      combatId: "c2",
      round: 1,
      count: 1,
      record: plan.record
    }).initiative,
    18,
    "another combat keeps its own rounds"
  );
  assert.throws(() => furiousStanceRoundPlan(sys(), { initiative: null, combatId: "c1", round: 2, count: 1 }));
  assert.ok(cfg);
});
