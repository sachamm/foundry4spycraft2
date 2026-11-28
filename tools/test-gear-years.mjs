import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { availableIn, introductionYear } from "../module/rules/gear-era.mjs";
import { gearYearUpdate, importPeriodGear } from "../module/migrations/index.mjs";
import { GEAR_YEARS, PERIOD_ITEMS } from "../module/data/gear-year-index.mjs";
import { buildPacks } from "./lib/pack-docs.mjs";
import { bookWeaponYear, dateGear } from "./lib/period-gear.mjs";

const read = file => JSON.parse(readFileSync(new URL(`../src/data/${file}`, import.meta.url), "utf8"));
const { packs } = buildPacks();
const DATED_PACKS = ["weapons", "armor", "gear", "kits", "vehicles", "vehicle-upgrades", "equipment-upgrades"];

test("year labels read as the first year they cover", () => {
  assert.equal(introductionYear("1911"), 1911);
  assert.equal(introductionYear("1950s"), 1950);
  assert.equal(introductionYear("1800s/1930s"), 1800);
  assert.equal(introductionYear(""), null);
  assert.equal(availableIn("1950s", 1950), true);
  assert.equal(availableIn("1960s", 1959), false);
  assert.equal(availableIn("", 1939), true);
  assert.equal(availableIn("2000s", null), true, "no clock date hides nothing");
});

test("our dates never replace a date the book prints", () => {
  const years = read("gear-years.json"),
    equipment = read("equipment.json"),
    gear = read("gear.json"),
    vehicles = read("vehicles.json");
  for (const w of equipment.weapons)
    if (bookWeaponYear(w)) assert.ok(!(w.name in years.weapons), `${w.name} has a printed year`);
  const gearRows = ["electronics", "gadgets", "resources", "security", "tradecraft"].flatMap(list => gear[list]);
  for (const name of Object.keys(years.gear))
    assert.ok(
      gearRows.some(row => row.name === name && !row.year),
      `${name} is dated in the book`
    );
  for (const name of Object.keys(years.vehicles))
    assert.ok(
      vehicles.vehicles.some(row => row.name === name && !row.year),
      `${name} is dated in the book`
    );
  for (const value of Object.values(years).flatMap(group => (typeof group === "object" ? Object.values(group) : [])))
    assert.ok(value === "always" || introductionYear(value) !== null, `bad year label ${value}`);
});

test("a weapon's printed year reaches its compendium entry, and our list cannot override one", () => {
  const equipment = read("equipment.json");
  const printed = equipment.weapons.filter(w => w.year);
  assert.ok(printed.length >= 360, `${printed.length} weapons carry the Year column`);
  for (const w of printed) assert.match(w.year, /^\d{3,4}s?$/, `${w.name}: a bare year label`);
  const built = new Map(packs.weapons.docs.map(d => [d.name, d.system.year]));
  for (const w of printed) assert.equal(built.get(w.name), w.year, w.name);
  // Two rows the review found carrying our date in place of the printed one (pp.255, 259).
  assert.equal(built.get("Distinject Model 35 13mm dart"), "1950");
  assert.equal(built.get("CZ Skorpion 9x18mm"), "1984");
  const data = {
    equipment: { weapons: [structuredClone(printed[0])], armor: [] },
    gear: { electronics: [], gadgets: [], resources: [], security: [], tradecraft: [] },
    vehicles: { vehicles: [], upgrades: [] },
    upgrades: { weapons: [], armor: [], detonators: [] },
    kits: [],
    ammunition: []
  };
  assert.throws(() => dateGear(data, { weapons: { [printed[0].name]: "1999" } }), /dates 1 weapons the book dates/);
});

test("every firearm, and every armor piece, has a year", () => {
  for (const doc of packs.weapons.docs)
    if (
      !["blunt", "edged", "exoticBlunt", "exoticEdged", "exoticHurled", "hurled", "explosives"].includes(
        doc.system.proficiency
      )
    )
      assert.ok(doc.system.year, `${doc.name} has no year`);
  const unknown = packs.armor.docs.filter(doc => doc.system.year === undefined);
  assert.deepEqual(unknown, []);
});

test("each house item is marked, dated from 1939–1949 or earlier, and names its source entry", () => {
  const period = read("period-gear.json");
  const rows = [
    ...period.weapons,
    ...Object.values(period.gear).flat(),
    ...period.vehicles,
    ...period.upgrades.weapons,
    ...period.upgrades.detonators
  ];
  assert.equal(PERIOD_ITEMS.length, rows.length);
  for (const row of rows) {
    assert.ok(introductionYear(row.year) <= 1949, `${row.name} is from ${row.year}`);
    const doc = DATED_PACKS.flatMap(id => packs[id].docs).find(d => d.name === row.name);
    assert.ok(doc, `${row.name} is in a pack`);
    assert.equal(doc.flags.spycraft2.periodItem, true);
    assert.match(doc.system.source, /^House item, adapted from /);
    const base = DATED_PACKS.flatMap(id => packs[id].docs).find(
      d => d.name === row.basedOn || d.name.startsWith(`${row.basedOn} (`)
    );
    assert.ok(base, `${row.name} is based on a real entry (${row.basedOn})`);
  }
});

test("every weapon category and vehicle class with a 1939–1949 counterpart has something by 1949", () => {
  const byGroup = new Map();
  for (const doc of packs.weapons.docs) {
    const list = byGroup.get(doc.system.proficiency) ?? [];
    list.push(doc);
    byGroup.set(doc.system.proficiency, list);
  }
  // Man-portable guided missiles did not exist before 1950, so that category has no period counterpart.
  for (const [group, docs] of byGroup)
    if (group !== "guided")
      assert.ok(
        docs.some(d => availableIn(d.system.year, 1949)),
        `${group} has nothing by 1949`
      );
  const classes = new Map();
  for (const doc of packs.vehicles.docs)
    classes.set(
      doc.system.vehicleClass,
      (classes.get(doc.system.vehicleClass) ?? false) || availableIn(doc.system.year, 1949)
    );
  for (const [code, ok] of classes) assert.ok(ok, `${code} has nothing by 1949`);
});

test("the version 6 migration dates items from their compendium entry, then by name, and keeps typed years", () => {
  const weapon = packs.weapons.docs.find(d => d.name === "Colt M1911A1 .45 ACP");
  const byId = gearYearUpdate({
    type: "weapon",
    name: "My sidearm",
    system: { year: "" },
    _stats: { compendiumSource: `Compendium.spycraft2.weapons.Item.${weapon._id}` }
  });
  assert.deepEqual(byId, { "system.year": "1911" });
  assert.deepEqual(gearYearUpdate({ type: "weapon", name: "Colt M1911A1 .45 ACP", system: { year: "" } }), {
    "system.year": "1911"
  });
  assert.equal(gearYearUpdate({ type: "weapon", name: "Colt M1911A1 .45 ACP", system: { year: "1924" } }), null);
  assert.equal(gearYearUpdate({ type: "feat", name: "Colt M1911A1 .45 ACP", system: {} }), null);
  assert.equal(gearYearUpdate({ type: "gear", name: "Something homemade", system: { year: "" } }), null);
  assert.ok(Object.keys(GEAR_YEARS.byId).length > 900);
});

test("the version 6 migration copies period items only into worlds that keep imported copies of that pack", async () => {
  const entry = PERIOD_ITEMS.find(item => item.pack === "spycraft2.weapons");
  const imported = {
    type: "weapon",
    name: "Luger P08 9mm",
    folder: "armoury",
    _stats: { compendiumSource: "Compendium.spycraft2.weapons.Item.abc" }
  };
  let created = null;
  await importPeriodGear({ items: [imported], createItems: async list => (created = list) }, [entry]);
  assert.deepEqual(created, [{ uuid: `Compendium.spycraft2.weapons.Item.${entry.id}`, folder: "armoury" }]);
  created = null;
  await importPeriodGear({ items: [{ ...imported, _stats: {} }], createItems: async list => (created = list) }, [
    entry
  ]);
  assert.equal(created, null, "a world without imported weapons gets nothing");
  await importPeriodGear(
    { items: [imported, { type: "weapon", name: entry.name }], createItems: async list => (created = list) },
    [entry]
  );
  assert.equal(created, null, "an item of that name already exists");
});

test("each browser part renders one root element, as Foundry's Handlebars parts require", async () => {
  const { default: Handlebars } = await import("handlebars");
  const hb = Handlebars.create();
  hb.registerHelper("localize", key => key);
  hb.registerHelper("selectOptions", () => "");
  hb.registerHelper("checked", value => (value ? "checked" : ""));
  hb.registerHelper("disabled", value => (value ? "disabled" : ""));
  const VOID = new Set(["input", "img", "br", "hr", "meta", "link"]);
  const roots = html => {
    let depth = 0,
      count = 0;
    for (const [, close, tag, selfClosing] of html.matchAll(/<(\/?)([a-z][a-z0-9-]*)[^>]*?(\/?)>/gi)) {
      if (close) depth -= 1;
      else {
        if (depth === 0) count += 1;
        if (!VOID.has(tag.toLowerCase()) && !selfClosing) depth += 1;
      }
    }
    return count;
  };
  const context = {
    era: "Everything listed was available by 1955.",
    dated: true,
    restrictable: true,
    rows: [{ name: "Luger P08 9mm", qualified: true, future: true }],
    preview: { name: "Luger P08 9mm", qualified: true, future: true },
    filters: {},
    futureReason: "Set a date on the game clock first."
  };
  for (const part of ["browser-filters", "browser-results"]) {
    const source = readFileSync(new URL(`../templates/apps/${part}.hbs`, import.meta.url), "utf8");
    assert.equal(roots(hb.compile(source)(context)), 1, part);
  }
});

test("a house item helps with the same checks as the entry it is adapted from", async () => {
  const { gearUsePlan } = await import("../module/rules/gear-play-rules.mjs");
  const polygraph = packs.gear.docs.find(d => d.name === "Polygraph");
  const plan = gearUsePlan("senseMotive", "detect-lie", { name: polygraph.name, system: polygraph.system });
  assert.equal(plan.applies, true);
  assert.equal(plan.capIncrease, 5);
  assert.equal(
    plan.bonuses.reduce((sum, b) => sum + (b.value ?? 0), 0),
    1
  );
});
