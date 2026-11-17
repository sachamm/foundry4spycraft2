import {weaponDamageExpression} from '../rules/weapon-damage-expression.mjs';
const { ArrayField, BooleanField, HTMLField, NumberField, ObjectField, SchemaField, StringField } = foundry.data.fields;

const int = (initial = 0, opts = {}) => new NumberField({ required: true, nullable: false, integer: true, initial, ...opts });
const num = (initial = 0, opts = {}) => new NumberField({ required: true, nullable: false, initial, ...opts });
const str = (initial = "", opts = {}) => new StringField({ required: true, blank: true, initial, ...opts });

/**
 * A numeric modifier contributed by an item.
 * target: dotted key such as "abilities.dex", "saves.ref", "skills.sneak.misc", "featSlots.chase".
 * value:  formula string, e.g. "2", "@tb.t1", "max(1, @abilities.cha.mod)".
 * level:  for class bonuses, the class level at which it applies (0 = always).
 */
export const bonusField = () => new ArrayField(new SchemaField({
  target: str(),
  value: str("0"),
  bonusType: str(),
  level: int(0, { min: 0 })
}));

class BaseItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new HTMLField(),
      source: str()
    };
  }
}

export class ClassData extends BaseItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      identifier: str(),
      expert: new BooleanField(),
      skillPoints: int(4, { min: 0 }),
      vitalityDie: int(8, { min: 0 }),
      proficiencies: int(0, { min: 0 }),
      coreAbility: new SchemaField({ name: str(), description: str() }),
      classSkills: new ArrayField(new StringField()),
      /** Per-level progression: [{ level, bab, fort, ref, will, defense, initiative, wealth, gearR … gearE }] */
      table: new ArrayField(new ObjectField()),
      /** Class abilities by level; descriptions may contain [[formula]] placeholders. */
      abilities: new ArrayField(new SchemaField({ level: int(1), name: str(), description: str() })),
      /** Selectable ability lists: [{ key, name, options: [{ index, name, description, bonuses }] }] */
      choiceLists: new ArrayField(new ObjectField()),
      /** When choices are gained: [{ level, list }] */
      choiceSchedule: new ArrayField(new SchemaField({ level: int(1), list: str() })),
      /** The owning agent's selections: { "<scheduleIndex>": optionIndex } */
      choices: new ObjectField(),
      inheritedChoices: new ObjectField(),
      skillChoices: new ObjectField(),
      weaponSpecialist: new ObjectField(),
      keySkill: str(),
      keyFocus: str(),
      professionFocus: str(),
      phdSkill: str(),
      phdSkill1: str(),
      phdSkill2: str(),
      bonuses: bonusField(),
      featGrants: new ArrayField(new SchemaField({ level: int(1), feat: str(), choice: str() })),
      requirements: new ObjectField({ nullable: true, initial: null })
    };
  }

  /** Row of the class table for a class level (1-based). */
  row(level) {
    return this.table.find(r => r.level === level) ?? null;
  }

  get maxLevel() {
    return this.table.length || (this.expert ? 10 : 20);
  }
}

/** Talents and specialties. */
export class OriginData extends BaseItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      originType: str("talent", { choices: ["talent", "specialty"] }),
      /** Creation choices: attributes, class skills, threat skill and rank-limit skills. */
      originChoices: new ObjectField(),
      bonuses: bonusField(),
      /** Names of feats granted by this origin. */
      grants: new ArrayField(new StringField())
    };
  }
}

export class FeatData extends BaseItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      tree: str(),
      prerequisites: new ObjectField({ nullable: true, initial: null }),
      prerequisitesNotChecked: new BooleanField(),
      /** Legacy field: each feat selection is now a separate item. */
      ranks: int(1, { min: 1 }),
      repeatable: new BooleanField(),
      maxSelections: int(0, { min: 0 }),
      temporaryGrant: new ObjectField({nullable:true,initial:null}),
      featKind: str("permanent", { choices: ["permanent", "temporary", "virtual"] }),
      candidateBasis: new ObjectField({nullable:true,initial:null}),
      choice: str(),
      contactGrantMode: str("associate",{choices:["associate","improve"]}),
      contactTheme: str(),
      contactThemeConfirmed: new BooleanField(),
      restrictions: str(),
      trainingSkills: new ObjectField(),
      focusChoices: new ArrayField(new SchemaField({kind:str("focus",{choices:["focus","forte"]}),skill:str(),focus:str(),forte:str()})),
      manualPrerequisitesConfirmed: new BooleanField(),
      /** Career level when feat was acquired; 0 means legacy/unknown. */
      acquisitionSource: str(),
      acquisitionCheck: new ObjectField({nullable:true,initial:null}),
      historicalPrerequisitesConfirmed: new BooleanField(),
      acquiredAtLevel: int(0, { min: 0, max: 20 }),
      /** Granted by an origin or class (does not use a feat slot). */
      granted: new BooleanField(),
      grantSource: str(),
      bonuses: bonusField()
    };
  }
}

export class GearData extends BaseItemData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      quantity: int(1, { min: 0 }),
      caliber: int(0, { min: 0, max: 5 }),
      weight: num(0, { min: 0 }),
      equipped: new BooleanField(),
      carried: new BooleanField({initial:true}),
      /** Mission gear pick category (R/T/V/S/G/W/E/CHA) — blank for personal gear. */
      pick: str(""),
      pickCount: int(1,{min:1}),
      possessionSource: str("",{choices:["","wealth","gcGrant"]}),
      possessionApproved: new BooleanField(),
      cleanAndPolishedReady: new BooleanField(),
      bundleSize: int(1,{min:1}),
      gearCategory: str(),
      kitType: str(),
      kitGrade: int(0,{min:0,max:3}),
      kitSize: str(),
      kitNonPortable: new BooleanField(),
      kitLocation: str(),
      reserve: new BooleanField(),
      reserveAcquisition: new ObjectField({nullable:true,initial:null}),
      armorMissionGrant: new ObjectField({nullable:true,initial:null}),
      bigStickMissionPick: new ObjectField({nullable:true,initial:null}),
      missionCaliberGrant: new ObjectField({nullable:true,initial:null}),
      classGearGrant: new ObjectField({nullable:true,initial:null}),
      common: new BooleanField()
    };
  }
}

export class WeaponData extends GearData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      gearCategory: str("W"),
      proficiency: str("handgun"),
      attackAbility: str(),
      improvised: new BooleanField(),
      ammunitionOnly: new BooleanField(),
      ammunitionKind: str(),
      explosiveAmmunition: new BooleanField(),
      loadedAmmoId: str(),
      stockpileSize: int(0,{min:0}),
      shotWeight: num(0,{min:0}),
      upgradeCost: int(0,{min:0}),
      upgradeAllowance: int(null,{nullable:true,min:0}),
      commonItemCost: int(0,{min:0}),
      noStrengthDamage: new BooleanField(),
      useHands: int(0,{min:0,max:2}),
      useFinesse: new BooleanField(),
      grantFinesse: new BooleanField(),
      destroyed: new BooleanField(),
      destroyedByRoll: str(),
      damage: str("1d6"),
      error: int(1, { min: 0, max: 20 }),
      threat: int(20, { min: 0, max: 20 }),
      errorThreat: str(),
      ammo: str(),
      ammoChamber: str(),
      ammoCodeChoice: str(),
      ammoCodeOptions: new ArrayField(new StringField()),
      recoil: int(0),
      meleeFamily: str("",{choices:["","axe","spear","whip","staff","hammer","twoHandedSword","oneHandedSword","polearm","flail"]}),
      weaponCategory: str(),
      disassembled: new BooleanField(),
      assemblyHalfActions: int(0,{min:0}),
      mountRequirement: str("",{choices:["","underbarrel","optionalUnderbarrel","tripodOrVehicle"]}),
      fireModes: new ArrayField(new StringField()),
      fireMode: str(),
      stockExtended: new BooleanField(),
      range: num(0, { min: 0 }),
      maxRangeIncrements: int(0,{min:0}),
      sizeHands: str(),
      qualities: str(),
      untrainedPenalty: int(-4)
    };
  }

  /** Rollable numeric expression; separately labelled components need their own resolution. */
  get damageFormula() {
    const parsed=weaponDamageExpression(this.damage);
    return parsed&&!parsed.componentReview?parsed.expression:"";
  }

  get isMelee() {
    return ["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged"].includes(this.proficiency);
  }
}

export class ArmorData extends GearData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      gearCategory: str("S"),
      armorType: str("P"),
      armorSlot: str(),
      sealed: new BooleanField(),
      visionPenalty: new BooleanField(),
      damageReduction: int(0, { min: 0 }),
      /** Legacy storage name: DR against other attacks, not subdual damage. */
      damageReductionSubdual: int(0, { min: 0 }),
      resistances: str(),
      defensePenalty: int(0),
      armorCheck: int(0),
      speedPenalty: int(0),
      notice: str()
    };
  }
}
