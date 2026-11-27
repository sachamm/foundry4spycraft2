import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  missionCaliberSourceActive,
  missionCaliberOptions,
  missionCaliberPlan,
  missionCaliberMatches
} from "../module/rules/mission-gear.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const system = caliber => ({
  usagePeriods: { mission: "m" },
  missionReserves: { epoch: "m", caliber, picks: {}, spent: {}, common: 0 },
  classLevels: { wheelman: 1 },
  actionDice: { max: 3 },
  missionCaliberPicks: {}
});
const car = (patch = {}) => ({
  id: "car",
  name: "Vehicle",
  type: "gear",
  system: { gearCategory: "V", pick: "V", caliber: 2, quantity: 1, ...patch }
});
const options = { source: "customRide", itemId: "car", intelConfirmed: true };
test("RAW p.50 Custom Ride permits one higher-Caliber Vehicle pick in each of missions I–IV and keeps its paid pick", () => {
  for (let caliber = 1; caliber <= 4; caliber++) {
    const s = system(caliber),
      item = car({ caliber: caliber + 1 }),
      p = missionCaliberPlan(s, [item], options);
    s.missionCaliberPicks.customRide = p.record;
    item.system.missionCaliberGrant = p.stamp;
    assert.equal(item.system.pick, "V");
    assert.equal(missionCaliberMatches(s, item), true);
    assert.equal(missionCaliberOptions(s, [item]).warnings.length, 0);
    assert.throws(() => missionCaliberPlan(s, [item], options), /already/);
  }
});
test("Custom Ride accepts native or validated inherited class sources and respects both affiliations’ Vehicle CHA picks", () => {
  const s = system(2);
  assert.equal(missionCaliberSourceActive(s, "customRide"), true);
  s.classLevels = {};
  assert.equal(missionCaliberSourceActive(s, "customRide"), false);
  s.inheritedClassChoices = [{ name: "Wheelman: Custom ride" }];
  assert.equal(missionCaliberSourceActive(s, "customRide"), true);
  for (const affiliationType of ["faction", "freelance"])
    assert.ok(missionCaliberPlan({ ...s, affiliationType }, [car({ pick: "CHA" })], options));
  assert.equal(missionCaliberSourceActive(s, "unknown"), false);
});
test("Custom Ride rejects other categories, unpaid/personal/reserved/acquired/ammunition gear, extra picks and missing Intel/mission declarations", () => {
  const s = system(2);
  for (const patch of [
    { gearCategory: "W" },
    { pick: "W" },
    { pick: "" },
    { pickCount: 2 },
    { reserve: true },
    { reserveAcquisition: {} },
    { armorMissionGrant: {} },
    { possessionSource: "wealth" },
    { common: true },
    { ammunitionOnly: true },
    { caliber: 4 },
    { caliber: 0 },
    { quantity: 0 },
    { quantity: 2 },
    { missionCaliberGrant: { epoch: "m", source: "other" } }
  ])
    assert.throws(() => missionCaliberPlan(s, [car(patch)], options));
  assert.throws(() => missionCaliberPlan(s, [{ ...car(), type: "weapon" }], options));
  assert.throws(() => missionCaliberPlan(s, [car()], { ...options, intelConfirmed: false }), /Intel/);
  s.usagePeriods.mission = "next";
  assert.throws(() => missionCaliberPlan(s, [car()], options), /Record mission/);
});
test("Custom Ride retains the used exception after deletion, expires by mission, and uses upgrades rather than Caliber increases at V", () => {
  const s = system(2),
    item = car(),
    p = missionCaliberPlan(s, [item], options);
  s.missionCaliberPicks.customRide = p.record;
  item.system.missionCaliberGrant = p.stamp;
  assert.equal(missionCaliberOptions(s, []).options[0].used, true);
  assert.match(missionCaliberOptions(s, []).warnings.join(""), /missing/);
  s.usagePeriods.mission = "next";
  assert.equal(missionCaliberMatches(s, item), false);
  assert.equal(missionCaliberOptions(s, [item]).options[0].used, false);
  assert.match(missionCaliberOptions(s, [item]).warnings.join(""), /earlier mission/);
  const v = system(5);
  assert.equal(missionCaliberOptions(v).options[0].upgradeAllowance, 3);
  assert.throws(() => missionCaliberPlan(v, [car()], options), /extra upgrades/);
});
test("full engine validates Custom Ride from a fresh computation, keeps the Vehicle pick charged and rejects altered mission Caliber", () => {
  const data = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))).find(
    c => c.key === "wheelman"
  );
  const cls = {
    id: "wheelman",
    name: "Wheelman",
    type: "class",
    system: { ...structuredClone(data), identifier: "wheelman", vitalityDie: 10 }
  };
  const s = {
    ...system(1),
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 10 }])),
    progression: [{ classId: "wheelman", vitality: 5, skills: {} }],
    misc: {}
  };
  const item = car();
  computeAgent(s, [cls, item], cfg);
  assert.ok(s.warnings.some(w => w.includes("Caliber exceeds")));
  const p = missionCaliberPlan(s, [item], options);
  s.missionCaliberPicks.customRide = p.record;
  item.system.missionCaliberGrant = p.stamp;
  computeAgent(s, [cls, item], cfg);
  assert.equal(s.gearPicks.V.spent, 1);
  assert.ok(!s.warnings.some(w => w.includes("Caliber exceeds")));
  s.missionReserves.caliber = 2;
  computeAgent(s, [cls, item], cfg);
  assert.equal(missionCaliberMatches(s, item), false);
  assert.ok(s.warnings.some(w => w.includes("exception is no longer valid")));
});

test("RAW p.37 Gear Prep applies to all seven actual gear categories, including typed weapons and armor, while retaining matching pick restrictions", () => {
  for (const category of ["E", "G", "R", "S", "T", "V", "W"]) {
    const s = system(2);
    s.classLevels = { intruder: 1 };
    const item = {
      id: "car",
      name: "Pick",
      type: category === "W" ? "weapon" : category === "S" ? "armor" : "gear",
      system: { gearCategory: category, pick: category, caliber: 3, quantity: 1 }
    };
    const input = { ...options, source: "gearPrep" },
      p = missionCaliberPlan(s, [item], input);
    s.missionCaliberPicks.gearPrep = p.record;
    item.system.missionCaliberGrant = p.stamp;
    assert.equal(missionCaliberMatches(s, item), true);
    assert.equal(missionCaliberOptions(s, [item]).options.find(o => o.key === "gearPrep").used, true);
    const other = { ...item, system: { ...item.system, pick: category === "W" ? "E" : "W" } };
    assert.equal(missionCaliberMatches(s, other), false);
  }
});
test("Gear Prep is native or inherited, independently scoped from Custom Ride and cannot combine exceptions on one current pick", () => {
  const s = system(2);
  s.inheritedClassChoices = [{ name: "Intruder: Gear prep" }];
  assert.equal(missionCaliberSourceActive(s, "gearPrep"), true);
  const item = car({ caliber: 3 }),
    p = missionCaliberPlan(s, [item], options);
  s.missionCaliberPicks.customRide = p.record;
  item.system.missionCaliberGrant = p.stamp;
  assert.throws(() => missionCaliberPlan(s, [item], { ...options, source: "gearPrep" }), /cannot combine/);
  const other = { ...car({ caliber: 3 }), id: "other" };
  assert.ok(missionCaliberPlan(s, [item, other], { ...options, source: "gearPrep", itemId: "other" }));
  const v = system(5);
  v.classLevels = { intruder: 1 };
  assert.equal(missionCaliberOptions(v).options.find(o => o.key === "gearPrep").upgradeAllowance, 3);
});

test("RAW pp.48,77–78 mission gear sources require the earned option or exact expert-class milestone", () => {
  assert.equal(missionCaliberSourceActive({ classLevels: { snoop: 20 } }, "spyVsSpy"), false);
  assert.equal(
    missionCaliberSourceActive({ classOptionSelections: [{ classId: "snoop", name: "Spy vs. Spy" }] }, "spyVsSpy"),
    true
  );
  assert.equal(
    missionCaliberSourceActive({ classOptionSelections: [{ classId: "hacker", name: "Spy vs. Spy" }] }, "spyVsSpy"),
    false
  );
  for (const [key, id, level] of [
    ["executiveDecision", "politico", 10],
    ["cuttingEdge", "raptor", 3]
  ]) {
    assert.equal(
      missionCaliberSourceActive({ classLevels: { [id]: level - 1 }, inheritedClassChoices: [{}] }, key),
      false
    );
    assert.equal(missionCaliberSourceActive({ classLevels: { [id]: level } }, key), true);
  }
});
test("Spy vs. Spy, Executive Decision Resource picks and Cutting Edge use their separate categories, one pick and four mission caps", () => {
  for (const [source, category, classId, level] of [
    ["spyVsSpy", "T", "snoop", 5],
    ["executiveDecision", "R", "politico", 10],
    ["cuttingEdge", "G", "raptor", 3]
  ])
    for (let caliber = 1; caliber <= 4; caliber++) {
      const s = system(caliber);
      s.classLevels = { [classId]: level };
      s.classOptionSelections = source === "spyVsSpy" ? [{ classId: "snoop", name: "Spy vs. Spy" }] : [];
      const item = car({ gearCategory: category, pick: category, caliber: caliber + 1 }),
        input = { ...options, source },
        p = missionCaliberPlan(s, [item], input);
      s.missionCaliberPicks[source] = p.record;
      item.system.missionCaliberGrant = p.stamp;
      assert.equal(missionCaliberMatches(s, item), true);
      assert.throws(() => missionCaliberPlan(s, [item], input), /already/);
      item.system.gearCategory = "V";
      assert.equal(missionCaliberMatches(s, item), false);
      const v = { ...s, missionReserves: { epoch: "m", caliber: 5 } };
      assert.equal(missionCaliberOptions(v).options.find(o => o.key === source).upgradeAllowance, 3);
    }
});
test("Snoop’s actual earned Spy vs. Spy option activates on a fresh computation and removal immediately restores the Caliber warning", () => {
  const data = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))).find(
      c => c.key === "snoop"
    ),
    cls = {
      id: "snoop",
      name: "Snoop",
      type: "class",
      system: { ...structuredClone(data), identifier: "snoop", vitalityDie: 6, choices: {} }
    };
  const list = cls.system.choiceLists.find(l => l.options.some(o => o.name === "Spy vs. Spy")),
    index = cls.system.choiceSchedule.findIndex(s => s.list === list.key);
  cls.system.choices[index] = list.options.find(o => o.name === "Spy vs. Spy").index;
  const level = cls.system.choiceSchedule[index].level,
    s = {
      ...system(1),
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 10 }])),
      progression: Array.from({ length: level }, () => ({ classId: "snoop", vitality: 4, skills: {} })),
      misc: {}
    };
  const item = car({ gearCategory: "T", pick: "T", caliber: 2 });
  computeAgent(s, [cls, item], cfg);
  assert.equal(missionCaliberSourceActive(s, "spyVsSpy"), true);
  const p = missionCaliberPlan(s, [item], { ...options, source: "spyVsSpy" });
  s.missionCaliberPicks.spyVsSpy = p.record;
  item.system.missionCaliberGrant = p.stamp;
  computeAgent(s, [cls, item], cfg);
  assert.equal(s.gearPicks.T.spent, 1);
  assert.ok(!s.warnings.some(w => w.includes("Caliber exceeds")));
  cls.system.choices[index] = null;
  computeAgent(s, [cls, item], cfg);
  assert.equal(missionCaliberSourceActive(s, "spyVsSpy"), false);
  assert.ok(s.warnings.some(w => w.includes("Caliber exceeds")));
});

test("RAW p.72 Heavily Armed grants one paid Weapon exception at Grunt 5 and a second distinct pick at Grunt 9", () => {
  const s = system(2);
  s.classLevels = { grunt: 4 };
  assert.equal(missionCaliberSourceActive(s, "heavilyArmed"), false);
  s.classLevels.grunt = 5;
  const a = { ...car({ gearCategory: "W", pick: "W", caliber: 3 }), type: "weapon" },
    b = { ...a, id: "second", system: { ...a.system } },
    c = { ...a, id: "third", system: { ...a.system } },
    input = { ...options, source: "heavilyArmed" };
  const p = missionCaliberPlan(s, [a, b, c], input);
  s.missionCaliberPicks.heavilyArmed = p.record;
  a.system.missionCaliberGrant = p.stamp;
  assert.equal(missionCaliberOptions(s, [a, b, c]).options[0].used, true);
  assert.throws(() => missionCaliberPlan(s, [a, b, c], { ...input, itemId: "second" }), /already/);
  s.classLevels.grunt = 9;
  let status = missionCaliberOptions(s, [a, b, c]).options[0];
  assert.equal(status.selected, 1);
  assert.equal(status.limit, 2);
  assert.equal(status.remaining, 1);
  assert.equal(status.used, false);
  assert.throws(() => missionCaliberPlan(s, [a, b, c], input), /already/);
  const second = missionCaliberPlan(s, [a, b, c], { ...input, itemId: "second" });
  s.missionCaliberPicks.heavilyArmed = second.record;
  b.system.missionCaliberGrant = second.stamp;
  assert.equal(missionCaliberMatches(s, a), true);
  assert.equal(missionCaliberMatches(s, b), true);
  assert.equal(missionCaliberOptions(s, [a, b, c]).options[0].selected, 2);
  assert.throws(() => missionCaliberPlan(s, [a, b, c], { ...input, itemId: "third" }), /already/);
  status = missionCaliberOptions(s, [c]).options[0];
  assert.equal(status.remaining, 0);
  assert.equal(status.used, true);
  s.classLevels.grunt = 5;
  assert.equal(missionCaliberMatches(s, b), false);
  assert.ok(missionCaliberOptions(s, [a, b, c]).warnings.length);
});
test("Heavily Armed cannot split a multi-pick record across changed mission Calibers and does not raise a pick by two Calibers", () => {
  const s = system(1);
  s.classLevels = { grunt: 9 };
  const a = { ...car({ gearCategory: "W", pick: "W", caliber: 2 }), type: "weapon" },
    p = missionCaliberPlan(s, [a], { ...options, source: "heavilyArmed" });
  s.missionCaliberPicks.heavilyArmed = p.record;
  a.system.missionCaliberGrant = p.stamp;
  s.missionReserves.caliber = 2;
  assert.throws(
    () => missionCaliberPlan(s, [a], { ...options, source: "heavilyArmed", itemId: "other" }),
    /Review the existing/
  );
  const fresh = system(2);
  fresh.classLevels = { grunt: 9 };
  assert.throws(
    () =>
      missionCaliberPlan(fresh, [{ ...a, system: { ...a.system, caliber: 4, missionCaliberGrant: null } }], {
        ...options,
        source: "heavilyArmed"
      }),
    /at most one Caliber/
  );
});

test("legacy single-pick records remain valid, malformed extra slots fail closed, and a new mission explicitly clears old additional IDs", () => {
  const s = system(1),
    item = car({ missionCaliberGrant: { epoch: "m", source: "customRide" } });
  s.missionCaliberPicks.customRide = { epoch: "m", itemId: "car", missionCaliber: 1 };
  assert.equal(missionCaliberMatches(s, item), true);
  assert.equal(missionCaliberOptions(s, [item]).options.find(o => o.key === "customRide").used, true);
  s.classLevels = { grunt: 9 };
  s.missionCaliberPicks.heavilyArmed = { epoch: "m", itemId: "a", missionCaliber: 1, additionalItemIds: "invalid" };
  assert.throws(() => missionCaliberPlan(s, [item], { ...options, source: "heavilyArmed" }), /Review the existing/);
  s.usagePeriods.mission = "next";
  s.missionReserves = { epoch: "next", caliber: 1 };
  const weapon = { ...car({ gearCategory: "W", pick: "W", caliber: 2 }), type: "weapon" },
    plan = missionCaliberPlan(s, [weapon], { ...options, source: "heavilyArmed" });
  assert.deepEqual(plan.record.additionalItemIds, []);
  assert.equal(plan.record.epoch, "next");
});

test("Big Budget (p.405): a Caliber V pick's extra Caliber I item of the same type uses no pick", async () => {
  const { setCampaignRulesSource } = await import("../module/rules/campaign-rules.mjs");
  const data = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))).find(
    c => c.key === "wheelman"
  );
  const cls = {
    id: "wheelman",
    name: "Wheelman",
    type: "class",
    system: { ...structuredClone(data), identifier: "wheelman", vitalityDie: 10 }
  };
  const build = () => ({
    ...system(5),
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 10 }])),
    progression: [{ classId: "wheelman", vitality: 5, skills: {} }],
    misc: {}
  });
  const pair = [car({ caliber: 5 }), { ...car({ caliber: 1 }), id: "car2" }];
  let s = build();
  computeAgent(s, [cls, ...pair], cfg);
  assert.equal(s.gearPicks.V.spent, 2, "two picks without Big Budget");
  setCampaignRulesSource(() => ({ gearCaliberShift: 1 }));
  try {
    s = build();
    computeAgent(s, [cls, ...pair], cfg);
    assert.equal(s.gearPicks.V.spent, 1);
    assert.equal(s.gearPicks.V.bigBudgetExtras, 1);
    // The free item must be of the same equipment category: a Caliber I weapon on the same pick is not free.
    s = build();
    computeAgent(
      s,
      [cls, pair[0], { ...pair[1], type: "weapon", system: { ...pair[1].system, gearCategory: "" } }],
      cfg
    );
    assert.equal(s.gearPicks.V.bigBudgetExtras ?? 0, 0);
    assert.equal(s.gearPicks.V.spent, 2);
  } finally {
    setCampaignRulesSource(null);
  }
});

test("Shoe String Budget (p.408): a Caliber I mission's picks fall below I and buy no gear", async () => {
  const { setCampaignRulesSource } = await import("../module/rules/campaign-rules.mjs");
  const s = {
    ...system(1),
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 10 }])),
    progression: [],
    misc: {}
  };
  setCampaignRulesSource(() => ({ gearCaliberShift: -1 }));
  try {
    computeAgent(s, [car({ caliber: 1 })], cfg);
  } finally {
    setCampaignRulesSource(null);
  }
  assert.equal(s.gearPicks.V.available, 0);
  assert.ok(s.gearPicks.V.remaining < 0);
  assert.ok(s.warnings.some(w => /Shoe String Budget/.test(w)));
});
