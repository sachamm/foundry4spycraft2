import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { historicalCaliber, gearYearByName } from "../module/rules/gear-era.mjs";
import { setCampaignRulesSource } from "../module/rules/campaign-rules.mjs";
import { setCampaignYearSource } from "../module/rules/period-money.mjs";
import { PICK_CATEGORIES, gearAcquisitionPlan } from "../module/rules/gear-acquisition.mjs";
import { campaignEffects, activeQualities } from "../module/rules/gc/campaign.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";

const historical = { historicalGear: true };

/** Run with Historical in force and the clock at `year`, then put both back. */
function inYear(year, work, effects = historical) {
  setCampaignRulesSource(() => effects);
  setCampaignYearSource(() => year);
  try {
    return work();
  } finally {
    setCampaignRulesSource(null);
    setCampaignYearSource(null);
  }
}

test("Historical carries the gear rule as an effect (p.407)", () => {
  const { effects } = campaignEffects(activeQualities(["historical"]));
  assert.equal(effects.historicalGear, true);
});

test("an item newer than the campaign year is a gadget one Caliber higher, and none goes past V (p.407)", () => {
  const options = { effects: historical, year: 1962 };
  assert.deepEqual(historicalCaliber({ caliber: 2, year: "1970s" }, options), {
    caliber: 3,
    base: 2,
    gadget: true,
    available: true
  });
  assert.equal(historicalCaliber({ caliber: 4, year: "1963" }, options).caliber, 5);
  assert.deepEqual(historicalCaliber({ caliber: 5, year: "1980s" }, options), {
    caliber: null,
    base: 5,
    gadget: true,
    available: false
  });
  // Already out, undated, no year on the clock, or without the quality: the item keeps its own Caliber.
  assert.equal(historicalCaliber({ caliber: 2, year: "1962" }, options).gadget, false);
  assert.equal(historicalCaliber({ caliber: 2, year: "" }, options).caliber, 2);
  assert.equal(historicalCaliber({ caliber: 2, year: "1970s" }, { effects: historical, year: null }).caliber, 2);
  assert.equal(historicalCaliber({ caliber: 5, year: "1990" }, { effects: {}, year: 1962 }).available, true);
});

test("a Request reads the item's year from its compendium entry when the player leaves it blank", () => {
  assert.equal(gearYearByName("Distinject Model 35 13mm dart"), "1950");
  assert.equal(gearYearByName("distinject model 35 13mm dart"), "1950");
  assert.equal(gearYearByName("Something homemade"), "");
  assert.equal(gearYearByName("Clash", { "gear|Clash": "1960s", "weapon|Clash": "1980s" }), "", "unsure: no year");
});

const requester = caliber => ({
  affiliationType: "faction",
  usagePeriods: { mission: "m" },
  gearPicks: Object.fromEntries(PICK_CATEGORIES.map(k => [k, { remaining: 3 }])),
  missionReserves: {
    epoch: "m",
    caliber,
    picks: { R: 1 },
    charismaPicks: {},
    spent: {},
    common: 0,
    attempts: {}
  },
  requestCheck: 9,
  actionDice: { value: 5, die: 4 }
});
const request = {
  kind: "request",
  pick: "R",
  category: "R",
  caliber: 2,
  name: "Bug kit",
  itemYear: "1970s",
  location: "nearCity",
  rapidCommunication: true,
  minuteAvailable: true,
  categoryConfirmed: true,
  notIntel: true
};

test("a Request for an item not yet introduced costs, and is checked at, the gadget's Caliber (p.407)", () => {
  inYear(1962, () => {
    const plan = gearAcquisitionPlan(requester(3), request);
    assert.equal(plan.caliber, 3);
    assert.equal(plan.ownCaliber, 2);
    assert.equal(plan.historicalGadget, true);
    assert.equal(plan.dc, 30);
    assert.equal(plan.cost, 3);
    assert.throws(() => gearAcquisitionPlan(requester(2), request), /cannot exceed the current mission Caliber/);
    assert.throws(
      () => gearAcquisitionPlan(requester(4), { ...request, caliber: 4 }),
      /Requests remain|must be Caliber I–IV/
    );
    assert.equal(gearAcquisitionPlan(requester(3), { ...request, itemYear: "1950s" }).dc, 20);
  });
  inYear(1962, () =>
    assert.throws(() => gearAcquisitionPlan(requester(5), { ...request, caliber: 5 }), /pass Caliber V/)
  );
  assert.equal(gearAcquisitionPlan(requester(2), request).dc, 20, "without the quality the year changes nothing");
});

test("a Caliber V Request for an item not yet introduced is refused under Historical (p.407)", () => {
  const sys = { ...requester(5), activeFeatNames: ["Total Control"] };
  inYear(1962, () =>
    assert.throws(() => gearAcquisitionPlan(sys, { ...request, caliber: 5 }), /cannot be Requested under Historical/)
  );
  assert.equal(gearAcquisitionPlan(sys, { ...request, caliber: 5 }).dc, 50);
});

test("the sheet checks a mission pick at its gadget Caliber, and flags one past V (p.407)", () => {
  const data = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))).find(
    c => c.key === "wheelman"
  );
  const cls = {
    id: "wheelman",
    name: "Wheelman",
    type: "class",
    system: { ...structuredClone(data), identifier: "wheelman", vitalityDie: 10 }
  };
  const build = caliber => ({
    level: 1,
    usagePeriods: { mission: "m" },
    missionReserves: { epoch: "m", caliber, picks: {}, spent: {}, common: 0 },
    classLevels: { wheelman: 1 },
    actionDice: { max: 3 },
    missionCaliberPicks: {},
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 10 }])),
    progression: [{ classId: "wheelman", vitality: 5, skills: {} }],
    misc: {}
  });
  const car = (caliber, year) => ({
    id: `car${caliber}`,
    name: `Car ${caliber}`,
    type: "gear",
    system: { gearCategory: "V", pick: "V", caliber, quantity: 1, year }
  });
  const warningsFor = (caliber, item) => {
    const s = build(caliber);
    computeAgent(s, [cls, item], cfg);
    return s.warnings.filter(w => w.startsWith(item.name));
  };
  inYear(1962, () => {
    assert.match(warningsFor(2, car(2, "1970s")).join(" "), /Caliber 3 gadget \(Historical, p\.407\)/);
    assert.deepEqual(warningsFor(3, car(2, "1970s")), []);
    assert.deepEqual(warningsFor(2, car(2, "1950s")), []);
    assert.match(warningsFor(5, car(5, "1980s")).join(" "), /cannot be had under Historical/);
  });
  assert.deepEqual(warningsFor(2, car(2, "1970s")), [], "without the quality the year changes nothing");
});
