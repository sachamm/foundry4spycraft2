import { SKILLS, TABLES } from "./rules/tables.mjs";

export const SPYCRAFT = {};

SPYCRAFT.abilities = {
  str: "SPYCRAFT.Ability.str",
  dex: "SPYCRAFT.Ability.dex",
  con: "SPYCRAFT.Ability.con",
  int: "SPYCRAFT.Ability.int",
  wis: "SPYCRAFT.Ability.wis",
  cha: "SPYCRAFT.Ability.cha"
};

SPYCRAFT.saves = {
  fort: { label: "SPYCRAFT.Save.fort", ability: "con" },
  ref: { label: "SPYCRAFT.Save.ref", ability: "dex" },
  will: { label: "SPYCRAFT.Save.will", ability: "wis" }
};

/** Skill definitions: { key: { key, name, abilities: [a, b], focus } } */
SPYCRAFT.skills = Object.fromEntries(SKILLS.map(s => [s.key, s]));

/** Rules tables generated from src/data by `npm run build`. */
SPYCRAFT.tables = TABLES;

/** Default point-buy budget for attributes. */
SPYCRAFT.pointBuy = 36;

/** Career levels at which an attribute increase is gained. */
SPYCRAFT.abilityIncreaseLevels = [4, 8, 12, 16, 20];

SPYCRAFT.featTrees = {
  basicCombat: "Basic Combat",
  meleeCombat: "Melee Combat",
  rangedCombat: "Ranged Combat",
  unarmedCombat: "Unarmed Combat",
  chance: "Chance",
  chase: "Chase",
  covert: "Covert",
  gear: "Gear",
  basicSkill: "Basic Skill",
  advancedSkill: "Advanced Skill",
  style: "Style",
  terrain: "Terrain",
  tradecraft: "Tradecraft"
};

SPYCRAFT.proficiencies = {
  unarmed: { label: "Unarmed", ability: "str" },
  blunt: { label: "Blunt", ability: "str" },
  exoticBlunt: { label: "Exotic (Blunt)", ability: "str" },
  edged: { label: "Edged", ability: "str" },
  exoticEdged: { label: "Exotic (Edged)", ability: "str" },
  explosives: { label: "Explosives", ability: "int" },
  guided: { label: "Guided", ability: "int" },
  handgun: { label: "Handgun", ability: "dex" },
  hurled: { label: "Hurled", ability: "dex" },
  exoticHurled: { label: "Exotic (Hurled)", ability: "dex" },
  indirectFire: { label: "Indirect Fire", ability: "int" },
  rifle: { label: "Rifle", ability: "dex" },
  shotgun: { label: "Shotgun", ability: "dex" },
  submachineGun: { label: "Submachine Gun", ability: "dex" },
  tactical: { label: "Tactical", ability: "dex" },
  vehicleWeapon: { label: "Vehicle Weapon", ability: "dex" }
};

/** Mission-gear pick categories. */
SPYCRAFT.gearPicks = {
  R: "Resources",
  T: "Tradecraft",
  V: "Vehicles",
  S: "Security",
  G: "Gadgets",
  W: "Weapons",
  E: "Electronics",
  CHA: "Charisma"
};

/** Fixed focus lists for focus skills (Profession is free-form). */
SPYCRAFT.focuses = TABLES.focuses;

SPYCRAFT.originTypes = { talent: "SPYCRAFT.Origin.talent", specialty: "SPYCRAFT.Origin.specialty" };

SPYCRAFT.calibers = { 0: "—", 1: "I", 2: "II", 3: "III", 4: "IV", 5: "V" };

/** Human-readable labels for bonus targets (used on item sheets). */
SPYCRAFT.bonusTargets = {
  "abilities.str": "Strength", "abilities.dex": "Dexterity", "abilities.con": "Constitution",
  "abilities.int": "Intelligence", "abilities.wis": "Wisdom", "abilities.cha": "Charisma",
  "saves.fort": "Fortitude save", "saves.ref": "Reflex save", "saves.will": "Will save",
  defense: "Defense", defenseArmor: "Defense (while armored)", armorCheck: "Armor check penalty",
  initiative: "Initiative", speed: "Speed", vitality: "Vitality", wounds: "Wounds", stressDamage: "Stress damage",
  knowledge: "Knowledge checks", wealth: "Wealth", lifestyle: "Lifestyle", possessions: "Possessions", spendingCash: "Spending cash",
  contacts: "Contacts", interests: "Interests", subplots: "Subplots", skillPoints: "Skill points / level",
  classSkillPicks: "Extra class skills", "actionDice.count": "Action dice", "actionDice.bonus": "Action die bonus",
  "focus.cultures": "Cultures focuses", "focus.drive": "Drive focuses", "focus.profession": "Profession focuses",
  "focus.science": "Science focuses", "focus.generic": "Generic focuses", "prof.generic": "Weapon proficiencies",
  "featSlots.any": "Feats (any)"
};
for (const [k, v] of Object.entries(SPYCRAFT.featTrees)) SPYCRAFT.bonusTargets[`featSlots.${k}`] = `${v} feats`;
for (const [k, v] of Object.entries(SPYCRAFT.proficiencies)) SPYCRAFT.bonusTargets[`prof.${k}`] = `${v.label} proficiency`;
for (const s of SKILLS) {
  SPYCRAFT.bonusTargets[`skills.${s.key}.misc`] = `${s.name} bonus`;
  SPYCRAFT.bonusTargets[`skills.${s.key}.threat`] = `${s.name} threat range`;
  SPYCRAFT.bonusTargets[`skills.${s.key}.cap`] = `${s.name} result cap`;
  SPYCRAFT.bonusTargets[`skills.${s.key}.classSkill`] = `${s.name} is a class skill`;
}
