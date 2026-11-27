import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  crossroadsSessionPolicy as policy,
  crossroadsSessionReviewPlan as reviewPlan,
  nextSessionStartingDice
} from "../module/rules/crossroads-session.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { sessionDicePlan } from "../module/services/periods.mjs";
const source = (crossroadsTitle = "hardened", level = 16) => ({
  actorUuid: "Actor.a",
  crossroadsTitle,
  level,
  worldTime: 10,
  usagePeriods: { session: "s" },
  actionDice: { value: 3 }
});
const reset = title => ({ session: "s", actorUuid: "Actor.a", crossroadsTitle: title, level: 16 });
const review = (s, eligibleTitle) =>
  reviewPlan(s, {
    id: "review",
    eligibleTitle,
    note: "Actual title timing checked",
    reviewerId: "gc",
    confirmed: true
  });
test("session-start title including an empty title binds this session; new and lost titles cannot increase it", () => {
  const s = source();
  s.sessionDiceReset = reset("");
  assert.equal(policy(s).bonus, 0);
  assert.equal(policy(s).nextBonus, 2);
  s.sessionDiceReset = reset("seasoned");
  assert.equal(policy(s).bonus, 1);
  s.sessionDiceReset = reset("hardened");
  s.crossroadsTitle = "seasoned";
  assert.equal(policy(s).bonus, 1);
  s.crossroadsTitle = "";
  assert.equal(policy(s).bonus, 0);
});
test("legacy history stays explicit and malformed or foreign records cannot establish eligibility", () => {
  const s = source();
  assert.equal(policy(s).needsReview, true);
  assert.equal(policy(s).bonus, 2);
  s.sessionDiceReset = { ...reset("hardened"), actorUuid: "Actor.other" };
  assert.throws(() => policy(s), /session-start/);
  s.sessionDiceReset = { ...reset("hardened"), level: 2 };
  assert.throws(() => policy(s), /career level/);
  s.crossroadsSessionReviews = { s: review(s, "seasoned") };
  assert.equal(policy(s).source, "gc-review");
  assert.equal(policy(s).bonus, 1);
  s.crossroadsSessionReviews.s.actorUuid = "Actor.other";
  assert.throws(() => policy(s), /saved session/);
  s.crossroadsSessionReviews.s = review(s, "");
  s.usagePeriods.session = "next";
  assert.equal(policy(s).needsReview, true);
  assert.throws(() => reviewPlan(source("seasoned"), { ...review(source(), "hardened") }), /Confirm/);
});
const definition = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))).find(
  c => c.key === "soldier"
);
const cls = {
  id: "soldier",
  name: "Soldier",
  type: "class",
  system: { ...definition, identifier: "soldier", vitalityDie: 12 }
};
const bold = { id: "bold", name: "Fortune Favors the Bold", type: "feat", system: { granted: true, bonuses: [] } };
function prepare(s, config = cfg, feats = [bold]) {
  return computeAgent(
    {
      ...s,
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
      progression: Array.from({ length: s.level }, () => ({ classId: "soldier", vitality: 6, skills: {} })),
      misc: {}
    },
    [cls, ...feats],
    config
  );
}
test("actual prepared Fortune d12 keeps the previous title this session and adds the new title once next session", () => {
  const s = source();
  s.sessionDiceReset = reset("seasoned");
  let p = prepare(s);
  assert.equal(p.actionDice.die, 12);
  assert.equal(p.actionDice.max, 7);
  assert.equal(nextSessionStartingDice(p), 8);
  assert.equal(p.actionDice.value, 3);
  assert.equal(sessionDicePlan([{ uuid: "Actor.a", type: "agent", name: "QA", system: p }])[0].value, 8);
  s.usagePeriods.session = "next";
  s.sessionDiceReset = { ...reset("hardened"), session: "next" };
  p = prepare(s);
  assert.equal(p.actionDice.max, 8);
  assert.equal(nextSessionStartingDice(p), 8);
  assert.equal(p.crossroadsSession.needsReview, false);
});
test("only an actual original d12 doubles title dice, while Personal Lieutenant stays fixed at one", () => {
  const config = {
    ...cfg,
    tables: { ...cfg.tables, levels: { ...cfg.tables.levels, 20: { ...cfg.tables.levels[20], actionDie: 12 } } }
  };
  const s = source("crafty", 20);
  s.sessionDiceReset = reset("seasoned");
  let p = prepare(s, config);
  assert.equal(p.actionDice.die, 6);
  assert.equal(p.actionDice.max, 14);
  assert.equal(nextSessionStartingDice(p), 16);
  p = prepare({ ...s, companionOf: { feat: "Personal Lieutenant" } }, config);
  assert.equal(p.actionDice.max, 1);
  assert.equal(nextSessionStartingDice(p), 1);
  assert.throws(() => nextSessionStartingDice({ ...s, actionDice: { max: 7 } }), /Prepare/);
});
test("preparation exposes a legacy review without changing saved dice; correction is metadata only", () => {
  const s = source();
  let p = prepare(s);
  assert.equal(p.actionDice.max, 8);
  assert.equal(p.actionDice.value, 3);
  assert.ok(p.todo.some(row => /Crossroads/.test(row.text) && row.error));
  s.crossroadsSessionReviews = { s: review(s, "seasoned") };
  p = prepare(s);
  assert.equal(p.actionDice.max, 7);
  assert.equal(p.actionDice.value, 3);
  assert.equal(nextSessionStartingDice(p), 8);
});
