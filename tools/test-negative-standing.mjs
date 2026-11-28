import test from "node:test";
import assert from "node:assert/strict";
import { standingStatus, liquidationCheck } from "../module/rules/standing.mjs";
import { PICK_CATEGORIES, gearAcquisitionPlan, reserveInitialization } from "../module/rules/gear-acquisition.mjs";

// Negative standing (p.440): burned below 0, targeted for liquidation below −20 or −$1,000,000.
test("standing below 0 burns an agent, and far below targets them for liquidation", () => {
  assert.deepEqual(standingStatus({ reputation: 0 }), {
    currency: "reputation",
    value: 0,
    burned: false,
    liquidation: false
  });
  assert.equal(standingStatus({ reputation: -1 }).burned, true);
  assert.equal(standingStatus({ reputation: -20 }).liquidation, false);
  assert.equal(standingStatus({ reputation: -21 }).liquidation, true);
  const freelancer = { affiliationType: "freelance", reputation: -50, netWorth: 10 };
  assert.equal(standingStatus(freelancer).burned, false, "a Freelancer is read by Net Worth");
  assert.equal(standingStatus({ ...freelancer, netWorth: -1000001 }).liquidation, true);
  assert.equal(
    standingStatus({ ...freelancer, netWorth: -150000 }, { effects: { historicalMoney: true }, year: 1955 })
      .liquidation,
    true,
    "the Net Worth floor follows Table 7.4 under Historical"
  );
});

test("the liquidation roll needs 4 + the missions in a row targeted, this one included", () => {
  assert.deepEqual(liquidationCheck(1, 5), { target: 5, marked: true });
  assert.deepEqual(liquidationCheck(1, 6), { target: 5, marked: false });
  assert.deepEqual(liquidationCheck(3, 7), { target: 7, marked: true });
});

test("a burned agent cannot allocate reserves or make Requests and Gear checks", () => {
  const sys = {
    affiliationType: "faction",
    reputation: -2,
    usagePeriods: { mission: "m" },
    gearPicks: Object.fromEntries(PICK_CATEGORIES.map(k => [k, { remaining: 3 }])),
    missionReserves: { epoch: "m", caliber: 2, picks: { R: 1 }, charismaPicks: {}, spent: {}, common: 1 },
    actionDice: { value: 5, die: 4 }
  };
  assert.throws(
    () => gearAcquisitionPlan(sys, { kind: "common", name: "Flashlight", commonConfirmed: true, notIntel: true }),
    /burned/
  );
  assert.throws(() => gearAcquisitionPlan(sys, { kind: "request", name: "Rifle", notIntel: true }), /burned/);
  assert.throws(
    () =>
      reserveInitialization({ ...sys, missionReserves: null }, [], {
        picks: {},
        caliber: 2,
        intelComplete: true
      }),
    /burned/
  );
});

test("the sheet shows the burned state and flags mission gear still held", async () => {
  const { readFileSync } = await import("node:fs");
  const { computeAgent } = await import("../module/rules/engine.mjs");
  const { SPYCRAFT: cfg } = await import("../module/config.mjs");
  const data = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))).find(
    c => c.key === "wheelman"
  );
  const cls = {
    id: "wheelman",
    name: "Wheelman",
    type: "class",
    system: { ...structuredClone(data), identifier: "wheelman", vitalityDie: 10 }
  };
  const car = { id: "car", name: "Car", type: "gear", system: { gearCategory: "V", pick: "V", caliber: 1 } };
  const build = reputation => ({
    level: 1,
    reputation,
    usagePeriods: { mission: "m" },
    classLevels: { wheelman: 1 },
    actionDice: { max: 3 },
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 10 }])),
    progression: [{ classId: "wheelman", vitality: 5, skills: {} }],
    misc: {}
  });
  const burned = build(-3);
  computeAgent(burned, [cls, car], cfg);
  assert.equal(burned.standingStatus.burned, true);
  assert.ok(burned.warnings.some(w => /^Burned \(p\.440\)/.test(w)));
  assert.ok(burned.warnings.some(w => /1 mission gear pick\(s\) are still on this sheet/.test(w)));
  const fine = build(3);
  computeAgent(fine, [cls, car], cfg);
  assert.equal(fine.standingStatus.burned, false);
  assert.ok(!fine.warnings.some(w => /p\.440/.test(w)));
});
