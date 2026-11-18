import test from "node:test";
import assert from "node:assert/strict";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { resolveKnowledgeCheck } from "../module/rules/knowledge.mjs";
import { bullRushAttackSkillChecks } from "../module/rules/bull-rush-attack.mjs";
import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
const state = (feats = []) => ({
  size: "Medium",
  classLevels: { brawler: 3 },
  classOptionSelections: [{ classId: "brawler", name: "Still Standing", level: 3 }],
  activeFeatNames: feats,
  speed: 30,
  conditionContext: {},
  postureMovement: { standardMove: true, bullRush: true },
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
  focusTotals: {},
  knowledge: 3
});
const clock = () => ({ id: "combat", started: true, round: 1, turn: 0, ownTurnIndex: 0, combatantId: "self" }),
  attack = bullRushAttackSkillChecks("athletics", [])[0],
  ordinary = { gearStatus: "available", synergySkill: "none" },
  input = (patch = {}) => ({
    ...ordinary,
    bullRushAttackOpponentName: "Reachable target",
    bullRushAttackSizeDifference: 0,
    bullRushAttackDistanceFeet: 30,
    bullRushAttackOnFootConfirmed: true,
    bullRushAttackRouteConfirmed: true,
    bullRushAttackContactConfirmed: true,
    bullRushAttackFullActionConfirmed: true,
    bullRushAttackTargetThreatening: false,
    bullRushAttackOtherThreatAdjacency: false,
    bullRushAttackPassesOtherThreat: false,
    bullRushAttackCombat: clock(),
    ...patch
  });
test("all ordinary named uses and Knowledge ignore retained attacking fields and receive no marker or bonus", () => {
  for (const [key, skill] of Object.entries(cfg.skills))
    for (const check of skill.checks) {
      const s = state(),
        b = resolveSkillCheck(s, key, check, ordinary),
        r = resolveSkillCheck(s, key, check, input());
      assert.equal(r.bullRushAttack, null, key + "/" + check.id);
      for (const k of ["total", "error", "cap", "threat", "timeMultiplier"]) assert.equal(r[k], b[k]);
    }
  for (const skill of Object.keys(cfg.skills))
    assert.equal(
      resolveKnowledgeCheck(state(), { skill, ...input() }).total,
      resolveKnowledgeCheck(state(), { skill }).total
    );
});
test("on-foot attack grants no Still Standing resistance bonus; Size stays separate under skill-bonus conditions", () => {
  for (const [conditionContext, total] of [
    [{}, 14],
    [{ baffled: true }, 9],
    [{ incompetent: true }, 4],
    [{ vulnerable: true }, 14]
  ]) {
    const s = state();
    s.conditionContext = conditionContext;
    const r = resolveSkillCheck(s, "athletics", attack, input({ bullRushAttackSizeDifference: 1 }));
    assert.equal(r.total, total);
    assert.equal(r.checkAdjustment, 4);
    assert.equal(r.bullRushAttack.sizeBonus, 4);
    assert.equal(Object.hasOwn(r.bullRushAttack, "stillStanding"), false);
    assert.equal(r.error, 1);
    assert.equal(r.bullRushAttack.maximumFeet, 30);
    assert.equal(Object.hasOwn(r.bullRushAttack, "dc"), false);
  }
  const s = state(["Combat Mobility", "Run"]);
  assert.ok(resolveSkillCheck(s, "athletics", attack, input({ bullRushAttackDistanceFeet: 31 })).blocked);
});
test("actual on-foot check keeps STR/Armor and no invented Vision/Hearing tags, with genuine INT substitution and chosen-target adjacency scope", () => {
  const s = state();
  s.conditionContext = { blinded: true, deafened: true };
  s.armor = { check: -2, visionCheck: -3 };
  const r = resolveSkillCheck(s, "athletics", attack, input({ ability: "con" }));
  assert.equal(r.ability, "str");
  assert.equal(r.total, 8);
  assert.equal(r.cap, 50);
  s.conditionContext = {};
  s.armor = {};
  s.classLevels.schemer = 4;
  s.abilities.int.mod = 5;
  const int = resolveSkillCheck(s, "athletics", attack, input({ allAccordingToPlan: true }));
  assert.equal(int.ability, "int");
  assert.equal(int.total, 14);
  for (const patch of [
    { method: "take10", safeToTake: true },
    { bullRushAttackOtherThreatAdjacency: true },
    { bullRushAttackContactConfirmed: false }
  ])
    assert.ok(resolveSkillCheck(s, "athletics", attack, input(patch)).blocked);
});
test("immutable attacker proof prevents late additions, removals or changed route/Count/Size facts", () => {
  const proof = resolveSkillCheck(state(), "athletics", attack, input()).bullRushAttack,
    c = { checkKind: "skill", skillKey: "athletics", checkId: "bull-rush", bullRushAttack: proof },
    e = rollEvidence(c);
  assert.equal(rollEvidenceMatches(e, c), true);
  assert.equal(rollEvidenceMatches(rollEvidence({ ...c, bullRushAttack: null }), c), false);
  assert.equal(rollEvidenceMatches(e, { ...c, bullRushAttack: null }), false);
  for (const k of Object.keys(proof)) {
    const n = structuredClone(c);
    n.bullRushAttack[k] = "changed";
    assert.equal(rollEvidenceMatches(e, n), false, k);
  }
});
let liveClock = clock();
globalThis.Actor = class {
  constructor() {
    this.type = "agent";
    this.isOwner = true;
    this.uuid = "Actor.rush";
    this.items = [];
    this.flags = {};
    this.system = state();
    this.mentalLeapCombatContext = () => structuredClone(liveClock);
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = {
  user: { id: "GC", isGM: true },
  settings: { get: () => false },
  time: { worldTime: 126 },
  combats: [],
  actors: [],
  i18n: { localize: String }
};
globalThis.foundry = { utils: { escapeHTML: String } };
globalThis.ui = { notifications: { warn: () => null } };
globalThis.ChatMessage = { getSpeaker: () => ({}) };
let hook = async () => {},
  posts = [],
  rolls = 0;
globalThis.Roll = class {
  constructor(_f, data) {
    this.total = 12 + (data.total ?? 0);
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
test("actual Actor parses distance/Size, uses trusted current combat and ignores forged Speed/Count/maximum data", async () => {
  liveClock = clock();
  hook = async () => {};
  posts = [];
  const a = new SpycraftActor(),
    m = await a.rollSkill("athletics", "con", {
      check: "bull-rush",
      ...input({
        bullRushAttackSizeDifference: "1",
        bullRushAttackDistanceFeet: "30",
        bullRushAttackCombat: { ...clock(), id: "forged", turn: 99 },
        speed: 999,
        maximumFeet: 999
      })
    }),
    c = m.flags.spycraft2;
  assert.equal(c.ability, "str");
  assert.equal(c.rollData.total, 14);
  assert.equal(c.bullRushAttack.maximumFeet, 30);
  assert.equal(c.bullRushAttack.distanceFeet, 30);
  assert.equal(c.bullRushAttack.combat.id, "combat");
  assert.equal(c.bullRushAttack.sizeDifference, 1);
  liveClock = null;
  const n = posts.length;
  await a.rollSkill("athletics", null, { check: "bull-rush", ...input() });
  assert.equal(posts.length, n);
  liveClock = clock();
  for (const patch of [
    { bullRushAttackDistanceFeet: "" },
    { bullRushAttackSizeDifference: "-2" },
    { bullRushAttackFullActionConfirmed: false }
  ]) {
    const n = posts.length;
    await a.rollSkill("athletics", null, { check: "bull-rush", ...input(patch) });
    assert.equal(posts.length, n);
  }
});
test("actual RNG current Count, Speed, Size, posture and route drift rejects without posting", async () => {
  for (const change of ["round", "turn", "speed", "size", "posture", "distance", "target"]) {
    liveClock = clock();
    const a = new SpycraftActor(),
      request = { check: "bull-rush", ...input() };
    posts = [];
    hook = async () => {
      if (change === "round") liveClock.round = 2;
      if (change === "turn") liveClock.turn = 1;
      if (change === "speed") a.system.speed = 15;
      if (change === "size") a.system.size = "Small";
      if (change === "posture") a.system.postureMovement.bullRush = false;
      if (change === "distance") request.bullRushAttackDistanceFeet = 20;
      if (change === "target") request.bullRushAttackTargetThreatening = true;
    };
    await assert.rejects(a.rollSkill("athletics", null, request), /changed/);
    assert.equal(posts.length, 0, change);
  }
  hook = async () => {};
  liveClock = clock();
});
test("replacement validates current Count, live movement capacity and actual STR/substitution before RNG", async () => {
  liveClock = clock();
  const a = new SpycraftActor(),
    proof = resolveSkillCheck(a.system, "athletics", attack, input()).bullRushAttack,
    scope = { checkKind: "skill", skillKey: "athletics", checkId: "bull-rush", ability: "str", bullRushAttack: proof };
  rolls = 0;
  await assert.rejects(a.rollCheck("1d20", {}, { ...scope, ability: "con" }), /attribute/);
  liveClock.round = 2;
  await assert.rejects(a.rollCheck("1d20", {}, scope), /changed/);
  liveClock = clock();
  a.system.speed = 15;
  await assert.rejects(a.rollCheck("1d20", {}, scope), /changed/);
  assert.equal(rolls, 0);
});
