import { SKILLS, TABLES, CLASS_FEATURES } from "./rules/tables.mjs";
import { loc } from "./i18n.mjs";

export const SPYCRAFT = { classFeatures: CLASS_FEATURES };

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
  unarmed: {
    get label() {
      return loc`Unarmed`;
    },
    ability: "str"
  },
  blunt: {
    get label() {
      return loc`Blunt`;
    },
    ability: "str"
  },
  exoticBlunt: {
    get label() {
      return loc`Exotic (Blunt)`;
    },
    ability: "str"
  },
  edged: {
    get label() {
      return loc`Edged`;
    },
    ability: "str"
  },
  exoticEdged: {
    get label() {
      return loc`Exotic (Edged)`;
    },
    ability: "str"
  },
  explosives: {
    get label() {
      return loc`Explosives`;
    },
    ability: "int"
  },
  guided: {
    get label() {
      return loc`Guided`;
    },
    ability: "int"
  },
  handgun: {
    get label() {
      return loc`Handgun`;
    },
    ability: "dex"
  },
  hurled: {
    get label() {
      return loc`Hurled`;
    },
    ability: "dex"
  },
  exoticHurled: {
    get label() {
      return loc`Exotic (Hurled)`;
    },
    ability: "dex"
  },
  indirectFire: {
    get label() {
      return loc`Indirect Fire`;
    },
    ability: "int"
  },
  rifle: {
    get label() {
      return loc`Rifle`;
    },
    ability: "dex"
  },
  shotgun: {
    get label() {
      return loc`Shotgun`;
    },
    ability: "dex"
  },
  submachineGun: {
    get label() {
      return loc`Submachine Gun`;
    },
    ability: "dex"
  },
  tactical: {
    get label() {
      return loc`Tactical`;
    },
    ability: "dex"
  },
  vehicleWeapon: {
    get label() {
      return loc`Vehicle Weapon`;
    },
    ability: "dex"
  }
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
  "abilities.str": "Strength",
  "abilities.dex": "Dexterity",
  "abilities.con": "Constitution",
  "abilities.int": "Intelligence",
  "abilities.wis": "Wisdom",
  "abilities.cha": "Charisma",
  "baseSave.fort": "Base Fortitude",
  "baseSave.ref": "Base Reflex",
  "baseSave.will": "Base Will",
  "saves.fort": "Fortitude save",
  "saves.ref": "Reflex save",
  "saves.will": "Will save",
  defense: "Defense",
  defenseArmor: "Defense (while armored)",
  armorCheck: "Armor check penalty",
  initiative: "Initiative",
  speed: "Speed",
  vitality: "Vitality",
  wounds: "Wounds",
  stressDamage: "Stress damage",
  baseDefense: "Base Defense",
  stressThreshold: "Stress threshold",
  subdualThreshold: "Subdual threshold",
  defensePartialArmor: "Partial armor Defense modifier",
  naturalDR: "Natural damage reduction",
  largeSize: "Large Size",
  knowledge: "Knowledge checks",
  wealth: "Wealth",
  lifestyle: "Lifestyle",
  possessions: "Possessions",
  spendingCash: "Spending cash",
  contacts: "Contacts",
  interests: "Interests",
  subplots: "Subplots",
  skillPoints: "Skill points / level",
  discountedSkillRanks: "Cross-class ranks purchased at one point each",
  untrainedSkillCap: "Untrained result-cap increase",
  classSkillPicks: "Extra class skills",
  "actionDice.count": "Action dice",
  "actionDice.bonus": "Action die bonus",
  "focus.cultures": "Cultures focuses",
  "focus.drive": "Drive focuses",
  "focus.profession": "Profession focuses",
  "focus.science": "Science focuses",
  "focus.generic": "Generic focuses",
  "prof.generic": "Weapon proficiencies",
  "featSlots.any": "Feats (any)"
};
for (const [k, v] of Object.entries(SPYCRAFT.featTrees)) SPYCRAFT.bonusTargets[`featSlots.${k}`] = `${v} feats`;
for (const [k, v] of Object.entries(SPYCRAFT.proficiencies))
  SPYCRAFT.bonusTargets[`prof.${k}`] = `${v.label} proficiency`;
for (const s of SKILLS) {
  SPYCRAFT.bonusTargets[`skills.${s.key}.misc`] = `${s.name} bonus`;
  SPYCRAFT.bonusTargets[`skills.${s.key}.threat`] = `${s.name} threat range`;
  SPYCRAFT.bonusTargets[`skills.${s.key}.baseThreat`] = `${s.name} base threat range`;
  SPYCRAFT.bonusTargets[`skills.${s.key}.errorReduction`] = `${s.name} error-range reduction`;
  SPYCRAFT.bonusTargets[`skills.${s.key}.maxRanks`] = `${s.name} maximum-rank increase`;
  SPYCRAFT.bonusTargets[`skills.${s.key}.cap`] = `${s.name} result cap`;
  SPYCRAFT.bonusTargets[`skills.${s.key}.classSkill`] = `${s.name} is a class skill`;
}
