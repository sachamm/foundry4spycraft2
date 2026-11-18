import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { weaponSpecialist, specialistDefense } from "../module/rules/weapon-specialist.mjs";
import { weaponAttack, weaponDamage, bigStickPlan, bigStickStatus } from "../module/rules/gear.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const data = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))).find(
  c => c.key === "soldier"
);
function soldier() {
  return {
    id: "soldier",
    name: "Soldier",
    type: "class",
    system: {
      ...structuredClone(data),
      identifier: "soldier",
      vitalityDie: 12,
      choices: {},
      weaponSpecialist: { 6: { proficiency: "rifle" } }
    }
  };
}
function choose(item, level, name) {
  const index = item.system.choiceSchedule.findIndex(slot => slot.list === "weaponSpecialist" && slot.level === level);
  item.system.choices[index] = item.system.choiceLists
    .find(list => list.key === "weaponSpecialist")
    .options.find(option => option.name === name).index;
}
const base = level => ({
  classLevels: { soldier: level },
  proficiencyTotals: { rifle: { proficient: true }, edged: { proficient: true }, handgun: { proficient: true } },
  actionDice: { max: 4 }
});
test("RAW pp.49–50: all seven Weapon Specialist abilities can be chosen with the mandatory first proficiency", () => {
  const options = data.choiceLists.find(list => list.key === "weaponSpecialist").options;
  assert.equal(options.length, 7);
  for (const option of options) {
    const item = soldier();
    choose(item, 6, option.name);
    const result = weaponSpecialist(base(6), [item], cfg);
    assert.deepEqual(result.abilities, [option.name]);
    assert.deepEqual(result.proficiencies, ["rifle"]);
    assert.deepEqual(result.pending, []);
    assert.deepEqual(result.warnings, []);
  }
  assert.equal(weaponSpecialist(base(5), [soldier()], cfg).fields.length, 0);
});
test("later milestones grant either a new ability or a possessed proficiency; retained hidden ability selections have no effect", () => {
  const item = soldier();
  choose(item, 6, "No Worries");
  choose(item, 9, "Killer Instinct");
  item.system.weaponSpecialist[9] = { mode: "proficiency", proficiency: "edged" };
  choose(item, 12, "Most Deadly");
  item.system.weaponSpecialist[15] = { mode: "proficiency", proficiency: "handgun" };
  choose(item, 18, "Big Stick");
  const result = weaponSpecialist(base(18), [item], cfg);
  assert.deepEqual(result.abilities, ["No Worries", "Most Deadly", "Big Stick"]);
  assert.deepEqual(result.proficiencies, ["rifle", "edged", "handgun"]);
  assert.equal(result.fields.length, 5);
  assert.deepEqual(result.pending, []);
});
test("unpossessed or duplicate proficiency targets, duplicate abilities and future selections are rejected", () => {
  const item = soldier();
  choose(item, 6, "No Worries");
  choose(item, 9, "No Worries");
  item.system.weaponSpecialist[6].proficiency = "unarmed";
  const result = weaponSpecialist(base(9), [item], cfg);
  assert.equal(result.proficiencies.length, 0);
  assert.ok(result.warnings.some(s => s.includes("must be possessed")));
  assert.ok(result.warnings.some(s => s.includes("only once")));
  item.system.weaponSpecialist[6].proficiency = "rifle";
  item.system.weaponSpecialist[9] = { mode: "proficiency", proficiency: "rifle" };
  assert.ok(weaponSpecialist(base(9), [item], cfg).warnings.some(s => s.includes("different proficiency")));
  assert.equal(weaponSpecialist(base(6), [item], cfg).fields.length, 1);
});
test("Weapon Specialist effects apply to every chosen proficiency and preserve ranged damage conditions", () => {
  const sys = {
    ...base(18),
    bab: 6,
    abilities: { str: { mod: 2 }, dex: { mod: 3 } },
    weaponSpecialist: { proficiencies: ["rifle", "edged"], abilities: ["No Worries", "Killer Instinct", "Foibles"] }
  };
  const rifle = { proficiency: "rifle", damage: "1d12", errorThreat: "1–2/20" };
  assert.equal(weaponAttack(sys, rifle, cfg).error, 0);
  assert.equal(weaponAttack(sys, { ...rifle, proficiency: "handgun" }, cfg).error, 2);
  assert.equal(weaponDamage(sys, rifle).formula, "max(1, 1d12 + (0))");
  assert.equal(weaponDamage(sys, rifle, { withinCQB: true }).formula, "max(1, 1d12 + 1d4 + (0))");
  assert.equal(weaponDamage(sys, { ...rifle, proficiency: "edged" }).formula, "max(1, 1d12 + 1d4 + (2))");
  assert.deepEqual(specialistDefense(sys, "rifle"), { dodge: 1, damageReduction: 1 });
  assert.deepEqual(specialistDefense(sys, "handgun"), { dodge: 0, damageReduction: 0 });
});
test("full engine ignores proficiency-mode ability placeholders and provides the correct limited-use counters", () => {
  const item = soldier();
  choose(item, 6, "Mow Down");
  choose(item, 9, "Mow Down");
  item.system.weaponSpecialist[9] = { mode: "proficiency", proficiency: "edged" };
  choose(item, 12, "Showdown");
  const sys = {
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(key => [key, { base: 10 }])),
    progression: Array.from({ length: 12 }, () => ({ classId: "soldier", vitality: 1, skills: {} })),
    proficiencies: { rifle: { proficient: true }, edged: { proficient: true } },
    misc: {}
  };
  computeAgent(sys, [item], cfg);
  assert.deepEqual(sys.weaponSpecialist.abilities, ["Mow Down", "Showdown"]);
  assert.ok(!sys.warnings.some(s => s.includes("Mow Down may be selected only")));
  assert.equal(sys.limitedUses.find(use => use.id === "mowDown").period, "round");
  assert.equal(sys.limitedUses.find(use => use.id === "showdown").limit, sys.actionDice.max);
});

const missionWeapon = (patch = {}) => ({
  id: "rifle",
  name: "Mission rifle",
  type: "weapon",
  system: { proficiency: "rifle", caliber: 2, pick: "W", pickCount: 1, quantity: 1, ...patch }
});
const bigSystem = caliber => ({
  usagePeriods: { mission: "m1" },
  missionReserves: { epoch: "m1", caliber },
  weaponSpecialist: { abilities: ["Big Stick"], proficiencies: ["rifle"] },
  actionDice: { max: 4 }
});
test("RAW p.49 Big Stick permits exactly one paid covered Weapon pick at one higher Caliber in all four eligible mission grades", () => {
  for (let caliber = 1; caliber <= 4; caliber++) {
    const system = bigSystem(caliber),
      item = missionWeapon({ caliber: caliber + 1 });
    const plan = bigStickPlan(system, [item], { itemId: item.id, intelConfirmed: true });
    assert.equal(plan.record.missionCaliber, caliber);
    assert.equal(item.system.pick, "W");
    system.bigStickMissionPick = plan.record;
    item.system.bigStickMissionPick = plan.stamp;
    assert.equal(bigStickStatus(system, [item]).warnings.length, 0);
    assert.equal(bigStickStatus(system, []).used, true);
    assert.throws(() => bigStickPlan(system, [item], { itemId: item.id, intelConfirmed: true }), /already/);
  }
});
test("Big Stick rejects wrong proficiencies, extra picks, reserves, ammo, personal gear and invalid affiliation picks", () => {
  const system = bigSystem(2);
  for (const patch of [
    { proficiency: "handgun" },
    { pickCount: 2 },
    { reserve: true },
    { reserveAcquisition: {} },
    { ammunitionOnly: true },
    { possessionSource: "wealth" },
    { common: true },
    { pick: "" },
    { pick: "S" },
    { pick: "CHA" },
    { caliber: 4 },
    { caliber: 0 },
    { quantity: 0 },
    { quantity: 2 }
  ])
    assert.throws(() => bigStickPlan(system, [missionWeapon(patch)], { itemId: "rifle", intelConfirmed: true }));
  system.affiliationType = "freelance";
  assert.ok(bigStickPlan(system, [missionWeapon({ pick: "CHA" })], { itemId: "rifle", intelConfirmed: true }));
  assert.throws(() => bigStickPlan(system, [missionWeapon()], { itemId: "rifle" }), /Intel/);
  system.weaponSpecialist.abilities = [];
  assert.throws(() => bigStickPlan(system, [missionWeapon()], { itemId: "rifle", intelConfirmed: true }), /earned/);
});
test("Big Stick mission V grants upgrades rather than another Caliber; old selections and changed mission records require review", () => {
  const system = bigSystem(5);
  assert.equal(bigStickStatus(system).upgradeAllowance, 4);
  assert.throws(
    () => bigStickPlan(system, [missionWeapon()], { itemId: "rifle", intelConfirmed: true }),
    /extra upgrades/
  );
  system.usagePeriods.mission = "m2";
  assert.equal(bigStickStatus(system).caliber, 0);
  assert.throws(
    () => bigStickPlan(system, [missionWeapon()], { itemId: "rifle", intelConfirmed: true }),
    /mission.*Caliber/
  );
  const item = missionWeapon({ bigStickMissionPick: { epoch: "m1" } });
  assert.match(bigStickStatus(system, [item]).warnings.join(""), /earlier mission/);
});
test("full engine charges Big Stick’s ordinary weapon pick, removes only its Caliber warning and restores warning on lost proficiency or changed mission Caliber", () => {
  const item = soldier();
  choose(item, 6, "Big Stick");
  const weapon = missionWeapon({ caliber: 3 });
  const system = {
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(key => [key, { base: 10 }])),
    progression: Array.from({ length: 6 }, () => ({ classId: "soldier", vitality: 1, skills: {} })),
    proficiencies: { rifle: { proficient: true } },
    misc: {},
    usagePeriods: { mission: "m1" },
    missionReserves: { epoch: "m1", caliber: 2, picks: {}, spent: {}, common: 0 }
  };
  computeAgent(system, [item, weapon], cfg);
  assert.ok(system.warnings.some(w => w.includes("Caliber exceeds")));
  const before = system.gearPicks.W.spent;
  const plan = bigStickPlan(system, [weapon], { itemId: "rifle", intelConfirmed: true });
  system.bigStickMissionPick = plan.record;
  weapon.system.bigStickMissionPick = plan.stamp;
  computeAgent(system, [item, weapon], cfg);
  assert.equal(system.gearPicks.W.spent, before);
  assert.equal(before, 1);
  assert.ok(!system.warnings.some(w => w.includes("Caliber exceeds")));
  system.missionReserves.caliber = 1;
  computeAgent(system, [item, weapon], cfg);
  assert.ok(system.warnings.some(w => w.includes("Caliber exceeds")));
  system.missionReserves.caliber = 2;
  system.proficiencies.rifle.proficient = false;
  computeAgent(system, [item, weapon], cfg);
  assert.ok(system.warnings.some(w => w.includes("Caliber exceeds")));
});
