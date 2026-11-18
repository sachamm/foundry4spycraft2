import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FIREARM_CATEGORIES,
  firearmDefaults,
  weaponFireModes,
  firearmContext,
  rangedAttackContext,
  weaponRangeEffects,
  aimBraceContext,
  bracedReflexPenalty
} from "../module/rules/firearms.mjs";
import { weaponAttack } from "../module/rules/gear.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const equipment = JSON.parse(readFileSync(new URL("../src/data/equipment.json", import.meta.url)));
const sys = str => ({
  size: "Medium",
  bab: 3,
  abilities: { str: { value: str, mod: Math.floor((str - 10) / 2) }, dex: { value: 18, mod: 4 } },
  proficiencyTotals: { rifle: { proficient: true } },
  activeFeatNames: []
});
test("RAW Table 4.77: all 22 firearm/heavy-weapon category defaults retain their legal modes", () => {
  const automatic = ["assaultRifle", "lightSMG", "heavySMG", "flamethrower"],
    noSingle = ["saw", "gpmg", "hmg"];
  assert.equal(Object.keys(FIREARM_CATEGORIES).length, 22);
  for (const key of Object.keys(FIREARM_CATEGORIES)) {
    const expected = automatic.includes(key)
      ? ["single", "burst", "auto"]
      : noSingle.includes(key)
        ? ["burst", "auto"]
        : ["single"];
    assert.deepEqual(weaponFireModes({ weaponCategory: key }), expected, key);
  }
  for (const key of ["missileLauncher", "mortar", "rocketLauncher"])
    assert.deepEqual(weaponFireModes({ weaponCategory: key, fireModes: ["burst", "auto"], qualities: "NFM (S/B/F)" }), [
      "single"
    ]);
});
test("all existing positive-recoil catalog entries classify from their printed weapon-table category", () => {
  let count = 0;
  for (const item of equipment.weapons) {
    const defaults = firearmDefaults(item.sourceTable, item.qualities);
    if (item.recoil > 0) {
      count++;
      assert.ok(defaults.fireModes.length, item.name);
      assert.notEqual(defaults.weaponCategory, "other", item.name);
    }
  }
  assert.ok(count > 200);
  assert.deepEqual(firearmDefaults("Table 4.45: assault rifle Picks", "").fireModes, ["single", "burst", "auto"]);
  assert.deepEqual(firearmDefaults("Table 4.46: Bolt-Action rifle Picks", "").fireModes, ["single"]);
  assert.deepEqual(firearmDefaults("Table 4.35: exotic hurled weapon Picks", "").fireModes, []);
});
test("printed nonstandard fire modes override base categories, including Burst-only and Full Auto variants", () => {
  for (const [name, expected] of [
    ["Colt M16A2/A4 5.56mm NATO", ["single", "burst"]],
    ["Colt M4 5.56mm NATO", ["single", "burst"]],
    ["Beretta 93R 9mm", ["single", "burst"]],
    ["Glock 18 9mm", ["single", "burst", "auto"]],
    ["MAC M10 9mm", ["burst", "auto"]],
    ["Reutech Striker 12 guage slug", ["single", "burst", "auto"]]
  ]) {
    const item = equipment.weapons.find(w => w.name === name);
    assert.ok(item, name);
    assert.deepEqual(firearmDefaults(item.sourceTable, item.qualities).fireModes, expected, name);
  }
});
test("RAW p.225: single-shot recoil is minus one below Strength; Burst/Full Auto use the full shortfall", () => {
  const weapon = { weaponCategory: "assaultRifle", recoil: 13 };
  for (const [strength, single, burst] of [
    [8, -1, -5],
    [12, -1, -1],
    [13, 0, 0],
    [18, 0, 0]
  ]) {
    assert.equal(firearmContext(sys(strength), weapon, { fireMode: "single" }).recoilPenalty, single);
    for (const fireMode of ["burst", "auto"])
      assert.equal(firearmContext(sys(strength), weapon, { fireMode }).recoilPenalty, burst);
  }
  assert.equal(firearmContext(sys(8), { weaponCategory: "other", recoil: 0 }).firearm, false);
  assert.equal(firearmContext(sys(8), { weaponCategory: "boltActionRifle", fireMode: "auto" }).blocked, true);
});
test("Revolver Basics adds Burst only while its feat is active, without changing another weapon’s modes", () => {
  const weapon = { weaponCategory: "serviceRevolver", fireModes: ["single"], fireMode: "burst" },
    system = { activeFeatNames: ["Revolver Basics"] };
  assert.deepEqual(weaponFireModes(weapon, system), ["single", "burst"]);
  assert.equal(firearmContext(system, weapon).blocked, false);
  assert.equal(firearmContext({}, weapon).blocked, true);
  assert.deepEqual(weaponFireModes({ ...weapon, weaponCategory: "servicePistol" }, system), ["single"]);
});
test("the attack calculation applies the chosen mode’s recoil once, using Strength score rather than modifier", () => {
  const weapon = {
    proficiency: "rifle",
    weaponCategory: "assaultRifle",
    recoil: 17,
    damage: "4d4",
    errorThreat: "1/20",
    sizeHands: "S/2h"
  };
  assert.equal(weaponAttack(sys(14), { ...weapon, fireMode: "single" }, cfg).total, 6);
  assert.equal(weaponAttack(sys(14), { ...weapon, fireMode: "burst" }, cfg).total, 4);
  assert.equal(weaponAttack(sys(18), { ...weapon, fireMode: "auto" }, cfg).total, 7);
  assert.match(weaponAttack(sys(14), { ...weapon, fireMode: "burst" }, cfg).notes, /recoil 17 vs Strength 14: -3/);
});

test("RAW pp.225,347: range penalties use complete increments beyond the first and stop at the category maximum", () => {
  const pistol = { weaponCategory: "servicePistol", range: 25 };
  for (const [distance, penalty] of [
    [0, 0],
    [25, 0],
    [25.01, -2],
    [50, -2],
    [80, -6],
    [250, -18]
  ])
    assert.equal(rangedAttackContext(sys(10), pistol, { distanceFeet: distance }).rangePenalty, penalty);
  assert.equal(rangedAttackContext(sys(10), pistol, { distanceFeet: 250 }).rangeBlocked, false);
  assert.equal(rangedAttackContext(sys(10), pistol, { distanceFeet: 250.01 }).rangeBlocked, true);
  for (const weaponCategory of [
    "holdoutPistol",
    "backupRevolver",
    "breakActionShotgun",
    "pumpActionShotgun",
    "semiAutomaticShotgun",
    "flamethrower"
  ]) {
    assert.equal(
      rangedAttackContext(sys(10), { weaponCategory, range: 20 }, { distanceFeet: 100 }).rangeBlocked,
      false
    );
    assert.equal(rangedAttackContext(sys(10), { weaponCategory, range: 20 }, { distanceFeet: 101 }).rangeBlocked, true);
  }
  for (const distanceFeet of [-1, NaN, Infinity])
    assert.equal(rangedAttackContext(sys(10), pistol, { distanceFeet }).rangeBlocked, true);
  assert.equal(rangedAttackContext(sys(10), pistol).rangeKnown, false);
});
test("all 30 ranged hurled entries retain their printed maximum increment counts; positive Strength raises the maximum, capped at ten", () => {
  const reference = JSON.parse(readFileSync(new URL("./fixtures/raw/gear-reference.json", import.meta.url)));
  const entries = equipment.weapons.filter(w => /Hurled/.test(w.proficiency) && w.range > 0);
  assert.equal(entries.length, 30);
  for (const item of entries) {
    const expected = Number(reference.weapons[item.legacyName ?? item.name].cells[5].match(/×\s*(\d+)/)[1]);
    assert.equal(item.maxRangeIncrements, expected, item.name);
  }
  const spear = { proficiency: "hurled", maxRangeIncrements: 6, range: 15 };
  assert.equal(rangedAttackContext(sys(8), spear, { distanceFeet: 30 }).maxIncrements, 6);
  assert.equal(rangedAttackContext(sys(14), spear, { distanceFeet: 30 }).maxIncrements, 8);
  assert.equal(rangedAttackContext(sys(24), spear, { distanceFeet: 30 }).maxIncrements, 10);
});
test("range penalties and recoil stack in the attack calculation; overload prevents even an unmeasured thrown attack", () => {
  const weapon = {
    proficiency: "rifle",
    weaponCategory: "assaultRifle",
    recoil: 13,
    fireMode: "burst",
    range: 25,
    damage: "4d4",
    errorThreat: "1/20",
    sizeHands: "S/2h"
  };
  const attack = weaponAttack(sys(8), weapon, cfg, "agent", { distanceFeet: 80 });
  assert.equal(attack.total, -4);
  assert.equal(attack.rangePenalty, -6);
  assert.equal(attack.recoilPenalty, -5);
  assert.equal(
    weaponAttack(
      { ...sys(14), encumbrance: { immobile: true } },
      { proficiency: "hurled", range: 15, maxRangeIncrements: 4, damage: "1d6", sizeHands: "S/1h" },
      cfg
    ).blocked,
    true
  );
});

test("RAW p.182: Marksmanship Mastery rounds firearm range up to five feet; Supremacy replaces it and triples hurled range", () => {
  const weapon = { proficiency: "rifle", range: 25 };
  assert.equal(
    weaponRangeEffects({ activeFeatNames: ["Marksmanship Mastery"] }, weapon, { firearm: true }).increment,
    40
  );
  const supremacy = { activeFeatNames: ["Marksmanship Mastery", "Marksmanship Supremacy"] };
  assert.equal(weaponRangeEffects(supremacy, weapon, { firearm: true }).increment, 50);
  assert.equal(weaponRangeEffects(supremacy, { proficiency: "hurled", range: 15 }).increment, 45);
  assert.equal(weaponRangeEffects(supremacy, weapon).cqbRange, 60);
});
test("RAW pp.180–182,329: guided/indirect range benefits use additive multipliers; source error reductions retain their minimum", () => {
  const guided = {
    proficiency: "guided",
    weaponCategory: "missileLauncher",
    range: 100,
    errorThreat: "1–3/20",
    sizeHands: "M/2h"
  };
  const sys = { ...systemForRange(), activeFeatNames: ["Guided Weapon Basics", "Marksmanship Supremacy"] };
  assert.equal(weaponRangeEffects(sys, guided, { firearm: true }).increment, 300);
  assert.equal(weaponAttack(sys, guided, cfg).error, 2);
  const indirect = { ...guided, proficiency: "indirectFire", weaponCategory: "mortar", range: 125 };
  sys.activeFeatNames = ["Bombard", "Marksmanship Mastery"];
  assert.equal(weaponRangeEffects(sys, indirect, { firearm: true }).increment, 315);
  assert.equal(weaponAttack(sys, { ...indirect, errorThreat: "1/20" }, cfg).error, 1);
});
function systemForRange() {
  return {
    ...sys(14),
    proficiencyTotals: {
      guided: { proficient: true },
      indirectFire: { proficient: true },
      hurled: { proficient: true },
      rifle: { proficient: true }
    }
  };
}
test("Grenade Basics applies only to thrown grenades, with minimum-one error reduction before a minimum-zero specialist benefit", () => {
  const system = { ...systemForRange(), activeFeatNames: ["Grenade Basics"] },
    grenade = {
      name: "Fragmentation grenade",
      proficiency: "hurled",
      range: 15,
      maxRangeIncrements: 4,
      errorThreat: "1–3/20",
      sizeHands: "D/1h"
    };
  assert.equal(weaponAttack(system, grenade, cfg).range, 20);
  assert.equal(weaponAttack(system, grenade, cfg).error, 1);
  assert.equal(weaponAttack(system, { ...grenade, name: "Throwing knife" }, cfg).range, 15);
  system.weaponSpecialist = { proficiencies: ["hurled"], abilities: ["No Worries"] };
  assert.equal(weaponAttack(system, grenade, cfg).error, 0);
  system.activeFeatNames.push("Marksmanship Mastery");
  system.encumbrance = { throwRange: -5 };
  assert.equal(weaponAttack(system, grenade, cfg).range, 35);
});
test("CLS reduces recoil only while the stock is extended and retains its observer-detection tradeoff", () => {
  const weapon = {
    proficiency: "rifle",
    weaponCategory: "assaultRifle",
    range: 25,
    recoil: 15,
    fireMode: "burst",
    qualities: "CLS",
    sizeHands: "S/2h"
  };
  assert.equal(firearmContext(sys(12), weapon).recoilPenalty, -3);
  assert.equal(firearmContext(sys(12), { ...weapon, stockExtended: true }).recoilPenalty, -1);
  assert.equal(firearmContext(sys(12), { ...weapon, qualities: "", stockExtended: true }).recoilPenalty, -3);
  assert.match(weaponAttack(sys(12), { ...weapon, stockExtended: true }, cfg).notes, /observers gain \+2/);
});

test("RAW p.354: valid Aim and Brace stack on Standard Attack; bracing raises recoil Strength rather than damage", () => {
  const system = systemForRange(),
    weapon = {
      proficiency: "rifle",
      weaponCategory: "assaultRifle",
      recoil: 17,
      range: 100,
      damage: "4d4",
      errorThreat: "1/20",
      sizeHands: "S/2h"
    };
  const base = weaponAttack(system, weapon, cfg),
    attack = weaponAttack(system, weapon, cfg, "agent", {
      aimed: true,
      braced: true,
      stableSurface: true,
      attackAction: "standard"
    });
  assert.equal(attack.blocked, false);
  assert.equal(attack.stance.aimBonus, 1);
  assert.equal(attack.stance.braceBonus, 1);
  assert.equal(attack.recoilStrength, 16);
  assert.equal(attack.recoilPenalty, -1);
  assert.equal(attack.total, base.total + 2);
  const burst = weaponAttack(system, { ...weapon, fireMode: "burst" }, cfg, "agent", {
    braced: true,
    stableSurface: true,
    attackAction: "autofire"
  });
  assert.equal(burst.recoilPenalty, -1);
  assert.equal(burst.stance.braceBonus, 1);
});
test("RAW pp.182,352,354: Marksmanship permits unsupported Brace and improves Aim; untrained Aim doubles its action time rather than becoming forbidden", () => {
  const system = { ...systemForRange(), activeFeatNames: ["Marksmanship Basics", "Marksmanship Mastery"] },
    opts = { aimed: true, braced: true, attackAction: "standard", trained: true, firearm: true, ranged: true };
  const result = aimBraceContext(system, {}, opts);
  assert.equal(result.blocked, false);
  assert.equal(result.aimBonus, 2);
  assert.equal(result.aimAction, "half");
  assert.equal(bracedReflexPenalty(system), -1);
  assert.equal(bracedReflexPenalty({}), -4);
  const untrained = aimBraceContext({}, {}, { ...opts, braced: false, trained: false });
  assert.equal(untrained.blocked, false);
  assert.equal(untrained.aimBonus, 1);
  assert.equal(untrained.aimAction, "full");
  assert.match(untrained.notes.join(" "), /cannot be reduced/);
});
test("Aim and Brace retain action scope, valid ranged weapons and required support; their bonuses never repeat on unspecified attacks", () => {
  const opts = { aimed: true, braced: true, stableSurface: true, trained: true, firearm: true, ranged: true };
  const other = aimBraceContext({}, {}, opts);
  assert.equal(other.aimBonus, 0);
  assert.equal(other.braceBonus, 0);
  assert.equal(other.recoilStrengthIncrease, 2);
  assert.equal(aimBraceContext({}, {}, { ...opts, stableSurface: false }).blocked, true);
  assert.equal(aimBraceContext({}, {}, { ...opts, ranged: false }).blocked, true);
  assert.equal(aimBraceContext({}, {}, { ...opts, firearm: false }).blocked, true);
  const autofire = aimBraceContext({}, {}, { ...opts, attackAction: "autofire" });
  assert.equal(autofire.aimBonus, 0);
  assert.equal(autofire.braceBonus, 1);
});
test("RAW p.182: Sharpshooter threat increases require the corresponding aimed/braced context and do not create a threat range from none", () => {
  const system = { ...systemForRange(), activeFeatNames: ["Sharpshooter Mastery", "Sharpshooter Supremacy"] },
    weapon = {
      proficiency: "rifle",
      weaponCategory: "assaultRifle",
      damage: "4d4",
      errorThreat: "1/20",
      range: 100,
      sizeHands: "S/2h"
    };
  const opts = { aimed: true, braced: true, stableSurface: true, attackAction: "standard" };
  assert.equal(weaponAttack(system, weapon, cfg).threat, 20);
  assert.equal(weaponAttack(system, weapon, cfg, "agent", { ...opts, braced: false }).threat, 18);
  assert.equal(weaponAttack(system, weapon, cfg, "agent", { ...opts, aimed: false }).threat, 19);
  assert.equal(weaponAttack(system, weapon, cfg, "agent", opts).threat, 17);
  assert.equal(weaponAttack(system, { ...weapon, errorThreat: "1/—" }, cfg, "agent", opts).threat, 0);
});

test("all 21 entries cover the complete printed SAW/GPMG/HMG/flamethrower tables with distinct ammunition variants and upgrade allowances", () => {
  const weapons = equipment.weapons.filter(w => /^Table 4\.5[0-3]:/.test(w.sourceTable));
  assert.equal(weapons.length, 21);
  const expected = {
    "Enfield L86A1 LSW 5.56×45mm NATO": [267, "III", 16.1, 0, "saw"],
    "Browning M1918 BAR .30-06": [267, "IV", 19.3, 0, "saw"],
    "FN Minimi 5.56×45mm NATO": [267, "IV", 15.7, 3, "saw"],
    "FN Minimi Para 5.56×45mm NATO": [267, "IV", 14.7, 3, "saw"],
    "NORINCO QJY-88 5.8×42mm": [267, "IV", 10.1, 1, "saw"],
    "RSA RPK 7.62×39mm Russian": [267, "IV", 11, 3, "saw"],
    "RSA RPK-74 5.45×39mm Russian": [267, "IV", 11, 2, "saw"],
    "Steyr AUG Hbar 5.56×45mm NATO": [267, "IV", 10.8, 3, "saw"],
    "Saco M60 7.62×51mm NATO": [267, "III", 23.1, 0, "gpmg"],
    "FN MAG 7.62×51mm NATO": [267, "IV", 24.3, 0, "gpmg"],
    "German State Arsenal MG-42 7.62×51mm NATO": [267, "IV", 25.4, 3, "gpmg"],
    "German State Arsenal MG-42 8mm Mauser": [267, "IV", 25.4, 2, "gpmg"],
    "RSA PK 7.62×54mm Russian": [267, "IV", 19.8, 1, "gpmg"],
    "Browning M2hB .50 BMG": [268, "IV", 128, 0, "hmg"],
    "General Electric M134 7.62×51mm NATO": [268, "IV", 62, 0, "hmg"],
    "RSA DShK 12.7×109mm Russian": [268, "IV", 346, 0, "hmg"],
    "RSA KPV 14.5mm Russian": [268, "IV", 356, 0, "hmg"],
    "Hydroar LC T1 M1": [268, "III", 75, 0, "flamethrower"],
    "RSA LPO-50": [268, "III", 50, 0, "flamethrower"],
    "U.S. Arsenal M2A1": [268, "III", 70, 0, "flamethrower"],
    "U.S. Arsenal M9A1": [268, "III", 50, 0, "flamethrower"]
  };
  assert.deepEqual(weapons.map(w => w.name).sort(), Object.keys(expected).sort());
  for (const w of weapons) {
    const [page, caliber, weight, upgrades, category] = expected[w.name];
    assert.equal(w.proficiency, category === "saw" ? "Rifle" : "Tactical", w.name);
    assert.equal(w.untrainedPenalty, category === "saw" ? -6 : -8, w.name);
    assert.equal(w.sourcePage, page, w.name);
    assert.equal(w.caliber, caliber, w.name);
    assert.equal(w.weight, weight, w.name);
    assert.equal(w.upgradeAllowance, upgrades, w.name);
    assert.equal(firearmDefaults(w.sourceTable, w.qualities).weaponCategory, category, w.name);
    assert.match(w.rulesNote, /Complexity:.*First year:.*Street value:/);
  }
  for (const name of ["RSA RPK 7.62×39mm Russian", "RSA RPK-74 5.45×39mm Russian", "Steyr AUG Hbar 5.56×45mm NATO"])
    assert.match(weapons.find(w => w.name === name).ammo, /\bor\b/);
  assert.match(weapons.find(w => w.name === "Saco M60 7.62×51mm NATO").qualities, /UPG \(bipod\)/);
  assert.equal(weapons.find(w => w.name === "FN MAG 7.62×51mm NATO").range, 275);
  assert.equal(weapons.find(w => w.name === "RSA KPV 14.5mm Russian").damage, "3d10+1 (AP 12)");
});
test("the four added categories enforce printed NFM exceptions, zero-threat flame damage and each category’s actual proficiency and untrained penalty", () => {
  const s = sys(20);
  s.proficiencyTotals = { tactical: { proficient: false }, rifle: { proficient: false } };
  for (const w of equipment.weapons.filter(w => /^Table 4\.5[0-3]:/.test(w.sourceTable))) {
    const defaults = firearmDefaults(w.sourceTable, w.qualities),
      proficiency = defaults.weaponCategory === "saw" ? "rifle" : "tactical",
      weapon = { ...w, ...defaults, proficiency },
      before = weaponAttack(s, weapon, cfg);
    assert.equal(before.trained, false);
    s.proficiencyTotals[proficiency].proficient = true;
    const trained = weaponAttack(s, weapon, cfg);
    assert.equal(trained.total - before.total, -w.untrainedPenalty);
    assert.equal(before.error - trained.error, 2);
    s.proficiencyTotals[proficiency].proficient = false;
    if (defaults.weaponCategory === "flamethrower") {
      assert.equal(trained.threat, 0);
      assert.equal(trained.recoilPenalty, 0);
      assert.deepEqual(defaults.fireModes, ["single", "burst", "auto"]);
    } else if (/NFM/.test(w.qualities)) assert.deepEqual(defaults.fireModes, ["single", "burst", "auto"]);
    else assert.deepEqual(defaults.fireModes, ["burst", "auto"]);
  }
});

test("all 28 mortar/launcher source entries retain their exact names, categories, per-launcher weights, Calibers and upgrade allowances", () => {
  const entries = equipment.weapons.filter(w => /^Table 4\.5[6-9]:/.test(w.sourceTable)),
    expected = {
      "Watervliet Arsenal M224 60mm": ["mortar", 44, "IV", 2],
      "Royal Ordnance L-16A2 81mm": ["mortar", 87.5, "V", 2],
      "Soltam Commando 60mm": ["mortar", 15.4, "V", 2],
      "CTS TL-1 37mm": ["grenadeLauncher", 6, "II", 2],
      "CTS TL-8 37mm": ["grenadeLauncher", 10.3, "III", 1],
      "RSA BS-1": ["grenadeLauncher", 3.3, "IV", 1],
      "RSA GP-25 40mm": ["grenadeLauncher", 3.3, "IV", 1],
      "Colt M203 40mm": ["grenadeLauncher", 3, "IV", 1],
      "Colt M203PI 40mm": ["grenadeLauncher", 2.2, "IV", 1],
      "Colt M79 40mm": ["grenadeLauncher", 6, "IV", 1],
      "H&K AG36 40mm": ["grenadeLauncher", 3.8, "IV", 1],
      "Hawk MM-1 40mm": ["grenadeLauncher", 20, "IV", 1],
      "Milkor MGL Mk. 1 40mm": ["grenadeLauncher", 11.7, "IV", 1],
      "RSA AGS-17 30mm": ["grenadeLauncher", 68, "V", 1],
      "Saco Mk. 19 40mm": ["grenadeLauncher", 78, "V", 1],
      "Euromissile Milan": ["missileLauncher", 36.2, "V", 0],
      "Raytheon FIM-92": ["missileLauncher", 5, "V", 0],
      "Raytheon Javelin": ["missileLauncher", 14, "V", 0],
      "RSA SA-7": ["missileLauncher", 10.4, "V", 0],
      "Blacker PIAT": ["rocketLauncher", 34, "III", 1],
      "Talley M72 LAW": ["rocketLauncher", 5.5, "III", 1],
      "Bofors AT4 HE": ["rocketLauncher", 14.8, "IV", 1],
      "Bofors AT4 HEAT": ["rocketLauncher", 14.8, "IV", 1],
      "Bofors AT4 CS HE": ["rocketLauncher", 17, "IV", 1],
      "Bofors AT4 CS HEAT": ["rocketLauncher", 17, "IV", 1],
      "Bofors Carl Gustav": ["rocketLauncher", 25, "IV", 2],
      "RSA RPG-7": ["rocketLauncher", 17.4, "IV", 1],
      "U.S. Arsenal M9A1 rocket launcher": ["rocketLauncher", 12, "IV", 1]
    };
  assert.equal(entries.length, 28);
  assert.deepEqual(entries.map(w => w.name).sort(), Object.keys(expected).sort());
  for (const w of entries) {
    const [category, weight, caliber, upgrades] = expected[w.name],
      defaults = firearmDefaults(w.sourceTable, w.qualities);
    assert.equal(defaults.weaponCategory, category, w.name);
    assert.equal(w.weight, weight, w.name);
    assert.equal(w.caliber, caliber, w.name);
    assert.equal(w.upgradeAllowance, upgrades, w.name);
    assert.equal(
      w.proficiency,
      category === "mortar" ? "Indirect Fire" : category === "missileLauncher" ? "Guided" : "Tactical",
      w.name
    );
    assert.equal(
      w.untrainedPenalty,
      category === "mortar" ? -12 : category === "missileLauncher" ? -10 : category === "grenadeLauncher" ? -6 : -8,
      w.name
    );
    assert.equal(w.noStrengthDamage, true);
    assert.deepEqual(
      weaponFireModes({ ...w, ...defaults, fireModes: w.fireModes ?? defaults.fireModes }),
      w.fireModes ?? ["single"],
      w.name
    );
  }
});
test("launcher source footnotes keep blank ammunition-dependent damage, automatic grenade mode exceptions, mount restrictions, missile weights and disposable bundles distinct", () => {
  const find = name => equipment.weapons.find(w => w.name === name);
  for (const name of ["Watervliet Arsenal M224 60mm", "CTS TL-1 37mm", "Bofors Carl Gustav", "RSA RPG-7"]) {
    assert.equal(find(name).damage, "—");
    assert.match(find(name).rulesNote, /Damage and threat range depend on selected ammunition/);
  }
  assert.equal(find("RSA BS-1").damage, "2d10 (AP 25) explosive");
  assert.match(find("RSA BS-1").rulesNote, /0.4 lbs.*one upgrade/);
  for (const name of ["RSA AGS-17 30mm", "Saco Mk. 19 40mm"]) {
    assert.deepEqual(find(name).fireModes, ["single", "burst", "auto"]);
    assert.match(find(name).rulesNote, /integral tripod.*one shot each instead of three/);
  }
  for (const [name, weight] of [
    ["Euromissile Milan", 14.8],
    ["Raytheon FIM-92", 23],
    ["Raytheon Javelin", 25.1],
    ["RSA SA-7", 22]
  ])
    assert.ok(find(name).rulesNote.includes(`each missile weighs ${weight} lbs.`));
  for (const name of ["Talley M72 LAW", "Bofors AT4 HE", "Bofors AT4 HEAT", "Bofors AT4 CS HE", "Bofors AT4 CS HEAT"]) {
    assert.equal(find(name).bundleSize, 2);
    assert.match(find(name).qualities, /ONE/);
  }
  assert.notEqual(find("U.S. Arsenal M9A1").sourceTable, find("U.S. Arsenal M9A1 rocket launcher").sourceTable);
});

import { launcherOperationPlan } from "../module/rules/firearms.mjs";
import { weaponDamage } from "../module/rules/gear.mjs";
test("each grenade launcher enforces its exact printed underbarrel or integral-tripod/vehicle requirement with strict declarations", () => {
  const expected = {
    "RSA BS-1": "underbarrel",
    "RSA GP-25 40mm": "underbarrel",
    "Colt M203 40mm": "underbarrel",
    "Colt M203PI 40mm": "optionalUnderbarrel",
    "H&K AG36 40mm": "optionalUnderbarrel",
    "RSA AGS-17 30mm": "tripodOrVehicle",
    "Saco Mk. 19 40mm": "tripodOrVehicle"
  };
  for (const w of equipment.weapons.filter(w => w.sourceTable.startsWith("Table 4.57:"))) {
    const weapon = { ...w, ...firearmDefaults(w.sourceTable, w.qualities) },
      requirement = expected[w.name] ?? "";
    assert.equal(w.mountRequirement, requirement, w.name);
    for (const underbarrelMountConfirmed of [false, true])
      for (const usingIntegralTripod of [false, true])
        for (const vehicleMounted of [false, true]) {
          const p = launcherOperationPlan(weapon, { underbarrelMountConfirmed, usingIntegralTripod, vehicleMounted });
          const invalidUnderbarrel =
              underbarrelMountConfirmed && !["underbarrel", "optionalUnderbarrel"].includes(requirement),
            invalidTripod = usingIntegralTripod && requirement !== "tripodOrVehicle";
          assert.equal(
            p.blocked,
            invalidUnderbarrel ||
              invalidTripod ||
              (requirement === "underbarrel"
                ? !underbarrelMountConfirmed
                : requirement === "tripodOrVehicle"
                  ? !usingIntegralTripod && !vehicleMounted
                  : false),
            w.name
          );
        }
  }
  assert.equal(
    launcherOperationPlan(
      { weaponCategory: "grenadeLauncher", mountRequirement: "underbarrel" },
      { underbarrelMountConfirmed: "true" }
    ).blocked,
    true
  );
  assert.equal(
    launcherOperationPlan(
      { weaponCategory: "grenadeLauncher", mountRequirement: "tripodOrVehicle" },
      { usingIntegralTripod: 1, vehicleMounted: "true" }
    ).blocked,
    true
  );
  assert.equal(launcherOperationPlan({ weaponCategory: "grenadeLauncher", mountRequirement: "unknown" }).blocked, true);
  assert.equal(launcherOperationPlan({ weaponCategory: "assaultRifle" }, { indirectFire: true }).applicable, false);
});
test("grenade launchers switch the entire attack profile to Tactical/DEX −6 or Indirect/INT −10, including training, forte and Bombard", () => {
  const entry = equipment.weapons.find(w => w.name === "Colt M79 40mm"),
    weapon = { ...entry, ...firearmDefaults(entry.sourceTable, entry.qualities), proficiency: "tactical" },
    s = {
      ...sys(18),
      abilities: { str: { value: 18, mod: 4 }, dex: { value: 12, mod: 1 }, int: { value: 20, mod: 5 } },
      proficiencyTotals: { tactical: { proficient: true }, indirectFire: { proficient: true, forte: true } }
    },
    snapshot = structuredClone(weapon);
  const direct = weaponAttack(s, weapon, cfg),
    indirect = weaponAttack(s, weapon, cfg, "agent", { indirectFire: true });
  assert.equal(direct.proficiency, "tactical");
  assert.equal(direct.ability, "dex");
  assert.equal(direct.total, -5);
  assert.equal(indirect.proficiency, "indirectFire");
  assert.equal(indirect.ability, "int");
  assert.equal(indirect.total, 0);
  s.proficiencyTotals.tactical.proficient = false;
  s.proficiencyTotals.indirectFire.proficient = false;
  s.proficiencyTotals.indirectFire.forte = false;
  assert.equal(weaponAttack(s, weapon, cfg).total, -11);
  assert.equal(weaponAttack(s, weapon, cfg, "agent", { indirectFire: true }).total, -11);
  s.activeFeatNames = ["Bombard"];
  assert.equal(weaponAttack(s, weapon, cfg).range, 50);
  assert.equal(weaponAttack(s, weapon, cfg, "agent", { indirectFire: true }).range, 100);
  assert.deepEqual(weapon, snapshot);
});
test("mount restrictions guard both attacks and damage; integral tripods also satisfy Brace’s stable-surface requirement without changing weapon data", () => {
  const s = { ...sys(18), proficiencyTotals: { tactical: { proficient: true }, indirectFire: { proficient: true } } },
    raw = equipment.weapons.find(w => w.name === "RSA BS-1"),
    underbarrel = { ...raw, ...firearmDefaults(raw.sourceTable, raw.qualities), proficiency: "tactical" };
  assert.equal(weaponAttack(s, underbarrel, cfg).blocked, true);
  assert.equal(weaponDamage(s, underbarrel).blocked, true);
  assert.equal(weaponAttack(s, underbarrel, cfg, "agent", { underbarrelMountConfirmed: true }).blocked, false);
  const damage = weaponDamage(s, underbarrel, { underbarrelMountConfirmed: true });
  assert.equal(damage.blocked, false);
  assert.equal(damage.launcherOperation.underbarrelMountConfirmed, true);
  assert.equal(damage.bonus, 0);
  const auto = {
    weaponCategory: "grenadeLauncher",
    mountRequirement: "tripodOrVehicle",
    proficiency: "tactical",
    damage: "1d6",
    range: 50,
    sizeHands: "S/2h",
    errorThreat: "1/20",
    fireModes: ["single", "burst", "auto"]
  };
  assert.equal(
    weaponAttack(s, auto, cfg, "agent", { braced: true, attackAction: "standard", usingIntegralTripod: true }).blocked,
    false
  );
  assert.equal(weaponDamage(s, auto).blocked, true);
  assert.equal(weaponDamage(s, auto, { usingIntegralTripod: true }).blocked, false);
});
globalThis.Actor = class {};
globalThis.foundry = {
  utils: { escapeHTML: s => String(s) },
  applications: { api: { DialogV2: { input: async () => null } } }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = { user: { isGM: true }, settings: { get: () => [] }, i18n: { localize: s => s, format: s => s } };
globalThis.ui = { notifications: { warn: () => null } };
const { SpycraftActor } = await import("../module/documents/actor.mjs");
test("actual actor attacks preserve the effective launcher proficiency and mount declaration; damage cancellation and missing mounts produce no roll", async () => {
  const a = new SpycraftActor();
  a.type = "agent";
  a.isOwner = true;
  a.items = [];
  a.system = {
    ...sys(18),
    abilities: { str: { value: 18, mod: 4 }, dex: { value: 12, mod: 1 }, int: { value: 20, mod: 5 } },
    proficiencyTotals: { tactical: { proficient: true }, indirectFire: { proficient: true } }
  };
  a.getRollData = () => ({});
  let rolls = 0;
  a.rollCheck = async (formula, data, options) => {
    rolls++;
    return { formula, data, options };
  };
  const raw = equipment.weapons.find(w => w.name === "RSA BS-1"),
    item = {
      uuid: "Item.launcher",
      type: "weapon",
      name: raw.name,
      system: { ...raw, ...firearmDefaults(raw.sourceTable, raw.qualities), proficiency: "tactical" }
    };
  assert.equal(await a.rollAttack(item), null);
  assert.equal(rolls, 0);
  const attack = await a.rollAttack(item, { underbarrelMountConfirmed: true, indirectFire: true });
  assert.equal(attack.options.weaponProficiency, "indirectFire");
  assert.equal(attack.options.attackContext.launcherOperation.mode, "indirect");
  assert.equal(attack.options.attackContext.launcherOperation.underbarrelMountConfirmed, true);
  assert.equal(await a.rollDamage(item, { includeSneakAttack: false }), null);
  assert.equal(rolls, 1);
  assert.equal(await a.rollDamage(item, { includeSneakAttack: false, underbarrelMountConfirmed: false }), null);
  assert.equal(rolls, 1);
  const damage = await a.rollDamage(item, {
    includeSneakAttack: false,
    underbarrelMountConfirmed: true,
    indirectFire: true
  });
  assert.equal(damage.options.weaponProficiency, "indirectFire");
  assert.equal(damage.options.launcherOperation.underbarrelMountConfirmed, true);
  assert.equal(rolls, 2);
});

test("mortars and rocket launchers use minus three per complete range increment beyond the first, while all other categories retain minus two", () => {
  for (const category of Object.keys(FIREARM_CATEGORIES)) {
    const weapon = { weaponCategory: category, range: 100 },
      per = ["mortar", "rocketLauncher"].includes(category) ? 3 : 2;
    for (const distance of [0, 100, 100.01, 200, 200.01, 300, 999, 1000]) {
      const r = rangedAttackContext(sys(18), weapon, { distanceFeet: distance });
      assert.equal(r.rangePenaltyPerIncrement, per, category);
      assert.equal(r.rangePenalty, -per * (Math.max(1, Math.ceil(distance / 100)) - 1) || 0, category + "/" + distance);
      assert.equal(r.rangeBlocked, distance > 100 * FIREARM_CATEGORIES[category].maxIncrements);
    }
    assert.equal(rangedAttackContext(sys(18), weapon).rangePenaltyPerIncrement, per);
    assert.equal(
      rangedAttackContext(sys(18), weapon, { distanceFeet: 100 * FIREARM_CATEGORIES[category].maxIncrements + 0.01 })
        .rangeBlocked,
      true
    );
  }
});
test("the actual mortar/rocket range adjustment respects source range multipliers and improved vision, and is preserved by the actor attack record", async () => {
  const s = {
      ...sys(18),
      abilities: { str: { value: 18, mod: 4 }, dex: { value: 12, mod: 1 }, int: { value: 20, mod: 5 } },
      proficiencyTotals: { tactical: { proficient: true }, indirectFire: { proficient: true } },
      originEffects: [{ qualityKey: "improvedVision", name: "Improved vision" }],
      activeFeatNames: ["Bombard"]
    },
    weapon = {
      weaponCategory: "mortar",
      proficiency: "indirectFire",
      damage: "1d6",
      range: 100,
      sizeHands: "S/2h",
      errorThreat: "1/20"
    };
  const r = weaponAttack(s, weapon, cfg, "agent", { distanceFeet: 401, mortarSpaceConfirmed: true });
  assert.equal(r.range, 200);
  assert.equal(r.rangePenaltyBase, -6);
  assert.equal(r.rangePenalty, -4);
  const a = new SpycraftActor();
  a.type = "agent";
  a.isOwner = true;
  a.items = [];
  a.system = s;
  a.getRollData = () => ({});
  a.rollCheck = async (formula, data, options) => ({ data, options });
  const result = await a.rollAttack(
    { type: "weapon", uuid: "Item.mortar", name: "Fixture mortar", system: weapon },
    { distanceFeet: 401, mortarSpaceConfirmed: true }
  );
  assert.equal(result.options.attackContext.rangePenaltyPerIncrement, 3);
  assert.equal(result.options.attackContext.rangePenalty, -4);
  assert.equal(result.options.attackContext.rangePenaltyBase, -6);
});

const { mortarOperationPlan } = await import("../module/rules/firearms.mjs");
const mortarWeapon = name => {
  const w = equipment.weapons.find(w => w.name === name);
  return { ...w, ...firearmDefaults(w.sourceTable, w.qualities), proficiency: "indirectFire" };
};
test("all three canonical mortars require explicit high-arc firing space and cannot fire while disassembled", () => {
  const s = {
    ...sys(18),
    abilities: { str: { value: 18, mod: 4 }, dex: { value: 12, mod: 1 }, int: { value: 14, mod: 2 } },
    proficiencyTotals: { indirectFire: { proficient: true } }
  };
  for (const w of equipment.weapons
    .filter(w => w.sourceTable.startsWith("Table 4.56:"))
    .map(w => mortarWeapon(w.name))) {
    for (const declaration of [undefined, false, "true", 1]) {
      assert.equal(mortarOperationPlan(w, { mortarSpaceConfirmed: declaration }).blocked, true);
      assert.equal(weaponAttack(s, w, cfg, "agent", { mortarSpaceConfirmed: declaration }).blocked, true);
      assert.equal(weaponDamage(s, { ...w, damage: "2d6" }, { mortarSpaceConfirmed: declaration }).blocked, true);
    }
    const before = structuredClone(w);
    assert.equal(weaponAttack(s, w, cfg, "agent", { mortarSpaceConfirmed: true }).blocked, false);
    const damage = weaponDamage(s, { ...w, damage: "2d6" }, { mortarSpaceConfirmed: true });
    assert.equal(damage.blocked, false);
    assert.equal(damage.mortarOperation.mortarSpaceConfirmed, true);
    assert.equal(damage.bonus, 0);
    assert.equal(
      weaponAttack(s, { ...w, disassembled: true }, cfg, "agent", { mortarSpaceConfirmed: true }).blocked,
      true
    );
    assert.equal(
      weaponDamage(s, { ...w, disassembled: true, damage: "2d6" }, { mortarSpaceConfirmed: true }).blocked,
      true
    );
    assert.deepEqual(w, before);
  }
  for (const category of Object.keys(FIREARM_CATEGORIES).filter(c => c !== "mortar"))
    assert.equal(mortarOperationPlan({ weaponCategory: category, disassembled: true }).applicable, false);
});
test("source assembly/disassembly times retain six and ten half actions without inventing a time for the commando model", () => {
  assert.equal(mortarWeapon("Royal Ordnance L-16A2 81mm").assemblyHalfActions, 10);
  assert.equal(mortarWeapon("Watervliet Arsenal M224 60mm").assemblyHalfActions, 6);
  assert.equal(
    mortarOperationPlan(mortarWeapon("Soltam Commando 60mm"), { mortarSpaceConfirmed: true }).assemblyHalfActions,
    0
  );
});
test("actor mortar paths retain firing-space evidence and block or cancel before rolling when conditions are missing", async () => {
  const a = new SpycraftActor();
  a.type = "agent";
  a.isOwner = true;
  a.items = [];
  a.system = {
    ...sys(18),
    abilities: { str: { value: 18, mod: 4 }, dex: { value: 12, mod: 1 }, int: { value: 14, mod: 2 } },
    proficiencyTotals: { indirectFire: { proficient: true } }
  };
  a.getRollData = () => ({});
  let rolls = 0;
  a.rollCheck = async (formula, data, options) => {
    rolls++;
    return { formula, data, options };
  };
  const item = {
    uuid: "Item.mortar",
    type: "weapon",
    name: "Mortar fixture",
    system: { ...mortarWeapon("Watervliet Arsenal M224 60mm"), damage: "2d6" }
  };
  assert.equal(await a.rollAttack(item), null);
  assert.equal(await a.rollDamage(item, { includeSneakAttack: false }), null);
  assert.equal(rolls, 0);
  const attack = await a.rollAttack(item, { mortarSpaceConfirmed: true });
  assert.equal(attack.options.attackContext.mortarOperation.mortarSpaceConfirmed, true);
  const damage = await a.rollDamage(item, { mortarSpaceConfirmed: true, includeSneakAttack: false });
  assert.equal(damage.options.mortarOperation.mortarSpaceConfirmed, true);
  item.system.disassembled = true;
  assert.equal(await a.rollAttack(item, { mortarSpaceConfirmed: true }), null);
  assert.equal(await a.rollDamage(item, { mortarSpaceConfirmed: true, includeSneakAttack: false }), null);
  assert.equal(rolls, 2);
});
const { rulesRefreshChanges } = await import("../module/rules/refresh.mjs");
test("catalog refresh updates mortar assembly time while preserving the player’s disassembled state", () => {
  const w = { id: "mortar", name: "Mortar", type: "weapon", system: { assemblyHalfActions: 0, disassembled: true } },
    canonical = { name: "Mortar", type: "weapon", system: { assemblyHalfActions: 6, disassembled: false } };
  assert.deepEqual(
    rulesRefreshChanges(w, canonical).map(c => c.path),
    ["system.assemblyHalfActions"]
  );
  assert.equal(w.system.disassembled, true);
});

test("Prone permits free Brace while retaining its surface, firearm, cone and recoil requirements", () => {
  const system = { conditionContext: { prone: true }, activeFeatNames: [] };
  const p = aimBraceContext(
    system,
    {},
    { braced: true, stableSurface: true, ranged: true, firearm: true, attackAction: "standard" }
  );
  assert.equal(p.blocked, false);
  assert.equal(p.braceAction, "free");
  assert.equal(p.braceBonus, 1);
  assert.equal(p.recoilStrengthIncrease, 2);
  assert.equal(aimBraceContext(system, {}, { braced: true, ranged: true, firearm: true }).blocked, true);
  assert.equal(
    aimBraceContext(
      { ...system, conditionContext: {} },
      {},
      { braced: true, stableSurface: true, ranged: true, firearm: true }
    ).braceAction,
    "half"
  );
});
