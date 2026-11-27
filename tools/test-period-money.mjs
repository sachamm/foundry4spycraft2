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
import { missionStanding } from "../module/rules/gc/mission.mjs";

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
