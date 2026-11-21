import test from "node:test";
import assert from "node:assert/strict";
import { actor, controls, opts } from "./fixtures/side-stance.mjs";
import { bullseyePlan as plan } from "../module/rules/bullseye.mjs";
import { bullseyeInput, bullseyeContent } from "../module/apps/standard-attack-context.mjs";
import { weaponDamage } from "../module/rules/gear.mjs";
import { attackDamageUseRows, reviewAttackDamageBenefit } from "../module/apps/attack-damage-benefits.mjs";
import { settleMeleeTradeoffMiss } from "../module/apps/melee-tradeoff-outcomes.mjs";
import { rollEvidence } from "../module/rules/outcomes.mjs";
const make = () => {
    const a = actor();
    a.system.activeFeatNames = ["Bullseye"];
    a.system.combatStance = null;
    a.system.proficiencyTotals.handgun = { proficient: true };
    Object.assign(a.items[0].system, {
      proficiency: "handgun",
      weaponCategory: "servicePistol",
      fireModes: ["single", "burst"],
      fireMode: "single",
      qualities: "",
      range: 30,
      sizeHands: "D/1h",
      damage: "2d6"
    });
    return a;
  },
  options = (extra = {}) => ({ ...opts(), bullseyePenalty: 2, bullseyeSingleShotConfirmed: true, ...extra }),
  attack = (a, extra = {}) => a.rollAttack(a.items[0], options(extra)),
  hit = async (a = make()) => {
    const m = await attack(a);
    Object.assign(m.flags.spycraft2, { resolved: true, successConfirmed: true });
    return { a, m };
  },
  damageOptions = m => ({ includeSneakAttack: false, attackDamageSourceUuid: m.uuid, targetActorUuid: "Actor.target" });
test("Bullseye accepts each whole penalty through current Dexterity modifier+2 and grants an equal damage bonus", () => {
  const a = make(),
    w = { ...a.items[0].system, id: a.items[0].id },
    base = {
      ranged: true,
      action: "standard",
      singleShotConfirmed: true,
      targetUuid: "Actor.target",
      firing: { firearm: true, fireMode: "single" }
    };
  for (let penalty = 1; penalty <= 3; penalty++) {
    const p = plan(a.system, w, { ...base, penalty });
    assert.equal(p.attackPenalty, -penalty);
    assert.equal(p.damageBonus, penalty);
  }
  assert.equal(plan(a.system, w), null);
  for (const penalty of [-1, 0.5, 4, "2", true, NaN, Infinity])
    assert.throws(() => plan(a.system, w, { ...base, penalty }));
});
test("only a confirmed one-shot ranged Standard Attack qualifies, never burst/autofire/other/melee or a defensive check", () => {
  const a = make(),
    w = { ...a.items[0].system, id: a.items[0].id },
    base = {
      penalty: 2,
      ranged: true,
      action: "standard",
      singleShotConfirmed: true,
      targetUuid: "Actor.target",
      firing: { firearm: true, fireMode: "single" }
    };
  for (const patch of [
    { ranged: false },
    { ranged: "true" },
    { action: "other" },
    { action: "autofire" },
    { disarm: true },
    { singleShotConfirmed: false },
    { singleShotConfirmed: "true" },
    { firing: { firearm: true, fireMode: "burst" } },
    { firing: { firearm: true, fireMode: "auto" } },
    { firing: { firearm: true, fireMode: "single", blocked: true } },
    { aimBrace: { blocked: true } }
  ])
    assert.throws(() => plan(a.system, w, { ...base, ...patch }));
  assert.throws(() => plan({ ...a.system, activeFeatNames: [] }, w, base));
});
test("one-shot hurled/bow attacks qualify without inventing a firearm mode; placement and unknown nonfirearm profiles cannot qualify", () => {
  const a = make(),
    base = { penalty: 2, ranged: true, action: "standard", singleShotConfirmed: true, targetUuid: "Actor.target" };
  for (const proficiency of ["hurled", "exoticHurled"])
    assert.equal(plan(a.system, { id: "ranged", proficiency }, { ...base }).fireMode, null);
  for (const proficiency of ["edged", "unarmed", "explosives", "unknown"])
    assert.throws(() => plan(a.system, { id: "notRanged", proficiency }, base));
});
test("UI parsing is strict and the actual current cap is displayed", () => {
  const a = make();
  assert.deepEqual(bullseyeInput({ bullseyePenalty: "2", bullseyeSingleShotConfirmed: true }), {
    bullseyePenalty: 2,
    bullseyeSingleShotConfirmed: true
  });
  for (const patch of [
    { bullseyePenalty: true },
    { bullseyePenalty: "1.5" },
    { bullseyePenalty: 2, bullseyeSingleShotConfirmed: "true" },
    { bullseyePenalty: 2, bullseyeTargetConfirmed: 1 }
  ])
    assert.throws(() => bullseyeInput(patch));
  assert.match(bullseyeContent(a), /max="3"/);
  assert.equal(bullseyeContent({ system: {} }), "");
});
test("actual ranged hit records its one-shot declaration and claims an equal bonus once before minimum damage", async () => {
  const { a, m } = await hit(),
    c = m.flags.spycraft2,
    base = weaponDamage(a.system, a.items[0].system);
  assert.equal(c.attackContext.bullseye.singleShotConfirmed, true);
  assert.equal(c.attackContext.bullseye.damageBonus, 2);
  const d = await a.rollDamage(a.items[0], damageOptions(m));
  assert.equal(d.flags.spycraft2.finesseDamage.bonus, base.bonus + 2);
  assert.equal(d.flags.spycraft2.attackDamageBenefit.source, "Bullseye");
  assert.equal(a.system.attackDamageUses.length, 1);
  await assert.rejects(a.rollDamage(a.items[0], damageOptions(m)), /already has damage/);
});
test("live Dexterity, recoil Strength, proficiency, mode and source changes reject unpublished Bullseye attacks", async () => {
  for (const change of [
    a => a.system.abilities.dex.mod++,
    a => a.system.abilities.str.value++,
    a => (a.system.proficiencyTotals.handgun.proficient = false),
    a => (a.items[0].system.fireModes = ["burst"]),
    a => (a.system.activeFeatNames = [])
  ]) {
    const a = make();
    controls.draw = async () => change(a);
    await assert.rejects(attack(a), /changed/);
    assert.equal(game.messages.length, 0);
  }
});
test("mid-RNG weapon/ammunition profile changes cannot retain the original Bullseye declaration", async () => {
  for (const change of [
    a => (a.items[0].system.damage = "8d12"),
    a => (a.items[0].system.qualities = "AP (99)"),
    a => (a.items[0].system.useHands = 2)
  ]) {
    const a = make();
    controls.draw = async () => change(a);
    await assert.rejects(attack(a), /changed/);
    assert.equal(game.messages.length, 0);
  }
});
test("earned Bullseye damage survives later Dexterity/feat loss, but rejects a different weapon or ammunition damage profile", async () => {
  let { a, m } = await hit();
  a.system.activeFeatNames = [];
  a.system.abilities.dex.mod = 0;
  assert.equal((await a.rollDamage(a.items[0], damageOptions(m))).flags.spycraft2.attackDamageBenefit.bonus, 2);
  for (const change of [
    a => (a.items[0].system.damage = "9d12"),
    a => (a.items[0].system.loadedAmmoId = "another"),
    a => (a.items[0].system.proficiency = "rifle")
  ]) {
    ({ a, m } = await hit());
    change(a);
    await assert.rejects(a.rollDamage(a.items[0], damageOptions(m)), /changed/);
    assert.equal(attackDamageUseRows(a.system).length, 0);
  }
});
test("the same weapon’s different actual opponent cannot inherit a recorded Bullseye damage bonus", async () => {
  const { a, m } = await hit();
  await assert.rejects(
    a.rollDamage(a.items[0], { ...damageOptions(m), targetActorUuid: "Actor.other" }),
    /actual target/
  );
  assert.equal(a.system.attackDamageUses, undefined);
});
test("actual owned attack replacements preserve the original declared penalty after attribute change", async () => {
  const a = make(),
    m = await attack(a),
    c = m.flags.spycraft2;
  a.system.abilities.dex.mod = 0;
  const r = await a.rollCheck(c.formula, c.rollData, { ...c, rerollOf: m.uuid });
  assert.equal(r.flags.spycraft2.attackContext.bullseye.maximum, c.attackContext.bullseye.maximum);
  Object.assign(c, { resolved: true, superseded: r.uuid });
  Object.assign(r.flags.spycraft2, { resolved: true, successConfirmed: true });
  const d = await a.rollDamage(a.items[0], damageOptions(r));
  assert.equal(d.flags.spycraft2.attackDamageBenefit.rootAttackUuid, m.uuid);
});
test("Bullseye outcome evidence binds its exact shot declaration and variable bonus", async () => {
  const { m } = await hit(),
    c = m.flags.spycraft2;
  for (const patch of [{ penalty: 3 }, { singleShotConfirmed: false }, { fireMode: "burst" }])
    assert.notEqual(
      rollEvidence(c),
      rollEvidence({ ...c, attackContext: { ...c.attackContext, bullseye: { ...c.attackContext.bullseye, ...patch } } })
    );
});
test("concurrent damage, posting failure and committed-response recovery share the existing single root claim", async () => {
  let { a, m } = await hit(),
    r = await Promise.allSettled([
      a.rollDamage(a.items[0], damageOptions(m)),
      a.rollDamage(a.items[0], damageOptions(m))
    ]);
  assert.equal(r.filter(x => x.status === "fulfilled").length, 1);
  for (const mode of ["before", "after"]) {
    ({ a, m } = await hit());
    controls.mode = mode;
    r = await Promise.allSettled([a.rollDamage(a.items[0], damageOptions(m))]);
    assert.equal(r[0].status, mode === "after" ? "fulfilled" : "rejected");
    assert.equal(attackDamageUseRows(a.system).length, mode === "after" ? 1 : 0);
  }
});

test("a recorded bow shot uses its original projectile after the last arrow is spent, without restoring the depleted stockpile", async () => {
  const a = make(),
    w = a.items[0];
  w.name = "Bow";
  Object.assign(w.system, {
    proficiency: "hurled",
    weaponCategory: "other",
    fireModes: [],
    fireMode: "",
    sizeHands: "M/2h",
    useHands: 2,
    damage: "as arrow",
    loadedAmmoId: "arrow"
  });
  a.system.proficiencyTotals.hurled = { proficient: true };
  const ammo = {
    id: "arrow",
    uuid: a.uuid + ".Item.arrow",
    type: "weapon",
    name: "Standard arrow",
    system: { ammunitionOnly: true, ammunitionKind: "arrow", damage: "1d6", errorThreat: "+0/—", quantity: 1 }
  };
  a.items.push(ammo);
  const { m } = await hit(a);
  ammo.system.quantity = 0;
  const d = await a.rollDamage(w, damageOptions(m));
  assert.equal(d.flags.spycraft2.attackDamageBenefit.projectile.damage, "1d6");
  assert.match(d.flags.spycraft2.formula, /1d6/);
  assert.equal(d.flags.spycraft2.finesseDamage.bonus, 3);
  assert.equal(ammo.system.quantity, 0);
  assert.equal(d.flags.spycraft2.attackDamageBenefit.hands, 2);
});
test("a different projectile profile cannot replace the ammunition used by the recorded bow shot", async () => {
  const a = make(),
    w = a.items[0];
  w.name = "Bow";
  Object.assign(w.system, {
    proficiency: "hurled",
    weaponCategory: "other",
    fireModes: [],
    fireMode: "",
    sizeHands: "M/2h",
    useHands: 2,
    damage: "as arrow",
    loadedAmmoId: "arrow"
  });
  a.system.proficiencyTotals.hurled = { proficient: true };
  const ammo = {
    id: "arrow",
    uuid: a.uuid + ".Item.arrow",
    type: "weapon",
    name: "Standard arrow",
    system: { ammunitionOnly: true, ammunitionKind: "arrow", damage: "1d6", errorThreat: "+0/—", quantity: 1 }
  };
  a.items.push(ammo);
  const { m } = await hit(a);
  ammo.system.damage = "6d12";
  await assert.rejects(a.rollDamage(w, damageOptions(m)), /ammunition damage profile changed/);
  assert.equal(a.system.attackDamageUses, undefined);
});
test("a named GC-confirmed object receives Bullseye once without an Actor target", async () => {
  const a = make(),
    m = await attack(a, { targetActorUuid: "", bullseyeTargetName: "Security camera", bullseyeTargetConfirmed: true });
  Object.assign(m.flags.spycraft2, { resolved: true, successConfirmed: true });
  const d = await a.rollDamage(a.items[0], {
    includeSneakAttack: false,
    attackDamageSourceUuid: m.uuid,
    targetActorUuid: ""
  });
  assert.equal(d.flags.spycraft2.attackDamageBenefit.manualTargetName, "Security camera");
  assert.equal(d.flags.spycraft2.attackDamageBenefit.bonus, 2);
});
test("actual invalid shot/action declarations stop before RNG and leave every damage use untouched", async () => {
  for (const patch of [
    { attackAction: "other" },
    { attackAction: "autofire" },
    { bullseyeSingleShotConfirmed: false },
    { fireMode: "burst" }
  ]) {
    const a = make();
    let draws = 0;
    controls.draw = async () => draws++;
    assert.equal(await attack(a, patch), false);
    assert.equal(draws, 0);
    assert.equal(game.messages.length, 0);
    assert.equal(a.system.attackDamageUses, undefined);
  }
});
test("Aim/Brace source and actual firing support remain validated during a Bullseye roll", async () => {
  const a = make();
  a.system.activeFeatNames.push("Marksmanship Basics");
  controls.draw = async () => {
    a.system.activeFeatNames = a.system.activeFeatNames.filter(n => n !== "Marksmanship Basics");
  };
  await assert.rejects(attack(a, { aimed: true, braced: true, stableSurface: false }), /changed/);
  assert.equal(game.messages.length, 0);
});

test("an authenticated original damage reroll retains its fixed formula after later profile changes, while a fresh claim still rejects the changed profile", async () => {
  const { a, m } = await hit(),
    d = await a.rollDamage(a.items[0], damageOptions(m)),
    c = d.flags.spycraft2;
  a.items[0].system.damage = "12d12";
  const r = await a.rollCheck(c.formula, c.rollData, { ...c, rerollOf: d.uuid });
  assert.equal(r.flags.spycraft2.formula, c.formula);
  assert.equal(r.flags.spycraft2.attackDamageBenefit.bonus, 2);
  assert.equal(a.system.attackDamageUses.length, 1);
  await assert.rejects(a.rollDamage(a.items[0], damageOptions(m)), /profile changed/);
});
test("GC attachment of an already posted result uses its historical facts after Item deletion, but cannot authorize another roll without the owned source", async () => {
  const { a, m } = await hit(),
    w = a.items[0],
    d = await a.rollDamage(w, damageOptions(m)),
    c = d.flags.spycraft2,
    use = a.system.attackDamageUses[0];
  use.receiptUuid = null;
  a.items.splice(0, 1);
  const count = game.messages.length;
  assert.equal(
    (await reviewAttackDamageBenefit(a, { reservationId: use.reservationId, confirmed: true })).receiptUuid,
    d.uuid
  );
  assert.equal(game.messages.length, count);
  await assert.rejects(a.rollCheck(c.formula, c.rollData, { ...c, rerollOf: d.uuid }), /weapon/);
  assert.equal(game.messages.length, count);
});

test("actual launcher mode retains its operating proficiency through Bullseye and rejects mismatched damage mode without spending a use", async () => {
  const a = make(),
    w = a.items[0];
  Object.assign(w.system, {
    proficiency: "tactical",
    weaponCategory: "grenadeLauncher",
    fireModes: ["single"],
    mountRequirement: "optionalUnderbarrel"
  });
  a.system.proficiencyTotals.tactical = { proficient: true };
  a.system.proficiencyTotals.indirectFire = { proficient: true };
  const m = await attack(a, { indirectFire: true, underbarrelMountConfirmed: true });
  Object.assign(m.flags.spycraft2, { resolved: true, successConfirmed: true });
  assert.equal(m.flags.spycraft2.weaponProficiency, "indirectFire");
  await assert.rejects(
    a.rollDamage(w, { ...damageOptions(m), indirectFire: false, underbarrelMountConfirmed: true }),
    /operating proficiency/
  );
  assert.equal(attackDamageUseRows(a.system).length, 0);
  const d = await a.rollDamage(w, { ...damageOptions(m), indirectFire: true, underbarrelMountConfirmed: true });
  assert.equal(d.flags.spycraft2.attackDamageBenefit.operatingProficiency, "indirectFire");
  assert.equal(d.flags.spycraft2.weaponProficiency, "indirectFire");
});
test("a ranged Bullseye attack discards a pending Side die and works inside the existing base resource queue", async () => {
  const { source } = await import("./fixtures/side-stance.mjs"),
    { grantSideStanceFeint } = await import("../module/apps/side-stance.mjs"),
    { sideStanceAttackPlan } = await import("../module/rules/side-stance.mjs"),
    { queueResources } = await import("../module/services/transactions.mjs"),
    a = make();
  a.system.activeFeatNames.push("Fencing Basics");
  a.system.combatStance = { version: 1, key: "side", id: "side1" };
  const f = source(a);
  await grantSideStanceFeint(a, f.s, f.feint);
  const m = await queueResources([a], () => attack(a));
  assert.equal(m.flags.spycraft2.attackContext.sideStance.dice, 0);
  assert.equal(a.system.combatStance, null);
  a.system.combatStance = { version: 1, key: "side", id: "newSide" };
  assert.equal(sideStanceAttackPlan(a.system, { targetUuid: "Actor.target" }).dice, 0);
});
test("actual Bullseye miss settlement applies one flat-footed condition and cannot refresh it after clearing", async () => {
  const a = make(),
    m = await attack(a);
  Object.assign(m.flags.spycraft2, { resolved: true, successConfirmed: false });
  m.update = async patch => {
    for (const [k, v] of Object.entries(patch)) m.flags.spycraft2[k.split(".").at(-1)] = structuredClone(v);
    return m;
  };
  a.statuses = new Set();
  a.effects = [];
  CONFIG.statusEffects.push({ id: "flat-footed", name: "Flat-footed" });
  a.createEmbeddedDocuments = async (type, rows) => {
    if (type !== "ActiveEffect") throw Error("Unexpected " + type);
    const es = rows.map((r, i) => ({ ...r, id: "flat" + i, statuses: new Set(r.statuses) }));
    a.effects.push(...es);
    for (const e of es) for (const s of e.statuses) a.statuses.add(s);
    return es;
  };
  await Promise.all([settleMeleeTradeoffMiss(a, m), settleMeleeTradeoffMiss(a, m)]);
  assert.equal(a.effects.length, 1);
  assert.equal(m.flags.spycraft2.meleeTradeoffSettlement.source, "Bullseye");
  a.effects = [];
  a.statuses.clear();
  await settleMeleeTradeoffMiss(a, m);
  assert.equal(a.effects.length, 0);
});
test("the real catalog/engine prerequisite uses Dexterity13, and the declared cap follows Dexterity rather than Strength", async () => {
  const { readFileSync } = await import("node:fs"),
    { computeAgent } = await import("../module/rules/engine.mjs"),
    { SPYCRAFT: cfg } = await import("../module/config.mjs"),
    { weaponAttack } = await import("../module/rules/gear.mjs"),
    f = JSON.parse(readFileSync(new URL("../src/data/feats.json", import.meta.url))).find(f => f.name === "Bullseye"),
    cls = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))).find(c => c.key === "soldier"),
    agile = JSON.parse(readFileSync(new URL("../src/data/origins.json", import.meta.url))).talents.find(
      o => o.name === "Agile"
    ),
    items = [
      {
        id: "class",
        type: "class",
        name: cls.name,
        system: { ...cls, identifier: "soldier", vitalityDie: cls.vitality }
      },
      { id: "feat", type: "feat", name: f.name, system: { ...f, tree: "rangedCombat", acquiredAtLevel: 1 } },
      { id: "agile", type: "origin", name: agile.name, system: agile }
    ],
    raw = {
      abilities: Object.fromEntries(
        ["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: k === "dex" ? 11 : 12 }])
      ),
      progression: [{ classId: "soldier", vitality: 6, skills: {} }],
      skills: {},
      focuses: {},
      proficiencies: { handgun: { proficient: true } },
      misc: {},
      actionDice: { value: 0 },
      vitality: { value: 4 },
      wounds: { value: 4 }
    },
    w = {
      id: "gun",
      proficiency: "handgun",
      weaponCategory: "servicePistol",
      fireModes: ["single"],
      sizeHands: "D/1h",
      damage: "2d6",
      range: 30,
      error: 1,
      threat: 20
    },
    s = computeAgent(raw, items, cfg);
  assert.equal(s.abilities.dex.value, 13);
  assert.equal(s.featStatus.feat.ok, true);
  const p = weaponAttack(s, w, cfg, "agent", {
    attackAction: "standard",
    bullseyePenalty: 3,
    bullseyeSingleShotConfirmed: true,
    targetActorUuid: "Actor.target"
  });
  assert.equal(p.bullseye.damageBonus, 3);
  raw.abilities.dex.base = 10;
  const lost = computeAgent(raw, items, cfg);
  assert.equal(lost.featStatus.feat.ok, false);
  assert.equal(
    weaponAttack(lost, w, cfg, "agent", {
      attackAction: "standard",
      bullseyePenalty: 1,
      bullseyeSingleShotConfirmed: true,
      targetActorUuid: "Actor.target"
    }).blocked,
    true
  );
});
