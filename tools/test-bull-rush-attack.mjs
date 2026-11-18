import test from "node:test";
import assert from "node:assert/strict";
import {
  bullRushAttackSkillChecks as checks,
  bullRushAttackPlan as plan,
  validateBullRushAttackProof as validate
} from "../module/rules/bull-rush-attack.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const check = checks("athletics", [])[0],
  clock = () => ({ id: "combat", started: true, round: 1, turn: 0, ownTurnIndex: 0, combatantId: "self" }),
  sys = () => ({
    size: "Medium",
    speed: 30,
    postureMovement: { bullRush: true },
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 12, mod: 1 }])),
    conditionContext: {}
  }),
  input = (patch = {}) => ({
    bullRushAttackOpponentName: "Reachable opponent",
    bullRushAttackSizeDifference: 0,
    bullRushAttackDistanceFeet: 30,
    bullRushAttackOnFootConfirmed: true,
    bullRushAttackRouteConfirmed: true,
    bullRushAttackContactConfirmed: true,
    bullRushAttackFullActionConfirmed: true,
    bullRushAttackTargetThreatening: false,
    bullRushAttackOtherThreatAdjacency: false,
    bullRushAttackPassesOtherThreat: false,
    bullRushAttackCombat: clock(),
    ...patch
  }),
  p = (s = sys(), patch = {}) => plan(s, "athletics", check, input(patch)),
  scope = {
    checkKind: "skill",
    skillKey: "athletics",
    checkId: "bull-rush",
    checkMethod: "roll",
    ability: "str",
    combat: clock()
  };
test("normal on-foot Bull Rush attack is a distinct full-action STR/Armor check with base1/action0 error", () => {
  assert.deepEqual(check.attributes, ["str"]);
  assert.equal(check.tags, "Armor Check Penalty");
  assert.equal(check.error, 1);
  assert.equal(check.time, "1 Full Action");
  assert.equal(check.role, "attacker");
  assert.equal(check.page, 354);
  assert.deepEqual(checks("other", []), []);
  assert.equal(checks("athletics", checks("athletics", [])).length, 1);
  assert.equal(
    cfg.skills.athletics.checks.some(c => c.id === "bull-rush"),
    false
  );
});
test("counted direct distance is capped at actual Speed, not Run/Combat Mobility; inability to Run does not ban this action", () => {
  for (const speed of [5, 15, 30, 31, 60]) {
    const s = { ...sys(), speed, canRun: false, activeFeatNames: ["Combat Mobility", "Run"] },
      r = p(s, { bullRushAttackDistanceFeet: speed });
    assert.equal(r.blockedReason, "");
    assert.equal(r.evidence.maximumFeet, speed);
    assert.ok(p(s, { bullRushAttackDistanceFeet: speed + 0.001 }).blockedReason);
  }
  for (const distance of [0, -1, NaN, Infinity, "30", null])
    assert.ok(p(sys(), { bullRushAttackDistanceFeet: distance }).blockedReason);
});
test("target Size eligibility mirrors the defender, larger attackers gain four per category, and Still Standing grants no attack bonus", () => {
  for (const difference of [-1, 0, 1, 2, 11]) {
    const s = sys();
    Object.defineProperty(s, "classOptionSelections", {
      get() {
        throw Error("Resistance-only source read");
      }
    });
    const r = p(s, { bullRushAttackSizeDifference: difference });
    assert.equal(r.blockedReason, "");
    assert.equal(r.sizeBonus, 4 * Math.max(0, difference));
    assert.equal(Object.hasOwn(r.evidence, "stillStanding"), false);
  }
  assert.ok(p(sys(), { bullRushAttackSizeDifference: -2 }).blockedReason);
});
test("current own Count, explicit full action/contact and other-opponent adjacency restrictions are mandatory", () => {
  for (const patch of [
    { method: "take10" },
    { method: "take20" },
    { bullRushAttackCombat: null },
    { bullRushAttackCombat: { ...clock(), turn: 1 } },
    { bullRushAttackCombat: { ...clock(), round: 0 } },
    { bullRushAttackOpponentName: "" },
    { bullRushAttackOpponentName: "x".repeat(201) },
    { bullRushAttackOnFootConfirmed: false },
    { bullRushAttackRouteConfirmed: false },
    { bullRushAttackContactConfirmed: false },
    { bullRushAttackFullActionConfirmed: false },
    { bullRushAttackOtherThreatAdjacency: true },
    { bullRushAttackPassesOtherThreat: true },
    { bullRushAttackTargetThreatening: "false" },
    { bullRushAttackSizeDifference: "0" }
  ])
    assert.ok(p(sys(), patch).blockedReason, JSON.stringify(patch));
  for (const [key, skill] of Object.entries(cfg.skills))
    for (const c of skill.checks) assert.equal(plan(sys(), key, c, input()).evidence, null, key + "/" + c.id);
});
test("prepared Bull Rush posture, actual incapacities/Speed and immobility cannot be replaced by caller declarations", () => {
  for (const patch of [
    { postureMovement: { bullRush: false } },
    { incapacitatedForMovement: true },
    { encumbrance: { immobile: true } },
    { wounds: { value: -1 } },
    { conditionSpeedReview: true },
    ...[-1, 0, NaN, Infinity, "30", null].map(speed => ({ speed }))
  ])
    assert.ok(p({ ...sys(), ...patch }).blockedReason);
  for (const condition of ["held", "pinned", "paralyzed", "dead", "unconscious", "stunned", "dazed", "sleeping"]) {
    const s = sys();
    s.conditionContext[condition] = true;
    assert.ok(p(s).blockedReason, condition);
  }
  const s = sys();
  s.conditionContext.entangled = true;
  s.speed = 15;
  assert.equal(p(s, { bullRushAttackDistanceFeet: 15 }).blockedReason, "");
});
test("exact proof binds Size/Speed, route and current Count, supports native order and actual attribute substitution without mutation", () => {
  const s = sys(),
    i = input({ bullRushAttackSizeDifference: 1 }),
    before = structuredClone({ s, i }),
    r = plan(s, "athletics", check, i);
  validate(s, r.evidence, scope);
  validate(s, Object.fromEntries(Object.entries(r.evidence).reverse()), scope);
  for (const k of Object.keys(r.evidence)) {
    const n = structuredClone(r.evidence);
    n[k] = k === "opponentName" ? "" : "changed";
    assert.throws(() => validate(s, n, scope), k);
  }
  assert.throws(() => validate({ ...s, size: "Small" }, r.evidence, scope));
  assert.throws(() => validate({ ...s, speed: 15 }, r.evidence, scope));
  assert.throws(() => validate(s, r.evidence, { ...scope, combat: { ...clock(), round: 2 } }));
  assert.throws(() => validate(s, r.evidence, { ...scope, ability: "dex" }));
  validate({ ...s, classLevels: { schemer: 4 } }, r.evidence, {
    ...scope,
    ability: "int",
    attributeSubstitution: { source: "All According to Plan", originalAbility: "str", ability: "int" }
  });
  assert.deepEqual({ s, i }, before);
  validate(s, null, scope);
});

test("the user-confirmed chosen-target exception allows threatening targets but never another threatening opponent", () => {
  for (const target of [false, true])
    for (const startOther of [false, true])
      for (const passOther of [false, true]) {
        const r = p(sys(), {
          bullRushAttackTargetThreatening: target,
          bullRushAttackOtherThreatAdjacency: startOther,
          bullRushAttackPassesOtherThreat: passOther
        });
        assert.equal(!!r.blockedReason, startOther || passOther);
        if (!r.blockedReason) {
          assert.equal(r.evidence.targetThreatening, target);
          assert.equal(r.evidence.chosenTargetAdjacencyException, true);
        }
      }
});
