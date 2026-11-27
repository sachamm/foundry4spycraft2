import test from "node:test";
import assert from "node:assert/strict";
import { campaignSkillDCPolicy, campaignSkillDCPlan } from "../module/rules/campaign-skill-dc.mjs";

const check = (effects, skillKey = "medicine", total = 15) => ({
  checkKind: "skill",
  skillKey,
  effectiveTotal: total,
  campaignSkillDCPolicy: campaignSkillDCPolicy(effects)
});

test("campaign DC resolution applies Cakewalk's own floor and Medicine adjustments without modifying opposing results", () => {
  for (const [baseDC, dc] of [
    [25, 20],
    [12, 10],
    [8, 8]
  ])
    assert.equal(campaignSkillDCPlan(check({ skillDC: -5, skillDCMinimum: 10 }), { baseDC, confirmed: true }).dc, dc);
  assert.equal(campaignSkillDCPlan(check({ skillDC: 5, medicineDC: 5 }), { baseDC: 15, confirmed: true }).dc, 25);
  assert.equal(
    campaignSkillDCPlan(check({ skillDC: 5, medicineDC: 5 }, "athletics"), { baseDC: 15, confirmed: true }).dc,
    20
  );
  assert.equal(campaignSkillDCPlan(check({ medicineDC: -5 }), { baseDC: 20, confirmed: true }).succeeded, true);
  assert.equal(
    campaignSkillDCPlan(check({ medicineDC: -5 }, "medicine", 14), { baseDC: 20, confirmed: true }).succeeded,
    false
  );
  assert.equal(campaignSkillDCPolicy({}), null);
});

test("source DC must be explicitly confirmed and recorded modifiers and results must remain valid", () => {
  const c = check({ skillDC: 5 });
  for (const baseDC of [NaN, Infinity, -1, 1.5, "20"])
    assert.throws(() => campaignSkillDCPlan(c, { baseDC, confirmed: true }));
  assert.throws(() => campaignSkillDCPlan(c, { baseDC: 20 }));
  for (const extra of [
    { superseded: true },
    { checkKind: "attack" },
    { effectiveTotal: NaN },
    { campaignSkillDCPolicy: null }
  ])
    assert.throws(() => campaignSkillDCPlan({ ...c, ...extra }, { baseDC: 20, confirmed: true }));
});
