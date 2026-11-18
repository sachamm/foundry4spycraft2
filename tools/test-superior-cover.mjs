import test from "node:test";
import assert from "node:assert/strict";
import { superiorCoverPlan, superiorCoverReviewPlan, superiorCoverState } from "../module/rules/superior-cover.mjs";
import { declareSuperiorCover, reviewSuperiorCover } from "../module/apps/superior-cover.mjs";
import { armorTrainingDRForAttack } from "../module/rules/armor-training.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { weaponAttack } from "../module/rules/gear.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { resolveKnowledgeCheck } from "../module/rules/knowledge.mjs";
const clock = () => ({ id: "combat", started: true, round: 2, turn: 1, combatantId: "own", ownTurnIndex: 1 }),
  input = () => ({
    personalCover: 1,
    sceneryCover: 2,
    confirmed: true,
    note: "Actual shield and wall confirmed by GC"
  }),
  source = () => ({ activeFeatNames: ["Superior Cover"], superiorCover: null, superiorCoverCombatContext: clock() });
const record = () => ({ ...superiorCoverPlan(source(), clock(), input()), id: "cover1" });
test("every personal/scenery combination grants ordinary Reflex-cover DR capped at four, with cover and own-Count eligibility required", () => {
  for (let p = 0; p <= 4; p++)
    for (let s = 0; s <= 4; s++) {
      const call = () => superiorCoverPlan(source(), clock(), { ...input(), personalCover: p, sceneryCover: s });
      if (p + s) assert.equal(call().reflexBonus, Math.min(4, p + s));
      else assert.throws(call, /actual cover/);
    }
  for (const patch of [{ started: false }, { turn: 0 }, { round: 0 }, { ownTurnIndex: -1 }, { combatantId: "" }])
    assert.throws(() => superiorCoverPlan(source(), { ...clock(), ...patch }, input()), /Initiative/);
  for (const patch of [{ confirmed: false }, { note: "" }, { personalCover: 5 }, { sceneryCover: 0.5 }])
    assert.throws(() => superiorCoverPlan(source(), clock(), { ...input(), ...patch }));
  assert.throws(() => superiorCoverPlan({ ...source(), activeFeatNames: [] }, clock(), input()), /earned/);
});
test("penalty spans the round boundary until next own Count; lost cover stops only DR and source loss cannot erase the accepted penalty", () => {
  const r = record();
  for (const [round, turn, active] of [
    [2, 1, true],
    [2, 2, true],
    [3, 0, true],
    [3, 1, false],
    [3, 2, false],
    [4, 0, false]
  ]) {
    const s = {
        ...source(),
        activeFeatNames: [],
        superiorCover: r,
        superiorCoverCombatContext: { ...clock(), round, turn }
      },
      state = superiorCoverState(s);
    assert.equal(state.active, active);
    assert.equal(state.penalty, active ? 2 : 0);
    assert.equal(state.dr, active ? 3 : 0);
    assert.equal(superiorCoverState({ ...s, superiorCover: { ...r, coverLost: true } }).dr, 0);
  }
  assert.equal(superiorCoverState({ ...source(), superiorCover: r, superiorCoverCombatContext: null }).active, false);
});
function calculate(active = false, conditions = {}) {
  const cls = {
      id: "test",
      type: "class",
      name: "Test",
      system: {
        identifier: "test",
        skillPoints: 4,
        vitalityDie: 6,
        classSkills: [],
        table: [{ level: 1, bab: 1, defense: 3, fort: 0, ref: 0, will: 0 }]
      }
    },
    feat = { id: "cover", name: "Superior Cover", type: "feat", system: { granted: true, bonuses: [] } };
  return computeAgent(
    {
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 14 }])),
      progression: [{ classId: "test", vitality: 6, skills: {} }],
      skills: {},
      focuses: {},
      proficiencies: {},
      misc: {},
      conditionContext: conditions,
      superiorCover: active ? record() : null,
      superiorCoverCombatContext: clock()
    },
    [cls, feat],
    cfg
  );
}
test("actual engine applies one -2 check penalty after skill-bonus transforms, including every named skill and Knowledge, without penalizing damage or saves", () => {
  for (const conditions of [{}, { baffled: true }, { incompetent: true }]) {
    const normal = calculate(false, conditions),
      active = calculate(true, conditions);
    for (const [key, s] of Object.entries(cfg.skills))
      for (const check of s.checks ?? []) {
        const a = resolveSkillCheck(normal, key, check, {}),
          b = resolveSkillCheck(active, key, check, {});
        assert.equal(b.total, a.total - 2, key + "/" + check.id);
        assert.match(b.notes, /Superior Cover/);
      }
    assert.equal(
      resolveKnowledgeCheck(active, { skill: "search" }).total,
      resolveKnowledgeCheck(normal, { skill: "search" }).total - 2
    );
    for (const proficiency of ["unarmed", "edged", "rifle"]) {
      const w = { proficiency, isMelee: proficiency !== "rifle" };
      assert.equal(weaponAttack(active, w, cfg).total, weaponAttack(normal, w, cfg).total - 2);
    }
    for (const key of ["fort", "ref", "will"]) assert.equal(active.saves[key].total, normal.saves[key].total);
    assert.equal(active.initiative.total, normal.initiative.total);
    assert.equal(active.defense.total, normal.defense.total);
    assert.equal(active.dr.melee, normal.dr.melee + 3);
    assert.equal(active.dr.other, normal.dr.other + 3);
    for (const kind of Object.keys(active.armorDRByAttack))
      assert.equal(active.armorDRByAttack[kind], normal.armorDRByAttack[kind] + 3);
  }
});
test("independent cover DR stacks outside the natural-quality versus class/gear maximum while preserving armor-training attack categories", () => {
  const s = {
    damageReductionComponents: { natural: 12, class: 2, armorMelee: 5, armorOther: 3, feat: 4 },
    armorFeatRules: { meleeWeaponDR: 1, rangedWeaponDR: 2, meleeAttackDR: 1, rangedAttackDR: 1 }
  };
  for (const kind of ["unarmed", "meleeWeapon", "hurledWeapon", "rangedWeapon", "other"])
    assert.equal(armorTrainingDRForAttack(s, kind), 16);
  assert.throws(
    () =>
      armorTrainingDRForAttack(
        { ...s, damageReductionComponents: { ...s.damageReductionComponents, feat: -1 } },
        "other"
      ),
    /feat DR/
  );
});
let serial = 0,
  dialog = null;
globalThis.game = {
  ready: false,
  user: { id: "gc", isGM: true },
  time: { worldTime: 96 },
  settings: { get: () => ({}) }
};
globalThis.foundry = {
  utils: { randomID: () => `id${++serial}`, escapeHTML: String },
  applications: { api: { DialogV2: { input: async options => dialog?.(options) } } }
};
function actor() {
  dialog = null;
  serial = 0;
  const a = {
    type: "agent",
    uuid: "Actor.cover",
    isOwner: true,
    flags: {},
    system: { ...source(), wounds: { value: 4 }, actionDice: { value: 0 } },
    participatingCombat: { ...clock(), turns: [] },
    async update(patch) {
      if (this.fail === "before") throw Error("before write");
      for (const [path, value] of Object.entries(patch)) {
        const keys = path.split(".");
        let object = this;
        for (const key of keys.slice(0, -1)) object = object[key] ??= {};
        object[keys.at(-1)] = structuredClone(value);
      }
      if (this.fail === "after") throw Error("after committed");
    }
  };
  a.participatingCombat.turns = [
    { id: "other", actor: { uuid: "Actor.other" } },
    { id: "own", actor: a }
  ];
  return a;
}
test("actual declaration rejects cancellation, stale Count/record, ownership, source removal and incapacities before persistence", async () => {
  let a = actor();
  assert.equal(await declareSuperiorCover(a), null);
  for (const change of [
    a => (a.participatingCombat.turn = 0),
    a => (a.isOwner = false),
    a => (a.system.activeFeatNames = []),
    a => (a.system.superiorCover = record())
  ]) {
    a = actor();
    dialog = async () => {
      change(a);
      return input();
    };
    await assert.rejects(declareSuperiorCover(a));
    assert.equal(a.flags.spycraft2, undefined);
  }
  for (const condition of ["dead", "unconscious", "stunned", "sleeping"]) {
    a = actor();
    a.system.conditionContext = { [condition]: true };
    await assert.rejects(declareSuperiorCover(a, input()));
  }
  a = actor();
  a.system.refreshAction = { state: "waiting", combatId: "combat", startRound: 2 };
  await assert.rejects(declareSuperiorCover(a, input()), /Refresh/);
});
test("concurrent declarations accept one durable tradeoff without spending dice or stacking; a lost commit response proves the recorded result", async () => {
  const a = actor(),
    results = await Promise.allSettled([declareSuperiorCover(a, input()), declareSuperiorCover(a, input())]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(Object.keys(a.flags.spycraft2.superiorCoverDeclarations).length, 1);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(superiorCoverState(a.system).penalty, 2);
  let b = actor();
  b.fail = "after";
  await declareSuperiorCover(b, input());
  assert.equal(Object.keys(b.flags.spycraft2.superiorCoverDeclarations).length, 1);
  b = actor();
  b.fail = "before";
  await assert.rejects(declareSuperiorCover(b, input()), /before write/);
  assert.equal(b.system.superiorCover, null);
});
test("actual current-cover review changes DR, losing all cover cannot restore it off Count, and a fresh own-Count declaration has no invented per-round use limit", async () => {
  const a = actor();
  const first = await declareSuperiorCover(a, input());
  await reviewSuperiorCover(a, { ...input(), personalCover: 0, sceneryCover: 1 });
  assert.equal(superiorCoverState(a.system).dr, 1);
  await reviewSuperiorCover(a, { ...input(), personalCover: 0, sceneryCover: 0 });
  assert.equal(superiorCoverState(a.system).dr, 0);
  assert.equal(superiorCoverState(a.system).penalty, 2);
  assert.equal(a.flags.spycraft2.superiorCoverDeclarations[first.id].reflexBonus, 3);
  assert.equal(Object.keys(a.flags.spycraft2.superiorCoverReviews).length, 2);
  await assert.rejects(reviewSuperiorCover(a, input()), /Losing cover/);
  a.participatingCombat.turn = 0;
  await assert.rejects(declareSuperiorCover(a, input()), /Initiative/);
  a.participatingCombat.turn = 1;
  await declareSuperiorCover(a, input());
  assert.equal(superiorCoverState(a.system).dr, 3);
  assert.equal(superiorCoverState(a.system).penalty, 2);
});
test("malformed saved declarations require review before actual attack/skill/Knowledge rolls, while unrelated saves remain independent", async () => {
  globalThis.Actor = class {};
  const { SpycraftActor } = await import("../module/documents/actor.mjs");
  for (const patch of [{ reflexBonus: 99 }, { coverLost: "false" }, { dueRound: 9 }, { personalCover: 7 }]) {
    const system = { ...source(), superiorCover: { ...record(), ...patch } };
    assert.equal(superiorCoverState(system).needsReview, true);
    for (const checkKind of ["attack", "skill", "knowledge"])
      await assert.rejects(
        SpycraftActor.prototype.rollCheck.call({ system }, "1d20", {}, { checkKind }),
        /Superior Cover/
      );
  }
});
test("pure cover review never extends the accepted duration and stale dialog changes cannot write a new cover audit", async () => {
  const r = record(),
    review = superiorCoverReviewPlan(
      { ...source(), superiorCover: r },
      { ...input(), personalCover: 4, sceneryCover: 4 }
    );
  assert.equal(review.startRound, r.startRound);
  assert.equal(review.dueRound, r.dueRound);
  assert.equal(review.reflexBonus, 4);
  const a = actor();
  await declareSuperiorCover(a, input());
  dialog = async () => {
    a.participatingCombat.turn = 2;
    return input();
  };
  await assert.rejects(reviewSuperiorCover(a), /changed/);
  assert.equal(a.flags.spycraft2.superiorCoverReviews, undefined);
});

test("native-style nested merges do not confuse record key order and explicitly clear a removed terrain-cover proof", async () => {
  const a = actor();
  a.system.activeFeatNames = ["Superior Cover", "Home Turf", "Aquatic Training"];
  const merge = (target, data) => {
    for (const [k, v] of Object.entries(data)) {
      if (k.startsWith("-=")) {
        delete target[k.slice(2)];
        continue;
      }
      if (v && typeof v === "object" && !Array.isArray(v)) {
        if (!target[k] || typeof target[k] !== "object") target[k] = {};
        merge(target[k], v);
      } else target[k] = structuredClone(v);
    }
  };
  a.update = async patch => {
    for (const [path, value] of Object.entries(patch)) {
      const keys = path.split(".");
      let object = a;
      for (const k of keys.slice(0, -1)) object = object[k] ??= {};
      merge(object, { [keys.at(-1)]: value });
    }
  };
  const terrain = {
    ...input(),
    personalCover: 0,
    sceneryCover: 1,
    homeTurfCover: true,
    homeTurfCoverSource: "scenery",
    partialSubmersionCover: true,
    terrainCoverConfirmed: true
  };
  await declareSuperiorCover(a, terrain);
  assert.equal(superiorCoverState(a.system).dr, 3);
  await reviewSuperiorCover(a, { ...terrain, note: "Same raw grades" });
  assert.equal(superiorCoverState(a.system).dr, 3);
  assert.equal(a.system.superiorCover.terrainCover.context.sceneryCover, 1);
  await reviewSuperiorCover(a, { ...input(), personalCover: 0, sceneryCover: 1 });
  assert.equal(Object.hasOwn(a.system.superiorCover, "terrainCover"), false);
  assert.equal(superiorCoverState(a.system).dr, 1);
  assert.equal(superiorCoverState(a.system).needsReview, false);
  await declareSuperiorCover(a, terrain);
  await declareSuperiorCover(a, { ...input(), personalCover: 0, sceneryCover: 1 });
  assert.equal(Object.hasOwn(a.system.superiorCover, "terrainCover"), false);
  assert.equal(superiorCoverState(a.system).dr, 1);
});
