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
      bonuses: bonusField(),
      featGrants: new ArrayField(new SchemaField({ level: int(1), feat: str() })),
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
      ranks: int(1, { min: 1 }),
      /** Career level when feat was acquired; 0 means legacy/unknown. */
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
      /** Mission gear pick category (R/T/V/S/G/W/E/CHA) — blank for personal gear. */
      pick: str(""),
      reserve: new BooleanField(),
      common: new BooleanField()
    };
  }
}

export class WeaponData extends GearData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      proficiency: str("handgun"),
      damage: str("1d6"),
      error: int(1, { min: 0, max: 20 }),
      threat: int(20, { min: 1, max: 20 }),
      errorThreat: str(),
      ammo: str(),
      recoil: int(0),
      range: int(0, { min: 0 }),
      sizeHands: str(),
      qualities: str(),
      untrainedPenalty: int(-4)
    };
  }

  /** Dice portion of the damage string ("1d8+1 sub" → "1d8+1"). */
  get damageFormula() {
    const m = String(this.damage).match(/^\s*\+?\s*(\d*d\d+(?:\s*[+-]\s*\d+)?)/i);
    return m ? m[1].replace(/\s/g, "") : "";
  }

  get isMelee() {
    return ["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged"].includes(this.proficiency);
  }
}

export class ArmorData extends GearData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      damageReduction: int(0, { min: 0 }),
      damageReductionSubdual: int(0, { min: 0 }),
      resistances: str(),
      defensePenalty: int(0),
      armorCheck: int(0),
      speedPenalty: int(0),
      notice: str()
    };
  }
}
