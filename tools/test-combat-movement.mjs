import test from "node:test";
import assert from "node:assert/strict";
import { combatMovementRules, combatMovementPlan } from "../module/rules/combat-movement.mjs";
import { armorTotals } from "../module/rules/gear.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { checkCombatMovement } from "../module/apps/combat-movement.mjs";
const system = () => ({
    activeFeatNames: [],
    speed: 30,
    canRun: true,
    abilities: { dex: { value: 14, mod: 2 } },
    conditionContext: {},
    postureMovement: { standardMove: true }
  }),
  input = () => ({ action: "standardMove", distanceFeet: 30, routeConfirmed: true });
test("Combat Mobility doubles only Total Defense movement and permits the exact Dexterity-bounded Run turns", () => {
  for (let dex = -5; dex <= 10; dex++) {
    const s = system();
    s.abilities.dex.mod = dex;
    const a = combatMovementRules(s);
    assert.equal(a.standardMoveFeet, 30);
    assert.equal(a.totalDefenseMoveFeet, 30);
    assert.equal(a.runFeet, 120);
    assert.equal(a.maximumRunTurns, 0);
    s.activeFeatNames = ["Combat Mobility"];
    const b = combatMovementRules(s);
    assert.equal(b.standardMoveFeet, 30);
    assert.equal(b.totalDefenseMoveFeet, 60);
    assert.equal(b.runFeet, 120);
    assert.equal(b.maximumRunTurns, Math.max(1, dex));
    assert.equal(b.maximumRunTurnDegrees, 90);
    assert.equal(
      combatMovementPlan(s, {
        ...input(),
        action: "run",
        distanceFeet: 120,
        turnDegrees: Array(Math.max(1, dex)).fill(90)
      }).maximumFeet,
      120
    );
    assert.throws(
      () => combatMovementPlan(s, { ...input(), action: "run", turnDegrees: Array(Math.max(1, dex) + 1).fill(1) }),
      /direction/
    );
    assert.throws(() => combatMovementPlan(s, { ...input(), action: "run", turnDegrees: [90.01] }), /direction/);
  }
});
test("Run full-armor multiplier uses only usable selected body armor, never helmets, duplicates or stored armor", () => {
  const armor = (id, slot, type, patch = {}) => ({
    id,
    name: id,
    type: "armor",
    system: { equipped: true, carried: true, quantity: 1, armorSlot: slot, armorType: type, weight: 0, ...patch }
  });
  for (const items of [
    [armor("body", "body", "F")],
    [armor("helmet", "helmet", "F")],
    [armor("body", "body", "F", { reserve: true })],
    [armor("body", "body", "F", { carried: false })],
    [armor("body", "body", "F", { destroyed: true })],
    [armor("first", "body", "P"), armor("second", "body", "F")]
  ]) {
    const s = system();
    s.armor = armorTotals(items).armor;
    const expected =
      items.length === 1 &&
      items[0].id === "body" &&
      !items[0].system.reserve &&
      items[0].system.carried !== false &&
      !items[0].system.destroyed
        ? 90
        : 120;
    assert.equal(combatMovementRules(s).runFeet, expected);
  }
});
test("only Standard Move can depart threatening adjacency with Combat Mobility, and entering another threatening adjacency still ends movement", () => {
  for (const feat of [false, true])
    for (const action of ["standardMove", "run", "totalDefense"]) {
      const s = system();
      if (feat) s.activeFeatNames = ["Combat Mobility"];
      const call = () => combatMovementPlan(s, { ...input(), action, adjacentThreateningOpponent: true });
      if (feat && action === "standardMove") assert.equal(call().maximumFeet, 30);
      else assert.throws(call, /Withdraw/);
      assert.throws(() => combatMovementPlan(s, { ...input(), action, passesThreateningAdjacency: true }), /Stop/);
    }
});
test("movement declarations enforce actual Speed, posture, Run permissions, counted path cost and strict input types", () => {
  const s = system();
  for (const distanceFeet of [-1, NaN, Infinity, "30", null, true])
    assert.throws(() => combatMovementPlan(s, { ...input(), distanceFeet }));
  for (const key of ["routeConfirmed", "passesThreateningAdjacency", "adjacentThreateningOpponent"])
    assert.throws(() => combatMovementPlan(s, { ...input(), [key]: "true" }));
  assert.throws(() => combatMovementPlan(s, { ...input(), routeConfirmed: false }), /GC/);
  assert.throws(() => combatMovementPlan(s, { ...input(), distanceFeet: 30.01 }), /allowance/);
  assert.throws(() => combatMovementPlan(s, { ...input(), action: "run", turnDegrees: [1] }), /direction/);
  for (const turnDegrees of ["90", [NaN], [-1], [181], ["90"], [null]])
    assert.throws(() => combatMovementPlan(s, { ...input(), turnDegrees }));
  s.speed = null;
  assert.throws(() => combatMovementPlan(s, input()), /Speed/);
  s.speed = 30;
  s.conditionSpeedReview = true;
  assert.throws(() => combatMovementPlan(s, input()), /Speed/);
  s.conditionSpeedReview = false;
  s.canRun = false;
  assert.throws(() => combatMovementPlan(s, { ...input(), action: "run" }), /cannot Run/);
  s.postureMovement.standardMove = false;
  assert.throws(() => combatMovementPlan(s, input()), /posture/);
  assert.equal(combatMovementPlan(s, { ...input(), action: "totalDefense", distanceFeet: 0 }).dodgeBonus, 4);
  for (const condition of ["sleeping", "dead", "stunned", "dazed", "paralyzed", "held", "pinned"]) {
    const x = system();
    x.conditionContext[condition] = true;
    assert.throws(() => combatMovementPlan(x, input()), condition);
  }
});
test("Mobile Defense and Uncanny Dodge V prevent Run flat-footedness without granting extra distance, turns or a free dodge bonus", () => {
  for (const s of [
    { ...system(), activeFeatNames: ["Mobile Defense"] },
    { ...system(), uncannyDodge: { cannotBeFlatFooted: true } }
  ]) {
    const p = combatMovementPlan(s, { ...input(), action: "run" });
    assert.equal(p.becomesFlatFooted, false);
    assert.equal(p.maximumFeet, 120);
    assert.equal(p.maximumRunTurns, 0);
    assert.equal(p.dodgeBonus, 0);
  }
  assert.equal(combatMovementPlan(system(), { ...input(), action: "run" }).becomesFlatFooted, true);
  assert.equal(combatMovementPlan(system(), input()).actionCost, "1 half action");
  assert.equal(combatMovementPlan(system(), { ...input(), action: "totalDefense" }).actionCost, "1 full action");
});
let response = null,
  contents = [],
  warnings = [],
  hook = null;
globalThis.foundry = {
  utils: { escapeHTML: s => String(s) },
  applications: {
    api: {
      DialogV2: {
        input: async d => {
          contents.push(d.content);
          if (contents.length === 1) {
            await hook?.();
            return response;
          }
          return null;
        }
      }
    }
  }
};
globalThis.ui = {
  notifications: {
    warn: s => {
      warnings.push(s);
      return { warning: s };
    }
  }
};
function actor() {
  contents = [];
  warnings = [];
  hook = null;
  response = null;
  return { type: "agent", isOwner: true, system: system() };
}
test("the actual movement checker parses route declarations, honors cancellation, and reads fresh Speed without mutating character state", async () => {
  let a = actor(),
    before = structuredClone(a.system);
  assert.equal(await checkCombatMovement(a), null);
  assert.deepEqual(a.system, before);
  a = actor();
  a.system.activeFeatNames = ["Combat Mobility"];
  response = { action: "run", distanceFeet: "120", turnDegrees: "90,45", routeConfirmed: true };
  const p = await checkCombatMovement(a);
  assert.deepEqual(p.turnDegrees, [90, 45]);
  assert.match(contents[1], /120 \/ 120/);
  assert.equal(a.system.speed, 30);
  a = actor();
  response = { ...input(), distanceFeet: "30" };
  hook = () => {
    a.system.speed = 10;
  };
  const invalid = await checkCombatMovement(a);
  assert.match(invalid.warning, /allowance/);
  assert.equal(contents.length, 1);
  a = actor();
  response = { ...input(), distanceFeet: "", turnDegrees: "90," };
  assert.ok((await checkCombatMovement(a)).warning);
});

test("the actual engine derives movement from the current legal feat set rather than a previous preparation", () => {
  const cls = {
      id: "test",
      type: "class",
      name: "Test",
      system: {
        identifier: "test",
        skillPoints: 4,
        vitalityDie: 6,
        classSkills: [],
        table: [{ level: 1, bab: 1, defense: 7, fort: 0, ref: 0, will: 0 }]
      }
    },
    feat = { id: "mobility", type: "feat", name: "Combat Mobility", system: { granted: true, bonuses: [] } },
    base = {
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 16 }])),
      progression: [{ classId: "test", vitality: 6, skills: {} }],
      skills: {},
      focuses: {},
      proficiencies: {},
      misc: {}
    };
  for (const feats of [[feat], []]) {
    const s = computeAgent(
      { ...structuredClone(base), activeFeatNames: feats.length ? [] : ["Combat Mobility"] },
      [cls, ...feats],
      cfg
    );
    assert.equal(s.combatMovement.mobility, feats.length > 0);
    assert.equal(s.combatMovement.totalDefenseMoveFeet, s.speed * (feats.length ? 2 : 1));
    assert.equal(s.combatMovement.maximumRunTurns, feats.length ? 3 : 0);
  }
});
