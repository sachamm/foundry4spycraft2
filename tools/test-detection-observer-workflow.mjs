import test from "node:test";
import assert from "node:assert/strict";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { resolveKnowledgeCheck } from "../module/rules/knowledge.mjs";
import { detectionObserverPlan } from "../module/rules/detection-observer.mjs";
import {
  detectionObserverCandidates,
  detectionObserverContext,
  detectionObserverContent,
  validateDetectionObserverProof
} from "../module/apps/detection-observer.mjs";
import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
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
          totals: s.abilities.map(ability => ({ ability, total: 10 })),
          bonusEntries: []
        }
      ])
    ),
    conditionContext: {},
    focusTotals: {},
    knowledge: 3
  }),
  options = (system = {}, severity = "minor") => ({
    gearStatus: "available",
    synergySkill: "none",
    detectionDistraction: severity,
    detectionTargetSystem: system,
    detectionActorUuid: "Actor.target",
    detectionActorName: "Target",
    detectionConfirmed: true
  }),
  plain = { gearStatus: "available", synergySkill: "none" },
  scopes = [
    ["notice", "awareness"],
    ["search", "perception"]
  ];
test("each actual detection scope applies normal grades and Ghost extra as check adjustments, preserving cap/threat/timing and other skill/Knowledge math", () => {
  for (const ghost of [false, true])
    for (const [severity, penalty, increase] of [
      ["minor", -2, 0],
      ["moderate", -4, 1],
      ["major", -8, 3]
    ])
      for (const [key, skill] of Object.entries(cfg.skills))
        for (const c of skill.checks) {
          const s = state(),
            b = resolveSkillCheck(s, key, c, plain),
            r = resolveSkillCheck(s, key, c, options({ activeFeatNames: ghost ? ["Ghost Mastery"] : [] }, severity)),
            eligible = scopes.some(([k, id]) => key === k && c.id === id);
          assert.equal(r.total - b.total, eligible ? penalty - (ghost ? 4 : 0) : 0, key + "/" + c.id);
          assert.equal(r.error - b.error, eligible ? increase : 0);
          assert.equal(r.cap, b.cap);
          assert.equal(r.threat, b.threat);
          assert.equal(r.timeMultiplier, b.timeMultiplier);
          assert.equal(!!r.detectionObserver, eligible);
        }
  for (const skill of Object.keys(cfg.skills))
    assert.equal(
      resolveKnowledgeCheck(state(), { skill, ...options({ activeFeatNames: ["Ghost Mastery"] }) }).total,
      resolveKnowledgeCheck(state(), { skill }).total
    );
});
test("distraction penalties survive Baffled/Incompetent and their separate errors precede ordinary reductions; actual distraction forbids fixed methods even when safety is declared", () => {
  for (const condition of [{}, { baffled: true }, { incompetent: true }]) {
    const s = state();
    s.conditionContext = condition;
    const c = cfg.skills.notice.checks[0],
      b = resolveSkillCheck(s, "notice", c, plain),
      r = resolveSkillCheck(s, "notice", c, options({ activeFeatNames: ["Ghost Mastery"] }));
    assert.equal(r.total - b.total, -6);
    assert.equal(r.normalSkillBonus, b.normalSkillBonus);
  }
  const s = state(),
    c = cfg.skills.notice.checks[0];
  s.skillTotals.notice.errorReduction = 1;
  assert.equal(resolveSkillCheck(s, "notice", c, options({}, "moderate")).error, 1);
  s.skillTotals.notice.errorReductionZero = 1;
  assert.equal(resolveSkillCheck(s, "notice", c, options({}, "moderate")).error, 0);
  for (const method of ["take10", "take20"])
    assert.match(
      resolveSkillCheck(state(), "notice", c, { ...options(), method, safeToTake: true }).blockedReason,
      /unavailable while distracted/
    );
});
globalThis.Actor = class {
  constructor() {
    this.type = "agent";
    this.uuid = "Actor.performer";
    this.isOwner = true;
    this.system = state();
    this.items = [];
    this.flags = {};
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = {
  user: { id: "GC", isGM: true },
  actors: new Map(),
  settings: { get: () => false },
  time: { worldTime: 126 },
  combats: [],
  i18n: { localize: String }
};
globalThis.foundry = { utils: { escapeHTML: String } };
globalThis.ui = { notifications: { warn: () => null } };
globalThis.ChatMessage = { getSpeaker: () => ({}) };
const { SpycraftActor } = await import("../module/documents/actor.mjs");
function target(ghost = true) {
  const a = {
    id: "target",
    uuid: "Actor.target",
    name: "Target",
    type: "agent",
    isOwner: true,
    system: { activeFeatNames: ghost ? ["Ghost Mastery"] : [] }
  };
  game.user.isGM = true;
  game.actors = new Map([[a.id, a]]);
  return a;
}
const request = (patch = {}) => ({
  check: "awareness",
  detectionDistraction: "minor",
  detectionActorUuid: "Actor.target",
  detectionConfirmed: true,
  ...plain,
  ...patch
});
test("actual target access honors Owner/GM/Observer and does not read private source data or accept generic NPC targets", () => {
  const t = target();
  game.user.isGM = false;
  t.isOwner = false;
  t.testUserPermission = () => false;
  Object.defineProperty(t, "system", {
    get() {
      throw Error("Private system read");
    },
    configurable: true
  });
  assert.equal(detectionObserverCandidates().length, 0);
  assert.throws(() => detectionObserverContext(request()), /readable agent/);
  assert.equal(
    detectionObserverContext(
      request({ detectionDistraction: "", detectionTargetSystem: { activeFeatNames: ["Ghost Mastery"] } })
    ).detectionTargetSystem,
    null
  );
  Object.defineProperty(t, "system", {
    value: { activeFeatNames: ["Ghost Mastery"] },
    writable: true,
    configurable: true
  });
  t.testUserPermission = (_u, p) => p === "OBSERVER";
  assert.equal(detectionObserverCandidates().length, 1);
  assert.ok(detectionObserverContent("notice").includes(t.uuid));
  assert.equal(detectionObserverContent("drive"), "");
  t.type = "npc";
  assert.equal(detectionObserverCandidates().length, 0);
  assert.throws(() => detectionObserverContext(request()), /generic NPC/);
  game.user.isGM = true;
});
test("actual actor entry overrides forged source/name payloads and keeps the target after deferred skill spending", async () => {
  const t = target(),
    a = new SpycraftActor();
  let allocations = 0;
  a.rollCheck = async (_f, _d, o) => o;
  a.spendDeferredSkillPoints = async () => {
    allocations++;
    return { spent: 1 };
  };
  let r = await a.rollSkill(
    "notice",
    null,
    request({ detectionTargetSystem: { activeFeatNames: [] }, detectionActorName: "Fabricated" })
  );
  assert.equal(r.detectionObserver.targetName, "Target");
  assert.equal(r.detectionObserver.additionalPenalty, -4);
  r.validateSkillContext();
  r = await a.rollSkill("notice", null, request({ iCanSwim: true }));
  assert.equal(allocations, 1);
  assert.equal(r.detectionObserver.targetActorUuid, t.uuid);
  r.validateSkillContext();
  t.system.activeFeatNames = [];
  r = await a.rollSkill("notice", null, request({ detectionTargetSystem: { activeFeatNames: ["Ghost Mastery"] } }));
  assert.equal(r.detectionObserver.additionalPenalty, 0);
  const disabled = await a.rollSkill(
    "notice",
    null,
    request({ detectionDistraction: "", detectionTargetSystem: { activeFeatNames: ["Ghost Mastery"] } })
  );
  assert.equal(disabled.detectionObserver, null);
  await assert.rejects(
    a.rollSkill("notice", null, request({ detectionActorUuid: "Actor.invented" })),
    /readable agent/
  );
});
test("replacement proof binds actual current target/source/name/permissions and immutable grade while unrelated saved key order is tolerated", () => {
  const t = target(),
    c = detectionObserverContext(request()),
    proof = detectionObserverPlan(
      c.detectionTargetSystem,
      "notice",
      { id: "awareness" },
      {
        actorUuid: c.detectionActorUuid,
        actorName: c.detectionActorName,
        severity: c.detectionDistraction,
        confirmed: c.detectionConfirmed
      }
    ).evidence,
    scope = { checkKind: "skill", skillKey: "notice", checkId: "awareness", checkMethod: "roll" },
    check = { ...scope, detectionObserver: proof };
  validateDetectionObserverProof(Object.fromEntries(Object.entries(proof).reverse()), scope);
  for (const patch of [
    { checkKind: "knowledge" },
    { skillKey: "search" },
    { checkId: "other" },
    { checkMethod: "take10" }
  ])
    assert.throws(() => validateDetectionObserverProof(proof, { ...scope, ...patch }));
  for (const field of [
    "targetActorUuid",
    "targetName",
    "severity",
    "confirmed",
    "basePenalty",
    "additionalPenalty",
    "errorIncrease",
    "sources",
    "version"
  ]) {
    const changed = structuredClone(check);
    changed.detectionObserver[field] = "changed";
    assert.equal(rollEvidenceMatches(rollEvidence(check), changed), false);
  }
  assert.equal(rollEvidenceMatches(rollEvidence({ ...check, detectionObserver: null }), check), false);
  t.system.activeFeatNames = [];
  assert.throws(() => validateDetectionObserverProof(proof, scope), /changed/);
  t.system.activeFeatNames = ["Ghost Mastery"];
  t.name = "Renamed";
  assert.throws(() => validateDetectionObserverProof(proof, scope), /changed/);
  t.name = "Target";
  game.user.isGM = false;
  t.isOwner = false;
  t.testUserPermission = () => false;
  assert.throws(() => validateDetectionObserverProof(proof, scope), /readable agent/);
  game.user.isGM = true;
});
let posts = [],
  hook = async () => {},
  rolls = 0;
globalThis.Roll = class {
  constructor(_f, d) {
    this.total = 12 + (d.total ?? 0);
    this.dice = [{ total: 12 }];
  }
  async evaluate() {
    rolls++;
    await hook();
    return this;
  }
  async toMessage(data) {
    posts.push(data);
    return data;
  }
};
test("real RNG target source loss/addition, renaming and input-grade changes reject before posting stale penalties", async () => {
  for (const kind of ["loss", "addition", "name", "grade"]) {
    const t = target(kind !== "addition"),
      a = new SpycraftActor(),
      input = request();
    posts = [];
    hook = async () => {
      if (kind === "loss") t.system.activeFeatNames = [];
      if (kind === "addition") t.system.activeFeatNames = ["Ghost Mastery"];
      if (kind === "name") t.name = "Renamed during RNG";
      if (kind === "grade") input.detectionDistraction = "major";
    };
    await assert.rejects(a.rollSkill("notice", null, input), /changed/);
    assert.equal(posts.length, 0, kind);
  }
  hook = async () => {};
});
test("actual posting retains both normal and Ghost components, and stale replacement targets fail before rolling", async () => {
  const t = target(),
    a = new SpycraftActor();
  posts = [];
  hook = async () => {};
  const m = await a.rollSkill("notice", null, request({ detectionDistraction: "moderate" })),
    c = m.flags.spycraft2;
  assert.equal(c.rollData.total, 2);
  assert.equal(c.error, 2);
  assert.equal(c.detectionObserver.basePenalty, -4);
  assert.equal(c.detectionObserver.additionalPenalty, -4);
  rolls = 0;
  t.system.activeFeatNames = [];
  await assert.rejects(a.rollCheck("1d20", {}, { ...c, detectionObserver: c.detectionObserver }), /changed/);
  assert.equal(rolls, 0);
});
