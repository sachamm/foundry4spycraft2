const { BooleanField, HTMLField, NumberField, StringField } = foundry.data.fields;

const int = (initial = 0, opts = {}) => new NumberField({ required: true, integer: true, initial, ...opts });

class BaseItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new HTMLField(),
      source: new StringField({ blank: true })
    };
  }
}

export class ClassData extends BaseItemData {
  static defineSchema() {
    return { ...super.defineSchema(), levels: int(1, { min: 1, max: 20 }), vitalityDie: new StringField({ initial: "d8" }) };
  }
}

/** Talents and specialties. */
export class OriginData extends BaseItemData {
  static defineSchema() {
    return { ...super.defineSchema(), originType: new StringField({ initial: "talent", choices: ["talent", "specialty"] }) };
  }
}

export class FeatData extends BaseItemData {
  static defineSchema() {
    return { ...super.defineSchema(), category: new StringField({ blank: true }) };
  }
}

export class GearData extends BaseItemData {
  static defineSchema() {
    return { ...super.defineSchema(), quantity: int(1, { min: 0 }), caliber: int(0, { min: 0 }), equipped: new BooleanField() };
  }
}

export class WeaponData extends GearData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      damage: new StringField({ initial: "1d6" }),
      threat: int(20, { min: 1, max: 20 }),
      error: int(1, { min: 1, max: 20 }),
      range: int(0, { min: 0 })
    };
  }
}

export class ArmorData extends GearData {
  static defineSchema() {
    return { ...super.defineSchema(), damageReduction: int(0, { min: 0 }), defensePenalty: int(0) };
  }
}
