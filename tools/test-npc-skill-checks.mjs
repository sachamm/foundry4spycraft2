import test from "node:test";
import assert from "node:assert/strict";
import { npcSkillActionPlan } from "../module/rules/npc-skill-checks.mjs";
import { actorConditionContext } from "../module/rules/condition-context.mjs";
const check = (mode = "Active", id = "check") => ({ id, mode, time: "1 Full Action", tags: "" });
const plan = (system = {}, options = {}, named = check(), ability = "wis", key = "notice", policy = {}) =>
  npcSkillActionPlan(system, key, named, ability, options, policy);

test("an actual held or pinned grapple participant can oppose Athletics while other active NPC checks stay blocked", () => {
  for (const condition of ["held", "pinned"]) {
    const s = { conditionContext: { [condition]: true } };
    assert.ok(plan(s, {}, check("Active", "grapple"), "str", "athletics").blockedReason);
    assert.equal(
      plan(
        s,
        {
          grappleParticipantConfirmed: true,
          grappleProficient: true,
          grappleContextConfirmed: true,
          grappleSizeDifference: 0
        },
        check("Active", "grapple"),
        "str",
        "athletics"
      ).blockedReason,
      ""
    );
    assert.ok(
      plan(s, { grappleParticipantConfirmed: true }, check("Active", "climb"), "str", "athletics").blockedReason
    );
  }
});

test("NPC check categories preserve passive/secret visibility and action-die restrictions, with explicit campaign conversion", () => {
  assert.equal(plan().actionDiceAllowed, true);
  const passive = plan({}, {}, check("Passive"));
  assert.equal(passive.rollMode, "blindroll");
  assert.equal(passive.actionDiceAllowed, false);
  assert.equal(plan({}, {}, check("Secret")).rollMode, "blindroll");
  const system = { campaignEffects: { activeSkillChecks: 1 } };
  assert.equal(plan(system, {}, check("Passive")).mode, "Active");
  assert.equal(plan(system, {}, check("Passive")).actionDiceAllowed, true);
  assert.equal(plan(system, {}, check("Passive"), "wis", "resolve", { preserveMode: true }).mode, "Passive");
});

test("NPC action restrictions share actual sleeping, incapacity and paralysis rules before RNG", () => {
  for (const status of ["dead", "unconscious", "stunned", "dazed"]) {
    for (const mode of ["Active", "Passive"])
      assert.ok(plan({ conditionContext: { [status]: true } }, {}, check(mode)).blockedReason);
  }
  const sleeping = { conditionContext: { sleeping: true } };
  assert.match(plan(sleeping).blockedReason, /Sleeping/);
  assert.equal(plan(sleeping, {}, check("Passive")).blockedReason, "");
  const paralyzed = { conditionContext: { paralyzed: true } };
  assert.ok(plan(paralyzed, {}, check(), "dex").blockedReason);
  assert.ok(plan(paralyzed).blockedReason);
  assert.equal(plan(paralyzed, { purelyMentalConfirmed: true }).blockedReason, "");
});

test("Held/Pinned NPCs need the actual opposed escape, with declared proficiency, Size, time and error", () => {
  for (const state of ["held", "pinned"]) {
    const system = { conditionContext: { [state]: true } };
    assert.ok(plan(system, {}, check(), "str", "athletics").blockedReason);
    const escape = plan(
      system,
      { grappleProficient: false, grappleSizeDifference: 2, grappleContextConfirmed: true },
      check("Active", "restraint-escape"),
      "str",
      "athletics"
    );
    assert.equal(escape.blockedReason, "");
    assert.equal(escape.restraint.sizeBonus, 8);
    assert.equal(escape.restraint.errorIncrease, 2);
    assert.equal(escape.restraint.timeLocked, true);
    assert.equal(escape.restraint.check.time, "2 Full Actions");
    assert.ok(plan(system, {}, check("Active", "restraint-escape"), "str", "athletics").blockedReason);
  }
  assert.equal(plan({ conditionContext: { held: true } }, {}, { ...check(), time: "1 Free Action" }).blockedReason, "");
  assert.ok(plan({ conditionContext: { pinned: true } }, {}, { ...check(), time: "1 Free Action" }).blockedReason);
});

test("NPC shared skill penalties retain independent Sickened, Drunk and Entangled modifiers without counting Shaken twice", () => {
  const result = plan(
    { conditionContext: { sickened: true, drunk: true, entangled: true, shaken: true } },
    {},
    check(),
    "dex"
  );
  const rows = Object.fromEntries(result.penalties.map(row => [row.label, row.value]));
  assert.equal(rows.Sickened, -2);
  assert.equal(rows.Drunk, -2);
  assert.equal(rows["Entangled/Bound"], -4);
  assert.equal(rows.Shaken, undefined);
});

test("shared prepared condition context recognizes every alias and standard-NPC elimination without changing status sources", () => {
  const statuses = new Set(["stun", "paralysis", "blind", "deaf", "asleep", "pinned", "flat-footed"]),
    actor = { type: "npc", statuses, system: { damageTrack: { state: "dead" } } },
    result = actorConditionContext(actor);
  for (const key of ["stunned", "paralyzed", "blinded", "deafened", "sleeping", "pinned", "flatFooted", "dead"])
    assert.equal(result[key], true, key);
  assert.equal(statuses.size, 7);
  assert.equal(actorConditionContext({ ...actor, type: "agent" }).dead, false);
});

test("NPC tags enforce Bound, Mute and Nauseated restrictions and retain one-hand/language adjustments", () => {
  for (const [condition, tags] of [
    ["bound", "Grasp"],
    ["bound", "Hands-On"],
    ["mute", "Language"],
    ["nauseated", "Concentration"]
  ])
    assert.ok(plan({ conditionContext: { [condition]: true } }, {}, { ...check(), tags }).blockedReason);
  const tagged = { ...check(), tags: "Hands-On, Language" },
    result = plan({}, { oneHanded: true, noSharedLanguage: true }, tagged);
  assert.equal(result.tags.handPenalty, -4);
  assert.equal(result.capAdjustment, -20);
  assert.equal(plan({ activeFeatNames: ["Two-Weapon Basics"] }, { oneHanded: true }, tagged).tags.handPenalty, -2);
});

test("NPC sleeping/blind/deaf conditions use shared tagged penalties and caps, with actual mandatory-sense guards", () => {
  const named = { ...check("Passive"), tags: "Vision, Hearing" },
    result = plan({ conditionContext: { blinded: true, deafened: true } }, {}, named);
  assert.equal(result.senses.skillModifier, -16);
  assert.equal(result.capAdjustment, -30);
  assert.ok(plan({ conditionContext: { blinded: true } }, { requiresEyesight: true }, named).blockedReason);
  assert.ok(plan({ conditionContext: { deafened: true } }, { requiresHearing: true }, named).blockedReason);
  const sleeping = plan({ conditionContext: { sleeping: true } }, {}, named);
  assert.equal(sleeping.senses.skillModifier, -8);
  assert.equal(sleeping.capAdjustment, -20);
});
