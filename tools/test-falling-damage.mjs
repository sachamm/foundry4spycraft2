import test from "node:test";
import assert from "node:assert/strict";
import { fallDistancePlan } from "../module/rules/fall-distance.mjs";
import { fallingDamagePlan } from "../module/rules/falling-damage.mjs";
import { resolveFallingDamage, recordUncontrolledFall } from "../module/apps/falling-damage.mjs";
import { quickApplyInput } from "../module/apps/damage-application.mjs";

const proof = (feet, extras = {}) =>
  fallDistancePlan(
    { activeFeatNames: [], ...extras },
    {
      fallDeclared: true,
      fallConfirmed: true,
      fallDistanceFeet: feet,
      fallSoftSurface: false
    }
  );
test("solid, fluid and soft/reduced falls apply the dice cap, actual-height AP and lethal-only stress", () => {
  const p = proof(35);
  assert.deepEqual(fallingDamagePlan(p, { result: 19, dice: [6, 4, 3] }), {
    version: 1,
    actualDistanceFeet: 35,
    damageDistanceFeet: 35,
    surface: "solid",
    diving: false,
    result: 19,
    dc: 20,
    succeeded: false,
    diceCount: 3,
    armorPiercing: 3,
    kind: "lethal",
    dice: [6, 4, 3],
    adjustedDice: [6, 4, 3],
    checkReduction: 0,
    impact: 13,
    stress: 6,
    sprawled: true
  });
  assert.equal(fallingDamagePlan(p, { result: 19, surface: "fluid", dice: [6, 4, 3] }).stress, 0);
  assert.equal(fallingDamagePlan(p, { result: 19, surface: "fluid", dice: [6, 4, 3] }).kind, "subdual");
  const high = fallingDamagePlan(proof(1000), { result: 0, dice: Array(20).fill(6) });
  assert.equal(high.impact, 120);
  assert.equal(high.armorPiercing, 100);
  assert.equal(high.stress, 40);
  const reduced = proof(30, { activeFeatNames: ["Equilibrium Basics"] });
  assert.equal(fallingDamagePlan(reduced, { result: 0, dice: [6] }).stress, 2);
  assert.equal(fallingDamagePlan(proof(29.9), { result: 0, dice: [6, 6] }).stress, 0);
});

test("successful Acrobatics and per-die class/feat reductions retain the one-per-die minimum; dives require depth", () => {
  const p = proof(60, { activeFeatNames: ["Spider Mastery"], classLevels: { stuntman: 4 } });
  const r = fallingDamagePlan(p, { result: 24, dice: [1, 2, 3, 4, 5, 6] });
  assert.deepEqual(r.adjustedDice, [1, 1, 1, 1, 2, 3]);
  assert.equal(r.checkReduction, 6);
  assert.equal(r.impact, 6);
  assert.equal(r.sprawled, false);
  const dive = fallingDamagePlan(p, { result: 25, surface: "fluid", diving: true, waterDepthFeet: 20, dice: [] });
  assert.equal(dive.dc, 25);
  assert.equal(dive.impact, 0);
  assert.equal(dive.sprawled, false);
  assert.throws(() => fallingDamagePlan(p, { result: 25, surface: "fluid", diving: true, waterDepthFeet: 19.9 }));
  assert.throws(() => fallingDamagePlan(p, { result: 25, diving: true, waterDepthFeet: 20 }));
  assert.throws(() => fallingDamagePlan(p, { result: 0, dice: [7] }));
});

function fixture(total = 10) {
  const messages = [],
    calls = [];
  globalThis.game = { ready: false, user: { isGM: true, id: "gc" }, messages, settings: { get: () => ({}) } };
  let serial = 0;
  globalThis.foundry = { utils: { randomID: () => `id${++serial}`, escapeHTML: String } };
  globalThis.CONFIG = { statusEffects: [{ id: "sprawled", name: "Sprawled" }] };
  globalThis.Roll = class {
    async evaluate() {
      calls.push("roll");
      this.dice = [{ results: [6, 4, 3].map(result => ({ result, active: true })) }];
      return this;
    }
  };
  globalThis.ChatMessage = {
    getSpeaker: () => ({}),
    async create(data) {
      calls.push("post");
      const card = { ...data, uuid: `ChatMessage.card${++serial}` };
      messages.push(card);
      return card;
    }
  };
  const check = {
    actorUuid: "Actor.fall",
    checkKind: "skill",
    skillKey: "acrobatics",
    checkId: "falling",
    rawTotal: total,
    successConfirmed: null,
    effectiveTotal: total,
    fallDistance: proof(30)
  };
  const message = { uuid: "ChatMessage.fall", flags: { spycraft2: check } };
  const actor = {
    uuid: "Actor.fall",
    isOwner: true,
    flags: {},
    statuses: new Set(),
    effects: [],
    async confirmCheckOutcome(m, options) {
      calls.push("confirm");
      check.successConfirmed = options.succeeded;
      return m;
    },
    async finishCheck(m) {
      calls.push("finish");
      check.resolved = true;
      return m;
    },
    async update(patch) {
      for (const [path, value] of Object.entries(patch)) {
        const parts = path.split(".");
        let target = this;
        for (const key of parts.slice(0, -1)) target = target[key] ??= {};
        const key = parts.at(-1);
        if (key.startsWith("-=")) delete target[key.slice(2)];
        else target[key] = structuredClone(value);
      }
      return this;
    },
    async createEmbeddedDocuments(_kind, rows) {
      calls.push("condition");
      this.statuses.add("sprawled");
      return rows;
    }
  };
  return { actor, message, check, messages, calls };
}
const landing = { surface: "solid", confirmed: true };

test("real controller closes the roll, posts impact/stress with correct quick-apply defaults and lands sprawled once", async () => {
  const f = fixture();
  const result = await resolveFallingDamage(f.actor, f.message, landing);
  assert.equal(result.state, "complete");
  assert.deepEqual(f.calls, ["confirm", "finish", "roll", "post", "post", "condition"]);
  globalThis.fromUuidSync = () => null;
  const impact = quickApplyInput(f.messages[0], f.actor.uuid),
    stress = quickApplyInput(f.messages[1], f.actor.uuid);
  assert.equal(impact.damage, 13);
  assert.equal(impact.armorPiercing, 3);
  assert.equal(impact.kind, "lethal");
  assert.equal(stress.damage, 6);
  assert.equal(stress.kind, "stress");
  assert.ok(
    f.messages.every(m => m.flags.spycraft2.resolved),
    "falling damage cannot be boosted"
  );
  f.messages.length = 0;
  await resolveFallingDamage(f.actor, f.message, landing);
  assert.equal(f.calls.filter(c => c === "roll").length, 1, "deleted cards cannot permit rerolling");
});

test("interrupted and lost-response chat posting resumes its saved dice without duplicate cards", async () => {
  const f = fixture(),
    post = ChatMessage.create;
  let failed = false;
  ChatMessage.create = async data => {
    if (!failed) {
      failed = true;
      throw Error("offline");
    }
    return post(data);
  };
  await assert.rejects(resolveFallingDamage(f.actor, f.message, landing), /offline/);
  ChatMessage.create = async data => {
    await post(data);
    throw Error("response lost");
  };
  const result = await resolveFallingDamage(f.actor, f.message, landing);
  assert.equal(result.state, "complete");
  assert.equal(f.messages.length, 2);
  assert.equal(f.calls.filter(c => c === "roll").length, 1);
});

test("refused closure, wrong actors and superseded results do not roll or apply falling effects", async () => {
  const f = fixture();
  f.actor.finishCheck = async () => null;
  assert.equal(await resolveFallingDamage(f.actor, f.message, landing), null);
  assert.equal(f.messages.length, 0);
  assert.equal(f.calls.includes("roll"), false);
  f.check.actorUuid = "Actor.other";
  assert.equal(await resolveFallingDamage(f.actor, f.message, landing), null);
  f.check.actorUuid = f.actor.uuid;
  f.check.superseded = true;
  assert.equal(await resolveFallingDamage(f.actor, f.message, landing), null);
});

test("a reserved roll requires actual-dice GC recovery and never rerolls an unknown outcome", async () => {
  const f = fixture();
  globalThis.Roll = class {
    async evaluate() {
      f.calls.push("roll");
      throw Error("RNG interrupted");
    }
  };
  await assert.rejects(resolveFallingDamage(f.actor, f.message, landing), /RNG interrupted/);
  game.user.isGM = false;
  await assert.rejects(resolveFallingDamage(f.actor, f.message, landing), /GC review/);
  game.user.isGM = true;
  const result = await resolveFallingDamage(f.actor, f.message, {
    actualDice: [6, 4, 3],
    confirmed: true,
    note: "Actual dice verified"
  });
  assert.equal(result.state, "complete");
  assert.equal(result.plan.impact, 13);
  assert.equal(f.calls.filter(c => c === "roll").length, 1);
  assert.equal(result.review.userId, "gc");
});

test("committed actor writes with lost responses and competing settlement calls preserve one roll", async () => {
  const f = fixture(),
    update = f.actor.update;
  f.actor.update = async patch => {
    await update.call(f.actor, patch);
    throw Error("response lost");
  };
  const results = await Promise.all([
    resolveFallingDamage(f.actor, f.message, landing),
    resolveFallingDamage(f.actor, f.message, landing)
  ]);
  assert.ok(results.every(r => r.state === "complete"));
  assert.equal(f.calls.filter(c => c === "roll").length, 1);
  assert.equal(f.messages.length, 2);
});

test("a private Falling result keeps its damage cards private and a changed diving DC cannot reuse another confirmation", async () => {
  const f = fixture();
  f.message.whisper = ["gc"];
  f.message.blind = true;
  await resolveFallingDamage(f.actor, f.message, landing);
  assert.ok(f.messages.every(m => m.blind && m.whisper[0] === "gc"));
  const other = fixture(20);
  other.check.successConfirmed = true;
  other.check.fallDistance = proof(60);
  await assert.rejects(
    resolveFallingDamage(other.actor, other.message, {
      surface: "fluid",
      diving: true,
      waterDepthFeet: 20,
      confirmed: true
    }),
    /does not match/
  );
  assert.equal(other.calls.length, 0);
});

test("a fall without a check uses qualified reductions and ordinary landing effects without inventing a skill roll", async () => {
  for (const lostResponse of [false, true]) {
    const f = fixture();
    f.actor.type = "agent";
    f.actor.system = { activeFeatNames: ["Equilibrium Basics"], classLevels: { stuntman: 4 } };
    if (lostResponse) {
      const post = ChatMessage.create;
      ChatMessage.create = async data => {
        await post(data);
        throw Error("response lost");
      };
    }
    const { message, result } = await recordUncontrolledFall(f.actor, {
      distanceFeet: 50,
      surface: "solid",
      confirmed: true
    });
    assert.equal(message.flags.spycraft2.checkKind, "fallEvent");
    assert.equal(message.flags.spycraft2.successConfirmed, false);
    assert.equal(result.plan.damageDistanceFeet, 30);
    assert.equal(result.plan.impact, 7);
    assert.equal(result.plan.stress, 6);
    assert.equal(f.messages.length, 3);
    assert.equal(f.calls.includes("confirm"), false);
    assert.equal(f.calls.includes("finish"), false);
    assert.equal(f.calls.filter(c => c === "roll").length, 1, "only impact dice roll");
    await resolveFallingDamage(f.actor, message);
    assert.equal(f.calls.filter(c => c === "roll").length, 1);
  }
});

test("uncontrolled fluid falls post subdual without lethal stress, while invalid or unconfirmed events do nothing", async () => {
  const f = fixture();
  f.actor.type = "npc";
  f.actor.system = { activeFeatNames: [] };
  for (const input of [
    { distanceFeet: 30, surface: "fluid" },
    { distanceFeet: NaN, surface: "fluid", confirmed: true }
  ])
    await assert.rejects(recordUncontrolledFall(f.actor, input));
  assert.deepEqual(f.calls, []);
  const { result } = await recordUncontrolledFall(f.actor, { distanceFeet: 30, surface: "fluid", confirmed: true });
  assert.equal(result.plan.kind, "subdual");
  assert.equal(result.plan.stress, 0);
  assert.equal(f.messages.length, 2);
  assert.equal(f.actor.statuses.has("sprawled"), true);
});
