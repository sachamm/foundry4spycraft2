import test from "node:test";
import assert from "node:assert/strict";
import { GC_DATA } from "../module/rules/gc-tables.mjs";
import { campaignEffects } from "../module/rules/gc/campaign.mjs";
import {
  campaignActionDice,
  campaignAttackTerms,
  campaignBlastIncrement,
  campaignFallingDamage,
  campaignRangeIncrement,
  campaignRuleLines,
  campaignSkillDC,
  campaignSkillPlan,
  campaignStress,
  criticalInjuryBand,
  criticalInjuryCostShift,
  leadAdvantageShift,
  setCampaignRulesSource,
  skillCapsLifted,
  takeTenRefusal,
  threatsAutoActivate,
  triumphResult
} from "../module/rules/campaign-rules.mjs";
import { resolveSkillResult } from "../module/rules/checks.mjs";
import { checkCandidates } from "../module/rules/check-candidates.mjs";
import { lethalHitPlan } from "../module/rules/damage-application.mjs";
import { criticalHitChoices } from "../module/rules/critical-effects.mjs";
import { blastIncrementFeet } from "../module/rules/combat-actions.mjs";
import { weaponRangeEffects } from "../module/rules/firearms.mjs";
import { stressDefensePlan } from "../module/rules/stress-defense.mjs";
import { actionDieTerm } from "../module/rules/action-die-formula.mjs";
import { exposurePenalty } from "../module/rules/gc/mission.mjs";
import { fallingOutcome, fallingPlan } from "../module/rules/damage-types.mjs";

const effectsOf = (...ids) =>
  campaignEffects(ids.map(id => ({ ...GC_DATA.campaignQualities.find(q => q.id === id), scripted: true }))).effects;

/** Run `fn` with these qualities in force, then restore the empty source. */
function withQualities(ids, fn) {
  const effects = effectsOf(...ids);
  setCampaignRulesSource(() => effects);
  try {
    return fn(effects);
  } finally {
    setCampaignRulesSource(null);
  }
}

test("with no quality in force every number is the book's standard one", () => {
  assert.equal(triumphResult(), 75);
  assert.deepEqual(campaignAttackTerms(), { threat: 0, modifier: 0, rows: [], notes: [] });
  assert.equal(campaignRangeIncrement(30), 30);
  assert.equal(campaignBlastIncrement(10), 10);
  assert.deepEqual(criticalInjuryBand(), { min: 25, massive: 50, changed: false });
  assert.equal(criticalInjuryCostShift(), 0);
  assert.deepEqual(campaignStress(5), { amount: 5, multiplier: 1 });
  assert.equal(takeTenRefusal("take10"), "");
  assert.equal(skillCapsLifted(), false);
  assert.equal(campaignSkillDC(15), 15);
  assert.equal(threatsAutoActivate(), false);
  assert.equal(leadAdvantageShift(), 0);
  assert.deepEqual(campaignRuleLines(), []);
});

test("a throwing or empty source reads as no quality in force", () => {
  setCampaignRulesSource(() => {
    throw new Error("settings not ready");
  });
  try {
    assert.equal(triumphResult(), 75);
  } finally {
    setCampaignRulesSource(null);
  }
});

test("Violent widens attack threat ranges by 2 and Subtle takes 1 off every attack check (p.408)", () => {
  assert.deepEqual(campaignAttackTerms(effectsOf("violent")).threat, 2);
  assert.deepEqual(campaignAttackTerms(effectsOf("subtle")).rows, [["Campaign quality", -1]]);
  const both = campaignAttackTerms(effectsOf("violent", "subtle"));
  assert.equal(both.threat, 2);
  assert.equal(both.modifier, -1);
});

test("Common and Rare Spectacle move the Triumph to 60 and 90, and the check resolution follows (p.406)", () => {
  assert.equal(triumphResult(effectsOf("common-spectacle")), 60);
  assert.equal(triumphResult(effectsOf("rare-spectacle")), 90);
  assert.equal(resolveSkillResult(65, 10, { triumphAt: 60 }).triumph, true);
  assert.equal(resolveSkillResult(80, 10, { triumphAt: 90 }).triumph, false);
  withQualities(["rare-spectacle"], () => {
    assert.equal(resolveSkillResult(80, 10).triumph, false);
    assert.equal(checkCandidates({ checkKind: "skill", effectiveTotal: 85, naturalDie: 10 }).triumph, false);
    // A check keeps the Triumph result it was rolled under.
    assert.equal(
      checkCandidates({ checkKind: "skill", effectiveTotal: 80, naturalDie: 10, triumphAt: 75 }).triumph,
      true
    );
  });
});

test("Bulletproof and Gritty move the critical injury bands and their activation cost (p.406)", () => {
  assert.deepEqual(criticalInjuryBand(effectsOf("bulletproof")), { min: 36, massive: 61, changed: true });
  assert.deepEqual(criticalInjuryBand(effectsOf("gritty")), { min: 16, massive: 26, changed: true });
  const facts = { vitality: 80, wounds: 12, woundsMax: 12 };
  assert.equal(
    lethalHitPlan(facts, { damage: 30, injuryBand: criticalInjuryBand(effectsOf("bulletproof")) }).massive,
    null
  );
  assert.deepEqual(lethalHitPlan(facts, { damage: 30, injuryBand: criticalInjuryBand(effectsOf("gritty")) }).massive, {
    dc: 15,
    toMinusNine: true,
    min: 16,
    threshold: 26
  });
  const cost = (shift, id) =>
    criticalHitChoices({ checkKind: "attack" }, { injuryCostShift: shift }).find(c => c.id === id).cost;
  assert.equal(cost(0, "hit.ouch"), 2);
  assert.equal(cost(1, "hit.ouch"), 3);
  assert.equal(cost(-1, "hit.ouchAtZero"), 0);
  assert.equal(cost(-1, "hit.wounds"), 1);
});

test("Tense doubles stress and forbids taking 10; Mellow halves stress, minimum 1 (pp.407–408)", () => {
  assert.deepEqual(campaignStress(5, effectsOf("tense")), { amount: 10, multiplier: 2 });
  assert.deepEqual(campaignStress(5, effectsOf("mellow")), { amount: 2, multiplier: 0.5 });
  assert.deepEqual(campaignStress(1, effectsOf("mellow")), { amount: 1, multiplier: 0.5 });
  assert.match(takeTenRefusal("take10", effectsOf("tense")), /Tense/);
  assert.equal(takeTenRefusal("roll", effectsOf("tense")), "");
  const system = { survivalStats: { resistances: {}, resistanceSources: [] } };
  withQualities(["tense"], () => {
    const plan = stressDefensePlan(system, 4);
    assert.equal(plan.netDamage, 8);
    assert.deepEqual(plan.campaignQuality, { multiplier: 2, before: 4, after: 8 });
  });
  assert.equal(stressDefensePlan(system, 4).netDamage, 4);
});

test("Gunmen doubles range increments with other multipliers adding; Blockbuster triples blast increments", () => {
  assert.equal(campaignRangeIncrement(30, effectsOf("gunmen")), 60);
  withQualities(["gunmen"], () => {
    const plain = weaponRangeEffects({ activeFeatNames: [] }, { range: 40, proficiency: "rifle" }, { firearm: true });
    assert.equal(plain.increment, 80);
    assert.equal(plain.cqbRange, 60);
    const mastery = weaponRangeEffects(
      { activeFeatNames: ["Marksmanship Supremacy"] },
      { range: 40, proficiency: "rifle" },
      { firearm: true }
    );
    // ×2 and ×2 add to ×3 (p.329).
    assert.equal(mastery.increment, 120);
  });
  withQualities(["blockbuster"], () => assert.equal(blastIncrementFeet("BLS (10 ft.)"), 30));
  assert.equal(blastIncrementFeet("BLS (10 ft.)"), 10);
});

test("Omni-Competent lifts skill caps; Cakewalk and Comedy of Errors shift skill DCs (pp.406, 408)", () => {
  assert.equal(skillCapsLifted(effectsOf("omni-competent")), true);
  assert.equal(campaignSkillDC(20, effectsOf("cakewalk")), 15);
  assert.equal(campaignSkillDC(12, effectsOf("cakewalk")), 10);
  assert.equal(campaignSkillDC(8, effectsOf("cakewalk")), 8);
  assert.equal(campaignSkillDC(20, effectsOf("comedy-of-errors")), 25);
});

test("Paranoid: +4 on surprise Hide checks for special characters, −4 on persuasion; Comedy of Errors error +2", () => {
  const system = {
    abilities: {
      str: { value: 12 },
      dex: { value: 14 },
      con: { value: 12 },
      int: { value: 10 },
      wis: { value: 8 },
      cha: { value: 13 }
    }
  };
  const paranoid = effectsOf("paranoid");
  const hide = campaignSkillPlan(system, "sneak", { id: "hide", attributes: ["dex"] }, { surprise: true }, paranoid);
  assert.deepEqual(
    hide.bonuses.map(b => b.value),
    [4]
  );
  const standard = campaignSkillPlan(
    { ...system, npcType: "standard" },
    "sneak",
    { id: "hide", attributes: ["dex"] },
    { surprise: true },
    paranoid
  );
  assert.deepEqual(standard.bonuses, []);
  const persuade = campaignSkillPlan(
    system,
    "impress",
    { id: "persuasion", attributes: ["cha"] },
    { paranoidPersuasion: true },
    paranoid
  );
  assert.deepEqual(
    persuade.bonuses.map(b => b.value),
    [-4]
  );
  const comedy = effectsOf("comedy-of-errors");
  assert.equal(
    campaignSkillPlan(system, "notice", { id: "awareness", attributes: ["wis"] }, {}, comedy).errorIncrease,
    2
  );
  assert.equal(campaignSkillPlan(system, "sneak", { id: "hide", attributes: ["dex"] }, {}, comedy).errorIncrease, 0);
});

test("Bloodbath makes threats free; Speed-Frame and Thriller shift Lead Advantages (pp.406, 408)", () => {
  assert.equal(threatsAutoActivate(effectsOf("bloodbath")), true);
  assert.equal(leadAdvantageShift(effectsOf("speed-frame")), 1);
  assert.equal(leadAdvantageShift(effectsOf("thriller")), -1);
});

test("Spirited and Bleak change player action dice; the dice term follows (pp.406, 408)", () => {
  assert.deepEqual(campaignActionDice(effectsOf("spirited")), { explodeLow: true, noExplode: false, step: 1 });
  assert.deepEqual(campaignActionDice(effectsOf("bleak")), { explodeLow: false, noExplode: true, step: 0 });
  assert.equal(actionDieTerm(6, 6, {}), "1d6x>=6");
  assert.equal(actionDieTerm(6, 5, { explodeLow: true }), "1d6x>=5x=1");
  assert.equal(actionDieTerm(6, 6, { explodes: false }), "1d6");
});

test("Virtuous doubles and Corrupt halves honor-code exposure penalties (p.408)", () => {
  assert.deepEqual(exposurePenalty({ reputation: -5, netWorth: -1000 }, { honorMultiplier: 2 }), {
    reputation: -10,
    netWorth: -2000
  });
  assert.deepEqual(exposurePenalty({ reputation: -5, netWorth: -1001 }, { honorMultiplier: 0.5 }), {
    reputation: -2,
    netWorth: -500
  });
});

test("a fall: dice per 10 ft. up to 20d6, a made Falling check, armor piercing, stress and sprawl (pp.106, 336)", () => {
  const plan = fallingPlan({ feet: 45 });
  assert.deepEqual(plan, { feet: 45, counted: 45, dice: 4, formula: "4d6", kind: "lethal", armorPiercing: 4 });
  assert.equal(fallingPlan({ feet: 500 }).dice, 20);
  assert.equal(fallingPlan({ feet: 15, soft: true }).dice, 0);
  assert.equal(fallingPlan({ feet: 40, surface: "fluid" }).kind, "subdual");
  const failed = fallingOutcome(plan, { rolled: 14, dr: 5 });
  assert.deepEqual([failed.damage, failed.reduction, failed.net, failed.sprawled, failed.stress], [14, 1, 13, true, 8]);
  const landed = fallingOutcome(plan, { rolled: 14, checkResult: 24 });
  assert.deepEqual([landed.damage, landed.sprawled], [8, false]);
  // Never below 1 point per die.
  assert.equal(fallingOutcome(plan, { rolled: 6, checkResult: 40 }).damage, 4);
  assert.equal(fallingOutcome(plan, { rolled: 14, halve: true }).damage, 7);
  assert.equal(fallingOutcome(fallingPlan({ feet: 20 }), { rolled: 7 }).stress, 0);
  assert.equal(campaignFallingDamage(9, { special: true }, effectsOf("wire-fu")), 4);
  assert.equal(campaignFallingDamage(9, { special: false }, effectsOf("wire-fu")), 9);
});

test("Spirited raises a bonus pool's die when it is spent, not the pool on record (p.408)", async () => {
  const { spentPoolDie } = await import("../module/rules/bonus-pools.mjs");
  assert.equal(spentPoolDie({}, 4), 4);
  withQualities(["spirited"], () => {
    assert.equal(spentPoolDie({}, 4), 6);
    assert.equal(spentPoolDie({}, 12), 12);
    assert.equal(spentPoolDie({ npcType: "special" }, 4), 4, "player characters only");
  });
});

test("Bulletproof and Gritty move Medicine error ranges and DCs (pp.406–407)", () => {
  withQualities(["gritty"], effects => {
    const plan = campaignSkillPlan({}, "medicine", { attributes: ["int"] }, {}, effects);
    assert.equal(plan.errorIncrease, 2);
    assert.ok(plan.notes.some(note => /DC is 5 higher/.test(note)));
    assert.equal(campaignSkillPlan({}, "notice", { attributes: ["wis"] }, {}, effects).errorIncrease, 0);
  });
  withQualities(["bulletproof"], effects => {
    assert.equal(campaignSkillPlan({}, "medicine", { attributes: ["int"] }, {}, effects).errorIncrease, -2);
  });
});

test("Cakewalk and Comedy of Errors move the Falling and forward-observer DCs (p.406)", async () => {
  const { indirectFirePlan } = await import("../module/rules/indirect-fire.mjs");
  const plan = fallingPlan({ feet: 45 });
  withQualities(["cakewalk"], () => {
    assert.equal(fallingOutcome(plan, { rolled: 14, checkResult: 17 }).landed, true);
    assert.equal(indirectFirePlan({}, { observerResult: 12 }).blocked, false);
  });
  withQualities(["comedy-of-errors"], () => {
    assert.equal(fallingOutcome(plan, { rolled: 14, checkResult: 22 }).landed, false);
    const relay = indirectFirePlan({}, { observerResult: 17 });
    assert.equal(relay.blocked, true);
    assert.match(relay.reason, /DC 20/);
  });
});

test("round-2 council: campaign DCs reach helpers, Surgery and bleeding; promotion counts as special; one Feat Purchase per mission", async () => {
  const { helperDC } = await import("../module/rules/cooperative.mjs");
  const { campaignMedicineDC, isSpecialCharacter, featPurchasePlan } =
    await import("../module/rules/campaign-rules.mjs");
  withQualities(["cakewalk"], () => assert.equal(helperDC({ setDC: true }), 10));
  withQualities(["comedy-of-errors"], () => assert.equal(helperDC({ leaderResult: 18 }), 20));
  withQualities(["gritty"], effects => assert.equal(campaignMedicineDC(20, effects), 20 + effects.medicineDC));
  assert.equal(isSpecialCharacter({ npcType: "standard" }), false);
  assert.equal(
    isSpecialCharacter({ npcType: "standard", promotion: { mission: "m2" }, usagePeriods: { mission: "m2" } }),
    true,
    "promoted for this mission"
  );
  assert.equal(
    isSpecialCharacter({ npcType: "standard", promotion: { mission: "m1" }, usagePeriods: { mission: "m2" } }),
    false
  );
  const system = { level: 3, xp: 20000, usagePeriods: { mission: "m2" }, featTrades: { purchaseMission: "m2" } };
  assert.equal(featPurchasePlan(system, { xp: 3000 }, { featPurchase: true }).allowed, false);
  assert.equal(
    featPurchasePlan({ ...system, featTrades: { purchaseMission: "m1" } }, { xp: 3000 }, { featPurchase: true })
      .allowed,
    true
  );
});

test("round-3 council: NPC critical prices, Feat Purchase mid-mission, the whole helper DC shifts, villains are special", async () => {
  const { npcCriticalPrice } = await import("../module/rules/critical-effects.mjs");
  const { featPurchasePlan } = await import("../module/rules/campaign-rules.mjs");
  const { helperDC } = await import("../module/rules/cooperative.mjs");
  const { characterTargetPlan } = await import("../module/rules/character-target.mjs");
  const attack = { checkKind: "attack" };
  // Gritty brings the Ouch-at-0 critical to 0: nothing is spent.
  withQualities(["gritty"], () => {
    const free = criticalHitChoices(attack).find(choice => choice.id === "hit.ouchAtZero");
    assert.equal(npcCriticalPrice(attack, free.cost).cost, 0);
  });
  assert.deepEqual(npcCriticalPrice(attack, 1, { laser: true }), {
    cost: 0,
    baseCost: 1,
    sources: ["Laser damage –1"]
  });
  const toughLuck = npcCriticalPrice({ ...attack, blackCat: { toughLuck: true } }, 1);
  assert.equal(toughLuck.cost, 2);
  assert.match(toughLuck.sources[0], /Tough Luck/);
  assert.equal(npcCriticalPrice({ checkKind: "skill", blackCat: { toughLuck: true } }, 1).cost, 2, "skill too");
  const role = { ...attack, attackContext: { targetRole: { label: "Mastermind", extraDiceToActivate: 2 } } };
  assert.equal(npcCriticalPrice(role, 1).cost, 3);
  assert.equal(npcCriticalPrice(role, 2, { bloodbath: true }).cost, 0);
  assert.equal(npcCriticalPrice({ checkKind: "skill" }, 1, { bloodbath: true, laser: true }).cost, 1, "attacks only");

  const system = { level: 3, xp: 20000, usagePeriods: { mission: "m2" } };
  const during = featPurchasePlan(system, { xp: 3000 }, { featPurchase: true }, { missionActive: true });
  assert.equal(during.allowed, false);
  assert.match(during.reason, /mission is under way/);
  assert.equal(featPurchasePlan(system, { xp: 3000 }, { featPurchase: true }, { missionActive: false }).allowed, true);

  withQualities(["comedy-of-errors"], () => assert.equal(helperDC({ leaderResult: 40 }), 35));
  withQualities(["cakewalk"], () => assert.equal(helperDC({ leaderResult: 40 }), 25));

  const villain = characterTargetPlan({ uuid: "Actor.v", type: "npc", npcType: "villain" });
  assert.equal(villain.characterType, "special");
  assert.equal(villain.standard, false);
});

test("an NPC's critical price matches an agent's for the same check (round-4 council)", async () => {
  const { npcCriticalPrice } = await import("../module/rules/critical-effects.mjs");
  const { criticalPlan } = await import("../module/rules/criticals.mjs");
  const role = { label: "Henchman", extraDiceToActivate: 1 };
  for (const laser of [false, true])
    for (const toughLuck of [false, true])
      for (const targetRole of [null, role])
        for (const baseCost of [1, 2, 3, 4]) {
          const check = {
            checkKind: "attack",
            threatConfirmed: true,
            attackContext: { laser, ...(targetRole ? { targetRole } : {}) },
            ...(toughLuck ? { blackCat: { toughLuck: true } } : {})
          };
          const agent = criticalPlan({}, check, {
            baseCost,
            effect: "test",
            effectConfirmed: true,
            beforeDamage: true,
            available: 10
          });
          assert.ok(!agent.blocked, agent.reason);
          assert.equal(npcCriticalPrice(check, baseCost, { laser }).cost, agent.cost, JSON.stringify(check));
        }
});

test("the leader's card prints the helpers' worked-out DC, with the campaign shift (round-4 council)", async () => {
  const { cooperativeNotes } = await import("../module/rules/cooperative.mjs");
  const leader = { effectiveTotal: 40, cooperative: { role: "leader", max: 2, setDC: false } };
  withQualities(["comedy-of-errors"], () => assert.match(cooperativeNotes(leader)[0], /DC 35/));
  withQualities(["cakewalk"], () => assert.match(cooperativeNotes(leader)[0], /DC 25/));
});

test("a saved injury keeps the table's Surgery DC, and the campaign shift is applied when it is shown (Codex)", async () => {
  const { criticalInjuryResult, surgeryDCNow } = await import("../module/rules/critical-injuries.mjs");
  const { campaignMedicineDC } = await import("../module/rules/campaign-rules.mjs");
  const plan = { damage: 20, die: 20 },
    plain = criticalInjuryResult(plan, 10);
  withQualities(["gritty"], effects => {
    const gritty = criticalInjuryResult(plan, 10);
    assert.deepEqual(gritty, plain, "the stored result does not depend on the qualities in force");
    assert.equal(surgeryDCNow(gritty), campaignMedicineDC(plain.surgeryDC, effects));
  });
});

test("Spider Mastery and Fall Guy take each falling die lower, at least 1 a die (Codex)", async () => {
  const { fallDieReduction, reducedFallTotal } = await import("../module/rules/damage-types.mjs");
  assert.equal(fallDieReduction({ activeFeatNames: ["Spider Mastery"] }), 1);
  assert.equal(fallDieReduction({ activeFeatNames: [], classLevels: { stuntman: 4 } }), 2);
  assert.equal(reducedFallTotal({ total: 12, faces: [6, 6], dice: 2 }, 1), 10);
  assert.equal(reducedFallTotal({ total: 12, faces: [6, 6], dice: 2 }, 2), 8);
  assert.equal(reducedFallTotal({ total: 3, faces: [1, 2], dice: 2 }, 2), 2, "never below 1 a die");
  assert.equal(reducedFallTotal({ total: 12, dice: 2 }, 1), 10);
  assert.equal(reducedFallTotal({ total: 12, faces: [6, 6], dice: 2 }, 0), 12);
});
