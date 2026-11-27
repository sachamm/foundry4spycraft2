import test from "node:test";
import assert from "node:assert/strict";
import { campaignPickCaliber } from "../module/rules/campaign-gear.mjs";
import {
  possessionBudget,
  armorGrantPlan,
  armorGrantStatus,
  bigStickPlan,
  bigStickStatus
} from "../module/rules/gear.mjs";
import { missionCaliberPlan, missionCaliberMatches, campaignMissionBonusPicks } from "../module/rules/mission-gear.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";

const policy = shift => ({ campaignEffects: { gearCaliberShift: shift } });
const item = (id, caliber, patch = {}, type = "weapon") => ({
  id,
  name: id,
  type,
  system: { caliber, possessionSource: "wealth", possessionApproved: true, pickCount: 1, ...patch }
});

test("campaign Caliber shifts handle every boundary and leave catalog item Caliber intact", () => {
  for (let base = 1; base <= 5; base++) {
    assert.deepEqual(campaignPickCaliber(base, { gearCaliberShift: -1 }), {
      caliber: base - 1,
      extraI: 0,
      lost: base === 1
    });
    assert.deepEqual(campaignPickCaliber(base, { gearCaliberShift: 1 }), {
      caliber: Math.min(5, base + 1),
      extraI: base === 5 ? 1 : 0,
      lost: false
    });
    assert.equal(campaignPickCaliber(base).caliber, base);
  }
  assert.throws(() => campaignPickCaliber(0));
  assert.throws(() => campaignPickCaliber(3, { gearCaliberShift: 0.5 }));
  const gun = item("gun", 3),
    before = structuredClone(gun);
  assert.equal(possessionBudget([gun], "1/II", policy(1)).unfunded, 0);
  assert.deepEqual(gun, before);
  assert.equal(possessionBudget([item("small", 1)], "1/I", policy(-1)).unfunded, 1);
  assert.equal(possessionBudget([item("small", 1)], "1/II", policy(-1)).unfunded, 0);
});

test("Big Budget overflow grants exactly one linked same-category Caliber I Possession per funded source pick", () => {
  const primary = item("primary", 5),
    bonus = item("bonus", 1, { campaignBonusOf: "primary" });
  assert.equal(possessionBudget([bonus, primary], "1/V", policy(1)).unfunded, 0);
  assert.equal(
    possessionBudget([primary, bonus, item("extra", 1, { campaignBonusOf: "primary" })], "1/V", policy(1)).unfunded,
    1
  );
  assert.equal(
    possessionBudget([primary, item("wrong-type", 1, { campaignBonusOf: "primary" }, "armor")], "1/V", policy(1))
      .unfunded,
    1
  );
  assert.equal(
    possessionBudget([primary, item("too-high", 2, { campaignBonusOf: "primary" })], "1/V", policy(1)).unfunded,
    1
  );
  assert.equal(possessionBudget([bonus], "1/V", policy(1)).unfunded, 1);
  assert.equal(possessionBudget([primary, bonus], "1/V", policy(0)).unfunded, 1);
  assert.equal(possessionBudget([primary, bonus], "1/IV", policy(1)).unfunded, 1, "A pick raised to V grants no extra");
  const two = item("primary", 5, { pickCount: 2 });
  assert.equal(
    possessionBudget([two, item("bonus", 1, { campaignBonusOf: "primary", pickCount: 2 })], "2/V", policy(1)).unfunded,
    0
  );
});

test("explicit overflow sources are allocated before ordinary picks, and vehicle Possessions use the same budget", () => {
  const a = item("a", 5),
    b = item("b", 5),
    bonus = item("bonus", 1, { campaignBonusOf: "b" });
  const budget = possessionBudget([a, bonus, b], "1/IV, 1/V", policy(1));
  assert.equal(budget.unfunded, 0);
  assert.equal(budget.assignments.find(row => row.id === "b").slots[0].baseCaliber, 5);
  const car = item("car", 5, {}, "vehicle"),
    bike = item("bike", 1, { campaignBonusOf: "car" }, "vehicle");
  assert.equal(possessionBudget([car, bike], "1/V", policy(1)).unfunded, 0);
  assert.equal(possessionBudget([car], "1/I").unfunded, 1);
});

test("campaign Caliber changes apply after class mission exceptions and preserve their original mission provenance", () => {
  for (let base = 1; base <= 4; base++)
    for (const shift of [-1, 1]) {
      const s = {
        ...policy(shift),
        usagePeriods: { mission: "m" },
        missionReserves: { epoch: "m", caliber: base },
        classLevels: { wheelman: 1 }
      };
      const car = item("car", Math.min(5, base + 1 + shift), { possessionSource: "", pick: "V" }, "vehicle");
      const p = missionCaliberPlan(s, [car], { source: "customRide", itemId: car.id, intelConfirmed: true });
      s.missionCaliberPicks = { customRide: p.record };
      car.system.missionCaliberGrant = p.stamp;
      assert.equal(p.record.missionCaliber, base);
      assert.equal(missionCaliberMatches(s, car), true);
      const gun = item("gun", Math.min(5, base + 1 + shift), { possessionSource: "", pick: "W", proficiency: "rifle" });
      s.weaponSpecialist = { abilities: ["Big Stick"], proficiencies: ["rifle"] };
      assert.equal(bigStickStatus(s, [gun]).maximumCaliber, gun.system.caliber);
      assert.equal(bigStickPlan(s, [gun], { itemId: gun.id, intelConfirmed: true }).record.missionCaliber, base);
    }
});

test("Armor Use keeps the earned grade while its usable Caliber changes with the campaign", () => {
  const s = { ...policy(1), legacyAbilities: { armorUse: { freeArmorCaliber: 2 } } };
  const armor = item("armor", 3, { possessionSource: "" }, "armor");
  assert.equal(armorGrantStatus(s).caliber, 3);
  const p = armorGrantPlan(s, [armor], { itemId: armor.id, intelConfirmed: true });
  assert.equal(p.record.grade, 2);
  assert.equal(p.record.caliber, 3);
  assert.equal(armorGrantStatus({ ...policy(-1), legacyAbilities: { armorUse: { freeArmorCaliber: 1 } } }).caliber, 0);
});

test("the full engine checks shifted mission limits for vehicle gear and reviews malformed mission Caliber without crashing", () => {
  const source = caliber => ({
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
    progression: [],
    usagePeriods: { mission: "m" },
    missionReserves: { epoch: "m", caliber, picks: {}, spent: {}, common: 0 }
  });
  const car = item("car", 2, { possessionSource: "", pick: "V" }, "vehicle");
  const warns = (caliber, shift) =>
    computeAgent(source(caliber), [car], cfg, { campaignEffects: policy(shift).campaignEffects }).warnings;
  assert.ok(warns(1, 0).some(w => /Caliber exceeds/.test(w)));
  assert.equal(
    warns(1, 1).some(w => /Caliber exceeds/.test(w)),
    false
  );
  assert.ok(warns(1, -1).some(w => /Caliber exceeds/.test(w)));
  for (const bad of [0, "3", undefined, NaN])
    assert.ok(warns(bad, 1).some(w => /Review the recorded mission Caliber/.test(w)));
});

test("mission overflow is limited by paid source picks after reserves and validates category, Caliber, quantity and acquisition", () => {
  const s = {
    ...policy(1),
    usagePeriods: { mission: "m" },
    missionReserves: { epoch: "m", caliber: 5, picks: {}, spent: {} },
    gearPicks: { W: { available: 1 } }
  };
  const primary = item("primary", 5, { possessionSource: "", pick: "W" });
  const bonus = item("bonus", 1, { possessionSource: "", campaignBonusOf: "primary" });
  let p = campaignMissionBonusPicks(s, [primary, bonus]);
  assert.equal(p.assignments[0].funded, 1);
  assert.deepEqual(p.warnings, []);
  for (const patch of [
    { caliber: 2 },
    { quantity: 2 },
    { pick: "W" },
    { common: true },
    { reserveAcquisition: {} },
    { campaignBonusOf: "missing" }
  ]) {
    p = campaignMissionBonusPicks(s, [primary, { ...bonus, system: { ...bonus.system, ...patch } }]);
    assert.equal(p.assignments[0].funded, 0);
    assert.ok(p.warnings.length);
  }
  assert.equal(campaignMissionBonusPicks(s, [primary, { ...bonus, type: "armor" }]).assignments[0].funded, 0);
  s.missionReserves.picks.W = 1;
  assert.equal(campaignMissionBonusPicks(s, [primary, bonus]).assignments[0].funded, 0);
  s.missionReserves.picks.W = 0;
  const duplicate = item("duplicate", 1, { possessionSource: "", campaignBonusOf: "primary" });
  assert.equal(
    campaignMissionBonusPicks(s, [primary, bonus, duplicate]).assignments.reduce((n, row) => n + row.funded, 0),
    1
  );
});

test("class-raised mission picks and Armor Use create only their own eligible overflow, without charging the extra item", () => {
  const s = {
    ...policy(1),
    usagePeriods: { mission: "m" },
    missionReserves: { epoch: "m", caliber: 4, picks: {}, spent: {} },
    gearPicks: { V: { available: 1 } },
    classLevels: { wheelman: 1 }
  };
  const car = item("car", 5, { possessionSource: "", pick: "V" }, "vehicle");
  const p = missionCaliberPlan(s, [car], { source: "customRide", itemId: car.id, intelConfirmed: true });
  car.system.missionCaliberGrant = p.stamp;
  s.missionCaliberPicks = { customRide: p.record };
  const bike = item("bike", 1, { possessionSource: "", campaignBonusOf: "car" }, "vehicle");
  assert.equal(campaignMissionBonusPicks(s, [car, bike]).assignments[0].funded, 1);
  assert.equal(bike.system.pick, undefined);
  const armor = item("armor", 5, { possessionSource: "" }, "armor");
  const a = { ...policy(1), legacyAbilities: { armorUse: { freeArmorCaliber: 5 } } };
  const grant = armorGrantPlan(a, [armor], { itemId: armor.id, intelConfirmed: true });
  a.armorMissionGrant = grant.record;
  armor.system.armorMissionGrant = grant.stamp;
  const extra = item("helmet", 1, { possessionSource: "", campaignBonusOf: "armor" }, "armor");
  assert.equal(campaignMissionBonusPicks(a, [armor, extra]).assignments[0].funded, 1);
  assert.equal(
    campaignMissionBonusPicks(a, [armor, { ...extra, type: "gear", system: { ...extra.system, gearCategory: "S" } }])
      .assignments[0].funded,
    0
  );
});

test("full engine mission overflow spends only its source pick and keeps the extra item classified", () => {
  const s = {
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
    progression: [],
    misc: { gearW: 1 },
    usagePeriods: { mission: "m" },
    missionReserves: { epoch: "m", caliber: 5, picks: {}, spent: {}, common: 0 }
  };
  const main = item("main", 5, { possessionSource: "", pick: "W" });
  const extra = item("extra", 1, { possessionSource: "", campaignBonusOf: "main" });
  computeAgent(s, [main, extra], cfg, { campaignEffects: policy(1).campaignEffects });
  assert.equal(s.gearPicks.W.spent, 1);
  assert.equal(s.campaignMissionBonusPicks.assignments[0].funded, 1);
  assert.equal(s.wealth.possessions.budget.unclassified, 0);
  assert.deepEqual(s.campaignMissionBonusPicks.warnings, []);
  computeAgent(s, [main, extra], cfg, { campaignEffects: {} });
  assert.equal(s.campaignMissionBonusPicks.assignments[0].funded, 0);
  assert.ok(s.warnings.some(w => /extra mission item/.test(w)));
});
