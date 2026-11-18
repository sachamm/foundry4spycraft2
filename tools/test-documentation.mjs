import test from "node:test";
import assert from "node:assert/strict";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { documentationSkillPlan, validateDocumentationProof } from "../module/rules/documentation.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { resolveKnowledgeCheck } from "../module/rules/knowledge.mjs";
import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
const state = () => ({
    activeFeatNames: ["Superior Documentation"],
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
    focusTotals: {},
    knowledge: 3,
    conditionContext: {}
  }),
  input = {
    usingCoverIdentity: true,
    coverIdentityName: "Dr. Jane Carter",
    coverIdentityConfirmed: true,
    gearStatus: "available",
    synergySkill: "none"
  };
test("Superior Documentation covers every Bluff use only, with no leakage to other skills or related Knowledge", () => {
  const s = state();
  for (const [key, skill] of Object.entries(cfg.skills))
    for (const c of skill.checks) {
      const b = resolveSkillCheck(s, key, c, { ...input, usingCoverIdentity: false }),
        r = resolveSkillCheck(s, key, c, input);
      assert.equal(r.total - b.total, key === "bluff" ? 1 : 0, key + "/" + c.id);
      assert.equal(r.error, b.error);
      assert.equal(r.cap, b.cap);
      assert.equal(r.threat, b.threat);
      assert.equal(!!r.documentation, key === "bluff");
    }
  for (const skill of Object.keys(cfg.skills)) {
    const a = resolveKnowledgeCheck(s, { skill, ...input }),
      b = resolveKnowledgeCheck({ ...s, activeFeatNames: [] }, { skill, ...input });
    assert.equal(a.total, b.total);
  }
});
test("the documentation bonus competes with existing gear bonuses and leaves other typed bonuses and penalties intact", () => {
  for (const gear of [-3, 0, 1, 2, 4, 6]) {
    const s = state();
    s.skillTotals.bluff.bonusEntries = [
      { source: "Other gear", type: "gear", value: gear },
      { type: "insight", value: 3 },
      { type: "", value: -2 }
    ];
    const c = cfg.skills.bluff.checks[0],
      b = resolveSkillCheck(s, "bluff", c, { ...input, usingCoverIdentity: false }),
      r = resolveSkillCheck(s, "bluff", c, input);
    assert.equal(r.total - b.total, Math.max(1, gear) - Math.max(0, gear));
    assert.equal(r.documentation.bonus.type, "gear");
    s.activeFeatNames.push("Superior Documentation");
    assert.equal(resolveSkillCheck(s, "bluff", c, input).total, r.total);
  }
});
test("a cover identity needs an explicit active source, bounded name and boolean confirmation; unrelated Bluff has no bonus", () => {
  const s = state(),
    c = cfg.skills.bluff.checks[0];
  for (const patch of [
    { coverIdentityName: "" },
    { coverIdentityName: " " },
    { coverIdentityName: 3 },
    { coverIdentityName: "x".repeat(201) },
    { coverIdentityConfirmed: false },
    { coverIdentityConfirmed: "true" }
  ])
    assert.ok(documentationSkillPlan(s, "bluff", c, { ...input, ...patch }).blockedReason);
  assert.ok(documentationSkillPlan({ ...s, activeFeatNames: [] }, "bluff", c, input).blockedReason);
  for (const usingCoverIdentity of [false, "true", 1])
    assert.equal(documentationSkillPlan(s, "bluff", c, { ...input, usingCoverIdentity }).evidence, null);
  assert.equal(
    documentationSkillPlan(s, "bluff", c, { ...input, coverIdentityName: " Dr. Jane Carter " }).evidence
      .coverIdentityName,
    input.coverIdentityName
  );
});
test("fixed-result Bluff still adds the gear bonus before its result cap without granting extra threat or action-die permission", () => {
  const s = state(),
    c = cfg.skills.bluff.checks.find(c => c.id === "feint") ?? cfg.skills.bluff.checks[0];
  for (const method of ["take10", "take20"]) {
    const b = resolveSkillCheck(s, "bluff", c, { ...input, usingCoverIdentity: false, method, safeToTake: true }),
      r = resolveSkillCheck(s, "bluff", c, { ...input, method, safeToTake: true });
    assert.equal(r.total, b.total + 1);
    assert.equal(r.cap, b.cap);
    assert.equal(r.fixedDie, b.fixedDie);
    assert.equal(r.actionDiceAllowed, false);
    assert.equal(r.threat, 0);
  }
});
test("replacement-roll source validation and outcome evidence retain the named identity while preserving ordinary legacy receipts", () => {
  const s = state(),
    c = cfg.skills.bluff.checks[0],
    proof = documentationSkillPlan(s, "bluff", c, input).evidence,
    context = { checkKind: "skill", skillKey: "bluff", checkId: c.id, documentation: proof },
    e = rollEvidence(context);
  validateDocumentationProof(s, proof, context);
  for (const patch of [{ checkKind: "knowledge" }, { skillKey: "impress" }, { checkId: "other" }])
    assert.throws(() => validateDocumentationProof(s, proof, { ...context, ...patch }), /changed/);
  for (const key of ["source", "checkId", "coverIdentityName", "coverIdentityConfirmed", "bonus"]) {
    const changed = structuredClone(context);
    changed.documentation[key] = "changed";
    assert.equal(rollEvidenceMatches(e, changed), false);
  }
  assert.equal(rollEvidenceMatches(e, { checkKind: "skill", skillKey: "bluff", checkId: c.id }), false);
  s.activeFeatNames = [];
  assert.throws(() => validateDocumentationProof(s, proof, context), /changed/);
  validateDocumentationProof(s, null, context);
});
globalThis.Actor = class {
  constructor() {
    this.system = state();
    this.items = [];
    this.type = "agent";
    this.uuid = "Actor.documentation";
    this.isOwner = true;
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = { user: { isGM: true }, settings: { get: () => false }, i18n: { localize: String } };
globalThis.foundry = { utils: { escapeHTML: String } };
globalThis.ui = { notifications: { warn: () => null } };
const { SpycraftActor } = await import("../module/documents/actor.mjs");
test("actual Actor skill dispatch records the named identity and rejects source or declaration changes before posting", async () => {
  const a = new SpycraftActor();
  a.rollCheck = async (f, data, options) => ({ data, options });
  const c = cfg.skills.bluff.checks[0],
    request = { ...input, check: c.id },
    r = await a.rollSkill("bluff", null, request);
  assert.equal(r.options.documentation.coverIdentityName, input.coverIdentityName);
  r.options.validateSkillContext();
  a.system.activeFeatNames = [];
  assert.throws(() => r.options.validateSkillContext(), /changed/);
  a.system = state();
  request.coverIdentityName = "Changed identity";
  assert.throws(() => r.options.validateSkillContext(), /changed/);
});
