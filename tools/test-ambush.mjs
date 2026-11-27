// These fixtures supply required gear unless a case explicitly overrides gearStatus; absence/kit boundaries are tested in test-skill-gear.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { ambushCheckPlan } from "../module/rules/ambush.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { criticalPlan } from "../module/rules/criticals.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const check = cfg.skills.tactics.checks.find(c => c.id === "ambush"),
  state = () => ({
    classLevels: {},
    actionDice: { value: 0 },
    activeFeatNames: [],
    skillTotals: {
      tactics: {
        name: "Tactics",
        ranks: 9,
        cap: 40,
        threat: 20,
        totals: [
          { ability: "wis", total: 12 },
          { ability: "cha", total: 10 }
        ]
      },
      senseMotive: { ranks: 15, totals: [{ ability: "wis", total: 18 }] }
    }
  });
test("quick and slow preparation preserve the detailed skill’s separate time, error and outcome rewards", () => {
  for (const [ambushPreparation, seconds, error, initiative, dice] of [
    ["quick", 60, 2, 2, 1],
    ["slow", 600, 0, 5, 2]
  ]) {
    const p = ambushCheckPlan(state(), "tactics", check, { ambushPreparation }),
      r = resolveSkillCheck(state(), "tactics", check, {
        gearStatus: "available",
        ambushPreparation,
        synergySkill: "none"
      });
    assert.equal(p.baseSeconds, seconds);
    assert.equal(p.errorIncrease, error);
    assert.equal(p.initiativeBonus, initiative);
    assert.equal(p.surpriseSneakDice, dice);
    assert.equal(r.error, 1 + error);
    assert.equal(r.ambush.preparation, ambushPreparation);
    assert.equal(r.rollMode, "blindroll");
  }
  assert.throws(() => ambushCheckPlan(state(), "tactics", check, { ambushPreparation: "instant" }));
  assert.throws(() => ambushCheckPlan(state(), "tactics", check, { ambushRole: "observer" }));
});
test("Basics grants Cross-Check only for the actual Ambush leader/helper; a declaration cannot invent the feat", () => {
  for (const owned of [false, true])
    for (const ambushRole of ["", "leader", "helper"]) {
      const s = state();
      if (owned) s.activeFeatNames = ["Ambush Basics"];
      const r = resolveSkillCheck(s, "tactics", check, { gearStatus: "available", ambushRole, crossCheckActive: true });
      assert.equal(r.blocked, !(owned && !!ambushRole));
      if (!r.blocked) {
        assert.equal(r.timeMultiplier, 3);
        assert.equal(r.rollMode, undefined);
      }
    }
  for (const c of cfg.skills.tactics.checks.filter(c => c.id !== "ambush")) {
    const p = ambushCheckPlan({ ...state(), activeFeatNames: ["Ambush Basics", "Ambush Mastery"] }, "tactics", c, {
      ambushRole: "leader"
    });
    assert.equal(p.applicable, false);
    assert.equal(p.threatIncrease, 0);
    assert.equal(p.crossCheckGranted, false);
  }
});
test("Mastery’s quick reduction is explicit, preserves the base quick penalty and adds its own error increase", () => {
  const s = { ...state(), activeFeatNames: ["Ambush Basics", "Ambush Mastery"] },
    normal = resolveSkillCheck(s, "tactics", check, { gearStatus: "available", ambushPreparation: "quick" });
  assert.equal(normal.timeMultiplier, 1);
  assert.equal(normal.error, 3);
  assert.equal(normal.threat, 19);
  const fast = resolveSkillCheck(s, "tactics", check, {
    gearStatus: "available",
    ambushPreparation: "quick",
    timingReduction: "ambushMastery"
  });
  assert.equal(fast.timeMultiplier, 0.1);
  assert.equal(fast.error, 5);
  assert.equal(fast.ambush.baseSeconds * fast.timeMultiplier, 6);
  assert.equal(fast.minimumTimeSeconds, 0);
  assert.equal(fast.ambush.requiredPreparationSeconds, 6);
  assert.equal(
    resolveSkillCheck(s, "tactics", check, { gearStatus: "available", timingReduction: "ambushMastery" }).blocked,
    true
  );
  assert.equal(
    resolveSkillCheck(state(), "tactics", check, {
      gearStatus: "available",
      ambushPreparation: "quick",
      timingReduction: "ambushMastery"
    }).blocked,
    true
  );
});
test("Cross-Check triples the selected preparation after the single reduction and Sense Motive never stacks with itself", () => {
  const s = { ...state(), activeFeatNames: ["Ambush Basics", "Ambush Mastery"] },
    r = resolveSkillCheck(s, "tactics", check, {
      gearStatus: "available",
      ambushPreparation: "quick",
      ambushRole: "helper",
      crossCheckActive: true,
      timingReduction: "ambushMastery",
      synergySkill: "senseMotive"
    });
  assert.ok(Math.abs(r.ambush.baseSeconds * r.timeMultiplier - 18) < 0.000001);
  assert.equal(r.error, 5);
  assert.equal(r.ambush.requiredPreparationSeconds, 18);
  assert.equal(r.total, 15);
  assert.equal(r.synergy, 3);
  s.activeFeatNames = ["Ambush Basics"];
  const noMastery = resolveSkillCheck(s, "tactics", check, {
    gearStatus: "available",
    ambushPreparation: "quick",
    ambushRole: "helper",
    crossCheckActive: true,
    synergySkill: "senseMotive"
  });
  assert.equal(noMastery.total, r.total);
  assert.equal(noMastery.ambush.baseSeconds * noMastery.timeMultiplier, 180);
});
test("Mastery competes with other time reductions rather than multiplying; taking 10 retains its base method multiplier and error guard", () => {
  const s = {
      ...state(),
      activeFeatNames: ["Ambush Mastery"],
      skillFeatRules: [{ name: "Mark of a Professional", skill: "tactics" }]
    },
    r = resolveSkillCheck(s, "tactics", check, {
      gearStatus: "available",
      ambushPreparation: "quick",
      unopposed: true,
      timingReduction: "ambushMastery"
    });
  assert.equal(r.timeMultiplier, 0.1);
  const other = resolveSkillCheck(s, "tactics", check, {
    gearStatus: "available",
    ambushPreparation: "quick",
    unopposed: true,
    timingReduction: "professional"
  });
  assert.equal(other.timeMultiplier, 0.5);
  assert.equal(other.error, 3);
  const taking = resolveSkillCheck(s, "tactics", check, {
    gearStatus: "available",
    ambushPreparation: "quick",
    method: "take10",
    safeToTake: true,
    timingReduction: "ambushMastery"
  });
  assert.equal(taking.timeMultiplier, 0.2);
  assert.equal(taking.blocked, true);
  assert.match(taking.blockedReason, /error range/);
});
test("Supremacy discounts only successful Tactics/Ambush activations, to minimum zero, and stacks with independent mastery sources", () => {
  const s = { activeFeatNames: ["Ambush Supremacy"] },
    c = { checkKind: "skill", skillKey: "tactics", checkId: "ambush", threatConfirmed: true },
    o = { baseCost: 1, effect: "Two free half actions", effectConfirmed: true, available: 0 };
  assert.equal(criticalPlan(s, c, o).cost, 0);
  for (const patch of [{ skillKey: "sneak" }, { checkId: "rally" }, { checkKind: "knowledge" }])
    assert.equal(criticalPlan(s, { ...c, ...patch }, { ...o, available: 4 }).cost, 1);
  assert.equal(criticalPlan({}, c, { ...o, available: 4 }).cost, 1);
  const stacked = { ...s, skillFeatRules: [{ name: "Grand Skill Mastery", choice: "Tactician", skill: "tactics" }] };
  assert.equal(criticalPlan(stacked, c, { ...o, baseCost: 3, available: 4 }).cost, 1);
  assert.equal(criticalPlan(stacked, c, o).cost, 0);
});
globalThis.Actor = class {
  constructor() {
    this.system = { ...state(), activeFeatNames: ["Ambush Basics", "Ambush Mastery"] };
    this.items = [];
    this.uuid = "Actor.ambush";
    this.type = "agent";
    this.isOwner = true;
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = { user: { isGM: true }, settings: { get: () => false }, i18n: { localize: s => s } };
globalThis.foundry = { utils: { escapeHTML: s => String(s) } };
globalThis.ui = { notifications: { warn: s => ({ warning: s }) } };
const { SpycraftActor } = await import("../module/documents/actor.mjs");
test("the real skill entry freezes preparation/rewards and final numeric ranges into the roll receipt without spending resources", async () => {
  const a = new SpycraftActor();
  a.rollCheck = async (formula, data, options) => ({ formula, data, options });
  const m = await a.rollSkill("tactics", "wis", {
    gearStatus: "available",
    check: "ambush",
    ambushPreparation: "quick",
    ambushRole: "leader",
    crossCheckActive: true,
    timingReduction: "ambushMastery",
    synergySkill: "senseMotive"
  });
  assert.equal(m.data.total, 15);
  assert.equal(m.options.error, 5);
  assert.equal(m.options.threat, 19);
  assert.equal(m.options.ambush.preparation, "quick");
  assert.equal(m.options.ambush.surpriseSneakDice, 1);
  assert.match(m.options.flavor, /1 minute/);
  assert.equal(a.system.actionDice.value, 0);
});

test("user ruling: Supremacy reduces the standard ten-minute slow ambush to one minute without replacing its rewards or Mastery’s threat benefit", () => {
  const s = { ...state(), activeFeatNames: ["Ambush Basics", "Ambush Mastery", "Ambush Supremacy"] },
    normal = resolveSkillCheck(s, "tactics", check, { gearStatus: "available", ambushPreparation: "slow" });
  assert.equal(normal.ambush.requiredPreparationSeconds, 600);
  assert.equal(normal.error, 1);
  const fast = resolveSkillCheck(s, "tactics", check, {
    gearStatus: "available",
    ambushPreparation: "slow",
    timingReduction: "ambushSupremacy"
  });
  assert.equal(fast.ambush.requiredPreparationSeconds, 60);
  assert.equal(fast.error, 3);
  assert.equal(fast.threat, 19);
  assert.equal(fast.ambush.initiativeBonus, 5);
  assert.equal(fast.ambush.surpriseSneakDice, 2);
  const cross = resolveSkillCheck(s, "tactics", check, {
    gearStatus: "available",
    ambushPreparation: "slow",
    ambushRole: "leader",
    crossCheckActive: true,
    timingReduction: "ambushSupremacy"
  });
  assert.equal(cross.ambush.requiredPreparationSeconds, 180);
  assert.equal(cross.error, 3);
  assert.equal(
    resolveSkillCheck(s, "tactics", check, {
      gearStatus: "available",
      ambushPreparation: "quick",
      timingReduction: "ambushSupremacy"
    }).blocked,
    true
  );
  assert.equal(
    resolveSkillCheck(state(), "tactics", check, {
      gearStatus: "available",
      ambushPreparation: "slow",
      timingReduction: "ambushSupremacy"
    }).blocked,
    true
  );
});
test("Supremacy is an explicit single-source reduction with the normal take-10 error and permission restrictions", () => {
  const s = {
      ...state(),
      activeFeatNames: ["Ambush Supremacy"],
      skillFeatRules: [{ name: "Mark of a Professional", skill: "tactics" }]
    },
    input = { ambushPreparation: "slow", unopposed: true };
  const automatic = resolveSkillCheck(s, "tactics", check, { gearStatus: "available", ...input });
  assert.equal(automatic.ambush.requiredPreparationSeconds, 300);
  assert.equal(automatic.error, 1);
  const chosen = resolveSkillCheck(s, "tactics", check, {
    gearStatus: "available",
    ...input,
    timingReduction: "ambushSupremacy"
  });
  assert.equal(chosen.ambush.requiredPreparationSeconds, 60);
  assert.equal(chosen.error, 3);
  const take = resolveSkillCheck(s, "tactics", check, {
    gearStatus: "available",
    ...input,
    timingReduction: "ambushSupremacy",
    method: "take10",
    safeToTake: true,
    gcTakingPermissionConfirmed: true
  });
  assert.equal(take.ambush.requiredPreparationSeconds, 120);
  assert.equal(take.blocked, true);
  assert.match(take.blockedReason, /error range/);
});

test("a critical hit on a Henchman or Mastermind costs more, and their threat range is narrower", async () => {
  const { targetRoleCriticalRules, threatAgainstRole } = await import("../module/rules/npc-qualities.mjs");
  const role = targetRoleCriticalRules({
    qualityEffects: { role: { id: "henchman", threatRangeReduction: 1, extraDiceToActivate: 1 } }
  });
  assert.deepEqual([role.id, role.threatRangeReduction, role.extraDiceToActivate], ["henchman", 1, 1]);
  assert.equal(targetRoleCriticalRules({ qualityEffects: { role: { id: "minion", threatRangeReduction: 0 } } }), null);
  assert.equal(targetRoleCriticalRules({}), null);
  assert.equal(threatAgainstRole(20, role), 21, "a natural 20 alone no longer threatens");
  assert.equal(threatAgainstRole(18, role), 19);
  assert.equal(threatAgainstRole(0, role), 0);
  assert.equal(threatAgainstRole(19, null), 19);
  const check = { checkKind: "attack", threatConfirmed: true, attackContext: { targetRole: role } },
    options = { baseCost: 1, effect: "Critical hit", effectConfirmed: true, beforeDamage: true, available: 4 };
  const plan = criticalPlan({}, check, options);
  assert.equal(plan.cost, 2);
  assert.match(plan.sources.join(), /Henchman target \+1/);
  assert.equal(criticalPlan({}, { ...check, attackContext: {} }, options).cost, 1);
});

test("Resolve reads the villain role of the target actually hit (pp.447–448)", async () => {
  const { resolvedTargetRole } = await import("../module/rules/npc-qualities.mjs");
  const henchman = { qualityEffects: { role: { id: "henchman", threatRangeReduction: 1, extraDiceToActivate: 1 } } };
  const declared = { id: "henchman", label: "Henchman", threatRangeReduction: 1, extraDiceToActivate: 1 };
  assert.equal(
    resolvedTargetRole({ threat: 20, attackContext: { targetRole: declared, baseThreat: 19 } }, henchman),
    null
  );
  assert.deepEqual(resolvedTargetRole({ threat: 20, attackContext: { targetRole: declared, baseThreat: 19 } }, {}), {
    threat: 19,
    role: null
  });
  const fresh = resolvedTargetRole({ threat: 19, attackContext: {} }, henchman);
  assert.equal(fresh.threat, 20);
  assert.equal(fresh.role.id, "henchman");
  assert.equal(resolvedTargetRole({ threat: 20, attackContext: { targetRole: declared } }, {}).threat, 19);
});
