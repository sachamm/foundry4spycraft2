import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evasionPlan, evasionSaveContext, reflexDamagePlan } from "../module/rules/defense.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { actionDieBoostPlan } from "../module/rules/action-dice.mjs";
import { checkCandidates } from "../module/rules/outcomes.mjs";
const context = (grade, flatFooted = false, reflexReducesDamage = true) => ({
    version: 1,
    grade,
    flatFooted,
    reflexReducesDamage
  }),
  check = (grade, extra = {}) => ({ checkKind: "save", checkId: "ref", evasionContext: context(grade), ...extra }),
  declare = { confirmed: true };
test("Evasion uses every Intruder and Transporter milestone, combined legacy grades and the highest offered cap", () => {
  for (let intruder = 0; intruder <= 20; intruder++)
    for (let transporter = 0; transporter <= Math.min(10, 20 - intruder); transporter++) {
      const p = evasionPlan({ classLevels: { intruder, transporter } }),
        a = intruder >= 19 ? 3 : intruder >= 11 ? 2 : intruder >= 2 ? 1 : 0,
        b = transporter >= 6 ? 1 : 0;
      assert.equal(p.grade, Math.min(intruder ? 3 : transporter ? 1 : 0, a + b));
      assert.equal(p.canTake10, p.grade === 3);
    }
  assert.equal(evasionPlan({ classLevels: { intruder: 13, transporter: 6 } }).grade, 3);
  const borrowed = [
    { name: "Intruder: Evasion I", ownerClass: "snoop" },
    { name: "Intruder: Evasion I", ownerClass: "scientist" }
  ];
  assert.equal(evasionPlan({ inheritedClassChoices: borrowed }).grade, 1);
  assert.equal(evasionPlan({ inheritedClassChoices: borrowed, classLevels: { intruder: 1 } }).grade, 2);
});
test("the real engine derives Evasion grades independently of Uncanny Dodge and borrowed/native class options", () => {
  const defs = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))),
    items = ["intruder", "transporter"].map(key => {
      const c = defs.find(c => c.key === key);
      return { id: key, name: c.name, type: "class", system: { ...c, identifier: key, vitalityDie: c.vitality } };
    });
  const s = computeAgent(
    {
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
      progression: [
        ...Array.from({ length: 13 }, () => ({ classId: "intruder", vitality: 6, skills: {} })),
        ...Array.from({ length: 6 }, () => ({ classId: "transporter", vitality: 6, skills: {} }))
      ]
    },
    items,
    cfg
  );
  assert.equal(s.evasion.grade, 3);
  assert.equal(s.uncannyDodge.grade, 3);
  assert.equal(s.legacyAbilities.evasion.canTake10, true);
});
test("saved Evasion context freezes the grade, damage eligibility and flat-footedness, including Uncanny Dodge V immunity", () => {
  const system = { classLevels: { intruder: 11 }, conditionContext: { flatFooted: true } },
    saved = evasionSaveContext(system, { reflexReducesDamage: true });
  assert.deepEqual(saved, context(2, true, true));
  system.classLevels.intruder = 19;
  system.conditionContext.flatFooted = false;
  assert.deepEqual(saved, context(2, true, true));
  assert.equal(
    evasionSaveContext({ classLevels: { intruder: 20 }, conditionContext: { flatFooted: true } }, { flatFooted: true })
      .flatFooted,
    false
  );
  assert.throws(() => evasionSaveContext(system, { reflexReducesDamage: "true" }));
});
test("all grades and whole damage values use zero on eligible success, half rounded down on eligible grade-II failure, or exactly the ordinary source result", () => {
  for (let damage = 0; damage <= 101; damage++)
    for (const grade of [0, 1, 2, 3])
      for (const flatFooted of [false, true])
        for (const canReduce of [false, true])
          for (const succeeded of [false, true]) {
            const c = check(grade, { evasionContext: context(grade, flatFooted, canReduce) }),
              normalSuccessDamage = Math.floor(damage / 2),
              p = reflexDamagePlan(c, { ...declare, damage, normalSuccessDamage, succeeded }),
              eligible = grade > 0 && !flatFooted && canReduce;
            assert.equal(
              p.total,
              eligible && succeeded
                ? 0
                : eligible && grade >= 2 && !succeeded
                  ? Math.floor(damage / 2)
                  : succeeded
                    ? normalSuccessDamage
                    : damage
            );
            assert.equal(p.evaded, eligible && succeeded);
            assert.equal(p.halved, eligible && grade >= 2 && !succeeded);
          }
  const p = reflexDamagePlan(check(0), { ...declare, damage: 17, normalSuccessDamage: 4, succeeded: true });
  assert.equal(p.total, 4);
});
test("malformed history, unrecorded saves, replaced rolls, contradictory outcomes and invalid damage cannot produce a damage plan", () => {
  const c = check(2);
  for (const damage of [-1, 1.5, NaN, Infinity, "5"])
    assert.throws(() => reflexDamagePlan(c, { ...declare, damage, normalSuccessDamage: 0, succeeded: true }));
  for (const normalSuccessDamage of [-1, 11, NaN, 1.5])
    assert.throws(() => reflexDamagePlan(c, { ...declare, damage: 10, normalSuccessDamage, succeeded: true }));
  for (const bad of [
    { ...c, evasionContext: null },
    { ...c, superseded: true },
    { ...c, checkId: "fort" },
    { ...c, evasionContext: { ...context(2), grade: 4 } },
    { ...c, evasionContext: { ...context(2), flatFooted: "false" } }
  ])
    assert.throws(() => reflexDamagePlan(bad, { ...declare, damage: 10, normalSuccessDamage: 5, succeeded: true }));
  assert.throws(
    () =>
      reflexDamagePlan(
        { ...c, successConfirmed: false },
        { ...declare, damage: 10, normalSuccessDamage: 5, succeeded: true }
      ),
    /outcome changed/
  );
  assert.throws(() => reflexDamagePlan(c, { damage: 10, normalSuccessDamage: 5, succeeded: true }), /GC/);
});
let input = null,
  formulas = [],
  posts = [];
globalThis.Actor = class {};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = { user: { isGM: true }, i18n: { localize: s => s }, settings: { get: () => ({}) } };
globalThis.foundry = {
  utils: { escapeHTML: s => String(s) },
  applications: { api: { DialogV2: { input: async () => input } } }
};
globalThis.ui = { notifications: { warn: () => null } };
globalThis.ChatMessage = { getSpeaker: () => ({}) };
globalThis.Roll = class {
  constructor(formula, data) {
    this.formula = formula;
    this.data = data;
    formulas.push(formula);
  }
  async evaluate() {
    this.dice = this.formula.includes("1d20") ? [{ total: 7 }] : [];
    this.total = (this.dice.length ? 7 : 10) + this.data.total;
    return this;
  }
  async toMessage(data) {
    posts.push(data);
    return { ...data, rolls: [this] };
  }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");
function actor(level = 19) {
  formulas = [];
  posts = [];
  input = null;
  const a = new SpycraftActor();
  Object.assign(a, {
    uuid: "Actor.evasion",
    type: "agent",
    isOwner: true,
    system: {
      classLevels: { intruder: level },
      conditionContext: {},
      saves: { ref: { total: 12 }, fort: { total: 8 }, will: { total: 5 } },
      actionDice: { value: 2 },
      abilities: {}
    },
    statuses: new Set()
  });
  return a;
}
test("Evasion III takes 10 on any real Reflex save with no d20, natural result, threat, action-die boost or random reroll", async () => {
  const a = actor(),
    m = await a.rollSave("ref", { checkMethod: "take10", reflexReducesDamage: true, flatFooted: true }),
    c = m.flags.spycraft2;
  assert.deepEqual(formulas, ["10 + @total"]);
  assert.equal(m.rolls[0].dice.length, 0);
  assert.equal(c.rawTotal, 22);
  assert.equal(c.naturalDie, null);
  assert.equal(c.checkMethod, "take10");
  assert.equal(c.actionDiceAllowed, false);
  assert.deepEqual(checkCandidates(c), {
    threat: false,
    naturalError: false,
    negative: false,
    error: false,
    triumph: false
  });
  assert.equal(actionDieBoostPlan(a.system, c).blocked, true);
  assert.deepEqual(c.evasionContext, context(3, true, true));
  assert.equal(a.system.actionDice.value, 2);
  assert.equal(await a.rollSave("fort", { checkMethod: "take10" }), false);
  assert.equal(await actor(18).rollSave("ref", { checkMethod: "take10" }), false);
  assert.equal(await a.rollSave("ref", { checkMethod: "take20" }), false);
});
test("direct nonrandom-save calls cannot bypass source/check-kind restrictions, and ordinary Reflex rolls retain their explicit frozen context", async () => {
  const a = actor(18);
  await assert.rejects(
    a.rollCheck("1d20 + @total", { total: 12 }, { checkKind: "save", checkId: "ref", checkMethod: "take10" }),
    /Evasion III/
  );
  a.system.classLevels.intruder = 19;
  for (const extra of [
    { checkId: "fort" },
    { chooseTwice: true },
    { oneInAMillion: true },
    { tenSecondSolution: true }
  ])
    await assert.rejects(
      a.rollCheck(
        "1d20 + @total",
        { total: 12 },
        { checkKind: "save", checkId: "ref", checkMethod: "take10", ...extra }
      ),
      /Evasion III/
    );
  const m = await a.rollSave("ref", { reflexReducesDamage: true });
  assert.equal(m.flags.spycraft2.naturalDie, 7);
  assert.equal(m.flags.spycraft2.evasionContext.grade, 3);
  assert.equal(m.flags.spycraft2.checkMethod, "roll");
  assert.equal(await a.rollSave("ref", { askContext: true }), null);
});

test("actual Reflex rolls add ordinary cover once to existing save modifiers, with no bonus for effects on this side or other saves", async () => {
  const a = actor(),
    cover = { personalCover: 2, sceneryCover: 1, effectBeyondCover: true },
    before = structuredClone(a.system);
  let m = await a.rollSave("ref", cover);
  assert.equal(m.flags.spycraft2.rawTotal, 22);
  assert.equal(m.flags.spycraft2.coverSave.bonus, 3);
  assert.match(m.flavor, /Cover\/Reflex \+3/);
  m = await a.rollSave("ref", { ...cover, braced: true });
  const base = await a.rollSave("ref", { braced: true });
  assert.equal(m.flags.spycraft2.rawTotal - base.flags.spycraft2.rawTotal, 3);
  m = await a.rollSave("ref", { ...cover, effectBeyondCover: false });
  assert.equal(m.flags.spycraft2.rawTotal, 19);
  assert.equal(m.flags.spycraft2.coverSave.bonus, 0);
  for (const [key, total] of [
    ["fort", 15],
    ["will", 12]
  ]) {
    m = await a.rollSave(key, cover);
    assert.equal(m.flags.spycraft2.rawTotal, total);
    assert.equal(m.flags.spycraft2.coverSave, null);
  }
  assert.deepEqual(a.system, before);
});
test("taking 10 retains cover independently of Evasion eligibility and the save dialog collects all cover grades without spending dice", async () => {
  const a = actor();
  let m = await a.rollSave("ref", {
    checkMethod: "take10",
    personalCover: 2,
    sceneryCover: 1,
    effectBeyondCover: true,
    reflexReducesDamage: true
  });
  assert.equal(m.flags.spycraft2.rawTotal, 25);
  assert.equal(m.flags.spycraft2.coverSave.bonus, 3);
  assert.equal(m.flags.spycraft2.actionDiceAllowed, false);
  assert.equal(m.rolls[0].dice.length, 0);
  assert.equal(a.system.actionDice.value, 2);
  input = { personalCover: "2", sceneryCover: "2", effectBeyondCover: true };
  m = await a.rollSave("ref", { askContext: true });
  assert.equal(m.flags.spycraft2.rawTotal, 23);
  assert.equal(m.flags.spycraft2.coverSave.grade, 4);
  input = null;
  const count = posts.length;
  assert.equal(await a.rollSave("ref", { askContext: true }), null);
  assert.equal(posts.length, count);
  await assert.rejects(a.rollSave("ref", { personalCover: "5", effectBeyondCover: true }), /cover grade/);
  assert.equal(posts.length, count);
});
test("cover save outcome evidence preserves ordinary legacy checks but rejects changed grades, eligibility or bonuses", async () => {
  const { rollEvidence, rollEvidenceMatches } = await import("../module/rules/outcomes.mjs");
  const a = actor(),
    m = await a.rollSave("ref", { personalCover: 2, sceneryCover: 1, effectBeyondCover: true }),
    c = m.flags.spycraft2,
    e = rollEvidence(c);
  for (const [key, value] of [
    ["grade", 4],
    ["bonus", 4],
    ["effectBeyondCover", false],
    ["personalCover", 0]
  ]) {
    const changed = structuredClone(c);
    changed.coverSave[key] = value;
    assert.equal(rollEvidenceMatches(e, changed), false);
  }
  const legacy = structuredClone(c);
  delete legacy.coverSave;
  assert.equal(rollEvidenceMatches(rollEvidence(legacy), c), false);
  assert.equal(rollEvidenceMatches(e, legacy), false);
  assert.equal(rollEvidenceMatches(rollEvidence(legacy), legacy), true);
});
test("Blockbuster: a player character's successful half-damage save resists all of it (p.406)", () => {
  const half = reflexDamagePlan(check(0), { ...declare, damage: 17, normalSuccessDamage: 8, succeeded: true });
  assert.equal(half.total, 8);
  const resisted = reflexDamagePlan(check(0), {
    ...declare,
    damage: 17,
    normalSuccessDamage: 8,
    succeeded: true,
    blockbuster: true
  });
  assert.deepEqual([resisted.total, resisted.resisted], [0, true]);
  const failed = reflexDamagePlan(check(0), {
    ...declare,
    damage: 17,
    normalSuccessDamage: 8,
    succeeded: false,
    blockbuster: true
  });
  assert.equal(failed.total, 17, "only a successful save");
});
