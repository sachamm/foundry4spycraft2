import { resolveKnowledgeCheck } from "../module/rules/knowledge.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {
  TRIP_SIZES,
  tripAttackSkillChecks,
  tripAttackPlan,
  validateTripAttackProof
} from "../module/rules/trip-attack.mjs";
import { tripAttackTargetInput, validateTripAttackTarget } from "../module/apps/trip-attack.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { meleeSkillScope } from "../module/rules/melee-skill-feats.mjs";
import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
import { cfg, controls, prep, clock, sword, attack, input, state, actor, roll } from "./fixtures/trip-attack.mjs";
test("ordinary Trip has canonical Acrobatics DEX, half action, Armor Check Penalty and base error1 plus action error1", () => {
  assert.deepEqual(attack.attributes, ["dex"]);
  assert.equal(attack.error, 2);
  assert.equal(attack.time, "1 Half Action");
  assert.equal(attack.tags, "Armor Check Penalty");
  assert.equal(attack.role, "attacker");
  assert.equal(tripAttackSkillChecks("athletics", []).length, 0);
  assert.equal(tripAttackSkillChecks("acrobatics", [attack, attack]).filter(c => c.id === "trip").length, 1);
  const p = resolveSkillCheck(
    state(),
    "acrobatics",
    { ...attack, attributes: ["con"], tags: "", error: 0 },
    input({ ability: "con" })
  );
  assert.equal(p.ability, "dex");
  assert.equal(p.error, 2);
});
test("all twelve actual Size categories grant only the larger participant four per category and disallow targets more than one category larger", () => {
  for (let own = 0; own < TRIP_SIZES.length; own++)
    for (let target = 0; target < TRIP_SIZES.length; target++) {
      const p = tripAttackPlan(
        { ...state(), size: TRIP_SIZES[own] },
        "acrobatics",
        attack,
        input({ tripAttackOpponentSize: TRIP_SIZES[target], tripAttackSizeDifference: own - target })
      );
      assert.equal(!!p.blockedReason, own - target < -1);
      if (!p.blockedReason) assert.equal(p.sizeBonus, 4 * Math.max(0, own - target));
    }
});
test("known body Sizes must match the declared difference; reviewed custom or unrecorded sizes retain explicit GC facts", () => {
  const s = state();
  assert.match(
    tripAttackPlan(s, "acrobatics", attack, input({ tripAttackOpponentSize: "Large" })).blockedReason,
    /does not match/
  );
  assert.ok(
    tripAttackPlan(s, "acrobatics", attack, input({ tripAttackOpponentSize: "Large", tripAttackSizeDifference: -1 }))
      .evidence
  );
  assert.ok(
    tripAttackPlan(
      { ...s, size: "Large (long)" },
      "acrobatics",
      attack,
      input({ tripAttackOpponentSize: "Medium", tripAttackSizeDifference: 1 })
    ).evidence
  );
  assert.ok(
    tripAttackPlan({ ...s, size: "Reviewed custom body" }, "acrobatics", attack, input({ tripAttackSizeDifference: 2 }))
      .evidence
  );
});
test("both checks use ACP; the attacking roll adds only its own Size bonus and current relevant readied gear without double stacking", () => {
  for (const [feat, family, prof, bonus] of [
    ["Axe Basics", "axe", "edged", 1],
    ["Spear Basics", "spear", "exoticEdged", 2],
    ["Whip Basics", "whip", "exoticBlunt", 2]
  ]) {
    const w = sword({ meleeFamily: family, proficiency: prof, qualities: "", sizeHands: "T/1h" }),
      s = prep({ ...state([feat]), armor: { check: -3 } }, [w]),
      p = resolveSkillCheck(
        s,
        "acrobatics",
        attack,
        input({ tripAttackSizeDifference: 1, tripAttackOpponentSize: "Small" })
      );
    assert.equal(p.total, 10 + bonus - 3 + 4, feat);
    assert.equal(p.tripAttack.sizeBonus, 4);
    s.skillTotals.acrobatics.bonusEntries = [{ source: "Stronger gear", type: "gear", value: 5 }];
    s.skillTotals.acrobatics.totals.forEach(t => (t.total = 15));
    assert.equal(resolveSkillCheck(s, "acrobatics", attack, input()).total, 12);
  }
});
test("Great Sword Trip-defense and Still Standing resistance bonuses cannot leak into the attacking skill use", () => {
  const w = sword({ meleeFamily: "twoHandedSword", proficiency: "exoticEdged", sizeHands: "S/2h", qualities: "" }),
    s = prep({ ...state(["Great Sword Basics"]), classLevels: { brawler: 3 } }, [w]);
  assert.equal(meleeSkillScope("acrobatics", attack), "trip");
  assert.equal(resolveSkillCheck(s, "acrobatics", attack, input()).total, 10);
});
test("Baffled/incompetent and untrained error stay in the common skill pipeline, while Size remains a separate action modifier", () => {
  for (const condition of [{ baffled: true }, { incompetent: true }]) {
    const s = { ...state(), conditionContext: condition };
    assert.equal(
      resolveSkillCheck(s, "acrobatics", attack, input({ tripAttackSizeDifference: 1 })).total -
        resolveSkillCheck(s, "acrobatics", attack, input()).total,
      4
    );
  }
  const s = state();
  s.skillTotals.acrobatics.ranks = 0;
  assert.equal(resolveSkillCheck(s, "acrobatics", attack, input()).error, 4);
});
test("ordinary action requires actual own Count, adjacency, character/Size confirmation and a legal half action, with no take10/20 or free-action bypass", () => {
  for (const patch of [
    { tripAttackCombat: null },
    { tripAttackCombat: { ...clock(), turn: 1 } },
    { tripAttackAdjacent: false },
    { tripAttackParticipantsConfirmed: false },
    { tripAttackHalfActionConfirmed: false },
    { tripAttackHalfActionConfirmed: "true" },
    { tripAttackSizeDifference: -2 },
    { tripAttackSizeDifference: 1.5 },
    { tripAttackSizeDifference: 12 },
    { tripAttackOpponentName: "" },
    { method: "take10" },
    { method: "take20" },
    { tripAttackHalfActionConfirmed: false, freeActionConfirmed: true }
  ])
    assert.ok(tripAttackPlan(state(), "acrobatics", attack, input(patch)).blockedReason, JSON.stringify(patch));
  for (const condition of ["held", "pinned", "stunned", "paralyzed", "sleeping"])
    assert.ok(
      tripAttackPlan({ ...state(), conditionContext: { [condition]: true } }, "acrobatics", attack, input())
        .blockedReason,
      condition
    );
});
test("ordinary skill and Knowledge checks do not inherit a retained Trip declaration or bonus", () => {
  const s = state();
  for (const c of cfg.skills.acrobatics.checks) {
    const a = resolveSkillCheck(s, "acrobatics", c, input()),
      b = resolveSkillCheck(s, "acrobatics", c, { gearStatus: "available", synergySkill: "none" });
    assert.equal(a.tripAttack, null);
    for (const key of ["total", "error", "cap", "threat"]) assert.equal(a[key], b[key]);
  }
  assert.equal(
    resolveKnowledgeCheck(s, input()).total,
    resolveKnowledgeCheck(s, { gearStatus: "available", synergySkill: "none" }).total
  );
});
test("actual Actor parses Size, binds the observed opponent and current combat, and ignores caller-supplied fake Count data", async () => {
  const a = actor(),
    m = await roll(a, {
      tripAttackSizeDifference: "0",
      tripAttackOpponentName: "Fake selected name",
      tripAttackCombat: { ...clock(), id: "fake", turn: 99 }
    }),
    c = m.flags.spycraft2;
  assert.equal(c.ability, "dex");
  assert.equal(c.tripAttack.combat.id, clock().id);
  assert.equal(c.tripAttack.opponentUuid, "Actor.target");
  assert.equal(c.tripAttack.opponentName, "Target");
  assert.equal(c.tripAttack.opponentSize, "Medium");
  assert.equal(c.tripAttack.ownSize, "Medium");
  assert.equal(c.tripAttack.sizeDifference, 0);
  assert.equal(c.rollData.total, a.system.skillTotals.acrobatics.totals.find(t => t.ability === "dex").total + 1);
  assert.match(c.baseFlavor, /Trip against Target/);
  assert.equal(c.actionDiceAllowed, true);
  assert.equal(a.system.actionDice.value, 0);
});
test("actual target picker rejects self, foreign documents, unseen targets and changed current Size", () => {
  const a = actor();
  for (const id of [a.uuid, "Item.object", "Actor.missing"])
    assert.throws(
      () => tripAttackTargetInput(input({ tripAttackOpponentUuid: id }), a, { key: "acrobatics", check: attack }),
      /observed other/
    );
  const p = resolveSkillCheck(a.system, "acrobatics", attack, {
    ...input(),
    ...tripAttackTargetInput(input({ tripAttackOpponentUuid: "Actor.target" }), a, { key: "acrobatics", check: attack })
  }).tripAttack;
  game.actors.find(t => t.uuid === "Actor.target").system.size = "Large";
  assert.throws(() => validateTripAttackTarget(a, p), /opponent or current Size/);
  assert.deepEqual(
    tripAttackTargetInput({ tripAttackOpponentUuid: "Actor.missing" }, a, { key: "acrobatics", check: { id: "jump" } }),
    {}
  );
});
test("manual named opponent remains available only with actual adjacency/Size/half-action confirmations", async () => {
  const a = actor(),
    m = await roll(a, { tripAttackOpponentUuid: "", tripAttackOpponentName: "GC-reviewed unrecorded adversary" });
  assert.equal(m.flags.spycraft2.tripAttack.opponentUuid, "");
  assert.equal(m.flags.spycraft2.tripAttack.opponentSize, null);
  assert.match(m.flags.spycraft2.baseFlavor, /unrecorded adversary/);
});
test("current Count, own Size, target Size/availability and readied bonus changes during actual RNG reject unpublished Trip checks", async () => {
  for (const change of ["round", "turn", "ownSize", "targetSize", "targetGone", "gear", "halfAction"]) {
    const a = actor(),
      request = input({ check: "trip", tripAttackOpponentUuid: "Actor.target" }),
      n = game.messages.length;
    controls.draw = async () => {
      if (change === "round") a.clock.round++;
      if (change === "turn") a.clock.turn = 1;
      if (change === "ownSize") a.system.size = "Large";
      if (change === "targetSize") game.actors.find(t => t.uuid === "Actor.target").system.size = "Large";
      if (change === "targetGone") game.actors = game.actors.filter(t => t.uuid !== "Actor.target");
      if (change === "gear") {
        a.items[0].system.equipped = false;
        a.system = prep(a.system, a.items);
      }
      if (change === "halfAction") request.tripAttackHalfActionConfirmed = false;
    };
    await assert.rejects(a.rollSkill("acrobatics", "dex", request), /changed|confirm|Confirm/);
    assert.equal(game.messages.length, n, change);
  }
});
test("replacements require the actual current action/attribute/substitution and retain the original Trip proof", async () => {
  const a = actor(),
    m = await roll(a),
    c = m.flags.spycraft2;
  let draws = 0;
  controls.draw = async () => draws++;
  await assert.rejects(a.rollCheck(c.formula, c.rollData, { ...c, ability: "con", rerollOf: m.uuid }), /attribute/);
  a.clock.round++;
  await assert.rejects(a.rollCheck(c.formula, c.rollData, { ...c, rerollOf: m.uuid }), /changed/);
  a.clock.round--;
  const r = await a.rollCheck(c.formula, c.rollData, { ...c, rerollOf: m.uuid });
  assert.deepEqual(r.flags.spycraft2.tripAttack, c.tripAttack);
  assert.equal(draws, 1);
});
test("the actual Schemer substitution must still replace original DEX rather than another attribute", () => {
  const s = { ...state(), classLevels: { schemer: 4 } },
    p = tripAttackPlan(s, "acrobatics", attack, input()).evidence,
    args = {
      checkKind: "skill",
      skillKey: "acrobatics",
      checkId: "trip",
      ability: "int",
      combat: clock(),
      attributeSubstitution: { source: "All According to Plan", originalAbility: "dex", ability: "int" }
    };
  assert.doesNotThrow(() => validateTripAttackProof(s, p, args));
  assert.throws(
    () =>
      validateTripAttackProof(s, p, {
        ...args,
        attributeSubstitution: { ...args.attributeSubstitution, originalAbility: "str" }
      }),
    /attribute/
  );
  assert.throws(() => validateTripAttackProof({ ...s, classLevels: { schemer: 3 } }, p, args), /attribute/);
});
test("new Trip context participates in immutable evidence and cannot accept an older signature with it omitted", async () => {
  const a = actor(),
    m = await roll(a),
    c = m.flags.spycraft2,
    e = rollEvidence(c);
  assert.equal(rollEvidenceMatches(e, c), true);
  assert.equal(rollEvidenceMatches(rollEvidence({ ...c, tripAttack: null }), c), false);
  for (const key of Object.keys(c.tripAttack)) {
    const altered = structuredClone(c);
    altered.tripAttack[key] = "changed";
    assert.equal(rollEvidenceMatches(e, altered), false, key);
  }
});
test("canonical Axe/Spear/Whip feats add their actual readied bonus to ordinary attacking Trip in the real engine", async () => {
  const { makeFatigueActor } = await import("./fixtures/fatigue-actor.mjs"),
    { readFileSync } = await import("node:fs"),
    feats = JSON.parse(readFileSync(new URL("../src/data/feats.json", import.meta.url)));
  for (const [name, family, proficiency, bonus] of [
    ["Axe Basics", "axe", "edged", 1],
    ["Spear Basics", "spear", "exoticEdged", 2],
    ["Whip Basics", "whip", "exoticBlunt", 2]
  ]) {
    const a = makeFatigueActor(),
      f = feats.find(f => f.name === name);
    a.raw.proficiencies = { [proficiency]: { proficient: true } };
    a.items.push({
      id: "tripFeat",
      type: "feat",
      name: f.name,
      system: { ...f, tree: "meleeCombat", acquiredAtLevel: 1 }
    });
    const w = {
      id: "tripWeapon",
      name: "Actual reviewed " + family,
      type: "weapon",
      system: {
        meleeFamily: family,
        proficiency,
        sizeHands: "T/1h",
        useHands: 1,
        qualities: "",
        equipped: true,
        carried: true,
        quantity: 1,
        damage: "1d6"
      }
    };
    a.items.push(w);
    a.derive();
    assert.equal(a.system.featStatus.tripFeat.ok, true, name);
    const ready = resolveSkillCheck(a.system, "acrobatics", attack, input());
    w.system.equipped = false;
    a.derive();
    const stowed = resolveSkillCheck(a.system, "acrobatics", attack, input());
    assert.equal(ready.total - stowed.total, bonus, name);
  }
});
test("ordinary responding Trip keeps its separate Great Sword gear benefit and does not require the defender’s own attacking half action", async () => {
  const a = actor("Great Sword Basics");
  a.clock.turn = 1;
  const m = await a.rollSkill("acrobatics", "dex", {
    check: "resist-trip",
    tripOpponentName: "Actual incoming Trip opponent",
    tripAdjacent: true,
    tripSizeDifference: 0,
    tripIncomingConfirmed: true,
    gearStatus: "available",
    synergySkill: "none"
  });
  assert.ok(m?.uuid);
  assert.equal(m.flags.spycraft2.tripAttack, null);
  assert.equal(m.flags.spycraft2.tripDefense.checkId, "resist-trip");
  assert.equal(m.flags.spycraft2.meleeSkillFeats.scope, "trip-defense");
  assert.equal(m.flags.spycraft2.meleeSkillFeats.sources[0].feat, "Great Sword Basics");
  assert.equal(
    m.flags.spycraft2.rollData.total,
    a.system.skillTotals.acrobatics.totals.find(t => t.ability === "dex").total + 2
  );
});
test("an original owned Trip replacement stays bound to the same observed UUID through a cosmetic name change", async () => {
  const a = actor(),
    m = await roll(a),
    c = m.flags.spycraft2;
  game.actors.find(t => t.uuid === "Actor.target").name = "Renamed same opponent";
  const replacement = await a.rollCheck(c.formula, c.rollData, { ...c, rerollOf: m.uuid });
  assert.equal(replacement.flags.spycraft2.tripAttack.opponentUuid, "Actor.target");
  assert.equal(replacement.flags.spycraft2.tripAttack.opponentName, "Target");
});
test("cancelling the actual skill dialog never rolls or mutates resources, and invalid form declarations do not post", async () => {
  const a = actor(),
    before = game.messages.length,
    dice = a.system.actionDice.value;
  let draws = 0;
  controls.draw = async () => draws++;
  assert.equal(await a.rollSkill("acrobatics", "dex"), null);
  assert.equal(draws, 0);
  assert.equal(game.messages.length, before);
  for (const patch of [
    { tripAttackAdjacent: false },
    { tripAttackHalfActionConfirmed: false },
    { tripAttackParticipantsConfirmed: false },
    { tripAttackSizeDifference: "" },
    { tripAttackSizeDifference: "-2" },
    { method: "take10", safeToTake: true }
  ]) {
    await roll(a, patch);
    assert.equal(game.messages.length, before);
  }
  assert.equal(draws, 0);
  assert.equal(a.system.actionDice.value, dice);
});
