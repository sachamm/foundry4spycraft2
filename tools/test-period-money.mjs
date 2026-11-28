import test from "node:test";
import assert from "node:assert/strict";
import { setCampaignRulesSource } from "../module/rules/campaign-rules.mjs";
import {
  historicalMoneyModifier,
  periodMoney,
  periodMoneyModifier,
  setCampaignYearSource
} from "../module/rules/period-money.mjs";
import { parseStandingCost } from "../module/rules/standing.mjs";
import { exposurePenalty, missionStanding } from "../module/rules/gc/mission.mjs";

test("Table 7.4 by year", () => {
  assert.equal(historicalMoneyModifier(1955), 0.1);
  assert.equal(historicalMoneyModifier(1969), 0.2);
  assert.equal(historicalMoneyModifier(1975), 0.3);
  assert.equal(historicalMoneyModifier(1984), 0.6);
  assert.equal(historicalMoneyModifier(2001), 1);
  assert.equal(historicalMoneyModifier(1800), 1);
  assert.equal(historicalMoneyModifier(null), 1);
});

test("money changes only while Historical is in force and the clock has a year", () => {
  assert.equal(periodMoneyModifier({ effects: {}, year: 1955 }), 1);
  assert.equal(periodMoneyModifier({ effects: { historicalMoney: true }, year: null }), 1);
  assert.equal(periodMoney(750000, { effects: { historicalMoney: true }, year: 1962 }), 150000);
  assert.equal(periodMoney(3, { effects: { historicalMoney: true }, year: 1955 }), 1);
});

test("standing costs and Net Worth awards follow the registered year", t => {
  t.after(() => {
    setCampaignRulesSource(null);
    setCampaignYearSource(null);
  });
  const before = parseStandingCost("15/$750,000").netWorth,
    award = missionStanding({ caliber: 2 }).netWorth;
  setCampaignRulesSource(() => ({ historicalMoney: true }));
  setCampaignYearSource(() => 1975);
  assert.equal(parseStandingCost("15/$750,000").netWorth, Math.round(before * 0.3));
  assert.equal(parseStandingCost("2 Reputation").netWorth, 30000);
  assert.equal(missionStanding({ caliber: 2 }).netWorth, Math.round(award * 0.3));
});

test("an exposure penalty's Net Worth follows the year; Reputation does not", t => {
  t.after(() => {
    setCampaignRulesSource(null);
    setCampaignYearSource(null);
  });
  setCampaignRulesSource(() => ({ historicalMoney: true }));
  setCampaignYearSource(() => 1955);
  assert.deepEqual(exposurePenalty({ reputation: -10, netWorth: -100000 }), { reputation: -10, netWorth: -10000 });
});

test("a small loss under Table 7.4 stays a loss of at least $1, never −0", () => {
  const options = { effects: { historicalMoney: true }, year: 1955 };
  assert.equal(periodMoney(-3, options), -1);
  assert.equal(periodMoney(3, options), 1);
  assert.ok(Object.is(periodMoney(0, options), 0));
  assert.equal(periodMoney(-100000, options), -10000);
});

test("a companion's death and the Revolving Door price follow Table 7.4 under Historical (pp.201, 204, 408)", async t => {
  const { companionLoss } = await import("../module/rules/companions.mjs");
  const { campaignRuleLines } = await import("../module/rules/campaign-rules.mjs");
  assert.deepEqual(companionLoss({ level: 5 }, { effects: { historicalMoney: true }, year: 1965 }), {
    reputation: 5,
    netWorth: 50000
  });
  assert.equal(companionLoss({ level: 5 }, { effects: {}, year: 1965 }).netWorth, 250000);
  t.after(() => setCampaignYearSource(null));
  setCampaignYearSource(() => 1965);
  const door = effects =>
    campaignRuleLines(effects, { money: amount => periodMoney(amount, { effects }) }).find(line =>
      line.includes("200 Reputation")
    );
  assert.match(door({ revolvingDoor: true, historicalMoney: true }), /\$2,000,000\./);
  assert.match(door({ revolvingDoor: true }), /\$10,000,000\./);
});
