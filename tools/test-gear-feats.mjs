import test from "node:test";
import assert from "node:assert/strict";
import { motherHenItem, motherHenTransfer } from "../module/rules/mother-hen.mjs";
import { favoredGearState, signatureBonus, trademarkBoost } from "../module/rules/favored-gear.mjs";
import { weaponDamage } from "../module/rules/gear.mjs";
import { actionDieBoostPlan } from "../module/rules/action-dice.mjs";

const owner = feats => ({ system: { activeFeatNames: feats } });
const item = (system = {}, extra = {}) => ({
  id: "i1",
  uuid: "Actor.a.Item.i1",
  name: "Lucky pistol",
  type: "weapon",
  system: { possessionSource: "wealth", possessionApproved: true, ...system },
  ...extra
});

test("Mother Hen covers the owner's approved Possessions only", () => {
  assert.ok(motherHenItem(item(), owner(["Mother Hen"])));
  assert.ok(motherHenItem(item({ possessionSource: "gcGrant" }), owner(["Mother Hen"])));
  assert.ok(motherHenItem(item({ possessionSource: "favoredGear" }), owner(["Mother Hen"])));
  assert.equal(motherHenItem(item(), owner([])), false);
  assert.equal(motherHenItem(item({ possessionApproved: false }), owner(["Mother Hen"])), false);
  assert.equal(
    motherHenItem(item({ possessionSource: "" }), owner(["Mother Hen"])),
    false,
    "mission gear is not a Possession"
  );
});

test("Mother Hen's Reflex save moves half the damage, rounded up, to the owner", () => {
  assert.deepEqual(motherHenTransfer(9, 9), { saved: true, toOwner: 5, toItem: 4 });
  assert.deepEqual(motherHenTransfer(9, 8), { saved: false, toOwner: 0, toItem: 9 });
  assert.deepEqual(motherHenTransfer(1, 20), { saved: true, toOwner: 1, toItem: 0 });
  assert.throws(() => motherHenTransfer(0, 10));
  assert.throws(() => motherHenTransfer(5, NaN));
});

test("Favored Gear: one favored item per feat, within a third of career level", () => {
  const sys = (feats, level = 6) => ({ level, activeFeatSelections: feats.map(name => ({ name })) });
  const fav = (caliber, extra = {}) => item({ possessionSource: "favoredGear", caliber, ...extra });
  assert.deepEqual(favoredGearState(sys(["Favored Gear"]), [fav(2)]).warnings, []);
  assert.match(favoredGearState(sys(["Favored Gear"]), [fav(3)]).warnings.join(), /may not exceed 2/);
  assert.match(favoredGearState(sys([]), [fav(1)]).warnings.join(), /allows 0/);
  assert.equal(favoredGearState(sys(["Favored Gear"], 7), [fav(3)]).warnings.length, 0, "rounded up");
});

test("Signature and Trademark Gear give +1 / +2 morale on a favored item, only as often as the feats allow", () => {
  const sys = feats => ({ level: 9, activeFeatSelections: feats.map(name => ({ name })) });
  const fav = signatureGear => item({ possessionSource: "favoredGear", caliber: 1, signatureGear });
  const one = favoredGearState(sys(["Favored Gear", "Signature Gear"]), [fav(1)]);
  assert.deepEqual(one.bonus, { i1: 1 });
  assert.deepEqual(one.trademark, []);
  const two = favoredGearState(sys(["Favored Gear", "Signature Gear", "Trademark Gear"]), [fav(2)]);
  assert.deepEqual(two.bonus, { i1: 2 });
  assert.deepEqual(two.trademark, ["Actor.a.Item.i1"]);
  assert.deepEqual(favoredGearState(sys(["Favored Gear"]), [fav(1)]).bonus, {}, "Signature Gear not held");
  assert.deepEqual(favoredGearState(sys(["Favored Gear", "Signature Gear"]), [fav(2)]).bonus, {}, "Trademark not held");
  const wealth = favoredGearState(sys(["Favored Gear", "Signature Gear"]), [item({ signatureGear: 1 })]);
  assert.deepEqual(wealth.bonus, {});
  assert.match(wealth.warnings.join(), /only to an item gained from Favored Gear/);
  assert.equal(signatureBonus({ favoredGear: two }, "i1"), 2);
  assert.equal(signatureBonus({ favoredGear: two }, "other"), 0);
});

test("the morale bonus reaches the item's damage, and Trademark doubles boost dice on its rolls", () => {
  const state = favoredGearState(
    {
      level: 9,
      activeFeatSelections: [{ name: "Favored Gear" }, { name: "Signature Gear" }, { name: "Trademark Gear" }]
    },
    [item({ possessionSource: "favoredGear", caliber: 1, signatureGear: 2 })]
  );
  const system = { abilities: { str: { mod: 0 } }, favoredGear: state };
  const w = { id: "i1", proficiency: "handgun", damage: "1d10" },
    plain = weaponDamage({ abilities: { str: { mod: 0 } } }, w),
    signed = weaponDamage(system, w);
  assert.equal(signed.bonus - plain.bonus, 2);
  assert.equal(weaponDamage(system, { ...w, id: "other" }).bonus, plain.bonus);
  assert.ok(trademarkBoost(system, { checkKind: "damage", weaponUuid: "Actor.a.Item.i1" }));
  assert.ok(trademarkBoost(system, { checkKind: "skill", gearUuid: "Actor.a.Item.i1" }));
  assert.equal(trademarkBoost(system, { checkKind: "attack", weaponUuid: "Actor.a.Item.i1" }), false);
  const dice = { ...system, actionDice: { value: 3, die: 6 } };
  assert.equal(actionDieBoostPlan(dice, { checkKind: "damage", weaponUuid: "Actor.a.Item.i1" }).rolls, 2);
  assert.equal(actionDieBoostPlan(dice, { checkKind: "damage", weaponUuid: "Actor.a.Item.x" }).rolls, 1);
});
