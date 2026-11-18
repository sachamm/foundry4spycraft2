import test from "node:test";
import assert from "node:assert/strict";
import {
  stressDefensePlan,
  stressDefenseSourceSnapshot,
  fireStressDefenseSourceSnapshot
} from "../module/rules/stress-defense.mjs";
import { characterSurvivalStats } from "../module/rules/terrain.mjs";
import { reviewDamageLedger, applyAccumulatedDamage } from "../module/apps/damage-ledger.mjs";
const system = (resistance = 2) => ({
  stressThreshold: 12,
  subdualThreshold: 14,
  dr: { melee: 100, other: 100 },
  armor: { resistances: {} },
  survivalStats: {
    resistances: { stress: resistance },
    resistanceSources: [{ source: "Battle Hardened", key: "stress", value: resistance }]
  },
  vitality: { value: 4 },
  wounds: { value: 4 },
  actionDice: { value: 2 }
});
test("stress bypasses all DR, subtracts prepared resistance per hit, floors at zero and treats immunity as full resistance", () => {
  for (const resistance of [...Array.from({ length: 13 }, (_, i) => i), "all"])
    for (let damage = 0; damage <= 40; damage++) {
      const sys = system(resistance),
        before = structuredClone(sys),
        p = stressDefensePlan(sys, damage);
      assert.equal(p.netDamage, resistance === "all" ? 0 : Math.max(0, damage - resistance));
      assert.equal(p.damageReductionApplied, 0);
      assert.equal(p.armorPiercing, "all");
      assert.equal(p.companionEffectsNegated, p.netDamage === 0);
      assert.deepEqual(sys, before);
    }
});
test("unprepared, malformed, fractional and unsafe stress resistance or damage cannot silently become zero", () => {
  for (const resistance of [null, undefined, "2", "ALL", -1, 1.5, Infinity, NaN]) {
    const sys = system();
    sys.survivalStats.resistances.stress = resistance;
    assert.throws(() => stressDefensePlan(sys, 3));
  }
  for (const rawDamage of [-1, 1.5, "3", null, Infinity]) assert.throws(() => stressDefensePlan(system(), rawDamage));
  assert.throws(() => stressDefensePlan({}, 3));
  assert.throws(() => stressDefensePlan({ ...system(), survivalStats: { resistances: [] } }, 3));
  assert.throws(() =>
    stressDefensePlan({ ...system(), survivalStats: { resistances: { stress: 2 }, resistanceSources: {} } }, 3)
  );
});
test("actual prepared class, quality and feat resistance keeps its existing stacking rules instead of summing the audit sources again", () => {
  const sys = {
    classLevels: { grunt: 4 },
    abilities: { con: { value: 16, mod: 3 } },
    armor: { resistances: {} },
    originEffects: [{ qualityKey: "damageResistance", resistanceType: "stress" }],
    activeFeatNames: ["Battle Hardened"]
  };
  sys.survivalStats = characterSurvivalStats(sys);
  const p = stressDefensePlan(sys, 10);
  assert.equal(p.resistance, 6);
  assert.equal(p.netDamage, 4);
  assert.equal(p.sources.length, 3);
  const fear = {
    classLevels: { stuntman: 7 },
    abilities: { con: { value: 12, mod: 1 }, wis: { mod: 1 } },
    usagePeriods: { session: "s" },
    noFearBoost: {
      combatId: "c",
      combatantId: "pc",
      startRound: 1,
      dueRound: 3,
      rounds: 2,
      resistance: 7,
      session: "s"
    },
    noFearCombatContext: { id: "c", started: true, round: 1, turn: 0, combatantId: "pc", ownTurnIndex: 0 }
  };
  fear.survivalStats = characterSurvivalStats(fear);
  assert.equal(stressDefensePlan(fear, 10).netDamage, 3);
  const before = stressDefenseSourceSnapshot(fear);
  fear.noFearCombatContext.round = 3;
  fear.survivalStats = characterSurvivalStats(fear);
  assert.equal(stressDefensePlan(fear, 10).netDamage, 10);
  assert.notEqual(stressDefenseSourceSnapshot(fear), before);
});
let serial = 0,
  dialogs = [],
  response = null,
  hook = null;
function actor(resistance = 2) {
  serial = 0;
  dialogs = [];
  response = null;
  hook = null;
  globalThis.game = {
    ready: false,
    user: { id: "gc", isGM: true },
    time: { worldTime: 0 },
    settings: { get: () => ({}) },
    spycraft2: {}
  };
  globalThis.foundry = {
    utils: { randomID: () => `id${++serial}`, escapeHTML: String },
    applications: {
      api: {
        DialogV2: {
          input: async o => {
            dialogs.push(o);
            hook?.();
            return response;
          }
        }
      }
    }
  };
  return {
    uuid: "Actor.stress",
    type: "agent",
    isOwner: true,
    system: { ...system(resistance), accumulatedDamage: null },
    flags: {},
    async update(patch) {
      for (const [path, value] of Object.entries(patch)) {
        const keys = path.split(".");
        let o = this;
        for (const key of keys.slice(0, -1)) o = o[key] ??= {};
        o[keys.at(-1)] = structuredClone(value);
      }
      return this;
    }
  };
}
const baseline = { stress: 0, subdual: 0, note: "GC verified actual totals", confirmed: true },
  raw = { source: "hit", kind: "stress", newDamage: 13, damageMode: "stressBeforeResistance", confirmed: true };
test("actual ledger events apply resistance to each hit before accumulation and create a save only when net total exceeds the threshold", async () => {
  const a = actor();
  await reviewDamageLedger(a, baseline);
  let r = await applyAccumulatedDamage(a, raw);
  assert.equal(r.newDamage, 11);
  assert.equal(r.state, "recorded");
  assert.equal(r.defenseContext.resistance, 2);
  assert.equal(r.request.newDamage, 13);
  r = await applyAccumulatedDamage(a, { ...raw, source: "second", newDamage: 3 });
  assert.equal(r.total, 12);
  assert.equal(r.save, null);
  r = await applyAccumulatedDamage(a, { ...raw, source: "third", newDamage: 3 });
  assert.equal(r.total, 13);
  assert.equal(r.save.dc, 12);
  assert.equal(a.system.accumulatedDamage.pending.length, 1);
  assert.equal(a.system.vitality.value, 4);
  assert.equal(a.system.wounds.value, 4);
  assert.equal(a.system.actionDice.value, 2);
});
test("fully resisted standard and critical events cause no save or special-effect trigger, per the damage-resistance zero rule", async () => {
  for (const resistance of [2, "all"])
    for (const criticalHit of [false, true]) {
      const a = actor(resistance);
      await reviewDamageLedger(a, baseline);
      const r = await applyAccumulatedDamage(a, { ...raw, newDamage: 1, criticalHit });
      assert.equal(r.newDamage, 0);
      assert.equal(r.criticalHit, criticalHit);
      assert.equal(r.defenseContext.companionEffectsNegated, true);
      assert.equal(r.save, null);
      assert.equal(a.system.accumulatedDamage.pending.length, 0);
    }
});
test("resolved net input never subtracts resistance twice, and raw subdual is rejected until its separate defense rules are implemented", async () => {
  const a = actor();
  await reviewDamageLedger(a, baseline);
  const r = await applyAccumulatedDamage(a, { ...raw, damageMode: "net", newDamage: 11 });
  assert.equal(r.newDamage, 11);
  assert.equal(r.defenseContext, null);
  await assert.rejects(
    applyAccumulatedDamage(a, { ...raw, source: "subdual", kind: "subdual" }),
    /resolved net damage/
  );
  assert.equal(a.system.accumulatedDamage.stress, 11);
});
test("duplicate raw input returns its historical defense receipt after resistance changes, while a different calculation cannot reuse the source", async () => {
  const a = actor();
  await reviewDamageLedger(a, baseline);
  const first = await applyAccumulatedDamage(a, raw),
    revision = a.system.accumulatedDamage.revision;
  a.system.survivalStats.resistances.stress = 0;
  a.system.survivalStats.resistanceSources = [];
  const repeated = await applyAccumulatedDamage(a, raw);
  assert.deepEqual(repeated, first);
  assert.equal(a.system.accumulatedDamage.revision, revision);
  await assert.rejects(applyAccumulatedDamage(a, { ...raw, newDamage: 11, damageMode: "net" }), /different damage/);
});
test("the actual damage dialog exposes both calculation modes and stops a changed resistance before applying an unexpected amount", async () => {
  let a = actor();
  await reviewDamageLedger(a, baseline);
  response = { ...raw, newDamage: "13" };
  let r = await applyAccumulatedDamage(a);
  assert.equal(r.newDamage, 11);
  assert.match(dialogs[0].content, /Prepared stress resistance: 2/);
  assert.match(dialogs[0].content, /Final damage after all defenses/);
  a = actor();
  await reviewDamageLedger(a, baseline);
  response = raw;
  hook = () => {
    a.system.survivalStats.resistances.stress = 4;
  };
  await assert.rejects(applyAccumulatedDamage(a), /resistance changed/);
  assert.equal(a.system.accumulatedDamage.stress, 0);
  assert.equal(Object.keys(a.flags.spycraft2.damageEvents ?? {}).length, 0);
});
test("legacy final-net event receipts still deduplicate without assuming they were raw damage", async () => {
  const a = actor();
  await reviewDamageLedger(a, baseline);
  const net = { ...raw, damageMode: "net", newDamage: 11 },
    first = await applyAccumulatedDamage(a, net),
    saved = a.flags.spycraft2.damageEvents[first.id];
  delete saved.request;
  delete saved.defenseContext;
  const revision = a.system.accumulatedDamage.revision;
  assert.equal((await applyAccumulatedDamage(a, net)).id, first.id);
  assert.equal(a.system.accumulatedDamage.revision, revision);
  await assert.rejects(applyAccumulatedDamage(a, raw), /different damage/);
});

test("fire stress halves once rounded down before prepared resistance across all doses, with no reduction for ordinary stress or absent training", () => {
  for (const resistance of [0, 1, 2, 5, 12, "all"])
    for (let raw = 0; raw <= 101; raw++)
      for (const trained of [false, true]) {
        const s = system(resistance);
        s.activeFeatNames = trained ? ["Firefighter Training"] : [];
        const p = stressDefensePlan(s, raw, { fromFire: true }),
          half = trained ? Math.floor(raw / 2) : raw;
        assert.equal(p.netDamage, resistance === "all" ? 0 : Math.max(0, half - resistance));
        assert.equal(p.rawDamage, raw);
        assert.equal(p.fire.adjustedDamage, half);
        assert.equal(p.fire.reduction, raw - half);
        assert.equal(p.damageReductionApplied, 0);
        assert.equal(stressDefensePlan(s, raw).netDamage, resistance === "all" ? 0 : Math.max(0, raw - resistance));
      }
  assert.throws(() => stressDefensePlan(system(), 5, { fromFire: "true" }));
  const s = system(0);
  s.activeFeatNames = ["Firefighter Training"];
  assert.equal(stressDefensePlan(s, 1, { fromFire: true }).companionEffectsNegated, false);
});
test("actual fire-stress ledger records the original stress dose, halving and resistance without changing health or dice", async () => {
  const a = actor();
  a.system.activeFeatNames = ["Firefighter Training"];
  await reviewDamageLedger(a, baseline);
  const r = await applyAccumulatedDamage(a, { ...raw, newDamage: 13, damageMode: "fireStressBeforeDefenses" });
  assert.equal(r.request.newDamage, 13);
  assert.equal(r.defenseContext.fire.adjustedDamage, 6);
  assert.equal(r.defenseContext.resisted, 2);
  assert.equal(r.newDamage, 4);
  assert.equal(a.system.accumulatedDamage.stress, 4);
  assert.equal(r.save, null);
  assert.equal(a.system.actionDice.value, 2);
  assert.equal(a.system.vitality.value, 4);
  assert.equal(a.system.wounds.value, 4);
});
test("fire mode keeps threshold/save boundaries exact, final net input unchanged and stress-only scope enforced", async () => {
  const a = actor(0);
  a.system.activeFeatNames = ["Firefighter Training"];
  await reviewDamageLedger(a, baseline);
  let r = await applyAccumulatedDamage(a, { ...raw, newDamage: 25, damageMode: "fireStressBeforeDefenses" });
  assert.equal(r.newDamage, 12);
  assert.equal(r.save, null);
  r = await applyAccumulatedDamage(a, {
    ...raw,
    source: "next fire",
    newDamage: 3,
    damageMode: "fireStressBeforeDefenses"
  });
  assert.equal(r.total, 13);
  assert.equal(r.save.dc, 12);
  assert.equal(r.save.key, "will");
  await assert.rejects(
    applyAccumulatedDamage(a, { ...raw, source: "wrong kind", kind: "subdual", damageMode: "fireStressBeforeDefenses" })
  );
  const b = actor(2);
  b.system.activeFeatNames = ["Firefighter Training"];
  await reviewDamageLedger(b, baseline);
  assert.equal((await applyAccumulatedDamage(b, { ...raw, damageMode: "net", newDamage: 4 })).newDamage, 4);
});
test("historical fire events stay idempotent after feat/resistance changes, but altered damage or modes cannot reuse their source", async () => {
  const a = actor(2);
  a.system.activeFeatNames = ["Firefighter Training"];
  await reviewDamageLedger(a, baseline);
  const input = { ...raw, damageMode: "fireStressBeforeDefenses" },
    first = await applyAccumulatedDamage(a, input),
    revision = a.system.accumulatedDamage.revision;
  a.system.activeFeatNames = [];
  a.system.survivalStats.resistances.stress = 0;
  assert.deepEqual(await applyAccumulatedDamage(a, input), first);
  assert.equal(a.system.accumulatedDamage.revision, revision);
  await assert.rejects(applyAccumulatedDamage(a, { ...input, damageMode: "stressBeforeResistance" }), /different/);
  await assert.rejects(applyAccumulatedDamage(a, { ...input, newDamage: 12 }), /different/);
});
test("the actual fire-stress dialog requires a current feat/resistance snapshot and exposes the stress-dose distinction", async () => {
  let a = actor();
  a.system.activeFeatNames = ["Firefighter Training"];
  await reviewDamageLedger(a, baseline);
  response = { ...raw, damageMode: "fireStressBeforeDefenses" };
  assert.equal((await applyAccumulatedDamage(a)).newDamage, 4);
  assert.match(dialogs[0].content, /fireStressBeforeDefenses/);
  assert.match(dialogs[0].content, /not the underlying fire damage/);
  a = actor();
  a.system.activeFeatNames = ["Firefighter Training"];
  await reviewDamageLedger(a, baseline);
  response = { ...raw, damageMode: "fireStressBeforeDefenses" };
  hook = () => {
    a.system.activeFeatNames = [];
  };
  await assert.rejects(applyAccumulatedDamage(a), /Firefighter Training/);
  assert.equal(a.system.accumulatedDamage.stress, 0);
  const before = fireStressDefenseSourceSnapshot(a.system);
  a.system.activeFeatNames = ["Firefighter Training"];
  assert.notEqual(fireStressDefenseSourceSnapshot(a.system), before);
});
