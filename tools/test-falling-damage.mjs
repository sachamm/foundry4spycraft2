import test from "node:test";
import assert from "node:assert/strict";
import { fallDistancePlan } from "../module/rules/fall-distance.mjs";
import { fallingDamagePlan } from "../module/rules/falling-damage.mjs";
import { resolveFallingDamage, recordUncontrolledFall } from "../module/apps/falling-damage.mjs";
import { quickApplyInput } from "../module/apps/damage-application.mjs";
import { campaignFallingDamageDivisor } from "../module/rules/campaign-combat.mjs";
import { trackFall, currentFall, reviewFallTiming } from "../module/apps/falling-time.mjs";

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

test("falling stress combines Wire Fu with the saved campaign factors before rounding, without multiplying impact for Tense", () => {
  const p = proof(35);
  const plan = fallingDamagePlan(p, {
    result: 19,
    dice: [6, 4, 3],
    damageDivisor: 2,
    stressCampaignPolicy: { multipliers: [2], minimum: 0 }
  });
  assert.equal(plan.impact, 6);
  assert.equal(plan.stress, 9);
  const both = fallingDamagePlan(p, {
    result: 19,
    dice: [6, 4, 3],
    damageDivisor: 2,
    stressCampaignPolicy: { multipliers: [2, 0.5], minimum: 1 }
  });
  assert.equal(both.stress, 6);
});
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

function fixture(total = 10, feet = 30) {
  const messages = [],
    calls = [];
  globalThis.game = { ready: false, user: { isGM: true, id: "gc" }, messages, settings: { get: () => ({}) } };
  let serial = 0;
  globalThis.foundry = { utils: { randomID: () => `id${++serial}`, escapeHTML: String } };
  globalThis.CONFIG = { statusEffects: [{ id: "sprawled", name: "Sprawled" }] };
  globalThis.Roll = class {
    async evaluate() {
      calls.push("roll");
      this.dice = [
        {
          results: Array.from({ length: Math.min(20, Math.floor(feet / 10)) }, (_, i) => ({
            result: [6, 4, 3][i % 3],
            active: true
          }))
        }
      ];
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
    fallDistance: proof(feet)
  };
  const message = {
    uuid: "ChatMessage.fall",
    flags: { spycraft2: check },
    async update(patch) {
      if (patch["flags.spycraft2.fallTimelineId"])
        this.flags.spycraft2.fallTimelineId = patch["flags.spycraft2.fallTimelineId"];
    }
  };
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

test("Wire Fu halves both impact and lethal-fall stress after distance and per-die reductions, rounded down", () => {
  const plan = fallingDamagePlan(proof(35), { result: 19, dice: [6, 4, 3], damageDivisor: 2 });
  assert.equal(plan.impact, 6);
  assert.equal(plan.stress, 3);
  assert.equal(plan.armorPiercing, 3);
  assert.equal(plan.diceCount, 3);
  assert.equal(plan.sprawled, true);
  const reduced = fallingDamagePlan(proof(60, { activeFeatNames: ["Spider Mastery"], classLevels: { stuntman: 4 } }), {
    result: 24,
    dice: [1, 2, 3, 4, 5, 6],
    damageDivisor: 2
  });
  assert.equal(reduced.impact, 3);
  assert.equal(reduced.stress, 6);
  assert.equal(reduced.checkReduction, 6);
  const fluid = fallingDamagePlan(proof(30), { surface: "fluid", result: 19, dice: [6, 4, 3], damageDivisor: 2 });
  assert.equal(fluid.impact, 6);
  assert.equal(fluid.stress, 0);
  const minimal = fallingDamagePlan(proof(10), { result: 24, dice: [1], damageDivisor: 2 });
  assert.equal(minimal.impact, 0);
  assert.throws(() => fallingDamagePlan(proof(35), { result: 19, dice: [6, 4, 3], damageDivisor: 0 }));
});
test("Wire Fu covers PCs, special characters and current promotions; ordinary NPCs retain ordinary damage", () => {
  const effects = { fallingDamageDivisor: 2 };
  assert.equal(campaignFallingDamageDivisor({ type: "agent", system: {} }, effects), 2);
  for (const npcType of ["special", "villain"])
    assert.equal(campaignFallingDamageDivisor({ type: "npc", system: { npcType } }, effects), 2);
  for (const npcType of ["standard", "animal"])
    assert.equal(campaignFallingDamageDivisor({ type: "npc", system: { npcType } }, effects), 1);
  const npc = {
    type: "npc",
    system: { npcType: "standard", promotion: { mission: "m" }, usagePeriods: { mission: "m" } }
  };
  assert.equal(campaignFallingDamageDivisor(npc, effects), 2);
  npc.system.usagePeriods.mission = "next";
  assert.equal(campaignFallingDamageDivisor(npc, effects), 1);
  assert.equal(campaignFallingDamageDivisor({ type: "agent", system: {} }, {}), 1);
});
test("the actual falling controller saves Wire Fu with both applicable cards and retains it after a campaign change", async () => {
  const f = fixture();
  f.actor.type = "agent";
  game.settings.get = (_namespace, key) => (key === "campaign" ? { qualities: ["wire-fu"] } : {});
  const result = await resolveFallingDamage(f.actor, f.message, landing);
  assert.equal(result.context.damageDivisor, 2);
  assert.equal(result.plan.impact, 6);
  assert.equal(result.plan.stress, 3);
  assert.equal(f.messages[0].flags.spycraft2.effectiveTotal, 6);
  assert.equal(f.messages[1].flags.spycraft2.effectiveTotal, 3);
  assert.match(f.messages[0].content, /Wire Fu/);
  game.settings.get = () => ({});
  assert.deepEqual(await resolveFallingDamage(f.actor, f.message, landing), result);
  assert.equal(f.calls.filter(c => c === "roll").length, 1);
});
test("an interrupted Wire Fu settlement recovers under its saved policy after the quality ends", async () => {
  const f = fixture();
  f.actor.type = "agent";
  game.settings.get = (_namespace, key) => (key === "campaign" ? { qualities: ["wire-fu"] } : {});
  const create = ChatMessage.create;
  let failed = false;
  ChatMessage.create = async data => {
    if (!failed) {
      failed = true;
      throw Error("chat write rejected");
    }
    return create(data);
  };
  await assert.rejects(resolveFallingDamage(f.actor, f.message, landing), /chat write rejected/);
  game.settings.get = () => ({});
  ChatMessage.create = create;
  const result = await resolveFallingDamage(f.actor, f.message, landing);
  assert.equal(result.plan.impact, 6);
  assert.equal(result.plan.stress, 3);
  assert.equal(f.calls.filter(c => c === "roll").length, 1);
});

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

function timedFixture(feet = 160) {
  const f = fixture(10, feet);
  f.actor.type = "agent";
  f.actor.system = { activeFeatNames: [], classLevels: {} };
  const combat = { id: "fight", started: true, round: 2, combatant: { initiative: 37 } };
  game.combat = combat;
  game.combats = new Map([[combat.id, combat]]);
  game.time = { worldTime: 0 };
  return { ...f, combat };
}

test("tracked combat falls block early RNG, land at the triggering Count and consume one landing identity", async () => {
  const f = timedFixture();
  await trackFall(f.actor, { feet: 160, confirmed: true });
  await assert.rejects(() => trackFall(f.actor, { feet: 160, confirmed: true }), /existing fall/);
  await assert.rejects(() => resolveFallingDamage(f.actor, f.message, landing), /Landing:/);
  assert.equal(f.calls.length, 0);
  f.combat.round = 3;
  f.combat.combatant.initiative = 38;
  await assert.rejects(() => resolveFallingDamage(f.actor, f.message, landing), /Landing:/);
  f.combat.combatant.initiative = 36;
  await resolveFallingDamage(f.actor, f.message, landing);
  assert.equal(currentFall(f.actor).state, "landed");
  assert.equal(f.calls.filter(c => c === "roll").length, 1);
  const duplicate = { ...f.message, uuid: "ChatMessage.other", flags: structuredClone(f.message.flags) };
  await assert.rejects(() => resolveFallingDamage(f.actor, duplicate, landing), /different landing result/);
  await resolveFallingDamage(f.actor, f.message, landing);
  assert.equal(f.calls.filter(c => c === "roll").length, 1);
});

test("lost final timing write resumes completion without another damage roll", async () => {
  const f = timedFixture(30);
  await trackFall(f.actor, { feet: 30, confirmed: true });
  const update = f.actor.update.bind(f.actor);
  let fail = true;
  f.actor.update = async patch => {
    if (fail && Object.values(patch).some(value => value?.state === "landed")) {
      fail = false;
      throw Error("timing write refused");
    }
    return update(patch);
  };
  await assert.rejects(() => resolveFallingDamage(f.actor, f.message, landing), /timing write refused/);
  assert.equal(currentFall(f.actor).state, "landing");
  await resolveFallingDamage(f.actor, f.message, landing);
  assert.equal(currentFall(f.actor).state, "landed");
  assert.equal(f.calls.filter(c => c === "roll").length, 1);
});

test("ended combats require GC timing review; catches never settle their saved landing", async () => {
  const f = timedFixture();
  await trackFall(f.actor, { feet: 160, confirmed: true });
  f.message.flags.spycraft2.fallTimelineId = currentFall(f.actor).id;
  f.combat.started = false;
  game.time.worldTime = 999;
  await assert.rejects(() => resolveFallingDamage(f.actor, f.message, landing), /original combat or clock/);
  game.user.isGM = false;
  await assert.rejects(
    () => reviewFallTiming(f.actor, { decision: "due", note: "Reviewed", confirmed: true }),
    /owning GC/
  );
  game.user.isGM = true;
  await reviewFallTiming(f.actor, { decision: "caught", note: "Caught before impact", confirmed: true });
  await assert.rejects(() => resolveFallingDamage(f.actor, f.message, landing), /ended before impact/);
  assert.equal(f.calls.length, 0);
});

test("positive timing writes with lost responses are retained and GC due review permits the original result", async () => {
  const f = timedFixture();
  const update = f.actor.update.bind(f.actor);
  f.actor.update = async patch => {
    await update(patch);
    throw Error("response lost");
  };
  await trackFall(f.actor, { feet: 160, confirmed: true });
  assert.equal(currentFall(f.actor).feet, 160);
  f.combat.started = false;
  await reviewFallTiming(f.actor, {
    decision: "due",
    note: "Original combat ended after landing time",
    confirmed: true
  });
  await resolveFallingDamage(f.actor, f.message, landing);
  assert.equal(currentFall(f.actor).state, "landed");
  assert.equal(f.calls.filter(c => c === "roll").length, 1);
});
