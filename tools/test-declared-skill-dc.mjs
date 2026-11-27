import test from "node:test";
import assert from "node:assert/strict";
import {
  declareSkillDC,
  acquireDeclaredDC,
  validateDeclaredDC,
  recoverDeclaredDC,
  reviewDeclaredDCClaim,
  resolveDeclaredDC
} from "../module/apps/gc/declared-skill-dc.mjs";
import { applyUndo, declaredDCUndoReason } from "../module/apps/undo.mjs";
import {
  declaredDCRecord,
  declaredDCResult,
  declaredDCProof,
  declaredDCOutcome,
  declaredDCScope
} from "../module/rules/gc/declared-skill-dc.mjs";

const declaration = (extra = {}) =>
  declaredDCRecord({
    id: "dc1",
    actorUuid: "Actor.pc",
    skillKey: "medicine",
    checkId: "firstAid",
    baseDC: 15,
    scene: "scene1",
    session: "session1",
    ...extra
  });

test("a declared DC uses actual d12 results and the campaign DC before the die increase", () => {
  const r = {
    ...declaration({ policy: { version: 1, skillDC: -5, skillDCMinimum: 10, medicineDC: 5 } }),
    state: "ready",
    dice: [[12, 4]]
  };
  assert.deepEqual(declaredDCResult(r), { total: 16, dc: 31 });
  const proof = declaredDCProof(r, { sourceUuid: "ChatMessage.dc", claimId: "claim" });
  const check = {
    actorUuid: r.actorUuid,
    checkKind: "skill",
    skillKey: r.skillKey,
    checkId: r.checkId,
    effectiveTotal: 30,
    declaredSkillDC: proof
  };
  assert.deepEqual(declaredDCOutcome(check), { dc: 31, succeeded: false });
  assert.deepEqual(declaredDCOutcome({ ...check, effectiveTotal: 31 }), { dc: 31, succeeded: true });
  assert.throws(() => declaredDCOutcome({ ...check, declaredSkillDC: { ...proof, dc: 1 } }));
  assert.equal(declaredDCScope(r, { ...check, actorUuid: "Actor.other" }), false);
});

test("ordinary declarations allow one die; dramatic declarations allow three with both explosion faces", () => {
  assert.throws(() => declaration({ count: 2 }));
  const r = { ...declaration({ count: 3, dramatic: true }), state: "ready", dice: [[1, 12, 2], [4], [12, 5]] };
  assert.deepEqual(declaredDCResult(r), { total: 36, dc: 51 });
  assert.throws(() => declaration({ count: 4, dramatic: true }));
  assert.throws(() => declaredDCResult({ ...r, dice: [[1], [4], [2]] }));
  assert.throws(() => declaredDCResult({ ...r, dice: [[2, 3], [4], [2]] }));
  assert.throws(() => declaredDCResult({ ...r, dice: [[2], [4]] }));
});

test("recovery accepts only a final incomplete die prefix and never unused extra naturals", () => {
  const r = { ...declaration({ count: 3, dramatic: true }), state: "rolling", dice: [[4], [12, 1]] };
  assert.deepEqual(declaredDCResult(r, { complete: false }), { total: 17, dc: 32 });
  assert.throws(() => declaredDCResult(r));
  assert.throws(() => declaredDCResult({ ...r, dice: [[12], [3]] }, { complete: false }));
  assert.throws(() => declaredDCResult({ ...r, dice: [[13]] }, { complete: false }));
  assert.throws(() => declaredDCResult({ ...r, dice: [[2, 3]] }, { complete: false }));
});

test("DC proofs retain their actual identity and support Knowledge without accepting another skill", () => {
  const r = { ...declaration({ kind: "knowledge", checkId: "" }), state: "ready", dice: [[4]] },
    proof = declaredDCProof(r, { sourceUuid: "ChatMessage.dc", claimId: "claim" }),
    check = {
      actorUuid: r.actorUuid,
      checkKind: "knowledge",
      skillKey: r.skillKey,
      effectiveTotal: 19,
      declaredSkillDC: proof
    };
  assert.equal(declaredDCOutcome(check).succeeded, true);
  assert.throws(() => declaredDCOutcome({ ...check, skillKey: "athletics" }));
  assert.throws(() => declaredDCOutcome({ ...check, superseded: true }));
  assert.throws(() => declaredDCProof({ ...r, state: "rolling" }, proof));
});

function patch(doc, changes) {
  for (const [path, value] of Object.entries(changes)) {
    const keys = path.split(".");
    let at = doc;
    for (const key of keys.slice(0, -1)) at = at[key] ??= {};
    const key = keys.at(-1);
    if (key.startsWith("-=")) delete at[key.slice(2)];
    else at[key.replace(/^==/, "")] = structuredClone(value);
  }
}
function appContext({ dramatic = false } = {}) {
  let serial = 0,
    rng = 0,
    failReady = false;
  const values = [4],
    messages = [],
    settings = {
      usagePeriods: { scene: "scene1", session: "session1" },
      sceneState: { scene: "scene1", dramatic },
      gcActionDice: { session: "session1", value: 10 }
    },
    confirmed = [];
  messages.get = id => messages.find(m => m.id === id);
  const actor = {
    uuid: "Actor.pc",
    name: "PC",
    type: "agent",
    isOwner: true,
    system: { campaignEffects: {} },
    flags: {},
    async update(change) {
      patch(this, change);
    },
    async confirmCheckOutcome(message, opts) {
      confirmed.push(opts);
      patch(message, { "flags.spycraft2.successConfirmed": opts.succeeded });
    }
  };
  globalThis.game = {
    ready: false,
    user: { id: "gc", isGM: true },
    actors: [actor],
    messages,
    combats: [],
    settings: { get: (_s, k) => settings[k], set: async (_s, k, v) => (settings[k] = structuredClone(v)) }
  };
  globalThis.CONFIG = {
    SPYCRAFT: { skills: { medicine: { name: "Medicine", checks: [{ id: "firstAid", name: "First Aid" }] } } }
  };
  globalThis.fromUuid = async uuid => [actor, ...messages].find(d => d.uuid === uuid);
  globalThis.fromUuidSync = uuid => [actor, ...messages].find(d => d.uuid === uuid);
  globalThis.foundry = {
    utils: { escapeHTML: String, randomID: () => `id${++serial}` },
    applications: { api: { DialogV2: { input: async () => null, confirm: async () => true } } }
  };
  globalThis.ui = { notifications: { warn: () => null, error: () => null } };
  globalThis.ChatMessage = {
    getSpeaker: () => ({}),
    getWhisperRecipients: () => [{ id: "gc" }],
    create: async data => {
      const message = {
        ...structuredClone(data),
        id: `m${++serial}`,
        uuid: `ChatMessage.m${serial}`,
        isOwner: true,
        isAuthor: true,
        visible: true,
        async update(change) {
          if (failReady && change["flags.spycraft2.declaredDC"]?.state === "ready") throw Error("Ready write failed");
          patch(this, change);
        }
      };
      messages.push(message);
      return message;
    }
  };
  globalThis.Roll = class {
    async evaluate() {
      rng++;
      this.total = values.shift();
      return this;
    }
  };
  const ctx = { actor, checkKind: "skill", skillKey: "medicine", checkId: "firstAid", options: {}, phase: "before" };
  return {
    actor,
    ctx,
    values,
    messages,
    settings,
    confirmed,
    rng: () => rng,
    failReady: value => {
      failReady = value;
    },
    declare: extra => declareSkillDC({ actor, skillKey: "medicine", checkId: "firstAid", baseDC: 15, ...extra }),
    source: () => messages.find(m => m.flags.spycraft2.declaredDC),
    undo: () => messages.find(m => m.flags.spycraft2.undo),
    post: opts =>
      ChatMessage.create({
        flags: {
          spycraft2: {
            actorUuid: actor.uuid,
            checkKind: "skill",
            skillKey: "medicine",
            checkId: "firstAid",
            effectiveTotal: 18,
            rawTotal: 18,
            declaredSkillDC: opts.declaredSkillDC
          }
        }
      })
  };
}

test("the GC pays a fixed d12, and the next matching PC check claims and resolves its saved DC once", async () => {
  const t = appContext();
  await t.declare();
  assert.equal(t.settings.gcActionDice.value, 9);
  assert.equal(t.rng(), 1);
  assert.deepEqual(t.source().flags.spycraft2.declaredDC.dice, [[4]]);
  await assert.rejects(t.declare(), /existing DC declaration/);
  const acquire = acquireDeclaredDC(t.ctx);
  const check = await acquire(async opts => {
    await validateDeclaredDC({ ...t.ctx, options: opts });
    return t.post(opts);
  });
  assert.equal(check.flags.spycraft2.declaredSkillDC.dc, 19);
  assert.equal(acquireDeclaredDC(t.ctx), null);
  assert.match(declaredDCUndoReason(t.undo().flags.spycraft2.undo), /unused DC/);
  await assert.rejects(applyUndo(t.undo()), /unused DC/);
  await resolveDeclaredDC(t.actor, check);
  assert.equal(t.confirmed[0].succeeded, false);
  assert.equal(t.confirmed[0].difficultyClass, 19);
  await validateDeclaredDC({
    ...t.ctx,
    options: { declaredSkillDC: check.flags.spycraft2.declaredSkillDC, rerollOf: check.uuid }
  });
  await assert.rejects(
    validateDeclaredDC({ ...t.ctx, options: { declaredSkillDC: check.flags.spycraft2.declaredSkillDC } }),
    /Reserve the declared DC/
  );
  assert.equal(t.settings.gcActionDice.value, 9);
});

test("three dramatic DC dice use their actual exploding sequences, independent of NPC role dice", async () => {
  const t = appContext({ dramatic: true });
  t.actor.type = "npc";
  t.values.splice(0, 1, 1, 12, 3, 5, 12, 2);
  await t.declare({ count: 3 });
  assert.deepEqual(t.source().flags.spycraft2.declaredDC.dice, [[1, 12, 3], [5], [12, 2]]);
  assert.equal(t.settings.gcActionDice.value, 7);
  assert.equal(t.rng(), 6);
  assert.equal(declaredDCResult(t.source().flags.spycraft2.declaredDC).dc, 50);
  await assert.rejects(t.declare({ count: 4 }), /existing DC declaration/);
});

test("an unused declaration can be undone and refunded once, and its cancelled DC does not attach", async () => {
  const t = appContext();
  await t.declare();
  assert.equal(declaredDCUndoReason(t.undo().flags.spycraft2.undo), "");
  await applyUndo(t.undo());
  assert.equal(t.source().flags.spycraft2.declaredDC.state, "cancelled");
  assert.equal(t.settings.gcActionDice.value, 10);
  assert.equal(acquireDeclaredDC(t.ctx), null);
  await applyUndo(t.undo());
  assert.equal(t.settings.gcActionDice.value, 10);
});

test("a failed DC application holds its actual dice and payment; recovery does not reroll or recharge", async () => {
  const t = appContext();
  t.failReady(true);
  await assert.rejects(t.declare(), /Ready write failed/);
  assert.equal(t.settings.gcActionDice.value, 9);
  assert.equal(t.settings.gcActionDice.settlementReview.needsReview, true);
  assert.deepEqual(t.source().flags.spycraft2.declaredDC.dice, [[4]]);
  await assert.rejects(
    acquireDeclaredDC(t.ctx)(async opts => t.post(opts)),
    /Finish the GC/
  );
  t.failReady(false);
  await assert.rejects(
    recoverDeclaredDC(t.actor, t.source(), { confirmed: true, note: "Actual die checked", dice: [[3]] }),
    /retain every saved/
  );
  await recoverDeclaredDC(t.actor, t.source(), { confirmed: true, note: "Actual die checked", dice: [[4]] });
  assert.equal(t.settings.gcActionDice.value, 9);
  assert.notEqual(t.settings.gcActionDice.settlementReview?.needsReview, true);
  assert.equal(t.rng(), 1);
  assert.equal(t.source().flags.spycraft2.declaredDC.state, "ready");
});

test("a private declared DC blocks player rolls and forces a GC check to use GM visibility", async () => {
  const t = appContext();
  await t.declare({ public: false });
  game.user.isGM = false;
  await assert.rejects(
    acquireDeclaredDC(t.ctx)(async opts => t.post(opts)),
    /GC must roll/
  );
  game.user.isGM = true;
  await acquireDeclaredDC(t.ctx)(async opts => {
    assert.equal(opts.rollMode, "gmroll");
    await validateDeclaredDC({ ...t.ctx, options: opts });
    return t.post(opts);
  });
});

test("a lost posting response reconciles the actual card; deleted cards cannot release a consumed declaration", async () => {
  const t = appContext();
  await t.declare();
  await assert.rejects(
    acquireDeclaredDC(t.ctx)(async opts => {
      await validateDeclaredDC({ ...t.ctx, options: opts });
      await t.post(opts);
      throw Error("Response lost");
    }),
    /Response lost/
  );
  const id = t.source().flags.spycraft2.declaredDC.id;
  assert.equal(t.actor.flags.spycraft2.declaredDCs[id].state, "used");
  t.messages.pop();
  assert.equal(acquireDeclaredDC(t.ctx), null);
  await assert.rejects(applyUndo(t.undo()), /unused DC/);
});

test("an unknown failed check retains its claim until the GC reviews whether a roll actually happened", async () => {
  const t = appContext();
  await t.declare();
  await assert.rejects(
    acquireDeclaredDC(t.ctx)(async opts => {
      await validateDeclaredDC({ ...t.ctx, options: opts });
      throw Error("Unknown roll");
    }),
    /Unknown roll/
  );
  const id = t.source().flags.spycraft2.declaredDC.id;
  assert.equal(t.actor.flags.spycraft2.declaredDCs[id].state, "needsReview");
  await assert.rejects(
    acquireDeclaredDC(t.ctx)(async opts => t.post(opts)),
    /needs GC review/
  );
  await reviewDeclaredDCClaim(t.actor, t.source(), {
    outcome: "consumed",
    note: "Actual die reviewed; no replacement roll",
    confirmed: true
  });
  assert.equal(t.actor.flags.spycraft2.declaredDCs[id].state, "used");
  assert.equal(acquireDeclaredDC(t.ctx), null);
  assert.equal(t.rng(), 1);
});

test("an old declaration can be cleared without crediting a new session's pool", async () => {
  const t = appContext();
  await t.declare();
  t.settings.usagePeriods.session = "new-session";
  t.settings.gcActionDice = { session: "new-session", value: 20 };
  await assert.rejects(
    acquireDeclaredDC(t.ctx)(opts => t.post(opts)),
    /another scene or session/
  );
  await applyUndo(t.undo());
  assert.equal(t.settings.gcActionDice.value, 20);
  assert.equal(acquireDeclaredDC(t.ctx), null);
});

test("invalid natural results hold the payment without contaminating the saved prefix", async () => {
  const t = appContext();
  t.values.splice(0, 1, 13);
  await assert.rejects(t.declare(), /actual d12 result is unavailable/);
  assert.deepEqual(t.source().flags.spycraft2.declaredDC.dice, []);
  assert.equal(t.settings.gcActionDice.settlementReview.needsReview, true);
  await recoverDeclaredDC(t.actor, t.source(), {
    confirmed: true,
    note: "Actual die inspected independently",
    dice: [[4]]
  });
  assert.equal(t.settings.gcActionDice.value, 9);
  assert.equal(t.rng(), 1);
});

test("a ready DC with an interrupted payment cannot be claimed until that payment is reviewed", async () => {
  const t = appContext();
  t.failReady(true);
  await assert.rejects(t.declare());
  t.failReady(false);
  t.source().flags.spycraft2.declaredDC.state = "ready";
  await assert.rejects(
    acquireDeclaredDC(t.ctx)(opts => t.post(opts)),
    /held GC payment/
  );
  await recoverDeclaredDC(t.actor, t.source(), {
    confirmed: true,
    note: "Actual saved die and paid pool checked",
    dice: [[4]]
  });
  await acquireDeclaredDC(t.ctx)(async opts => {
    await validateDeclaredDC({ ...t.ctx, options: opts });
    return t.post(opts);
  });
  assert.equal(t.settings.gcActionDice.value, 9);
  assert.equal(t.rng(), 1);
});
