import test from "node:test";
import assert from "node:assert/strict";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { combatExpertisePlan, combatExpertiseState } from "../module/rules/combat-expertise.mjs";
import { weaponAttack } from "../module/rules/gear.mjs";
import { skillConditionCheckPenalty } from "../module/rules/skill-conditions.mjs";
import { incomingDefensePlan } from "../module/rules/defense.mjs";
import { activateCombatExpertise } from "../module/apps/combat-expertise.mjs";
const context = () => ({ id: "combat", started: true, round: 2, turn: 1, combatantId: "own", ownTurnIndex: 1 });
const record = () => ({ combatId: "combat", combatantId: "own", startRound: 2, dueRound: 3, penalty: 3 });
const source = () => ({ activeFeatNames: ["Combat Expertise"], defense: { base: 7 }, combatExpertise: null });
function calculate({ penalty = 0, conditions = {}, combat = context() } = {}) {
  const cls = {
      id: "test",
      type: "class",
      name: "Test",
      system: {
        identifier: "test",
        skillPoints: 4,
        vitalityDie: 6,
        classSkills: [],
        table: [{ level: 1, bab: 1, defense: 7, fort: 0, ref: 0, will: 0 }]
      }
    },
    feat = { id: "expertise", type: "feat", name: "Combat Expertise", system: { granted: true, bonuses: [] } };
  return computeAgent(
    {
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 14 }])),
      progression: [{ classId: "test", vitality: 6, skills: {} }],
      skills: {},
      focuses: {},
      proficiencies: {},
      misc: {},
      conditionContext: conditions,
      expertiseCombatContext: combat,
      combatExpertise: penalty ? { ...record(), penalty } : null
    },
    [cls, feat],
    cfg
  );
}
test("Combat Expertise accepts exactly the base-Defense bounded whole-number tradeoff, capped at six, during own Count", () => {
  for (let base = 0; base <= 20; base++)
    for (let penalty = 0; penalty <= 8; penalty++) {
      const s = source();
      s.defense.base = base;
      const call = () => combatExpertisePlan(s, context(), { penalty, confirmed: true });
      if (penalty >= 1 && penalty <= Math.min(6, base)) assert.equal(call().penalty, penalty);
      else assert.throws(call);
    }
  for (const penalty of [1.5, "2", NaN, Infinity, null, true])
    assert.throws(() => combatExpertisePlan(source(), context(), { penalty, confirmed: true }));
  for (const patch of [{ started: false }, { turn: 0 }, { ownTurnIndex: -1 }, { round: 0 }, { combatantId: "" }])
    assert.throws(() => combatExpertisePlan(source(), { ...context(), ...patch }, { penalty: 1, confirmed: true }));
  assert.throws(
    () => combatExpertisePlan({ ...source(), activeFeatNames: [] }, context(), { penalty: 1, confirmed: true }),
    /earned/
  );
  assert.throws(() => combatExpertisePlan(source(), context(), { penalty: 1 }), /Confirm/);
});
test("the full round crosses the global round boundary and ends exactly at the next own Count without stacking or early cancellation", () => {
  for (const round of [1, 2, 3, 4])
    for (const turn of [0, 1, 2]) {
      const c = { ...context(), round, turn },
        s = { ...source(), combatExpertise: record(), expertiseCombatContext: c };
      assert.equal(combatExpertiseState(s).active, round === 2 || (round === 3 && turn < 1));
    }
  for (const patch of [{ id: "other" }, { combatantId: "other" }, { started: false }, { ownTurnIndex: -1 }])
    assert.equal(
      combatExpertiseState({
        ...source(),
        combatExpertise: record(),
        expertiseCombatContext: { ...context(), ...patch }
      }).active,
      false
    );
  assert.throws(
    () => combatExpertisePlan({ ...source(), combatExpertise: record() }, context(), { penalty: 1, confirmed: true }),
    /already active/
  );
  assert.equal(
    combatExpertisePlan(
      { ...source(), combatExpertise: record() },
      { ...context(), round: 3 },
      { penalty: 1, confirmed: true }
    ).dueRound,
    4
  );
});
test("every skill and weapon receives the penalty once; saves, damage, attributes and skill bonus condition transforms remain separate", () => {
  for (let penalty = 1; penalty <= 6; penalty++) {
    const normal = calculate(),
      s = calculate({ penalty });
    assert.equal(s.defense.total, normal.defense.total + penalty);
    assert.equal(s.defense.dodgeBonuses, penalty);
    for (const key of Object.keys(cfg.skills)) {
      assert.equal(s.skillTotals[key].total, normal.skillTotals[key].total - penalty, key);
      assert.equal(s.skillTotals[key].ranks, normal.skillTotals[key].ranks);
      assert.deepEqual(
        s.skillTotals[key].totals.map(t => t.skillBonus),
        normal.skillTotals[key].totals.map(t => t.skillBonus)
      );
    }
    for (const ability of ["str", "dex", "con", "int", "wis", "cha"])
      assert.equal(skillConditionCheckPenalty(s, ability), -penalty);
    for (const p of Object.keys(cfg.proficiencies)) {
      const w = { proficiency: p, damage: "1d6", sizeHands: "S/1h", range: p === "unarmed" || p === "edged" ? 0 : 100 };
      const a = weaponAttack(s, w, cfg),
        b = weaponAttack(normal, w, cfg);
      assert.equal(a.total, b.total - penalty, p);
    }
    assert.deepEqual(s.saves, normal.saves);
    assert.deepEqual(s.abilities, normal.abilities);
    assert.equal(s.bab, normal.bab);
    assert.equal(s.defense.base, normal.defense.base);
    assert.equal(s.conditionPenalties.damage, 0);
    assert.equal(s.conditionPenalties.save, 0);
    assert.equal(s.knowledge, normal.knowledge);
    assert.equal(skillConditionCheckPenalty(s, "int"), -penalty);
  }
  const normal = calculate({ conditions: { baffled: true } }),
    s = calculate({ penalty: 3, conditions: { baffled: true } });
  for (const key of Object.keys(cfg.skills))
    assert.equal(s.skillTotals[key].total, normal.skillTotals[key].total - 3, key);
});
test("vulnerability removes only the dodge benefit and retains the accepted attack and skill penalties", () => {
  for (const conditions of [
    { vulnerable: true },
    { blinded: true },
    { helpless: true },
    { flatFooted: true },
    { held: true }
  ]) {
    const normal = calculate({ conditions }),
      s = calculate({ conditions, penalty: 3 });
    assert.equal(s.defense.total, normal.defense.total);
    assert.equal(s.defense.dodgeLost, 3);
    assert.equal(s.attack.melee, normal.attack.melee - 3);
    assert.equal(s.skillTotals.notice.total, normal.skillTotals.notice.total - 3);
  }
  const s = calculate({ penalty: 3 });
  assert.equal(
    incomingDefensePlan(s, { flatFooted: true }).total,
    incomingDefensePlan(calculate(), { flatFooted: true }).total
  );
  assert.equal(
    incomingDefensePlan(s, { invisibleAttacker: true }).total,
    incomingDefensePlan(calculate(), { invisibleAttacker: true }).total
  );
});
let warnings = [],
  posts = [],
  inputFn = async () => null,
  postFail = false;
globalThis.game = { settings: { get: () => ({}) } };
globalThis.foundry = {
  utils: { randomID: () => "activation" },
  applications: { api: { DialogV2: { input: (...args) => inputFn(...args) } } }
};
globalThis.ui = { notifications: { warn: s => warnings.push(s) } };
globalThis.ChatMessage = {
  getSpeaker: () => ({}),
  create: async d => {
    if (postFail) throw Error("post failed");
    posts.push(d);
    return d;
  }
};
function actor() {
  warnings = [];
  posts = [];
  postFail = false;
  inputFn = async () => null;
  const a = {
    uuid: "Actor.expertise",
    type: "agent",
    isOwner: true,
    system: { ...source(), abilities: {}, conditionContext: {}, wounds: { value: 4 } },
    participatingCombat: { id: "combat", started: true, round: 2, turn: 1, turns: [] },
    async update(patch) {
      if (this.failBefore) throw Error("before write");
      this.system.combatExpertise = structuredClone(patch["system.combatExpertise"]);
      if (this.failAfter) throw Error("committed write");
      return this;
    }
  };
  a.participatingCombat.turns = [
    { id: "other", actor: { uuid: "Actor.other" } },
    { id: "own", actor: a }
  ];
  return a;
}
test("the actual declaration controller checks cancellation, stale Count, ownership, incapacities and Refresh before recording a free action", async () => {
  let a = actor();
  assert.equal(await activateCombatExpertise(a), null);
  assert.equal(a.system.combatExpertise, null);
  for (const cause of ["count", "role", "feat"]) {
    a = actor();
    inputFn = async () => {
      if (cause === "count") a.participatingCombat.turn = 0;
      if (cause === "role") a.isOwner = false;
      if (cause === "feat") a.system.activeFeatNames = [];
      return { penalty: 2, confirmed: true };
    };
    await assert.rejects(activateCombatExpertise(a));
    assert.equal(a.system.combatExpertise, null);
  }
  for (const key of ["stunned", "dazed", "unconscious", "dead", "sleeping", "paralyzed"]) {
    a = actor();
    a.system.conditionContext[key] = true;
    await assert.rejects(activateCombatExpertise(a, { penalty: 2, confirmed: true }), key);
    assert.equal(a.system.combatExpertise, null);
  }
  a = actor();
  a.system.refreshAction = { state: "waiting", combatId: "combat", startRound: 2 };
  await assert.rejects(activateCombatExpertise(a, { penalty: 2, confirmed: true }), /Refresh/);
  assert.equal(posts.length, 0);
});
test("one queued activation records one full-round tradeoff; committed writes and chat failures cannot erase or stack it", async () => {
  for (const failure of ["none", "after", "post"]) {
    const a = actor();
    a.failAfter = failure === "after";
    postFail = failure === "post";
    const r = await activateCombatExpertise(a, { penalty: 2, confirmed: true });
    assert.equal(r.penalty, 2);
    assert.equal(a.system.combatExpertise.id, r.id);
    await assert.rejects(activateCombatExpertise(a, { penalty: 1, confirmed: true }), /already active/);
    assert.equal(a.system.combatExpertise.penalty, 2);
    if (failure === "post") assert.equal(warnings.length, 1);
    else assert.equal(posts[0].flags.spycraft2.combatExpertise.penalty, 2);
  }
  const a = actor();
  a.failBefore = true;
  await assert.rejects(activateCombatExpertise(a, { penalty: 2, confirmed: true }), /before write/);
  assert.equal(a.system.combatExpertise, null);
});

test("actual named skill uses and Knowledge apply the accepted penalty after Baffled/Incompetent transformations", async () => {
  const { resolveKnowledgeCheck } = await import("../module/rules/knowledge.mjs"),
    { resolveSkillCheck } = await import("../module/rules/skills.mjs");
  for (const conditions of [{}, { baffled: true }, { incompetent: true }]) {
    const normal = calculate({ conditions }),
      s = calculate({ conditions, penalty: 3 });
    for (const [key, skill] of Object.entries(cfg.skills))
      for (const check of skill.checks ?? []) {
        const a = resolveSkillCheck(normal, key, check, {}),
          b = resolveSkillCheck(s, key, check, {});
        assert.equal(b.total, a.total - 3, key + "/" + check.id);
        assert.match(b.notes, /Combat Expertise/);
      }
    const a = resolveKnowledgeCheck(normal, { skill: "search" }),
      b = resolveKnowledgeCheck(s, { skill: "search" });
    assert.equal(b.total, a.total - 3);
    assert.match(b.notes, /Combat Expertise/);
  }
});
