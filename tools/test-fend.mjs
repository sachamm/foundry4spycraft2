import test from "node:test";
import assert from "node:assert/strict";
import { actor, controls, opts } from "./fixtures/side-stance.mjs";
import { prep } from "./fixtures/feint.mjs";
import { meleeTrickPlan, validRecordedMeleeTrick } from "../module/rules/melee-tricks.mjs";
import { fendTiming, sameFendTiming } from "../module/rules/fend.mjs";
import { fendSource, fendRows, recordFendMovement } from "../module/apps/fend.mjs";
import { eligibleAttackDamageHits } from "../module/apps/attack-damage-benefits.mjs";
import { meleeTrickContent } from "../module/apps/standard-attack-context.mjs";
import { rollEvidence } from "../module/rules/outcomes.mjs";
function make() {
  const a = actor();
  Object.assign(a.items[0].system, {
    proficiency: "exoticEdged",
    meleeFamily: "polearm",
    sizeHands: "M/2h",
    useHands: 2,
    qualities: "",
    damage: "1d8"
  });
  a.system.combatStance = null;
  a.system.activeFeatNames = ["Polearm Basics", "All-out Attack"];
  a.system.proficiencyTotals.exoticEdged = { proficient: true };
  a.system = prep(a.system, a.items);
  a.flags = {};
  a.update = async patch => {
    for (const [path, value] of Object.entries(patch)) {
      const keys = path.split(".");
      let o = a;
      for (const key of keys.slice(0, -1)) o = o[key] ??= {};
      o[keys.at(-1)] = structuredClone(value);
    }
    return a;
  };
  game.messages.get = id => game.messages.find(m => m.id === id);
  globalThis.ChatMessage.create = async data => {
    const m = { id: "fend" + game.messages.length, uuid: "ChatMessage.fend" + game.messages.length, ...data };
    game.messages.push(m);
    return m;
  };
  return a;
}
const input = () => ({ ...opts(), meleeTrick: "fend", meleeTrickOnlyConfirmed: true }),
  attack = (a, extra = {}) => a.rollAttack(a.items[0], { ...input(), ...extra }),
  finish = async (success = true, extra = {}) => {
    const a = make(),
      m = await attack(a, extra);
    Object.assign(m.flags.spycraft2, { resolved: true, successConfirmed: success });
    return { a, m };
  },
  move = (a, m, extra = {}) =>
    recordFendMovement(a, {
      sourceMessage: m.uuid,
      totalFeet: 5,
      immediateConfirmed: true,
      routeConfirmed: true,
      movementCompleted: true,
      ...extra
    });
test("actual Fend declaration requires no full action and changes no attack, threat or damage bonus while enforcing its actual polearm and one feat trick", async () => {
  const a = make(),
    normal = a.weaponAttack(a.items[0], opts()),
    m = await attack(a),
    c = m.flags.spycraft2,
    p = c.attackContext.meleeTrick;
  assert.equal(c.rawTotal, 12 + normal.total);
  assert.equal(c.threat, normal.threat);
  assert.equal(p.fullActionConfirmed, false);
  assert.equal(p.damageBonus, 0);
  assert.equal(validRecordedMeleeTrick(p, c.attackContext), true);
  assert.match(meleeTrickContent(a), /optional5ft move after hit or miss/);
  for (const patch of [{ meleeTrickOnlyConfirmed: false }, { meleeFeatTrick: "chop" }, { attackAction: "other" }]) {
    const a = make();
    await attack(a, patch);
    assert.equal(game.messages.length, 0);
  }
  for (const change of [
    a => (a.system.activeFeatNames = []),
    a => (a.items[0].system.meleeFamily = "spear"),
    a => (a.items[0].system.equipped = false)
  ]) {
    const a = make();
    change(a);
    a.system = prep(a.system, a.items);
    await attack(a);
    assert.equal(game.messages.length, 0);
  }
});
test("both actual adopted finished hits and misses record one exactly5ft movement and one non-roll receipt without dice or another action", async () => {
  for (const succeeded of [true, false]) {
    const { a, m } = await finish(succeeded),
      random = controls.draw;
    controls.draw = async () => {
      throw Error("Unexpected movement RNG");
    };
    const r = await move(a, m);
    assert.equal(r.flags.spycraft2.checkKind, "fendMovement");
    assert.equal(r.flags.spycraft2.actionDiceAllowed, false);
    assert.equal(a.system.stanceRoundMovement.feet, 5);
    assert.equal(fendRows(a).length, 1);
    assert.equal(game.messages.length, 2);
    assert.equal(a.system.actionDice.value, 0);
    assert.equal(r.flags.spycraft2.fendMovement.movement.distanceFeet, 5);
    controls.draw = random;
  }
});
test("source-bound replay is read-only even after later movement or Count changes and concurrent calls cannot spend the5ft twice", async () => {
  const { a, m } = await finish(),
    all = await Promise.all([move(a, m), move(a, m)]);
  assert.equal(all[0].uuid, all[1].uuid);
  assert.equal(a.system.stanceRoundMovement.feet, 5);
  a.system.stanceRoundMovement.feet = 20;
  a.clock.round++;
  const old = await move(a, m, { totalFeet: 25 });
  assert.equal(old.uuid, all[0].uuid);
  assert.equal(a.system.stanceRoundMovement.feet, 20);
  assert.equal(game.messages.length, 2);
});
test("unconfirmed, wrong-size, delayed, unresolved, superseded, nonstandard or fabricated source cannot record movement", async () => {
  for (const patch of [
    { totalFeet: 0 },
    { totalFeet: 10 },
    { totalFeet: NaN },
    { immediateConfirmed: false },
    { routeConfirmed: false },
    { movementCompleted: false }
  ]) {
    const { a, m } = await finish();
    await assert.rejects(move(a, m, patch));
    assert.equal(fendRows(a).length, 0);
    assert.equal(a.system.stanceRoundMovement, undefined);
  }
  for (const change of [
    (_a, c) => (c.resolved = false),
    (_a, c) => (c.superseded = "ChatMessage.other"),
    (_a, c) => (c.attackContext.attackAction = "other"),
    (_a, c) => (c.attackContext.meleeFeatTrick = "chop"),
    a => a.clock.round++
  ]) {
    const { a, m } = await finish();
    change(a, m.flags.spycraft2);
    await assert.rejects(move(a, m));
    assert.equal(fendRows(a).length, 0);
  }
  const { a } = await finish();
  await assert.rejects(recordFendMovement(a, { sourceMessage: "ChatMessage.fake" }));
});
test("round caps, immobility and sprawled prevent Fend while a legal prone5ft step is not reclassified as a Standard Move", async () => {
  for (const change of [
    a => (a.system.postureMovement = { bonusStep: false }),
    a => (a.system.encumbrance = { immobile: true }),
    a => (a.system.incapacitatedForMovement = true)
  ]) {
    const { a, m } = await finish();
    change(a);
    await assert.rejects(move(a, m), /prevents/);
    assert.equal(fendRows(a).length, 0);
  }
  let { a, m } = await finish();
  a.system.activeFeatNames.push("Fencing Basics");
  a.system.combatStance = { version: 1, key: "side", id: "side1" };
  a.system.stanceRoundMovement = { version: 1, key: a.clock.id + ":" + a.clock.round, feet: 20 };
  await assert.rejects(move(a, m, { totalFeet: 25 }), /no more than20|no more than 20/);
  ({ a, m } = await finish());
  a.system.postureMovement = { prone: true, standardMove: false, bonusStep: true };
  await move(a, m);
  assert.equal(a.system.stanceRoundMovement.feet, 5);
});
test("failed movement-record write changes no bookkeeping; committed write response loss is recovered without adding or undoing movement", async () => {
  let { a, m } = await finish(),
    update = a.update;
  a.update = async p => {
    if (p["system.stanceRoundMovement"]) throw Error("before write");
    return update(p);
  };
  await assert.rejects(move(a, m), /before write/);
  assert.equal(fendRows(a).length, 0);
  a.update = update;
  await move(a, m);
  assert.equal(a.system.stanceRoundMovement.feet, 5);
  ({ a, m } = await finish());
  update = a.update;
  let once = true;
  a.update = async p => {
    await update(p);
    if (once && p["system.stanceRoundMovement"]) {
      once = false;
      throw Error("response lost");
    }
    return a;
  };
  await assert.rejects(move(a, m), /response lost/);
  assert.equal(a.system.stanceRoundMovement.feet, 5);
  a.update = update;
  await move(a, m);
  assert.equal(a.system.stanceRoundMovement.feet, 5);
  assert.equal(fendRows(a).length, 1);
});
test("a published bookkeeping receipt survives lost posting and final-stamp failure; retry reattaches it without movement refresh", async () => {
  let { a, m } = await finish(),
    create = ChatMessage.create;
  ChatMessage.create = async data => {
    await create(data);
    throw Error("posted response lost");
  };
  await move(a, m);
  assert.equal(game.messages.length, 2);
  assert.equal(a.system.stanceRoundMovement.feet, 5);
  ({ a, m } = await finish());
  const update = a.update;
  let once = true;
  a.update = async p => {
    if (once && p["flags.spycraft2.fendMovements"]?.some(r => r.receiptUuid)) {
      once = false;
      throw Error("stamp failed");
    }
    return update(p);
  };
  await assert.rejects(move(a, m), /stamp failed/);
  a.update = update;
  const original = game.messages.at(-1);
  a.system.stanceRoundMovement.feet = 15;
  assert.equal((await move(a, m)).uuid, original.uuid);
  assert.equal(a.system.stanceRoundMovement.feet, 15);
  assert.equal(game.messages.length, 2);
  const dialog = foundry.applications.api.DialogV2.input;
  let content = "";
  foundry.applications.api.DialogV2.input = async o => {
    content = o.content;
    return null;
  };
  try {
    assert.equal(await recordFendMovement(a), null);
    assert.match(content, /Recorded — review only/);
    assert.equal(a.system.stanceRoundMovement.feet, 15);
  } finally {
    foundry.applications.api.DialogV2.input = dialog;
  }
});
test("a missing unpublished movement receipt can be recorded after the actual move without resetting a later total, while missing published receipts require review", async () => {
  const { a, m } = await finish(),
    create = ChatMessage.create;
  ChatMessage.create = async () => {
    throw Error("unposted");
  };
  await assert.rejects(move(a, m), /unposted/);
  assert.equal(a.system.stanceRoundMovement.feet, 5);
  a.system.stanceRoundMovement.feet = 15;
  ChatMessage.create = create;
  const r = await move(a, m);
  assert.equal(a.system.stanceRoundMovement.feet, 15);
  game.messages.splice(game.messages.indexOf(r), 1);
  await assert.rejects(move(a, m), /missing original/);
  assert.equal(a.system.stanceRoundMovement.feet, 15);
});
test("ordinary Fend hits do not invent a zero-damage benefit; combining All-out retains only its real damage bonus in one original claim", async () => {
  let { a, m } = await finish();
  assert.equal(eligibleAttackDamageHits(a, a.items[0]).length, 0);
  await assert.rejects(
    a.rollDamage(a.items[0], {
      includeSneakAttack: false,
      attackDamageSourceUuid: m.uuid,
      targetActorUuid: "Actor.target"
    }),
    /earned damage bonus/
  );
  ({ a, m } = await finish(true, { allOutPenalty: 2 }));
  const d = await a.rollDamage(a.items[0], {
    includeSneakAttack: false,
    attackDamageSourceUuid: m.uuid,
    targetActorUuid: "Actor.target"
  });
  assert.equal(d.flags.spycraft2.attackDamageBenefit.source, "All-out Attack");
  assert.equal(d.flags.spycraft2.attackDamageBenefit.bonus, 4);
  assert.equal(a.system.attackDamageUses.length, 1);
});
test("Fend timing follows the actual active character through Count reorder and supports a real off-Count final source without granting a free attack", () => {
  const a = make(),
    p = fendTiming(a),
    shift = { ...p, combat: { ...p.combat, turn: 1, ownTurnIndex: 1 } };
  assert.equal(sameFendTiming(p, shift), true);
  assert.equal(sameFendTiming(p, { ...shift, activeCombatantId: "different" }), false);
  const w = a.items[0],
    normal = a.weaponAttack(w, opts()),
    proof = meleeTrickPlan(
      a.system,
      { ...w.system, id: w.id },
      {
        trick: "fend",
        ranged: false,
        action: "standard",
        onlyFeatTrickConfirmed: true,
        freeFinalAttack: true,
        targetUuid: "Actor.target",
        grip: normal.grip,
        fendTiming: p
      }
    );
  assert.equal(proof.key, "fend");
  assert.equal(proof.fullActionConfirmed, false);
});
test("source declaration and movement history are immutable, do not copy hidden die totals, and damaged saved route/receipt cannot authorize another move", async () => {
  const { a, m } = await finish(),
    c = m.flags.spycraft2,
    e = rollEvidence(c);
  assert.notEqual(
    e,
    rollEvidence({
      ...c,
      attackContext: {
        ...c.attackContext,
        meleeTrick: {
          ...c.attackContext.meleeTrick,
          timing: { ...c.attackContext.meleeTrick.timing, activeCombatantId: "other" }
        }
      }
    })
  );
  const r = await move(a, m),
    proof = r.flags.spycraft2.fendMovement;
  assert.equal(/rawTotal|effectiveTotal|naturalDie/.test(JSON.stringify(proof)), false);
  a.flags.spycraft2.fendMovements[0].proof.movement.roundMovement.feet = 10;
  assert.throws(() => fendRows(a), /Review/);
  assert.equal(a.system.stanceRoundMovement.feet, 5);
});

test("live actual polearm, feat, profile or active-participant changes reject unpublished Fend, while same-participant index reorder preserves its original proof", async () => {
  for (const change of [
    a => (a.system.activeFeatNames = []),
    a => {
      a.items[0].system.equipped = false;
      a.system = prep(a.system, a.items);
    },
    a => (a.items[0].system.damage = "4d6"),
    a => a.clock.round++
  ]) {
    const a = make();
    controls.draw = async () => change(a);
    await assert.rejects(attack(a), /changed|requires/);
    assert.equal(game.messages.length, 0);
  }
  const a = make();
  controls.draw = async () => {
    a.clock.turn = 1;
    a.clock.ownTurnIndex = 1;
  };
  const m = await attack(a);
  assert.equal(m.flags.spycraft2.attackContext.meleeTrick.timing.combat.turn, 0);
  assert.equal(a.clock.turn, 1);
  Object.assign(m.flags.spycraft2, { resolved: true, successConfirmed: false });
  await move(a, m);
  assert.equal(a.system.stanceRoundMovement.feet, 5);
});
test("original owned unresolved Fend replacement retains its declaration after feat loss, and only an adopted replacement can provide movement", async () => {
  const a = make(),
    m = await attack(a),
    c = m.flags.spycraft2;
  a.system.activeFeatNames = [];
  const r = await a.rollCheck(c.formula, c.rollData, { ...c, rerollOf: m.uuid });
  Object.assign(r.flags.spycraft2, { resolved: true, successConfirmed: false });
  assert.throws(() => fendSource(a, r), /adopted/);
  Object.assign(c, { resolved: true, superseded: r.uuid });
  const receipt = await move(a, r);
  assert.equal(receipt.flags.spycraft2.fendMovement.rootAttackUuid, m.uuid);
  assert.equal(a.system.stanceRoundMovement.feet, 5);
});

test("out-of-combat Fend uses actual unchanged world time and normal world-round movement; an intervening time advance cannot authorize a delayed move", async () => {
  const a = make();
  a.mentalLeapCombatContext = () => null;
  a.system.worldTime = 120;
  const oldTime = game.time;
  game.time = { worldTime: 120 };
  try {
    const m = await attack(a);
    Object.assign(m.flags.spycraft2, { resolved: true, successConfirmed: false });
    assert.equal(m.flags.spycraft2.attackContext.meleeTrick.timing.combat, null);
    game.time.worldTime = 121;
    await assert.rejects(move(a, m), /immediately/);
    assert.equal(fendRows(a).length, 0);
    const b = make();
    b.mentalLeapCombatContext = () => null;
    b.system.worldTime = 121;
    const second = await attack(b);
    Object.assign(second.flags.spycraft2, { resolved: true, successConfirmed: false });
    await move(b, second);
    assert.equal(b.system.stanceRoundMovement.key, "world:20");
    assert.equal(b.system.stanceRoundMovement.feet, 5);
  } finally {
    game.time = oldTime;
  }
});
test("published movement receipts preserve original secret visibility and a damaged receipt cannot be attached or repeated", async () => {
  const { a, m } = await finish();
  m.blind = true;
  m.whisper = ["gc"];
  const r = await move(a, m);
  assert.equal(r.blind, true);
  assert.deepEqual(r.whisper, ["gc"]);
  r.flags.spycraft2.fendMovement.movement.distanceFeet = 10;
  await assert.rejects(move(a, m), /receipt changed/);
  assert.equal(a.system.stanceRoundMovement.feet, 5);
});
test("Fend can be declared through a genuine earned Trip final-attack control, retaining the ordinary private final lease and shared limit", async () => {
  const { actor: finalActor } = await import("./fixtures/trip-final-attack.mjs"),
    { takeTripFinalAttack } = await import("../module/apps/trip-final-attack.mjs"),
    a = finalActor(),
    w = a.items[0];
  a.system.activeFeatNames.push("Polearm Basics");
  a.system.proficiencyTotals.exoticEdged = { proficient: true };
  Object.assign(w.system, { proficiency: "exoticEdged", meleeFamily: "polearm", sizeHands: "M/2h", useHands: 2 });
  const old = a.weaponAttack;
  a.weaponAttack = (item, o = {}) =>
    old(item, { ...o, ...(o.meleeTrick === "fend" ? { fendTiming: fendTiming(a) } : {}) });
  const m = await takeTripFinalAttack(a, {
    sourceMessage: "ChatMessage.source",
    weaponId: "sword",
    immediateConfirmed: true,
    attackLegalConfirmed: true,
    meleeTrick: "fend",
    meleeTrickOnlyConfirmed: true
  });
  assert.equal(m.flags.spycraft2.attackContext.meleeTrick.key, "fend");
  assert.equal(m.flags.spycraft2.attackContext.meleeTrick.fullActionConfirmed, false);
  assert.equal(m.flags.spycraft2.finalAttack.source, "trip");
  assert.equal(a.system.resourceUses.finalAttackRound.used, 1);
});
