import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { accumulatedDamagePlan as plan } from "../module/rules/accumulated-damage.mjs";
import { checkAccumulatedDamage } from "../module/apps/accumulated-damage.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const system = () => ({
    stressThreshold: 12,
    subdualThreshold: 10,
    abilities: { wis: { value: 12 }, con: { value: 10 } },
    actionDice: { value: 3 },
    vitality: { value: 4 },
    wounds: { value: 4 }
  }),
  input = { kind: "stress", currentDamage: 0, newDamage: 1, confirmed: true };
test("every stress/subdual threshold uses strictly exceeded multiples, highest band DC and a five-band cap", () => {
  for (const kind of ["stress", "subdual"])
    for (let threshold = 1; threshold <= 40; threshold++)
      for (let tier = 1; tier <= 6; tier++) {
        const sys = { ...system(), [kind + "Threshold"]: threshold },
          at = plan(sys, { ...input, kind, newDamage: threshold * tier }),
          over = plan(sys, { ...input, kind, newDamage: threshold * tier + 1 });
        assert.equal(at.tier, Math.min(5, tier - 1));
        assert.equal(over.tier, Math.min(5, tier));
        assert.equal(at.dc, at.tier ? 8 + 4 * at.tier : null);
        assert.equal(over.dc, 8 + 4 * over.tier);
        assert.equal(over.saveKey, kind === "stress" ? "will" : "fort");
      }
});
test("each positive damage event requires a save in an already exceeded band; no new damage does not repeat a save", () => {
  assert.equal(plan(system(), { ...input, currentDamage: 28, newDamage: 1 }).dc, 16);
  assert.equal(plan(system(), { ...input, currentDamage: 28, newDamage: 0 }).saveRequired, false);
  assert.equal(plan(system(), { ...input, currentDamage: 28, newDamage: 0, criticalHit: true }).saveRequired, false);
  assert.equal(plan(system(), { ...input, currentDamage: 10, newDamage: 18 }).failureOutcome, "Shaken II");
  assert.equal(plan(system(), { ...input, newDamage: 1000 }).failureOutcome, "Drained (1 level)");
});
test("critical hits force DC16 below the first threshold or add four to the highest exceeded band without inventing an unlisted failure outcome", () => {
  for (const kind of ["stress", "subdual"])
    for (const newDamage of [1, 10, 12, 13, 21, 100]) {
      const p = plan(system(), { ...input, kind, newDamage, criticalHit: true });
      assert.equal(p.saveRequired, true);
      assert.equal(p.dc, p.tier ? 12 + 4 * p.tier : 16);
      assert.equal(p.needsOutcomeReview, p.tier === 0);
      if (!p.tier) assert.equal(p.failureOutcome, null);
    }
});
test("subdual lists the actual base knockout durations and separate failure-margin multiplier; zero thresholds remain bounded", () => {
  for (const [tier, duration] of ["1 round", "1 minute", "1 hour", "1 day", "1 week"].entries()) {
    const p = plan(system(), { ...input, kind: "subdual", newDamage: (tier + 1) * 10 + 1 });
    assert.equal(p.knockoutBase, duration);
    assert.equal(p.failureOutcome, "Unconscious");
  }
  for (const kind of ["stress", "subdual"]) {
    const sys = { [kind + "Threshold"]: 0 };
    assert.equal(plan(sys, { ...input, kind, newDamage: 0 }).tier, 0);
    assert.equal(plan(sys, { ...input, kind, newDamage: 1 }).tier, 5);
    assert.equal(plan(sys, { ...input, kind, newDamage: 1 }).dc, 28);
  }
});
test("actual prepared Iron Will thresholds include both derived +3 bonuses rather than using unmodified Wisdom/Constitution", () => {
  const classes = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))),
    feats = JSON.parse(readFileSync(new URL("../src/data/feats.json", import.meta.url))),
    cls = classes.find(c => c.key === "soldier"),
    f = feats.find(f => f.name === "Iron Will"),
    sys = computeAgent(
      {
        abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
        progression: [{ classId: "soldier", vitality: 6, skills: {} }],
        skills: {},
        focuses: {},
        proficiencies: {},
        misc: {}
      },
      [
        {
          id: "soldier",
          name: cls.name,
          type: "class",
          system: { ...cls, identifier: "soldier", vitalityDie: cls.vitality }
        },
        { id: "iron", name: f.name, type: "feat", system: { ...f, tree: "basicCombat", acquiredAtLevel: 1 } }
      ],
      cfg
    );
  assert.equal(sys.featStatus.iron.ok, true);
  for (const kind of ["stress", "subdual"]) {
    assert.equal(sys[kind + "Threshold"], 15);
    assert.equal(plan(sys, { ...input, kind, newDamage: 15 }).saveRequired, false);
    assert.equal(plan(sys, { ...input, kind, newDamage: 16 }).dc, 12);
  }
});
test("malformed or unsafe damage, unresolved defenses, invalid thresholds cannot fabricate saves", () => {
  for (const key of ["currentDamage", "newDamage"])
    for (const value of [-1, 1.5, "1", null, Infinity, NaN])
      assert.throws(() => plan(system(), { ...input, [key]: value }));
  for (const patch of [
    { kind: "lethal" },
    { confirmed: false },
    { criticalHit: "true" },
    { currentDamage: Number.MAX_SAFE_INTEGER, newDamage: 1 }
  ])
    assert.throws(() => plan(system(), { ...input, ...patch }));
  for (const stressThreshold of [-1, 1.5, "12", Infinity, Number.MAX_SAFE_INTEGER])
    assert.throws(() => plan({ ...system(), stressThreshold }, input));
  const sys = system();
  delete sys.stressThreshold;
  assert.equal(plan(sys, input).threshold, 12);
  delete sys.abilities;
  assert.throws(() => plan(sys, input));
});
test("threshold calculations never apply damage, critical injuries, dice spending, conditions or recovery", () => {
  const sys = system(),
    before = structuredClone(sys),
    p = plan(sys, { ...input, newDamage: 100 });
  assert.deepEqual(sys, before);
  assert.equal(p.appliesToVitalityWounds, false);
  assert.equal(p.criticalInjuries, false);
  assert.equal(p.actionDiceDamageAllowed, false);
});
let responses = [],
  dialogs = [],
  warnings = [],
  hook = null;
function setup(request) {
  responses = [request, null];
  dialogs = [];
  warnings = [];
  hook = null;
  globalThis.ui = {
    notifications: {
      warn: m => {
        warnings.push(m);
        return null;
      }
    }
  };
  globalThis.foundry = {
    utils: { escapeHTML: s => String(s) },
    applications: {
      api: {
        DialogV2: {
          input: async opts => {
            dialogs.push(opts);
            if (hook) hook();
            return responses.shift();
          }
        }
      }
    }
  };
  return {
    type: "agent",
    isOwner: true,
    system: system(),
    update: () => {
      throw Error("Unexpected mutation");
    },
    rollSave: () => {
      throw Error("Unexpected save");
    }
  };
}
const request = { kind: "stress", currentDamage: "10", newDamage: "18", confirmed: true, criticalHit: false };
test("the actual Main preview resolves the printed stress example and presents the separate subdual knockout formula without changing resources", async () => {
  let a = setup(request),
    before = structuredClone(a.system),
    p = await checkAccumulatedDamage(a);
  assert.equal(p.total, 28);
  assert.equal(p.dc, 16);
  assert.match(dialogs[1].content, /Will save DC 16/);
  assert.match(dialogs[1].content, /Shaken II/);
  assert.deepEqual(a.system, before);
  a = setup({ ...request, kind: "subdual", currentDamage: "0", newDamage: "18" });
  p = await checkAccumulatedDamage(a);
  assert.equal(p.dc, 12);
  assert.match(dialogs[1].content, /Fortitude save DC 12/);
  assert.match(dialogs[1].content, /1 round.*half the difference/);
});
test("the real preview cancels quietly and rejects missing, coerced or unconfirmed totals before showing a result", async () => {
  let a = setup(null);
  assert.equal(await checkAccumulatedDamage(a), null);
  assert.equal(dialogs.length, 1);
  for (const patch of [
    { currentDamage: "" },
    { newDamage: "1.5" },
    { newDamage: false },
    { currentDamage: " 1" },
    { confirmed: false },
    { criticalHit: "true" }
  ]) {
    a = setup({ ...request, ...patch });
    assert.equal(await checkAccumulatedDamage(a), null);
    assert.equal(dialogs.length, 1);
    assert.equal(warnings.length, 1);
  }
});
test("the preview uses current prepared thresholds after the dialog and requires an owned character", async () => {
  let a = setup({ ...request, currentDamage: "0", newDamage: "13" });
  hook = () => {
    a.system.stressThreshold = 15;
  };
  assert.equal((await checkAccumulatedDamage(a)).saveRequired, false);
  for (const patch of [{ type: "npc" }, { isOwner: false }]) {
    a = setup(request);
    Object.assign(a, patch);
    assert.equal(await checkAccumulatedDamage(a), null);
    assert.equal(dialogs.length, 0);
  }
});

const { reviewDamageLedger, applyAccumulatedDamage } = await import("../module/apps/damage-ledger.mjs");
const { validateDamageLedger, damageLedgerSnapshot, damageLedgerEventPlan } =
  await import("../module/rules/accumulated-damage.mjs");
let serial = 0,
  writeFailure = "",
  writeHook = null;
function ledgerActor() {
  serial = 0;
  writeFailure = "";
  writeHook = null;
  globalThis.game = {
    ready: false,
    user: { id: "gc", isGM: true },
    time: { worldTime: 12 },
    settings: { get: () => ({}) },
    spycraft2: {}
  };
  globalThis.foundry = {
    utils: { randomID: () => `event${++serial}`, escapeHTML: String },
    applications: { api: { DialogV2: { input: async () => null } } }
  };
  return {
    type: "agent",
    uuid: "Actor.ledger",
    isOwner: true,
    flags: {},
    system: { ...system(), accumulatedDamage: null },
    async update(patch) {
      if (writeFailure === "before") throw Error("Write failed");
      for (const [path, value] of Object.entries(patch)) {
        const keys = path.split(".");
        let target = this;
        for (const key of keys.slice(0, -1)) target = target[key] ??= {};
        target[keys.at(-1)] = structuredClone(value);
      }
      writeHook?.();
      if (writeFailure === "after") throw Error("Response lost");
      return this;
    }
  };
}
const review = { stress: 0, subdual: 0, note: "GC checked actual totals", confirmed: true },
  damage = { source: "attack-one", kind: "stress", newDamage: 13, confirmed: true };
test("legacy damage is never assumed zero; an explicit owning-GC baseline has an auditable revision and can be corrected without pending saves", async () => {
  const a = ledgerActor();
  await assert.rejects(applyAccumulatedDamage(a, damage), /initialize or review/);
  assert.equal(a.system.accumulatedDamage, null);
  let r = await reviewDamageLedger(a, review);
  assert.equal(r.before, null);
  assert.equal(a.system.accumulatedDamage.revision, 1);
  assert.equal(a.system.accumulatedDamage.stress, 0);
  assert.equal(Object.keys(a.flags.spycraft2.damageLedgerReviews).length, 1);
  r = await reviewDamageLedger(a, { ...review, stress: 12, subdual: 14 });
  assert.deepEqual(r.before, { stress: 0, subdual: 0 });
  assert.equal(a.system.accumulatedDamage.revision, 2);
  assert.equal(Object.keys(a.flags.spycraft2.damageLedgerReviews).length, 2);
});
test("two actual events update separate totals and retain separate ordered save receipts without changing health, dice or conditions", async () => {
  const a = ledgerActor();
  await reviewDamageLedger(a, { ...review, stress: 12, subdual: 14 });
  const before = structuredClone(a.system),
    one = await applyAccumulatedDamage(a, { ...damage, newDamage: 1 }),
    two = await applyAccumulatedDamage(a, { ...damage, source: "attack-two", kind: "subdual", newDamage: 1 });
  assert.equal(a.system.accumulatedDamage.stress, 13);
  assert.equal(a.system.accumulatedDamage.subdual, 15);
  assert.deepEqual(a.system.accumulatedDamage.pending, [one.id, two.id]);
  assert.equal(one.save.key, "will");
  assert.equal(one.save.dc, 12);
  assert.equal(two.save.key, "fort");
  assert.equal(two.save.knockoutBase, "1 round");
  assert.equal(two.save.dc, 12);
  assert.deepEqual(a.system.vitality, before.vitality);
  assert.deepEqual(a.system.wounds, before.wounds);
  assert.deepEqual(a.system.actionDice, before.actionDice);
  a.system.stressThreshold = 100;
  assert.equal(a.flags.spycraft2.damageEvents[one.id].save.threshold, 12);
});
test("a repeated source reference returns its original receipt and never applies damage twice; changed parameters cannot reuse it", async () => {
  const a = ledgerActor();
  await reviewDamageLedger(a, review);
  const one = await applyAccumulatedDamage(a, damage),
    before = structuredClone(a.system.accumulatedDamage),
    again = await applyAccumulatedDamage(a, { ...damage, source: " attack-one " });
  assert.deepEqual(again, one);
  assert.deepEqual(a.system.accumulatedDamage, before);
  assert.equal(Object.keys(a.flags.spycraft2.damageEvents).length, 1);
  await assert.rejects(applyAccumulatedDamage(a, { ...damage, newDamage: 14 }), /different damage/);
  assert.deepEqual(a.system.accumulatedDamage, before);
});
test("concurrent duplicate requests commit once, while concurrent distinct requests require a fresh ledger review rather than overwrite a total", async () => {
  let a = ledgerActor();
  await reviewDamageLedger(a, review);
  const both = await Promise.all([applyAccumulatedDamage(a, damage), applyAccumulatedDamage(a, damage)]);
  assert.equal(both[0].id, both[1].id);
  assert.equal(a.system.accumulatedDamage.stress, 13);
  a = ledgerActor();
  await reviewDamageLedger(a, review);
  const distinct = await Promise.allSettled([
    applyAccumulatedDamage(a, damage),
    applyAccumulatedDamage(a, { ...damage, source: "another" })
  ]);
  assert.equal(distinct.filter(r => r.status === "fulfilled").length, 1);
  assert.match(distinct.find(r => r.status === "rejected").reason.message, /ledger changed/);
  assert.equal(a.system.accumulatedDamage.stress, 13);
});
test("atomic update failures before commit preserve totals; a lost response after a proven commit returns the retained receipt", async () => {
  const a = ledgerActor();
  await reviewDamageLedger(a, review);
  const before = damageLedgerSnapshot(a);
  writeFailure = "before";
  await assert.rejects(applyAccumulatedDamage(a, damage), /Write failed/);
  assert.deepEqual(damageLedgerSnapshot(a), before);
  writeFailure = "after";
  const result = await applyAccumulatedDamage(a, damage);
  assert.equal(a.system.accumulatedDamage.stress, 13);
  assert.equal(a.flags.spycraft2.damageEvents[result.id].source, damage.source);
  writeFailure = "";
  assert.deepEqual(await applyAccumulatedDamage(a, damage), result);
});
test("ownership, GC authority, confirmation and an unchanged dialog snapshot protect initialization and corrections", async () => {
  let a = ledgerActor();
  game.user.isGM = false;
  assert.equal(await reviewDamageLedger(a, review), null);
  assert.equal(a.system.accumulatedDamage, null);
  game.user.isGM = true;
  a.isOwner = false;
  assert.equal(await reviewDamageLedger(a, review), null);
  a.isOwner = true;
  assert.equal(await reviewDamageLedger(a, { ...review, confirmed: false }), null);
  await reviewDamageLedger(a, review);
  foundry.applications.api.DialogV2.input = async () => {
    a.system.accumulatedDamage.stress = 2;
    return { ...review, stress: "3", subdual: "0" };
  };
  await assert.rejects(reviewDamageLedger(a), /ledger changed/);
  assert.equal(a.system.accumulatedDamage.stress, 2);
});
test("pending saves block total corrections and missing receipts or malformed ledgers block new events", async () => {
  const a = ledgerActor();
  await reviewDamageLedger(a, review);
  const r = await applyAccumulatedDamage(a, damage);
  await assert.rejects(reviewDamageLedger(a, { ...review, stress: 0 }), /pending damage saves/);
  delete a.flags.spycraft2.damageEvents[r.id];
  await assert.rejects(applyAccumulatedDamage(a, { ...damage, source: "new" }), /pending damage-save receipts/);
  for (const ledger of [
    null,
    {},
    { version: 1, revision: 1, stress: 0, subdual: 0, pending: ["constructor"] },
    { version: 1, revision: 1, stress: 0, subdual: 0, pending: ["a", "a"] }
  ])
    assert.throws(() => validateDamageLedger(ledger), /initialize or review/);
});
test("zero and below-threshold events have receipts without a save, while below-threshold critical events retain their unresolved outcome", async () => {
  const a = ledgerActor();
  await reviewDamageLedger(a, review);
  for (const newDamage of [0, 1]) {
    const r = await applyAccumulatedDamage(a, { ...damage, newDamage, source: "ordinary-" + newDamage });
    assert.equal(r.state, "recorded");
    assert.equal(r.save, null);
  }
  assert.equal(a.system.accumulatedDamage.pending.length, 0);
  const r = await applyAccumulatedDamage(a, { ...damage, newDamage: 1, criticalHit: true, source: "critical" });
  assert.equal(r.save.dc, 16);
  assert.equal(r.save.needsOutcomeReview, true);
  assert.equal(r.save.failureOutcome, null);
  assert.deepEqual(a.system.accumulatedDamage.pending, [r.id]);
});
test("pure event receipts reject unsafe references, stale state and malformed history without changing the captured ledger", async () => {
  const a = ledgerActor();
  await reviewDamageLedger(a, review);
  const snap = damageLedgerSnapshot(a),
    before = structuredClone(snap);
  for (const source of ["", " ".repeat(2), "x".repeat(301)])
    assert.throws(() => damageLedgerEventPlan(a.system, snap, snap, { ...damage, source }, "id", 0));
  for (const id of ["constructor", "__proto__", "a.b", ""])
    assert.throws(() => damageLedgerEventPlan(a.system, snap, snap, damage, id, 0));
  assert.throws(
    () => damageLedgerEventPlan(a.system, { ...snap, ledger: { ...snap.ledger, stress: 2 } }, snap, damage, "id", 0),
    /ledger changed/
  );
  assert.deepEqual(snap, before);
});
