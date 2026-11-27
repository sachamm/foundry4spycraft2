import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  missionGearRestrictions,
  applyGearRestrictions,
  gearRestrictionNames,
  setGearRestrictionSource
} from "../module/rules/gear-restrictions.mjs";
import { GC_DATA } from "../module/rules/gc-tables.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";

const rows = GC_DATA.tables.gearRestrictions;
const mission = restrictions => ({ active: true, ended: false, gearRestrictions: restrictions });

test("a mission's Gear Restrictions add up their lost picks and keep the GC's lists (Table 7.8, p.437)", () => {
  assert.equal(missionGearRestrictions({ ...mission([]) }, rows), null);
  assert.deepEqual(missionGearRestrictions(mission([{ id: "minus-2-gear-picks-players-choice", count: 1 }]), rows), {
    picks: 2,
    chooser: "player",
    lists: []
  });
  assert.equal(
    missionGearRestrictions(
      mission([
        { id: "minus-1-gear-pick-players-choice", count: 1 },
        { id: "minus-1-gear-pick-gcs-choice", count: 1 }
      ]),
      rows
    ).chooser,
    "gc"
  );
  assert.deepEqual(
    missionGearRestrictions(mission([{ id: "restricted-weapon-options", names: ["Colt M1911A1 .45 ACP"] }]), rows)
      .lists,
    [{ category: "weapons", names: ["Colt M1911A1 .45 ACP"] }]
  );
  assert.equal(
    missionGearRestrictions({ ...mission([{ id: "minus-1-gear-pick-gcs-choice" }]), ended: true }, rows),
    null,
    "only a mission under way restricts gear"
  );
});

test("lost picks come off the categories chosen at Intel, and picks off the GC's list are flagged", () => {
  const fresh = () => ({
    W: { available: 3, spent: 1 },
    G: { available: 2, spent: 0 },
    CHA: { available: 1, spent: 0 }
  });
  let picks = fresh();
  const restriction = { picks: 2, chooser: "player", lists: [] };
  assert.match(applyGearRestrictions(picks, {}, [], restriction).join(" "), /remove 2 mission gear pick/);
  picks = fresh();
  assert.deepEqual(applyGearRestrictions(picks, { W: 1, G: 1 }, [], restriction), []);
  assert.equal(picks.W.available, 2);
  assert.equal(picks.W.remaining, 1);
  assert.equal(picks.G.remaining, 1);
  picks = fresh();
  assert.match(applyGearRestrictions(picks, { W: 3 }, [], { ...restriction, picks: 3 }).join(" "), /overspent/);
  assert.match(applyGearRestrictions(fresh(), { W: 1 }, [], null).join(" "), /No Gear Restriction is in force/);
  const lists = { picks: 0, chooser: "player", lists: [{ category: "weapons", names: ["Walther PPK .380 ACP"] }] };
  const items = [
    { name: "Walther PPK .380 ACP", type: "weapon", system: { pick: "W" } },
    { name: "Colt M1911A1 .45 ACP", type: "weapon", system: { pick: "W" } },
    { name: "Family pistol", type: "weapon", system: { pick: "", possessionSource: "wealth" } }
  ];
  assert.deepEqual(applyGearRestrictions(fresh(), {}, items, lists), [
    "Colt M1911A1 .45 ACP: not on the GC's list of weapons allowed on this mission (Gear Restriction, p.437)."
  ]);
  const gadget = {
    name: "Pen gun",
    type: "gear",
    system: { pick: "G", gadget: { mechanisms: [{ name: "Camera" }, { name: "Garrote" }] } }
  };
  const gadgetList = { picks: 0, chooser: "gc", lists: [{ category: "gadgets", names: ["Camera"] }] };
  assert.deepEqual(applyGearRestrictions(fresh(), {}, [gadget], gadgetList), [
    "Garrote: not on the GC's list of Mechanisms allowed on this mission (Gear Restriction, p.437)."
  ]);
});

test("the GC's list is one name per line, and no longer than the row allows", () => {
  assert.deepEqual(gearRestrictionNames("Walther PPK\n\n  Colt M1911A1 \nWalther PPK"), [
    "Walther PPK",
    "Colt M1911A1"
  ]);
  assert.throws(() => gearRestrictionNames(Array.from({ length: 13 }, (_, i) => `Gun ${i}`).join("\n")), /allows 12/);
});

test("the sheet's pick budget falls by the mission's Gear Restriction", () => {
  const data = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))).find(
    c => c.key === "wheelman"
  );
  const cls = {
    id: "wheelman",
    name: "Wheelman",
    type: "class",
    system: { ...structuredClone(data), identifier: "wheelman", vitalityDie: 10 }
  };
  const build = losses => ({
    level: 1,
    usagePeriods: { mission: "m" },
    classLevels: { wheelman: 1 },
    actionDice: { max: 3 },
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 10 }])),
    progression: [{ classId: "wheelman", vitality: 5, skills: {} }],
    misc: {},
    gearRestrictionLosses: losses
  });
  const plain = build({});
  computeAgent(plain, [cls], cfg);
  setGearRestrictionSource(() => ({ picks: 1, chooser: "player", lists: [] }));
  try {
    const s = build({ V: 1 });
    computeAgent(s, [cls], cfg);
    assert.equal(s.gearPicks.V.available, plain.gearPicks.V.available - 1);
    assert.equal(s.gearRestriction.picks, 1);
    assert.equal(s.gearRestriction.show, true);
    assert.ok(!s.warnings.some(w => w.startsWith("Gear Restriction")));
    const unassigned = build({});
    computeAgent(unassigned, [cls], cfg);
    assert.ok(unassigned.warnings.some(w => /Gear Restriction: remove 1/.test(w)));
  } finally {
    setGearRestrictionSource(null);
  }
});
