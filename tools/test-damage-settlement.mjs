import test from "node:test";
import assert from "node:assert/strict";
import { settlePendingDamageSave } from "../module/apps/damage-settlement.mjs";
import { damageSettlementPlan } from "../module/rules/damage-settlement.mjs";
import {
  reviewDamageLedgerPlan,
  damageLedgerEventPlan,
  damageLedgerSnapshot
} from "../module/rules/accumulated-damage.mjs";
import { damageSaveContext } from "../module/rules/damage-saves.mjs";
import { shakenStateFromActor } from "../module/rules/shaken.mjs";
import { criticalPlan } from "../module/rules/criticals.mjs";
let serial = 0;
const merge = (a, b) =>
  Object.fromEntries(
    Object.entries({ ...a, ...b }).map(([k, v]) => [
      k,
      b && Object.hasOwn(b, k)
        ? v && typeof v === "object" && !Array.isArray(v)
          ? merge(a?.[k], v)
          : structuredClone(v)
        : structuredClone(v)
    ])
  );
function actor() {
  globalThis.game = {
    ready: false,
    user: { isGM: true, id: "gc" },
    time: { worldTime: 0 },
    settings: { get: () => ({}) },
    spycraft2: {}
  };
  globalThis.foundry = {
    utils: { randomID: () => `id${++serial}`, escapeHTML: String },
    applications: { api: { DialogV2: { input: async () => null } } }
  };
  const a = {
    uuid: "Actor.shaken",
    type: "agent",
    isOwner: true,
    system: {},
    flags: {},
    effects: [],
    foreign: [],
    fail: null,
    receiptFail: null,
    createHook: null,
    receiptHook: null
  };
  const effect = d => {
    const data = { changes: [], disabled: false, ...structuredClone(d), _id: d._id ?? `effect${++serial}` };
    return {
      id: data._id,
      uuid: a.uuid + ".ActiveEffect." + data._id,
      name: data.name,
      flags: data.flags ?? {},
      statuses: new Set(data.statuses),
      changes: data.changes,
      active: !data.disabled,
      toObject() {
        return {
          ...structuredClone(data),
          name: this.name,
          statuses: [...this.statuses],
          flags: structuredClone(this.flags),
          changes: structuredClone(this.changes),
          disabled: !this.active
        };
      }
    };
  };
  Object.defineProperty(a, "appliedEffects", { get: () => [...a.effects, ...a.foreign].filter(e => e.active) });
  Object.defineProperty(a, "statuses", { get: () => new Set(a.appliedEffects.flatMap(e => [...e.statuses])) });
  a.add = d => {
    const e = effect(d);
    a.effects.push(e);
    return e;
  };
  a.createEmbeddedDocuments = async (type, rows) => {
    if (a.fail === "createBefore") throw Error("creation rejected");
    const made = rows.map(a.add);
    await a.createHook?.(made);
    if (a.fail === "createAfter") throw Error("creation committed then failed");
    return made;
  };
  a.deleteEmbeddedDocuments = async (type, ids) => {
    if (a.fail === "deleteBefore") throw Error("deletion rejected");
    a.effects = a.effects.filter(e => !ids.includes(e.id));
    if (a.fail === "deleteAfter") throw Error("deletion committed then failed");
  };
  a.update = async patch => {
    await a.receiptHook?.(patch);
    if (a.receiptFail === "before") throw Error("receipt rejected");
    for (const [path, value] of Object.entries(patch)) {
      const keys = path.split(".");
      let o = a;
      for (const key of keys.slice(0, -1)) o = o[key] ??= {};
      if (keys.at(-1).startsWith("==")) {
        o[keys.at(-1).slice(2)] = structuredClone(value);
        continue;
      }
      o[keys.at(-1)] =
        value && typeof value === "object" && !Array.isArray(value)
          ? merge(o[keys.at(-1)], value)
          : structuredClone(value);
    }
    if (a.receiptFail === "after") {
      a.receiptFail = null;
      throw Error("receipt committed then failed");
    }
  };
  return a;
}
function pending({
  kind = "stress",
  damage = 13,
  criticalHit = false,
  succeeded = false,
  result = succeeded ? 20 : 5,
  existingGrade = 0
} = {}) {
  const a = actor();
  a.system = {
    stressThreshold: 12,
    subdualThreshold: 14,
    actionDice: { value: 2 },
    vitality: { value: 4 },
    wounds: { value: 4 }
  };
  if (existingGrade)
    a.add({
      name: "Existing Shaken",
      statuses: ["shaken-" + existingGrade],
      flags: { spycraft2: { shakenGrade: existingGrade, shakenSelfInflicted: false } }
    });
  const empty = { ledger: null, events: {} },
    base = reviewDamageLedgerPlan(
      empty,
      empty,
      { stress: 0, subdual: 0, note: "GC actual totals", confirmed: true },
      "review",
      "gc",
      0
    );
  a.system.accumulatedDamage = base.ledger;
  const snap = damageLedgerSnapshot(a),
    p = damageLedgerEventPlan(
      a.system,
      snap,
      snap,
      { source: "source-one", kind, newDamage: damage, criticalHit, confirmed: true },
      "event1",
      0
    );
  a.system.accumulatedDamage = p.ledger;
  a.flags.spycraft2 ??= {};
  a.flags.spycraft2.damageEvents = { event1: p.record };
  const context = damageSaveContext(p.record, "rollReceipt", 0),
    m = {
      id: "save",
      uuid: "ChatMessage.save",
      flags: {
        spycraft2: {
          actorUuid: a.uuid,
          checkKind: "save",
          checkId: p.record.save.key,
          damageSave: context,
          formula: "1d20 + @total",
          rollData: { total: 3 },
          rawTotal: result,
          effectiveTotal: result,
          naturalDie: 2,
          successConfirmed: succeeded,
          resolved: true
        }
      }
    };
  p.record.saveMessageId = m.id;
  p.record.saveReceiptId = context.receiptId;
  game.messages = [m];
  return { a, m };
}
const confirm = { confirmed: true, selfInflicted: false };
test("a finished failed stress save applies its table grade once, preserves existing Shaken sources and clears only its pending save", async () => {
  const { a } = pending({ existingGrade: 1 }),
    before = structuredClone(a.system),
    r = await settlePendingDamageSave(a, confirm);
  assert.equal(r.state, "settled");
  assert.equal(r.settlement.grade, 1);
  assert.equal(shakenStateFromActor(a).totalGrade, 2);
  assert.equal(a.effects.length, 2);
  assert.equal(a.system.accumulatedDamage.stress, 13);
  assert.deepEqual(a.system.accumulatedDamage.pending, []);
  assert.deepEqual(a.system.actionDice, before.actionDice);
  assert.deepEqual(a.system.vitality, before.vitality);
  assert.deepEqual(a.system.wounds, before.wounds);
  const again = await settlePendingDamageSave(a, { ...confirm, eventId: "event1" });
  assert.equal(again.settlement.id, r.settlement.id);
  assert.equal(a.effects.length, 2);
});
test("every failed ordinary stress band I–IV applies its actual grade and retains explicit self-inflicted provenance", async () => {
  for (let grade = 1; grade <= 4; grade++) {
    const { a } = pending({ damage: grade * 12 + 1 });
    await settlePendingDamageSave(a, { confirmed: true, selfInflicted: true });
    assert.equal(shakenStateFromActor(a).totalGrade, grade);
    assert.equal(a.effects[0].flags.spycraft2.shakenSelfInflicted, true);
    assert.equal(a.flags.spycraft2.shakenApplications["damage-event1"].grade, grade);
  }
});
test("successful stress/subdual saves including the critical and fifth bands clear pending receipts without conditions or healing", async () => {
  for (const opts of [
    {},
    { kind: "subdual", damage: 15 },
    { kind: "stress", damage: 1, criticalHit: true },
    { kind: "stress", damage: 61 },
    { kind: "subdual", damage: 71 }
  ]) {
    const { a } = pending({ ...opts, succeeded: true, result: 40 }),
      total = a.system.accumulatedDamage[opts.kind ?? "stress"];
    await settlePendingDamageSave(a, { confirmed: true });
    assert.equal(a.effects.length, 0);
    assert.equal(a.system.accumulatedDamage.pending.length, 0);
    assert.equal(a.system.accumulatedDamage[opts.kind ?? "stress"], total);
  }
});
test("unconfirmed, unfinished, contradictory or unsupported critical save results cannot begin settlement", async () => {
  for (const change of [
    m => (m.flags.spycraft2.successConfirmed = null),
    m => (m.flags.spycraft2.resolved = false),
    m => (m.flags.spycraft2.successConfirmed = true),
    m => (m.flags.spycraft2.criticalFailure = true),
    m => (m.flags.spycraft2.criticalSuccess = true)
  ]) {
    const { a, m } = pending();
    change(m);
    await assert.rejects(settlePendingDamageSave(a, confirm));
    assert.equal(a.flags.spycraft2.damageEvents.event1.state, "pending");
    assert.equal(a.effects.length, 0);
  }
  const { a, m } = pending();
  assert.throws(
    () => damageSettlementPlan(a.flags.spycraft2.damageEvents.event1, m, { confirmed: true }, "settlement", 0),
    /own action/
  );
});
test("a failed subdual save knocks the agent out for the band's unit times half the margin, once", async () => {
  globalThis.CONFIG = { statusEffects: [{ id: "unconscious", name: "Unconscious" }] };
  try {
    // 15 subdual over a threshold of 14 is band I: DC 12, 1 round; a result of 5 fails by 7, so 3 rounds.
    const { a } = pending({ kind: "subdual", damage: 15 });
    const r = await settlePendingDamageSave(a, confirm);
    assert.equal(r.state, "settled");
    assert.equal(r.settlement.unconscious, true);
    assert.deepEqual(r.settlement.knockout, { count: 3, unit: "round" });
    assert.ok(a.statuses.has("unconscious"));
    assert.equal(a.effects.length, 1);
    assert.deepEqual(a.system.accumulatedDamage.pending, []);
    await settlePendingDamageSave(a, { ...confirm, eventId: "event1" });
    assert.equal(a.effects.length, 1);
  } finally {
    delete globalThis.CONFIG;
  }
});
test("cancelled Drained review and unresolved critical outcomes stay pending; legacy GC manual settlement remains", async () => {
  for (const opts of [{ damage: 61 }, { damage: 1, criticalHit: true }]) {
    const { a } = pending(opts);
    if (opts.damage === 61) {
      a.items = [];
      a.system.progression = [{ classId: "test" }];
      assert.equal(await settlePendingDamageSave(a, confirm), null);
    } else await assert.rejects(settlePendingDamageSave(a, confirm), /by hand/);
    assert.equal(a.effects.length, 0);
    assert.equal(a.flags.spycraft2.damageEvents.event1.state, "pending");
    assert.equal(a.system.accumulatedDamage.pending.length, 1);
    const r = await settlePendingDamageSave(a, { ...confirm, outcomeHandled: true });
    assert.equal(r.state, "settled");
    assert.equal(r.settlement.handledByGC, true);
    assert.equal(a.effects.length, 0);
    assert.deepEqual(a.system.accumulatedDamage.pending, []);
  }
});

test("a tier-five stress settlement applies one retained Drained build and resumes without losing another level", async () => {
  const { a } = pending({ damage: 61 });
  globalThis.ChatMessage = { create: async data => data, getSpeaker: () => ({}) };
  a.items = [];
  a.system.progression = [{ classId: "test" }, { classId: "test" }];
  foundry.applications.api.DialogV2.input = async () => ({
    confirmed: true,
    source: "Actual stress event",
    note: "Confirmed retained options and other effects",
    lifestyle: 0,
    possessions: 0,
    spendingCash: 0
  });
  const result = await settlePendingDamageSave(a, confirm);
  assert.equal(result.state, "settled");
  assert.equal(result.settlement.drainedApplied, true);
  assert.equal(a.flags.spycraft2.drained.levels, 1);
  assert.equal(a.flags.spycraft2.drained.applications["damage-event1"].applied, 1);
  assert.equal(a.system.progression.length, 2);
  await settlePendingDamageSave(a, { ...confirm, eventId: "event1" });
  assert.equal(a.flags.spycraft2.drained.levels, 1);
});

test("a changed actual stress save invalidates its open Drained form before any level is suspended", async () => {
  const { a, m: message } = pending({ damage: 61 });
  a.items = [];
  a.system.progression = [{ classId: "test" }, { classId: "test" }];
  foundry.applications.api.DialogV2.input = async () => {
    message.flags.spycraft2.effectiveTotal += 1;
    return {
      confirmed: true,
      source: "Actual stress event",
      note: "Stale original save",
      lifestyle: 0,
      possessions: 0,
      spendingCash: 0
    };
  };
  await assert.rejects(settlePendingDamageSave(a, confirm), /original stress save/);
  assert.equal(a.flags.spycraft2.drained, undefined);
});

test("an inconsistent finished stress outcome is refused before offering or applying Drained", async () => {
  const { a, m } = pending({ damage: 61 });
  a.items = [];
  a.system.progression = [{ classId: "test" }, { classId: "test" }];
  m.flags.spycraft2.effectiveTotal = 40;
  let forms = 0;
  foundry.applications.api.DialogV2.input = async () => {
    forms++;
    return null;
  };
  await assert.rejects(settlePendingDamageSave(a, confirm), /disagrees/);
  assert.equal(forms, 0);
  assert.equal(a.flags.spycraft2.drained, undefined);
});
test("an interrupted final ledger commit resumes the exact Shaken application without applying the grade twice", async () => {
  const { a } = pending();
  a.receiptHook = async patch => {
    if (patch["system.accumulatedDamage"]) a.receiptFail = "before";
  };
  await assert.rejects(settlePendingDamageSave(a, confirm), /receipt rejected/);
  assert.equal(a.flags.spycraft2.damageEvents.event1.state, "settling");
  assert.equal(a.effects.length, 1);
  assert.equal(shakenStateFromActor(a).totalGrade, 1);
  a.receiptHook = null;
  a.receiptFail = null;
  await settlePendingDamageSave(a, confirm);
  assert.equal(a.effects.length, 1);
  assert.equal(a.system.accumulatedDamage.pending.length, 0);
  const second = pending();
  second.a.createHook = async () => {
    second.m.flags.spycraft2.effectiveTotal = 20;
    second.m.flags.spycraft2.successConfirmed = true;
  };
  await assert.rejects(settlePendingDamageSave(second.a, confirm), /changed/);
  assert.equal(second.a.effects.length, 1);
  assert.equal(second.a.flags.spycraft2.damageEvents.event1.state, "settling");
  second.a.createHook = null;
  second.m.flags.spycraft2.effectiveTotal = 5;
  second.m.flags.spycraft2.successConfirmed = false;
  await settlePendingDamageSave(second.a, confirm);
  assert.equal(second.a.effects.length, 1);
});
test("an interrupted condition creation preserves the prepared plan, and changed finished evidence or source details block a changed retry", async () => {
  let { a, m } = pending();
  a.fail = "createBefore";
  await assert.rejects(settlePendingDamageSave(a, confirm), /creation rejected/);
  assert.equal(a.flags.spycraft2.damageEvents.event1.state, "settling");
  assert.equal(a.effects.length, 0);
  a.fail = null;
  m.flags.spycraft2.rawTotal = 6;
  await assert.rejects(settlePendingDamageSave(a, confirm), /changed/);
  assert.equal(a.effects.length, 0);
  ({ a, m } = pending());
  a.fail = "createBefore";
  await assert.rejects(settlePendingDamageSave(a, { confirmed: true, selfInflicted: true }));
  a.fail = null;
  await assert.rejects(settlePendingDamageSave(a, confirm), /original settlement/);
  await settlePendingDamageSave(a, { confirmed: true, selfInflicted: true });
  assert.equal(a.effects.length, 1);
});
test("lost write responses after committed staging, condition receipt and finalization retain one completed settlement", async () => {
  const { a } = pending();
  a.receiptFail = "after";
  const r = await settlePendingDamageSave(a, confirm);
  assert.equal(r.state, "settled");
  assert.equal(a.effects.length, 1);
  assert.equal(a.system.accumulatedDamage.pending.length, 0);
});
test("concurrent settlement requests complete one condition application and one ledger revision", async () => {
  const { a } = pending(),
    before = a.system.accumulatedDamage.revision,
    [one, two] = await Promise.all([settlePendingDamageSave(a, confirm), settlePendingDamageSave(a, confirm)]);
  assert.equal(one.settlement.id, two.settlement.id);
  assert.equal(a.effects.length, 1);
  assert.equal(a.system.accumulatedDamage.revision, before + 1);
});
test("ownership, secret-result permissions and cancelled settlement confirmation leave damage and conditions intact", async () => {
  let { a, m } = pending();
  a.isOwner = false;
  assert.equal(await settlePendingDamageSave(a, confirm), null);
  a.isOwner = true;
  m.blind = true;
  game.user.isGM = false;
  await assert.rejects(settlePendingDamageSave(a, confirm), /secret/);
  assert.equal(a.effects.length, 0);
  ({ a, m } = pending());
  assert.equal(await settlePendingDamageSave(a), null);
  assert.equal(a.effects.length, 0);
  assert.equal(a.flags.spycraft2.damageEvents.event1.state, "pending");
});
test("ordinary saves cannot activate critical results while One in a Million retains its explicit Fortitude exception", () => {
  const opts = { kind: "success", baseCost: 1, effect: "GC effect", effectConfirmed: true, available: 2 },
    ordinary = { checkKind: "save", checkId: "fort", threatConfirmed: true, naturalDie: 20 };
  assert.equal(criticalPlan({}, ordinary, opts).blocked, true);
  assert.equal(criticalPlan({}, { ...ordinary, oneInAMillion: true, forcedThreat: true }, opts).blocked, false);
  assert.equal(
    criticalPlan({}, { ...ordinary, oneInAMillion: true, forcedThreat: true, checkId: "will" }, opts).blocked,
    true
  );
  assert.equal(
    criticalPlan(
      {},
      { ...ordinary, errorConfirmed: true },
      { ...opts, kind: "failure", samePayer: false, opponent: true, lineOfSight: true }
    ).blocked,
    true
  );
});
