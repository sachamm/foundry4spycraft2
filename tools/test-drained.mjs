import test from "node:test";
import assert from "node:assert/strict";
import { computeAgent } from "../module/rules/engine.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { rollPipeline } from "../module/rules/roll-pipeline.mjs";
import "../module/rolls/drained.mjs";
import { beginDrainedRecovery, settleDrainedRecovery, reviewDrainedPlan } from "../module/rules/drained.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import {
  drainedApplicationPlan,
  drainedBuildSignature,
  drainedChoiceRows,
  drainedState
} from "../module/rules/drained.mjs";
const cls = {
  id: "test",
  type: "class",
  name: "Test",
  system: {
    identifier: "test",
    skillPoints: 4,
    vitalityDie: 8,
    proficiencies: 2,
    classSkills: Object.keys(cfg.skills),
    table: Array.from({ length: 8 }, (_, i) => ({
      level: i + 1,
      bab: i + 1,
      fort: i + 1,
      ref: i + 1,
      will: i + 1,
      def: i + 1,
      init: i + 1,
      lifestyle: 0,
      legend: 0
    }))
  }
};
const laterFeat = {
  id: "later",
  type: "feat",
  name: "Test later feat",
  system: {
    acquiredAtLevel: 4,
    granted: true,
    bonuses: [{ target: "abilities.str", value: "2" }]
  }
};
const items = [cls, laterFeat];
const source = () => ({
  abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12, misc: 0 }])),
  abilityIncreases: { l4: "str" },
  progression: Array.from({ length: 4 }, (_, i) => ({
    classId: "test",
    careerEntryId: `p${i}`,
    vitality: 4,
    intelligenceModifier: 1,
    skills: { athletics: 1 }
  })),
  vitality: { value: 15 },
  wounds: { value: 12 },
  actionDice: { value: 3 },
  proficiencies: { unarmed: { proficient: true, forte: false } },
  focuses: { science: ["Physics"] },
  skillFortes: [],
  interests: "Chess, Film",
  contacts: [{ name: "Ally", rank: 1 }],
  wealthAllocation: { lifestyle: 1, possessions: 0, spendingCash: 0 }
});
const apply = (s, record = null, patch = {}) =>
  drainedApplicationPlan(s, items, record, {
    id: "event",
    source: "Stress save",
    levels: 1,
    retained: [],
    wealth: { lifestyle: 0, possessions: 0, spendingCash: 0 },
    confirmed: true,
    reviewer: "gc",
    note: "Verified retained options and effect sources",
    at: 1,
    ...patch
  });

test("Drained projects the reduced career's actual numbers without deleting advancement or choices", () => {
  const s = source(),
    original = structuredClone(s),
    record = apply(s),
    expected = source();
  expected.progression.pop();
  expected.proficiencies = { unarmed: { proficient: false, forte: false } };
  expected.focuses = { science: [] };
  expected.interests = "";
  expected.contacts = [];
  expected.wealthAllocation = { lifestyle: 0, possessions: 0, spendingCash: 0 };
  computeAgent(expected, [cls], cfg);
  computeAgent(s, items, cfg, { drained: record });
  assert.equal(s.level, 3);
  for (const key of [
    "bab",
    "saves",
    "initiative",
    "defense",
    "classLevels",
    "activeClassLevels",
    "skillTotals",
    "wealth"
  ])
    assert.deepEqual(s[key], expected[key], key);
  assert.equal(s.vitality.max, expected.vitality.max);
  assert.equal(s.abilities.str.value, expected.abilities.str.value);
  assert.equal(s.activeFeatNames.includes(laterFeat.name), false);
  for (const key of ["progression", "proficiencies", "focuses", "contacts", "interests", "wealthAllocation"])
    assert.deepEqual(s[key], original[key], key);
  assert.equal(s.drainedState.needsReview, false);
  computeAgent(s, items, cfg, { drained: { ...record, levels: 0 } });
  assert.equal(s.level, 4);
  assert.equal(s.drainedState, undefined);
  assert.equal(s.abilities.str.value, 15);
});

test("separate Drained applications stack only to level 1 and duplicate source receipts do not stack", () => {
  const s = source(),
    first = apply(s),
    second = apply(s, first, { id: "next", levels: 20 });
  assert.equal(second.levels, 3);
  assert.equal(second.applications.next.applied, 2);
  assert.equal(apply(s, second, { id: "next" }), second);
  assert.throws(() => apply(s, second, { id: "third" }), /below Career Level 1/);
  s.progression = s.progression.slice(0, 1);
  assert.equal(apply(s).applications.event.applied, 0);
});

test("GC retained choices cannot invent proficiencies, later feats or Wealth, and full ownership survives", () => {
  const s = source();
  assert.ok(drainedChoiceRows(s, items, 3).find(r => r.id === "feat:later").later);
  for (const retained of [["feat:later"], ["feat:missing"], ["interest:0", "interest:0"]])
    assert.throws(() => apply(s, null, { retained }), /retained options/);
  assert.throws(() => apply(s, null, { wealth: { lifestyle: 2, possessions: 0, spendingCash: 0 } }), /Wealth/);
  const record = apply(s, null, {
    retained: ["proficiency:unarmed:proficient", "focus:science:0", "interest:0", "contact:0"]
  });
  computeAgent(s, items, cfg, { drained: record });
  assert.equal(s.proficiencyTotals.unarmed.proficient, true);
  assert.ok(s.focusTotals.science.includes("Physics"));
  assert.equal(s.interests, "Chess, Film");
});

test("build changes require GC review, while health, gear and wallets do not invalidate original history", () => {
  const s = source(),
    record = apply(s),
    signature = drainedBuildSignature(s, items);
  s.vitality.value = 1;
  s.reputation = 999;
  assert.equal(drainedBuildSignature(s, [...items, { id: "armor", type: "armor", system: {} }]), signature);
  s.progression[1].skills.athletics = 2;
  assert.equal(drainedState(s, items, record).needsReview, true);
  computeAgent(s, items, cfg, { drained: record });
  assert.equal(s.level, 3);
  assert.equal(s.drainedState.needsReview, true);
  assert.ok(s.todo.some(row => row.error && row.order === 0));
  assert.throws(() => apply(s, record, { id: "next" }), /current Drained build/);
});

test("a failed preparation restores the actual owned inputs", () => {
  const s = source(),
    original = structuredClone(s),
    record = apply(s);
  assert.throws(() => computeAgent(s, items, {}, { drained: record }));
  for (const key of ["progression", "proficiencies", "focuses", "interests", "contacts", "wealthAllocation"])
    assert.deepEqual(s[key], original[key]);
});

test("mission-end recovery preserves one original attempt, restores only one level and requires new choice review", () => {
  const s = source(),
    record = apply(s, null, { levels: 2 }),
    staged = beginDrainedRecovery(s, items, record, { mission: "m1", attempt: "original", confirmed: true, at: 5 });
  assert.equal(staged.recoveries.m1.dc, 25);
  assert.throws(
    () => beginDrainedRecovery(s, items, staged, { mission: "m1", attempt: "replacement", confirmed: true, at: 6 }),
    /original dice/
  );
  const message = {
    uuid: "ChatMessage.original",
    flags: {
      spycraft2: {
        checkKind: "skill",
        skillKey: "resolve",
        ability: "wis",
        resolved: true,
        successConfirmed: true,
        effectiveTotal: 27,
        rawTotal: 27,
        naturalDie: 17,
        drainedRecovery: { mission: "m1", attempt: "original", levels: 2, dc: 25, mode: "Passive" },
        checkId: "drained-recovery",
        checkMethod: "roll"
      }
    }
  };
  const completed = settleDrainedRecovery(s, items, staged, "m1", message, 10);
  assert.equal(completed.levels, 1);
  assert.equal(settleDrainedRecovery(s, items, completed, "m1", message, 11), completed);
  assert.equal(drainedState(s, items, completed).needsReview, true);
  const reviewed = reviewDrainedPlan(s, items, completed, {
    confirmed: true,
    retained: [],
    wealth: { lifestyle: 0, possessions: 0, spendingCash: 0 },
    reviewer: "gc",
    note: "Verified restored level options",
    at: 11
  });
  assert.equal(drainedState(s, items, reviewed).needsReview, false);
  const next = beginDrainedRecovery(s, items, reviewed, { mission: "m2", attempt: "second", confirmed: true, at: 20 });
  assert.equal(next.recoveries.m2.dc, 20);
  assert.equal(s.progression.length, 4);
});

test("recovery requires the finished original Wisdom/Resolve result; a failure consumes this mission's opportunity", () => {
  const s = source(),
    record = apply(s),
    staged = beginDrainedRecovery(s, items, record, { mission: "mission", attempt: "roll", confirmed: true, at: 1 }),
    check = {
      checkKind: "skill",
      skillKey: "resolve",
      ability: "wis",
      resolved: true,
      successConfirmed: false,
      effectiveTotal: 10,
      drainedRecovery: { mission: "mission", attempt: "roll", levels: 1, dc: 20, mode: "Passive" },
      checkId: "drained-recovery",
      checkMethod: "roll"
    };
  for (const change of [
    { ability: "con" },
    { skillKey: "notice" },
    { superseded: true },
    { resolved: false },
    { drainedRecovery: { ...check.drainedRecovery, attempt: "replacement" } }
  ])
    assert.throws(
      () =>
        settleDrainedRecovery(
          s,
          items,
          staged,
          "mission",
          { uuid: "ChatMessage.roll", flags: { spycraft2: { ...check, ...change } } },
          2
        ),
      /original Resolve/
    );
  const failed = settleDrainedRecovery(
    s,
    items,
    staged,
    "mission",
    { uuid: "ChatMessage.roll", flags: { spycraft2: check } },
    2
  );
  assert.equal(failed.levels, 1);
  assert.equal(failed.recoveries.mission.succeeded, false);
  assert.throws(
    () => beginDrainedRecovery(s, items, failed, { mission: "mission", attempt: "new", confirmed: true, at: 3 }),
    /original dice/
  );
});

test("malformed imported Drained flags do not break preparation and remain blocked for GC review", () => {
  const s = source();
  computeAgent(s, items, cfg, { drained: { version: 1, levels: 20 } });
  assert.equal(s.level, 4);
  assert.equal(s.drainedState.needsReview, true);
  assert.ok(s.todo.some(r => r.order === 0 && r.error));
  assert.throws(
    () =>
      reviewDrainedPlan(
        s,
        items,
        { version: 1, levels: 20 },
        { correctedLevels: 1, confirmed: true, note: "Unverified count", reviewer: "gc", at: 1 }
      ),
    /actual Drained level/
  );
  const corrected = reviewDrainedPlan(
    s,
    items,
    { version: 1, levels: 20 },
    {
      correctedLevels: 0,
      levelCountVerified: true,
      confirmed: true,
      note: "Verified no lost levels in imported history",
      reviewer: "gc",
      at: 1
    }
  );
  assert.equal(corrected.levels, 0);
  assert.equal(corrected.review.previousLevels, 20);
  computeAgent(s, items, cfg, { drained: corrected });
  assert.equal(s.level, 4);
  assert.equal(s.drainedState, undefined);
});

test("the actual named recovery check reaches ordinary skill planning with its original Wisdom and passive category", () => {
  const system = source();
  computeAgent(system, items, cfg);
  const checks = rollPipeline.skillChecks(
    {
      actor: { system },
      checkKind: "skill",
      skillKey: "resolve",
      options: { drainedRecovery: { dc: 20, mode: "Passive" } }
    },
    cfg.skills.resolve.checks
  );
  assert.equal(checks.length, 1);
  assert.equal(checks[0].id, "drained-recovery");
  const plan = resolveSkillCheck(system, "resolve", checks[0], {
    ability: "wis",
    method: "roll",
    synergySkill: "none",
    gearStatus: "available"
  });
  assert.equal(plan.ability, "wis");
  assert.equal(plan.blocked, false);
  assert.equal(plan.rollMode, "blindroll");
  for (const method of ["take10", "take20"])
    assert.equal(
      resolveSkillCheck(system, "resolve", checks[0], { ability: "wis", method, safeToTake: true }).blocked,
      true
    );
});
