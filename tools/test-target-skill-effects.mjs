import test from "node:test";
import assert from "node:assert/strict";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import {
  targetSkillEffectPlan,
  targetSkillEffectApplicable,
  targetSkillTimingPlan
} from "../module/rules/target-skill-effects.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { resolveKnowledgeCheck } from "../module/rules/knowledge.mjs";
import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
import {
  targetSkillContext,
  targetSkillEffectCandidates,
  targetSkillEffectContent,
  validateTargetSkillEffectProof
} from "../module/apps/target-skill-effects.mjs";
const state = () => ({
    activeFeatNames: [],
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 12, mod: 1 }])),
    skillTotals: Object.fromEntries(
      Object.entries(cfg.skills).map(([key, s]) => [
        key,
        {
          name: s.name,
          ranks: 4,
          cap: 50,
          threat: 20,
          totals: s.abilities.map(ability => ({ ability, total: 5 })),
          bonusEntries: []
        }
      ])
    ),
    conditionContext: {},
    focusTotals: {},
    knowledge: 3
  }),
  silver = () => ({ activeFeatNames: ["Silver Tongue"], abilities: { cha: { mod: 3 } } }),
  zeroed = () => ({
    activeFeatNames: ["Zeroed"],
    activeFeatSelections: ["Faceless", "Traceless", "Zeroed"].map(name => ({ name, tree: "covert", choice: "" }))
  }),
  input = targetSkillSystem => ({
    targetSkillSystem,
    targetSkillActorUuid: "Actor.target",
    targetSkillActorName: "Target",
    targetSkillConfirmed: true,
    gearStatus: "available",
    synergySkill: "none"
  }),
  sm = cfg.skills.senseMotive.checks[0],
  appraise = cfg.skills.analysis.checks.find(c => c.id === "appraise");
test("Silver Tongue and Zeroed error sources match every named use of their exact skills without changing other math", () => {
  for (const [target, keys] of [
    [silver(), ["senseMotive"]],
    [zeroed(), ["analysis", "investigation"]]
  ])
    for (const [key, skill] of Object.entries(cfg.skills))
      for (const c of skill.checks) {
        const s = state(),
          b = resolveSkillCheck(s, key, c, { gearStatus: "available", synergySkill: "none" }),
          r = resolveSkillCheck(s, key, c, input(target)),
          eligible = keys.includes(key);
        assert.equal(r.error, b.error + (eligible ? 3 : 0), key + "/" + c.id);
        assert.equal(r.total, b.total);
        assert.equal(r.cap, b.cap);
        assert.equal(r.threat, b.threat);
        assert.equal(r.timeMultiplier, b.timeMultiplier);
        assert.equal(!!r.targetSkillEffect, eligible);
        assert.equal(targetSkillEffectApplicable(target, key), eligible);
      }
});
test("opposing error increases apply before own skill error reductions and floors instead of being added after reductions", () => {
  const s = state();
  s.skillTotals.senseMotive.errorReduction = 2;
  s.skillTotals.senseMotive.errorFloor = 1;
  const r = resolveSkillCheck(s, "senseMotive", sm, input(silver())),
    b = resolveSkillCheck(s, "senseMotive", sm, { gearStatus: "available", synergySkill: "none" });
  assert.equal(b.error, 1);
  assert.equal(r.error, 2);
  s.skillTotals.senseMotive.errorReductionZero = 2;
  assert.equal(resolveSkillCheck(s, "senseMotive", sm, input(silver())).error, 0);
});
test("Silver Tongue uses the target’s signed exact Charisma modifier and rejects malformed values without inventing a positive-only restriction", () => {
  for (const mod of [-3, 0, 1, 3, 8]) {
    const target = silver();
    target.abilities.cha.mod = mod;
    const p = targetSkillEffectPlan(target, "senseMotive", sm, {
      actorUuid: "Actor.target",
      actorName: "Target",
      confirmed: true
    });
    assert.equal(p.errorIncrease, mod);
    assert.equal(resolveSkillCheck(state(), "senseMotive", sm, input(target)).error, Math.max(0, 1 + mod));
  }
  for (const mod of [undefined, NaN, Infinity, "3", 1.5]) {
    const target = silver();
    target.abilities.cha.mod = mod;
    assert.ok(
      targetSkillEffectPlan(target, "senseMotive", sm, {
        actorUuid: "Actor.target",
        actorName: "Target",
        confirmed: true
      }).blockedReason
    );
  }
});
test("Zeroed counts current Covert selections including itself, excludes other trees, and freezes a stable list without duplicate active-name inflation", () => {
  for (let count = 1; count <= 30; count++) {
    const target = zeroed();
    target.activeFeatNames.push("Zeroed");
    target.activeFeatSelections = [
      { name: "Zeroed", tree: "covert" },
      ...Array.from({ length: count - 1 }, (_, i) => ({ name: "Covert" + i, tree: "covert" })),
      { name: "Other", tree: "style" }
    ];
    const p = targetSkillEffectPlan(target, "analysis", appraise, {
      actorUuid: "Actor.target",
      actorName: "Target",
      confirmed: true
    });
    assert.equal(p.errorIncrease, count);
    assert.equal(p.evidence.sources[0].covertFeats.length, count);
  }
  for (const selections of [
    [],
    [{ name: "Other", tree: "covert" }],
    [{ name: "Zeroed", tree: "style" }],
    [{ name: "Zeroed", tree: "covert", choice: {} }]
  ])
    assert.ok(
      targetSkillEffectPlan({ ...zeroed(), activeFeatSelections: selections }, "analysis", appraise, {
        actorUuid: "Actor.target",
        actorName: "Target",
        confirmed: true
      }).blockedReason
    );
});
test("an actual named target and strict GC confirmation are required, while no target leaves ordinary checks unchanged", () => {
  const options = { actorUuid: "Actor.target", actorName: "Target", confirmed: true };
  for (const patch of [
    { actorUuid: {} },
    { actorUuid: "Item.other" },
    { actorName: "" },
    { confirmed: false },
    { confirmed: "true" }
  ])
    assert.ok(targetSkillEffectPlan(silver(), "senseMotive", sm, { ...options, ...patch }).blockedReason);
  assert.equal(targetSkillEffectPlan(silver(), "senseMotive", sm).evidence, null);
  assert.ok(targetSkillEffectPlan({}, "senseMotive", sm, options).blockedReason);
});
test("fixed results retain normal opposing-error restrictions and no source leaks into related Knowledge", () => {
  const s = state();
  for (const method of ["take10", "take20"]) {
    const p = resolveSkillCheck(s, "analysis", appraise, { ...input(zeroed()), method, safeToTake: true });
    if (method === "take10") assert.equal(p.blocked, true);
    assert.equal(p.error, 0);
    assert.equal(p.actionDiceAllowed, false);
  }
  for (const skill of Object.keys(cfg.skills))
    assert.equal(
      resolveKnowledgeCheck(s, { skill, ...input(zeroed()) }).total,
      resolveKnowledgeCheck(s, { skill }).total
    );
});
globalThis.Actor = class {
  constructor() {
    this.system = state();
    this.items = [];
    this.type = "agent";
    this.uuid = "Actor.performer";
    this.isOwner = true;
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = {
  user: { id: "gc", isGM: true },
  settings: { get: () => false },
  i18n: { localize: String },
  actors: []
};
globalThis.foundry = { utils: { escapeHTML: String } };
globalThis.ui = { notifications: { warn: () => null } };
const { SpycraftActor } = await import("../module/documents/actor.mjs");
function target(system = silver()) {
  const a = { id: "target", uuid: "Actor.target", name: "Target", type: "agent", isOwner: true, system };
  game.actors = new Map([[a.id, a]]);
  game.user.isGM = true;
  return a;
}
test("target candidate controls and proof access honor Owner/GC/Observer permission and never read an inaccessible private system", () => {
  const a = target();
  game.user.isGM = false;
  a.isOwner = false;
  a.testUserPermission = () => false;
  Object.defineProperty(a, "system", {
    get() {
      throw Error("Private source read");
    },
    configurable: true
  });
  assert.equal(targetSkillEffectCandidates("senseMotive").length, 0);
  assert.throws(() => targetSkillContext({ targetSkillActorUuid: a.uuid }, "senseMotive"), /cannot be read/);
  Object.defineProperty(a, "system", { value: silver(), writable: true, configurable: true });
  a.testUserPermission = (_u, p) => p === "OBSERVER";
  assert.equal(targetSkillEffectCandidates("senseMotive").length, 1);
  assert.ok(targetSkillEffectContent("senseMotive").includes(a.uuid));
  assert.equal(targetSkillEffectContent("drive"), "");
  game.user.isGM = true;
});
test("actual actor entry overwrites invented target payloads, records the real source, and rechecks target qualification/stat/permission changes", async () => {
  const t = target(),
    a = new SpycraftActor();
  a.rollCheck = async (f, data, options) => ({ data, options });
  const request = {
      check: sm.id,
      targetSkillActorUuid: t.uuid,
      targetSkillConfirmed: true,
      targetSkillSystem: { ...silver(), abilities: { cha: { mod: 999 } } },
      gearStatus: "available",
      synergySkill: "none"
    },
    r = await a.rollSkill("senseMotive", null, request);
  assert.equal(r.options.error, 4);
  assert.equal(r.options.targetSkillEffect.sources[0].charismaModifier, 3);
  r.options.validateSkillContext();
  t.system.abilities.cha.mod = 4;
  assert.throws(() => r.options.validateSkillContext(), /changed/);
  t.system = silver();
  t.system.activeFeatNames = [];
  assert.throws(() => r.options.validateSkillContext(), /source|changed/);
  t.system = silver();
  game.user.isGM = false;
  t.isOwner = false;
  t.testUserPermission = () => false;
  assert.throws(() => r.options.validateSkillContext(), /cannot be read/);
  game.user.isGM = true;
});
test("caller-supplied target data without an actual selection cannot manufacture an opposing modifier", async () => {
  target();
  const a = new SpycraftActor();
  a.rollCheck = async (f, data, options) => options;
  const r = await a.rollSkill("senseMotive", null, {
    check: sm.id,
    targetSkillSystem: silver(),
    targetSkillActorName: "Invented",
    targetSkillConfirmed: true,
    gearStatus: "available",
    synergySkill: "none"
  });
  assert.equal(r.error, 1);
  assert.equal(r.targetSkillEffect, null);
});
test("replacement validation binds exact real target, check/source/count and permission while unchanged legacy receipts remain valid", () => {
  const t = target(zeroed()),
    context = targetSkillContext({ targetSkillActorUuid: t.uuid, targetSkillConfirmed: true }, "analysis"),
    proof = targetSkillEffectPlan(context.targetSkillSystem, "analysis", appraise, {
      actorUuid: t.uuid,
      actorName: t.name,
      confirmed: true
    }).evidence,
    c = { checkKind: "skill", skillKey: "analysis", checkId: appraise.id, targetSkillEffect: proof },
    e = rollEvidence(c);
  validateTargetSkillEffectProof(proof, c);
  for (const patch of [{ checkKind: "knowledge" }, { skillKey: "bluff" }, { checkId: "other" }])
    assert.throws(() => validateTargetSkillEffectProof(proof, { ...c, ...patch }));
  for (const field of ["targetActorUuid", "targetName", "targetConfirmed", "sources", "errorIncrease", "version"]) {
    const n = structuredClone(c);
    n.targetSkillEffect[field] = "changed";
    assert.equal(rollEvidenceMatches(e, n), false);
  }
  assert.equal(rollEvidenceMatches(rollEvidence({ ...c, targetSkillEffect: null }), c), false);
  t.system.activeFeatSelections.push({ name: "New Covert", tree: "covert" });
  assert.throws(() => validateTargetSkillEffectProof(proof, c), /changed/);
  validateTargetSkillEffectProof(null, c);
});

const faceless = () => ({ activeFeatNames: ["Faceless"] });
test("Faceless requires an exact declared information purpose and triples standard rolled skill time without changing check math", () => {
  for (const [key, skill] of Object.entries(cfg.skills))
    for (const c of skill.checks) {
      const s = state(),
        b = resolveSkillCheck(s, key, c, { gearStatus: "available", synergySkill: "none" });
      for (const purpose of ["past", "location", "intentions", "motives"]) {
        const r = resolveSkillCheck(s, key, c, { ...input(faceless()), targetSkillPurpose: purpose });
        assert.equal(r.timeMultiplier, 3, key + "/" + c.id);
        assert.equal(r.minimumTimeSeconds, b.minimumTimeSeconds);
        assert.equal(r.error, b.error);
        assert.equal(r.total, b.total);
        assert.equal(r.cap, b.cap);
        assert.equal(r.targetSkillEffect.purpose, purpose);
        assert.equal(r.targetSkillEffect.sources[0].source, "Faceless");
        if (c.tags.includes("Complex")) assert.match(r.blockedReason, /entire Complex Task/);
      }
    }
});
test("Faceless never infers research from a skill name or applies without its actual source, named target and strict confirmation", () => {
  const o = { actorUuid: "Actor.target", actorName: "Target", confirmed: true, purpose: "past" };
  for (const purpose of ["unknown", {}, true, 1])
    assert.ok(targetSkillEffectPlan(faceless(), "investigation", appraise, { ...o, purpose }).blockedReason);
  assert.ok(targetSkillEffectPlan(faceless(), "investigation", appraise, { ...o, purpose: "" }).blockedReason);
  assert.ok(targetSkillEffectPlan(silver(), "senseMotive", sm, o).blockedReason);
  assert.ok(targetSkillEffectPlan(faceless(), "investigation", appraise, { ...o, confirmed: "true" }).blockedReason);
  assert.equal(targetSkillEffectPlan(faceless(), "investigation", appraise, { purpose: "past" }).evidence, null);
  const t = { ...zeroed(), activeFeatNames: ["Faceless", "Zeroed"] };
  const b = targetSkillEffectPlan(t, "analysis", appraise, { ...o, purpose: "" }),
    r = targetSkillEffectPlan(t, "analysis", appraise, o);
  assert.equal(b.timeMultiplier, 1);
  assert.equal(b.evidence.purpose, undefined);
  assert.equal(r.errorIncrease, 3);
  assert.equal(r.timeMultiplier, 3);
  assert.equal(r.evidence.sources.length, 2);
});
test("Faceless ordinary timing is idempotent and combined timing is explicitly blocked while the multiplier ruling is pending", () => {
  const timing = { timeMultiplier: 1, minimumTimeSeconds: 0, timeReduction: "none", timeRounding: null, notes: "" },
    target = { timeMultiplier: 3 };
  const r = targetSkillTimingPlan(timing, target);
  assert.equal(r.timeMultiplier, 3);
  assert.equal(timing.timeMultiplier, 1);
  assert.deepEqual(targetSkillTimingPlan(timing, target), r);
  for (const patch of [
    { timeMultiplier: 2 },
    { timeMultiplier: 20 },
    { timeMultiplier: 0.5 },
    { minimumTimeSeconds: 6 },
    { timeReduction: "class" },
    { timeRounding: "up" }
  ])
    assert.match(targetSkillTimingPlan({ ...timing, ...patch }, target).blockedReason, /pending GC multiplier ruling/);
  const unchanged = targetSkillTimingPlan({ ...timing, timeMultiplier: 20 }, { timeMultiplier: 1 });
  assert.equal(unchanged.timeMultiplier, 20);
  assert.equal(unchanged.blockedReason, "");
});
test("Faceless purpose enters actual skill calls, replacement evidence and current source guards without changing old error-only proofs", async () => {
  const t = target(faceless()),
    a = new SpycraftActor();
  a.rollCheck = async (f, data, options) => ({ data, options });
  const c = cfg.skills.investigation.checks[0],
    o = {
      check: c.id,
      targetSkillActorUuid: t.uuid,
      targetSkillConfirmed: true,
      targetSkillPurpose: "location",
      gearStatus: "available",
      synergySkill: "none"
    },
    r = await a.rollSkill("investigation", null, o);
  assert.equal(r.options.targetSkillEffect.purpose, "location");
  assert.equal(r.options.targetSkillEffect.timeMultiplier, 3);
  assert.match(r.options.flavor, /Faceless triples/);
  r.options.validateSkillContext();
  validateTargetSkillEffectProof(r.options.targetSkillEffect, {
    checkKind: "skill",
    skillKey: "investigation",
    checkId: c.id
  });
  for (const field of ["purpose", "timeMultiplier"]) {
    const check = { checkKind: "skill", targetSkillEffect: r.options.targetSkillEffect },
      e = rollEvidence(check),
      changed = structuredClone(check);
    changed.targetSkillEffect[field] = "changed";
    assert.equal(rollEvidenceMatches(e, changed), false);
  }
  t.system.activeFeatNames = [];
  assert.throws(() => r.options.validateSkillContext(), /source|changed/);
  t.system = faceless();
  const blank = await a.rollSkill("investigation", null, {
    check: c.id,
    targetSkillSystem: faceless(),
    targetSkillPurpose: "past",
    gearStatus: "available",
    synergySkill: "none"
  });
  assert.equal(blank.options.targetSkillEffect, null);
  const st = target(silver()),
    context = targetSkillContext({ targetSkillActorUuid: st.uuid, targetSkillConfirmed: true }, "senseMotive"),
    old = targetSkillEffectPlan(context.targetSkillSystem, "senseMotive", sm, {
      actorUuid: st.uuid,
      actorName: st.name,
      confirmed: true
    }).evidence;
  assert.equal(Object.hasOwn(old, "purpose"), false);
  assert.equal(Object.hasOwn(old, "timeMultiplier"), false);
  validateTargetSkillEffectProof(old, { checkKind: "skill", skillKey: "senseMotive", checkId: sm.id });
});
test("Faceless cannot claim entire task or conflict timing through a standalone check and cannot leak into Knowledge", () => {
  const s = state(),
    c = cfg.skills.investigation.checks[0];
  for (const context of [{ inComplexTask: true }, { inDramaticConflict: true }, { seductionConflict: true }])
    assert.match(
      resolveSkillCheck(s, "investigation", c, { ...input(faceless()), targetSkillPurpose: "past", ...context })
        .blockedReason,
      /entire Complex Task/
    );
  for (const skill of Object.keys(cfg.skills))
    assert.equal(
      resolveKnowledgeCheck(s, { skill, ...input(faceless()), targetSkillPurpose: "past" }).total,
      resolveKnowledgeCheck(s, { skill }).total
    );
});

test("deferred skill-point spending retains the actual selected target on the post-allocation recalculation", async () => {
  const t = target(faceless()),
    a = new SpycraftActor();
  let spent = 0,
    rolled = 0;
  a.spendDeferredSkillPoints = async () => {
    spent++;
    return { spent: 1 };
  };
  a.rollCheck = async (_f, _d, o) => {
    rolled++;
    return o;
  };
  const c = cfg.skills.investigation.checks[0],
    r = await a.rollSkill("investigation", null, {
      check: c.id,
      iCanSwim: true,
      targetSkillActorUuid: t.uuid,
      targetSkillConfirmed: true,
      targetSkillPurpose: "past",
      gearStatus: "available",
      synergySkill: "none"
    });
  assert.equal(spent, 1);
  assert.equal(rolled, 1);
  assert.equal(r.targetSkillEffect.purpose, "past");
  r.validateSkillContext();
});
