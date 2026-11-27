import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  shakenStateFromActor,
  shakenStateFromContext,
  shakenRules,
  shakenSkillPenalty
} from "../module/rules/shaken.mjs";
import { isolatedClassAbilityCalculation as computeAgent } from "./lib/class-ability-fixture.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { resolveKnowledgeCheck } from "../module/rules/knowledge.mjs";
import { weaponAttack } from "../module/rules/gear.mjs";
const definition = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))).find(
    c => c.key === "soldier"
  ),
  item = {
    id: "soldier",
    name: "Soldier",
    type: "class",
    system: { ...definition, identifier: "soldier", vitalityDie: definition.vitality }
  },
  compute = (grade = 0, extra = {}) =>
    computeAgent(
      {
        conditionContext: { shakenGrade: grade, ...extra },
        abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 14 }])),
        progression: [{ classId: "soldier", vitality: 6, skills: { athletics: 4, notice: 4, tactics: 4 } }],
        actionDice: { value: 5 },
        vitality: { value: 4 },
        wounds: { value: 4 }
      },
      [structuredClone(item)],
      cfg
    );
const effect = (id, statuses, grade, active = true) => ({
  id,
  uuid: "Effect." + id,
  name: id,
  statuses: new Set(statuses),
  active,
  flags: { spycraft2: grade === undefined ? {} : { shakenGrade: grade } }
});
test("Shaken adds active source grades, deduplicates aliases within a source and retains accumulated grades without inventing effects beyond IV", () => {
  const one = effect("one", ["shaken", "shaken-I"]),
    two = effect("two", ["shaken-2"], 2),
    three = effect("three", ["shaken_III"]);
  assert.equal(shakenStateFromActor({ effects: [one, two] }).grade, 3);
  assert.equal(shakenStateFromActor({ effects: [one, one] }).grade, 1);
  const state = shakenStateFromActor({
    effects: [three, structuredClone({ ...three, statuses: undefined }), effect("other", ["shaken-3"])].filter(
      e => e.statuses
    )
  });
  assert.equal(state.totalGrade, 6);
  assert.equal(state.grade, 4);
  assert.equal(state.label, "Shaken IV");
  assert.equal(shakenStateFromActor({ effects: [effect("disabled", ["shaken-4"], 4, false)] }).grade, 0);
  assert.equal(shakenStateFromActor({ effects: [], appliedEffects: [two] }).grade, 2);
});
test("malformed, conflicting, unsupported and unidentified Shaken sources require review rather than silently choosing a grade", () => {
  for (const source of [
    effect("bad", ["shaken"], 0),
    effect("bad", ["shaken"], "2"),
    effect("bad", ["shaken"], 1.5),
    effect("bad", ["shaken-2"], 3),
    effect("bad", ["shaken-2", "shaken-3"]),
    effect("bad", ["shaken-v"])
  ]) {
    const state = shakenStateFromActor({ effects: [source] });
    assert.equal(state.needsReview, true);
    assert.equal(state.grade, null);
  }
  assert.equal(shakenStateFromActor({ effects: [], statuses: new Set(["shaken"]) }).needsReview, true);
  assert.equal(shakenStateFromContext({ shakenGrade: -1 }).needsReview, true);
  assert.equal(shakenStateFromContext({ shaken: true }).grade, 1);
  assert.equal(shakenStateFromActor({ effects: [effect("stored", ["shaken-4"], 6)] }).totalGrade, 6);
});
test("all grades apply only their specified numerical effects, with no changes to attributes, ranks, caps, health or currency", () => {
  const normal = compute();
  for (let grade = 0; grade <= 4; grade++) {
    const s = compute(grade);
    for (const [key, skill] of Object.entries(s.skillTotals)) {
      const n = normal.skillTotals[key];
      for (const row of skill.totals) {
        const expected = grade && ["cha", "wis"].includes(row.ability) ? -4 : 0;
        assert.equal(
          row.total,
          n.totals.find(t => t.ability === row.ability).total + expected,
          key + "/" + row.ability
        );
      }
      assert.equal(skill.ranks, n.ranks);
      assert.equal(skill.cap, n.cap);
    }
    assert.equal(s.initiative.total, normal.initiative.total + (grade >= 2 ? -4 : 0));
    for (const key of ["fort", "ref", "will"])
      assert.equal(s.saves[key].total, normal.saves[key].total + (grade >= 3 && key !== "fort" ? -4 : 0));
    assert.deepEqual(s.abilities, normal.abilities);
    assert.equal(s.actionDice.value, 5);
    assert.equal(s.vitality.value, 4);
    assert.equal(s.wounds.value, 4);
    assert.equal(s.speed, normal.speed);
    assert.equal(s.defense.total, normal.defense.total);
  }
});
test("every named check uses its selected attribute; Shaken penalties remain full after Baffled and stack with Sickened/Drunk", () => {
  const normal = compute(),
    shaken = compute(1),
    combined = compute(1, { baffled: true, sickened: true, drunk: true });
  let count = 0;
  for (const [key, skill] of Object.entries(cfg.skills))
    for (const check of skill.checks)
      for (const ability of check.attributes) {
        const options = { ability, gearStatus: "available", synergySkill: "none" },
          n = resolveSkillCheck(normal, key, check, options),
          s = resolveSkillCheck(shaken, key, check, options),
          mixed = resolveSkillCheck(combined, key, check, options);
        if (!n) continue;
        const penalty = ["cha", "wis"].includes(ability) ? -4 : 0;
        assert.equal(s.total, n.total + penalty, key + "/" + check.id);
        assert.equal(mixed.skillBonusCondition.total, Math.ceil(n.skillBonusCondition.normal / 2));
        assert.equal(
          mixed.checkAdjustment,
          n.checkAdjustment - 2 + (["dex", "wis"].includes(ability) ? -2 : 0) + penalty
        );
        count++;
      }
  assert.ok(count >= 100);
});
test("specific INT attribute substitution removes the original CHA/WIS Shaken check penalty without changing either score", () => {
  const s = compute(1),
    check = cfg.skills.notice.checks[0];
  s.classLevels.schemer = s.activeClassLevels.schemer = 4;
  const normal = resolveSkillCheck(s, "notice", check, { ability: "wis" }),
    replaced = resolveSkillCheck(s, "notice", check, { ability: "wis", allAccordingToPlan: true });
  assert.equal(normal.ability, "wis");
  assert.equal(replaced.ability, "int");
  assert.equal(replaced.total, normal.total + 4);
  assert.equal(s.abilities.wis.mod, 2);
  assert.equal(s.abilities.int.mod, 2);
});
test("Shaken blocks taking 10/20 for skills and Knowledge even with normal-time or other taking options", () => {
  const s = compute(1);
  s.classLevels.schemer = s.activeClassLevels.schemer = 10;
  s.activeFeatNames.push("Photographic Memory");
  const check = cfg.skills.athletics.checks.find(c => c.id === "escape");
  for (const method of ["take10", "take20"]) {
    assert.match(
      resolveSkillCheck(s, "athletics", check, { ability: "str", method, safeToTake: true }).blockedReason,
      /Shaken/
    );
    assert.match(resolveKnowledgeCheck(s, { skill: "search", method, safeToTake: true }).blockedReason, /Shaken/);
  }
  assert.equal(
    resolveKnowledgeCheck(s, { skill: "search" }).total,
    resolveKnowledgeCheck(compute(), { skill: "search" }).total
  );
});
test("all catalog attacks receive exactly the grade-IV attack penalty; other grades and weapon restrictions remain intact", () => {
  const weapons = JSON.parse(readFileSync(new URL("../src/data/equipment.json", import.meta.url))).weapons,
    normal = compute();
  for (let grade = 1; grade <= 4; grade++) {
    const s = compute(grade);
    for (const w of weapons) {
      const n = weaponAttack(normal, w, cfg),
        r = weaponAttack(s, w, cfg);
      assert.equal(r.total, n.total + (grade === 4 ? -4 : 0), w.name);
      assert.equal(r.blocked, n.blocked, w.name);
      assert.equal(r.threat, n.threat);
      assert.equal(r.error, n.error);
    }
  }
  assert.equal(weapons.length, 458);
});
test("pure Shaken rules separate per-benefit surcharges and the grade-IV spending ban from numeric modifiers", () => {
  for (let grade = 0; grade <= 4; grade++) {
    const rules = shakenRules({ conditionContext: { shakenGrade: grade } });
    assert.equal(rules.extraDice, grade >= 3 ? 2 : grade === 2 ? 1 : 0);
    assert.equal(rules.spendingForbidden, grade === 4);
    assert.equal(shakenSkillPenalty({ conditionContext: { shakenGrade: grade } }, "cha"), grade ? -4 : 0);
    assert.equal(shakenSkillPenalty({ conditionContext: { shakenGrade: grade } }, "str"), 0);
  }
});
globalThis.Actor = class {};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = { user: { isGM: true }, i18n: { localize: s => s } };
globalThis.ui = { notifications: { warn: () => null } };
const { SpycraftActor } = await import("../module/documents/actor.mjs");
test("the actual save entry forbids fixed Evasion results while Shaken and retains ordinary save penalties", async () => {
  const a = new SpycraftActor();
  a.type = "agent";
  a.isOwner = true;
  a.statuses = new Set();
  a.system = compute(3);
  a.system.classLevels.intruder = a.system.activeClassLevels.intruder = 12;
  a.rollCheck = async (formula, data, options) => ({ formula, data, options });
  assert.equal(await a.rollSave("ref", { checkMethod: "take10" }), false);
  const normal = await a.rollSave("ref", {});
  assert.equal(normal.data.total, compute().saves.ref.total - 4);
  assert.equal((await a.rollSave("fort", {})).data.total, compute().saves.fort.total);
});

import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
test("optional Shaken/restraint evidence preserves legacy receipts while rejecting changed results and newly inserted contexts", () => {
  const check = {
      checkKind: "skill",
      skillKey: "search",
      rawTotal: 12,
      effectiveTotal: 12,
      resolved: true,
      successConfirmed: true
    },
    legacy = rollEvidence(check),
    base = JSON.parse(legacy);
  assert.equal(rollEvidence({ ...check, shakenContext: null, restraintEscape: null }), legacy);
  assert.equal(rollEvidenceMatches(JSON.stringify([null, ...base]), check), true);
  assert.equal(rollEvidenceMatches(JSON.stringify([null, null, ...base]), check), true);
  assert.equal(rollEvidenceMatches(legacy, { ...check, effectiveTotal: 13 }), false);
  assert.equal(rollEvidenceMatches(legacy, { ...check, shakenContext: { grade: 1, totalGrade: 1 } }), false);
  assert.equal(rollEvidenceMatches(legacy, { ...check, restraintEscape: { condition: "held" } }), false);
  const grapple = { ...check, restraintEscape: { condition: "held", kind: "opposedGrapple" } };
  assert.equal(rollEvidenceMatches(rollEvidence(grapple), { ...grapple, shakenContext: null }), true);
});

import { shakenActionDieCost } from "../module/rules/shaken.mjs";
test("Shaken surcharge is once per benefit after waivers; transfer-only payments have no benefit surcharge and IV forbids all positive spending", () => {
  for (let grade = 0; grade <= 4; grade++)
    for (const baseCost of [0, 1, 3]) {
      const system = { conditionContext: { shakenGrade: grade } },
        extra = grade >= 3 ? 2 : grade === 2 ? 1 : 0,
        benefit = shakenActionDieCost(system, { baseCost }),
        transfer = shakenActionDieCost(system, { baseCost, benefitCount: 0 });
      if (grade === 4) {
        assert.equal(benefit.blocked, true);
        assert.equal(transfer.blocked, baseCost > 0);
      } else {
        assert.equal(benefit.cost, baseCost + extra);
        assert.equal(benefit.surcharge, extra);
        assert.equal(transfer.cost, baseCost);
      }
    }
  assert.equal(shakenActionDieCost({ conditionContext: { shakenGrade: 2 } }, { baseCost: 0 }).cost, 1);
  assert.equal(shakenActionDieCost({ conditionContext: { shakenGrade: 3 } }, { baseCost: 0 }).cost, 2);
  for (const baseCost of [-1, 1.5, NaN, true]) assert.equal(shakenActionDieCost({}, { baseCost }).blocked, true);
});

test("a check pays only its remaining Shaken boost surcharge; multiple distinct benefits and externally funded quotes stay separate", () => {
  const ii = { conditionContext: { shakenGrade: 2 } },
    iii = { conditionContext: { shakenGrade: 3 } },
    iv = { conditionContext: { shakenGrade: 4 } };
  assert.equal(shakenActionDieCost(ii, { baseCost: 2 }).cost, 3);
  const first = shakenActionDieCost(ii, { baseCost: 1 });
  assert.equal(first.cost, 2);
  assert.equal(shakenActionDieCost(ii, { baseCost: 1, surchargePaid: first.surcharge }).cost, 1);
  assert.equal(shakenActionDieCost(iii, { baseCost: 1, surchargePaid: 1 }).surcharge, 1);
  assert.equal(shakenActionDieCost(iii, { baseCost: 1, surchargePaid: 2 }).cost, 1);
  assert.equal(shakenActionDieCost(iii, { baseCost: 4, benefitCount: 2 }).cost, 8);
  assert.equal(shakenActionDieCost(iv, { baseCost: 1, payer: false }).cost, 3);
  assert.equal(shakenActionDieCost(iv, { baseCost: 1, payer: true }).blocked, true);
  assert.equal(shakenActionDieCost(ii, { baseCost: 1, surchargePaid: 3 }).blocked, true);
});
