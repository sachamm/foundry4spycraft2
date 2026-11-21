import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  breakState,
  criticalDiceForSize,
  damageSaveDC,
  failedDamageSaves,
  occupancy,
  sizeCode,
  tractionSaveBonus,
  vehicleClass,
  vehicleCondition,
  vehicleDamageLocation,
  vehicleDefense
} from "../module/rules/vehicles.mjs";
import { GEAR_RULES, VEHICLE_RULES } from "../module/rules/tables.mjs";

const read = name => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url)));
const gear = read("gear"),
  vehicles = read("vehicles"),
  upgrades = read("upgrades"),
  contagions = read("contagions");

/* ---------------------------------------------------------------------- */
/*  Rules                                                                  */
/* ---------------------------------------------------------------------- */

test("a Damage save DC is 10 plus half the damage, and needs at least 1 point", () => {
  assert.equal(damageSaveDC(1), 10);
  assert.equal(damageSaveDC(15), 17);
  assert.equal(damageSaveDC(48), 34);
  for (const bad of [0, -3, 2.5, "12", null]) assert.throws(() => damageSaveDC(bad));
});

test("failed saves count the miss, blast steps of ten and a doubled critical hit", () => {
  assert.equal(failedDamageSaves({ total: 17, dc: 17 }), 0);
  assert.equal(failedDamageSaves({ total: 16, dc: 17 }), 1);
  assert.equal(failedDamageSaves({ total: 16, dc: 34 }), 1);
  assert.equal(failedDamageSaves({ total: 16, dc: 34, blast: true }), 2);
  assert.equal(failedDamageSaves({ total: 25, dc: 34, blast: true }), 1);
  assert.equal(failedDamageSaves({ total: 12, dc: 34, blast: true, critical: true }), 6);
  assert.equal(failedDamageSaves({ total: 40, dc: 34, blast: true, critical: true }), 0);
  assert.throws(() => failedDamageSaves({ total: "16", dc: 34 }));
});

test("Size sets when an object breaks, when it is destroyed and what a critical hit costs", () => {
  assert.deepEqual(breakState("M", 0), { state: "intact", brokenAt: 1, destroyedAt: 2 });
  assert.equal(breakState("T/1h", 1).state, "broken");
  assert.equal(breakState("F", 2).state, "destroyed");
  assert.equal(breakState("L (2×3)", 2).state, "intact");
  assert.equal(breakState("L", 3).state, "broken");
  assert.equal(breakState("L", 6).state, "destroyed");
  assert.deepEqual(
    [
      breakState("H", 0).brokenAt,
      breakState("G", 0).brokenAt,
      breakState("C", 0).brokenAt,
      breakState("E", 0).brokenAt,
      breakState("V", 0).brokenAt
    ],
    [6, 9, 12, 15, 18]
  );
  assert.equal(breakState("V", 36).state, "destroyed");
  // An unknown Size is treated as Medium rather than never breaking.
  assert.equal(breakState("", 1).state, "broken");
  assert.deepEqual(["S", "L", "H", "G", "C", "E", "V"].map(criticalDiceForSize), [1, 1, 2, 2, 3, 3, 4]);
  assert.throws(() => breakState("M", -1));
});

test("size codes are read from table labels only when they start with a Size letter", () => {
  assert.equal(sizeCode("L (2×3)"), "L");
  assert.equal(sizeCode("F/1h"), "F");
  assert.equal(sizeCode("m"), "M");
  assert.equal(sizeCode("Large"), "");
  assert.equal(sizeCode("—/1h"), "");
  assert.equal(sizeCode(""), "");
});

test("every vehicle category has a control skill, an untrained penalty and twenty damage locations", () => {
  assert.equal(VEHICLE_RULES.classes.length, 12);
  for (const entry of VEHICLE_RULES.classes) {
    assert.ok(entry.skill && entry.label, entry.code);
    assert.ok(entry.untrainedPenalty < 0, entry.code);
    assert.equal(entry.damageLocations.length, 20, entry.code);
    for (const code of entry.damageLocations) assert.ok(VEHICLE_RULES.damageLocations[code], `${entry.code} ${code}`);
    assert.equal(vehicleClass(entry.code), entry);
  }
  assert.equal(vehicleClass("SGV").focus, "Standard Ground Vehicles");
  assert.equal(vehicleClass("M/AD").skill, "Survival");
  assert.equal(vehicleClass("nope"), null);
  assert.deepEqual(vehicleDamageLocation("RWA", 17), { code: "Rotors", label: "Rotors" });
  assert.equal(vehicleDamageLocation("SGV", 1).label, "Cargo");
  assert.equal(vehicleDamageLocation("SGV", 20).label, "Weapon or secondary gear");
  assert.throws(() => vehicleDamageLocation("SGV", 0));
  assert.throws(() => vehicleDamageLocation("SGV", 21));
  assert.throws(() => vehicleDamageLocation("", 10));
});

test("recorded Vehicle Damage lowers ratings and speeds, and immobilizes at zero", () => {
  const car = { acceleration: 6, turning: 5, cruiseMph: 70, topMph: 150 };
  assert.deepEqual(vehicleCondition(car, {}), {
    acceleration: 6,
    turning: 5,
    cruiseMph: 70,
    topMph: 150,
    maneuverErrorIncrease: 0,
    fuelHoursLost: 0,
    immobilized: false
  });
  const hurt = vehicleCondition(car, { controls: 1, engine: 2, traction: 1, lift: 1, fuelHours: 3 });
  assert.equal(hurt.acceleration, 4);
  assert.equal(hurt.turning, 2);
  // Each engine result removes a quarter of what is left, rounded down: 70 → 53 → 40; 150 → 113 → 85.
  assert.equal(hurt.cruiseMph, 40);
  assert.equal(hurt.topMph, 85);
  assert.equal(hurt.maneuverErrorIncrease, 1);
  assert.equal(hurt.fuelHoursLost, 3);
  assert.equal(hurt.immobilized, false);
  assert.equal(vehicleCondition(car, { controls: 5 }).immobilized, true);
  assert.equal(vehicleCondition(car, { flotation: 9 }).acceleration, 0);
  // A rating that starts at 0 (a trailer, a towed barge) is not "immobilized by damage".
  assert.equal(vehicleCondition({ acceleration: 0, turning: 2 }, {}).immobilized, false);
  // Mounts list no ratings; they stay unknown rather than becoming 0.
  const mount = vehicleCondition({ acceleration: null, turning: null, cruiseMph: 2, topMph: 10 }, { engine: 1 });
  assert.equal(mount.acceleration, null);
  assert.equal(mount.turning, null);
  assert.equal(mount.cruiseMph, 2);
  assert.throws(() => vehicleCondition(car, { engine: -1 }));
  assert.throws(() => vehicleCondition(car, { engine: 1.5 }));
});

test("vehicle Defense adds the driver while moving and any rating lead over the attacker", () => {
  assert.equal(vehicleDefense({ defense: null }), null);
  assert.equal(vehicleDefense({ defense: 9, driverDexMod: 3 }).total, 9);
  assert.equal(vehicleDefense({ defense: 9, moving: true, driverDexMod: 3 }).total, 12);
  const chased = vehicleDefense({
    defense: 9,
    moving: true,
    driverDexMod: 3,
    acceleration: 6,
    turning: 5,
    attacker: { acceleration: 4, turning: 7 }
  });
  assert.equal(chased.total, 14);
  assert.deepEqual(
    chased.rows.map(r => r.label),
    ["Base Defense", "Driver Dexterity", "Acceleration lead"]
  );
  assert.equal(
    vehicleDefense({ defense: 9, acceleration: 3, turning: 3, attacker: { acceleration: 6, turning: 6 } }).total,
    9
  );
});

test("occupancy labels and tyre save bonuses are read as numbers", () => {
  assert.deepEqual(occupancy("1+3"), { crew: 1, passengers: 3 });
  assert.deepEqual(occupancy("155"), { crew: 155, passengers: 0 });
  assert.deepEqual(occupancy("5,500+90"), { crew: 5500, passengers: 90 });
  assert.deepEqual(occupancy("NPC"), { crew: null, passengers: null });
  assert.deepEqual(["S", "M", "L", "H", "C", "V"].map(tractionSaveBonus), [0, 1, 2, 4, 6, 6]);
});

/* ---------------------------------------------------------------------- */
/*  Source data                                                            */
/* ---------------------------------------------------------------------- */

const ROMAN = new Set(["I", "II", "III", "IV", "V"]);
const strings = value =>
  typeof value === "string" ? [value] : value && typeof value === "object" ? Object.values(value).flatMap(strings) : [];

test("gear data covers every pick category with labelled table rows", () => {
  const expected = {
    electronics: ["E", 77],
    gadgets: ["G", 112],
    resources: ["R", 59],
    security: ["S", 32],
    tradecraft: ["T", 90]
  };
  for (const [list, [category, count]] of Object.entries(expected)) {
    assert.equal(gear[list].length, count, list);
    assert.ok(gear.categories[category].page > 0, category);
    for (const row of gear[list]) {
      assert.equal(row.category, category, row.name);
      assert.ok(row.name && row.name === row.name.trim(), `${list}: name`);
      assert.ok(row.caliber === "" || ROMAN.has(row.caliber), `${row.name}: caliber`);
      assert.ok(
        Number.isSafeInteger(row.sourcePage) && row.sourcePage >= 226 && row.sourcePage <= 235,
        `${row.name}: page`
      );
      assert.ok(row.bundleSize >= 1, `${row.name}: bundle`);
      assert.doesNotMatch(row.name, /[*†∆Ω↳]/, row.name);
      if (list !== "resources") {
        assert.ok(row.damageSave === null || Number.isSafeInteger(row.damageSave), `${row.name}: save`);
        assert.ok(row.weight >= 0, `${row.name}: weight`);
        // A row without a Caliber is one bought with Reputation or Net Worth, and lists that cost.
        if (row.caliber === "") assert.notEqual(row.standingCost, "", `${row.name}: standing cost`);
        else assert.equal(row.standingCost, "", `${row.name}: caliber or standing`);
      }
    }
  }
  assert.equal(gear.housings.length, 12);
  assert.deepEqual(
    gear.housings.map(h => h.maxMechanisms),
    [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]
  );
  assert.deepEqual(GEAR_RULES.damageSaves, gear.damageSaves);
});

test("vehicle data covers all twelve categories with usable statistics", () => {
  assert.equal(vehicles.vehicles.length, 211);
  const perClass = Object.groupBy(vehicles.vehicles, v => v.vehicleClass);
  assert.deepEqual(Object.keys(perClass).sort(), vehicles.classes.map(c => c.code).sort());
  for (const v of vehicles.vehicles) {
    assert.ok(v.name && !/[*†∆Ω↳]/.test(v.name), v.name);
    assert.ok(v.caliber === "" ? v.standingOnly || v.optionOf : ROMAN.has(v.caliber), `${v.name}: caliber`);
    assert.ok(v.sourcePage >= 236 && v.sourcePage <= 244, `${v.name}: page`);
    if (v.optionOf) continue;
    assert.ok(v.size, `${v.name}: size`);
    // Mounts use their NPC statistics; every other vehicle has a Defense and a Damage save.
    if (v.defenseSave === "NPC") assert.equal(v.vehicleClass, "M/AD", v.name);
    else {
      assert.ok(Number.isSafeInteger(v.defense) && Number.isSafeInteger(v.damageSave), `${v.name}: D/S`);
      assert.equal(v.defenseSave, `${v.defense}/+${v.damageSave}`, v.name);
    }
    if (v.standingOnly) assert.match(v.standingCost, /^\d+ Reputation$/, v.name);
  }
  assert.equal(vehicles.upgrades.length, 33);
  assert.equal(vehicles.weapons.length, 168);
  for (const u of vehicles.upgrades)
    for (const kind of ["ground", "air", "water"])
      assert.ok(u[kind].streetValue && u[kind].complexity, `${u.name}: ${kind}`);
  for (const w of vehicles.weapons) assert.ok(w.name && w.sourcePage >= 246 && w.sourcePage <= 249, w.name);
  assert.deepEqual(VEHICLE_RULES.classes, vehicles.classes);
});

test("PDF cross-check corrections hold", () => {
  const byName = name => vehicles.vehicles.filter(v => v.name === name);
  // Turning is read on its own when Acceleration is per driver, per crew or set by the wind.
  assert.equal(byName("Bicycle, mountain")[0].turning, 6);
  assert.equal(byName("Sailboat, coastal")[0].turning, 1);
  assert.equal(byName("Canoe")[0].turning, 0);
  // A/T misprinted as "3.4".
  assert.deepEqual([byName("Pickup truck, light")[0].acceleration, byName("Pickup truck, light")[0].turning], [3, 4]);
  // Bundled extras sit in their own field, not in the Size label.
  assert.equal(byName("ATV, sport")[0].sizeLabel, "M (1×1)");
  assert.equal(byName("ATV, sport")[0].bundled, "+2 racing helmets");
  for (const v of vehicles.vehicles) assert.doesNotMatch(v.sizeLabel, /\+/, v.name);
  // One tractor-trailer per Caliber; trailers are options for it, not Caliber V picks.
  assert.deepEqual(
    byName("Tractor-trailer").map(v => [v.caliber, v.upgrades]),
    [
      ["II", 2],
      ["III", 2]
    ]
  );
  for (const v of vehicles.vehicles.filter(v => /^Trailer, /.test(v.name)))
    assert.deepEqual([v.optionOf, v.caliber], ["Tractor-trailer", ""]);
  // Missile launcher names were wrapped into the Cost column.
  const missiles = vehicles.weapons.filter(w => w.name.startsWith("Missile launcher"));
  assert.equal(missiles.length, 18);
  for (const w of missiles) {
    assert.match(w.name, /^Missile launcher, \S/);
    assert.match(w.cost, /^\d+$/);
  }
  // Gargantuan tyre bonus is a recorded house rule.
  assert.equal(VEHICLE_RULES.tractionSaveBonus.G, 5);
  assert.ok(VEHICLE_RULES.tractionSaveBonusHouseRule.G);
});

test("armor, weapon upgrade, detonator and contagion tables are complete", () => {
  assert.equal(upgrades.armor.length, 22);
  assert.equal(upgrades.weapons.length, 87);
  assert.equal(upgrades.detonators.length, 12);
  assert.deepEqual(
    Object.entries(Object.groupBy(contagions.contagions, c => c.grade || c.kind)).map(([k, v]) => [k, v.length]),
    [
      ["disease", 30],
      ["basic", 14],
      ["improved", 14],
      ["advanced", 14]
    ]
  );
  for (const c of contagions.contagions) {
    assert.ok(/^\d+\/\+\d+$/.test(c.complexity), c.name);
    for (const phase of [c.primary, c.secondary])
      assert.ok(Number.isSafeInteger(phase.saveDC) && phase.onset && phase.effect, c.name);
  }
  const ebola = contagions.contagions.find(c => c.name === "Ebola");
  assert.equal(ebola.secondary.effect, "2d6 Con (permanent), 2d6 Str (half permanent)");
  assert.ok(contagions.contagions.find(c => c.name === "Chickenpox").notes.includes("oneTime"));
  for (const row of [...upgrades.armor, ...upgrades.weapons, ...upgrades.detonators])
    for (const code of row.notes) assert.ok(upgrades.footnotes[code], `${row.name}: ${code}`);
  assert.equal(upgrades.detonators.find(d => d.name === "Det cord, 1 ft.").damage, "3d4");
});

test("every gear pick has a short original summary", () => {
  const summaries = read("gear-summaries").summaries;
  for (const list of ["electronics", "gadgets", "resources", "security", "tradecraft"])
    for (const row of gear[list]) {
      const text = summaries[row.name];
      assert.ok(text, `${row.name}: summary`);
      assert.ok(text.length <= 80 && !text.includes("\n"), `${row.name}: one short line`);
      assert.doesNotMatch(row.name, /[*†‡∆Ω\u2126]/, row.name);
    }
});

test("every footnote code has a short label and noted rows carry at least one", () => {
  const lists = [
    ...["electronics", "gadgets", "resources", "security", "tradecraft"].map(k => [gear[k], gear.footnotes]),
    [vehicles.vehicles, vehicles.footnotes],
    [vehicles.upgrades, vehicles.upgradeFootnotes],
    [vehicles.weapons, vehicles.upgradeFootnotes]
  ];
  for (const [rows, labels] of lists)
    for (const row of rows) {
      assert.equal(row.noted, row.notes.length > 0, row.name);
      for (const code of row.notes) assert.ok(labels[code], `${row.name}: ${code}`);
    }
  // A team-wide pick is flagged for the radios, bicycles and parachutes.
  assert.ok(
    gear.electronics.filter(r => r.notes.includes("teamIssue")).every(r => r.name.startsWith("Radio, tactical"))
  );
  assert.ok(vehicles.vehicles.find(v => v.name === "Parachute, standard").notes.includes("teamIssue"));
});

test("the new data files hold labels and numbers, not prose", () => {
  for (const [file, data] of [
    ["gear", gear],
    ["vehicles", vehicles],
    ["upgrades", upgrades],
    ["contagions", contagions]
  ]) {
    for (const [key, value] of Object.entries(data)) {
      if (key === "_note") continue;
      for (const text of strings(value)) {
        // Qualities lists are comma-separated codes and may run long; nothing else comes close to a sentence.
        const limit = /^[A-Z]{3}\b/.test(text) || text.includes("WPN (") ? 400 : 70;
        assert.ok(text.length <= limit, `${file}.${key}: "${text.slice(0, 80)}…"`);
        assert.doesNotMatch(
          text,
          /\b(see page|this (item|vehicle|pick)|may not|must be)\b/i,
          `${file}.${key}: ${text}`
        );
      }
    }
  }
});

/* ---------------------------------------------------------------------- */
/*  Play actions against stubbed Foundry documents                         */
/* ---------------------------------------------------------------------- */

const posts = [];
let nextRoll = 10,
  created = null;
globalThis.foundry = {
  utils: { escapeHTML: String, deepClone: structuredClone },
  data: {
    fields: new Proxy(
      {},
      {
        get: () =>
          class {
            constructor(options) {
              this.options = options;
            }
          }
      }
    )
  }
};
globalThis.ChatMessage = { getSpeaker: () => ({}) };
globalThis.ui = {
  notifications: {
    warn: message => {
      posts.push({ warning: message });
      return null;
    }
  }
};
globalThis.game = { user: { can: () => true } };
globalThis.Roll = class {
  constructor(formula, data = {}) {
    this.total = nextRoll + (data.bonus ?? 0);
  }
  async evaluate() {
    return this;
  }
  async toMessage(data) {
    posts.push(data);
    return data;
  }
};
globalThis.Actor = {
  implementation: {
    create: async data => {
      created = { ...data, sheet: { render() {} } };
      return created;
    }
  }
};
const {
  rollObjectDamageSave,
  rollVehicleDamageResult,
  rollTyreSave,
  repairVehicle,
  deployVehicle,
  loadVehicleStats,
  objectSize
} = await import("../module/apps/vehicle-play.mjs");

const document = (documentName, type, system) => ({
  documentName,
  type,
  name: "Test",
  uuid: `${documentName}.test`,
  isOwner: true,
  img: "icon.svg",
  system,
  parent: null,
  async update(changes) {
    for (const [path, value] of Object.entries(changes)) {
      const keys = path.split("."),
        last = keys.pop();
      let target = this;
      for (const key of keys) target = target[key] ??= {};
      target[last] = value;
    }
    return this;
  }
});

test("a gear item records the Damage saves it fails and reports when it breaks", async () => {
  const bug = document("Item", "gear", { damageSave: 2, sizeHands: "F/1h", failedSaves: 0 });
  assert.equal(objectSize(bug), "F");
  nextRoll = 15;
  posts.length = 0;
  await rollObjectDamageSave(bug, { damage: 12 }); // 17 against DC 16
  assert.equal(bug.system.failedSaves, 0);
  assert.match(posts[0].flavor, /DC 16/);
  assert.match(posts[0].flavor, /Saved\./);
  nextRoll = 5;
  await rollObjectDamageSave(bug, { damage: 12 }); // 7 against DC 16
  assert.equal(bug.system.failedSaves, 1);
  assert.match(posts[1].flavor, /Now <strong>broken<\/strong>/);
  await rollObjectDamageSave(bug, { damage: 12 });
  assert.match(posts[2].flavor, /Now <strong>destroyed<\/strong>/);
  posts.length = 0;
  assert.equal(await rollObjectDamageSave(document("Item", "gear", { damageSave: null }), { damage: 5 }), false);
  assert.match(posts[0].warning, /no Damage save bonus/);
});

test("a critical hit on a vehicle rolls a Vehicle Damage result once per failed save", async () => {
  const car = document("Actor", "vehicle", {
    vehicleClass: "SGV",
    size: "L",
    damageSave: 8,
    failedSaves: 0,
    damage: {},
    crew: 1,
    passengers: 3,
    occupants: [],
    driver: "Actor.ada"
  });
  nextRoll = 6;
  posts.length = 0; // save 14 vs DC 30: fails 1, blast +1, critical ×2 = 4; then location 6 = Controls
  await rollObjectDamageSave(car, { damage: 40, blast: true, critical: true });
  assert.equal(car.system.failedSaves, 4);
  assert.equal(car.system.damage.controls, 4);
  assert.match(posts[0].flavor, /Failed 4 saves: 4 of 3 to break, 6 to destroy/);
  assert.match(posts[1].flavor, /Vehicle Damage result: <strong>Controls<\/strong> ×4/);

  nextRoll = 16;
  posts.length = 0; // location 16 on SGV = Traction: no counter until the tyre fails its own save
  await rollVehicleDamageResult(car, { failed: 1, damage: 40 });
  assert.match(posts[0].flavor, /tyre must make its own Damage save against 40 damage \(bonus \+2\)/);
  assert.equal(car.system.damage.traction, undefined);
  nextRoll = 3;
  await rollTyreSave(car, { damage: 40 }); // 5 vs DC 30
  assert.equal(car.system.damage.traction, 1);

  nextRoll = 12;
  posts.length = 0; // location 12 on SGV = Occupant: the driver takes damage − save bonus
  globalThis.fromUuidSync = uuid => (uuid === "Actor.ada" ? { name: "Ada", uuid } : null);
  await rollVehicleDamageResult(car, { failed: 2, damage: 20, armorPiercing: 3 });
  assert.match(posts[0].flavor, /Occupant<\/strong> ×2/);
  assert.match(posts[0].flavor, /<strong>Ada<\/strong> takes 15 damage/); // 20 − (8 − 3)
  nextRoll = 1;
  posts.length = 0; // location 1 on SGV = Cargo: at least 1
  await rollVehicleDamageResult(car, { failed: 1, damage: 4 });
  assert.match(posts[0].flavor, /cargo item takes 1 damage/);
  delete globalThis.fromUuidSync;

  await repairVehicle(car);
  assert.equal(car.system.failedSaves, 0);
  assert.deepEqual(car.system.damage, { controls: 0, engine: 0, flotation: 0, fuelHours: 0, lift: 0, traction: 0 });
});

test("a vehicle pick can be placed on a scene and can refresh an existing vehicle without touching its damage", async () => {
  const stats = {
    vehicleClass: "PGV",
    size: "M",
    sizeLabel: "M (1×1)",
    acceleration: 6,
    turning: 9,
    defense: 10,
    damageSave: 7,
    caliber: 1,
    qualities: "OPN (no cover)",
    quantity: 2,
    pick: "V"
  };
  const pick = document("Item", "vehicle", stats);
  pick.parent = { uuid: "Actor.owner", ownership: { default: 0, player: 3 } };
  const actor = await deployVehicle(pick);
  assert.equal(actor.type, "vehicle");
  assert.equal(actor.system.sourceItem, "Item.test");
  assert.equal(actor.system.driver, "Actor.owner");
  assert.equal(actor.system.acceleration, 6);
  assert.deepEqual(actor.ownership, { default: 0, player: 3 });
  // Inventory bookkeeping stays on the pick.
  assert.equal("quantity" in actor.system, false);
  assert.equal("pick" in actor.system, false);

  const onScene = document("Actor", "vehicle", { acceleration: 1, failedSaves: 2, damage: { engine: 1 } });
  await loadVehicleStats(onScene, pick);
  assert.equal(onScene.system.acceleration, 6);
  assert.equal(onScene.system.failedSaves, 2);
  assert.equal(onScene.system.damage.engine, 1);
  assert.equal(await deployVehicle(document("Item", "gear", {})), null);
});

/* ---------------------------------------------------------------------- */
/*  Vehicle play rules: qualities, fuel, crew, control checks, upgrades    */
/* ---------------------------------------------------------------------- */

const rules = await import("../module/rules/vehicle-play-rules.mjs");

test("qualities parse into codes with parameters and carry our reference labels", () => {
  const list = rules.qualityReference("OPN (1/4 cover), ORD, HAR (2), LOB (radar S, thermal F)");
  assert.deepEqual(
    list.map(q => [q.code, q.param]),
    [
      ["OPN", "1/4 cover"],
      ["ORD", ""],
      ["HAR", "2"],
      ["LOB", "radar S, thermal F"]
    ]
  );
  assert.equal(list[0].name, "Open");
  assert.ok(list.every(q => q.summary));
  assert.equal(rules.heavyArmorDice("HAR (2), TRK"), 2);
  assert.equal(rules.qualityNumber("PVI (–6)", "PVI"), -6);
  for (const v of vehicles.vehicles)
    for (const q of rules.parseQualities(v.qualities))
      assert.ok(VEHICLE_RULES.qualities[q.code], `${v.name}: ${q.code}`);
  assert.deepEqual(
    [rules.ruggedBonus("S"), rules.ruggedBonus("M"), rules.ruggedBonus("L"), rules.ruggedBonus("G")],
    [2, 2, 4, 8]
  );
});

test("secondary damage from a Vehicle Damage result subtracts the save bonus, reduced by armor-piercing", () => {
  assert.equal(rules.secondaryDamage({ damage: 20, saveBonus: 8 }), 12);
  assert.equal(rules.secondaryDamage({ damage: 20, saveBonus: 8, armorPiercing: 10 }), 20);
  assert.equal(rules.secondaryDamage({ damage: 3, saveBonus: 8 }), 1);
  assert.equal(rules.secondaryDamage({ damage: 3, saveBonus: 8, minimum: 0 }), 0);
});

test("fuel range parses every printed format and tracks use, losses and upgrades", () => {
  assert.deepEqual(rules.parseRangeFuel("7/G"), { hours: 7, fuel: "G", fuelName: "Gas" });
  assert.equal(rules.parseRangeFuel("60 days/F").hours, 1440);
  assert.equal(rules.parseRangeFuel("20 years/N").hours, 175200);
  assert.equal(rules.parseRangeFuel("15//D").hours, 15);
  assert.ok(Math.abs(rules.parseRangeFuel("2r/A").hours - 2 / 600) < 1e-9);
  for (const label of ["N/A", "PD", "", "–10/D"]) assert.equal(rules.parseRangeFuel(label), null, label);
  const state = rules.fuelState("7/G", { used: 2, lost: 1 });
  assert.deepEqual([state.capacity, state.remaining, state.empty], [7, 4, false]);
  assert.equal(rules.fuelState("7/G", { used: 9 }).remaining, 0);
  assert.equal(rules.fuelState("7/G", { extraHours: -2 }).capacity, 5);
  assert.equal(rules.travelFuel(2, { aboveCruising: true }), 4);
  for (const v of vehicles.vehicles)
    if (/^\d/.test(v.rangeFuel)) assert.ok(rules.parseRangeFuel(v.rangeFuel), `${v.name}: ${v.rangeFuel}`);
});

test("crew, entry movement and bailing out follow the vehicle", () => {
  assert.equal(rules.skeletonCrew(4, { source: "possession" }), 3);
  assert.equal(rules.skeletonCrew(4, { source: "mission", teamSize: 3 }), 1);
  assert.equal(rules.skeletonCrew(1, { source: "mission", teamSize: 4 }), 0);
  assert.equal(rules.entryMovement({ vehicleClass: "PGV", qualities: "" }), 5);
  assert.equal(rules.entryMovement({ vehicleClass: "SHP", qualities: "CAP, CRW" }), 60);
  assert.equal(rules.entryMovement({ vehicleClass: "SGV", qualities: "" }), 10);
  assert.deepEqual(rules.bailOut({ qualities: "EJS" }, { role: "crew" }), { dc: 15, bonus: 6, ejection: true });
  assert.equal(rules.bailOut({ qualities: "EJS" }, { role: "passenger" }).bonus, 0);
});

test("a control check uses the category skill and focus, with the untrained penalty adjusted by qualities", () => {
  const driver = (ranks, focuses = []) => ({
    skills: { drive: { ranks }, acrobatics: { ranks }, tactics: { ranks } },
    focuses: { drive: focuses }
  });
  const car = { vehicleClass: "SGV", qualities: "", damage: {} };
  assert.deepEqual(rules.controlCheckPlan(car, driver(2, ["Standard Ground Vehicles"])), {
    ...rules.controlCheckPlan(car, driver(2, ["Standard Ground Vehicles"])),
    trained: true,
    penalty: 0,
    skillKey: "drive"
  });
  const noFocus = rules.controlCheckPlan(car, driver(2));
  assert.deepEqual([noFocus.trained, noFocus.penalty], [false, -4]);
  assert.equal(rules.controlCheckPlan({ ...car, qualities: "FOR" }, driver(0)).penalty, -2);
  assert.equal(rules.controlCheckPlan({ ...car, qualities: "UNF" }, driver(0)).penalty, -8);
  assert.match(rules.controlCheckPlan({ ...car, qualities: "TRO" }, driver(0)).blocked, /Trained only/);
  const bike = rules.controlCheckPlan(
    { vehicleClass: "PGV", qualities: "DRN (radio 4)", damage: { lift: 2 } },
    driver(1, ["Personal Ground Vehicles"])
  );
  assert.deepEqual([bike.skillKey, bike.trained, bike.errorIncrease], ["acrobatics", true, 3]);
  assert.equal(
    rules.controlCheckPlan({ vehicleClass: "SHP", qualities: "CAP, CRW", damage: {} }, driver(1)).skillKey,
    "tactics"
  );
});

test("installed upgrades change ratings, speed, saves and qualities, and count against free upgrades", () => {
  const base = {
    vehicleClass: "SGV",
    acceleration: 5,
    turning: 3,
    topMph: 110,
    cruiseMph: 65,
    damageSave: 8,
    qualities: "HOT",
    upgrades: 2
  };
  const up = rules.upgradedStats(base, [
    { name: "Acceleration increase (stage I), kit", cost: 1 },
    { name: "Control increase (stage II), kit", cost: 2 },
    { name: "Top speed increase (stage I), kit", cost: 1 },
    { name: "Security package (stage I), kit", cost: 1 },
    { name: "Emergency service package (basic), kit", cost: 1 }
  ]);
  assert.deepEqual([up.acceleration, up.turning, up.topMph, up.damageSave], [5, 5, 110, 12]); // +1 −1 accel; +1 +1 turn; +10% −10% speed
  assert.equal(up.qualities, "HOT, UNC, RDD (crew)");
  assert.deepEqual([up.used, up.free], [6, 2]);
  assert.equal(
    rules.upgradedStats({ ...base, damageSave: 10 }, [{ name: "Convertible roof, kit", cost: 1 }]).damageSave,
    8
  );
  assert.equal(rules.upgradedStats(base, [{ name: "Run-flat tires", cost: 1 }]).runFlat, true);
  assert.deepEqual(
    [rules.weaponSpaces("S"), rules.weaponSpaces("M"), rules.weaponSpaces("L"), rules.weaponSpaces("H")],
    [0, 1, 3, 6]
  );
});

/* ---------------------------------------------------------------------- */
/*  Chases                                                                 */
/* ---------------------------------------------------------------------- */

const chase = await import("../module/rules/chase.mjs");

test("chase ratings come from the vehicles, after damage, or from a character on foot", () => {
  const car = {
    kind: "vehicle",
    system: { vehicleClass: "SGV", acceleration: 5, turning: 3, topMph: 110, damage: { engine: 1 } }
  };
  assert.deepEqual(chase.participantRatings(car), {
    kind: "vehicle",
    Acceleration: 4,
    Turning: 3,
    topMph: 83,
    leadFeet: 50,
    immobilized: false
  });
  const runner = { kind: "foot", system: { abilities: { str: { mod: 2 }, dex: { mod: -1 } } } };
  assert.deepEqual(chase.participantRatings(runner), {
    kind: "foot",
    Acceleration: 2,
    Turning: 0,
    topMph: null,
    leadFeet: 20
  });
  assert.equal(chase.participantRatings({ kind: "vehicle", system: { vehicleClass: "SVA", size: "L" } }).leadFeet, 200);
  assert.equal(chase.participantRatings({ kind: "vehicle", system: { vehicleClass: "SVA", size: "G" } }).leadFeet, 100);
});

test("starting Lead compares Acceleration in open room and Turning in tight room", () => {
  const fast = { Acceleration: 8, Turning: 2 },
    nimble = { Acceleration: 4, Turning: 7 };
  assert.equal(chase.startingLead("open", fast, nimble).lead, 4);
  assert.equal(chase.startingLead("tight", fast, nimble).lead, 6);
  assert.equal(chase.startingLead("close", { Acceleration: 5 }, { Acceleration: 6 }).lead, 5);
  assert.throws(() => chase.startingLead("wide", fast, nimble), /Maneuvering Room/);
});

test("chase scale uses the shortest Lead distance, flags mismatches and finds the fastest vehicle", () => {
  const car = { Acceleration: 5, Turning: 3, topMph: 110, leadFeet: 50 },
    bike = { Acceleration: 6, Turning: 9, topMph: 125, leadFeet: 40 },
    runner = { Acceleration: 2, Turning: 1, topMph: null, leadFeet: 20 };
  const s = chase.chaseScale("crowded", car, bike);
  assert.deepEqual(
    [s.leadFeet, s.mismatched, s.speedMph, s.fastest, s.topMphBonus, s.crisisDC],
    [40, false, 55, "prey", 2, 30]
  );
  assert.equal(chase.chaseScale("open", car, runner).mismatched, true);
  assert.equal(chase.leadDistance(5, 40), 200);
});
