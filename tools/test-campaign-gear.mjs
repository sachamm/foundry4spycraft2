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
import { missionCaliberPlan, missionCaliberMatches } from "../module/rules/mission-gear.mjs";
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
