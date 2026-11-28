import test from "node:test";
import assert from "node:assert/strict";
import { dispositionCheckLabel, dispositionSkill, dispositionSkillPlan } from "../module/rules/disposition-checks.mjs";
import { targetedNpc } from "../module/rolls/disposition-target.mjs";

const persuasion = { id: "persuasion", name: "Persuasion Check" };
const deception = { id: "deception", name: "Deception Check" };

test("labels match Table 7.14's lists", () => {
  assert.equal(dispositionCheckLabel("impress", persuasion), "Impress/Persuasion");
  assert.equal(dispositionSkill("impress"), true);
  assert.equal(dispositionSkill("athletics"), false);
});

test("Fondness: a friendly NPC gives +2 and threat +1", () => {
  const plan = dispositionSkillPlan({}, "impress", persuasion, { targetDisposition: "friendly" }, {});
  assert.equal(plan.bonuses[0].value, 2);
  assert.equal(plan.threatIncrease, 1);
  assert.equal(plan.errorIncrease, 0);
});

test("Intimacy: strong feeling either way costs result and error range", () => {
  const plan = dispositionSkillPlan({}, "bluff", deception, { targetDisposition: "hostile" }, {});
  assert.equal(plan.bonuses[0].value, -6);
  assert.equal(plan.errorIncrease, 2);
});

test("Diplomatic adds 1 to a favorable bonus for player and special characters", () => {
  const effects = { favorableDispositionBonus: 1 };
  const agent = dispositionSkillPlan({}, "impress", persuasion, { targetDisposition: "friendly" }, effects);
  assert.equal(
    agent.bonuses.reduce((n, b) => n + b.value, 0),
    3
  );
  const standard = dispositionSkillPlan(
    { npcType: "standard" },
    "impress",
    persuasion,
    { targetDisposition: "friendly" },
    effects
  );
  assert.equal(
    standard.bonuses.reduce((n, b) => n + b.value, 0),
    2
  );
  const unfriendly = dispositionSkillPlan({}, "impress", persuasion, { targetDisposition: "unfriendly" }, effects);
  assert.equal(unfriendly.bonuses.length, 1);
});

test("villains are immune, and an unrelated check is untouched", () => {
  const villain = dispositionSkillPlan(
    {},
    "impress",
    persuasion,
    { targetDisposition: "friendly", targetVillain: true },
    {}
  );
  assert.equal(villain.bonuses.length, 0);
  assert.match(villain.notes[0], /villain/);
  const other = dispositionSkillPlan(
    {},
    "athletics",
    { id: "climb", name: "Climb Check" },
    { targetDisposition: "hostile" },
    {}
  );
  assert.equal(other.bonuses.length, 0);
});

test("the targeted NPC's disposition toward the roller fills the dialog", () => {
  const token = {
    name: "Clerk",
    actor: {
      type: "npc",
      system: { npcType: "standard", disposition: { base: "neutral", toward: { a1: { grade: "friendly" } } } }
    }
  };
  assert.deepEqual(targetedNpc({ id: "a1" }, [token]), { name: "Clerk", grade: "friendly", villain: false });
  assert.equal(targetedNpc({ id: "a2" }, [token]).grade, "neutral");
  assert.equal(targetedNpc({ id: "a1" }, []), null);
});

test("a hand-built mastermind is a villain for disposition, and a graded NPC's disabled profile is ignored", () => {
  const manual = { name: "Boss", actor: { type: "npc", system: { npcType: "special", manualRole: "mastermind" } } };
  assert.equal(targetedNpc({ id: "a1" }, [manual]).villain, true);
  const stale = {
    name: "Clerk",
    actor: {
      type: "npc",
      system: { npcType: "standard", npcProfile: { enabled: false, qualities: [{ id: "henchman" }] } }
    }
  };
  assert.equal(targetedNpc({ id: "a1" }, [stale]).villain, false);
});
