import test from "node:test";
import assert from "node:assert/strict";
import { TABLES } from "../module/rules/tables.mjs";
import { crossroadsAwardChoices, crossroadsAwardPlan as award } from "../module/rules/crossroads-awards.mjs";
import { crossroadsSessionPolicy } from "../module/rules/crossroads-session.mjs";
import { crossroadsMissionXPPolicy } from "../module/rules/crossroads-xp.mjs";
const keys = Object.keys(TABLES.crossroads);
function source(target = "seasoned") {
  const title = TABLES.crossroads[target],
    prior = keys[keys.indexOf(target) - 1] ?? "";
  return {
    actorUuid: "Actor.a",
    level: title.level,
    classLevels: { soldier: title.level },
    worldTime: 10,
    crossroadsTitle: prior,
    xp: 1000,
    actionDice: { value: 3 },
    usagePeriods: {
      session: "s",
      mission: "m",
      missionCareerLevels: {
        version: 1,
        mission: "m",
        levels: { "Actor.a": title.level },
        crossroadsTitles: { "Actor.a": prior }
      }
    },
    sessionDiceReset: { session: "s", actorUuid: "Actor.a", crossroadsTitle: prior, level: title.level },
    subplots: [
      ...Array.from({ length: title.completed }, (_, i) => ({ name: `Story ${i}`, kind: "standard", complete: true })),
      { name: "QA Crossroads story", notes: "Saved story detail", kind: target, complete: false }
    ],
    subplotPicks: { used: 1, available: 1 }
  };
}
const input = s => ({
  index: s.subplots.length - 1,
  id: "award",
  reviewerId: "gc",
  confirmed: true,
  note: "GC confirmed completion and original entry requirements"
});
test("all four title awards complete the actual selected story while preserving current-period benefits and balances", () => {
  for (const target of keys) {
    const s = source(target),
      prior = s.crossroadsTitle,
      p = award(s, input(s));
    assert.equal(p.title, target);
    assert.equal(p.record.previousTitle, prior);
    assert.equal(p.subplots.at(-1).complete, true);
    assert.equal(s.subplots.at(-1).complete, false);
    assert.equal(s.actionDice.value, 3);
    const after = {
      ...s,
      crossroadsTitle: p.title,
      subplots: p.subplots,
      crossroadsSessionReviews: { s: p.sessionReview },
      crossroadsMissionReviews: { m: p.missionReview }
    };
    assert.equal(crossroadsSessionPolicy(after).bonus, prior ? TABLES.crossroads[prior].actionDice : 0);
    assert.equal(crossroadsSessionPolicy(after).nextBonus, TABLES.crossroads[target].actionDice);
    assert.equal(crossroadsMissionXPPolicy(after).percent, prior ? TABLES.crossroads[prior].xpPercent : 0);
    assert.throws(() => award(after, input(after)), /unfinished/);
  }
});
test("completion cannot bypass actual entry, classification, Routine or duplicate-attempt limits", () => {
  for (const mutate of [
    s => {
      s.level = 1;
      s.classLevels.soldier = 1;
    },
    s => {
      s.subplots[0].kind = "";
    },
    s => {
      s.campaignEffects = { forbidCrossroads: true };
    },
    s => {
      s.subplots.push({ ...s.subplots.at(-1) });
    },
    s => {
      s.subplotPicks.used = 2;
    },
    s => {
      s.subplots.at(-1).kind = "standard";
    },
    s => {
      s.subplots.at(-1).complete = true;
    }
  ]) {
    const s = source();
    mutate(s);
    assert.throws(() => award(s, input(s)));
  }
  const s = source("hardened");
  s.crossroadsTitle = "seasoned";
  assert.throws(() => award(s, input(s)), /every lower/);
});
test("unknown historical eligibility and malformed confirmation cannot award or seed guessed benefits", () => {
  const s = source("hardened");
  delete s.sessionDiceReset;
  assert.throws(() => award(s, input(s)), /Review the current session/);
  s.sessionDiceReset = { session: "s", actorUuid: s.actorUuid, crossroadsTitle: "weathered", level: 13 };
  delete s.usagePeriods.missionCareerLevels;
  assert.throws(() => award(s, input(s)), /Review the current session/);
  for (const index of [true, [], {}, "", -1, 1.5]) assert.throws(() => award(source(), { ...input(source()), index }));
  assert.throws(() => award(source(), { ...input(source()), confirmed: false }), /GC must confirm/);
  assert.equal(crossroadsAwardChoices(source())[0].title, "seasoned");
});
