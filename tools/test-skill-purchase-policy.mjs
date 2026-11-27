import test from "node:test";
import assert from "node:assert/strict";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { skillPurchasePolicy, skillPurchasePolicyRecord } from "../module/rules/skill-purchase-policy.mjs";
import { removedVitalityRecord, retainedVitality, removedVitalityKey } from "../module/rules/retained-vitality.mjs";
import { activeQualities, campaignEffects } from "../module/rules/gc/campaign.mjs";

const cls = {
  id: "test",
  name: "Test",
  type: "class",
  system: { identifier: "test", table: [], classSkills: ["athletics"], skillPoints: 4, vitalityDie: 8 }
};
const effects = () => campaignEffects(activeQualities(["jack-of-all-trades"])).effects;
const record = (level, all) =>
  skillPurchasePolicyRecord(
    level,
    { allSkillsClass: all ? 1 : 0 },
    { reviewerId: "gc", note: "Reviewed purchase-time season", source: "gc-review", at: 100 }
  );
const source = levels => ({
  abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 10 }])),
  progression: levels.map((all, idx) => ({
    classId: "test",
    vitality: 4,
    intelligenceModifier: 0,
    skills: { analysis: 2 },
    ...(all === null ? {} : { skillPolicy: record(idx + 1, all) })
  })),
  misc: {}
});
const compute = (data, campaign = {}) => computeAgent(structuredClone(data), [cls], cfg, { campaignEffects: campaign });

test("Jack-of-All-Trades buys all skills at class cost without changing awarded points", () => {
  const normal = compute(source([false])),
    jack = compute(source([true]), effects());
  assert.equal(effects().allSkillsClass, 1);
  assert.equal(normal.skillTotals.analysis.ranks, 1);
  assert.equal(jack.skillTotals.analysis.ranks, 2);
  assert.equal(jack.skillPoints[0].available, normal.skillPoints[0].available);
  assert.equal(jack.skillPoints[0].spent, normal.skillPoints[0].spent);
  assert.deepEqual(new Set(jack.skillPoints[0].classSkills), new Set(Object.keys(cfg.skills)));
  assert.equal(jack.skillTotals.analysis.isClass, true);
  assert.equal(
    jack.skillPurchaseIssues.some(row => row.code === "manual-class-skill"),
    false
  );
});

test("purchase costs stay at their captured level policy when the quality is added or removed", () => {
  const data = source([false, true]),
    off = compute(data),
    on = compute(data, effects());
  for (const s of [off, on]) {
    assert.equal(s.skillTotals.analysis.ranks, 3);
    assert.equal(s.skillPoints[0].skills.analysis.classSkill, false);
    assert.equal(s.skillPoints[1].skills.analysis.classSkill, true);
    assert.equal(
      s.skillPurchaseIssues.some(row => row.code === "campaign-history"),
      false
    );
  }
  assert.equal(off.skillTotals.analysis.isClass, false);
  assert.equal(on.skillTotals.analysis.isClass, true);
  assert.deepEqual(data, source([false, true]));
});

test("unknown history under the active quality needs GC review and never invents cheaper historical ranks", () => {
  const data = source([null]),
    old = compute(data),
    active = compute(data, effects());
  assert.equal(
    old.skillPurchaseIssues.some(row => row.code === "campaign-history"),
    false
  );
  assert.equal(active.skillTotals.analysis.ranks, 1);
  assert.equal(
    active.skillPurchaseIssues.some(row => row.code === "campaign-history"),
    true
  );
  assert.equal(
    active.todo.some(row => row.error && row.always && row.skillLevel === 1 && /Jack-of-All-Trades/.test(row.text)),
    true
  );
  assert.equal(active.skillPoints[0].skillPolicy.needsReview, true);
  for (const mutate of [
    r => (r.version = 9),
    r => (r.careerLevel = 2),
    r => (r.confirmed = false),
    r => (r.allSkillsClass = 1),
    r => (r.note = ""),
    r => (r.source = "unknown"),
    r => (r.at = NaN)
  ]) {
    const entry = { skillPolicy: record(1, true) };
    mutate(entry.skillPolicy);
    assert.deepEqual(skillPurchasePolicy(entry, 1, {}), { allSkillsClass: false, recorded: false, needsReview: true });
  }
});

test("agent-built companions do not receive the PC-only class-cost quality", () => {
  const data = { ...source([true]), companionOf: { ownerUuid: "Actor.owner" } },
    s = compute(data, effects());
  assert.equal(s.skillTotals.analysis.ranks, 1);
  assert.equal(s.skillTotals.analysis.isClass, false);
  assert.equal(s.campaignEffects.allSkillsClass, undefined);
});

test("rebuilding the same retained career slot keeps its recorded purchase rules", () => {
  const entry = source([true]).progression[0],
    stored = removedVitalityRecord(entry, 1, 8, "receipt", 100),
    retained = retainedVitality({ [removedVitalityKey(1, "test", 8)]: stored }, 1, "test", 8);
  assert.deepEqual(retained.skillPolicy, entry.skillPolicy);
  const rebuilt = source([false]);
  Object.assign(rebuilt.progression[0], retained);
  assert.equal(compute(rebuilt).skillTotals.analysis.ranks, 2);
  retained.skillPolicy.note = "Changed clone";
  assert.notEqual(stored.skillPolicy.note, retained.skillPolicy.note);
});

test("invalid policy capture inputs are rejected before a source can be saved", () => {
  for (const [level, effects, options] of [
    [0, {}, {}],
    [21, {}, {}],
    [1, { allSkillsClass: 2 }, {}],
    [1, {}, { reviewerId: "gc", note: "" }],
    [1, {}, { reviewerId: "gc", note: "ok", source: "unknown" }]
  ])
    assert.throws(() => skillPurchasePolicyRecord(level, effects, options), /Review/);
});
