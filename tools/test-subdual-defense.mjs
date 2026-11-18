import test from "node:test";
import assert from "node:assert/strict";
import { SUBDUAL_ATTACK_KINDS, subdualDefensePlan } from "../module/rules/subdual-defense.mjs";
import { armorTrainingDRForAttack } from "../module/rules/armor-training.mjs";
import { reviewDamageLedger, applyAccumulatedDamage } from "../module/apps/damage-ledger.mjs";
function prepared({ melee = 3, other = 1, resistance = 0, training = {}, natural = 0, classDR = 0 } = {}) {
  const sys = {
    stressThreshold: 12,
    subdualThreshold: 14,
    damageReductionComponents: { natural, class: classDR, armorMelee: melee, armorOther: other },
    armorFeatRules: training,
    armor: { items: ["armor"], resistances: {} },
    survivalStats: { resistances: { subdual: resistance }, resistanceSources: [] },
    vitality: { value: 4 },
    wounds: { value: 4 },
    actionDice: { value: 2 }
  };
  sys.armorDRByAttack = Object.fromEntries(
    Object.keys(SUBDUAL_ATTACK_KINDS).map(k => [k, armorTrainingDRForAttack(sys, k)])
  );
  return sys;
}
const event = { rawDamage: 10, attackKind: "unarmed" };
test("AP reduces listed DR before each remaining point absorbs two subdual; AP(all) and AP at least equal to DR bypass it", () => {
  const sys = prepared(),
    normal = subdualDefensePlan(sys, event),
    piercing = subdualDefensePlan(sys, { ...event, armorPiercing: 1 });
  assert.equal(normal.effectiveDR, 6);
  assert.equal(normal.netDamage, 4);
  assert.equal(piercing.temporaryDR, 2);
  assert.equal(piercing.effectiveDR, 4);
  assert.equal(piercing.netDamage, 6);
  for (const patch of [{ armorPiercing: 3 }, { armorPiercing: 99 }, { armorPiercingAll: true }]) {
    const p = subdualDefensePlan(sys, { ...event, ...patch });
    assert.equal(p.effectiveDR, 0);
    assert.equal(p.netDamage, 10);
    assert.equal(p.bruising, 0);
  }
});
test("DR fully stopping positive damage creates one bruising point, while zero input creates no injury", () => {
  const sys = prepared();
  for (const rawDamage of [1, 5, 6]) {
    const p = subdualDefensePlan(sys, { ...event, rawDamage });
    assert.equal(p.afterDR, 0);
    assert.equal(p.bruising, 1);
    assert.equal(p.netDamage, 1);
  }
  let p = subdualDefensePlan(sys, { ...event, rawDamage: 0 });
  assert.equal(p.bruising, 0);
  assert.equal(p.netDamage, 0);
  p = subdualDefensePlan(sys, { ...event, rawDamage: 7 });
  assert.equal(p.afterDR, 1);
  assert.equal(p.bruising, 0);
});
test("subdual resistance applies after DR and bruising, rather than allowing resistance to be added back as a new bruise", () => {
  for (const resistance of [1, 2, "all"]) {
    const p = subdualDefensePlan(prepared({ resistance }), { ...event, rawDamage: 5 });
    assert.equal(p.bruising, 1);
    assert.equal(p.resisted, 1);
    assert.equal(p.netDamage, 0);
  }
  const p = subdualDefensePlan(prepared({ resistance: 3 }), event);
  assert.equal(p.afterDR, 4);
  assert.equal(p.netDamage, 1);
});
test("all five actual attack categories retain armor-training and natural/class source rules without confusing ranged DR with subdual DR", () => {
  let sys = prepared();
  for (const kind of ["unarmed", "meleeWeapon", "hurledWeapon"])
    assert.equal(subdualDefensePlan(sys, { rawDamage: 10, attackKind: kind }).effectiveDR, 6);
  for (const kind of ["rangedWeapon", "other"])
    assert.equal(subdualDefensePlan(sys, { rawDamage: 10, attackKind: kind }).effectiveDR, 2);
  sys = prepared({ training: { meleeWeaponDR: 2, meleeAttackDR: 1, rangedWeaponDR: 2, rangedAttackDR: 1 } });
  for (const [attackKind, listedDR] of Object.entries({
    unarmed: 4,
    meleeWeapon: 6,
    hurledWeapon: 6,
    rangedWeapon: 4,
    other: 1
  }))
    assert.equal(subdualDefensePlan(sys, { rawDamage: 20, attackKind }).listedDR, listedDR);
  sys = prepared({ natural: 10, classDR: 2 });
  assert.equal(subdualDefensePlan(sys, { rawDamage: 30, attackKind: "unarmed" }).effectiveDR, 20);
  assert.equal(subdualDefensePlan(sys, { rawDamage: 30, attackKind: "unarmed" }).netDamage, 10);
});
test("only critical bruising that survives resistance requires the pending policy decision; partial penetration and zero final damage are unambiguous", () => {
  let p = subdualDefensePlan(prepared(), { ...event, criticalHit: true });
  assert.equal(p.criticalBruisingReview, false);
  p = subdualDefensePlan(prepared(), { ...event, rawDamage: 5, criticalHit: true });
  assert.equal(p.criticalBruisingReview, true);
  p = subdualDefensePlan(prepared({ resistance: 1 }), { ...event, rawDamage: 5, criticalHit: true });
  assert.equal(p.criticalBruisingReview, false);
  assert.equal(p.netDamage, 0);
});
test("typed damage/AP/categories and a consistent prepared DR map are required, including safe doubled values", () => {
  for (const patch of [
    { rawDamage: -1 },
    { rawDamage: "10" },
    { armorPiercing: 1.5 },
    { armorPiercing: -1 },
    { armorPiercingAll: "true" },
    { criticalHit: 1 },
    { attackKind: "" },
    { attackKind: "gun" }
  ])
    assert.throws(() => subdualDefensePlan(prepared(), { ...event, ...patch }));
  const bad = prepared();
  bad.armorDRByAttack.unarmed++;
  assert.throws(() => subdualDefensePlan(bad, event), /listed DR/);
  assert.throws(() => subdualDefensePlan({ survivalStats: { resistances: {} } }, event));
  const big = prepared({ melee: Number.MAX_SAFE_INTEGER });
  assert.throws(() => subdualDefensePlan(big, event), /safely/);
  assert.equal(subdualDefensePlan(big, { ...event, armorPiercingAll: true }).netDamage, 10);
});
let serial = 0,
  response = null,
  hook = null,
  dialogs = [];
function actor(options) {
  serial = 0;
  response = null;
  hook = null;
  dialogs = [];
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
    uuid: "Actor.subdual",
    type: "agent",
    isOwner: true,
    system: { ...prepared(options), accumulatedDamage: null },
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
const baseline = { stress: 0, subdual: 14, note: "GC verified actual totals", confirmed: true },
  raw = {
    source: "hit",
    kind: "subdual",
    newDamage: 10,
    damageMode: "subdualBeforeDefenses",
    attackKind: "unarmed",
    armorPiercing: 0,
    confirmed: true
  };
test("actual ledger events use net subdual per hit and retain individual ordinary or critical saves without touching health or dice", async () => {
  const a = actor();
  await reviewDamageLedger(a, baseline);
  let r = await applyAccumulatedDamage(a, raw);
  assert.equal(r.newDamage, 4);
  assert.equal(r.total, 18);
  assert.equal(r.save.key, "fort");
  assert.equal(r.save.dc, 12);
  r = await applyAccumulatedDamage(a, { ...raw, source: "bruise", newDamage: 5 });
  assert.equal(r.newDamage, 1);
  assert.equal(r.total, 19);
  assert.equal(a.system.accumulatedDamage.pending.length, 2);
  assert.equal(a.system.accumulatedDamage.stress, 0);
  assert.equal(a.system.vitality.value, 4);
  assert.equal(a.system.wounds.value, 4);
  assert.equal(a.system.actionDice.value, 2);
  r = await applyAccumulatedDamage(a, { ...raw, source: "critical", criticalHit: true, armorPiercing: 1 });
  assert.equal(r.newDamage, 6);
  assert.equal(r.save.dc, 16);
  assert.equal(r.save.tier, 1);
});
test("historical duplicate receipts survive DR changes, but changing actual AP or source category cannot reuse the same reference", async () => {
  const a = actor();
  await reviewDamageLedger(a, baseline);
  const first = await applyAccumulatedDamage(a, { ...raw, armorPiercing: 1 }),
    revision = a.system.accumulatedDamage.revision;
  a.system.damageReductionComponents.armorMelee = 6;
  for (const k of Object.keys(SUBDUAL_ATTACK_KINDS))
    a.system.armorDRByAttack[k] = armorTrainingDRForAttack(a.system, k);
  assert.deepEqual(await applyAccumulatedDamage(a, { ...raw, armorPiercing: 1 }), first);
  assert.equal(a.system.accumulatedDamage.revision, revision);
  for (const patch of [{ armorPiercing: 2 }, { attackKind: "rangedWeapon" }, { damageMode: "net", newDamage: 6 }])
    await assert.rejects(applyAccumulatedDamage(a, { ...raw, armorPiercing: 1, ...patch }), /different damage/);
});
test("the actual dialog parses AP and checks source changes, while unsupported critical bruising cannot silently select a save policy", async () => {
  let a = actor();
  await reviewDamageLedger(a, baseline);
  response = { ...raw, newDamage: "10", armorPiercing: "1" };
  let r = await applyAccumulatedDamage(a);
  assert.equal(r.newDamage, 6);
  assert.match(dialogs[0].content, /Subdual before listed DR and resistance/);
  assert.match(dialogs[0].content, /Unarmed attack \(DR 3\)/);
  a = actor();
  await reviewDamageLedger(a, baseline);
  response = raw;
  hook = () => {
    a.system.damageReductionComponents.armorMelee = 4;
    for (const k of Object.keys(SUBDUAL_ATTACK_KINDS))
      a.system.armorDRByAttack[k] = armorTrainingDRForAttack(a.system, k);
  };
  await assert.rejects(applyAccumulatedDamage(a), /defenses changed/);
  assert.equal(a.system.accumulatedDamage.subdual, 14);
  a = actor();
  await reviewDamageLedger(a, baseline);
  await assert.rejects(
    applyAccumulatedDamage(a, { ...raw, newDamage: 5, criticalHit: true }),
    /critical hit’s bruising/
  );
  assert.equal(a.system.accumulatedDamage.subdual, 14);
  assert.equal(Object.keys(a.flags.spycraft2.damageEvents ?? {}).length, 0);
});
test("final-net mode never applies DR/resistance twice, and fully resisted critical bruising records zero with no new save", async () => {
  let a = actor({ resistance: 1 });
  await reviewDamageLedger(a, baseline);
  let r = await applyAccumulatedDamage(a, { ...raw, damageMode: "net", newDamage: 4 });
  assert.equal(r.newDamage, 4);
  assert.equal(r.defenseContext, null);
  a = actor({ resistance: 1 });
  await reviewDamageLedger(a, baseline);
  r = await applyAccumulatedDamage(a, { ...raw, newDamage: 5, criticalHit: true });
  assert.equal(r.newDamage, 0);
  assert.equal(r.criticalHit, true);
  assert.equal(r.save, null);
  assert.equal(a.system.accumulatedDamage.pending.length, 0);
});
