import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { resolveKnowledgeCheck } from "../module/rules/knowledge.mjs";
import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
const classes = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))),
  feats = JSON.parse(readFileSync(new URL("../src/data/feats.json", import.meta.url)));
function state({ photo = true, level = 1, career = 1 } = {}) {
  const c = classes.find(c => c.key === "soldier"),
    f = feats.find(f => f.name === "Photographic Memory"),
    s = {
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12, misc: 0 }])),
      progression: Array.from({ length: level }, () => ({ classId: "soldier", vitality: 12, skills: {} })),
      skills: {},
      focuses: {},
      misc: {}
    };
  return computeAgent(
    s,
    [
      {
        id: "soldier",
        name: "Soldier",
        type: "class",
        system: { ...structuredClone(c), identifier: "soldier", vitalityDie: 12 }
      },
      ...(photo
        ? [
            {
              id: "photo",
              name: "Photographic Memory",
              type: "feat",
              system: { ...structuredClone(f), tree: "advancedSkill", acquiredAtLevel: career }
            }
          ]
        : [])
    ],
    cfg
  );
}
test("Photographic Memory affects all thirty Knowledge relations with its global insight/threat and preserves the optional active choice", () => {
  const s = state(),
    base = state({ photo: false });
  assert.equal(s.featStatus.photo.ok, true);
  for (const skill of Object.keys(cfg.skills))
    for (const active of [false, true]) {
      const p = resolveKnowledgeCheck(s, { skill, active }),
        b = resolveKnowledgeCheck(base, { skill });
      assert.equal(p.blocked, false, p.blockedReason);
      assert.equal(p.total, b.total + 2);
      assert.equal(p.threat, 19);
      assert.equal(p.error, 1);
      assert.equal(p.cap, null);
      assert.equal(p.rollMode, active ? undefined : "blindroll");
      assert.equal(p.actionDiceAllowed, active);
      assert.equal(p.photographicMemory.mode, active ? "active" : "passive");
      assert.equal(p.photographicMemory.requiredSeconds, 0);
    }
});
test("the two fixed Knowledge methods have exact printed durations, permission constraints and no boost or threat", () => {
  const s = state();
  for (const [method, die, seconds] of [
    ["take10", 10, 6],
    ["take20", 20, 60]
  ]) {
    const p = resolveKnowledgeCheck(s, { skill: "analysis", method, safeToTake: true, active: true });
    assert.equal(p.blocked, false, p.blockedReason);
    assert.equal(p.fixedDie, die);
    assert.equal(p.minimumTimeSeconds, seconds);
    assert.equal(p.requiredTimeSeconds, seconds);
    assert.equal(p.photographicMemory.requiredSeconds, seconds);
    assert.equal(p.actionDiceAllowed, false);
    assert.equal(p.threat, 0);
    assert.equal(p.error, 0);
    assert.equal(resolveKnowledgeCheck(s, { skill: "analysis", method, safeToTake: false }).blocked, true);
    assert.equal(
      resolveKnowledgeCheck(state({ photo: false }), { skill: "analysis", method, safeToTake: true }).blocked,
      true
    );
  }
  const late = state({ level: 2, career: 2 });
  assert.equal(late.featStatus.photo.ok, false);
  assert.equal(resolveKnowledgeCheck(late, { skill: "analysis", active: true }).blocked, true);
});
test("Photographic Memory mode, method and duration cannot change after outcome evidence is captured", () => {
  const c = {
      checkKind: "knowledge",
      photographicMemory: resolveKnowledgeCheck(state(), { skill: "analysis", active: true }).photographicMemory
    },
    e = rollEvidence(c);
  assert.equal(rollEvidenceMatches(e, c), true);
  for (const key of ["source", "mode", "method", "requiredSeconds"]) {
    const changed = structuredClone(c);
    changed.photographicMemory[key] = "changed";
    assert.equal(rollEvidenceMatches(e, changed), false);
  }
  assert.equal(rollEvidenceMatches(e, { checkKind: "knowledge" }), false);
});
globalThis.Actor = class {
  constructor() {
    this.system = state();
    this.items = [];
    this.type = "agent";
    this.uuid = "Actor.photo";
    this.isOwner = true;
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = { user: { isGM: true }, settings: { get: () => false }, i18n: { localize: String } };
globalThis.foundry = { utils: { escapeHTML: String } };
globalThis.ui = { notifications: { warn: () => null } };
const { SpycraftActor } = await import("../module/documents/actor.mjs");
test("actual Actor dispatch guards passive, active and fixed Knowledge against losing the source before posting", async () => {
  for (const input of [
    {},
    { active: true },
    { method: "take10", safeToTake: true },
    { method: "take20", safeToTake: true }
  ]) {
    const a = new SpycraftActor();
    a.rollCheck = async (_formula, _data, options) => options;
    const p = await a.rollKnowledge({ skill: "analysis", ...input });
    assert.equal(typeof p.validateSkillContext, "function");
    assert.ok(p.photographicMemory);
    p.validateSkillContext();
    a.system = state({ photo: false });
    assert.throws(() => p.validateSkillContext(), /changed/);
  }
});
