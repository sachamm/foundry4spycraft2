import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isolatedClassAbilityCalculation as computeAgent } from "./lib/class-ability-fixture.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import {
  restraintState,
  restraintActionBlock,
  restraintSkillContext,
  restraintSkillChecks
} from "../module/rules/restraints.mjs";
import { resolveSkillCheck as resolveBase } from "../module/rules/skills.mjs";
import { resolveKnowledgeCheck } from "../module/rules/knowledge.mjs";
import { weaponAttack } from "../module/rules/gear.mjs";
import { defenseBoostPlan } from "../module/rules/health.mjs";
const grappleOptions = { grappleContextConfirmed: true, grappleProficient: true, grappleSizeDifference: 0 };
const resolveSkillCheck = (system, key, check, options = {}) =>
  resolveBase(system, key, check, { ...grappleOptions, ...options });
const c = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))).find(c => c.key === "soldier"),
  item = {
    id: "soldier",
    name: "Soldier",
    type: "class",
    system: { ...c, identifier: c.key, vitalityDie: c.vitality }
  },
  compute = (conditionContext = {}) =>
    computeAgent(
      {
        conditionContext,
        abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 14 }])),
        progression: [{ classId: "soldier", vitality: 6, skills: { athletics: 4 } }],
        actionDice: { value: 3 },
        vitality: { value: 4 },
        wounds: { value: 4 }
      },
      [structuredClone(item)],
      cfg
    ),
  escape = restraintSkillChecks({ conditionContext: { held: true } }, "athletics").at(-1);
test("Held and Pinned block every voluntary movement mode/bonus step while retaining base Speed, vulnerability and independent states", () => {
  const normal = compute();
  for (const condition of ["held", "pinned"]) {
    const s = compute({ [condition]: true });
    assert.equal(s.speed, 0);
    assert.equal(s.canRun, false);
    assert.equal(s.incapacitatedForMovement, true);
    for (const key of ["standardMove", "bullRush", "withdraw", "bonusStep"])
      assert.equal(s.postureMovement[key], false);
    assert.equal(s.fleetSpeed.baseSpeed, normal.fleetSpeed.baseSpeed);
    assert.equal(s.defense.vulnerable, true);
    assert.equal(s.defense.helpless, false);
    assert.equal(s.actionDice.value, 3);
  }
  assert.equal(restraintState(compute({ held: true, pinned: true })), "pinned");
});
test("all named skill uses retain passive checks but block non-free active checks except the full-action Athletics escape", () => {
  let count = 0;
  for (const condition of ["held", "pinned"]) {
    const s = compute({ [condition]: true });
    for (const [key, skill] of Object.entries(cfg.skills))
      for (const check of skill.checks) {
        const r = resolveSkillCheck(s, key, check, {
          ability: check.attributes[0],
          gearStatus: "available",
          synergySkill: "none"
        });
        if (!r) continue;
        const blocked = new RegExp(condition === "held" ? "Held:" : "Pinned:").test(r.blockedReason),
          allowed =
            (key === "athletics" && check.id === "restraint-escape") ||
            r.mode.includes("Passive") ||
            (condition === "held" && /free action/i.test(check.time ?? ""));
        assert.equal(blocked, !allowed, key + "/" + check.id + "/" + condition);
        count++;
      }
  }
  assert.ok(count >= 200);
});
test("restraint escape becomes one full action with ACP, keeps original ranks/caps and restores ordinary Escape timing/tags after clearing", () => {
  const normal = compute(),
    old = structuredClone(escape);
  normal.armor = { check: -3 };
  for (const condition of ["held", "pinned"]) {
    const s = compute({ [condition]: true });
    s.armor = { check: -3 };
    const r = resolveSkillCheck(s, "athletics", escape, { ability: "str", synergySkill: "none" }),
      n = resolveSkillCheck(
        normal,
        "athletics",
        cfg.skills.athletics.checks.find(c => c.id === "escape"),
        { ability: "str", synergySkill: "none" }
      );
    assert.equal(r.blocked, false, r.blockedReason);
    assert.equal(r.total, n.total - 3);
    assert.deepEqual(r.restraintEscape, {
      condition,
      kind: "opposedGrapple",
      fullActions: 1,
      armorCheckPenalty: true,
      grasp: true,
      proficient: true,
      sizeDifference: 0,
      sizeBonus: 0,
      timeLocked: false
    });
    assert.match(r.notes, /1 Full Action/);
    assert.match(r.notes, /Armor Check Penalty/);
    assert.equal(r.cap, n.cap);
    assert.equal(s.skillTotals.athletics.ranks, normal.skillTotals.athletics.ranks);
  }
  assert.deepEqual(escape, old);
  assert.equal(restraintSkillContext(normal, "athletics", escape).check, escape);
  assert.equal(
    resolveSkillCheck(
      normal,
      "athletics",
      cfg.skills.athletics.checks.find(c => c.id === "escape"),
      { ability: "str" }
    ).restraintEscape,
    null
  );
});
test("Held allows free actions; Pinned allows no separate free action, including defensive boosts, but neither blocks involuntary/passive resolution", () => {
  for (const condition of ["held", "pinned"]) {
    const s = compute({ [condition]: true });
    assert.equal(!!restraintActionBlock(s, { free: true }), condition === "pinned");
    assert.equal(restraintActionBlock(s, { passive: true }), "");
    assert.equal(restraintActionBlock(s, { escape: true }), "");
    assert.ok(restraintActionBlock(s));
    const result = defenseBoostPlan(
      s,
      { started: true, id: "combat", round: 1 },
      { atStartOfRound: true, combatant: true }
    );
    assert.equal(result.blocked, condition === "pinned");
  }
});
test("every catalog weapon attack is blocked for a Held/Pinned attacker, while target-only declarations and damage settlement are separate", () => {
  const weapons = JSON.parse(readFileSync(new URL("../src/data/equipment.json", import.meta.url))).weapons;
  for (const condition of ["held", "pinned"]) {
    const s = compute({ [condition]: true });
    for (const w of weapons) {
      const attack = weaponAttack(s, w, cfg);
      assert.equal(attack.blocked, true, w.name);
      assert.match(
        attack.reason,
        /Held:|Pinned:|operation|space|mount|deploy|launcher|mortar|weapon|load|Load|strength|Strength|hand|Hand/i,
        w.name
      );
    }
  }
  assert.equal(weapons.length, 458);
});
test("passive Knowledge remains available but active Knowledge/taking require actions; Held can combine passive Knowledge with the separate Cunning Plan free action", () => {
  for (const condition of ["held", "pinned"]) {
    const s = compute({ [condition]: true });
    s.activeFeatNames.push("Photographic Memory");
    s.classLevels.schemer = s.activeClassLevels.schemer = 2;
    assert.doesNotMatch(resolveKnowledgeCheck(s, { skill: "search" }).blockedReason, /Held:|Pinned:/);
    for (const options of [
      { active: true },
      { method: "take10", safeToTake: true },
      { method: "take20", safeToTake: true }
    ])
      assert.match(resolveKnowledgeCheck(s, { skill: "search", ...options }).blockedReason, /Held:|Pinned:/);
    const cunning = resolveKnowledgeCheck(s, { skill: "search", cunningPlan: true });
    assert.equal(/Held:|Pinned:/.test(cunning.blockedReason), condition === "pinned");
  }
});
test("specific attribute replacement still applies to an eligible full-action escape, while stronger paralysis/incapacity and separate Pinned free actions remain blocked", () => {
  const s = compute({ pinned: true });
  s.classLevels.schemer = s.activeClassLevels.schemer = 4;
  const according = resolveSkillCheck(s, "athletics", escape, { ability: "str", allAccordingToPlan: true });
  assert.equal(according.blocked, false, according.blockedReason);
  assert.equal(according.ability, "int");
  assert.match(
    resolveSkillCheck(s, "athletics", escape, { ability: "str", cunningPlan: true }).blockedReason,
    /separate free action/
  );
  for (const extra of ["paralyzed", "unconscious", "stunned", "dead"])
    assert.equal(
      resolveSkillCheck(compute({ held: true, [extra]: true }), "athletics", escape, { ability: "str" }).blocked,
      true
    );
});

test("opposed Grapple escape is distinct from static-restraint Escape, with Grasp and no imported static-bond synergies", () => {
  const s = compute({ held: true }),
    staticEscape = cfg.skills.athletics.checks.find(c => c.id === "escape"),
    checks = restraintSkillChecks(s, "athletics", cfg.skills.athletics.checks),
    grapple = checks.find(c => c.id === "restraint-escape");
  assert.equal(checks.filter(c => c.id === "escape").length, 1);
  assert.deepEqual(grapple.synergies, []);
  assert.match(grapple.tags, /Grasp/);
  assert.equal(grapple.page, 357);
  assert.equal(resolveSkillCheck(s, "athletics", staticEscape, { ability: "str" }).blocked, true);
  assert.equal(resolveSkillCheck(s, "athletics", grapple, { ability: "str" }).blocked, false);
  const bound = compute({ held: true, bound: true });
  assert.match(resolveSkillCheck(bound, "athletics", grapple, { ability: "str" }).blockedReason, /Bound/);
  assert.equal(restraintSkillChecks(compute(), "athletics", cfg.skills.athletics.checks), cfg.skills.athletics.checks);
});

test("Grapple requires reviewed proficiency and Size context; the larger participant gains +4 per category on their own check", () => {
  const s = compute({ held: true });
  assert.match(resolveBase(s, "athletics", escape, { ability: "str" }).blockedReason, /Confirm.*Grapple/);
  const normal = resolveSkillCheck(s, "athletics", escape, { ability: "str" });
  for (const difference of [-2, -1, 0, 1, 2]) {
    const r = resolveSkillCheck(s, "athletics", escape, { ability: "str", grappleSizeDifference: difference });
    assert.equal(r.total, normal.total + 4 * Math.max(0, difference));
    assert.equal(r.restraintEscape.sizeBonus, 4 * Math.max(0, difference));
  }
  assert.match(
    resolveSkillCheck(s, "athletics", escape, { ability: "str", grappleSizeDifference: 0.5 }).blockedReason,
    /Confirm/
  );
});
test("untrained Grapple doubles its action time and raises error by two; no time-reducing ability can shorten it", () => {
  const s = compute({ held: true });
  s.classLevels.scientist = s.activeClassLevels.scientist = 14;
  s.classLevels.schemer = s.activeClassLevels.schemer = 4;
  const trained = resolveSkillCheck(s, "athletics", escape, { ability: "str" }),
    untrained = resolveSkillCheck(s, "athletics", escape, { ability: "str", grappleProficient: false }),
    solution = resolveSkillCheck(s, "athletics", escape, {
      ability: "str",
      grappleProficient: false,
      allAccordingToPlan: true,
      tenSecondSolution: true,
      standaloneCheckConfirmed: true
    });
  assert.equal(untrained.error, trained.error + 2);
  assert.match(untrained.notes, /2 Full Actions/);
  assert.equal(untrained.timeMultiplier, 1);
  assert.equal(untrained.restraintEscape.timeLocked, true);
  assert.equal(solution.timeMultiplier, 1);
  assert.equal(solution.timeReduction, "none");
  assert.equal(solution.restraintEscape.fullActions, 2);
});
