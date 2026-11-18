import test from "node:test";
import assert from "node:assert/strict";
import { actor, controls, opts } from "./fixtures/side-stance.mjs";
import { clock } from "./fixtures/feint.mjs";
import {
  drivingFacts,
  drivingRows,
  currentDrivingReceipt,
  validateDrivingSource
} from "../module/rules/driving-stance.mjs";
import { settleDrivingStance, reviewDrivingStance } from "../module/apps/driving-stance.mjs";
import { combatStanceDeclaration, combatStanceState } from "../module/rules/combat-stance.mjs";
import { rollEvidence } from "../module/rules/outcomes.mjs";
import { queueResources } from "../module/rules/transactions.mjs";
let sequence = 0;
const post = { mode: "normal", hook: async () => {} };
const route = (outcome = "push", follow = false) => ({ outcome, follow, routeConfirmed: true, outcomeConfirmed: true });
function make() {
  const a = actor();
  a.system.activeFeatNames = ["Hammer Basics"];
  a.system.combatStance = { version: 1, key: "driving", id: "driving1" };
  const update = a.update;
  a.fault = { before: null, after: null };
  a.update = async patch => {
    await a.fault.before?.(patch);
    const { ["flags.spycraft2.drivingStanceUses"]: rows, ...other } = patch;
    if (rows !== undefined) {
      a.flags.spycraft2 ??= {};
      a.flags.spycraft2.drivingStanceUses = structuredClone(rows);
    }
    if (Object.keys(other).length) await update(other);
    await a.fault.after?.(patch);
    return a;
  };
  post.mode = "normal";
  post.hook = async () => {};
  ChatMessage.create = async data => {
    await post.hook();
    if (post.mode === "before") throw Error("post failed");
    const m = { ...data, id: "drive" + ++sequence, uuid: "ChatMessage.drive" + sequence, rolls: data.rolls ?? [] };
    game.messages.push(m);
    if (post.mode === "after") throw Error("response lost");
    return m;
  };
  ui.notifications.info = () => null;
  return a;
}
async function hit(a = make()) {
  const m = await a.rollAttack(a.items[0], opts());
  Object.assign(m.flags.spycraft2, { resolved: true, successConfirmed: true });
  return { a, m };
}
const settle = (a, m, r = route()) => settleDrivingStance(a, m, r);
test("earned Driving Stance requires legal own-turn half action and uses shared single stance and forced-exit rules", () => {
  const a = make(),
    before = { speed: a.system.speed, defense: a.system.defense.total };
  assert.equal(
    combatStanceDeclaration(a.system, "driving", { halfActionConfirmed: true, legalConfirmed: true, combat: clock() })
      .key,
    "driving"
  );
  assert.equal(combatStanceState(a.system).name, "Driving Stance");
  for (const key of ["prone", "sprawled", "helpless"])
    assert.equal(combatStanceState({ ...a.system, conditionContext: { [key]: true } }), null);
  for (const r of [{ halfActionConfirmed: false }, { combat: { ...clock(), turn: 1 } }, { legalConfirmed: false }])
    assert.throws(() =>
      combatStanceDeclaration(a.system, "driving", {
        halfActionConfirmed: true,
        legalConfirmed: true,
        combat: clock(),
        ...r
      })
    );
  assert.throws(() =>
    combatStanceDeclaration({ ...a.system, activeFeatNames: [] }, "driving", {
      halfActionConfirmed: true,
      legalConfirmed: true
    })
  );
  assert.deepEqual({ speed: a.system.speed, defense: a.system.defense.total }, before);
});
test("actual sword hit pushes five feet and optional follow is exactly five without requiring a held hammer or rolling damage", async () => {
  const { a, m } = await hit();
  let draws = 0;
  controls.draw = async () => draws++;
  const c = await settle(a, m, route("push", true)),
    p = c.flags.spycraft2.drivingStance;
  assert.equal(p.pushFeet, 5);
  assert.equal(p.followFeet, 5);
  assert.equal(p.damageFormula, null);
  assert.equal(c.flags.spycraft2.actionDiceAllowed, false);
  assert.equal(c.rolls.length, 0);
  assert.equal(draws, 0);
  assert.match(c.content, /does not move tokens/);
  assert.equal(drivingRows(a).length, 1);
});
test("blocked outcome rolls only 1d4 subdual, permits ordinary damage boosts and adds no weapon or Strength bonus", async () => {
  const { a, m } = await hit();
  let draws = 0;
  controls.draw = async () => draws++;
  const c = await settle(a, m, route("blocked"));
  assert.equal(draws, 1);
  const x = c.flags.spycraft2;
  assert.equal(x.checkKind, "damage");
  assert.equal(x.checkId, "drivingStance");
  assert.equal(x.formula, "1d4");
  assert.deepEqual(x.rollData, {});
  assert.equal(x.drivingStance.damageType, "subdual");
  assert.equal(x.actionDiceAllowed, true);
  assert.equal(x.weaponUuid, "");
  assert.equal(x.unarmed, false);
  assert.equal(x.drivingStance.followFeet, 0);
  assert.equal(c.rolls.length, 1);
  assert.equal(a.system.actionDice.value, 0);
});
test("actual Sickened penalty applies once to blocked damage and its original unresolved replacement retains the earned formula after recovery", async () => {
  const { a, m } = await hit();
  a.system.conditionContext = { sickened: true };
  const c = await settle(a, m, route("blocked"));
  assert.equal(c.flags.spycraft2.formula, "max(0, (1d4) + (-2))");
  a.system.conditionContext = {};
  assert.equal(await settle(a, m, route("blocked")), c);
  const x = c.flags.spycraft2,
    r = await a.rollCheck(x.formula, x.rollData, { ...x, rerollOf: c.uuid });
  Object.assign(x, { resolved: true, superseded: r.uuid });
  assert.equal(r.flags.spycraft2.formula, x.formula);
  assert.equal(currentDrivingReceipt(a, drivingRows(a)[0]), r);
});
test("unresolved, miss, ranged, wrong stance, defensive Disarm and known object sources reject before any RNG or outcome row", async () => {
  for (const edit of [
    c => (c.resolved = false),
    c => (c.successConfirmed = false),
    c => (c.attackContext.ranged = true),
    c => (c.attackContext.combatStance.stance.key = "menacing"),
    c => (c.attackContext.disarm = { role: "defender" }),
    c => (c.attackContext.characterTarget = { object: true }),
    c => (c.superseded = "ChatMessage.other")
  ]) {
    const { a, m } = await hit();
    edit(m.flags.spycraft2);
    let draws = 0;
    controls.draw = async () => draws++;
    await assert.rejects(settle(a, m));
    assert.equal(draws, 0);
    assert.equal(drivingRows(a).length, 0);
  }
});
test("a hit must bind the actual other character, rejecting absent target, self and noncharacter", async () => {
  for (const id of ["", "Actor.feint", "Item.target"]) {
    const { a, m } = await hit();
    m.flags.spycraft2.attackContext.targetActorUuid = id;
    await assert.rejects(settle(a, m), /actual character/);
  }
});
test("foreign, unreadable and forged unregistered hit objects cannot acquire an outcome", async () => {
  for (const edit of [
    (a, m) => (a.isOwner = false),
    (a, m) => (m.visible = false),
    (a, m) => (m.flags.spycraft2.actorUuid = "Actor.other"),
    (a, m) => game.messages.splice(0)
  ]) {
    const { a, m } = await hit();
    edit(a, m);
    await assert.rejects(settle(a, m), /own readable/);
    assert.equal(drivingRows(a).length, 0);
  }
});
test("route and outcome confirmations cannot be omitted; blocked damage cannot grant follow or select an invented route", async () => {
  for (const patch of [
    { outcomeConfirmed: false },
    { routeConfirmed: false },
    { outcome: "other" },
    { follow: 5 },
    { outcome: "blocked", follow: true }
  ]) {
    const { a, m } = await hit();
    await assert.rejects(settle(a, m, { ...route(), ...patch }), /Confirm the actual/);
    assert.equal(drivingRows(a).length, 0);
  }
});
test("the original hit can produce only one route and follow choice, and retries return the same receipt without replay", async () => {
  const { a, m } = await hit(),
    c = await settle(a, m, route("push", true)),
    n = game.messages.length;
  assert.equal(await settle(a, m, route("push", true)), c);
  await assert.rejects(settle(a, m, route("blocked")), /different/);
  await assert.rejects(settle(a, m, route("push", false)), /different/);
  assert.equal(game.messages.length, n);
});
test("concurrent blocked declarations reserve once and the second request cannot draw another die", async () => {
  const { a, m } = await hit();
  let enter,
    release,
    draws = 0;
  const entered = new Promise(r => (enter = r)),
    blocked = new Promise(r => (release = r));
  controls.draw = async () => {
    draws++;
    enter();
    await blocked;
  };
  const first = settle(a, m, route("blocked"));
  await entered;
  await assert.rejects(settle(a, m, route("blocked")), /interrupted/);
  release();
  await first;
  assert.equal(draws, 1);
});
test("earned hit outcome survives stance exit, source feat loss and weapon deletion without allowing a new attack", async () => {
  const { a, m } = await hit(),
    w = a.items[0];
  a.system.combatStance = null;
  a.system.activeFeatNames = [];
  a.items = [];
  const c = await settle(a, m, route("blocked"));
  assert.equal(c.flags.spycraft2.drivingStance.damageFormula, "1d4");
  await assert.rejects(a.rollAttack(w, opts()), /owned|weapon|changed/);
});
test("only the actually adopted attack replacement may claim the original hit once", async () => {
  const a = make(),
    m = await a.rollAttack(a.items[0], opts()),
    x = m.flags.spycraft2,
    r = await a.rollCheck(x.formula, x.rollData, { ...x, rerollOf: m.uuid });
  Object.assign(r.flags.spycraft2, { resolved: true, successConfirmed: true });
  await assert.rejects(settle(a, r), /adopted/);
  Object.assign(x, { resolved: true, superseded: r.uuid });
  const c = await settle(a, r);
  assert.equal(c.flags.spycraft2.drivingStance.rootAttackUuid, m.uuid);
  assert.equal(drivingRows(a).length, 1);
});
test("caller-created blocked damage proof, wrong formula or weapon modifier rejects before RNG", async () => {
  const { a, m } = await hit(),
    facts = drivingFacts(a, m, route("blocked")),
    proof = { ...facts, outcomeId: "forged" };
  let draws = 0;
  controls.draw = async () => draws++;
  await assert.rejects(
    a.rollCheck("1d4", {}, { checkKind: "damage", checkId: "drivingStance", drivingStance: proof }),
    /reservation/
  );
  assert.equal(draws, 0);
});
test("source target or Sickened changes during damage RNG abort the unpublished component and release its unused reservation", async () => {
  for (const change of [
    a => (a.system.conditionContext = { sickened: true }),
    (a, m) => (m.flags.spycraft2.attackContext.targetActorUuid = "Actor.other")
  ]) {
    const { a, m } = await hit(),
      n = game.messages.length;
    controls.draw = async () => change(a, m);
    await assert.rejects(settle(a, m, route("blocked")), /changed/);
    assert.equal(game.messages.length, n);
    assert.equal(drivingRows(a).length, 0);
  }
});
test("unpublished failed outcome post releases the reservation for a legitimate retry", async () => {
  const { a, m } = await hit();
  post.mode = "before";
  await assert.rejects(settle(a, m), /post failed/);
  assert.equal(drivingRows(a).length, 0);
  post.mode = "normal";
  assert.ok(await settle(a, m));
});
test("a lost response after posting preserves the existing push receipt and stamps it without another post", async () => {
  const { a, m } = await hit(),
    n = game.messages.length;
  post.mode = "after";
  const c = await settle(a, m);
  assert.equal(game.messages.length, n + 1);
  assert.equal(drivingRows(a)[0].receiptUuid, c.uuid);
});
test("two failed final blocked-damage stamps retain one rolled card and GC attaches it without RNG", async () => {
  const { a, m } = await hit();
  let count = 0,
    draws = 0;
  controls.draw = async () => draws++;
  a.fault.before = async patch => {
    if (patch["flags.spycraft2.drivingStanceUses"]?.some(r => r.receiptUuid) && count++ < 2)
      throw Error("stamp failed");
  };
  await assert.rejects(settle(a, m, route("blocked")), /GC review/);
  const row = drivingRows(a)[0],
    n = game.messages.length;
  assert.equal(row.receiptUuid, null);
  assert.equal(draws, 1);
  a.fault.before = null;
  const recovered = await reviewDrivingStance(a, { outcomeId: row.id, confirmed: true });
  assert.ok(recovered.receiptUuid);
  assert.equal(game.messages.length, n);
  assert.equal(draws, 1);
  assert.equal(await settle(a, m, route("blocked")), currentDrivingReceipt(a, drivingRows(a)[0]));
});
test("GC recovery requires explicit owning GC and rejects an active local job", async () => {
  const { a, m } = await hit();
  let release, enter;
  const pending = new Promise(r => (release = r)),
    entered = new Promise(r => (enter = r));
  controls.draw = async () => {
    enter();
    await pending;
  };
  const p = settle(a, m, route("blocked"));
  await entered;
  const row = drivingRows(a)[0];
  await assert.rejects(reviewDrivingStance(a, { outcomeId: row.id, confirmed: true }), /still recording/);
  release();
  await p;
  await assert.rejects(reviewDrivingStance(a, { outcomeId: row.id }), /owning GC/);
});
test("both push and blocked cards inherit exact secret recipients, while Actor proof stores no raw die totals", async () => {
  for (const outcome of ["push", "blocked"]) {
    const { a, m } = await hit();
    m.blind = true;
    m.whisper = ["GC", "reviewer"];
    game.user.isGM = false;
    await assert.rejects(settle(a, m, route(outcome)), /own readable/);
    game.user.isGM = true;
    const c = await settle(a, m, route(outcome));
    assert.equal(c.blind, true);
    assert.deepEqual(c.whisper, ["GC", "reviewer"]);
    assert.doesNotMatch(
      JSON.stringify(a.flags.spycraft2.drivingStanceUses),
      /effectiveTotal|rawTotal|naturalDie|rollData/
    );
  }
});
test("receipt proof edits and unadopted damage replacements fail rather than replaying outcomes", async () => {
  const { a, m } = await hit(),
    c = await settle(a, m, route("blocked")),
    x = c.flags.spycraft2,
    r = await a.rollCheck(x.formula, x.rollData, { ...x, rerollOf: c.uuid });
  assert.throws(() => currentDrivingReceipt(a, drivingRows(a)[0]), /duplicate/);
  Object.assign(x, { resolved: true, superseded: r.uuid });
  assert.equal(currentDrivingReceipt(a, drivingRows(a)[0]), r);
  r.flags.spycraft2.drivingStance = { ...r.flags.spycraft2.drivingStance, followFeet: 5 };
  assert.throws(() => currentDrivingReceipt(a, drivingRows(a)[0]), /changed/);
});
test("driving metadata participates in outcome evidence without changing ordinary legacy signatures", async () => {
  const { a, m } = await hit(),
    c = await settle(a, m, route("blocked")),
    before = rollEvidence(c.flags.spycraft2);
  c.flags.spycraft2.drivingStance = { ...c.flags.spycraft2.drivingStance, targetUuid: "Actor.other" };
  assert.notEqual(rollEvidence(c.flags.spycraft2), before);
});
test("controller can execute inside an already-paid base callback without nesting the base queue", async () => {
  const { a, m } = await hit();
  const c = await Promise.race([
    queueResources([a], () => settle(a, m, route("blocked"))),
    new Promise((_, reject) => setTimeout(() => reject(Error("deadlock")), 1000))
  ]);
  assert.equal(c.flags.spycraft2.checkKind, "damage");
});
test("source proof canonical serialization tolerates object-key order but not changed target history", async () => {
  const { a, m } = await hit(),
    p = drivingFacts(a, m, route());
  const proof = { ...p, outcomeId: "test" };
  m.flags.spycraft2.attackContext.combatStance = JSON.parse(
    JSON.stringify(m.flags.spycraft2.attackContext.combatStance),
    (_k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).reverse()) : v)
  );
  assert.ok(validateDrivingSource(a, proof));
  m.flags.spycraft2.attackContext.targetActorUuid = "Actor.other";
  assert.throws(() => validateDrivingSource(a, proof), /changed/);
});
test("actual blocked result uses the common one-action-die damage limit and fixed push has no boostable roll", async () => {
  const { actionDieBoostPlan, actionDieBoostResult } = await import("../module/rules/action-dice.mjs"),
    { a, m } = await hit(),
    c = await settle(a, m, route("blocked")),
    system = { ...a.system, actionDice: { value: 3, die: 4, bonus: 0, explodeAt: 4 } },
    check = c.flags.spycraft2,
    plan = actionDieBoostPlan(system, check, { count: 1 });
  assert.equal(plan.blocked, false);
  assert.equal(plan.rolls, 1);
  assert.equal(actionDieBoostPlan(system, check, { count: 2 }).blocked, true);
  const boosted = { ...check, ...actionDieBoostResult(check, plan, [3]) };
  assert.equal(actionDieBoostPlan(system, boosted, { count: 1 }).blocked, true);
  assert.equal(actionDieBoostPlan(system, { ...check, resolved: true }, { count: 1 }).blocked, true);
});
test("a real pending reservation still rejects invented formula, added data, weapon bonuses and forged lease before nested RNG", async () => {
  const { a, m } = await hit();
  let checks = 0;
  controls.draw = async () => {
    if (checks++) return;
    const proof = drivingRows(a)[0].proof;
    for (const [formula, data, options] of [
      ["1d4+99", {}, {}],
      ["1d4", { total: 99 }, {}],
      ["1d4", {}, { weaponUuid: a.items[0].uuid }],
      ["1d4", {}, { drivingStanceLease: {} }]
    ])
      await assert.rejects(
        a.rollCheck(formula, data, { checkKind: "damage", checkId: "drivingStance", drivingStance: proof, ...options }),
        /only the reserved|Reserve the blocked/
      );
  };
  await settle(a, m, route("blocked"));
  assert.equal(checks, 1);
});
test("canonical Hammer Basics qualifies Driving in actual engine with no incidental Speed or Defense change", async () => {
  const { makeFatigueActor } = await import("./fixtures/fatigue-actor.mjs"),
    { readFileSync } = await import("node:fs"),
    a = makeFatigueActor(),
    f = JSON.parse(readFileSync(new URL("../src/data/feats.json", import.meta.url))).find(
      f => f.name === "Hammer Basics"
    );
  a.raw.proficiencies = { blunt: { proficient: true } };
  a.items.push({
    id: "hammerFeat",
    type: "feat",
    name: f.name,
    system: { ...f, tree: "meleeCombat", acquiredAtLevel: 1 }
  });
  a.derive();
  assert.equal(a.system.featStatus.hammerFeat.ok, true);
  const before = { speed: a.system.speed, defense: a.system.defense.total };
  a.raw.combatStance = { version: 1, key: "driving", id: "realDriving" };
  a.derive();
  assert.equal(combatStanceState(a.system).key, "driving");
  assert.deepEqual({ speed: a.system.speed, defense: a.system.defense.total }, before);
});
test("GC explicitly releases an absent interrupted receipt but cannot replace it with a second route implicitly", async () => {
  const { a, m } = await hit();
  let fails = 0;
  post.mode = "before";
  a.fault.before = async patch => {
    if (patch["flags.spycraft2.drivingStanceUses"]?.length === 0 && fails++ < 1) throw Error("cleanup failed");
  };
  await assert.rejects(settle(a, m), /GC review/);
  const row = drivingRows(a)[0];
  post.mode = "normal";
  a.fault.before = null;
  await assert.rejects(settle(a, m, route("blocked")), /different/);
  const result = await reviewDrivingStance(a, { outcomeId: row.id, confirmed: true });
  assert.equal(result.released, true);
  assert.equal(drivingRows(a).length, 0);
  assert.ok(await settle(a, m));
});
