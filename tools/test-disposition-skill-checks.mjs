import test from "node:test";
import assert from "node:assert/strict";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { dispositionSkillPlan as plan, hasDispositionCheck } from "../module/rules/disposition-skills.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { campaignEffects, activeQualities } from "../module/rules/gc/campaign.mjs";
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
  assert.ok(taking.blockedReason.includes("Disposition timing combined"));
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
