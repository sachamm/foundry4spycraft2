import test from "node:test";
import assert from "node:assert/strict";
import { actor, controls, opts } from "./fixtures/side-stance.mjs";
import { prep } from "./fixtures/feint.mjs";
import { weaponDamage } from "../module/rules/gear.mjs";
import { meleeTrickContent, meleeTrickInput } from "../module/apps/standard-attack-context.mjs";
import { reviewAttackDamageBenefit } from "../module/apps/attack-damage-benefits.mjs";
const make = () => {
    const a = actor(),
      w = a.items[0];
    Object.assign(w.system, {
      proficiency: "blunt",
      meleeFamily: "hammer",
      sizeHands: "S/1h",
      useHands: 1,
      qualities: "",
      damage: "1d6"
    });
    a.system.combatStance = null;
    a.system.activeFeatNames.push("Hammer Basics", "All-out Attack");
    a.system = prep(a.system, a.items);
    return a;
  },
  input = () => ({
    ...opts(),
    meleeTrick: "crush",
    meleeTrickFullActionConfirmed: true,
    meleeTrickOnlyConfirmed: true
  }),
  attack = (a, extra = {}) => a.rollAttack(a.items[0], { ...input(), ...extra }),
  hit = async (extra = {}) => {
    const a = make(),
      m = await attack(a, extra);
    Object.assign(m.flags.spycraft2, { resolved: true, successConfirmed: true });
    return { a, m };
  },
  damage = (a, m) =>
    a.rollDamage(a.items[0], {
      includeSneakAttack: false,
      attackDamageSourceUuid: m.uuid,
      targetActorUuid: "Actor.target"
    });
test("Crush is offered only by earned Hammer Basics, parses its confirmations and does not offer Hack without its feat", () => {
  const a = make(),
    ui = meleeTrickContent(a);
  assert.match(ui, /Crush!.*hammer, \+2 attack, \+5 damage/);
  assert.doesNotMatch(ui, />Hack!/);
  assert.equal(meleeTrickInput({ meleeTrick: "crush" }).meleeTrick, "crush");
  for (const raw of [true, "constructor", "toString", "unknown"])
    assert.throws(() => meleeTrickInput({ meleeTrick: raw }));
});
test("actual Crush adds +2 attack and +5 recorded damage once, preserving threat and base weapon qualities", async () => {
  const a = make(),
    w = a.items[0],
    normal = a.weaponAttack(w, opts()),
    base = weaponDamage(a.system, w.system),
    m = await attack(a),
    c = m.flags.spycraft2;
  assert.equal(c.rawTotal, 12 + normal.total + 2);
  assert.equal(c.threat, normal.threat);
  assert.equal(c.attackContext.meleeTrick.threatIncrease, 0);
  assert.equal(c.weaponQualities, "AP (2)");
  Object.assign(c, { resolved: true, successConfirmed: true });
  const d = await damage(a, m);
  assert.equal(d.flags.spycraft2.attackDamageBenefit.source, "Crush!");
  assert.equal(d.flags.spycraft2.attackDamageBenefit.bonus, 5);
  assert.equal(d.flags.spycraft2.finesseDamage.bonus, base.bonus + 5);
  assert.equal(d.flags.spycraft2.weaponQualities, "AP (2)");
  await assert.rejects(damage(a, m), /already has damage/);
});
test("Crush plus All-out combines +5 and twice the chosen penalty in one authenticated result", async () => {
  const { a, m } = await hit({ allOutPenalty: 2 }),
    d = await damage(a, m);
  assert.equal(d.flags.spycraft2.attackDamageBenefit.source, "All-out Attack + Crush!");
  assert.equal(d.flags.spycraft2.attackDamageBenefit.bonus, 9);
  assert.equal(a.system.attackDamageUses.length, 1);
  assert.equal(a.system.attackDamageUses[0].receiptUuid, d.uuid);
});
test("a held sword, another held hammer, thrown hammer and unconfirmed/nonstandard Crush declarations cannot roll", async () => {
  for (const change of [
    a => (a.items[0].system.meleeFamily = "twoHandedSword"),
    a => (a.items[0].system.equipped = false),
    a => (a.items[0].system.proficiency = "hurled")
  ]) {
    const a = make();
    change(a);
    a.system = prep(a.system, a.items);
    let draws = 0;
    controls.draw = async () => draws++;
    await attack(a);
    assert.equal(draws, 0);
    assert.equal(game.messages.length, 0);
  }
  for (const patch of [
    { attackAction: "other" },
    { meleeTrickFullActionConfirmed: false },
    { meleeTrickOnlyConfirmed: false },
    { meleeFeatTrick: "hack" }
  ]) {
    const a = make();
    await attack(a, patch);
    assert.equal(game.messages.length, 0);
  }
});
test("Crush rejects live readiness/grip/feat or damage profile drift before publishing", async () => {
  for (const change of [
    a => {
      a.items[0].system.equipped = false;
      a.system = prep(a.system, a.items);
    },
    a => {
      a.items[0].system.useHands = 2;
      a.system = prep(a.system, a.items);
    },
    a => (a.system.activeFeatNames = []),
    a => (a.items[0].system.damage = "3d6")
  ]) {
    const a = make();
    controls.draw = async () => change(a);
    await assert.rejects(attack(a), /changed|requires/);
    assert.equal(game.messages.length, 0);
  }
});
test("owned original Crush replacements preserve the earned declaration and share one original root", async () => {
  const a = make(),
    m = await attack(a),
    c = m.flags.spycraft2;
  a.system.activeFeatNames = a.system.activeFeatNames.filter(n => n !== "Hammer Basics");
  const r = await a.rollCheck(c.formula, c.rollData, { ...c, rerollOf: m.uuid });
  Object.assign(r.flags.spycraft2, { resolved: true, successConfirmed: true });
  Object.assign(c, { resolved: true, superseded: r.uuid });
  const d = await damage(a, r);
  assert.equal(d.flags.spycraft2.attackDamageBenefit.rootAttackUuid, m.uuid);
  assert.equal(d.flags.spycraft2.attackDamageBenefit.bonus, 5);
  assert.equal(a.system.attackDamageUses.length, 1);
});
test("Crush posted damage with failed stamps is recovered exactly without rolling or refreshing its use", async () => {
  const { a, m } = await hit(),
    update = a.update;
  let failures = 0;
  a.update = async p => {
    if (p["system.attackDamageUses"]?.some(r => r.receiptUuid) && failures++ < 2) throw Error("stamp failed");
    return update(p);
  };
  await assert.rejects(damage(a, m), /review/);
  a.update = update;
  const row = a.system.attackDamageUses[0],
    receipt = game.messages.find(m => m.flags.spycraft2.attackDamageBenefit),
    count = game.messages.length;
  await reviewAttackDamageBenefit(a, { reservationId: row.reservationId, confirmed: true });
  assert.equal(a.system.attackDamageUses[0].receiptUuid, receipt.uuid);
  assert.equal(game.messages.length, count);
  await assert.rejects(damage(a, m), /already has damage/);
});
test("a second held hammer cannot authorize Crush for an unready attacking hammer", async () => {
  const a = make(),
    w = a.items[0];
  a.items.push({ ...w, id: "other", uuid: a.uuid + ".Item.other", system: { ...w.system } });
  w.system.equipped = false;
  a.system = prep(a.system, a.items);
  const p = a.weaponAttack(w, input());
  assert.equal(p.blocked, true);
  assert.match(p.reason, /actual readied hammer/);
});
