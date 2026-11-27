import test from "node:test";
import assert from "node:assert/strict";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { criticalPlan } from "../module/rules/criticals.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";

const state = effects => ({
  campaignEffects: effects,
  abilities: Object.fromEntries(
    ["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: k === "str" ? 8 : 12 }])
  ),
  skillTotals: Object.fromEntries(
    Object.entries(cfg.skills).map(([key, skill]) => [
      key,
      {
        name: skill.name,
        ranks: 5,
        cap: 30,
        threat: 20,
        totals: skill.abilities.map(ability => ({ ability, total: 7 }))
      }
    ])
  )
});

test("Medicine campaign error changes include combat penalties, retain minimum one and do not affect other skills", () => {
  const check = cfg.skills.medicine.checks.find(c => c.id === "surgery");
  for (const combatInSight of [false, true]) {
    const base = resolveSkillCheck(state({}), "medicine", check, { combatInSight }).error;
    assert.equal(resolveSkillCheck(state({ medicineError: 2 }), "medicine", check, { combatInSight }).error, base + 2);
    assert.equal(
      resolveSkillCheck(state({ medicineError: -2 }), "medicine", check, { combatInSight }).error,
      Math.max(1, base - 2)
    );
  }
  const other = cfg.skills.bureaucracy.checks[0];
  assert.equal(
    resolveSkillCheck(state({ medicineError: 2 }), "bureaucracy", other).error,
    resolveSkillCheck(state({}), "bureaucracy", other).error
  );
});

test("Tense prevents taking 10 even with normal-time benefits or GC permission, without forbidding taking20 or rolled checks", () => {
  const check = {
    ...cfg.skills.bureaucracy.checks[0],
    time: "1 Minute (Take 10 with permission; Take 20 with permission)",
    tags: [],
    error: 1
  };
  const s = state({ forbidTake10: true });
  s.skillTotals.bureaucracy.take10TimeMultiplier = 1;
  const options = { safeToTake: true, gcTakingPermissionConfirmed: true };
  const taking = resolveSkillCheck(s, "bureaucracy", check, { ...options, method: "take10" });
  assert.equal(taking.blocked, true);
  assert.match(taking.blockedReason, /Tense campaign quality/);
  for (const method of ["roll", "take20"]) {
    const r = resolveSkillCheck(s, "bureaucracy", check, { ...options, method });
    assert.equal(r.blocked, false, r.blockedReason);
  }
  assert.equal(resolveSkillCheck(state({}), "bureaucracy", check, { ...options, method: "take10" }).blocked, false);
});

test("Comedy of Errors penalizes checks keyed to tied lowest attribute scores and changes take-10 base timing", () => {
  const s = state({ lowestAttributeSkillError: 2, take10Base: 4 });
  const athletics = cfg.skills.athletics.checks.find(c => c.attributes.includes("str"));
  assert.equal(
    resolveSkillCheck(s, "athletics", athletics, { ability: "str" }).error,
    resolveSkillCheck(state({}), "athletics", athletics, { ability: "str" }).error + 2
  );
  s.abilities.cha.value = 8;
  const check = { ...cfg.skills.bureaucracy.checks[0], time: "1 Minute", tags: [], error: 1 };
  assert.equal(resolveSkillCheck(s, "bureaucracy", check, { ability: "cha" }).error, 3);
  s.abilities.cha.value = 12;
  assert.equal(resolveSkillCheck(s, "bureaucracy", check, { method: "take10", safeToTake: true }).timeMultiplier, 4);
  s.skillTotals.bureaucracy.take10TimeMultiplier = 1;
  assert.equal(resolveSkillCheck(s, "bureaucracy", check, { method: "take10", safeToTake: true }).timeMultiplier, 1);
  assert.equal(resolveSkillCheck(s, "bureaucracy", check, { method: "take20", safeToTake: true }).timeMultiplier, 20);
});

test("Comedy of Errors rejects skill error activations costing more than two dice, including increased costs", () => {
  const check = { checkKind: "skill", errorConfirmed: true };
  const options = {
    kind: "failure",
    effect: "Complication",
    effectConfirmed: true,
    samePayer: false,
    opponent: true,
    lineOfSight: true,
    available: 10,
    campaignEffects: { skillErrorActivationMaximum: 2 }
  };
  assert.equal(criticalPlan({}, check, { ...options, baseCost: 2 }).blocked, false);
  assert.equal(criticalPlan({}, check, { ...options, baseCost: 3 }).blocked, true);
  assert.equal(
    criticalPlan({}, { ...check, criticalFailureCostIncrease: 1 }, { ...options, baseCost: 2 }).blocked,
    true
  );
  assert.equal(criticalPlan({}, { ...check, checkKind: "attack" }, { ...options, baseCost: 3 }).blocked, false);
});
