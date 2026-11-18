import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  greatSwordDefensePlan as plan,
  validateGreatSwordDefenseProof as validate
} from "../module/rules/great-sword-defense.mjs";
import { incomingDefensePlan } from "../module/rules/defense.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const ready = () => ({
    id: "sword",
    uuid: "Item.sword",
    name: "Reviewed two-handed sword",
    family: "twoHandedSword",
    proficiency: "exoticEdged",
    hands: 2,
    requiredHands: 2
  }),
  state = () => ({
    size: "Medium",
    classLevels: {},
    activeFeatNames: ["Great Sword Basics"],
    readiedMeleeWeapons: [ready()],
    defenseBonusEntries: [],
    conditionContext: {},
    abilities: { dex: { value: 14, mod: 2 } },
    defense: { total: 14, dexterity: 2, dodgeBonuses: 2, dodgeLost: 0 }
  });
test("qualified readied two-handed sword adds exactly two gear Defense against melee including unarmed, never ranged or global base Defense", () => {
  const s = state(),
    before = structuredClone(s);
  assert.equal(incomingDefensePlan(s).total, 16);
  assert.equal(incomingDefensePlan(s, { ranged: true }).total, 14);
  assert.equal(s.defense.total, 14);
  assert.deepEqual(s, before);
  assert.equal(
    plan(
      {
        get activeFeatNames() {
          throw Error("Unused");
        }
      },
      { ranged: true }
    ).increment,
    0
  );
  for (const change of [
    x => (x.activeFeatNames = []),
    x => (x.readiedMeleeWeapons = []),
    x => (x.readiedMeleeWeapons[0].family = "spear")
  ]) {
    const n = state();
    change(n);
    assert.equal(incomingDefensePlan(n).total, 14);
  }
});
test("normal gear nonstacking compares only positive gear, retains negative gear, and does not swallow dodge/unnamed bonuses", () => {
  for (const [existing, increment] of [
    [-3, 2],
    [0, 2],
    [1, 1],
    [2, 0],
    [5, 0]
  ]) {
    const s = state();
    s.defenseBonusEntries = [
      { source: "Actual gear", type: "gear", value: existing },
      { source: "Other dodge", type: "dodge", value: 8 },
      { source: "Other unnamed", type: "", value: 6 }
    ];
    s.defense.total += existing;
    const p = plan(s);
    assert.equal(p.existingGearBonus, Math.max(0, existing));
    assert.equal(p.increment, increment);
    assert.equal(incomingDefensePlan(s).total, s.defense.total + increment);
  }
  const s = state();
  s.readiedMeleeWeapons[0].hands = 1;
  s.readiedMeleeWeapons.push({ ...ready(), id: "second", hands: 1 });
  assert.equal(plan(s).increment, 2);
});
test("gear survives vulnerability and invisible/flat-footed attacks while dodge and DEX use their existing rules", () => {
  for (const options of [{}, { flatFooted: true }, { invisibleAttacker: true }, { ranged: false, adjacent: true }]) {
    const s = state(),
      no = { ...s, activeFeatNames: [] },
      a = incomingDefensePlan(s, options),
      b = incomingDefensePlan(no, options);
    assert.equal(a.total - b.total, 2);
    assert.equal(a.dodgeLost, b.dodgeLost);
    assert.equal(a.dexterity, b.dexterity);
  }
  for (const conditions of [{ vulnerable: true }, { held: true }, { pinned: true }]) {
    const s = state();
    s.conditionContext = conditions;
    assert.equal(incomingDefensePlan(s).total - incomingDefensePlan({ ...s, activeFeatNames: [] }).total, 2);
  }
});
const feats = JSON.parse(readFileSync(new URL("../src/data/feats.json", import.meta.url))),
  classes = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))),
  cls = classes.find(c => c.key === "soldier"),
  feat = feats.find(f => f.name === "Great Sword Basics");
function calculate({ active = true, equipped = true, gear = 0, conditions = {} } = {}) {
  return computeAgent(
    {
      abilities: Object.fromEntries(
        ["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: k === "dex" ? 14 : 12 }])
      ),
      progression: [{ classId: "soldier", vitality: 6, skills: {} }],
      skills: {},
      focuses: {},
      proficiencies: { exoticEdged: { proficient: true } },
      misc: {},
      conditionContext: conditions,
      actionDice: { value: 0 },
      vitality: { value: 4 },
      wounds: { value: 4 }
    },
    [
      {
        id: "soldier",
        name: cls.name,
        type: "class",
        system: { ...structuredClone(cls), identifier: "soldier", vitalityDie: cls.vitality }
      },
      ...(active
        ? [
            {
              id: "feat",
              name: feat.name,
              type: "feat",
              system: { ...structuredClone(feat), tree: "meleeCombat", acquiredAtLevel: 1 }
            }
          ]
        : []),
      {
        id: "sword",
        name: "Renamed source",
        type: "weapon",
        system: {
          proficiency: "exoticEdged",
          meleeFamily: "twoHandedSword",
          equipped,
          carried: true,
          quantity: 1,
          sizeHands: "M/2h"
        }
      },
      {
        id: "gear",
        name: "Existing Defense gear",
        type: "origin",
        system: { bonuses: [{ target: "defense", value: String(gear), bonusType: "gear" }] }
      }
    ],
    cfg
  );
}
test("actual engine exposes full typed Defense entries and source readiness without changing Main Defense, resources or ranged Defense", () => {
  for (const gear of [-2, 0, 1, 2, 5])
    for (const conditions of [{}, { vulnerable: true }]) {
      const s = calculate({ gear, conditions }),
        b = calculate({ active: false, gear, conditions });
      assert.equal(s.featStatus.feat.ok, true);
      assert.deepEqual(s.defense, b.defense);
      assert.equal(s.defenseBonusEntries.find(e => e.source === "Existing Defense gear")?.value ?? 0, gear);
      assert.equal(incomingDefensePlan(s).total - incomingDefensePlan(b).total, Math.max(0, 2 - Math.max(0, gear)));
      assert.equal(incomingDefensePlan(s, { ranged: true }).total, incomingDefensePlan(b, { ranged: true }).total);
      assert.equal(s.vitality.value, 4);
      assert.equal(s.actionDice.value, 0);
    }
  const s = calculate({ equipped: false });
  assert.equal(plan(s).increment, 0);
});
test("current proof binds zero-source gains/losses, sword identity and legal grip, incoming type and competing typed gear, with native key-order tolerance", () => {
  const s = state(),
    p = plan(s);
  validate(s, p);
  for (const change of [
    x => (x.activeFeatNames = []),
    x => (x.readiedMeleeWeapons = []),
    x => (x.readiedMeleeWeapons[0].id = "new"),
    x => (x.readiedMeleeWeapons[0].hands = 1),
    x => (x.defenseBonusEntries = [{ type: "gear", value: 3 }])
  ]) {
    const n = state();
    change(n);
    assert.throws(() => validate(n, p), /changed/);
  }
  assert.throws(() => validate(s, plan({ ...s, activeFeatNames: [] })), /changed/);
  assert.throws(() => validate(s, p, { ranged: true }), /changed/);
  assert.throws(() => plan(s, { ranged: "false" }));
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
  validate(s, reverse(p));
  for (const entries of [null, {}, [null], [{ type: "gear", value: NaN }]])
    assert.throws(() => plan({ ...s, defenseBonusEntries: entries }));
});
let input = {},
  change = () => {},
  result = "",
  warnings = [];
globalThis.game = { user: { isGM: true }, actors: [] };
globalThis.ui = {
  notifications: {
    warn: m => {
      warnings.push(m);
      return "warned";
    }
  }
};
globalThis.foundry = {
  utils: { escapeHTML: String },
  applications: {
    api: {
      DialogV2: {
        input: async o => {
          if (o.window.title === "Incoming attack — Defense") return input;
          result = o.content;
          change();
          return {};
        }
      }
    }
  }
};
const { checkIncomingDefense } = await import("../module/apps/incoming-defense.mjs");
test("actual incoming Defense control displays the conditional gear bonus and rejects source or gear changes while the result dialog is open", async () => {
  const actor = () => ({ type: "agent", isOwner: true, uuid: "Actor.great", name: "Defender", system: state() });
  input = {};
  change = () => {};
  warnings = [];
  const a = actor(),
    p = await checkIncomingDefense(a);
  assert.equal(p.total, 16);
  assert.match(result, /Great Sword Basics/);
  assert.match(result, /additional Defense \+2/);
  for (const kind of ["gain", "loss", "weapon", "gear"]) {
    const a = actor();
    if (kind === "gain") a.system.activeFeatNames = [];
    change = () => {
      if (kind === "gain") a.system.activeFeatNames = ["Great Sword Basics"];
      if (kind === "loss") a.system.activeFeatNames = [];
      if (kind === "weapon") a.system.readiedMeleeWeapons = [];
      if (kind === "gear") a.system.defenseBonusEntries = [{ type: "gear", value: 3 }];
    };
    assert.equal(await checkIncomingDefense(a), "warned");
    assert.match(warnings.at(-1), /changed/);
  }
  change = () => {};
  input = { ranged: true };
  assert.equal((await checkIncomingDefense(actor())).total, 14);
});
