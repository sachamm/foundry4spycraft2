import test from "node:test";
import assert from "node:assert/strict";
import {
  powerStanceBonus as bonus,
  powerStanceInitiativeMarker as marker,
  powerStanceInitiativePlan as plan,
  reviewedPowerStanceInitiativePlan as reviewed
} from "../module/rules/power-stance.mjs";
import { combatStanceDeclaration } from "../module/rules/combat-stance.mjs";
import { stanceMovementReviewPlan, stanceMovementRoutePlan } from "../module/rules/stance-movement.mjs";
const system = (active = true, score = 14, id = "power1") => ({
  activeFeatNames: ["Great Sword Basics"],
  combatStance: active ? { version: 1, key: "power", id } : null,
  conditionContext: {},
  abilities: { str: { value: score, mod: Math.floor((score - 10) / 2) } }
});
test("Power uses the current Strength score rather than its modifier, and is suppressed by missing source or forced-exit conditions", () => {
  assert.equal(bonus(system()), 14);
  assert.equal(bonus(system(true, 19)), 19);
  assert.equal(bonus(system(false)), 0);
  assert.equal(bonus({ ...system(), activeFeatNames: [] }), 0);
  for (const c of ["prone", "sprawled", "helpless"])
    assert.equal(bonus({ ...system(), conditionContext: { [c]: true } }), 0);
  for (const score of [null, "14", NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => bonus(system(true, score)), /Strength score/);
});
test("only the verified Power component changes an existing Count, including Strength changes and stance reentry", () => {
  let r = { initiative: 20, record: marker(system(false), 20) };
  for (const [s, expected, delta] of [
    [system(), 34, 14],
    [system(), 34, 0],
    [system(true, 16), 36, 2],
    [system(true, 16, "power2"), 36, 0],
    [system(false), 20, -16]
  ]) {
    const p = plan(s, r);
    assert.equal(p.initiative, expected);
    assert.equal(p.delta, delta);
    assert.equal(p.needsReview, undefined);
    r = { initiative: p.initiative, record: p.record };
  }
  assert.equal(plan(system(false), r).changed, false);
});
test("an unrelated Count loss is retained when the stance ends, rather than restoring an old baseline", () => {
  const r = marker(system(), 34);
  r.count = 29;
  const p = plan(system(false), { initiative: 29, record: r });
  assert.equal(p.initiative, 15);
  assert.equal(p.delta, -14);
});
test("fresh final rolled or entered Counts already include active Power and are never increased twice", () => {
  const r = marker(system(), 42);
  assert.equal(plan(system(), { initiative: 42, record: r }).delta, 0);
  assert.equal(plan(system(false), { initiative: 42, record: r }).initiative, 28);
});
test("an ordinary legacy Count without Power remains untouched, while active or untracked-exit legacy Counts require GC inclusion review", () => {
  assert.equal(plan(system(false), { initiative: 20 }).changed, false);
  assert.equal(plan(system(), { initiative: 20 }).needsReview, true);
  assert.equal(plan(system(false), { initiative: 20, untrackedExit: true }).needsReview, true);
  for (const record of [
    {},
    { version: 2 },
    { version: 1, count: 20, includedBonus: 14, stanceId: null },
    { version: 1, count: 19, includedBonus: 0 }
  ])
    assert.equal(plan(system(), { initiative: 20, record }).needsReview, true);
});
test("GC inclusion review handles an older different Strength bonus and an already-ended stance without inventing a baseline", () => {
  assert.equal(reviewed(system(), { initiative: 30, record: { needsReview: true } }, 10).initiative, 34);
  assert.equal(reviewed(system(false), { initiative: 30, record: { needsReview: true } }, 10).initiative, 20);
  for (const n of [null, -1, "14", 1.5, Infinity])
    assert.throws(() => reviewed(system(), { initiative: 20 }, n), /whole nonnegative/);
});
test("unrolled Counts never gain a bonus, and unsafe or corrupted Count arithmetic is held for review", () => {
  const p = plan(system(), { initiative: null, record: marker(system(), 30) });
  assert.equal(p.initiative, null);
  assert.equal(p.record.includedBonus, 0);
  for (const n of [undefined, "20", Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(plan(system(), { initiative: n }).needsReview, true);
  assert.equal(
    plan(system(), { initiative: Number.MAX_SAFE_INTEGER, record: marker(system(false), Number.MAX_SAFE_INTEGER) })
      .needsReview,
    true
  );
});
test("a held uncertain Count never clears itself after a Strength or stance change", () => {
  const r = {
    version: 1,
    count: 34,
    includedBonus: 14,
    stanceId: "power1",
    needsReview: true,
    reason: "Uncertain previous write"
  };
  for (const s of [system(), system(true, 16), system(false)]) {
    const p = plan(s, { initiative: 34, record: r });
    assert.equal(p.needsReview, true);
    assert.equal(p.initiative, 34);
    assert.equal(p.record, r);
  }
});
test("Power shares legal own-count half-action entry and enforces a ten-foot round cap including movement before entry", () => {
  const clock = { id: "combat", started: true, round: 1, combatantId: "actor", turn: 0, ownTurnIndex: 0 },
    s = { ...system(), worldTime: 0 };
  assert.equal(
    combatStanceDeclaration(s, "power", { combat: clock, halfActionConfirmed: true, legalConfirmed: true }).key,
    "power"
  );
  assert.equal(
    stanceMovementReviewPlan(s, { combat: clock, totalFeet: 10, confirmed: true, enteringStance: "power" }).feet,
    10
  );
  assert.throws(
    () => stanceMovementReviewPlan(s, { combat: clock, totalFeet: 11, confirmed: true, enteringStance: "power" }),
    /10 ft/
  );
  const moved = { ...s, stanceRoundMovement: { version: 1, key: "combat:1", feet: 5 } };
  assert.equal(stanceMovementRoutePlan(moved, { combat: clock, distanceFeet: 5 }).totalFeet, 10);
  assert.throws(() => stanceMovementRoutePlan(moved, { combat: clock, distanceFeet: 6 }), /exceed/);
  assert.throws(
    () =>
      stanceMovementReviewPlan(
        { ...moved, stanceRoundMovement: { version: 1, key: "combat:1", feet: 11 } },
        { combat: clock, totalFeet: 11, confirmed: true, enteringStance: "power" }
      ),
    /10 ft/
  );
});
test("canonical Great Sword Basics adds actual Strength to newly rolled Initiative and removes it after forced exit in the real engine", async () => {
  const { makeFatigueActor } = await import("./fixtures/fatigue-actor.mjs"),
    { readFileSync } = await import("node:fs"),
    a = makeFatigueActor(),
    f = JSON.parse(readFileSync(new URL("../src/data/feats.json", import.meta.url))).find(
      f => f.name === "Great Sword Basics"
    );
  a.raw.proficiencies = { exoticEdged: { proficient: true } };
  a.items.push({
    id: "greatSwordFeat",
    type: "feat",
    name: f.name,
    system: { ...f, tree: "meleeCombat", acquiredAtLevel: 1 }
  });
  a.derive();
  assert.equal(a.system.featStatus.greatSwordFeat.ok, true);
  const before = a.system.initiative.total,
    health = [a.system.vitality.value, a.system.wounds.value, a.system.actionDice.value];
  a.raw.combatStance = { version: 1, key: "power", id: "actualPower" };
  a.derive();
  assert.equal(a.system.initiative.total, before + a.system.abilities.str.value);
  assert.equal(
    a.system.bonusSources.initiative.some(
      s => s.source === "Power Stance (Strength score)" || s.name === "Power Stance (Strength score)"
    ),
    true
  );
  a.raw.combatStance = null;
  a.derive();
  assert.equal(a.system.initiative.total, before);
  assert.deepEqual([a.system.vitality.value, a.system.wounds.value, a.system.actionDice.value], health);
});
test("operation and review audit fields do not manufacture another Count adjustment or marker write", () => {
  for (const n of [34, null]) {
    const r = {
      ...marker(system(), n),
      operationId: "prior",
      resolvesReviewId: "review",
      review: { note: "Earlier explicit GC review" }
    };
    assert.equal(plan(system(), { initiative: n, record: r }).changed, false);
  }
});

import { actor as actualActor, controls } from "./fixtures/side-stance.mjs";
import { clock } from "./fixtures/feint.mjs";
import { declareCombatStance, endCombatStance, installCombatStanceHooks } from "../module/apps/combat-stance.mjs";
import {
  preparePowerStanceEntry,
  reconcilePowerStanceInitiative,
  reviewPowerStanceInitiative,
  powerStanceInitiativeReviews,
  guardPowerStanceInitiativeUpdate,
  powerStanceInitiativeEvidence,
  installPowerStanceInitiativeHooks
} from "../module/apps/power-stance.mjs";
import { shakenInitiativeMarker } from "../module/rules/shaken-initiative.mjs";
import {
  guardShakenInitiativeUpdate,
  reconcileShakenInitiative,
  reviewShakenInitiative,
  changeInitiativeCountPreservingShaken
} from "../module/apps/shaken-initiative.mjs";
import { queueResources } from "../module/services/transactions.mjs";
function fixture({ active = false, count = 20, powerRecord = true, shakenRecord = true } = {}) {
  const a = actualActor();
  a.system.activeFeatNames = ["Great Sword Basics"];
  a.system.combatStance = active ? { version: 1, key: "power", id: "power1" } : null;
  a.system.abilities.str.value = 14;
  a.system.abilities.str.mod = 2;
  a.system.conditionContext = {};
  a.effects = [];
  a.flags = {};
  a.type = "agent";
  a.documentName = "Actor";
  const update = a.update;
  a.update = async patch => {
    for (const [k, v] of Object.entries(patch))
      if (k === "flags.spycraft2.powerStanceUntrackedExits") {
        a.flags.spycraft2 ??= {};
        a.flags.spycraft2.powerStanceUntrackedExits = structuredClone(v);
      }
    const system = Object.fromEntries(Object.entries(patch).filter(([k]) => k.startsWith("system.")));
    return update(system);
  };
  const combat = { id: clock().id, name: "Actual Power fixture", started: true, round: 3, turn: 0 };
  const c = {
    id: clock().combatantId,
    parent: combat,
    actor: a,
    isOwner: true,
    initiative: count,
    flags: { spycraft2: {} },
    writes: [],
    fail: null,
    async update(patch, options = {}) {
      guardShakenInitiativeUpdate(this, patch, options);
      guardPowerStanceInitiativeUpdate(this, patch, options);
      if (this.fail === "before" && Object.hasOwn(patch, "initiative")) throw Error("Rejected Count write");
      if (Object.hasOwn(patch, "initiative")) this.initiative = patch.initiative;
      for (const key of ["shakenInitiative", "powerStanceInitiative"])
        if (Object.hasOwn(patch, "flags.spycraft2." + key))
          this.flags.spycraft2[key] = {
            ...this.flags.spycraft2[key],
            ...structuredClone(patch["flags.spycraft2." + key])
          };
      this.writes.push(structuredClone(patch));
      if (this.fail === "after" && Object.hasOwn(patch, "initiative"))
        throw Error("Count committed then response lost");
      return this;
    }
  };
  if (powerRecord) c.flags.spycraft2.powerStanceInitiative = marker(a.system, count);
  if (shakenRecord) c.flags.spycraft2.shakenInitiative = shakenInitiativeMarker({}, count);
  combat.combatants = [c];
  combat.combatants.get = id => (id === c.id ? c : null);
  game.combats = [combat];
  game.combats.get = id => (id === combat.id ? combat : null);
  game.user = { isGM: true, id: "gc" };
  game.users = [];
  game.users.activeGM = game.user;
  game.ready = false;
  a.mentalLeapCombatContext = () => ({ ...clock(), round: combat.round, turn: combat.turn });
  return { a, c, combat };
}
const entry = (patch = {}) => ({
  stance: "power",
  halfActionConfirmed: true,
  legalConfirmed: true,
  roundMovementFeet: 0,
  roundMovementConfirmed: true,
  ...patch
});
const setShaken = (a, on = true) => {
  a.effects = on
    ? [
        {
          id: "incoming",
          uuid: a.uuid + ".ActiveEffect.incoming",
          active: true,
          statuses: new Set(["shaken-2"]),
          flags: { spycraft2: { shakenGrade: 2, shakenSelfInflicted: false } }
        }
      ]
    : [];
};
test("actual legal Power entry adjusts an existing tracked Count once and normal exit removes only its known component", async () => {
  const { a, c } = fixture();
  await declareCombatStance(a, entry());
  assert.equal(c.initiative, 34);
  assert.equal(c.flags.spycraft2.powerStanceInitiative.includedBonus, 14);
  const writes = c.writes.length;
  await reconcilePowerStanceInitiative(a);
  assert.equal(c.writes.length, writes);
  await declareCombatStance(a, { stance: "normal", legalConfirmed: true });
  assert.equal(c.initiative, 20);
  assert.equal(a.system.combatStance, null);
});
test("first legacy normal Count needs the explicit GC zero-inclusion confirmation and invalid entry changes nothing", async () => {
  const { a, c } = fixture({ powerRecord: false });
  for (const patch of [
    {},
    { powerCountConfirmed: true, halfActionConfirmed: false },
    { powerCountConfirmed: true, roundMovementFeet: 11 }
  ]) {
    await assert.rejects(declareCombatStance(a, entry(patch)));
    assert.equal(c.initiative, 20);
    assert.equal(c.writes.length, 0);
    assert.equal(a.system.combatStance, null);
  }
  await declareCombatStance(a, entry({ powerCountConfirmed: true }));
  assert.equal(c.initiative, 34);
  assert.equal(c.flags.spycraft2.powerStanceInitiative.includedBonus, 14);
});
test("an already-active legacy Power Count is held until GC confirms its actual included bonus", async () => {
  const { a, c, combat } = fixture({ active: true, count: 34, powerRecord: false });
  await reconcilePowerStanceInitiative(a);
  assert.equal(c.initiative, 34);
  assert.equal(powerStanceInitiativeReviews(a).length, 1);
  await assert.rejects(preparePowerStanceEntry(a, entry({ powerCountConfirmed: true })), /verified|review|Review/);
  await reviewPowerStanceInitiative(a, combat.id, c.id, {
    includedBonus: 14,
    resolution: "Existing Count includes the actual Strength14 bonus"
  });
  assert.equal(c.initiative, 34);
  assert.equal(powerStanceInitiativeReviews(a).length, 0);
  await endCombatStance(a, "power1");
  assert.equal(c.initiative, 20);
});
test("an untracked forced exit persists its unknown component through raw stance removal for explicit GC review", async () => {
  const { a, c, combat } = fixture({ active: true, count: 34, powerRecord: false });
  await endCombatStance(a, "power1");
  assert.equal(a.system.combatStance, null);
  assert.equal(c.initiative, 34);
  assert.equal(a.flags.spycraft2.powerStanceUntrackedExits.length, 1);
  assert.equal(powerStanceInitiativeReviews(a).length, 1);
  await reviewPowerStanceInitiative(a, combat.id, c.id, {
    includedBonus: 14,
    resolution: "Verified old Power bonus still in this Count after forced exit"
  });
  assert.equal(c.initiative, 20);
  assert.equal(powerStanceInitiativeReviews(a).length, 0);
});
test("current Strength changes and unrelated Count loss survive stance exit without restoring the old baseline", async () => {
  const { a, c } = fixture({ active: true, count: 34 });
  a.system.abilities.str.value = 16;
  await reconcilePowerStanceInitiative(a);
  assert.equal(c.initiative, 36);
  await changeInitiativeCountPreservingShaken(c, 31);
  assert.equal(c.flags.spycraft2.powerStanceInitiative.includedBonus, 16);
  await endCombatStance(a, "power1");
  assert.equal(c.initiative, 15);
  assert.equal(c.flags.spycraft2.shakenInitiative.count, 15);
});
test("actual protected incoming Shaken loss remains minus two through Power removal, then clears independently", async () => {
  const { a, c } = fixture({ active: true, count: 34 });
  a.system.classLevels = { intruder: 16 };
  setShaken(a);
  await reconcileShakenInitiative(a);
  assert.equal(c.initiative, 32);
  assert.equal(c.flags.spycraft2.shakenInitiative.includedPenalty, -2);
  assert.equal(c.flags.spycraft2.powerStanceInitiative.includedBonus, 14);
  await endCombatStance(a, "power1");
  assert.equal(c.initiative, 18);
  assert.equal(c.flags.spycraft2.shakenInitiative.includedPenalty, -2);
  setShaken(a, false);
  await reconcileShakenInitiative(a);
  assert.equal(c.initiative, 20);
  assert.equal(c.flags.spycraft2.powerStanceInitiative.count, 20);
});
test("a fresh final Initiative check retains the full Shaken check penalty alongside Power rather than reclassifying it as a protected loss", async () => {
  const { a, c } = fixture({ active: true, count: 34 });
  a.system.classLevels = { intruder: 16 };
  setShaken(a);
  await c.update({ initiative: 30 });
  assert.equal(c.flags.spycraft2.shakenInitiative.includedPenalty, -4);
  assert.equal(c.flags.spycraft2.powerStanceInitiative.includedBonus, 14);
  await endCombatStance(a, "power1");
  assert.equal(c.initiative, 16);
  assert.equal(c.flags.spycraft2.shakenInitiative.includedPenalty, -4);
  setShaken(a, false);
  await reconcileShakenInitiative(a);
  assert.equal(c.initiative, 20);
});
test("unresolved Shaken inclusion blocks Power entry before stance or Count mutation", async () => {
  const { a, c } = fixture({ shakenRecord: false });
  await assert.rejects(declareCombatStance(a, entry()), /Shaken component/);
  assert.equal(a.system.combatStance, null);
  assert.equal(c.initiative, 20);
  assert.equal(c.writes.length, 0);
});
test("committed Count write response failures are proved by both atomic markers and never add the stance twice", async () => {
  const { a, c } = fixture();
  c.fail = "after";
  await declareCombatStance(a, entry());
  assert.equal(c.initiative, 34);
  assert.equal(c.flags.spycraft2.shakenInitiative.count, 34);
  assert.equal(c.flags.spycraft2.powerStanceInitiative.includedBonus, 14);
  c.fail = null;
  const n = c.writes.length;
  await reconcilePowerStanceInitiative(a);
  assert.equal(c.writes.length, n);
  assert.equal(powerStanceInitiativeReviews(a).length, 0);
});
test("rejected Count writes retain a pending inclusion review; GC can confirm zero and apply only the missing stance bonus", async () => {
  const { a, c, combat } = fixture();
  c.fail = "before";
  await assert.rejects(declareCombatStance(a, entry()), /Rejected Count write/);
  assert.equal(c.initiative, 20);
  assert.equal(a.system.combatStance.key, "power");
  assert.equal(powerStanceInitiativeReviews(a).length, 1);
  c.fail = null;
  await reviewPowerStanceInitiative(a, combat.id, c.id, {
    includedBonus: 0,
    resolution: "Count write never committed; verified zero included"
  });
  assert.equal(c.initiative, 34);
  assert.equal(powerStanceInitiativeReviews(a).length, 0);
});
test("simultaneous reconciliations serialize one component update and do not churn audit-only marker fields", async () => {
  const { a, c } = fixture({ active: true, count: 20 });
  c.flags.spycraft2.powerStanceInitiative = marker(system(false), 20);
  await Promise.all(Array.from({ length: 8 }, () => reconcilePowerStanceInitiative(a)));
  assert.equal(c.initiative, 34);
  assert.equal(c.writes.filter(p => Object.hasOwn(p, "initiative")).length, 1);
});
test("unrolled Count reconciliation remains null and adds no Strength until an actual final Count is entered", async () => {
  const { a, c } = fixture({ active: true, count: null, powerRecord: false });
  await reconcilePowerStanceInitiative(a);
  assert.equal(c.initiative, null);
  assert.equal(c.flags.spycraft2.powerStanceInitiative.includedBonus, 0);
  await c.update({ initiative: 42 });
  await reconcilePowerStanceInitiative(a);
  assert.equal(c.initiative, 42);
  assert.equal(c.flags.spycraft2.powerStanceInitiative.includedBonus, 14);
  await endCombatStance(a, "power1");
  assert.equal(c.initiative, 28);
});
test("shared Initiative groups cannot take an individual Power entry or inclusion adjustment", async () => {
  const { a, c, combat } = fixture();
  c.group = { initiative: 20 };
  await assert.rejects(declareCombatStance(a, entry()), /shared Initiative group/);
  assert.equal(a.system.combatStance, null);
  a.system.combatStance = { version: 1, key: "power", id: "power1" };
  await reconcilePowerStanceInitiative(a);
  assert.equal(c.initiative, 20);
  assert.equal(powerStanceInitiativeReviews(a).length, 1);
  await assert.rejects(
    reviewPowerStanceInitiative(a, combat.id, c.id, { includedBonus: 0, resolution: "Review" }),
    /shared Initiative group/
  );
});
test("GC review requires ownership, explicit historical inclusion and an unchanged Count/Strength snapshot", async () => {
  const { a, c, combat } = fixture({ active: true, count: 34, powerRecord: false });
  await reconcilePowerStanceInitiative(a);
  game.user.isGM = false;
  await assert.rejects(
    reviewPowerStanceInitiative(a, combat.id, c.id, { includedBonus: 14, resolution: "Review" }),
    /owning GC/
  );
  game.user.isGM = true;
  for (const includedBonus of ["", -1, true, 1.5])
    await assert.rejects(
      reviewPowerStanceInitiative(a, combat.id, c.id, { includedBonus, resolution: "Review" }),
      /whole nonnegative/
    );
  const dialog = foundry.applications.api.DialogV2.input;
  foundry.applications.api.DialogV2.input = async () => {
    a.system.abilities.str.value = 16;
    return { includedBonus: 14, resolution: "Stale review" };
  };
  await assert.rejects(reviewPowerStanceInitiative(a, combat.id, c.id), /changed/);
  foundry.applications.api.DialogV2.input = dialog;
  assert.equal(c.initiative, 34);
});
test("a known legacy Count drift is held for inclusion review rather than replacing its value with an old baseline", async () => {
  const { a, c, combat } = fixture({ active: true, count: 34 });
  c.initiative = 19;
  await reconcilePowerStanceInitiative(a);
  assert.equal(c.initiative, 19);
  assert.equal(powerStanceInitiativeReviews(a).length, 1);
  await assert.rejects(
    reviewPowerStanceInitiative(a, combat.id, c.id, {
      includedBonus: 14,
      resolution: "Verified current19 includes Power14"
    }),
    /Shaken record/
  );
  await reviewShakenInitiative(a, combat.id, c.id, {
    includedPenalty: 0,
    resolution: "Verified Count19 has no Shaken component"
  });
  await reviewPowerStanceInitiative(a, combat.id, c.id, {
    includedBonus: 14,
    resolution: "Verified current19 includes Power14"
  });
  await endCombatStance(a, "power1");
  assert.equal(c.initiative, 5);
});
test("actual ranged attack removes the Count bonus before RNG even inside an already-paid base callback", async () => {
  const { a, c } = fixture({ active: true, count: 34 });
  a.items[0].system = { ...a.items[0].system, proficiency: "hurled", range: 20, sizeHands: "T/1h" };
  let drew = false;
  controls.draw = async () => {
    drew = true;
    assert.equal(a.system.combatStance, null);
    assert.equal(c.initiative, 20);
    assert.equal(c.flags.spycraft2.powerStanceInitiative.includedBonus, 0);
  };
  await Promise.race([
    queueResources([a], () => a.rollAttack(a.items[0], { attackAction: "standard" })),
    new Promise((_, reject) => setTimeout(() => reject(Error("Nested base queue deadlock")), 1000))
  ]);
  assert.equal(drew, true);
});
test("forced prone exit persists normal stance and removes its Count once; clearing the condition never restores it", async () => {
  const { a, c } = fixture({ active: true, count: 34 }),
    handlers = {};
  globalThis.Hooks = { on: (name, fn) => (handlers[name] = fn) };
  installCombatStanceHooks();
  a.system.conditionContext.prone = true;
  await handlers.updateActor(a);
  assert.equal(a.system.combatStance, null);
  assert.equal(c.initiative, 20);
  a.system.conditionContext.prone = false;
  await reconcilePowerStanceInitiative(a);
  assert.equal(c.initiative, 20);
});
test("registered Power pre-update hook returns false on stale evidence without relying on an uncaught hook exception", () => {
  const { a, c } = fixture(),
    handlers = {};
  globalThis.Hooks = {
    on: (name, fn) => {
      (handlers[name] ??= []).push(fn);
    },
    once: (name, fn) => {
      (handlers[name] ??= []).push(fn);
    }
  };
  installPowerStanceInitiativeHooks();
  const expected = powerStanceInitiativeEvidence(c);
  a.system.abilities.str.value = 16;
  assert.equal(
    handlers.preUpdateCombatant[0](
      c,
      { initiative: 34 },
      { spycraft2PowerStanceInitiative: { expected, marker: marker(system(), 34) } }
    ),
    false
  );
  assert.equal(c.initiative, 20);
});
test("ordinary shared groups with no Power component do not acquire an unrelated Power review on a group edit", async () => {
  const { a, c } = fixture();
  const changed = { group: "ordinaryGroup" };
  guardPowerStanceInitiativeUpdate(c, changed);
  assert.equal(changed["flags.spycraft2.powerStanceInitiative"].needsReview, false);
  c.group = { initiative: 20 };
  c.flags.spycraft2.powerStanceInitiative = changed["flags.spycraft2.powerStanceInitiative"];
  await reconcilePowerStanceInitiative(a);
  assert.equal(c.initiative, 20);
  assert.equal(powerStanceInitiativeReviews(a).length, 0);
});
