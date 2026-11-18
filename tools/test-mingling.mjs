import test from "node:test";
import assert from "node:assert/strict";
import { minglingPlan } from "../module/rules/mingling.mjs";

const stealth = { id: "stealth" };
const owner = (...feats) => ({ activeFeatNames: ["Mingling Basics", ...feats] });

test("Mingling Basics: crowd Size Rating as a synergy bonus on Blend/Stealth, and no flat-footed on a failure", () => {
  const plan = minglingPlan(owner(), "blend", stealth, { minglingCrowdRating: 4 });
  assert.deepEqual(plan.bonuses, [{ source: "Mingling Basics (crowd)", type: "synergy", value: 4 }]);
  assert.match(plan.notes[0], /not leave you flat-footed/);
  assert.deepEqual(minglingPlan(owner(), "blend", stealth, {}).bonuses, []);
  assert.match(minglingPlan(owner(), "blend", stealth, { minglingCrowdRating: 11 }).blockedReason, /0 to 10/);
  assert.deepEqual(minglingPlan({ activeFeatNames: [] }, "blend", stealth, { minglingCrowdRating: 4 }).bonuses, []);
  assert.deepEqual(minglingPlan(owner(), "sneak", { id: "hide" }, { minglingCrowdRating: 4 }).bonuses, []);
});

test("Mastery and Supremacy state their reduced penalties and invisibility thresholds", () => {
  assert.match(minglingPlan(owner("Mingling Mastery"), "blend", stealth).notes.join(" "), /500 or more/);
  const top = minglingPlan(owner("Mingling Mastery", "Mingling Supremacy"), "blend", stealth).notes.join(" ");
  assert.match(top, /50 or more/);
  assert.doesNotMatch(top, /500 or more/);
});
