import test from "node:test";
import assert from "node:assert/strict";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { resolveKnowledgeCheck } from "../module/rules/knowledge.mjs";
import {
  CONVEYANCE_BULL_RUSH_PROFILES as profiles,
  conveyanceBullRushSkillChecks
} from "../module/rules/conveyance-bull-rush.mjs";
import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
const state = (feats = []) => ({
  activeFeatNames: feats,
  speed: 30,
  conditionContext: {},
  postureMovement: { standardMove: true },
  abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 12, mod: 1 }])),
  skillTotals: Object.fromEntries(
    Object.entries(cfg.skills).map(([key, s]) => [
      key,
      {
        name: s.name,
        focus: s.focus,
        ranks: 4,
        cap: 50,
        threat: 20,
        totals: s.abilities.map(ability => ({ ability, total: 10 })),
        bonusEntries: []
      }
    ])
  ),
  focusTotals: { drive: ["Standard Ground Vehicles"] },
  knowledge: 3
});
const clock = () => ({ id: "combat", started: true, round: 1, turn: 0, ownTurnIndex: 0, combatantId: "self" }),
  ordinary = { gearStatus: "available", synergySkill: "none", focus: "Standard Ground Vehicles" },
  input = (patch = {}) => ({
    ...ordinary,
    conveyanceBullRushName: "GC conveyance",
    conveyanceBullRushTargetName: "GC target",
    conveyanceBullRushSize: "Large",
    conveyanceBullRushTargetSize: "Medium",
    conveyanceBullRushAllowanceFeet: 50,
    conveyanceBullRushDistanceFeet: 50,
    conveyanceBullRushTargetThreatening: true,
    conveyanceBullRushOtherThreatAdjacency: false,
    conveyanceBullRushPassesOtherThreat: false,
    conveyanceBullRushControlConfirmed: true,
    conveyanceBullRushStatsConfirmed: true,
    conveyanceBullRushRouteConfirmed: true,
    conveyanceBullRushContactConfirmed: true,
    conveyanceBullRushFullActionConfirmed: true,
    conveyanceBullRushCombat: clock(),
    ...patch
  }),
  check = key => conveyanceBullRushSkillChecks(key, [])[0];
test("all ordinary named uses and Knowledge ignore retained conveyance facts without new markers or bonuses", () => {
  for (const [key, skill] of Object.entries(cfg.skills))
    for (const c of skill.checks) {
      const s = state(),
        b = resolveSkillCheck(s, key, c, ordinary),
        r = resolveSkillCheck(s, key, c, input());
      assert.equal(r.conveyanceBullRush, null, key + "/" + c.id);
      for (const k of ["total", "error", "cap", "threat", "timeMultiplier"]) assert.equal(r[k], b[k]);
    }
  for (const skill of Object.keys(cfg.skills))
    assert.equal(
      resolveKnowledgeCheck(state(), { skill, ...input() }).total,
      resolveKnowledgeCheck(state(), { skill, ...ordinary }).total
    );
});
test("all four profiles choose the exact borrowed attribute, ignore Armor/load and do not receive Maneuver-only Closed Course/One Hand benefits", () => {
  for (const [key, profile] of Object.entries(profiles)) {
    const s = state(["Professional Driver - Closed Course", "One Hand on the Wheel"]);
    s.activeFeatSelections = [{ tree: "chase" }, { tree: "chase" }];
    s.skillTotals.impress.ranks = 10;
    s.armor = { check: -4, visionCheck: -3 };
    s.encumbrance = { check: -6 };
    const r = resolveSkillCheck(s, key, check(key), input({ synergySkill: "auto", ability: "wis" }));
    assert.equal(r.ability, profile.ability);
    assert.equal(r.total, 14);
    assert.equal(r.armor, 0);
    assert.equal(r.synergy, 0);
    assert.equal(r.closedCourseFeat, null);
    assert.equal(r.wheelFeat, null);
    assert.equal(r.conveyanceBullRush.maneuverBenefits, false);
    assert.equal(r.error, 1);
    assert.ok(
      resolveSkillCheck(s, key, check(key), input({ wheelFreeManeuver: true, wheelFreeActionConfirmed: true })).blocked
    );
    const m = cfg.skills[key].checks.find(c => c.id === "maneuver"),
      ordinaryManeuver = resolveSkillCheck(s, key, m, { ...ordinary, synergySkill: "impress" });
    assert.ok(ordinaryManeuver.closedCourseFeat);
  }
});
test("generic Drive focus/Forte and skill-bonus conditions still apply, with Size outside Baffled/Incompetent and no foot Speed substitution", () => {
  const s = state();
  s.skillTotals.drive.focus = true;
  for (const [conditionContext, total] of [
    [{}, 14],
    [{ baffled: true }, 9],
    [{ incompetent: true }, 4]
  ]) {
    s.conditionContext = conditionContext;
    const r = resolveSkillCheck(s, "drive", check("drive"), input());
    assert.equal(r.total, total);
    assert.equal(r.checkAdjustment, 4);
  }
  s.conditionContext = {};
  const unowned = resolveSkillCheck(s, "drive", check("drive"), input({ focus: "Aircraft" }));
  assert.equal(unowned.total, 12);
  assert.equal(unowned.error, 3);
  s.skillForteTotals = [{ skill: "drive", focus: "Standard Ground Vehicles", forte: "Civilian driving" }];
  assert.equal(resolveSkillCheck(s, "drive", check("drive"), input({ forte: true })).total, 15);
  s.speed = 0;
  s.encumbrance = { immobile: true };
  s.postureMovement = { bullRush: false };
  assert.equal(resolveSkillCheck(s, "drive", check("drive"), input()).blocked, false);
  assert.equal(resolveSkillCheck(s, "drive", check("drive"), input()).conveyanceBullRush.allowanceFeet, 50);
});
test("immutable conveyance evidence rejects added, removed or altered declarations while ordinary legacy checks remain compatible", () => {
  const proof = resolveSkillCheck(state(), "drive", check("drive"), input()).conveyanceBullRush,
    c = { checkKind: "skill", skillKey: "drive", checkId: "conveyance-bull-rush", conveyanceBullRush: proof },
    e = rollEvidence(c);
  assert.equal(rollEvidenceMatches(e, c), true);
  assert.equal(rollEvidenceMatches(rollEvidence({ ...c, conveyanceBullRush: null }), c), false);
  assert.equal(rollEvidenceMatches(e, { ...c, conveyanceBullRush: null }), false);
  for (const k of Object.keys(proof)) {
    const n = structuredClone(c);
    n.conveyanceBullRush[k] = "changed";
    assert.equal(rollEvidenceMatches(e, n), false, k);
  }
});
let liveClock = clock();
globalThis.Actor = class {
  constructor() {
    this.type = "agent";
    this.isOwner = true;
    this.uuid = "Actor.conveyance";
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
test("actual Actor exposes all four profiles, parses conveyance facts, derives Size and overrides a forged current Count", async () => {
  liveClock = clock();
  hook = async () => {};
  posts = [];
  for (const [key, profile] of Object.entries(profiles)) {
    const a = new SpycraftActor(),
      m = await a.rollSkill(key, "wis", {
        check: "conveyance-bull-rush",
        ...input({
          conveyanceBullRushAllowanceFeet: "50",
          conveyanceBullRushDistanceFeet: "50",
          conveyanceBullRushCombat: { ...clock(), id: "forged" },
          sizeBonus: 999,
          speed: 0
        })
      }),
      c = m.flags.spycraft2;
    assert.equal(c.ability, profile.ability);
    assert.equal(c.conveyanceBullRush.kind, profile.kind);
    assert.equal(c.conveyanceBullRush.allowanceFeet, 50);
    assert.equal(c.conveyanceBullRush.sizeBonus, 4);
    assert.equal(c.conveyanceBullRush.combat.id, "combat");
    assert.equal(c.rollData.total, 14);
  }
  const a = new SpycraftActor();
  for (const patch of [
    { conveyanceBullRushAllowanceFeet: "" },
    { conveyanceBullRushDistanceFeet: "51" },
    { conveyanceBullRushControlConfirmed: false },
    { conveyanceBullRushStatsConfirmed: "true" }
  ]) {
    const n = posts.length;
    await a.rollSkill("drive", null, { check: "conveyance-bull-rush", ...input(patch) });
    assert.equal(posts.length, n);
  }
});
test("actual RNG current Count, conveyance facts/focus and operator condition drift rejects without posting", async () => {
  for (const change of ["round", "size", "allowance", "focus", "control", "condition"]) {
    liveClock = clock();
    const a = new SpycraftActor(),
      request = { check: "conveyance-bull-rush", ...input() };
    posts = [];
    hook = async () => {
      if (change === "round") liveClock.round = 2;
      if (change === "size") request.conveyanceBullRushSize = "Huge";
      if (change === "allowance") request.conveyanceBullRushAllowanceFeet = 60;
      if (change === "focus") request.focus = "Aircraft";
      if (change === "control") request.conveyanceBullRushControlConfirmed = false;
      if (change === "condition") a.system.conditionContext.prone = true;
    };
    await assert.rejects(a.rollSkill("drive", null, request), /changed/);
    assert.equal(posts.length, 0, change);
  }
  hook = async () => {};
  liveClock = clock();
});
test("replacement validates the exact operator attribute, real substitution/current Count and condition before RNG", async () => {
  liveClock = clock();
  const a = new SpycraftActor(),
    proof = resolveSkillCheck(a.system, "drive", check("drive"), input()).conveyanceBullRush,
    scope = {
      checkKind: "skill",
      skillKey: "drive",
      checkId: "conveyance-bull-rush",
      ability: "dex",
      conveyanceBullRush: proof
    };
  rolls = 0;
  await assert.rejects(a.rollCheck("1d20", {}, { ...scope, ability: "str" }), /attribute/);
  await assert.rejects(
    a.rollCheck(
      "1d20",
      {},
      {
        ...scope,
        ability: "int",
        attributeSubstitution: { source: "All According to Plan", originalAbility: "dex", ability: "int" }
      }
    ),
    /attribute/
  );
  liveClock.round = 2;
  await assert.rejects(a.rollCheck("1d20", {}, scope), /changed/);
  liveClock = clock();
  a.system.conditionContext.prone = true;
  await assert.rejects(a.rollCheck("1d20", {}, scope), /changed/);
  assert.equal(rolls, 0);
});
