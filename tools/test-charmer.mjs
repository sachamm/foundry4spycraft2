import test from "node:test";
import assert from "node:assert/strict";
import { charmerInfluencePlan } from "../module/rules/hard-core.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const state = () => ({
  activeFeatNames: ["Charmer"],
  skillTotals: Object.fromEntries(
    Object.values(cfg.skills).map(s => [
      s.key,
      { name: s.name, ranks: 5, cap: 30, threat: 20, totals: s.abilities.map(ability => ({ ability, total: 7 })) }
    ])
  )
});
const influence = cfg.skills.impress.checks.find(c => c.id === "influence");
const facts = {
  charmer: true,
  charmerTarget: "The watch officer",
  charmerDisposition: "neutral",
  charmerNPCConfirmed: true,
  charmerDuration: "quick",
  synergySkill: "none"
};
const plan = (s = state(), input = {}) => resolveSkillCheck(s, "impress", influence, { ...facts, ...input });
test("all three eligible dispositions and both Influence durations use exact printed times and preserve ordinary check totals", () => {
  for (const charmerDisposition of ["neutral", "intrigued", "friendly"])
    for (const charmerDuration of ["quick", "slow"]) {
      const p = plan(state(), { charmerDisposition, charmerDuration }),
        ordinary = resolveSkillCheck(state(), "impress", influence, { synergySkill: "none" });
      assert.equal(p.blocked, false, p.blockedReason);
      assert.equal(p.charmer.requiredSeconds, charmerDuration === "quick" ? 6 : 60);
      assert.equal(p.charmer.applied, true);
      assert.equal(p.total, ordinary.total);
      assert.equal(p.error, ordinary.error);
      assert.equal(p.cap, ordinary.cap);
      assert.equal(p.mode, "Secret");
      assert.equal(p.charmer.target, facts.charmerTarget);
    }
});
test("Charmer requires a current feat, exactly one named GC-confirmed NPC, an eligible disposition and a chosen duration", () => {
  for (const input of [
    { charmerTarget: "" },
    { charmerTarget: "x".repeat(201) },
    { charmerNPCConfirmed: false },
    { charmerNPCConfirmed: "true" },
    { charmerDisposition: "hostile" },
    { charmerDisposition: "aloof" },
    { charmerDisposition: "helpful" },
    { charmerDuration: "" },
    { charmerDuration: "full" }
  ])
    assert.equal(plan(state(), input).blocked, true);
  const s = state();
  s.activeFeatNames = [];
  assert.equal(plan(s).blocked, true);
  for (const [key, skill] of Object.entries(cfg.skills))
    for (const check of skill.checks)
      if (key !== "impress" || check.id !== "influence")
        assert.match(charmerInfluencePlan(state(), key, check, facts).blockedReason, /only/);
});
test("the optional benefit never applies without a strict request, and no reduction preserves the chosen quick/slow base time", () => {
  for (const charmer of [false, "true", undefined]) {
    const p = plan(state(), { charmer });
    assert.equal(p.charmer, null);
    assert.equal(p.timeReduction, "none");
  }
  for (const charmerDuration of ["quick", "slow"]) {
    const p = plan(state(), { charmerDuration, timingReduction: "none" });
    assert.equal(p.charmer.applied, false);
    assert.equal(p.charmer.requiredSeconds, charmerDuration === "quick" ? 60 : 600);
  }
});
test("take 10/20 and Cross-Check multiply the single selected reduction, never compound another reduction", () => {
  for (const method of ["roll", "take10", "take20"])
    for (const charmerDuration of ["quick", "slow"]) {
      const s = state();
      s.activeFeatNames.push("Attention to Detail");
      s.skillFeatRules = [{ name: "Mark of a Professional", skill: "impress" }];
      const p = plan(s, { method, charmerDuration, safeToTake: true, crossCheckActive: true, unopposed: true });
      assert.equal(p.blocked, false, p.blockedReason);
      assert.equal(p.timeReduction, "charmer");
      assert.equal(
        p.charmer.requiredSeconds,
        (charmerDuration === "quick" ? 6 : 60) * { roll: 1, take10: 2, take20: 20 }[method] * 3
      );
      assert.equal(p.crossCheckMultiplier, 3);
      assert.equal(p.timeReductionOptions.filter(c => c.id === "charmer").length, 1);
      assert.ok(p.timeReductionOptions.some(c => c.id === "professional"));
      const other = plan(s, {
        method,
        charmerDuration,
        safeToTake: true,
        unopposed: true,
        timingReduction: "professional"
      });
      assert.equal(other.charmer.applied, false);
      assert.equal(
        other.charmer.requiredSeconds,
        (charmerDuration === "quick" ? 60 : 600) * { roll: 1, take10: 2, take20: 20 }[method] * 0.5
      );
    }
});
test("recorded target facts, quick/slow choice, timing source and final duration cannot change after outcome evidence is taken", () => {
  const c = { checkKind: "skill", charmer: plan().charmer },
    e = rollEvidence(c);
  assert.equal(rollEvidenceMatches(e, c), true);
  for (const key of ["target", "npcConfirmed", "disposition", "duration", "requiredSeconds", "applied", "reduction"]) {
    const changed = structuredClone(c);
    changed.charmer[key] = "changed";
    assert.equal(rollEvidenceMatches(e, changed), false, key);
  }
  assert.equal(rollEvidenceMatches(e, { checkKind: "skill" }), false);
  assert.equal(rollEvidenceMatches(rollEvidence({ checkKind: "skill" }), c), false);
});
globalThis.Actor = class {
  constructor() {
    this.system = state();
    this.items = [];
    this.type = "agent";
    this.uuid = "Actor.charmer";
    this.isOwner = true;
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = { user: { isGM: true }, settings: { get: () => false }, i18n: { localize: s => s } };
globalThis.foundry = {
  utils: { escapeHTML: s => String(s) },
  applications: {
    api: {
      DialogV2: {
        input: async options => {
          assert.match(options.content, /name="charmer"/);
          assert.match(options.content, /name="charmerNPCConfirmed"/);
          return null;
        }
      }
    }
  }
};
globalThis.ui = { notifications: { warn: () => null } };
const { SpycraftActor } = await import("../module/documents/actor.mjs");
test("actual Actor entry records timing, rejects absent facts before rolling, and pre/post source guard rejects feat loss", async () => {
  const a = new SpycraftActor();
  let rolls = 0,
    captured;
  a.rollCheck = async (_formula, _data, options) => {
    rolls++;
    captured = options;
    await options.validateSkillContext?.();
    return options;
  };
  const p = await a.rollSkill("impress", "cha", { check: "influence", ...facts });
  assert.equal(p.charmer.requiredSeconds, 6);
  const before = rolls;
  assert.equal(
    await a.rollSkill("impress", "cha", { check: "influence", ...facts, charmerNPCConfirmed: false }),
    false
  );
  assert.equal(rolls, before);
  a.system.activeFeatNames = [];
  assert.throws(() => captured.validateSkillContext(), /changed/);
});
test("actual Impress dialog renders the declaration before a named check is selected and closes without rolling", async () => {
  const a = new SpycraftActor();
  a.rollCheck = () => {
    throw Error("must not roll");
  };
  assert.equal(await a.rollSkill("impress", "cha"), null);
});

test("Charmer and Hard Core never combine on one target and their required declaration scopes stay distinct", () => {
  const s = state();
  s.activeFeatNames.push("Hard Core", "Simply Irresistible");
  assert.equal(plan(s).timeReduction, "charmer");
  assert.equal(plan(s, { timingReduction: "irresistible" }).charmer.requiredSeconds, 30);
  assert.equal(plan(s, { timingReduction: "hardCore" }).blocked, true);
  const both = plan(s, {
    hardCore: true,
    hardCoreTarget: "A second NPC",
    hardCoreDisposition: "hostile",
    hardCoreNPCConfirmed: true,
    influenceDuration: "quick"
  });
  assert.equal(both.blocked, true);
  assert.match(both.blockedReason, /one Influence/);
});
