import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  berserkerTier,
  berserkerSpec,
  berserkerRageState,
  berserkerStartPlan,
  berserkerEndPlan,
  berserkerNote
} from "../module/rules/berserker.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";

const combat = (round = 2) => ({ id: "c1", started: true, round });
const sys = (feats, extra = {}) => ({ activeFeatNames: feats, actionDice: { max: 3 }, ...extra });

test("each tier sets the duration, bonus, entry, ending and aftermath", () => {
  assert.equal(berserkerTier(sys([])), null);
  assert.equal(berserkerTier(sys(["Berserker Mastery"])), null, "Basics is required");
  assert.deepEqual(
    { ...berserkerTier(sys(["Berserker Basics"])) },
    { feat: "Berserker Basics", duration: "2d4+2", bonus: 3, enter: "full", end: "half", after: "exhausted" }
  );
  assert.equal(berserkerTier(sys(["Berserker Basics", "Berserker Mastery"])).bonus, 5);
  assert.equal(berserkerTier(sys(["Berserker Basics", "Berserker Mastery"])).enter, "free");
  const top = berserkerTier(sys(["Berserker Basics", "Berserker Mastery", "Berserker Supremacy"]));
  assert.deepEqual([top.duration, top.end, top.after], ["4d4+4", "free", "fatigued"]);
  assert.deepEqual(berserkerSpec(sys(["Berserker Basics"])), {
    id: "berserkerRage",
    name: "Berserker rage",
    period: "session",
    limit: 3,
    workflow: "berserkerRage"
  });
});

test("a rage starts in a started combat, once at a time, and Basics needs its full action", () => {
  const rage = berserkerStartPlan(sys(["Berserker Basics"]), combat(), {
    id: "r1",
    rolledRounds: 6,
    actionConfirmed: true
  });
  assert.deepEqual(rage, {
    version: 1,
    id: "r1",
    combatId: "c1",
    startRound: 2,
    rounds: 6,
    bonus: 3,
    tier: "Berserker Basics"
  });
  assert.throws(
    () => berserkerStartPlan(sys(["Berserker Basics"]), combat(), { id: "r", rolledRounds: 6 }),
    /full action/
  );
  assert.ok(berserkerStartPlan(sys(["Berserker Basics", "Berserker Mastery"]), combat(), { id: "r", rolledRounds: 6 }));
  assert.throws(
    () => berserkerStartPlan(sys(["Berserker Basics"]), null, { id: "r", rolledRounds: 6, actionConfirmed: true }),
    /started combat/
  );
  assert.throws(
    () =>
      berserkerStartPlan(sys(["Berserker Basics"], { berserkerRage: rage }), combat(3), {
        id: "r",
        rolledRounds: 6,
        actionConfirmed: true
      }),
    /already raging/
  );
});

test("the rage runs for its rolled rounds in its own combat, then has run out", () => {
  const rage = { version: 1, combatId: "c1", startRound: 2, rounds: 3, bonus: 3 };
  assert.deepEqual(
    [2, 3, 4, 5].map(r => berserkerRageState(rage, combat(r)).active),
    [true, true, true, false]
  );
  assert.equal(berserkerRageState(rage, combat(3)).remaining, 2);
  assert.equal(berserkerRageState(rage, { id: "other", round: 3 }).active, false, "another combat ends it");
  assert.equal(berserkerRageState(rage, undefined).expired, true);
  assert.equal(berserkerRageState(null, combat()).active, false);
});

test("ending: Basics calms down with a half action and is exhausted; Supremacy ends freely and is fatigued", () => {
  const rage = { version: 1, combatId: "c1", startRound: 2, rounds: 6, bonus: 3 };
  assert.throws(() => berserkerEndPlan(sys(["Berserker Basics"], { berserkerRage: rage }), combat(4)), /half action/);
  assert.deepEqual(
    berserkerEndPlan(sys(["Berserker Basics"], { berserkerRage: rage }), combat(4), { actionConfirmed: true }),
    {
      after: "exhausted",
      minutes: 2,
      rounds: 2,
      early: true
    }
  );
  const ranOut = berserkerEndPlan(sys(["Berserker Basics"], { berserkerRage: rage }), combat(9));
  assert.deepEqual([ranOut.rounds, ranOut.early], [6, false], "a finished rage ends without an action");
  const supreme = berserkerEndPlan(
    sys(["Berserker Basics", "Berserker Mastery", "Berserker Supremacy"], { berserkerRage: rage }),
    combat(3)
  );
  assert.equal(supreme.after, "fatigued");
  assert.equal(supreme.minutes, 1);
  assert.throws(() => berserkerEndPlan(sys(["Berserker Basics"]), combat()), /not raging/);
  assert.match(berserkerNote("Rex", supreme), /fatigued for 1 minutes/);
});

test("the engine raises Strength and Constitution while the rage runs", () => {
  const feats = JSON.parse(readFileSync(new URL("../src/data/feats.json", import.meta.url)));
  const cls = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))).find(
    c => c.key === "soldier"
  );
  const agent = (round, rage) =>
    computeAgent(
      {
        abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
        progression: Array.from({ length: 3 }, () => ({ classId: "soldier", vitality: 6, skills: {} })),
        skills: {},
        focuses: {},
        proficiencies: {},
        misc: {},
        conditionContext: {},
        actionDice: { value: 0 },
        vitality: { value: 4 },
        wounds: { value: 4 },
        berserkerRage: rage,
        bonusPoolCombats: { c1: { id: "c1", started: true, round } }
      },
      [
        {
          id: "soldier",
          name: cls.name,
          type: "class",
          system: { ...structuredClone(cls), identifier: "soldier", vitalityDie: cls.vitality }
        },
        {
          id: "f0",
          name: "Berserker Basics",
          type: "feat",
          system: { ...structuredClone(feats.find(f => f.name === "Berserker Basics")), acquiredAtLevel: 1 }
        }
      ],
      cfg
    );
  const rage = { version: 1, id: "r", combatId: "c1", startRound: 1, rounds: 4, bonus: 3, tier: "Berserker Basics" };
  const calm = agent(1, null),
    raging = agent(2, rage),
    over = agent(6, rage);
  assert.equal(raging.abilities.str.value - calm.abilities.str.value, 3);
  assert.equal(raging.abilities.con.value - calm.abilities.con.value, 3);
  assert.equal(raging.abilities.dex.value, calm.abilities.dex.value);
  assert.equal(over.abilities.str.value, calm.abilities.str.value);
  assert.ok(over.warnings.some(w => /run out/.test(w)));
});
