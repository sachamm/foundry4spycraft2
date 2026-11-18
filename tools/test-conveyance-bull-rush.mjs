import test from "node:test";
import assert from "node:assert/strict";
import {
  CONVEYANCE_BULL_RUSH_PROFILES as profiles,
  CONVEYANCE_BULL_RUSH_SIZES as sizes,
  conveyanceBullRushSkillChecks as checks,
  conveyanceBullRushPlan as plan,
  validateConveyanceBullRushProof as validate
} from "../module/rules/conveyance-bull-rush.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const clock = () => ({ id: "combat", started: true, round: 1, turn: 0, ownTurnIndex: 0, combatantId: "self" }),
  sys = () => ({
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 12, mod: 1 }])),
    conditionContext: {}
  }),
  input = (patch = {}) => ({
    focus: "Land Vehicles",
    conveyanceBullRushName: "Actual conveyance",
    conveyanceBullRushTargetName: "Actual target",
    conveyanceBullRushSize: "Large",
    conveyanceBullRushTargetSize: "Medium",
    conveyanceBullRushAllowanceFeet: 50,
    conveyanceBullRushDistanceFeet: 50,
    conveyanceBullRushTargetThreatening: true,
    conveyanceBullRushOtherThreatAdjacency: false,
    conveyanceBullRushPassesOtherThreat: false,
    conveyanceBullRushControlConfirmed: true,
    conveyanceBullRushStatsConfirmed: true,
    conveyanceBullRushRouteConfirmed: true,
    conveyanceBullRushContactConfirmed: true,
    conveyanceBullRushFullActionConfirmed: true,
    conveyanceBullRushCombat: clock(),
    ...patch
  }),
  p = (key = "drive", s = sys(), patch = {}) => plan(s, key, checks(key, [])[0], input(patch)),
  scope = key => ({
    checkKind: "skill",
    skillKey: key,
    checkId: "conveyance-bull-rush",
    checkMethod: "roll",
    ability: profiles[key].ability,
    combat: clock()
  });
test("all four conveyance categories borrow exactly the source Maneuver skill/attribute but none of its tags/synergies/action time", () => {
  assert.deepEqual(Object.keys(profiles), ["acrobatics", "drive", "survival", "tactics"]);
  for (const [key, profile] of Object.entries(profiles)) {
    const c = checks(key, [])[0],
      m = cfg.skills[key].checks.find(c => c.id === "maneuver");
    assert.deepEqual(c.attributes, m.attributes);
    assert.equal(c.attributes[0], profile.ability);
    assert.equal(c.tags, "");
    assert.deepEqual(c.synergies, []);
    assert.equal(c.time, "1 Full Action");
    assert.equal(c.error, 1);
    assert.notEqual(c.id, m.id);
    assert.equal(c.operatorKind, profile.kind);
    assert.equal(checks(key, checks(key, [])).length, 1);
    const r = p(key);
    assert.equal(r.evidence.maneuverBenefits, false);
    assert.equal(r.evidence.armorCheckIgnored, true);
  }
  assert.deepEqual(checks("athletics", []), []);
});
test("all twelve rushing/target Size categories calculate actual category difference and larger-participant bonus without operator Size", () => {
  const s = sys();
  Object.defineProperty(s, "size", {
    get() {
      throw Error("Operator Size read");
    }
  });
  for (const [key] of Object.entries(profiles))
    for (const own of sizes)
      for (const target of sizes) {
        const d = sizes.indexOf(own) - sizes.indexOf(target),
          r = p(key, s, { conveyanceBullRushSize: own, conveyanceBullRushTargetSize: target });
        assert.equal(!!r.blockedReason, d < -1);
        if (d >= -1) {
          assert.equal(r.sizeBonus, 4 * Math.max(0, d));
          assert.equal(r.evidence.sizeDifference, d);
        }
      }
});
test("current declared conveyance allowance is independent of foot Speed, with strict direct positive movement and actual Drive focus", () => {
  const s = sys();
  Object.defineProperty(s, "speed", {
    get() {
      throw Error("Foot Speed read");
    }
  });
  assert.equal(p("drive", s).evidence.allowanceFeet, 50);
  for (const patch of [
    { conveyanceBullRushDistanceFeet: 50.001 },
    { conveyanceBullRushDistanceFeet: 0 },
    { conveyanceBullRushAllowanceFeet: 0 },
    { conveyanceBullRushAllowanceFeet: "50" },
    { conveyanceBullRushDistanceFeet: "50" },
    { focus: "" }
  ])
    assert.ok(p("drive", s, patch).blockedReason);
  for (const key of ["acrobatics", "survival", "tactics"]) assert.equal(p(key, s, { focus: "" }).blockedReason, "");
});
test("chosen-target adjacency exception does not waive other opponents; actual control/stats/contact/full action and own Count are mandatory", () => {
  for (const target of [false, true])
    assert.equal(p("drive", sys(), { conveyanceBullRushTargetThreatening: target }).blockedReason, "");
  for (const patch of [
    { method: "take10" },
    { method: "take20" },
    { conveyanceBullRushCombat: null },
    { conveyanceBullRushCombat: { ...clock(), turn: 1 } },
    { conveyanceBullRushOtherThreatAdjacency: true },
    { conveyanceBullRushPassesOtherThreat: true },
    { conveyanceBullRushName: "" },
    { conveyanceBullRushTargetName: "" },
    { conveyanceBullRushSize: "unknown" },
    { conveyanceBullRushTargetSize: "unknown" },
    ...["Control", "Stats", "Route", "Contact", "FullAction"].map(n => ({
      ["conveyanceBullRush" + n + "Confirmed"]: false
    })),
    { conveyanceBullRushStatsConfirmed: "true" }
  ])
    assert.ok(p("drive", sys(), patch).blockedReason, JSON.stringify(patch));
});
test("operator action constraints apply, but own foot immobility is not substituted for vehicle operation and actual mental exceptions remain explicit", () => {
  for (const condition of ["held", "pinned", "prone", "sprawled", "stunned", "unconscious", "dead", "sleeping"]) {
    const s = sys();
    s.conditionContext[condition] = true;
    assert.ok(p("drive", s).blockedReason, condition);
  }
  const s = sys();
  s.conditionContext.paralyzed = true;
  assert.ok(p("drive", s, { purelyMentalConfirmed: true }).blockedReason);
  assert.ok(p("tactics", s).blockedReason);
  assert.equal(p("tactics", s, { purelyMentalConfirmed: true }).blockedReason, "");
  const stationary = { ...sys(), speed: 0, encumbrance: { immobile: true }, postureMovement: { bullRush: false } };
  assert.equal(p("drive", stationary).blockedReason, "");
});
test("only the new action profiles receive this plan; ordinary named uses never acquire conveyance bonuses or proof", () => {
  for (const [key, skill] of Object.entries(cfg.skills))
    for (const check of skill.checks)
      assert.equal(plan(sys(), key, check, input()).evidence, null, key + "/" + check.id);
  assert.ok(plan(sys(), "notice", { id: "conveyance-bull-rush" }, input()).blockedReason);
});
test("proof binds exact GC facts, controlling skill/attribute and current Count, supports native object order and remains immutable", () => {
  for (const key of Object.keys(profiles)) {
    const s = sys(),
      i = input(),
      before = structuredClone({ s, i }),
      r = plan(s, key, checks(key, [])[0], i);
    validate(s, r.evidence, scope(key));
    validate(s, Object.fromEntries(Object.entries(r.evidence).reverse()), scope(key));
    for (const field of Object.keys(r.evidence)) {
      const n = structuredClone(r.evidence);
      n[field] = ["conveyanceName", "targetName", "focus"].includes(field) ? "" : "changed";
      if (field === "focus" && key !== "drive") continue;
      assert.throws(() => validate(s, n, scope(key)), key + "/" + field);
    }
    assert.throws(() => validate(s, r.evidence, { ...scope(key), combat: { ...clock(), round: 2 } }));
    assert.throws(() => validate(s, r.evidence, { ...scope(key), ability: "str" }));
    validate({ ...s, classLevels: { schemer: 4 } }, r.evidence, {
      ...scope(key),
      ability: "int",
      attributeSubstitution: { source: "All According to Plan", originalAbility: profiles[key].ability, ability: "int" }
    });
    assert.deepEqual({ s, i }, before);
  }
});
