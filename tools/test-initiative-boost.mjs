import test from "node:test";
import assert from "node:assert/strict";

globalThis.foundry = { utils: { escapeHTML: String } };
globalThis.game = { combats: [], user: { id: "u1", isGM: false }, i18n: { localize: String } };
const { boostableInitiative, initiativeBoostPlan, isInitiativeMessage } =
  await import("../module/apps/initiative-boost.mjs");

const message = (extra = {}) => ({
  id: "m1",
  flags: { core: { initiativeRoll: true } },
  speaker: { token: "t1", actor: "a1" },
  rolls: [{ total: 14 }],
  ...extra
});
const fight = combatants => ({ combatants });

test("an Initiative roll offers its combatant while the Count is the rolled one", () => {
  const c = { tokenId: "t1", actorId: "a1", initiative: 14, flags: {} };
  const found = boostableInitiative(message(), [fight([{ tokenId: "t9", initiative: 14, flags: {} }, c])]);
  assert.equal(found.combatant, c);
  assert.equal(found.count, 14);
  assert.equal(found.spent, 0);
  assert.equal(boostableInitiative(message(), [fight([{ ...c, initiative: 9 }])]), null);
  assert.equal(boostableInitiative(message(), [fight([{ ...c, defeated: true }])]), null);
  assert.equal(isInitiativeMessage({ flags: {} }), false);
});

test("a boost on this roll moves the Count it expects; one from another roll does not", () => {
  const boosted = {
    tokenId: "t1",
    initiative: 17,
    flags: { spycraft2: { initiativeBoost: { messageId: "m1", count: 17, spent: 1 } } }
  };
  assert.deepEqual((({ count, spent }) => ({ count, spent }))(boostableInitiative(message(), [fight([boosted])])), {
    count: 17,
    spent: 1
  });
  const other = { ...boosted, flags: { spycraft2: { initiativeBoost: { messageId: "m0", count: 17, spent: 1 } } } };
  assert.equal(boostableInitiative(message(), [fight([other])]), null);
});

test("only an agent with a die to spend gets a plan", () => {
  assert.equal(initiativeBoostPlan({ type: "npc" }).blocked, true);
  const agent = { type: "agent", system: { actionDice: { value: 2, die: 6 }, activeFeatNames: [] } };
  const plan = initiativeBoostPlan(agent);
  assert.equal(plan.blocked, false);
  assert.equal(plan.die, 6);
  assert.equal(plan.rolls, 1);
  assert.equal(initiativeBoostPlan({ ...agent, system: { actionDice: { value: 0, die: 6 } } }).blocked, true);
});

test("Shaken II adds its surcharge to the first boost of a roll only", () => {
  const agent = {
    type: "agent",
    system: { actionDice: { value: 3, die: 6 }, activeFeatNames: [], conditionContext: { shakenGrade: 2 } }
  };
  const first = initiativeBoostPlan(agent);
  assert.equal(first.cost, 2);
  assert.equal(first.surcharge, 1);
  assert.equal(first.surchargePaid, 1);
  const second = initiativeBoostPlan(agent, { surchargePaid: first.surchargePaid });
  assert.equal(second.cost, 1);
  assert.equal(second.surcharge, 0);
  assert.equal(initiativeBoostPlan({ ...agent, system: { ...agent.system, conditionContext: {} } }).cost, 1);
});
