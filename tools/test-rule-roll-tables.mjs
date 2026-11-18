import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPacks } from "./lib/pack-docs.mjs";
import { criticalInjuryResult } from "../module/rules/critical-injuries.mjs";
const data = JSON.parse(readFileSync(new URL("../src/data/rollable-tables.json", import.meta.url)));
const built = buildPacks(),
  tables = built.packs["gc-tables"].docs;
const table = key => tables.find(t => t.flags.spycraft2.gcTable === key);
const matches = (t, total) => t.embedded.results.filter(r => total >= r.range[0] && total <= r.range[1]);
function totals(formula) {
  const m = formula.match(/^(\d+)d(\d+)(?:\s*([+*])\s*(\d+))?$/);
  assert.ok(m, formula);
  let values = new Set([0]);
  for (let i = 0; i < Number(m[1]); i++)
    values = new Set([...values].flatMap(n => Array.from({ length: Number(m[2]) }, (_, i) => n + i + 1)));
  return [...values].map(n => (m[3] === "+" ? n + Number(m[4]) : m[3] === "*" ? n * Number(m[4]) : n));
}
test("the pack contains all 36 stable tables and every reachable new static total selects exactly one result", () => {
  assert.equal(tables.length, 36);
  assert.equal(data.tables.length, 32);
  assert.equal(new Set(tables.map(t => t._id)).size, 36);
  for (const spec of data.tables) {
    const t = table(spec.id);
    assert.ok(t, spec.id);
    assert.equal(t.formula, spec.formula);
    assert.equal(t.replacement, true);
    assert.equal(t.ownership.default, 0);
    if (spec.rollInput) continue;
    for (const total of totals(t.formula)) assert.equal(matches(t, total).length, 1, `${spec.id}: ${total}`);
  }
});
test("all five Bag Full of Guns formulas retain printed Caliber distributions and stable weapon rows", () => {
  for (const [key, formula] of [
    ["i", "2d4 + 8"],
    ["ii", "2d6 + 6"],
    ["iii", "2d8 + 4"],
    ["iv", "2d10 + 2"],
    ["v", "2d12"]
  ]) {
    const t = table("bag-guns-" + key);
    assert.equal(t.formula, formula);
    assert.equal(t.embedded.results.length, 23);
    assert.match(matches(t, 2)[0].description, /Barrett M82A1/);
    assert.match(matches(t, 12)[0].description, /Beretta 92/);
    assert.match(matches(t, 24)[0].description, /Thompson M1928/);
  }
});
test("vehicle damage follows all 240 printed matrix cells independently of the source vehicle records", () => {
  const matrix = `Cargo Cargo Cargo Animal Cargo Cargo Cargo Cargo Cargo Cargo Cargo Cargo
Cont Cargo Cargo Animal Cont Cont Cargo Cargo Cont Cargo Cargo Cont
Cont Cargo Cont Animal Cont Cont Cargo Cargo Cont Cargo Cargo Cont
Cont Cont Cont Animal Cont Cont Cargo Cont Cont Cont Cargo Eng
Cont Cont Cont Cargo Eng Cont Cont Cont Cont Cont Cont Eng
Eng Cont Eng Cargo Eng Eng Cont Cont Eng Cont Cont Eng
Eng Eng Eng Cargo Eng Eng Eng Cont Eng Eng Eng Flot
Eng Eng Eng Cargo Fuel Eng Eng Eng Eng Eng Eng Flot
Fuel Eng Fuel Cont Fuel Eng Eng Eng Flot Eng Flot Flot
Fuel Fuel Fuel Occ Lift Fuel Fuel Eng Flot Flot Flot Flot
Occ Fuel Fuel Occ Lift Fuel Fuel Fuel Flot Flot Flot Flot
Occ Occ Occ Occ Lift Fuel Fuel Fuel Fuel Flot Fuel Flot
Occ Occ Occ Occ Lift Lift Lift Fuel Fuel Fuel Fuel Fuel
Occ Occ Tract Tract Occ Lift Lift Occ Occ Fuel Occ Fuel
Occ Tract Tract Tract Occ Lift Lift Occ Occ Occ Occ Occ
Tract Tract Tract Tract Occ Occ Occ Occ Occ Occ Occ Occ
Tract Tract W/G W/G Occ Occ Occ Rotors Occ Occ W/G Occ
Tract W/G W/G W/G Occ W/G Occ W/G Occ W/G W/G W/G
W/G W/G W/G W/G W/G W/G W/G W/G W/G W/G W/G W/G
W/G W/G W/G W/G W/G W/G W/G W/G W/G W/G W/G W/G`
    .split("\n")
    .map(r => r.split(" "));
  const codes = ["pgv", "sgv", "hgv", "m-ad", "psa", "pfa", "sva", "rwa", "psw", "stw", "shp", "sub"];
  const labels = {
    Cargo: "Cargo",
    Cont: "Controls",
    Eng: "Engine",
    Animal: "Animal",
    Fuel: "Fuel",
    Occ: "Occupant",
    Lift: "Lift",
    Flot: "Flotation",
    Rotors: "Rotors",
    Tract: "Traction",
    "W/G": "Weapon or secondary gear"
  };
  matrix.forEach((row, n) =>
    row.forEach((value, i) =>
      assert.equal(matches(table("vehicle-damage-" + codes[i]), n + 1)[0].description, `<p>${labels[value]}</p>`)
    )
  );
});
test("height and weight share the same height increase and encounter distances keep their printed units", () => {
  for (const [key, base, weight] of [
    ["male", 58, 120],
    ["female", 53, 85]
  ]) {
    for (let n = 2; n <= 24; n++) {
      const text = matches(table("height-weight-" + key), n)[0].description;
      assert.ok(text.includes(`(${base + n} in.)`));
      assert.ok(text.includes(`[[${weight} + ${n} * 2d4]]`));
    }
  }
  for (const [key, formula] of [
    ["open", "6d6 * 20"],
    ["mixed", "4d6 * 10"],
    ["dense", "2d6 * 10"],
    ["vertical", "6d6 * 5"]
  ])
    assert.equal(table("encounter-distance-" + key).formula, formula);
  assert.match(matches(table("deviation-direction"), 1)[0].description, /beyond/);
  assert.match(matches(table("deviation-direction"), 5)[0].description, /toward/);
});
test("injury ranges match the actor workflow, including Guts and unlisted totals beyond 70", () => {
  const t = table("table-of-ouch");
  assert.equal(t.flags.spycraft2.rollInput, "criticalInjury");
  assert.equal(matches(t, 0).length, 0);
  for (const die of [10, 20])
    for (let damage = 0; damage <= 100; damage++)
      for (let roll = 1; roll <= die; roll++) {
        const result = criticalInjuryResult({ damage, die }, roll),
          rows = matches(t, result.total);
        assert.equal(rows.length, 1);
        assert.ok(rows[0].description.includes(result.listed ? result.name : "Unlisted total"));
      }
});
