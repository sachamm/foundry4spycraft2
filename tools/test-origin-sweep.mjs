import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { weaponAttack } from "../module/rules/gear.mjs";
import { classCheckEffects, talentSurpriseBonus } from "../module/rules/class-checks.mjs";
import { LEGACY_ORIGIN_NAMES, originRuleName } from "../module/rules/rule-name.mjs";
import { specialtyAttackAction, specialtyAttackBonus } from "../module/rules/specialty-attacks.mjs";

const read = name => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url)));
const origins = read("origins");

// Names only, as listed in the book's Table 1.2 (pp.19, 22). The pack must offer every one of them.
const TALENTS = [
  "Adaptable",
  "Agile",
  "Brainy",
  "Burly",
  "Caustic",
  "Clever",
  "Convincing",
  "Cunning",
  "Daring",
  "Disciplined",
  "Fierce",
  "Fit",
  "Gifted",
  "Gonzo",
  "Graceful",
  "Grizzled",
  "Mysterious",
  "Orphaned",
  "Persistent",
  "Privileged",
  "Reliable",
  "Resolute",
  "Retired",
  "Rowdy",
  "Shrewd",
  "Veteran",
  "Vigilant",
  "Witty"
];
const SPECIALTIES = [
  "Authority",
  "Celebrity",
  "City Dweller",
  "Clergyman",
  "Contract Pro",
  "Criminal",
  "Doctor",
  "Entertainer",
  "Financier",
  "Geek",
  "Grifter",
  "Hot Rodder",
  "Hunter",
  "Icon",
  "Instructor",
  "Investigator",
  "Jack of All Trades",
  "Journalist",
  "Motorhead",
  "Operative",
  "Outdoorsman",
  "Pickpocket",
  "Pilot",
  "Playboy",
  "Rescuer",
  "Researcher",
  "Sailor",
  "Serviceman",
  "Soldier of Fortune",
  "Special Ops",
  "Spiritualist",
  "Stranger",
  "Student",
  "Suit",
  "Test Subject",
  "Thrill-Seeker",
  "Tradesman",
  "Tribesman",
  "Wanderer",
  "Warrior"
];

test("Table 1.2: every Talent and Specialty is offered under the book's name", () => {
  assert.deepEqual(origins.talents.map(o => o.name).sort(), [...TALENTS].sort());
  assert.deepEqual(origins.specialties.map(o => o.name).sort(), [...SPECIALTIES].sort());
  const summaries = read("summaries").origins;
  for (const name of [...TALENTS, ...SPECIALTIES]) assert.ok(summaries[name], `${name} has a summary`);
});

test("renamed specialties keep their old ids and are still recognised under their old names", () => {
  for (const [old, current] of Object.entries(LEGACY_ORIGIN_NAMES)) {
    const entry = origins.specialties.find(o => o.name === current);
    assert.equal(entry?.legacyName, old, current);
    assert.equal(originRuleName({ type: "origin", name: old }), current);
  }
  assert.equal(originRuleName({ type: "feat", name: "Mercenary" }), "Mercenary");
});

test("an agent made with the old Thrill Seeker item still gets its chosen Drive focus", () => {
  const data = origins.specialties.find(o => o.name === "Thrill-Seeker");
  const item = {
    id: "t",
    name: "Thrill Seeker",
    type: "origin",
    system: { ...data, originChoices: { grantedFocus: "Personal Aircraft" } }
  };
  const system = {
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 10, misc: 0 }])),
    progression: [],
    abilityIncreases: {},
    skills: {},
    focuses: {},
    proficiencies: {},
    misc: {},
    pointBuyBudget: 36
  };
  const sys = computeAgent(system, [item], cfg);
  assert.equal(sys.specialtyName, "Thrill-Seeker");
  assert.ok(sys.focusTotals?.drive?.includes("Personal Aircraft"), JSON.stringify(sys.focusTotals));
  // The granted focus is read only through the origin's rule, so it appears only when the old name is recognised.
  const unknown = computeAgent(system, [{ ...item, name: "Not an origin" }], cfg);
  assert.ok(!unknown.focusTotals?.drive?.includes("Personal Aircraft"));
});

test("p.25: Serviceman, Soldier of Fortune and Warrior attack bonuses grow at Career Levels 5, 10, 15 and 20", () => {
  const at = (specialtyName, level) => ({ specialtyName, level });
  assert.equal(specialtyAttackBonus(at("Soldier of Fortune", 1), "autofire"), 1);
  assert.equal(specialtyAttackBonus(at("Soldier of Fortune", 5), "autofire"), 2);
  assert.equal(specialtyAttackBonus(at("Soldier of Fortune", 20), "autofire"), 5);
  assert.equal(specialtyAttackBonus(at("Soldier of Fortune", 20), "suppressiveFire"), 0);
  assert.equal(specialtyAttackBonus(at("Serviceman", 14), "suppressiveFire"), 3);
  assert.equal(specialtyAttackBonus(at("Warrior", 9), "pummel"), 2);
  assert.equal(specialtyAttackBonus(at("Hunter", 9), "pummel"), 0);
  assert.equal(specialtyAttackAction("autofire", false), "autofire");
  assert.equal(specialtyAttackAction("suppressiveFinal", false), "suppressiveFire");
  assert.equal(specialtyAttackAction("strafe", false), "");
  assert.equal(specialtyAttackAction("", true), "pummel");
});

const shooter = specialtyName => ({
  activeFeatNames: [],
  abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 14, mod: 2 }])),
  bab: 5,
  level: 5,
  specialtyName,
  classLevels: {},
  conditionContext: {},
  proficiencies: Object.fromEntries(Object.keys(cfg.proficiencies).map(k => [k, { proficient: true, forte: false }])),
  unarmed: { threat: 20 }
});
const smg = {
  proficiency: "smg",
  range: 30,
  ammo: "30M3",
  weaponCategory: "submachineGun",
  fireModes: ["single", "burst", "auto"],
  fireMode: "auto",
  sizeHands: "S/2h",
  recoil: 18,
  qualities: "",
  damage: "1d10",
  error: 1,
  threat: 20,
  errorThreat: "1/20",
  quantity: 1,
  carried: true,
  equipped: true
};

test("a Soldier of Fortune's Autofire attack carries the specialty bonus as its own row", () => {
  const options = {
    attackAction: "autofire",
    fireMode: "auto",
    fireAction: "autofire",
    fireVolleys: 3,
    shotsRemaining: 30
  };
  const plain = weaponAttack(shooter("Hunter"), { ...smg }, cfg, "agent", options);
  const pro = weaponAttack(shooter("Soldier of Fortune"), { ...smg }, cfg, "agent", options);
  assert.equal(pro.blocked, false, pro.reason);
  assert.equal(pro.total, plain.total + 2);
  assert.ok(pro.modifiers.some(row => row.label === "Specialty: Soldier of Fortune" && row.value === 2));
  const single = weaponAttack(shooter("Soldier of Fortune"), { ...smg, fireMode: "single" }, cfg, "agent", {
    attackAction: "standard",
    fireMode: "single"
  });
  assert.ok(!single.modifiers.some(row => row.label.startsWith("Specialty")));
});

test("pp.18, 21: Clever and Vigilant add a growing bonus only to checks that determine surprise", () => {
  assert.equal(talentSurpriseBonus({ talentName: "Clever", level: 1 }), 1);
  assert.equal(talentSurpriseBonus({ talentName: "Vigilant", level: 8 }), 3);
  assert.equal(talentSurpriseBonus({ talentName: "Vigilant", level: 20 }), 6);
  assert.equal(talentSurpriseBonus({ talentName: "Fit", level: 20 }), 0);
  const system = { talentName: "Vigilant", level: 4, classOptionSelections: [] };
  assert.equal(classCheckEffects(system, "notice", { id: "awareness" }).bonuses.length, 0);
  assert.deepEqual(classCheckEffects(system, "notice", { id: "awareness" }, { surprise: true }).bonuses, [
    { value: 2, type: "" }
  ]);
});

test("Subplots offer Impending Doom (p.55)", () => {
  assert.ok(read("core").tables.subplots.includes("Impending Doom"));
});
