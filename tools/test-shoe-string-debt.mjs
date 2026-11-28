import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setCampaignRulesSource, campaignRuleLines } from "../module/rules/campaign-rules.mjs";
import { campaignEffects, activeQualities } from "../module/rules/gc/campaign.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";

// Shoe String Budget (p.408): every player character begins with a Debt Subplot (p.55).
const data = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))).find(
  c => c.key === "wheelman"
);
const cls = {
  id: "wheelman",
  name: "Wheelman",
  type: "class",
  system: { ...structuredClone(data), identifier: "wheelman", vitalityDie: 10 }
};
const build = subplots => ({
  level: 1,
  usagePeriods: { mission: "m" },
  classLevels: { wheelman: 1 },
  actionDice: { max: 3 },
  abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 10 }])),
  progression: [{ classId: "wheelman", vitality: 5, skills: {} }],
  misc: {},
  subplots
});
const debtTodo = subplots => {
  const s = build(subplots);
  computeAgent(s, [cls], cfg);
  return s.todo.some(row => /Debt Subplot/.test(row.text));
};

test("Shoe String Budget asks for a Debt Subplot until one is recorded", () => {
  const { effects } = campaignEffects(activeQualities(["shoe-string-budget"]));
  assert.equal(effects.debtSubplot, true);
  assert.ok(campaignRuleLines(effects).some(line => /Debt Subplot/.test(line)));
  assert.equal(debtTodo([]), false, "without the quality there is nothing to do");
  setCampaignRulesSource(() => effects);
  try {
    assert.equal(debtTodo([]), true);
    assert.equal(debtTodo([{ name: "Rival", notes: "", complete: false }]), true);
    assert.equal(debtTodo([{ name: "Debt: the casino", notes: "", complete: false }]), false);
  } finally {
    setCampaignRulesSource(null);
  }
});
