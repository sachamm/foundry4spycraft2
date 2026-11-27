import test from "node:test";
import assert from "node:assert/strict";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { dispositionSkillPlan as plan, hasDispositionCheck } from "../module/rules/disposition-skills.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { campaignEffects, activeQualities } from "../module/rules/gc/campaign.mjs";
import { rollNpcSkill } from "../module/apps/gc/npc-play.mjs";
import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
import {
  dispositionSkillContext,
  dispositionTargetCandidates,
  validateDispositionSkillProof
} from "../module/apps/target-skill-effects.mjs";
const state = () => ({
  activeFeatNames: [],
  abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 12, mod: 1 }])),
  skillTotals: Object.fromEntries(
    Object.entries(cfg.skills).map(([key, s]) => [
      key,
      {
        name: s.name,
        ranks: 5,
        cap: 30,
        threat: 20,
        totals: s.abilities.map(ability => ({ ability, total: 8, normalSkillBonus: 8 }))
      }
    ])
  )
});
test("settlement evidence binds disposition and campaign skill facts and cannot fall back to older evidence without them", () => {
  const base = { checkKind: "skill", rawTotal: 20, effectiveTotal: 20, naturalDie: 10, error: 1, threat: 20, cap: 30 };
  for (const field of ["dispositionSkill", "campaignSkillChecks", "skillTiming"]) {
    const c = { ...base, [field]: { version: 1, skillKey: "impress", modifier: 2 } },
      evidence = rollEvidence(c);
    assert.equal(rollEvidenceMatches(evidence, c), true);
    assert.equal(rollEvidenceMatches(evidence, { ...c, [field]: { ...c[field], modifier: 999 } }), false);
    assert.equal(rollEvidenceMatches(rollEvidence(base), c), false);
  }
});

function npcContext() {
  globalThis.CONFIG = { SPYCRAFT: cfg };
  const actor = {
      id: "acting",
      uuid: "Actor.acting",
      name: "Acting NPC",
      type: "npc",
      isOwner: true,
      system: {
        ...state(),
        npcType: "special",
        competence: 5,
        npcProfile: { enabled: true },
        campaignEffects: campaignEffects(activeQualities(["diplomatic"])).effects
      },
      rollCheck: async (_f, data, options) => ({ data, options })
    },
    npc = {
      id: "target",
      uuid: "Actor.target",
      name: "Target NPC",
      type: "npc",
      isOwner: true,
      system: { npcType: "special", disposition: { base: "adversarial", toward: { acting: { grade: "friendly" } } } },
      flags: {}
    };
  globalThis.game = { user: { id: "gc", isGM: true }, actors: [actor, npc] };
  return { actor, npc };
}
test("actual NPC named checks apply target disposition and role-scoped Diplomatic with saved ranges and identity", async () => {
  const { actor, npc } = npcContext(),
    input = {
      key: "impress/persuasion",
      ability: "cha",
      dispositionTargetUuid: npc.uuid,
      dispositionTargetConfirmed: true
    };
  let r = await rollNpcSkill(actor, input);
  assert.equal(r.data.total, 9);
  assert.equal(r.options.checkId, "persuasion");
  assert.equal(r.options.threat, 19);
  assert.equal(r.options.error, 1);
  assert.equal(r.options.dispositionSkill.actingActorId, actor.id);
  r.options.validateSkillContext();
  actor.system.npcType = "standard";
  r = await rollNpcSkill(actor, input);
  assert.equal(r.data.total, 8);
  assert.equal(r.options.dispositionSkill.diplomatic, 0);
  npc.system.disposition.toward.acting.grade = "helpful";
  r = await rollNpcSkill(actor, { ...input, key: "impress/influence" });
  assert.equal(r.data.total, -2);
  assert.equal(r.options.error, 4);
  assert.equal(r.options.dispositionSkill.priority, 0.25);
  await assert.rejects(rollNpcSkill(actor, { ...input, key: "impress/invented" }), /valid named check/);
  await assert.rejects(rollNpcSkill(actor, { ...input, key: "impress" }), /unrelated skill use/);
});
function frozenContext(actor, npc) {
  game.combats = new Map([["combat", { id: "combat", started: true, combatants: [{ actor }] }]]);
  const binding = { id: "claim", npcUuid: npc.uuid, combatId: "combat", side: "team" };
  npc.flags.spycraft2 = {
    combatPersuasion: {
      combat: {
        version: 1,
        combatId: "combat",
        attempts: {
          team: {
            id: "claim",
            side: "team",
            actorUuid: actor.uuid,
            targetId: "group",
            state: "rolling",
            grade: "friendly"
          }
        }
      }
    }
  };
  return binding;
}
test("unlinked combat targets resolve to their actual actor and private scenes stay unread before target preparation", () => {
  const { actor, npc } = npcContext(),
    tokenActor = { ...npc, uuid: "Scene.scene.Token.token.Actor.target", isToken: true },
    scene = {
      id: "scene",
      active: true,
      testUserPermission: () => true,
      tokens: [{ actorLink: false, actor: tokenActor }]
    };
  tokenActor.token = { parent: scene };
  game.scenes = [scene];
  game.actors = [actor];
  const binding = frozenContext(actor, tokenActor);
  assert.ok(dispositionTargetCandidates("impress").some(a => a.uuid === tokenActor.uuid));
  const input = { combatPersuasion: binding };
  assert.equal(dispositionSkillContext(input, "impress", actor).dispositionTarget.actorUuid, tokenActor.uuid);
  game.combats.get("combat").combatants = [];
  assert.throws(() => dispositionSkillContext(input, "impress", actor), /reserved combat-persuasion/);
  game.user.isGM = false;
  scene.testUserPermission = () => false;
  Object.defineProperty(tokenActor, "system", {
    get() {
      throw Error("Private scene target read");
    }
  });
  assert.equal(
    dispositionTargetCandidates("impress").some(a => a.uuid === tokenActor.uuid),
    false
  );
  const prior = globalThis.fromUuidSync;
  globalThis.fromUuidSync = uuid => (uuid === tokenActor.uuid ? tokenActor : null);
  try {
    assert.throws(() => dispositionSkillContext(input, "impress", actor), /unavailable or private/);
  } finally {
    globalThis.fromUuidSync = prior;
  }
});
test("NPC named optional checks stay unavailable until their rule is enabled and are rechecked before posting", async () => {
  const { actor } = npcContext(),
    optional = Object.entries(cfg.skills).flatMap(([key, s]) =>
      s.checks.filter(c => c.optionalRule === "linguistics").map(c => ({ key, check: c }))
    )[0];
  assert.ok(optional);
  const input = { key: `${optional.key}/${optional.check.id}` };
  game.settings = { get: () => false };
  await assert.rejects(rollNpcSkill(actor, input), /valid named check/);
  game.settings.get = () => true;
  const r = await rollNpcSkill(actor, input);
  assert.equal(r.options.checkId, optional.check.id);
  game.settings.get = () => false;
  assert.throws(() => r.options.validateSkillContext(), /changed before posting/);
});
test("combat disposition uses its real reserved actor, group and frozen grade even after the NPC's live attitude changes", async () => {
  const { actor, npc } = npcContext(),
    binding = frozenContext(actor, npc);
  npc.system.disposition.toward.acting.grade = "adversarial";
  const r = await rollNpcSkill(actor, { key: "impress", ability: "cha" }, { combatPersuasion: binding });
  assert.equal(r.data.total, 9);
  assert.equal(r.options.dispositionSkill.grade, "friendly");
  assert.equal(r.options.dispositionSkill.combatPersuasion.targetId, "group");
  npc.system.disposition.toward.acting.grade = "helpful";
  r.options.validateSkillContext();
  validateDispositionSkillProof(r.options.dispositionSkill, {
    actor,
    checkKind: "skill",
    skillKey: "impress",
    checkId: "persuasion"
  });
  await assert.rejects(
    rollNpcSkill(actor, { key: "impress/influence", ability: "cha" }, { combatPersuasion: binding }),
    /valid named check/
  );
  npc.flags.spycraft2.combatPersuasion.combat.attempts.team.actorUuid = "Actor.other";
  assert.throws(() => r.options.validateSkillContext(), /reserved combat-persuasion/);
});
const check = (key, id) => cfg.skills[key].checks.find(c => c.id === id),
  target = grade => ({
    type: "npc",
    npcType: "special",
    actorUuid: "Actor.target",
    name: "QA target",
    actingActorId: "pc",
    actingActorUuid: "Actor.pc",
    confirmed: true,
    disposition: { base: "neutral", toward: { pc: { grade } } }
  }),
  opts = { synergySkill: "none", gearStatus: "available" };
test("printed disposition result/error/threat values apply to the actual intimacy/fondness check", () => {
  for (const [grade, intimacy, ie, fondness, fe, ft] of [
    ["helpful", -8, 3, 6, 0, 3],
    ["supportive", -6, 2, 4, 0, 2],
    ["friendly", -4, 1, 2, 0, 1],
    ["intrigued", -2, 0, 1, 0, 0],
    ["neutral", 0, 0, 0, 0, 0],
    ["aloof", -2, 0, -1, 0, 0],
    ["unfriendly", -4, 1, -2, 1, 0],
    ["hostile", -6, 2, -4, 2, 0],
    ["adversarial", -8, 3, -6, 3, 0]
  ]) {
    const a = plan(state(), "impress", check("impress", "influence"), target(grade)),
      b = plan(state(), "impress", check("impress", "persuasion"), target(grade));
    assert.equal(a.bonus + a.penalty, intimacy, grade);
    assert.equal(a.errorIncrease, ie, grade);
    assert.equal(b.bonus + b.penalty, fondness, grade);
    assert.equal(b.errorIncrease, fe, grade);
    assert.equal(b.threatIncrease, ft, grade);
  }
});
test("Diplomatic improves positive check bonuses only for player/special actors, including current promotions", () => {
  const effects = campaignEffects(activeQualities(["diplomatic"])).effects;
  for (const [npcType, extra] of [
    [undefined, 1],
    ["standard", 0],
    ["special", 1],
    ["villain", 1]
  ]) {
    const s = { ...state(), npcType, campaignEffects: effects };
    assert.equal(plan(s, "impress", check("impress", "persuasion"), target("friendly")).bonus, 2 + extra);
    assert.equal(plan(s, "impress", check("impress", "influence"), target("friendly")).penalty, -4);
    assert.equal(plan(s, "impress", check("impress", "persuasion"), target("aloof")).penalty, -1);
  }
});
test("the actual skill planner applies result, ranges, exact priority and rounding; unsupported timing combinations stay explicit", () => {
  const s = state(),
    c = check("impress", "persuasion"),
    base = resolveSkillCheck(s, "impress", c, opts),
    friendly = resolveSkillCheck(s, "impress", c, { ...opts, dispositionTarget: target("friendly") });
  assert.equal(friendly.total, base.total + 2);
  assert.equal(friendly.threat, base.threat - 1);
  assert.equal(friendly.timeMultiplier, 0.5);
  assert.equal(friendly.timeRounding, "up");
  const supportive = resolveSkillCheck(s, "impress", c, { ...opts, dispositionTarget: target("supportive") });
  assert.equal(supportive.timeMultiplier, 1 / 3);
  const taking = resolveSkillCheck(s, "impress", c, {
    ...opts,
    method: "take10",
    safeToTake: true,
    dispositionTarget: target("friendly")
  });
  assert.equal(taking.timeMultiplier, 1.5);
  assert.equal(taking.skillTiming.policy, "additive-one-reduction");
  assert.doesNotMatch(taking.blockedReason, /Disposition timing combined/);
  assert.ok(plan(s, "impress", c, { ...target("friendly"), confirmed: false }).blockedReason);
  assert.ok(plan(s, "impress", c, target("unknown")).blockedReason);
  assert.ok(plan(s, "athletics", check("athletics", "climb"), target("friendly")).blockedReason);
});
test("negative disposition modifiers remain check penalties under Baffled and Incompetent", () => {
  const c = check("impress", "influence");
  for (const [conditionContext, total] of [
    [{ baffled: true }, 0],
    [{ incompetent: true }, -4]
  ]) {
    const p = resolveSkillCheck({ ...state(), conditionContext }, "impress", c, {
      ...opts,
      dispositionTarget: target("friendly")
    });
    assert.equal(p.total, total);
  }
});
test("target access precedes private reads; invented target records are replaced and live proof detects changes", () => {
  globalThis.game = { user: { isGM: false }, actors: [] };
  const npc = {
    id: "target",
    uuid: "Actor.target",
    type: "npc",
    name: "QA target",
    isOwner: false,
    testUserPermission: () => false
  };
  Object.defineProperty(npc, "system", {
    get() {
      throw Error("Private read");
    },
    configurable: true
  });
  game.actors = [npc];
  assert.deepEqual(dispositionTargetCandidates("impress"), []);
  assert.throws(() => dispositionSkillContext({ dispositionTargetUuid: npc.uuid }, "impress", { id: "pc" }), /private/);
  Object.defineProperty(npc, "system", {
    value: { npcType: "special", disposition: target("friendly").disposition },
    writable: true,
    configurable: true
  });
  npc.isOwner = true;
  const actor = { id: "pc", uuid: "Actor.pc", system: state() },
    input = { dispositionTargetUuid: npc.uuid, dispositionTargetConfirmed: true, dispositionTarget: target("helpful") },
    context = dispositionSkillContext(input, "impress", actor),
    c = check("impress", "persuasion"),
    p = plan(actor.system, "impress", c, context.dispositionTarget),
    validation = { actor, checkKind: "skill", skillKey: "impress", checkId: "persuasion" };
  assert.equal(p.evidence.grade, "friendly");
  validateDispositionSkillProof(p.evidence, validation);
  npc.system.disposition.toward.pc.grade = "aloof";
  assert.throws(() => validateDispositionSkillProof(p.evidence, validation), /changed before posting/);
  assert.equal(hasDispositionCheck("impress"), true);
  assert.equal(hasDispositionCheck("athletics"), false);
  npc.system.manualRole = "minion";
  assert.deepEqual(dispositionTargetCandidates("impress"), []);
  assert.throws(() => dispositionSkillContext(input, "impress", actor), /separate scene effects/);
  npc.system.manualRole = "";
  npc.system.npcProfile = { enabled: true, qualities: [{ id: "henchman" }] };
  assert.deepEqual(dispositionTargetCandidates("impress"), []);
});

test("actual PC combat roll automatically binds the reserved NPC and frozen attitude without trusting a supplied target record", async () => {
  globalThis.Actor = class {
    constructor() {
      this.id = "pc";
      this.uuid = "Actor.pc";
      this.type = "agent";
      this.isOwner = true;
      this.items = [];
      this.system = state();
      this.system.campaignEffects = campaignEffects(activeQualities(["diplomatic"])).effects;
    }
  };
  globalThis.CONFIG = { SPYCRAFT: cfg };
  const { npc } = npcContext();
  globalThis.game.settings = { get: () => false };
  globalThis.game.i18n = { localize: String };
  globalThis.foundry = { utils: { escapeHTML: String } };
  globalThis.ui = { notifications: { warn: () => null } };
  const { SpycraftActor } = await import("../module/documents/actor.mjs"),
    actor = new SpycraftActor(),
    binding = frozenContext(actor, npc);
  game.actors = [actor, npc];
  actor.rollCheck = async (_f, data, options) => ({ data, options });
  const r = await actor.rollSkill("impress", "cha", {
    check: "persuasion",
    ...opts,
    combatPersuasion: binding,
    dispositionTarget: target("helpful")
  });
  assert.equal(r.data.total, 11);
  assert.equal(r.options.dispositionSkill.grade, "friendly");
  assert.equal(r.options.dispositionSkill.combatPersuasion.id, binding.id);
  npc.system.disposition.base = "hostile";
  r.options.validateSkillContext();
  npc.flags.spycraft2.combatPersuasion.combat.attempts.team.side = "different";
  assert.throws(() => r.options.validateSkillContext(), /reserved combat-persuasion/);
});
