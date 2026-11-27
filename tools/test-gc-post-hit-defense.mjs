import test from "node:test";
import assert from "node:assert/strict";
import {
  beginNpcHitDefense,
  npcHitDefenseOutcome,
  addNpcHitDefenseDie,
  npcDefenseRerollProof,
  npcDefenseRerollOutcome
} from "../module/rules/gc/post-hit-defense.mjs";
import { attackOutcome } from "../module/rules/damage-application.mjs";
import {
  beginNpcDefenseReview,
  boostNpcHitDefense,
  reviewNpcHitDefense,
  recoverNpcHitDefense,
  validateNpcDefenseReroll
} from "../module/apps/gc/post-hit-defense.mjs";
import { applyUndo } from "../module/apps/undo.mjs";
import { actionDieBoostPlan } from "../module/rules/action-dice.mjs";
import { rollPipeline } from "../module/rules/roll-pipeline.mjs";
const check = (total = 18) => ({
  actorUuid: "Actor.attacker",
  checkKind: "attack",
  rawTotal: total,
  effectiveTotal: total,
  naturalDie: 12,
  threat: 20,
  error: 1,
  attackContext: {}
});
function start(c = check(), extra = {}) {
  const defense = 15,
    original = {
      targetUuid: "Actor.npc",
      targetName: "NPC",
      total: c.effectiveTotal,
      defense,
      cover: null,
      specialistDodge: 0,
      ...attackOutcome({ total: c.effectiveTotal, defense, fireAction: c.attackContext?.fireAction }),
      ...extra
    };
  return beginNpcHitDefense(c, original, {
    id: "review",
    attackerUuid: c.actorUuid,
    targetUuid: original.targetUuid,
    session: "s1",
    scene: "scene1"
  });
}
const boost = (id, rolls, die = 4) => ({
  id,
  sourceUuid: `ChatMessage.${id}`,
  die,
  rolls,
  total: rolls.reduce((sum, n) => sum + n, 0)
});

test("dramatic post-hit dice can turn a hit into a miss, apply only to this attack and preserve the original Defense", () => {
  const c = check(),
    review = start(c),
    first = addNpcHitDefenseDie(review, c, boost("a", [2]));
  assert.equal(npcHitDefenseOutcome(first, c).hit, true);
  const next = addNpcHitDefenseDie(first, c, boost("b", [2])),
    result = npcHitDefenseOutcome(next, c);
  assert.equal(result.defense, 19);
  assert.equal(result.hit, false);
  assert.equal(result.hits, 0);
  assert.equal(result.gcDefenseBoost.total, 4);
  assert.equal(review.original.defense, 15);
  assert.equal(review.boosts.length, 0);
  assert.deepEqual(addNpcHitDefenseDie(next, c, boost("b", [2])), next);
  assert.throws(() => addNpcHitDefenseDie(next, c, boost("c", [2])), /still hits/);
});

test("actual exploding dice are validated and a saved receipt cannot contribute twice", () => {
  const c = check(30),
    review = start(c),
    b = boost("a", [1, 4, 2]),
    next = addNpcHitDefenseDie(review, c, b);
  assert.equal(npcHitDefenseOutcome(next, c).gcDefenseBoost.total, 7);
  assert.deepEqual(addNpcHitDefenseDie(next, c, b), next);
  for (const invalid of [boost("b", [4]), boost("b", [2, 3]), boost("b", [0]), { ...b, total: 99 }, { ...b, die: 3 }])
    assert.throws(() => addNpcHitDefenseDie(review, c, invalid));
  assert.throws(() => addNpcHitDefenseDie(next, c, { ...b, rolls: [3], total: 3 }), /conflicts/);
});

test("failed attack rerolls retain paid Defense, including cumulative dice across further misses", () => {
  const c = check(18),
    r = npcHitDefenseOutcome(addNpcHitDefenseDie(start(c), c, boost("first", [4], 6)), c),
    source = { ...c, attackResolution: r, gcPostHitDefense: r.gcDefenseBoost, successConfirmed: false },
    proof = npcDefenseRerollProof(source, "ChatMessage.original");
  assert.equal(proof.resolution.defense, 19);
  assert.equal(proof.boost.total, 4);
  assert.equal(npcDefenseRerollOutcome(proof, check(20)).hit, true);
  const failed = {
      ...check(18),
      npcDefenseReroll: proof,
      successConfirmed: false,
      attackResolution: npcDefenseRerollOutcome(proof, check(18))
    },
    again = npcDefenseRerollProof(failed, "ChatMessage.reroll");
  assert.equal(again.boost.total, 4, "the earlier die is retained once");
  const nextCheck = { ...check(20), npcDefenseReroll: again },
    nextReview = beginNpcHitDefense(nextCheck, npcDefenseRerollOutcome(again, nextCheck), {
      id: "next",
      attackerUuid: c.actorUuid,
      targetUuid: "Actor.npc",
      session: "s1",
      scene: "scene1"
    }),
    nextResult = npcHitDefenseOutcome(addNpcHitDefenseDie(nextReview, nextCheck, boost("second", [2])), nextCheck),
    third = npcDefenseRerollProof(
      {
        ...nextCheck,
        attackResolution: nextResult,
        gcPostHitDefense: nextResult.gcDefenseBoost,
        successConfirmed: false
      },
      "ChatMessage.second"
    );
  assert.equal(third.resolution.defense, 21);
  assert.equal(third.boost.total, 6);
  assert.equal(third.boost.sources.length, 2);
  assert.throws(() => npcDefenseRerollProof({ ...source, successConfirmed: true }, "ChatMessage.source"));
  assert.throws(
    () =>
      npcDefenseRerollProof(
        { ...source, gcPostHitDefense: { ...r.gcDefenseBoost, feats: undefined } },
        "ChatMessage.legacy"
      ),
    /snapshot needs GC review/
  );
  assert.throws(() => npcDefenseRerollOutcome({ ...proof, targetUuid: "Actor.other" }, c));
});

test("increased Defense recalculates burst hits and whether cover alone caused the miss", () => {
  const c = check(20);
  c.attackContext.fireAction = { action: "twoShotBurst" };
  const review = start(c, { cover: { grade: 1, bonus: 2 } }),
    next = addNpcHitDefenseDie(review, c, boost("a", [4, 2]));
  const r = npcHitDefenseOutcome(next, c);
  assert.equal(r.defense, 21);
  assert.equal(r.hit, false);
  assert.equal(r.hitsCover, true);
  const low = check(18),
    noCoverHit = addNpcHitDefenseDie(start(low, { cover: { grade: 1, bonus: 2 } }), low, boost("a", [4, 2]));
  assert.equal(npcHitDefenseOutcome(noCoverHit, low).hitsCover, false);
});

test("a changed attack, completed result, superseded card or malformed decision stops the pending workflow", () => {
  const c = check(),
    review = start(c);
  for (const mutate of [
    r => r.effectiveTotal++,
    r => (r.actorUuid = "Actor.other"),
    r => (r.resolved = true),
    r => (r.superseded = true),
    r => (r.criticalSuccess = true)
  ]) {
    const changed = structuredClone(c);
    mutate(changed);
    assert.throws(() => npcHitDefenseOutcome(review, changed), /attack changed/);
  }
  for (const mutate of [
    r => (r.version = 9),
    r => (r.original.targetUuid = "Actor.other"),
    r => (r.original.defense = -1),
    r => (r.session = ""),
    r => (r.boosts = {})
  ]) {
    const broken = structuredClone(review);
    mutate(broken);
    assert.throws(() => npcHitDefenseOutcome(broken, c), /Review/);
  }
  assert.throws(() => start({ ...c, resolved: true }), /unresolved hit/);
});

let appSettings, appValues, appRng, appSerial, failReviewWrite, failFinalCleanup;
function patchDoc(doc, change) {
  for (const [path, value] of Object.entries(change)) {
    const keys = path.split(".");
    let at = doc;
    for (const key of keys.slice(0, -1)) at = at[key] ??= {};
    if (keys.at(-1).startsWith("-=")) delete at[keys.at(-1).slice(2)];
    else at[keys.at(-1).replace(/^==/, "")] = structuredClone(value);
  }
}
function appContext() {
  appSettings = {
    usagePeriods: { scene: "scene1", session: "s1" },
    sceneState: { scene: "scene1", dramatic: true },
    gcActionDice: { session: "s1", value: 10 }
  };
  appValues = [3];
  appRng = 0;
  appSerial = 0;
  failReviewWrite = false;
  failFinalCleanup = false;
  const confirmed = [],
    attacker = {
      uuid: "Actor.attacker",
      name: "Attacker",
      isOwner: true,
      type: "agent",
      system: { activeFeatNames: [], classLevels: {} },
      async confirmCheckOutcome(message, opts) {
        confirmed.push(opts.succeeded);
        await message.update({ "flags.spycraft2.successConfirmed": opts.succeeded });
      }
    },
    npc = {
      uuid: "Actor.npc",
      name: "NPC",
      type: "npc",
      isOwner: true,
      statuses: new Set(["flat-footed"]),
      system: { npcType: "standard", npcProfile: { enabled: false }, defense: { total: 10 } }
    },
    attack = {
      id: "attack",
      uuid: "ChatMessage.attack",
      isAuthor: true,
      isOwner: true,
      flags: { spycraft2: { ...check(12), formula: "1d20", rollData: {} } },
      async update(change) {
        if (failFinalCleanup && Object.hasOwn(change, "flags.spycraft2.-=npcDefensePending"))
          throw Error("Final cleanup write failed");
        if (failReviewWrite && change["flags.spycraft2.npcDefensePending"]?.boosts?.length)
          throw Error("Pending decision write failed");
        patchDoc(this, change);
      }
    },
    messages = [attack];
  messages.get = id => messages.find(m => m.id === id);
  globalThis.game = {
    ready: false,
    user: { id: "gc", isGM: true },
    actors: [attacker, npc],
    messages,
    combats: [],
    settings: { get: (_s, key) => appSettings[key], set: async (_s, key, v) => (appSettings[key] = structuredClone(v)) }
  };
  globalThis.fromUuid = async uuid => [attacker, npc, ...messages].find(d => d.uuid === uuid);
  globalThis.fromUuidSync = uuid => [attacker, npc, ...messages].find(d => d.uuid === uuid);
  globalThis.foundry = {
    utils: { escapeHTML: String, randomID: () => `id${++appSerial}` },
    applications: { api: { DialogV2: { input: async () => null, confirm: async () => true } } }
  };
  globalThis.ui = { notifications: { warn: () => null, error: () => null } };
  globalThis.ChatMessage = {
    getSpeaker: () => ({}),
    getWhisperRecipients: () => [{ id: "gc" }],
    create: async data => {
      const m = {
        ...structuredClone(data),
        id: `m${++appSerial}`,
        uuid: `ChatMessage.m${appSerial}`,
        isOwner: true,
        async update(change) {
          patchDoc(this, change);
        }
      };
      messages.push(m);
      return m;
    }
  };
  globalThis.Roll = class {
    async evaluate() {
      appRng++;
      this.total = appValues.shift();
      return this;
    }
  };
  const original = {
    targetUuid: npc.uuid,
    targetName: npc.name,
    defense: 10,
    total: 12,
    cover: null,
    specialistDodge: 0,
    hit: true,
    hits: 1,
    margin: 2
  };
  return {
    attacker,
    npc,
    attack,
    original,
    confirmed,
    source: () => [...messages].reverse().find(m => m.flags.spycraft2.gcDefenseDelivery),
    undo: () => [...messages].reverse().find(m => m.flags.spycraft2.undo)
  };
}
async function finish(ctx) {
  const { settleAttackResolution } = await import("../module/apps/damage-application.mjs");
  return reviewNpcHitDefense(ctx.attack, {
    action: "finalize",
    finalize: (r, target, id) => settleAttackResolution(ctx.attack, ctx.attacker, target, r, { npcDefenseReviewId: id })
  });
}

test("an initial hit waits without settling effects, and the GC may finalize it without spending dice", async () => {
  const ctx = appContext();
  await beginNpcDefenseReview(ctx.attack, ctx.attacker, ctx.npc, ctx.original);
  assert.equal(ctx.attack.flags.spycraft2.attackResolution, undefined);
  assert.equal(ctx.attack.flags.spycraft2.resolved, undefined);
  assert.equal(ctx.confirmed.length, 0);
  const result = await finish(ctx);
  assert.equal(result.hit, true);
  assert.deepEqual(ctx.confirmed, [true]);
  assert.equal(ctx.attack.flags.spycraft2.npcDefensePending, undefined);
  assert.equal(ctx.attack.flags.spycraft2.gcPostHitDefense.total, 0);
  assert.notEqual(ctx.attack.flags.spycraft2.resolved, true);
  assert.equal(appSettings.gcActionDice.value, 10);
  assert.equal(appRng, 0);
  const controls = rollPipeline.chatControls({
    message: ctx.attack,
    actor: ctx.attacker,
    check: ctx.attack.flags.spycraft2,
    user: game.user,
    checkKind: "attack"
  });
  assert.equal(
    controls.some(control => control.label?.includes("Resolve")),
    false
  );
  assert.equal(actionDieBoostPlan({}, ctx.attack.flags.spycraft2).blocked, true);
});

test("a failed final cleanup resumes the confirmed outcome without confirming or paying twice", async () => {
  const ctx = appContext();
  await beginNpcDefenseReview(ctx.attack, ctx.attacker, ctx.npc, ctx.original);
  failFinalCleanup = true;
  await assert.rejects(finish(ctx), /Final cleanup write failed/);
  assert.deepEqual(ctx.confirmed, [true]);
  assert.equal(ctx.attack.flags.spycraft2.npcDefensePending.state, "finalizing");
  failFinalCleanup = false;
  const result = await finish(ctx);
  assert.equal(result.hit, true);
  assert.deepEqual(ctx.confirmed, [true]);
  assert.equal(ctx.attack.flags.spycraft2.npcDefensePending, undefined);
  assert.equal(ctx.attack.flags.spycraft2.resolved, undefined);
  assert.equal(appSettings.gcActionDice.value, 10);
});

test("one post-hit die changes only the attack's Defense; a miss never triggers hit settlement or damage entitlement", async () => {
  const ctx = appContext();
  await beginNpcDefenseReview(ctx.attack, ctx.attacker, ctx.npc, ctx.original);
  await boostNpcHitDefense(ctx.attack);
  assert.equal(appSettings.gcActionDice.value, 9);
  assert.equal(ctx.npc.system.defense.total, 10);
  assert.equal(ctx.confirmed.length, 0);
  assert.equal(ctx.source().flags.spycraft2.gcDefenseDelivery.state, "complete");
  assert.deepEqual(ctx.source().flags.spycraft2.gcDefenseDelivery.rolls, [3]);
  const r = await finish(ctx);
  assert.equal(r.defense, 13);
  assert.equal(r.hit, false);
  assert.deepEqual(ctx.confirmed, [false]);
  assert.equal(ctx.npc.statuses.has("flat-footed"), true);
  assert.equal(ctx.attack.flags.spycraft2.attackResolution.hits, 0);
  assert.equal(ctx.attack.flags.spycraft2.gcPostHitDefense.total, 3);
  await assert.rejects(applyUndo(ctx.undo()), /still-pending attack/);
  assert.equal(appSettings.gcActionDice.value, 9);
});

test("pending Defense dice can be undone before settlement and their completed source cannot replay", async () => {
  const ctx = appContext();
  await beginNpcDefenseReview(ctx.attack, ctx.attacker, ctx.npc, ctx.original);
  await boostNpcHitDefense(ctx.attack);
  await applyUndo(ctx.undo());
  assert.equal(ctx.attack.flags.spycraft2.npcDefensePending.boosts.length, 0);
  assert.equal(appSettings.gcActionDice.value, 10);
  await recoverNpcHitDefense(ctx.npc, ctx.source(), {
    confirmed: true,
    results: "3",
    note: "Completed source checked"
  });
  assert.equal(ctx.attack.flags.spycraft2.npcDefensePending.boosts.length, 0);
  assert.equal(appRng, 1);
  assert.equal(appSettings.gcActionDice.value, 10);
});

test("a failed post-hit effect write holds the actual die and payment, and recovery applies it once", async () => {
  const ctx = appContext();
  await beginNpcDefenseReview(ctx.attack, ctx.attacker, ctx.npc, ctx.original);
  failReviewWrite = true;
  await assert.rejects(boostNpcHitDefense(ctx.attack), /Pending decision write failed/);
  assert.equal(appSettings.gcActionDice.settlementReview.needsReview, true);
  assert.equal(appSettings.gcActionDice.value, 9);
  assert.equal(ctx.source().flags.spycraft2.gcDefenseDelivery.state, "rolled");
  await assert.rejects(finish(ctx), /Recover/);
  failReviewWrite = false;
  await recoverNpcHitDefense(ctx.npc, ctx.source(), {
    confirmed: true,
    results: "3",
    note: "Actual die/payment checked"
  });
  assert.equal(ctx.attack.flags.spycraft2.npcDefensePending.boosts.length, 1);
  assert.equal(appSettings.gcActionDice.settlementReview.needsReview, false);
  assert.equal(appSettings.gcActionDice.value, 9);
  assert.equal(appRng, 1);
});

test("concurrent stale decisions cannot spend twice without reviewing the first die's result", async () => {
  const ctx = appContext();
  appValues = [2, 2];
  await beginNpcDefenseReview(ctx.attack, ctx.attacker, ctx.npc, ctx.original);
  const results = await Promise.allSettled([boostNpcHitDefense(ctx.attack), boostNpcHitDefense(ctx.attack)]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(ctx.attack.flags.spycraft2.npcDefensePending.boosts.length, 1);
  assert.equal(appSettings.gcActionDice.value, 9);
  assert.equal(appRng, 1);
  await boostNpcHitDefense(ctx.attack);
  assert.equal(appSettings.gcActionDice.value, 8);
  assert.equal(appRng, 2);
});

test("players may request the initial decision without reading a private NPC's rules, but only the GC spends", async () => {
  const ctx = appContext(),
    system = ctx.npc.system;
  game.user.isGM = false;
  ctx.npc.isOwner = false;
  Object.defineProperty(ctx.npc, "system", {
    configurable: true,
    get: () => {
      throw Error("Private NPC read");
    }
  });
  await beginNpcDefenseReview(ctx.attack, ctx.attacker, ctx.npc, ctx.original);
  await assert.rejects(boostNpcHitDefense(ctx.attack), /GC decides/);
  assert.equal(appSettings.gcActionDice.value, 10);
  assert.equal(appRng, 0);
  Object.defineProperty(ctx.npc, "system", { configurable: true, value: system });
});

test("replacement attacks ignore live Defense changes, keep the original payment and allow only new reaction dice", async () => {
  const ctx = appContext(),
    { resolveAttack } = await import("../module/apps/damage-application.mjs");
  await beginNpcDefenseReview(ctx.attack, ctx.attacker, ctx.npc, ctx.original);
  await boostNpcHitDefense(ctx.attack);
  await finish(ctx);
  const proof = npcDefenseRerollProof(ctx.attack.flags.spycraft2, ctx.attack.uuid),
    options = { npcDefenseReroll: proof, rerollOf: ctx.attack.uuid };
  await validateNpcDefenseReroll({ actor: ctx.attacker, options, checkKind: "attack" });
  await assert.rejects(
    validateNpcDefenseReroll({
      actor: ctx.attacker,
      options: { ...options, npcDefenseReroll: { ...proof, resolution: { ...proof.resolution, defense: 1 } } },
      checkKind: "attack"
    }),
    /retain its original/
  );
  const makeReplacement = (id, total, p) => ({
    id,
    uuid: `ChatMessage.${id}`,
    isAuthor: true,
    isOwner: true,
    flags: { spycraft2: { ...check(total), npcDefenseReroll: p } },
    async update(change) {
      patchDoc(this, change);
    }
  });
  const first = makeReplacement("replacement", 12, proof);
  game.messages.push(first);
  ctx.npc.system.defense.total = 99;
  await resolveAttack(first);
  assert.equal(first.flags.spycraft2.attackResolution.defense, 13);
  assert.equal(first.flags.spycraft2.attackResolution.hit, false);
  assert.equal(appSettings.gcActionDice.value, 9);
  const nextProof = npcDefenseRerollProof(first.flags.spycraft2, first.uuid),
    second = makeReplacement("next", 14, nextProof);
  game.messages.push(second);
  await resolveAttack(second);
  assert.equal(second.flags.spycraft2.npcDefensePending.original.defense, 13);
  appValues = [2];
  await boostNpcHitDefense(second);
  await finish({ ...ctx, attack: second });
  assert.equal(second.flags.spycraft2.attackResolution.defense, 15);
  assert.equal(second.flags.spycraft2.attackResolution.hit, false);
  assert.equal(appSettings.gcActionDice.value, 8);
  assert.equal(appRng, 2);
  assert.equal(npcDefenseRerollProof(second.flags.spycraft2, second.uuid).boost.total, 5);
});
