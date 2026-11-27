import test from "node:test";
import assert from "node:assert/strict";
import {
  campaignCqbRange,
  campaignErrorActivationCap,
  campaignTake10Time,
  campaignTriumphXPPercent,
  gladiatorsDefense,
  omniPenalty,
  setCampaignRulesSource
} from "../module/rules/campaign-rules.mjs";
import { ammunitionState } from "../module/rules/ammunition-use.mjs";
import { criticalPlan } from "../module/rules/criticals.mjs";
import { missionXPPlan } from "../module/rules/action-dice.mjs";
import { incomingDefensePlan } from "../module/rules/defense.mjs";

const withRules = (effects, fn) => {
  setCampaignRulesSource(() => effects);
  try {
    return fn();
  } finally {
    setCampaignRulesSource(() => ({}));
  }
};

test("Bottomless Clip stops counting shots in weapons that hold 5 or more", () => {
  assert.equal(ammunitionState({ ammo: "15M4" }).tracked, true);
  withRules({ bottomlessClip: true }, () => {
    const pistol = ammunitionState({ ammo: "15M4" });
    assert.equal(pistol.tracked, false);
    assert.equal(pistol.bottomless, true);
    assert.equal(ammunitionState({ ammo: "2S" }).bottomless, undefined);
  });
});

test("Omni-Competent halves penalties, rounding down, never below 1", () => {
  const plain = omniPenalty({});
  assert.equal(plain(-5), -5);
  const halve = omniPenalty({ halveSkillPenalties: true });
  assert.deepEqual([-5, -4, -1, 0, 3].map(halve), [-2, -2, -1, 0, 3]);
});

test("Comedy of Errors caps skill error activation at 2 dice and slows take 10", () => {
  assert.equal(campaignErrorActivationCap({}), null);
  assert.equal(campaignErrorActivationCap({ errorActivationDiceMaximum: 2 }), 2);
  assert.equal(campaignTake10Time(2, {}), 2);
  assert.equal(campaignTake10Time(2, { take10TimeMultiplier: 4 }), 4);
  const check = { checkKind: "skill", skillKey: "sneak", errorConfirmed: true };
  const options = {
    kind: "failure",
    opponent: true,
    lineOfSight: true,
    samePayer: false,
    baseCost: 4,
    effect: "Trips the alarm",
    effectConfirmed: true,
    available: 6
  };
  const before = criticalPlan({}, check, options);
  assert.equal(before.blocked, false, before.reason);
  assert.equal(before.cost, 4);
  withRules({ errorActivationDiceMaximum: 2 }, () => {
    const capped = criticalPlan({}, check, options);
    assert.equal(capped.cost, 2);
    assert.ok(capped.sources.some(line => line.includes("Comedy of Errors")));
  });
});

test("a Triumph adds 10% of the multiplied reward, 5% under Common Spectacle", () => {
  assert.equal(campaignTriumphXPPercent(10, {}), 10);
  assert.equal(campaignTriumphXPPercent(10, { triumphXPPercent: 5 }), 5);
  const sys = () => ({ level: 5, xp: 0, actionDieAwards: {}, missionXPRewards: {}, crossroads: { xpPercent: 10 } });
  const base = { baseXP: 101, threatLevel: 5, mission: "m", missionCompleteConfirmed: true };
  let plan = missionXPPlan(sys(), { ...base, triumph: true, crossroads: true });
  assert.equal(plan.record.coreXP, 505);
  assert.equal(plan.record.triumphXP, 51);
  assert.equal(plan.record.crossroadsXP, 51);
  assert.equal(plan.record.totalXP, 607);
  plan = withRules({ triumphXPPercent: 5 }, () => missionXPPlan(sys(), { ...base, triumph: true }));
  assert.equal(plan.record.triumphXP, 26);
  assert.equal(plan.record.totalXP, 531);
});

test("Gladiators narrows CQB Range to 20 ft. unless a 60 ft. source applies", () => {
  assert.equal(campaignCqbRange(false, {}), 30);
  assert.equal(campaignCqbRange(true, {}), 60);
  assert.equal(campaignCqbRange(false, { cqbRange: 20 }), 20);
  assert.equal(campaignCqbRange(true, { cqbRange: 20 }), 60);
  assert.equal(campaignCqbRange(false, { rangeIncrementMultiplier: 2 }), 60);
});

test("Gladiators adds 1 Defense against ranged attacks per Melee or Unarmed Combat feat", () => {
  const system = {
    activeFeatSelections: [
      { name: "A", tree: "Melee Combat" },
      { name: "B", tree: "unarmedCombat" },
      { name: "C", tree: "Ranged Combat" }
    ]
  };
  const effects = { meleeFeatRangedDefense: true };
  assert.equal(gladiatorsDefense(system, true, {}), 0);
  assert.equal(gladiatorsDefense(system, true, effects), 2);
  assert.equal(gladiatorsDefense(system, false, effects), 0);
  const defender = {
    ...system,
    abilities: { dex: { mod: 0 } },
    defense: { total: 14, dodgeBonuses: 0, dexterity: 0 },
    classLevels: {}
  };
  const plain = incomingDefensePlan(defender, { ranged: true }).total;
  withRules(effects, () => {
    assert.equal(incomingDefensePlan(defender, { ranged: true }).total, plain + 2);
    assert.equal(incomingDefensePlan(defender, { ranged: false }).total, plain);
  });
});

test("Catch Phrase reminds the table on a threat, and the reminder qualities list their rulings", async () => {
  const { checkFlavor } = await import("../module/rules/outcomes.mjs");
  const { campaignRuleLines } = await import("../module/rules/campaign-rules.mjs");
  const check = { checkKind: "skill", threatConfirmed: true, successConfirmed: true, rawTotal: 25, naturalDie: 20 };
  assert.doesNotMatch(checkFlavor(check), /Catch Phrase/);
  withRules({ catchPhrase: true }, () => assert.match(checkFlavor(check), /Catch Phrase: once per session/));
  const lines = campaignRuleLines({ catchPhrase: true, goodAndEvil: true, revolvingDoor: true });
  assert.equal(lines.length, 3);
});
