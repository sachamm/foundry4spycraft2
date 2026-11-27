import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isolatedClassAbilityCalculation as computeAgent } from "./lib/class-ability-fixture.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { skillTagPlan } from "../module/rules/skill-tags.mjs";
import { weaponAttack, weaponDamage } from "../module/rules/gear.mjs";
import { refreshPlan } from "../module/rules/health.mjs";
const defs = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))),
  ci = key => {
    const c = defs.find(c => c.key === key);
    return { id: key, name: c.name, type: "class", system: { ...c, identifier: key, vitalityDie: c.vitality } };
  },
  items = [ci("soldier"), ci("schemer")],
  source = () => ({
    conditionContext: {},
    abilities: Object.fromEntries(
      ["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: k === "dex" ? 16 : k === "int" ? 14 : 12 }])
    ),
    progression: [
      ...Array.from({ length: 4 }, () => ({ classId: "soldier", vitality: 6, skills: {} })),
      ...Array.from({ length: 4 }, () => ({ classId: "schemer", vitality: 6, skills: {} }))
    ],
    actionDice: { value: 2 },
    vitality: { value: 4 },
    wounds: { value: 4 }
  }),
  compute = (conditions = {}) =>
    computeAgent({ ...source(), conditionContext: conditions }, structuredClone(items), cfg),
  balance = cfg.skills.acrobatics.checks.find(c => c.id === "balance"),
  opts = { gearStatus: "available", synergySkill: "none" };
test("Entangled applies exactly −2 attacks and −4 Dexterity skill checks, preserving attributes, saves, Defense, health/dice and other skill abilities", () => {
  const a = compute(),
    b = compute({ entangled: true });
  for (const key of Object.keys(cfg.skills)) {
    for (const t of a.skillTotals[key].totals)
      assert.equal(
        b.skillTotals[key].totals.find(v => v.ability === t.ability).total,
        t.total - (t.ability === "dex" ? 4 : 0),
        key + "/" + t.ability
      );
  }
  for (const key of ["str", "dex", "con", "int", "wis", "cha"])
    assert.equal(b.abilities[key].value, a.abilities[key].value);
  for (const key of ["fort", "ref", "will"]) assert.equal(b.saves[key].total, a.saves[key].total);
  for (const key of ["unarmed", "melee", "ranged"]) assert.equal(b.attack[key], a.attack[key] - 2);
  assert.equal(b.defense.total, a.defense.total);
  assert.equal(b.vulnerable, false);
  assert.equal(b.speed, 15);
  assert.equal(b.canRun, false);
  assert.equal(b.knowledge, a.knowledge);
  assert.equal(b.actionDice.value, 2);
  assert.equal(b.wounds.value, 4);
});
test("Bound inherits Entangled once, adds helplessness/no movement and restricts every Grasp/Hands-On use including transmitting Innuendo", () => {
  const a = compute(),
    b = compute({ bound: true }),
    both = compute({ bound: true, entangled: true });
  assert.equal(b.helpless, true);
  assert.equal(b.vulnerable, true);
  assert.equal(b.defense.total, a.defense.total - 3);
  assert.equal(b.speed, 0);
  assert.equal(b.canRun, false);
  assert.equal(b.attack.melee, a.attack.melee - 2);
  assert.equal(both.attack.melee, b.attack.melee);
  for (const key of Object.keys(cfg.skills))
    for (const c of cfg.skills[key].checks ?? []) {
      const p = skillTagPlan(b, key, c);
      if (/Hands\s*[-–—]?\s*On|\bGrasp\b/i.test(c.tags)) assert.match(p.blockedReason, /Bound/, key + "/" + c.id);
    }
  assert.match(
    skillTagPlan(b, "senseMotive", { id: "innuendo", tags: "" }, { conveyingMessage: true }).blockedReason,
    /Bound/
  );
  assert.equal(skillTagPlan(b, "senseMotive", { id: "innuendo", tags: "" }).blockedReason, "");
});
test("Jump/Tumble stay forbidden regardless of chosen/substituted ability; actual actor Bound state and the existing per-check declaration both apply", () => {
  for (const conditions of [{ entangled: true }, { bound: true }])
    for (const id of ["jump", "tumble"]) {
      const s = compute(conditions),
        c = cfg.skills.acrobatics.checks.find(c => c.id === id);
      for (const allAccordingToPlan of [false, true])
        assert.match(
          resolveSkillCheck(s, "acrobatics", c, { ...opts, allAccordingToPlan }).blockedReason,
          /Jump and Tumble/
        );
    }
  const normal = compute(),
    p = resolveSkillCheck(normal, "acrobatics", balance, { ...opts, bound: true });
  assert.equal(p.total, resolveSkillCheck(normal, "acrobatics", balance, opts).total - 4);
  assert.match(
    resolveSkillCheck(
      normal,
      "acrobatics",
      cfg.skills.acrobatics.checks.find(c => c.id === "jump"),
      { ...opts, bound: true }
    ).blockedReason,
    /Jump and Tumble/
  );
});
test("All According to Plan removes the Dexterity-only penalty when Intelligence replaces it, with no penalty added back or applied twice", () => {
  const a = compute(),
    b = compute({ entangled: true }),
    d = compute({ bound: true }),
    normal = resolveSkillCheck(a, "acrobatics", balance, { ...opts, allAccordingToPlan: true });
  for (const s of [b, d]) {
    const dex = resolveSkillCheck(s, "acrobatics", balance, opts),
      int = resolveSkillCheck(s, "acrobatics", balance, { ...opts, allAccordingToPlan: true });
    assert.equal(dex.total, resolveSkillCheck(a, "acrobatics", balance, opts).total - 4);
    assert.equal(int.total, normal.total);
    assert.equal(int.ability, "int");
  }
  assert.equal(
    resolveSkillCheck(a, "acrobatics", balance, { ...opts, bound: true, allAccordingToPlan: true }).total,
    normal.total
  );
  const mixed = compute({ entangled: true, sickened: true });
  assert.equal(
    resolveSkillCheck(mixed, "acrobatics", balance, { ...opts, allAccordingToPlan: true }).total,
    normal.total - 2
  );
});
test("Entangled/Bound and Sickened penalties stack across real weapon checks but only Sickened affects damage; Refresh rejects each condition", () => {
  const w = { proficiency: "edged", damage: "1d6", sizeHands: "S/1h", errorThreat: "1/20", qualities: "" },
    a = compute(),
    b = compute({ entangled: true, sickened: true });
  assert.equal(weaponAttack(b, w, cfg).total, weaponAttack(a, w, cfg).total - 4);
  assert.equal(weaponDamage(b, w).bonus, weaponDamage(a, w).bonus - 2);
  const combat = { id: "c", started: true, round: 1 },
    opt = { combatantId: "me", currentCombatantId: "me", forfeitActions: true };
  for (const flag of ["entangled", "bound"])
    assert.match(refreshPlan(compute({ [flag]: true }), combat, opt).reason, /condition/);
});
test("one Speed-halving condition rounds down, Bound immobility takes precedence, and unresolved overlapping halves require review rather than silently choosing a rule", () => {
  const odd = source();
  odd.misc = { speed: 1 };
  odd.conditionContext = { entangled: true };
  assert.equal(computeAgent(odd, structuredClone(items), cfg).speed, 15);
  const mixed = compute({ entangled: true, exhausted: true });
  assert.equal(mixed.conditionSpeedReview, true);
  assert.equal(mixed.speed, null);
  assert.equal(mixed.canRun, false);
  assert.ok(mixed.warnings.some(w => w.includes("combined multiplier")));
  const bound = compute({ bound: true, exhausted: true });
  assert.equal(bound.speed, 0);
  assert.equal(bound.conditionSpeedReview, false);
});

test("actual Repair and every wrapped Hands-On tag spelling enforce Bound and one-handed penalties, including the Two-Weapon Basics exception", () => {
  const s = compute(),
    repair = cfg.skills.mechanics.checks.find(c => c.id === "repair");
  assert.equal(skillTagPlan(s, "mechanics", repair, { oneHanded: true }).handPenalty, -4);
  assert.match(resolveSkillCheck(s, "mechanics", repair, { ...opts, bound: true }).blockedReason, /Bound/);
  for (const tags of ["Hands-On", "Hands- On", "Hands -On", "hands on", "Grasp"]) {
    const c = { id: "example", tags };
    assert.match(skillTagPlan(compute({ bound: true }), "mechanics", c).blockedReason, /Bound/);
    if (tags !== "Grasp") {
      assert.equal(skillTagPlan(s, "mechanics", c, { oneHanded: true }).handPenalty, -4);
      assert.equal(
        skillTagPlan({ ...s, activeFeatNames: [...s.activeFeatNames, "Two-Weapon Basics"] }, "mechanics", c, {
          oneHanded: true
        }).handPenalty,
        -2
      );
    }
  }
});

test("Crouched-target attack penalty applies once to ranged weapons and is recorded separately from actor conditions", () => {
  const s = compute(),
    ranged = {
      proficiency: "handgun",
      range: 30,
      damage: "1d6",
      sizeHands: "S/1h",
      errorThreat: "1/20",
      qualities: ""
    },
    melee = { proficiency: "edged", damage: "1d6", sizeHands: "S/1h", errorThreat: "1/20", qualities: "" };
  for (const w of [ranged, melee]) {
    const a = weaponAttack(s, w, cfg),
      b = weaponAttack(s, w, cfg, "agent", { targetCrouchedNonAdjacent: true });
    assert.equal(b.total, a.total - (b.ranged ? 1 : 0));
    assert.equal(b.targetPosturePenalty, b.ranged ? -1 : 0);
  }
  const odd = source();
  odd.misc = { speed: 1 };
  odd.conditionContext = { crouched: true };
  assert.equal(computeAgent(odd, structuredClone(items), cfg).speed, 15);
});

test("Prone restricts movement actions without lowering base Speed and applies only its own melee attack penalty", () => {
  const a = compute(),
    p = compute({ prone: true });
  assert.equal(p.speed, a.speed);
  assert.equal(p.canRun, false);
  assert.equal(p.postureMovement.standardMove, false);
  assert.equal(p.postureMovement.bullRush, false);
  assert.equal(p.postureMovement.withdraw, false);
  assert.equal(p.postureMovement.bonusStep, true);
  assert.equal(p.attack.melee, a.attack.melee - 2);
  assert.equal(p.attack.unarmed, a.attack.unarmed - 2);
  assert.equal(p.attack.ranged, a.attack.ranged);
  assert.equal(p.defense.total, a.defense.total);
  for (const w of [
    { proficiency: "edged", damage: "1d6", sizeHands: "S/1h", errorThreat: "1/20", qualities: "" },
    { proficiency: "handgun", range: 30, damage: "1d6", sizeHands: "S/1h", errorThreat: "1/20", qualities: "" }
  ]) {
    const base = weaponAttack(a, w, cfg),
      own = weaponAttack(p, w, cfg),
      target = weaponAttack(a, w, cfg, "agent", { targetProneNonAdjacent: true });
    assert.equal(own.total, base.total - (own.ranged ? 0 : 2));
    assert.equal(target.total, base.total - (target.ranged ? 2 : 0));
    assert.equal(weaponDamage(p, w).bonus, weaponDamage(a, w).bonus);
  }
});
test("Sprawled applies vulnerability, blocks translational movement and penalizes all attacks once, including STR-zero collapse", () => {
  const a = compute(),
    p = compute({ sprawled: true });
  assert.equal(p.vulnerable, true);
  assert.equal(p.canRun, false);
  assert.equal(p.postureMovement.bonusStep, false);
  assert.equal(p.postureMovement.standardMove, false);
  for (const k of ["unarmed", "melee", "ranged"]) assert.equal(p.attack[k], a.attack[k] - 2);
  const raw = source();
  raw.abilities.str.base = 0;
  const c = computeAgent(raw, structuredClone(items), cfg);
  assert.equal(c.conditionPenalties.sprawled, true);
  assert.equal(c.postureMovement.sprawled, true);
  assert.equal(c.postureMovement.bonusStep, false);
});
