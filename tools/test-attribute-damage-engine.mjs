import test from "node:test";
import assert from "node:assert/strict";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import {
  attributeDamagePlan,
  attributeMissionRecoveryPlan,
  attributeDamageEvidence,
  validateAttributeDamageProof
} from "../module/rules/attribute-damage.mjs";
import { attributeActionBlock } from "../module/rules/attributes.mjs";
import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
const keys = ["str", "dex", "con", "int", "wis", "cha"],
  cls = {
    id: "test",
    name: "Test",
    type: "class",
    system: {
      identifier: "test",
      skillPoints: 4,
      vitalityDie: 8,
      proficiencies: 0,
      classSkills: Object.keys(cfg.skills),
      table: []
    }
  },
  source = () => ({
    abilities: Object.fromEntries(keys.map(k => [k, { base: 12, misc: 0 }])),
    progression: Array.from({ length: 3 }, () => ({
      classId: "test",
      vitality: 4,
      intelligenceModifier: 2,
      skills: {}
    })),
    vitality: { value: 4 },
    wounds: { value: 4 },
    actionDice: { value: 3 },
    usagePeriods: { mission: "mission1" }
  }),
  compute = s => computeAgent(s, [cls], cfg),
  damage = (s, patch = {}) =>
    attributeDamagePlan(s, {
      id: "event1",
      ability: "wis",
      amount: 2,
      source: "GC-confirmed source",
      floor: null,
      confirmed: true,
      worldTime: 126,
      ...patch
    }).record;
test("current typed damage changes all six scores/modifiers while retaining base, misc, creation cost, increases and historical earned skill/focus pools", () => {
  for (const ability of keys) {
    const raw = source(),
      normal = compute(structuredClone(raw)),
      r = structuredClone(raw);
    r.attributeDamage = damage(normal, { ability, amount: 4 });
    const d = compute(r);
    for (const k of keys) {
      assert.equal(d.abilities[k].value, normal.abilities[k].value - (k === ability ? 4 : 0));
      assert.equal(d.abilities[k].damage, k === ability ? 4 : 0);
      assert.equal(d.abilities[k].undamagedValue, normal.abilities[k].value);
      for (const field of ["base", "misc", "cost", "increase", "bonus"])
        assert.equal(d.abilities[k][field], normal.abilities[k][field]);
    }
    assert.deepEqual(d.skillPoints, normal.skillPoints);
    assert.deepEqual(d.focusPicks, normal.focusPicks);
    assert.deepEqual(d.focusTotals, normal.focusTotals);
    assert.deepEqual(d.candidateScores, normal.candidateScores);
    assert.deepEqual(d.pointBuy, normal.pointBuy);
    assert.equal(d.actionDice.value, 3);
    assert.equal(d.vitality.value, 4);
    assert.equal(d.wounds.value, 4);
    assert.equal(raw.attributeDamage, undefined);
  }
});
test("current defenses, saves, initiative, health maxima and damage thresholds follow their actual damaged attributes", () => {
  const base = compute(source());
  for (const [ability, checks] of [
    [
      "dex",
      s => {
        assert.equal(s.defense.total, base.defense.total - 2);
        assert.equal(s.initiative.total, base.initiative.total - 2);
        assert.equal(s.saves.ref.total, base.saves.ref.total - 2);
      }
    ],
    [
      "con",
      s => {
        assert.equal(s.saves.fort.total, base.saves.fort.total - 2);
        assert.equal(s.vitality.max, base.vitality.max - 6);
        assert.equal(s.wounds.max, base.wounds.max - 4);
        assert.equal(s.subdualThreshold, base.subdualThreshold - 4);
      }
    ],
    [
      "wis",
      s => {
        assert.equal(s.saves.will.total, base.saves.will.total - 2);
        assert.equal(s.stressThreshold, base.stressThreshold - 4);
        assert.equal(
          s.skillTotals.notice.totals.find(t => t.ability === "wis").total,
          base.skillTotals.notice.totals.find(t => t.ability === "wis").total - 2
        );
      }
    ]
  ]) {
    const r = source();
    r.attributeDamage = damage(base, { ability, amount: 4 });
    checks(compute(r));
  }
});
test("negative typed scores reach existing collapse rules, and recovering damage restores the current score without rewriting bases/history", () => {
  for (const ability of keys) {
    const base = compute(source()),
      raw = source();
    raw.attributeDamage = damage(base, { ability, amount: 15 });
    const d = compute(raw);
    assert.equal(d.abilities[ability].value, -3);
    assert.ok(d.attributeCollapse.entries.some(e => e.key === ability));
    const next = structuredClone(raw);
    next.attributeDamage = attributeMissionRecoveryPlan(d, {
      id: "end1",
      missionId: "mission1",
      confirmed: true,
      worldTime: 127
    }).record;
    const healed = compute(next);
    assert.equal(healed.abilities[ability].value, 12);
    assert.equal(
      healed.attributeCollapse.entries.some(e => e.key === ability),
      false
    );
    assert.equal(healed.attributeDamageState.events[0].healed, 15);
    assert.equal(healed.abilities[ability].base, 12);
  }
});
test("damage derivation is idempotent and excludes both temporary and permanent INT damage from legacy earned-point/focus reconstruction", () => {
  for (const kind of ["temporary", "permanent"]) {
    const raw = source();
    for (const p of raw.progression) delete p.intelligenceModifier;
    const normal = compute(structuredClone(raw));
    raw.attributeDamage = damage(normal, { ability: "int", amount: 6, kind });
    const d = compute(raw);
    assert.equal(d.abilities.int.value, 6);
    assert.deepEqual(d.skillPoints, normal.skillPoints);
    assert.deepEqual(d.focusPicks, normal.focusPicks);
    assert.equal(compute(d).abilities.int.value, 6);
    assert.equal(d.abilities.int.base, 12);
  }
});
test("malformed damage records produce a visible review task and block voluntary actions instead of trusting saved derived totals", () => {
  const r = source();
  r.attributeDamage = { version: 99, events: [], recoveries: [] };
  const d = compute(r);
  assert.equal(d.attributeDamageState.needsReview, true);
  assert.ok(d.warnings.some(w => /attribute-damage/.test(w)));
  assert.ok(d.todo.some(t => /attribute-damage/.test(t.text)));
  assert.match(attributeActionBlock(d), /Review/);
  assert.throws(() => attributeDamageEvidence(d, "save"), /Review/);
});
test("active damage evidence freezes sorted actual source remainders, excludes healed history and rejects later additions/changes/recoveries", () => {
  const s = compute(source());
  s.attributeDamage = damage(s, { id: "b" });
  s.attributeDamage = attributeDamagePlan(s, {
    id: "a",
    ability: "dex",
    kind: "permanent",
    amount: 1,
    source: "Other source",
    confirmed: true,
    worldTime: 126
  }).record;
  const proof = attributeDamageEvidence(s, "skill");
  assert.deepEqual(
    proof.events.map(e => e.id),
    ["a", "b"]
  );
  validateAttributeDamageProof(s, proof, { checkKind: "skill" });
  for (const kind of ["skill", "knowledge", "attack", "save", "ability", "initiative", "gear", "request"])
    assert.ok(attributeDamageEvidence(s, kind));
  assert.equal(attributeDamageEvidence(s, "damage"), null);
  const c = { checkKind: "skill", attributeDamage: proof },
    e = rollEvidence(c);
  assert.equal(rollEvidenceMatches(e, c), true);
  assert.equal(rollEvidenceMatches(rollEvidence({ checkKind: "skill" }), c), false);
  s.attributeDamage = attributeMissionRecoveryPlan(s, {
    id: "end1",
    missionId: "mission1",
    confirmed: true,
    worldTime: 127
  }).record;
  assert.throws(() => validateAttributeDamageProof(s, proof, { checkKind: "skill" }), /changed/);
  assert.equal(attributeDamageEvidence(s, "skill").events.length, 1);
  assert.equal(attributeDamageEvidence(s, "skill").events[0].kind, "permanent");
  assert.throws(() => validateAttributeDamageProof(s, null, { checkKind: "skill" }), /changed/);
});
globalThis.Actor = class {
  constructor() {
    this.type = "agent";
    this.isOwner = true;
    this.uuid = "Actor.qa";
    this.items = [];
    this.flags = {};
    this.system = compute(source());
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = {
  user: { id: "gc", isGM: true },
  settings: { get: () => false },
  time: { worldTime: 126 },
  combats: [],
  i18n: { localize: String }
};
globalThis.foundry = { utils: { escapeHTML: String } };
globalThis.ui = { notifications: { warn: () => null } };
globalThis.ChatMessage = { getSpeaker: () => ({}) };
let posts = [],
  hook = async () => {},
  rolls = 0;
globalThis.Roll = class {
  constructor(_f, data) {
    this.total = 12 + (data.total ?? data.mod ?? 0);
    this.dice = [{ total: 12 }];
  }
  async evaluate() {
    rolls++;
    await hook();
    return this;
  }
  async toMessage(d) {
    posts.push(d);
    return d;
  }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");
test("actual save entry records current typed damage, blocks real RNG additions and recovery, and preserves ordinary no-damage receipt shape", async () => {
  const a = new SpycraftActor();
  posts = [];
  hook = async () => {};
  await a.rollSave("will");
  assert.equal(posts.length, 1);
  assert.equal(posts[0].flags.spycraft2.attributeDamage, null);
  a.system.attributeDamage = damage(a.system);
  compute(a.system);
  await a.rollSave("will");
  assert.equal(posts.length, 2);
  assert.equal(posts[1].flags.spycraft2.rollData.total, 0);
  assert.equal(posts[1].flags.spycraft2.attributeDamage.events[0].remaining, 2);
  hook = async () => {
    a.system.attributeDamage = attributeMissionRecoveryPlan(a.system, {
      id: "end1",
      missionId: "mission1",
      confirmed: true,
      worldTime: 127
    }).record;
    compute(a.system);
  };
  await assert.rejects(a.rollSave("will"), /Attribute damage.*changed/);
  assert.equal(posts.length, 2);
  hook = async () => {};
  await a.rollSave("will");
  assert.equal(posts.at(-1).flags.spycraft2.attributeDamage, null);
  const b = new SpycraftActor();
  hook = async () => {
    b.system.attributeDamage = damage(b.system);
    compute(b.system);
  };
  await assert.rejects(b.rollSave("will"), /Attribute damage.*changed/);
  assert.equal(posts.length, 3);
  hook = async () => {};
});
test("replacement and fabricated proof payloads cannot bypass the actual damage state or replay old no-damage modifiers", async () => {
  const a = new SpycraftActor();
  a.system.attributeDamage = damage(a.system);
  compute(a.system);
  rolls = 0;
  hook = async () => {};
  for (const attributeDamage of [null, { version: 1, events: [] }])
    await assert.rejects(a.rollCheck("1d20", {}, { checkKind: "save", attributeDamage }), /changed/);
  assert.equal(rolls, 0);
  const proof = attributeDamageEvidence(a.system, "save");
  await a.rollCheck("1d20", {}, { checkKind: "save", attributeDamage: proof });
  assert.equal(rolls, 1);
  a.system.attributeDamage.events[0].source = "Changed source";
  await assert.rejects(a.rollCheck("1d20", {}, { checkKind: "save", attributeDamage: proof }), /changed/);
  assert.equal(rolls, 1);
});
