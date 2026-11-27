import test from "node:test";
import assert from "node:assert/strict";
import { hardCoreInfluencePlan } from "../module/rules/hard-core.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const state = () => ({
  activeFeatNames: ["Hard Core"],
  skillTotals: Object.fromEntries(
    Object.values(cfg.skills).map(s => [
      s.key,
      { name: s.name, ranks: 5, cap: 30, threat: 20, totals: s.abilities.map(ability => ({ ability, total: 7 })) }
    ])
  )
});
const influence = cfg.skills.impress.checks.find(c => c.id === "influence");
const facts = {
  hardCore: true,
  hardCoreTarget: "The watch officer",
  hardCoreDisposition: "aloof",
  hardCoreNPCConfirmed: true,
  influenceDuration: "quick",
  synergySkill: "none"
};
const plan = (s = state(), input = {}) => resolveSkillCheck(s, "impress", influence, { ...facts, ...input });
test("all three eligible dispositions and both Influence durations use exact printed times and preserve ordinary check totals", () => {
  for (const hardCoreDisposition of ["aloof", "unfriendly", "hostile"])
    for (const influenceDuration of ["quick", "slow"]) {
      const p = plan(state(), { hardCoreDisposition, influenceDuration }),
        ordinary = resolveSkillCheck(state(), "impress", influence, { synergySkill: "none" });
      assert.equal(p.blocked, false, p.blockedReason);
      assert.equal(p.hardCore.requiredSeconds, influenceDuration === "quick" ? 6 : 60);
      assert.equal(p.hardCore.applied, true);
      assert.equal(p.total, ordinary.total);
      assert.equal(p.error, ordinary.error);
      assert.equal(p.cap, ordinary.cap);
      assert.equal(p.mode, "Secret");
      assert.equal(p.hardCore.target, facts.hardCoreTarget);
    }
});
test("Hard Core requires a current feat, exactly one named GC-confirmed NPC, an eligible disposition and a chosen duration", () => {
  for (const input of [
    { hardCoreTarget: "" },
    { hardCoreTarget: "x".repeat(201) },
    { hardCoreNPCConfirmed: false },
    { hardCoreNPCConfirmed: "true" },
    { hardCoreDisposition: "friendly" },
    { hardCoreDisposition: "neutral" },
    { hardCoreDisposition: "helpful" },
    { influenceDuration: "" },
    { influenceDuration: "full" }
  ])
    assert.equal(plan(state(), input).blocked, true);
  const s = state();
  s.activeFeatNames = [];
  assert.equal(plan(s).blocked, true);
  for (const [key, skill] of Object.entries(cfg.skills))
    for (const check of skill.checks)
      if (key !== "impress" || check.id !== "influence")
        assert.match(hardCoreInfluencePlan(state(), key, check, facts).blockedReason, /only/);
});
test("the optional benefit never applies without a strict request, and no reduction preserves the chosen quick/slow base time", () => {
  for (const hardCore of [false, "true", undefined]) {
    const p = plan(state(), { hardCore });
    assert.equal(p.hardCore, null);
    assert.equal(p.timeReduction, "none");
  }
  for (const influenceDuration of ["quick", "slow"]) {
    const p = plan(state(), { influenceDuration, timingReduction: "none" });
    assert.equal(p.hardCore.applied, false);
    assert.equal(p.hardCore.requiredSeconds, influenceDuration === "quick" ? 60 : 600);
  }
});
test("take 10/20 and Cross-Check multiply the single selected reduction, never compound another reduction", () => {
  for (const method of ["roll", "take10", "take20"])
    for (const influenceDuration of ["quick", "slow"]) {
      const s = state();
      s.activeFeatNames.push("Attention to Detail");
      s.skillFeatRules = [{ name: "Mark of a Professional", skill: "impress" }];
      const p = plan(s, { method, influenceDuration, safeToTake: true, crossCheckActive: true, unopposed: true });
      assert.equal(p.blocked, false, p.blockedReason);
      assert.equal(p.timeReduction, "hardCore");
      assert.equal(
        p.hardCore.requiredSeconds,
        (influenceDuration === "quick" ? 6 : 60) * { roll: 3, take10: 4, take20: 22 }[method]
      );
      assert.equal(p.crossCheckMultiplier, 3);
      assert.equal(p.timeReductionOptions.filter(c => c.id === "hardCore").length, 1);
      assert.ok(p.timeReductionOptions.some(c => c.id === "professional"));
      const other = plan(s, {
        method,
        influenceDuration,
        safeToTake: true,
        unopposed: true,
        timingReduction: "professional"
      });
      assert.equal(other.hardCore.applied, false);
      assert.equal(
        other.hardCore.requiredSeconds,
        (influenceDuration === "quick" ? 60 : 600) * { roll: 0.5, take10: 1.5, take20: 19.5 }[method]
      );
    }
});
test("recorded target facts, quick/slow choice, timing source and final duration cannot change after outcome evidence is taken", () => {
  const c = { checkKind: "skill", hardCore: plan().hardCore },
    e = rollEvidence(c);
  assert.equal(rollEvidenceMatches(e, c), true);
  for (const key of ["target", "npcConfirmed", "disposition", "duration", "requiredSeconds", "applied", "reduction"]) {
    const changed = structuredClone(c);
    changed.hardCore[key] = "changed";
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
    this.uuid = "Actor.hardCore";
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
          assert.match(options.content, /name="hardCore"/);
          assert.match(options.content, /name="hardCoreNPCConfirmed"/);
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
  assert.equal(p.hardCore.requiredSeconds, 6);
  const before = rolls;
  assert.equal(
    await a.rollSkill("impress", "cha", { check: "influence", ...facts, hardCoreNPCConfirmed: false }),
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
